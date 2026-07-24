# P1-2.10 운영 상태 감시·장애 알림 설계

## 1. 목적

P1-2.9에서 유지보수 작업의 자동 실행, bounded batch, 실행 원장, 관리자 조회 화면을 구축했다. 이번 단계에서는 작업 실패와 지연을 자동 판정하고 사건을 열고 닫으며 운영자가 별도 SQL 확인 없이 현재 장애 상태를 확인할 수 있도록 한다.

핵심 목표는 다음과 같다.

- 유지보수 작업의 실패, 지연, 반복 잠금, 지속 backlog를 자동 감지한다.
- 동일 원인의 반복 감지를 하나의 사건으로 집계한다.
- 정상화 시 사건을 자동 해결한다.
- 신규 장애와 복구 이벤트를 알림 outbox에 기록한다.
- 관리자 화면에서 현재 상태, 열린 사건, 최근 해결 사건을 조회한다.
- 브라우저 역할은 감시 실행, 사건 변경, 알림 발송 상태 변경을 수행할 수 없다.

## 2. 범위

- 운영 감시 정책 테이블
- 운영 사건 현재 상태와 Append-only 사건 이벤트 원장
- 알림 outbox
- 유지보수 작업 상태 평가 함수
- 10분 주기의 Cron 감시 작업
- 상태 조회 RPC와 `/admin/operations` 읽기 전용 화면
- 기존 통합 운영 감사에 사건 이벤트 추가
- Edge Function용 이메일 dispatch 계약과 저장소 구현
- Hosted 감지·복구·중복 억제·권한 검증

## 3. 비범위

- SMS, Slack, PagerDuty
- 브라우저에서 incident 수동 종료 또는 무시
- 사용자 데이터 원문을 포함한 알림
- 외부 모니터링 플랫폼 연동
- 자동 재실행 또는 DB 설정 변경
- 알림 수신자 UI 편집

## 4. 장애 판정 규칙

### 4.1 Cron registration

- 작업 정의가 enabled인데 대응하는 `cron.job`이 없거나 inactive면 `cron_unavailable` 사건을 연다.

### 4.2 Missing execution

- 마지막 실행이 없거나 최근 실행 시각이 작업별 허용 지연을 넘으면 `execution_stale` 사건을 연다.
- 15분 작업은 45분, 일별 작업은 30시간을 기본 허용 지연으로 둔다.

### 4.3 Consecutive failure

- 최근 실행이 연속 2회 이상 `failed`면 `consecutive_failure` 사건을 연다.
- 성공, no_work, disabled가 나오면 연속 실패 카운트가 끊긴다.

### 4.4 Repeated lock skip

- 최근 60분 동안 `skipped_locked`가 3회 이상이면 `repeated_lock_skip` 사건을 연다.

### 4.5 Persistent backlog

- 최근 3회 실행이 모두 `succeeded`이고 각 실행의 `batch_count = max_batches`이며 `affected_rows >= batch_size * max_batches`면 `persistent_backlog` 사건을 연다.
- 단일 대량 처리 성공은 장애로 보지 않는다.

## 5. 데이터 모델

### 5.1 `operation_monitor_policies`

작업별 감시 기준이다.

- `job_key` PK/FK
- `stale_after_minutes`
- `failure_threshold`
- `lock_skip_window_minutes`
- `lock_skip_threshold`
- `backlog_run_threshold`
- `enabled`
- timestamps

정책 변경은 migration으로만 수행한다.

### 5.2 `operation_incidents`

현재 사건 projection이다.

- `id UUID`
- `incident_key TEXT UNIQUE`: `job_key:incident_type`
- `job_key`
- `incident_type`
- `status`: `open | resolved`
- `severity`: `warning | critical`
- `title`
- `summary`
- `first_detected_at`
- `last_detected_at`
- `resolved_at`
- `occurrence_count`
- `latest_run_id`
- `fingerprint`
- timestamps

동일 incident key는 한 행만 유지한다. 재감지 시 occurrence와 last detected를 갱신한다.

