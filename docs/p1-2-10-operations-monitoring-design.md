# P1-2.10 운영 상태 감시·장애 알림 설계

## 1. 목적

P1-2.9에서 유지보수 작업의 자동 실행과 실행 원장을 구축했지만, 실패·지연·Cron 비활성 상태를 운영자가 화면을 열어 직접 확인해야 한다. 이번 단계에서는 유지보수 상태를 주기적으로 판정하고, 장애의 발생과 복구를 사건 원장으로 보존하며, 이메일 전달 outbox와 Edge Function을 통해 운영자에게 알린다.

핵심 목표는 다음과 같다.

- Cron 등록 이상, 실행 지연, 연속 실패, 처리량 포화, 잠금 경합을 자동 감지한다.
- 같은 원인의 장애를 중복 생성하지 않고 하나의 열린 사건으로 집계한다.
- 정상화가 확인되면 사건을 자동 해결하고 복구 알림을 생성한다.
- 장애 판정과 이메일 전달을 분리해 이메일 공급자 장애가 감시 자체를 막지 않게 한다.
- 이메일 요청은 짧은 수명의 일회용 토큰으로 인증한다.
- 관리자 화면에서 현재 시스템 상태, 열린 장애, 최근 복구, 전달 결과를 조회한다.

## 2. 범위

- 유지보수 작업별 감시 정책
- 운영 장애 발생·복구 사건 원장
- 이메일 알림 outbox와 전달 이력
- 5분 주기의 상태 scanner
- `pg_net`을 이용한 Edge Function 비동기 호출
- Resend 기반 이메일 Edge Function
- 관리자 운영 상태 화면 `/admin/operations`
- 통합 운영 감사 기록에 장애 발생·복구 추가
- Hosted 장애·복구·토큰 재사용·권한·dry-run 전달 검증

## 3. 비범위

- SMS, 전화, Slack, Discord, PagerDuty
- 관리자 화면에서 감시 임계치 수정
- 이메일 공급자 계정과 도메인 생성
- 데이터베이스·API·웹 전체 APM
- 자동 장애 조치 또는 작업 강제 재실행
- 사용자 대상 서비스 알림

## 4. 감시 정책

`operations_monitor_policies`가 유지보수 작업별 판정 기준을 가진다.

| job key | 예상 주기 | 실행 지연 기준 | 연속 실패 | max-batch 포화 | lock skip |
|---|---:|---:|---:|---:|---:|
| `expire_user_sanctions` | 15분 | 35분 | 2회 | 3회 | 3회/30분 |
| 일별 작업 5종 | 1,440분 | 1,560분 | 2회 | 3회 | 3회/60분 |

모든 정책은 migration으로만 변경한다. `maintenance_job_definitions.enabled = false`인 작업은 실행 지연·실패 판정에서 제외하되, 활성 Cron이 남아 있으면 구성 불일치 사건을 생성한다.

## 5. 장애 유형

### 5.1 `cron_missing`

활성화된 작업 정의에 대응하는 `cron.job`이 없을 때 발생한다.

### 5.2 `cron_inactive`

Cron Job은 존재하지만 `active = false`일 때 발생한다.

### 5.3 `schedule_mismatch`

정의 테이블의 schedule과 실제 Cron schedule이 다를 때 발생한다.

### 5.4 `execution_stale`

최근 완료 실행이 없거나, 마지막 완료 시각이 정책의 `stale_after_minutes`보다 오래됐을 때 발생한다. 신규 정책에는 `monitor_after` 유예 시각을 두어 배포 직후 오탐을 방지한다.

### 5.5 `consecutive_failures`

최근 성공 또는 무처리 실행 이후 `failed`가 임계치 이상 연속될 때 발생한다. `skipped_locked`와 `disabled`는 실패 횟수에 포함하지 않는다.

### 5.6 `batch_saturation`

최근 연속 실행이 모두 `batch_count = max_batches`이고 임계치 이상 지속될 때 발생한다. 단발성 backlog는 장애로 보지 않는다.

### 5.7 `lock_contention`

정해진 관찰 구간 안에 `skipped_locked`가 임계치 이상 발생할 때 발생한다.

### 5.8 `disabled_but_scheduled`

정의는 비활성인데 실제 Cron Job이 활성 상태일 때 발생한다.

## 6. 장애 원장

### `operations_incidents`

한 번의 장애 발생부터 복구까지를 하나의 사건으로 저장한다.

- `id UUID`
- `job_key TEXT`
- `incident_type TEXT`
- `severity TEXT`: `warning`, `critical`
- `status TEXT`: `open`, `resolved`
- `summary TEXT`
- `first_detected_at`, `last_detected_at`
- `occurrence_count INTEGER`
- `healthy_scan_count INTEGER`
- `opened_run_id BIGINT NULL`
- `latest_run_id BIGINT NULL`
- `resolved_at TIMESTAMPTZ NULL`
- `evidence JSONB`

`status = 'open'`인 동일 `(job_key, incident_type)` 사건은 하나만 존재하도록 partial unique index를 둔다. 복구 뒤 같은 문제가 다시 발생하면 새 사건을 만든다.

사건은 scanner만 변경한다. 브라우저 역할은 테이블에 직접 접근할 수 없다.

## 7. 복구 판정과 flapping 방지

장애 조건이 사라진 첫 scanner 실행에서는 `healthy_scan_count`만 증가시킨다. 연속 2회 정상으로 확인되면 `resolved`로 전환한다. 장애 조건이 다시 나타나면 정상 횟수를 0으로 초기화한다.

Cron 누락·비활성처럼 구성 상태가 명확한 사건도 동일한 2회 복구 기준을 적용해 짧은 migration 구간의 flapping을 줄인다.

