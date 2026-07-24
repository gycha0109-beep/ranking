# P1-2.9 운영 유지보수 잡·보존정책 자동화 설계

## 1. 목적

현재 기간제 제재 만료, 알림 보존기간 정리, 일별 조회 식별자 삭제, 차단 댓글 본문 비식별화 RPC는 존재하지만 운영자가 직접 호출해야 한다. 이번 단계에서는 Supabase Cron을 이용해 이 작업을 자동 실행하고, 각 실행 결과를 별도 감사 원장과 관리자 화면에서 추적한다.

핵심 목표는 다음과 같다.

- 운영 유지보수 작업을 정해진 주기로 자동 실행한다.
- 한 번의 실행이 장시간 잠금이나 대량 삭제로 이어지지 않도록 batch를 제한한다.
- 같은 작업의 중복 실행을 advisory lock으로 차단한다.
- 성공, 무처리, 실패, lock skip 결과와 처리 건수를 보존한다.
- 실패는 다음 주기에서 자연스럽게 재시도한다.
- 브라우저 역할은 유지보수 실행 RPC와 원장 테이블에 직접 접근할 수 없다.
- 기존 service-role RPC 계약은 유지한다.

## 2. 범위

- `pg_cron` 확장 설치 및 이름이 고정된 Cron Job 등록
- 유지보수 작업 정의 테이블
- 유지보수 실행 결과 Append-only 원장
- 중앙 유지보수 runner
- 작업별 bounded batch helper
- 기존 service-role 정리 RPC의 bounded helper 위임
- 관리자 유지보수 상태 화면
- 기존 통합 운영 감사에 유지보수 실행 요약 추가
- Hosted에서 수동 실행, 중복 lock, 실패 기록, schedule 상태 검증

## 3. 비범위

- 이메일, Slack, SMS 장애 알림
- 외부 모니터링 또는 SIEM 전송
- 운영자가 브라우저에서 임의 SQL이나 유지보수 작업을 실행하는 기능
- 감사 원장 또는 신고 결정 원본 삭제
- VACUUM, REINDEX 등 데이터베이스 엔진 정비
- Storage 객체 정리
- 두 단계 승인 또는 별도 작업 큐

## 4. 기존 유지보수 계약

현재 Hosted DB에는 다음 service-role 전용 RPC가 존재한다.

| RPC | 목적 |
|---|---|
| `expire_due_user_sanctions(limit)` | 종료 시각이 지난 기간제 제재를 `expired` 이벤트로 전환 |
| `prune_expired_notifications(now)` | 읽은 알림 90일, 읽지 않은 알림 180일 이후 삭제 |
| `purge_expired_content_daily_views(batch)` | 13개월이 지난 일별 조회 식별자 삭제 |
| `redact_expired_blocked_comment_bodies(batch)` | 30일이 지난 차단 댓글 본문 비식별화 |

Cron 세션은 API의 `service_role` JWT가 아니므로 기존 RPC를 그대로 호출하면 `auth.role()` 검사에서 거부된다. 따라서 실제 데이터 변경 로직을 private batch helper로 이동하고, 기존 public RPC와 Cron runner가 같은 helper를 호출한다.

## 5. 자동화 작업

| job key | schedule UTC | batch | 최대 batch | 정책 |
|---|---|---:|---:|---|
| `expire_user_sanctions` | 매 15분 | 200 | 5 | 종료된 제재를 최대 1,000건 처리 |
| `prune_notifications` | 매일 03:10 | 5,000 | 10 | 읽음 90일, 미읽음 180일 |
| `purge_daily_views` | 매일 03:20 | 10,000 | 20 | 13개월 이전 식별자 삭제 |
| `redact_blocked_comments` | 매일 03:30 | 1,000 | 10 | 차단 후 30일 지난 본문 비식별화 |
| `redact_resolved_report_details` | 매일 03:40 | 1,000 | 10 | 해결 후 180일 지난 신고 자유서술 상세 비식별화 |

신고 원본 행과 신고 결정 원장은 보존한다. `comment_reports.details`만 `NULL`로 바꾸고 `details_redacted_at`을 기록한다.

## 6. 데이터 모델

### 6.1 `maintenance_job_definitions`

코드와 운영 화면이 공유하는 작업 등록부다.

- `job_key TEXT PRIMARY KEY`
- `description TEXT`
- `schedule TEXT`
- `batch_size INTEGER`
- `max_batches INTEGER`
- `timeout_ms INTEGER`
- `retention_policy TEXT`
- `enabled BOOLEAN`
- `created_at`, `updated_at`

이번 단계에서는 migration만 정의를 변경한다. 브라우저에서 수정하는 기능은 제공하지 않는다.

