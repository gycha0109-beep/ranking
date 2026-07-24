# P1-2.10 설계 리뷰 반영·최종 계약

이 문서는 최초 설계와 설계 리뷰의 차이를 해소하는 구현 기준이다. 충돌 시 이 문서가 우선한다.

## 1. 최종 correlation 모델

감사 이벤트는 두 개의 식별자를 가진다.

- `correlation_id`: 원본 사건의 root correlation
- `group_id`: 해당 하위 결정 묶음의 식별자

### 역할 변경

- correlation: `user:<target_user_id>`
- group: 동일 값

### Moderation

- comment: `comment:<entity_id>`
- 그 외: `moderation:<entity_type>:<entity_id>`
- group: 동일 값

### 댓글 신고 결정

- correlation: `comment:<comment_id>`
- group: `report-decision:<decision_id>`

### 제재 이벤트

제재의 source를 다음 순서로 해석한다.

1. `source_comment_id`가 있으면 `comment:<id>`
2. `source_report_decision_id`가 있으면 해당 결정의 comment를 찾아 `comment:<id>`
3. `source_moderation_review_id`가 있고 entity가 comment면 `comment:<entity_id>`
4. 다른 Moderation entity면 `moderation:<entity_type>:<entity_id>`
5. source가 없으면 `sanction:<sanction_id>`

- group: 항상 `sanction:<sanction_id>`

### 이의제기 결정

- correlation: 연결된 sanction의 root correlation
- group: `sanction:<sanction_id>`

### 유지보수 실행

- correlation: `maintenance:<job_key>`
- group: `maintenance-run:<run_id>`

## 2. 최종 private stream

`private.list_admin_audit_event_stream(...)`은 다음 필터를 직접 받는다.

- event kinds
- actor UUID
- subject UUID
- exact correlation ID
- from/to timestamp
- cursor timestamp/sort key
- limit

각 UNION branch는 적용 가능한 조건을 branch 내부에서 처리한다. public RPC는 검증과 capability 확인만 담당한다.

반환 필드:

- `event_kind`
- `event_id`
- `sort_key`
- `correlation_id`
- `group_id`
- `actor_id`
- `actor_label`
- `subject_type`
- `subject_id`
- `subject_label`
- `action`
- `reason_code`
- `summary`
- `source_href`
- `created_at`

UUID가 authoritative 식별자이며 label은 현재 profile 값이다.

## 3. 권한 최종 계약

- `audit_view`: admin, super_admin
- `audit_sensitive_view`: super_admin only

다음을 함께 변경한다.

- `private.has_admin_capability`
- `public.get_my_admin_access`
- 상세 RPC 내부 capability 확인

목록과 관련 이벤트에는 자유서술 note를 포함하지 않는다.

## 4. 입력 계약

- event kind allowlist: `role_change`, `moderation_review`, `comment_report_decision`, `sanction_event`, `appeal_decision`, `maintenance_job`
- correlation: exact match, `[a-z0-9_:-]{1,200}`
- 기간: `[from, to)`
- cursor timestamp와 sort key는 동시 입력
- sort key 최대 300자
- limit 1~100
- event ID는 kind별 UUID 또는 BIGINT 형식을 먼저 검사한 뒤 cast

## 5. 기존 v1 호환성

`public.list_admin_audit_events(INTEGER, INTEGER)`는 유지한다. 다만 다음 자유서술 필드는 더 이상 반환하지 않는다.

- role change reason 원문
- Moderation review note
- report review note
- sanction event note
- appeal review note
- maintenance error message

v1 details에는 상태, reason code, 수치, source ID만 남긴다.

## 6. 상세 계약

`public.get_admin_audit_event_detail(TEXT, TEXT)`는 다음 JSON을 반환한다.

- `event`: 공통 정규화 이벤트
- `evidence`: 비민감 근거
- `sensitive_evidence`: super admin만 값, 그 외 null
- `related_events`: 동일 root correlation의 최소 summary 최대 50건
- `can_view_sensitive`

유지보수 error message와 모든 자유서술 운영 메모는 sensitive evidence에만 포함한다.

## 7. 애플리케이션 최종 계약

- `/admin/audit`: typed filters, correlation/group 표시, keyset 다음 페이지, raw JSON 제거
- `/admin/audit/[eventKind]/[eventId]`: 비민감 근거, 권한별 민감 근거, related events, source workspace 링크
- 서버 액션은 query param과 RPC 결과를 typed parser로 검증한다.
- 내부 링크만 사용한다.

## 8. 성능 보완 기준

구현 전에 Hosted에서 row count와 기존 index를 조사한다. 다음 원칙을 적용한다.

- 시간 keyset index가 없는 원장에만 추가
- manual Moderation은 partial index 우선
- actor·subject index는 query plan에서 필요성이 확인된 경우만 추가
- 조회 limit과 related event limit은 DB에서 강제

## 9. 비범위 확정

- 실패한 권한 요청과 validation 실패의 별도 감사 저장
- 과거 표시 이름 snapshot backfill
- 범용 감사 write table
- 외부 로그 전송

위 항목은 별도 보안 관측 단계에서 설계한다.
