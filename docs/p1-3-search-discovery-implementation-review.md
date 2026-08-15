# P1-3 검색·탐색 품질 개선 구현 리뷰

## 리뷰 범위

설계 리뷰 및 최종 계약 이후 구현된 다음 영역을 검토했다.

- P1-3 migration
- public search/list SECURITY DEFINER RPC
- trigram/generated search columns와 index
- search query normalization
- relevance/latest/popular 정렬
- keyset cursor encode/decode
- `/search` UX
- 홈/Navbar 검색 진입
- category/subcategory bounded pagination
- related recommendation tie-break
- P1-3 static contract verifier 및 CI 연결

Hosted migration 적용 전 리뷰이며, DB parse/runtime 검증은 Hosted gate에서 별도로 수행한다.

## 발견 사항

### IR-1. fuzzy 보조치가 relevance tier를 역전할 수 있음

최초 구현은 일부 base tier 간격이 5,000인데 fuzzy bonus는 최대 9,999였다.

영향:

- 낮은 base tier 결과가 높은 base tier 결과보다 위로 올라갈 수 있음
- “상위 match tier를 fuzzy bonus가 뒤집지 않는다”는 최종 계약 위반

보완:

- 의미 tier 사이 base score 간격을 최소 10,000으로 재배치
- fuzzy bonus 상한 9,999는 유지
- exact title → title prefix → title substring → structured field → description/body → fuzzy 순서를 고정

상태: **보완 완료**

### IR-2. category/subcategory/facet trigram index 표현과 runtime 표현 일치가 불명확함

최초 구현은 name expression index에 built-in normalization expression을 사용하고, runtime query에는 private wrapper function을 사용했다.

영향:

- 두 식이 의미상 같아도 planner가 expression index를 동일 식으로 인식하는지에 불필요한 의존이 생김

보완:

- `categories.search_name`, `subcategories.search_name`, `facets.search_name` generated stored column 추가
- GIN trigram index와 runtime query 모두 동일 `search_name` column 사용

상태: **보완 완료**

### IR-3. malformed cursor scalar가 DB RPC까지 전달될 수 있음

최초 cursor decoder는 version/fingerprint 존재 여부를 확인했지만 timestamp/UUID 형식 자체는 검증하지 않았다.

영향:

- 사용자가 조작한 cursor가 fingerprint를 맞춘 경우 잘못된 timestamp/UUID가 PostgREST/RPC error로 이어질 수 있음
- “잘못된 cursor는 첫 페이지 fallback” 계약 미완전

보완:

- timestamp parse validation
- UUID format validation
- relevance/views/likes non-negative safe integer validation
- invalid payload는 RPC 호출 전에 `null` cursor로 처리

상태: **보완 완료**

### IR-4. 선언되지 않은 `server-only` dependency 위험

cursor 경계를 명시하기 위해 `import 'server-only'`를 잠시 추가했으나 현재 lockfile에서 해당 package를 직접 확인할 수 없었다.

보완:

- 별도 dependency를 추가하지 않고 import 제거
- cursor module은 `node:crypto`를 사용하며 server query module에서만 참조

상태: **보완 완료**

### IR-5. SECURITY DEFINER read boundary

검토 결과 search/list RPC는 engagement aggregate 접근 때문에 SECURITY DEFINER가 필요하다.

확인 계약:

- fixed `search_path = pg_catalog, pg_temp`
- public/private/extensions object schema qualification
- ranking 공개 status + text moderation + image moderation 함수 내부 재검사
- item active status + text moderation + image moderation 함수 내부 재검사
- hidden content에서 파생된 facet/category match 방지
- fixed output columns
- engagement raw row/user/hash 미반환
- direct table grant 추가 없음
- function execute만 anon/authenticated 허용

상태: **정적 리뷰 통과, Hosted leakage fixture 필요**

### IR-6. pagination·sort 결정성

확인 계약:

- offset 사용 없음
- search relevance/latest/popular keyset
- category/subcategory latest/popular keyset
- sort마다 UUID final tie-break
- related recommendation 기존 priority/match/date 의미 유지 + UUID tie-break만 추가
- `limit + 1`, UI 20, DB hard max 50

상태: **정적 리뷰 통과, Hosted page overlap fixture 필요**

### IR-7. PR 전 exact-head CI 실행 경로 부재

기존 workflow는 pull_request 또는 main push 중심이라 사용자가 지정한 “exact-head CI → PR 생성” 순서를 직접 수행할 manual trigger가 없었다.

보완:

- CI에 `workflow_dispatch` 추가
- `verify:p1-3`을 `verify:p1-2` 다음, lint/build 이전에 연결

상태: **보완 완료**

## 정적 계약 verifier

`scripts/verify-p1-3-contracts.mjs`가 다음을 회귀 방지한다.

- P1-3 migration 1개
- transaction boundary
- pg_trgm/generated search columns/index
- reverse facet index
- search/list RPC
- SECURITY DEFINER/search path
- explicit Moderation predicate
- literal LIKE escape
- raw search log 금지
- engagement table direct grant 금지
- stable ID tie-break
- async `searchParams`
- GET `/search`
- limit+1
- cursor scalar validation
- legacy unbounded category query 제거
- home explicit moderation count
- home “최근 발행” 문구
- Navbar search entry
- package/CI 연결

## 구현 리뷰 결론

**IMPLEMENTATION_REVIEW_PASSED_WITH_FIXES**

Hosted 적용 전에 확인할 잔여 gate:

1. 최신 Hosted migration history 재확인
2. 저장소의 새 P1-3 migration만 `apply_migration`
3. function/index/extension/ACL 확인
4. rollback fixture로 relevance, literal wildcard, short/fuzzy query, Moderation non-leakage, popularity, keyset overlap 검증
5. planner/index evidence 확인
6. fixture residue 0 확인
7. 이후 exact-head CI
