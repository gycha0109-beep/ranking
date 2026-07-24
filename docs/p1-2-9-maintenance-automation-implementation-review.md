# P1-2.9 구현 리뷰

## 결론

기존 service-role 정리 RPC 계약을 유지하면서 실제 데이터 변경을 bounded private helper로 분리하고, `pg_cron`과 운영 도구가 동일 구현을 재사용하도록 구성했다. 작업 정의, 실행 원장, 중앙 runner, Cron 등록, 관리자 조회 화면까지 하나의 운영 계약으로 연결했다.

## 구현 리뷰에서 확인한 사항

### 1. Cron 호출과 API 호출 경계

Cron 세션은 JWT service role이 아니므로 기존 public RPC를 직접 호출하지 않는다. private runner는 `session_user = 'postgres'` 또는 `auth.role() = 'service_role'`만 허용하며, API 역할의 EXECUTE 권한은 회수했다. public 수동 실행 wrapper는 service role에만 부여했다.

### 2. 기존 RPC 호환성

다음 함수의 이름, 인자, 반환 타입을 유지했다.

- `expire_due_user_sanctions(integer) → bigint`
- `prune_expired_notifications(timestamptz) → bigint`
- `purge_expired_content_daily_views(integer) → integer`
- `redact_expired_blocked_comment_bodies(integer) → integer`

기존 호출자는 변경 없이 service-role 계약을 사용할 수 있다.

### 3. 실패 원장 보존

runner의 데이터 변경 loop를 nested exception block으로 감쌌다. 작업 중 오류가 발생하면 해당 block의 변경은 rollback되고 outer block이 `failed` 실행 행을 기록한다. 오류는 SQLSTATE와 최대 1,000자의 메시지만 보존하며 입력 데이터 원문은 기록하지 않는다.

### 4. Batch 처리와 중복 실행

각 작업은 migration에 등록된 batch 크기와 최대 반복 횟수만 처리한다. 같은 job key는 `pg_try_advisory_xact_lock`으로 중복 실행을 차단하고, 잠금 실패 자체도 `skipped_locked`로 관측 가능하게 기록한다.

### 5. 신고 원장 보존

신고·신고 결정 행은 삭제하지 않는다. 해결 또는 기각 후 180일이 지난 `comment_reports.details`만 `NULL`로 비식별화하고 `details_redacted_at`을 남긴다. reason, 상태, 결정 연결, 시각은 보존된다.

### 6. Cron 자체 이력 보존

애플리케이션 실행 원장은 삭제하지 않는다. 별도로 `cron.job_run_details` 중 30일이 지난 행만 bounded batch로 정리하는 작업을 등록했다.

### 7. 화면과 권한

`/admin/maintenance`는 `audit_view` capability로 보호된다. 화면은 작업 정의, Cron 등록 상태, 최근 결과와 오류를 조회만 하며 브라우저에서 실행·설정 변경 기능을 제공하지 않는다. DB RPC도 동일 capability를 다시 검사한다.

## 구현 중 발견 및 보완

### 1. Cron schedule SQL quoting

초기 migration 초안의 DO block 안에서 동일한 `$$` delimiter를 중첩해 SQL parser 충돌 가능성이 있었다. Hosted 적용 전에 outer block을 `$do$`, command 문자열을 `$cmd$`로 분리해 저장소 migration과 실제 적용 SQL을 일치시켰다.

### 2. no-work batch count 누락

초기 runner는 PL/pgSQL `FOR` loop 변수를 결과 변수로 직접 사용해 no-work 실행의 `batch_count`가 0으로 남았다. 별도 `v_iteration` 변수를 도입하고 helper 호출 직후 `v_batch_count`를 증가시키는 reconciliation migration을 추가했다. 이후 no-work 실행에서 `batch_count = 1`을 확인했다.

## 잔여 리스크

- `pg_cron` 자체 장애는 애플리케이션 실행 원장에 도달하지 않을 수 있으므로 `cron.job_run_details`도 함께 확인해야 한다.
- 외부 장애 알림은 아직 없으며 관리자가 상태 화면을 조회해야 한다.
- 실제 대량 데이터에서 batch·timeout 값은 운영 지표를 바탕으로 조정할 수 있다.
- 동시 lock skip은 함수 계약과 advisory lock 구현을 검토했으나 독립 연결 두 개를 이용한 실시간 경합 시험은 이번 도구 환경에서 수행하지 못했다.
