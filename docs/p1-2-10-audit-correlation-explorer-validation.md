# P1-2.10 Hosted 검증 기록

## 적용 migration

Hosted Supabase 프로젝트 `yjdubukqkcvkymabskzd`에 다음 migration을 순서대로 적용했다.

1. `p1_2_10_audit_stream`
2. `p1_2_10_audit_detail`
3. `p1_2_10_audit_query_hardening`
4. `p1_2_10_audit_detail_hardening`

네 migration 모두 성공했으며 `supabase_migrations.schema_migrations`에서 확인했다.

## 기존 데이터 기반 stream 검증

Hosted 원장 데이터에서 다음 event kind가 정규화됐다.

- `role_change`
- `moderation_review`
- `sanction_event`
- `appeal_decision`
- `maintenance_job`

현재 Hosted에는 `comment_report_decisions` 행이 없어 `comment_report_decision` 실데이터 결과는 없지만 branch와 함수 계약은 동일 UNION branch로 존재한다.

확인한 정규화 필드:

- event kind와 source event ID
- unique sort key
- root correlation ID
- group ID
- actor UUID와 current label
- subject UUID와 current label
- action과 reason code
- 고정 내부 source href
- created timestamp

## correlation 검증

기존 수동 제재와 이의제기 데이터에서 다음 결과를 확인했다.

- sanction imposed, appeal accepted, sanction overturned가 동일 root correlation을 사용한다.
- 세 이벤트의 group ID는 동일한 `sanction:<id>`다.
- 댓글 manual Moderation은 `comment:<comment_id>` correlation을 사용한다.
- 유지보수 실행은 `maintenance:<job_key>` correlation과 실행별 `maintenance-run:<id>` group을 사용한다.

## keyset pagination

- page size 3으로 첫 페이지와 다음 페이지를 조회했다.
- 첫 페이지 3건, 다음 페이지 3건.
- `(event_kind, event_id)` 중복 0건.
- 정렬과 cursor 모두 `created_at DESC, sort_key DESC` 계약을 사용했다.

## 입력 검증

다음 요청이 모두 SQLSTATE `22023`으로 거부됐다.

- 허용되지 않은 event kind
- 허용 문자 계약을 위반한 correlation ID
- timestamp만 존재하는 불완전 cursor
- 6개를 초과하는 event kind 배열

## 권한 검증

### Super admin

- `get_my_admin_access()`에 `audit_sensitive_view`가 포함됐다.
- 목록 v2 조회 성공.
- 상세 응답에서 `can_view_sensitive = true`.
- maintenance 상세의 비민감 evidence 8개 필드와 민감 evidence 2개 필드를 분리해 반환했다.
- 동일 maintenance correlation 관련 이벤트 29건을 최소 summary로 반환했다.

### Admin

트랜잭션 내부 임시 역할 fixture로 검증하고 rollback했다.

- `audit_view` 상세 조회 성공.
- `can_view_sensitive = false`.
- `sensitive_evidence = null`.

### Moderator

동일 fixture에서 admin 역할을 제거하고 검증했다.

- 목록 v2 호출이 SQLSTATE `42501`로 거부됐다.
- fixture 변경은 전체 rollback했다.

### 함수 권한

- anon → private stream execute: false
- authenticated → private stream execute: false
- authenticated → public list v2 execute: true
- authenticated → public detail execute: true
- public RPC 내부 capability 검사가 최종 접근을 차단한다.

## 기존 v1 호환·민감정보 검증

`list_admin_audit_events(INTEGER, INTEGER)` signature를 유지했다.

전체 기존 결과에서 다음 자유서술 key는 발견되지 않았다.

- `note`
- `review_note`
- `admin_note`
- `error_message`
- `appeal_statement`

상태, reason code, source ID와 수치만 남겼다.

## 인덱스

Hosted에서 다음 인덱스 존재를 확인했다.

- `idx_moderation_reviews_manual_reviewed`
- `idx_comment_report_decisions_created`
- `idx_user_sanction_events_created`
- `idx_user_sanction_appeal_decisions_created`
- `idx_maintenance_job_runs_finished`

기존 subject·actor 인덱스는 재사용하고, 현재 작은 원장 규모에서는 추가 조합 인덱스를 만들지 않았다.

## 데이터 정리

- 영구 smoke fixture를 생성하지 않았다.
- admin/moderator 권한 검증용 역할 변경은 단일 transaction에서 수행하고 rollback했다.
- 기존 append-only 원장 데이터는 변경하지 않았다.
