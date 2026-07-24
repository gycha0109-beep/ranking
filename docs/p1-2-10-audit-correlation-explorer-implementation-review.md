# P1-2.10 운영 감사 상관관계·근거 탐색 구현 리뷰

## 리뷰 결론

기존 append-only 원장을 복제하지 않고 private read stream과 public RPC를 추가한 구조는 설계에 부합한다. 목록의 자유서술 note 제거, root correlation, group ID, keyset cursor, 상세 capability 분리도 구현됐다. Hosted 적용 전에 다음 보완이 필요하다.

## 확인된 구현 적합성

- 역할·Moderation·신고·제재·이의제기·유지보수의 6개 원장을 정규화한다.
- 댓글 근거 제재와 이의제기가 댓글 root correlation을 상속한다.
- 제재 group ID는 sanction ID로 별도 유지한다.
- 목록 RPC는 event kind, actor, subject, correlation, 기간, cursor를 검증한다.
- 기존 v1 함수 signature를 유지하면서 자유서술 note를 제거했다.
- private stream execute 권한을 브라우저 역할에서 회수했다.
- `audit_sensitive_view`는 최고 관리자 전용으로 분리했다.
- 상세 RPC는 event kind별 ID 형식을 검증한다.
- 관련 이벤트는 동일 correlation의 최소 목록 schema만 사용한다.
- UI에서 raw JSON 목록을 제거하고 필터·cursor·상세 화면을 제공한다.

## 발견 사항과 보완

### 1. 비민감 evidence의 확장 JSON

**문제**

Moderation `metadata`와 maintenance `details`는 현재 안전한 값을 기록하지만 JSON 계약이 향후 확장될 수 있다. 일반 admin 상세에 객체 전체를 그대로 반환하면 후속 필드가 의도치 않게 노출될 수 있다.

**보완**

- 일반 evidence에서 Moderation `metadata`를 제거한다.
- 일반 evidence에서 maintenance `details`를 제거한다.
- 두 필드는 `audit_sensitive_view`가 있는 상세의 sensitive evidence로 이동한다.
- 목록과 related events에는 계속 포함하지 않는다.

### 2. event kind 배열 상한

**문제**

허용 값 검증은 있지만 direct RPC caller가 매우 큰 중복 배열을 전달할 수 있다. 결과에는 영향이 없어도 validation과 planner 입력을 불필요하게 키울 수 있다.

**보완**

- `cardinality(p_event_kinds) <= 6`을 강제한다.
- 허용 종류 검증은 유지한다.
- 애플리케이션은 이미 중복을 제거한다.

### 3. Moderation source workspace 정밀도

**검토 결과**

댓글은 `/admin/comments`, 그 외 Moderation은 현재 중앙 콘텐츠 관리 흐름으로 연결된다. 개별 item/ranking 상세 deep link 계약이 아직 없으므로 고정 내부 workspace 링크를 유지한다. 존재하지 않는 상세 URL을 조합하지 않는다.

### 4. label snapshot 부재

**검토 결과**

actor와 subject UUID가 authoritative하고 화면에 함께 표시된다. 현재 profile label은 편의값이므로 이번 단계에서는 원장 schema 변경이나 backfill을 하지 않는다.

### 5. keyset 안정성

**검토 결과**

`created_at DESC, sort_key DESC`와 `(created_at, sort_key) < cursor`가 일치한다. sort key는 event kind와 PK를 포함해 원장 전체에서 유일하다. 동일 timestamp에서도 중복·누락 없는 다음 페이지가 가능하다.

### 6. 애플리케이션 입력 경계

**검토 결과**

서버 액션은 UUID, timestamp, correlation, event ID를 재검증하며 DB가 동일 검증을 최종 수행한다. `sourceHref`도 `/admin/` prefix만 수락한다. middleware의 `/admin/audit` prefix 보호가 상세 하위 경로까지 적용된다.

## Hosted 적용 전 보완 항목

1. event kind 배열 cardinality 상한 추가
2. Moderation metadata를 민감 evidence로 이동
3. maintenance details를 민감 evidence로 이동
4. 보완 후 두 migration을 Hosted에 순서대로 적용
5. permission matrix와 실제 event linkage 검증