### 6.2 `maintenance_job_runs`

한 번의 실행 결과를 저장하는 Append-only 원장이다.

- `id BIGINT IDENTITY`
- `job_key TEXT`
- `trigger_source TEXT`: `cron`, `service_role`, `hosted_validation`
- `status TEXT`: `succeeded`, `no_work`, `failed`, `skipped_locked`, `disabled`
- `started_at`, `finished_at`
- `batch_count INTEGER`
- `affected_rows BIGINT`
- `error_code TEXT`
- `error_message TEXT`
- `details JSONB`

실행 중 행을 UPDATE하지 않는다. runner가 예외를 내부에서 포착한 후 최종 결과 한 행만 INSERT한다. UPDATE와 DELETE는 trigger로 차단한다.

## 7. 실행 구조

### 7.1 중앙 runner

`private.run_maintenance_job(job_key, trigger_source)`가 다음 순서를 수행한다.

1. 호출자가 `postgres` Cron 세션 또는 `service_role`인지 확인
2. 작업 정의 조회
3. 작업별 transaction advisory lock을 `try` 방식으로 획득
4. `statement_timeout` 설정
5. batch helper를 최대 `max_batches`만큼 반복
6. batch 결과가 batch 크기보다 작거나 0이면 종료
7. 최종 실행 결과를 원장에 INSERT
8. 예외 발생 시 오류 코드와 제한된 오류 메시지를 실패 원장에 INSERT하고 정상 반환

동일 작업이 이미 실행 중이면 데이터를 건드리지 않고 `skipped_locked`를 기록한다. 서로 다른 작업은 병렬 실행 가능하지만 Cron schedule을 10분 간격으로 분산한다.

### 7.2 권한

- private helper와 runner: `PUBLIC`, `anon`, `authenticated` 실행 권한 회수
- `public.run_maintenance_job(job_key)`: `service_role` 전용
- 상태 조회 RPC: `audit_view` capability가 있는 관리자 전용
- 원장 및 정의 테이블 직접 접근: 브라우저 역할 전부 차단
- Cron command는 private runner를 직접 호출

## 8. 실패 및 재시도

실패 시 runner는 해당 실행을 `failed`로 기록하고 예외를 외부로 재전파하지 않는다. 다음 schedule이 같은 작업을 다시 실행하므로 bounded retry가 된다. 데이터 변경은 batch helper 단위의 동일 transaction에서 수행되며 runner 전체가 한 transaction이므로 실패한 실행의 변경은 rollback되고 실패 원장만 기록할 수 있도록 예외를 내부 block에서 포착한다.

오류 메시지는 1,000자로 제한하며 데이터 원문을 포함하지 않는다.

## 9. Cron 등록

migration은 `pg_cron`을 설치하고 기존 동일 이름 Job을 먼저 unschedule한 뒤 고정 이름으로 재등록한다.

- `ranking-maint-expire-user-sanctions`
- `ranking-maint-prune-notifications`
- `ranking-maint-purge-daily-views`
- `ranking-maint-redact-blocked-comments`
- `ranking-maint-redact-resolved-report-details`

동일 migration을 재적용하거나 schedule을 변경해도 중복 Job이 남지 않아야 한다.

## 10. 관리자 화면

`/admin/maintenance`는 `audit_view` capability가 있는 관리자만 접근한다.

표시 항목:

- 등록 작업과 schedule
- enabled 상태
- 최근 실행 상태, 처리 건수, 시작·종료 시각
- 최근 실패 메시지
- Cron Job 활성 여부
- 최근 실행 목록

화면은 조회 전용이다. 수동 실행은 service-role 운영 도구에서만 수행한다.

## 11. 통합 감사

기존 `list_admin_audit_events`에 유지보수 실행을 추가한다.

- event kind: `maintenance_job`
- target: job key
- action: 실행 status
- details: trigger source, batch count, affected rows, 오류 코드

오류 원문 전체는 전용 유지보수 화면에서만 제한적으로 표시한다.

## 12. 검증 계획

- `pg_cron` 설치와 5개 Job 등록 확인
- public service-role RPC 권한 행렬 확인
- private helper의 API 역할 실행 차단 확인
- Hosted validation source로 각 작업 no-work 실행 확인
- 임시 오래된 notification과 daily view fixture 처리 확인
- 임시 해결 신고 detail 비식별화 확인
- 임시 종료 제재 fixture의 `expired` 전환 확인
- 동일 advisory lock을 선점한 상태에서 `skipped_locked` 확인
- 잘못된 job key의 실패 또는 거부 계약 확인
- 원장 UPDATE/DELETE 차단 확인
- 관리자 상태 RPC 결과 확인
- lint 및 production build 확인