### 5.3 `operation_incident_events`

사건의 Append-only 이력이다.

- `id BIGINT IDENTITY`
- `incident_id`
- `event_type`: `opened | observed | resolved`
- `detected_at`
- `severity`
- `summary`
- `related_run_id`
- `details JSONB`

UPDATE와 DELETE는 trigger로 차단한다.

### 5.4 `operation_alert_outbox`

외부 알림 전달 계약이다.

- `id BIGINT IDENTITY`
- `incident_event_id UNIQUE`
- `channel`: `email`
- `status`: `pending | delivered | failed`
- `recipient_key`
- `subject`
- `payload JSONB`
- `attempt_count`
- `available_at`
- `claimed_at`
- `delivered_at`
- `last_error_code`
- `last_error_message`
- timestamps

DB 감시 함수는 outbox를 INSERT만 한다. 실제 네트워크 발송은 Edge Function이 service-role RPC를 통해 claim·complete 한다.

## 6. 감시 실행 구조

`private.evaluate_operation_health(trigger_source)`는 다음 순서로 동작한다.

1. 호출자가 postgres Cron 세션 또는 service-role인지 확인
2. 전역 advisory transaction lock 획득 시도
3. enabled 정책과 maintenance job 정의를 순회
4. 각 장애 규칙의 현재 truth value 계산
5. true 규칙은 사건 open 또는 observed 처리
6. false 규칙의 기존 open 사건은 resolved 처리
7. opened/resolved 이벤트에 대해서만 이메일 outbox 생성
8. 실행 요약 JSON 반환

동일 상태의 반복 관측은 사건 event에는 `observed`를 남기되 알림 outbox는 생성하지 않는다. 이로써 알림 폭주를 차단한다.

## 7. 알림 dispatch

Edge Function `dispatch-operation-alerts`는 다음 계약을 따른다.

- service-role key는 Supabase secret로만 주입
- 이메일 provider key와 수신 주소는 환경 secret로 주입
- pending outbox를 RPC로 최대 20건 claim
- payload에는 job key, incident type, severity, summary, detected time, 관리자 경로만 포함
- 댓글, 신고 상세, 사용자 ID, notification value는 포함하지 않음
- 성공 시 delivered, 실패 시 failed와 제한된 오류 코드·메시지 기록
- failed 항목은 지수 backoff 대신 최대 5회 bounded retry

실제 외부 provider secret이 없는 환경에서는 dispatch를 배포하지 않고 DB outbox 계약까지만 Hosted 검증한다.

## 8. 권한

- private evaluator와 incident writer: API 브라우저 역할 실행 불가
- public manual evaluator: service-role 전용
- incident/outbox table 직접 접근: anon/authenticated 차단
- 관리자 상태 RPC: `audit_view` capability 필요
- outbox claim/complete RPC: service-role 전용
- 관리자 화면은 조회 전용

## 9. 관리자 화면

`/admin/operations`는 `audit_view` capability가 있는 관리자만 접근한다.

표시 항목:

- 전체 상태: 정상 / 주의 / 장애
- 열린 critical 및 warning 사건 수
- 열린 사건 목록
- 작업별 Cron 상태와 마지막 실행·성공 시각
- 최근 해결 사건
- 최근 alert outbox delivery 상태

## 10. 감사 연동

`list_admin_audit_events`에 incident event를 추가한다.

- event kind: `operation_incident`
- target: job key
- action: opened / observed / resolved
- details: incident type, severity, related run id

## 11. 검증 계획

- 정책과 감시 Cron 등록 확인
- no-incident 정상 평가 확인
- Cron inactive fixture로 open 사건과 단일 outbox 생성 확인
- 동일 장애 재평가 시 observed 증가와 outbox 중복 없음 확인
- Cron 복구 후 resolved 사건과 복구 outbox 생성 확인
- 연속 실패·stale·lock skip·backlog 판정 SQL 단위 검증
- incident event immutable 확인
- browser role의 evaluator, table, outbox RPC 차단 확인
- 관리자 status RPC 확인
- lint 및 production build 확인
