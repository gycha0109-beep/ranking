# P1-3 설계 리뷰 반영·최종 계약

이 문서는 P1-3 최초 설계와 설계 리뷰의 차이를 해소하는 구현 기준이다. 충돌 시 이 문서가 우선한다.

## 1. 범위

P1-3은 다음을 구현한다.

1. `/search` 전역 공개 검색
2. 랭킹·아이템 통합 결과
3. `relevance | latest | popular` 정렬
4. category/subcategory `latest | popular` bounded 탐색
5. stable keyset pagination
6. pg_trgm candidate retrieval
7. search query 정규화
8. no-result UX
9. 홈·Navbar 검색 진입
10. 관련 추천 최종 ID tie-break
11. 홈 공개 count Moderation 명시
12. 홈 “최근 발행” 용어 정합

semantic/vector/personalized search와 query logging은 비대상이다.

## 2. query 계약

정규화:

- Unicode NFKC
- lower case
- trim
- whitespace collapse

길이:

- 0~1: application validation, DB 호출 없음
- 2: exact/prefix only
- 3~120: exact/prefix/substring/trigram
- 121 이상: invalid

URL:

`/search?q=<query>&type=all|ranking|item&sort=relevance|latest|popular&cursor=<opaque>`

기본:

- type `all`
- sort `relevance`
- 20 rows

## 3. 검색 대상 계약

### ranking

- title
- category/subcategory name
- facet name
- summary
- body

### item

- title
- brand_or_creator
- item_type
- facet name
- description

민감 운영 필드, moderation metadata, URL, arbitrary JSON은 검색 document와 결과에서 제외한다.

## 4. relevance 계약

결정적 integer score를 사용한다.

order:

`relevance_score DESC, sort_time DESC, content_kind ASC, id ASC`

exact title > prefix title > title substring > 분류/facet > summary/description > body > fuzzy-only를 보장한다.

3자 이상 fuzzy 보조치는 `word_similarity`를 0~9999 integer 범위로 변환한다. 이 보조치는 상위 tier를 뒤집지 못한다.

UI에는 score를 노출하지 않고 match reason만 표시한다.

## 5. latest 계약

통합 검색:

`sort_time DESC, content_kind ASC, id ASC`

- ranking sort time: `COALESCE(published_at, updated_at, created_at)`
- item sort time: `COALESCE(created_at, updated_at)`

category/subcategory는 ranking만 반환하므로:

`sort_time DESC, id ASC`

## 6. popular 계약

가중합 없음.

통합 검색:

`unique_view_count DESC, like_count DESC, sort_time DESC, content_kind ASC, id ASC`

category/subcategory:

`unique_view_count DESC, like_count DESC, sort_time DESC, id ASC`

원본 likes user ID, viewer hash, daily view row는 반환하지 않는다.

## 7. DB schema/index 계약

신규 migration 1개에 다음 forward change를 둔다.

- `pg_trgm` extension enable under `extensions`
- `rankings.search_text` generated stored
- `items.search_text` generated stored
- public content partial GIN trigram indexes
- category/subcategory/facet name trigram indexes
- `ranking_facets(facet_id, ranking_id)`
- `item_facets(facet_id, item_id)`
- category/subcategory latest keyset indexes
- public search RPC
- public ranking list RPC

기존 migration을 재실행하지 않는다.

## 8. DB 함수 보안 계약

`public.search_public_content`과 `public.list_public_rankings`는 aggregate read를 위해 SECURITY DEFINER를 사용한다.

반드시:

- fixed/minimal search path
- fully qualified objects
- input allowlist + hard limit
- ranking/item public predicates 직접 강제
- hidden row에서 파생된 match 없음
- safe fixed output columns
- table direct grants 변경 없음
- function PUBLIC execute revoke
- anon/authenticated execute grant

## 9. UI/API 계약

### search page

Next App Router page에서 `searchParams`를 await한다.

GET form만 사용한다. 검색은 mutation Server Action이 아니다.

### cursor

application이 opaque base64url JSON cursor를 encode/decode한다.

포함:

- version 1
- contract fingerprint
- sort-specific keyset

query/type/sort 또는 category/subcategory와 맞지 않는 cursor는 무시하고 첫 페이지로 fallback한다.

cursor는 authorization boundary가 아니다. DB 공개 predicate가 권한 boundary다.

## 10. 카테고리 탐색 계약

기존 무제한 `getPublishedRankingsByCategory/Subcategory` 경로를 bounded RPC 호출로 교체한다.

- page size 20
- DB max 50
- `limit + 1` fetch
- latest/popular
- next cursor only

기존 empty-state 의미는 유지한다.

## 11. recommendation 계약

현재 related ranking/item priority와 reason은 변경하지 않는다.

`sortCandidates()` 마지막 tie-break에 candidate ID를 추가한다.

## 12. 홈 계약

- disabled search bar → GET `/search`
- count query에 explicit public Moderation 조건 추가
- “최근 업데이트” → “최근 발행”

## 13. privacy 계약

P1-3은 search query를 persistent storage에 기록하지 않는다.

- DB query log table 없음
- telemetry query text 없음
- search history 없음

## 14. Hosted gate

migration 적용 전 history 확인 후 새 migration만 `apply_migration`으로 적용한다.

Hosted validation은 transaction rollback synthetic fixture로 다음을 증명한다.

- relevance tier
- normalization
- short query
- fuzzy query
- Moderation non-leakage
- popularity
- stable keyset
- category/subcategory pagination
- index availability/planner evidence
- fixture residue 0

## 15. CI·PR lifecycle

구현 리뷰와 보완이 끝난 뒤에만 PR exact-head CI를 실행한다.

최종 gate:

- P1-2 contract verifier
- P1-3 contract verifier if added
- lint
- build

PR 생성 후 사용자 승인 전에는 merge하지 않는다.
