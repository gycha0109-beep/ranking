# P1-2.10 운영 감사 상관관계·근거 탐색 설계 리뷰

## 리뷰 결론

기존 append-only 원장을 authoritative source로 유지하고 조회 시점에 정규화하는 방향은 타당하다. 다만 최초 설계에는 사건 연결, 대량 조회 성능, 민감 정보 분리, cursor 검증에 보완이 필요하다.

## 발견 사항과 보완

### 1. 사건 correlation 단절

제재를 항상 `sanction:<id>`로 묶으면 댓글 Moderation·신고 결정과 제재·이의제기가 분리된다.

- 제재가 댓글, 댓글 신고 결정, 댓글 Moderation review에서 시작됐으면 root `correlation_id`는 `comment:<comment_id>`를 사용한다.
- 비댓글 Moderation 근거면 `moderation:<entity_type>:<entity_id>`를 사용한다.
- 독립 수동 제재만 `sanction:<sanction_id>`를 사용한다.
- 별도 `group_id`에는 항상 `sanction:<sanction_id>`를 반환한다.
- 이의제기 결정은 연결된 sanction의 root correlation과 group ID를 상속한다.

### 2. 전체 UNION 후 필터링 위험

parameter 없는 stream을 만든 뒤 외부에서 필터링하면 원장 증가 시 전체 결합·정렬 비용이 커질 수 있다.

- private stream이 event kind, actor, subject, correlation, 기간, cursor를 인자로 받는다.
- 각 UNION branch에서 가능한 조건을 직접 적용한다.
- Hosted `EXPLAIN`으로 실제 plan을 확인한다.

### 3. 표시 이름의 변동성

profile 표시 이름은 변경될 수 있다.

- actor UUID와 subject UUID를 authoritative 식별자로 사용한다.
- label은 현재 표시값이라는 의미로만 제공한다.
- 화면에 ID를 함께 표시한다.
- 과거 label snapshot backfill은 이번 범위에서 제외한다.

### 4. 민감 상세 권한

`audit_sensitive_view`를 최고 관리자 전용 capability로 추가한다.

- `private.has_admin_capability()`에 추가한다.
- `public.get_my_admin_access()` 반환 목록에 추가한다.
- 상세 RPC가 DB에서 직접 재검사한다.
- 일반 `audit_view`는 목록과 비민감 상세만 조회한다.

### 5. 기존 v1의 raw note 노출

신규 UI만 v2를 사용해도 기존 함수가 자유서술 note를 반환하면 목록 노출이 계속된다.

- 기존 `list_admin_audit_events(integer, integer)` signature는 유지한다.
- 기존 함수의 `details`에서 review note, sanction note, appeal review note를 제거한다.
- 신규 애플리케이션 호출은 v2로 전환한다.

### 6. 이벤트 ID 형식

UUID와 BIGINT가 혼재한다.

- event kind별 형식을 먼저 검증한 뒤 cast한다.
- 잘못된 형식은 `22023`, 존재하지 않는 행은 `P0002`로 통일한다.
- BIGINT 문자열 길이를 제한한다.

### 7. related events 최소화

- related events는 목록과 동일한 최소 summary만 반환한다.
- 민감 근거는 요청한 단일 이벤트의 `sensitive_evidence`에만 반환한다.
- 관련 이벤트는 최대 50개로 제한한다.

### 8. correlation 검색 계약

- exact match만 허용한다.
- 허용 문자는 소문자 영숫자, `_`, `:`, `-`로 제한한다.
- 길이는 1~200자다.

### 9. 기간과 cursor 경계

- 기간은 `[from, to)` 반개구간이다.
- `from >= to`는 거부한다.
- cursor 시각과 sort key는 둘 다 있거나 둘 다 없어야 한다.
- 정렬은 `created_at DESC, sort_key DESC`로 고정한다.

### 10. source href

- event kind별 고정 내부 경로만 반환한다.
- 원장 텍스트로 URL을 조합하지 않는다.
- 상세 route segment는 애플리케이션에서 안전하게 인코딩한다.

### 11. 유지보수 오류 상세

- 목록에는 error code만 반환한다.
- 일반 상세에는 status, batch count, affected rows, trigger source만 반환한다.
- error message는 `audit_sensitive_view`에서만 반환한다.

### 12. 실패한 운영 요청

현재 원장은 성공한 결정과 실행 결과를 보존한다. 권한 거부나 validation 실패 기록은 별도 실패 감사 체계가 필요하므로 이번 범위에서 제외한다.

### 13. 인덱스

- Hosted row count, 기존 index, query plan을 먼저 확인한다.
- 시간 keyset 인덱스가 없는 원장에만 우선 추가한다.
- actor·subject 인덱스는 plan에서 필요성이 확인될 때만 추가한다.

## 최종 구현 조건

1. root correlation과 sanction group ID 분리
2. filter-aware private stream
3. UUID authoritative 식별
4. `audit_sensitive_view` capability
5. v1 raw note 제거
6. event kind별 ID 검증
7. related events 최소 summary
8. correlation exact match
9. 반개구간 기간과 완전한 cursor
10. 고정 내부 source href
11. maintenance error message 권한 분리
12. 실패 요청 감사 비범위 유지
13. 실제 plan 기반 최소 인덱스
