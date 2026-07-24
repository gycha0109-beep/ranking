# P1-2.9 Hosted 검증

## 적용 마이그레이션

- `p1_2_9_maintenance_core`
- `p1_2_9_maintenance_runner_and_schedule`
- `p1_2_9_maintenance_runner_reconciliation`

모든 마이그레이션은 Hosted Supabase 프로젝트에 적용됐다.

## Cron 등록

`pg_cron`을 설치하고 다음 6개 고정 이름 작업이 활성 상태로 등록된 것을 확인했다.

| Job | Schedule UTC | Active |
|---|---|---:|
| `ranking-maint-expire-user-sanctions` | `*/15 * * * *` | true |
| `ranking-maint-prune-notifications` | `10 3 * * *` | true |
| `ranking-maint-purge-daily-views` | `20 3 * * *` | true |
| `ranking-maint-redact-blocked-comments` | `30 3 * * *` | true |
| `ranking-maint-redact-resolved-report-details` | `40 3 * * *` | true |
| `ranking-maint-prune-cron-history` | `50 3 * * *` | true |

관리자 권한 컨텍스트에서 상태 RPC를 실행했을 때 작업 6개와 활성 Cron 6개가 모두 반환됐다.

## 기본 실행 Smoke

6개 작업을 `hosted_validation` source로 실행했다. 현재 처리 대상이 없는 상태에서 모두 `no_work`를 기록했다.

초기 실행 리뷰에서 no-work의 batch count가 0으로 기록되는 문제를 확인했다. reconciliation 적용 후 `prune_notifications`를 다시 실행해 다음을 확인했다.

- status: `no_work`
- batch_count: `1`
- affected_rows: `0`
- error_code: `null`

## 삭제 Fixture 검증

단일 transaction 안에서 다음 fixture를 생성했다.

- 200일 된 읽은 알림
- 14개월 된 일별 고유 조회 식별자

각 작업 runner를 실행한 결과 두 fixture 모두 삭제됐다. 검증 transaction은 마지막에 rollback하여 fixture와 검증 실행 원장이 Hosted 데이터에 남지 않게 했다.

## 권한 행렬

| 항목 | 결과 |
|---|---:|
| anon private runner EXECUTE | false |
| authenticated private runner EXECUTE | false |
| anon public runner EXECUTE | false |
| authenticated public runner EXECUTE | false |
| service_role public runner EXECUTE | true |
| authenticated 상태 조회 RPC EXECUTE | true |
| anon 상태 조회 RPC EXECUTE | false |
| authenticated 정의 테이블 직접 SELECT | false |
| authenticated 실행 원장 직접 SELECT | false |
| authenticated 실행 원장 UPDATE | false |
| authenticated 실행 원장 DELETE | false |

상태 조회 RPC의 EXECUTE 권한은 authenticated에 부여하지만 내부 `audit_view` capability 검사가 실제 접근을 제한한다.

## Append-only 및 입력 검증

transaction 기반 검증에서 다음 결과를 확인했다.

- 실행 원장 UPDATE: SQLSTATE `42501`로 거부
- 실행 원장 DELETE: SQLSTATE `42501`로 거부
- 등록되지 않은 job key: SQLSTATE `P0002`로 거부

## 데이터 보존 검토

- 기존 제재·알림·조회·댓글 정리 RPC signature와 반환 타입 유지
- 신고 행과 신고 결정 원장은 삭제하지 않음
- 해결된 신고의 자유서술 `details`만 180일 후 비식별화
- 애플리케이션 유지보수 실행 원장은 삭제하지 않음
- `cron.job_run_details`만 30일 후 bounded batch 정리

## 검증 제한

독립 데이터베이스 연결 두 개를 동시에 유지할 수 없는 현재 도구 환경에서는 advisory lock 경합을 실시간으로 재현하지 못했다. `pg_try_advisory_xact_lock` 실패 시 `skipped_locked`를 기록하는 코드 경로와 고정 lock key 계약을 구현 리뷰에서 검증했다.

## 결론

Cron 등록, no-work 실행, 실제 bounded 삭제, 관리자 상태 조회, 서비스 역할 경계, 직접 테이블 접근 차단, Append-only 원장 및 잘못된 job key 거부까지 Hosted에서 확인했다. 검증 fixture는 모두 rollback되어 잔존하지 않는다.