## 8. 이메일 outbox

### `operations_alert_deliveries`

장애 발생과 복구 알림을 이메일 전달 단계와 분리한다.

- `id UUID`
- `incident_id UUID`
- `event_type TEXT`: `opened`, `resolved`
- `delivery_mode TEXT`: `email`, `hosted_validation`
- `status TEXT`: `pending`, `dispatched`, `processing`, `delivered`, `retry_wait`, `failed`
- `attempt_count INTEGER`
- `next_attempt_at TIMESTAMPTZ`
- `dispatch_request_id BIGINT NULL`
- `token_hash TEXT NULL`
- `token_expires_at TIMESTAMPTZ NULL`
- `provider_message_id TEXT NULL`
- `last_error_code`, `last_error_message`
- `created_at`, `updated_at`, `delivered_at`

장애 사건의 `opened`와 `resolved`마다 한 행만 생성한다. 전달 실패는 사건 상태를 되돌리지 않는다.

## 9. 일회용 호출 인증

scanner는 전달 대상마다 32-byte random token을 만든다.

1. DB에는 SHA-256 hash만 저장한다.
2. `pg_net` 요청 body에는 delivery ID와 평문 token만 넣는다.
3. 토큰 수명은 10분이다.
4. Edge Function은 service-role RPC `claim_operations_alert_delivery`를 호출한다.
5. RPC가 hash와 만료 시각을 검증하고 행을 `processing`으로 원자 전환한다.
6. claim 성공 시 token hash를 즉시 제거해 재사용을 차단한다.

Edge Function은 `verify_jwt = false`로 배포하지만, 유효한 일회용 token 없이는 payload와 수신자를 얻을 수 없다.

## 10. 전달과 재시도

scanner는 다음 대상을 최대 20건씩 dispatch한다.

- `pending`
- `retry_wait`이며 `next_attempt_at <= now()`
- `dispatched` 상태가 15분 넘게 완료되지 않은 요청

최대 5회 시도하며 5분, 15분, 30분, 60분 간격으로 재시도한다. 공급자 호출에는 delivery ID 기반 idempotency key를 사용한다.

Edge Function이 이메일 발송에 성공하면 `delivered`, 실패하면 `retry_wait` 또는 최종 `failed`로 완료 RPC를 호출한다. 오류 메시지는 1,000자로 제한하고 사용자 콘텐츠를 포함하지 않는다.

## 11. 이메일 수신자와 공급자

수신자는 현재 `super_admin` 역할을 가진 사용자 중 확인 가능한 이메일 주소다. Edge Function claim RPC가 service-role에만 이메일 배열을 반환한다.

필수 Edge Function secret:

- `RESEND_API_KEY`
- `OPERATIONS_ALERT_FROM`

secret이 없거나 수신자가 없으면 전달은 실패 원장에 기록되며 감시와 사건 생성은 계속 동작한다. Hosted 검증은 `hosted_validation` mode로 외부 이메일을 보내지 않고 claim·complete 전체 경로를 검증한다.

## 12. scanner 실행 구조

`private.scan_operations_health(trigger_source)`는 다음 순서로 실행한다.

1. 전역 advisory try-lock 획득
2. 정책별 현재 상태 계산
3. 신규 사건 생성 또는 열린 사건 갱신
4. 연속 정상 사건 해결
5. 발생·복구 delivery 생성
6. 재시도 가능 delivery에 token 발급
7. `net.http_post`로 Edge Function 호출 예약
8. scanner 실행 원장 기록

Cron Job `ranking-ops-health-scan`이 5분마다 scanner를 호출한다. scanner 오류는 유지보수 실행 원장과 분리된 `operations_monitor_runs`에 기록한다.

## 13. 관리자 화면

`/admin/operations`는 `audit_view` capability가 있는 관리자만 접근한다.

표시 항목:

- 전체 상태: 정상, 주의, 장애
- 열린 장애 수와 critical 수
- 열린 사건 목록과 근거
- 작업별 마지막 성공·마지막 실행·연속 실패
- 최근 해결 사건
- 최근 이메일 전달 상태와 오류
- scanner와 이메일 channel 구성 상태

화면은 조회 전용이다.

## 14. 권한

- scanner와 dispatch helper: `PUBLIC`, `anon`, `authenticated` EXECUTE 회수
- claim·complete RPC: `service_role` 전용
- 운영 상태 조회 RPC: `authenticated` EXECUTE, 내부에서 `audit_view` 검증
- 사건·전달·scanner 원장 직접 접근: 브라우저 역할 차단
- Edge Function은 service-role key를 서버 환경에서만 사용
- 이메일 주소는 관리자 화면과 일반 감사 RPC에 노출하지 않음

## 15. 통합 감사

`list_admin_audit_events`에 다음을 추가한다.

- `operations_incident_opened`
- `operations_incident_resolved`

세부 정보는 job key, incident type, severity, occurrence count만 포함한다. 이메일 주소와 공급자 원문 응답은 통합 감사에 포함하지 않는다.

## 16. 검증 계획

- 감시 정책 6개와 scanner Cron 등록 확인
- Cron 누락 fixture로 사건 발생 확인
- 2회 정상 scan 후 자동 해결 확인
- 연속 실패·포화·lock contention 판정 확인
- 동일 열린 사건 중복 생성 방지 확인
- 발생·복구 delivery 중복 방지 확인
- token 재사용 거부 확인
- 만료 token 거부 확인
- hosted-validation Edge Function claim·complete 성공 확인
- email secret 부재 시 retry_wait 기록 확인
- anon/authenticated 권한 차단 확인
- 관리자 상태 RPC와 통합 감사 확인
- lint와 production build 확인
