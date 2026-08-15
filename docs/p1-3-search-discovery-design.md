# P1-3 검색·탐색 품질 개선 설계

## 1. 목적

P1-3은 공개 랭킹·아이템을 검색하고 탐색할 수 있는 일관된 read contract를 만든다.

핵심 목적:

1. 전역 검색을 실제 사용자 기능으로 활성화
2. 제목·설명·본문·브랜드·분류·facet을 설명 가능한 우선순위로 검색
3. 오타에 제한적으로 대응하는 trigram fuzzy 검색
4. 최신순·인기순을 명시적이고 안정적으로 정의
5. 카테고리·서브카테고리 목록을 keyset pagination으로 전환
6. 검색과 탐색에서 기존 Moderation 공개 경계를 동일하게 강제
7. 검색어 privacy를 보존
8. 기존 관련 추천 의미는 유지하면서 정렬 안정성만 보완

## 2. 비대상

이번 단계에서 하지 않는다.

- LLM/embedding/vector semantic search
- 외부 검색 엔진
- 사용자별 개인화 검색·추천
- 형태소 분석기 또는 언어별 stemming
- 자동 번역·동의어 사전
- 검색 query 원문 로그
- 검색 history UI
- ranking 자체의 점수 산정 알고리즘 변경
- related recommendation 우선순위 의미 변경
- 광고/스폰서 boost
- 검색 결과의 운영자 수동 boost

## 3. 사용자 시나리오

### S1. 정확한 랭킹 제목 검색

사용자가 랭킹 제목을 정확히 입력하면 동일 제목 문서가 최상단에 나온다.

### S2. 아이템·브랜드 검색

사용자가 아이템 제목 또는 브랜드·제작자를 입력하면 공개 가능한 아이템이 검색된다.

### S3. 설명·본문 검색

제목에 query가 없더라도 공개 summary/body/description에 명확히 존재하면 결과에 포함된다. 제목 일치보다 낮게 배치한다.

### S4. 분류·facet 검색

카테고리, 서브카테고리, facet 이름으로 검색하면 연결된 공개 랭킹 또는 아이템을 찾을 수 있다.

### S5. 제한적 오타 대응

3자 이상 query는 `pg_trgm` 후보 검색으로 철자 차이가 작은 결과를 찾을 수 있다.

### S6. 짧은 한글 query

2자 query는 제목·브랜드·분류의 exact/prefix 경로만 사용한다. 2자 substring/fuzzy 전체 스캔은 하지 않는다.

### S7. 최신순

검색 결과 또는 카테고리 목록에서 공개 시각 기준 최신 결과를 안정적으로 탐색한다.

### S8. 인기순

고유 조회수가 많은 콘텐츠를 우선하고, 동률이면 좋아요 수, 시각, ID 순으로 정렬한다.

### S9. 검색 결과 없음

검색어를 유지한 채 “결과 없음” 상태를 보여주고 더 짧고 일반적인 표현 또는 카테고리 탐색을 제안한다.

### S10. Moderation 차단

동일 query에 강하게 일치해도 blocked/needs_review/draft/inactive 콘텐츠는 결과·count·facet-derived match에 나타나지 않는다.

## 4. 검색 품질 기준

### 4.1 정규화

application과 DB에서 동일한 의미를 갖도록 다음을 적용한다.

1. Unicode NFKC
2. lower case
3. trim
4. 연속 whitespace를 한 칸으로 축약

검색 query는 정규화 후 2~120자다.

- 0~1자: DB 검색하지 않음
- 2자: short-query exact/prefix path
- 3~120자: exact/prefix/substring/trigram path

### 4.2 랭킹 검색 대상과 우선순위

검색 대상:

1. title
2. category/subcategory name
3. ranking facet name
4. summary
5. body

제외:

- moderation reason/review note
- scope JSON
- SEO 내부 필드
- URL
- 운영 메타데이터

### 4.3 아이템 검색 대상과 우선순위

검색 대상:

1. title
2. brand_or_creator
3. item_type
4. item facet name
5. description

제외:

- external/affiliate URL
- metadata JSON
- moderation reason/review note

### 4.4 relevance score

DB는 정수 `relevance_score`만 반환한다.

점수는 설명 가능한 tier와 작은 similarity 보조치로 구성한다.

랭킹 기본 tier 예시:

- title exact: 100000
- title prefix: 90000
- title substring: 80000
- category/subcategory exact/prefix: 70000
- facet exact/prefix: 65000
- summary substring: 50000
- body substring: 40000
- fuzzy-only match: 20000대

아이템:

- title exact: 100000
- title prefix: 90000
- title substring: 80000
- brand exact/prefix: 75000
- item type exact/prefix: 70000
- facet exact/prefix: 65000
- description substring: 45000
- fuzzy-only match: 20000대

3자 이상에서 `word_similarity`를 0~9999 보조치로 더하되 base tier를 뒤집지 못하게 한다.

UI에는 raw score를 표시하지 않고 `match_reason`만 사용한다.

## 5. DB 계약

### 5.1 extension

- `pg_trgm`을 `extensions` schema에 활성화한다.
- `unaccent`는 P1-3에서 활성화하지 않는다.

### 5.2 generated search text

`rankings.search_text` generated stored:

- title + summary + body
- NFKC + lower + whitespace collapse

`items.search_text` generated stored:

- title + brand_or_creator + item_type + description
- 동일 정규화

검색 결과로 `search_text` 자체를 반환하지 않는다.

### 5.3 public search RPC

`public.search_public_content(...)`

입력:

- `p_query TEXT`
- `p_kind TEXT`: `all | ranking | item`
- `p_sort TEXT`: `relevance | latest | popular`
- `p_limit INTEGER`: 1~50, UI 기본 20
- sort별 cursor scalar

성격:

- `STABLE`
- `SECURITY DEFINER`
- 고정 search path
- 모든 object schema qualification
- `anon`, `authenticated`만 EXECUTE
- 테이블 직접 권한은 추가하지 않음

반환 공통 필드:

- `content_kind`
- `id`
- `slug`
- `title`
- `description`
- `image_url`
- `category_name`, `category_slug`
- `subcategory_name`, `subcategory_slug`
- `item_type`
- `brand_or_creator`
- `sort_time`
- `relevance_score`
- `unique_view_count`
- `like_count`
- `match_reason`

RPC 내부에서 공개 조건을 명시적으로 다시 강제한다.

### 5.4 public ranking list RPC

`public.list_public_rankings(...)`

입력:

- category slug
- optional subcategory slug
- `latest | popular`
- limit
- cursor scalar

반환:

- 기존 ranking card에 필요한 공개 필드
- category/subcategory metadata
- unique views
- like count
- sort cursor 필드

### 5.5 popularity

가중합 점수는 만들지 않는다.

정렬 계약:

1. `unique_view_count DESC`
2. `like_count DESC`
3. `sort_time DESC`
4. `content_kind ASC` — 통합 검색 only
5. `id ASC`

사용자 식별자, viewer hash, 일일 view row는 반환하지 않는다.

## 6. API·서버 계약

새 모듈:

- `src/lib/search/contracts.ts`
- `src/lib/search/cursor.ts`
- `src/lib/queries/search.ts`

### query string

`/search`

- `q`
- `type=all|ranking|item`
- `sort=relevance|latest|popular`
- `cursor=<opaque base64url>`

기본값:

- type: `all`
- sort: `relevance`
- page size: 20

cursor는 다음을 포함한다.

- version
- query/filter fingerprint
- sort별 keyset 값

filter나 query가 달라진 cursor는 무효 처리하고 첫 페이지로 되돌린다.

검색은 GET이며 Server Action mutation을 사용하지 않는다.

## 7. UI 계약

### 7.1 홈

- disabled 검색 input을 `/search` GET form으로 교체
- 2자 이상 입력 안내
- 통계 count에 moderation 조건을 명시
- “최근 업데이트”를 실제 계약에 맞게 “최근 발행”으로 수정

### 7.2 Navbar

- desktop에서 compact 검색 GET form 제공
- 모바일에서는 `/search` 진입 링크를 최소 제공

### 7.3 `/search`

상태:

1. query 없음: 검색 안내
2. 1자: 최소 길이 안내
3. 정상 결과: 결과 카드 + type/sort controls + 다음 페이지
4. 결과 없음: query 유지 + 검색 조정 안내 + category browse link
5. 잘못된 cursor: 안전하게 첫 페이지로 fallback

### 7.4 category/subcategory

- `latest | popular` 정렬 제공
- 20건 keyset pagination
- 다음 페이지 버튼
- filter 변경 시 cursor 제거

## 8. 인덱스·성능 계획

### trigram

- public ranking `search_text` GIN trigram partial index
- public item `search_text` GIN trigram partial index
- category/subcategory/facet normalized name trigram index

### relation reverse lookup

- `ranking_facets(facet_id, ranking_id)`
- `item_facets(facet_id, item_id)`

### stable browse

- public ranking category + `COALESCE(published_at, updated_at)` DESC + ID
- public ranking subcategory + 동일 keyset

### bounded query

- UI limit 20
- DB limit max 50
- `limit + 1`로 has-more 판단
- 2자 query는 broad substring/fuzzy를 사용하지 않음

현재 Hosted 데이터가 작으므로 실제 운영 데이터만으로 planner 품질을 과장하지 않는다. transaction rollback synthetic fixture와 `EXPLAIN (ANALYZE, BUFFERS)`를 함께 사용한다.

## 9. Moderation·보안 노출 규칙

### 랭킹 결과

반드시:

- published
- moderation clean/suggestive
- image moderation clean/suggestive

### 아이템 결과

반드시:

- active
- moderation clean/suggestive
- image moderation clean/suggestive

### facet/category-derived match

연결 콘텐츠가 공개 조건을 통과한 뒤에만 score에 반영한다.

### 금지 데이터

검색 RPC가 반환하거나 검색 document에 넣지 않는다.

- moderation note/reason
- admin/user identifiers
- internal_note
- arbitrary JSON
- tokens
- raw URLs
- viewer_key_hash
- raw daily view events

SECURITY DEFINER 함수는 숨겨진 콘텐츠가 exact match여도 노출되지 않는 Hosted fixture를 필수 gate로 둔다.

## 10. pagination·정렬 안정성

Offset pagination을 사용하지 않는다.

### relevance

`relevance_score DESC, sort_time DESC, content_kind ASC, id ASC`

### latest

`sort_time DESC, content_kind ASC, id ASC`

### popular

`unique_view_count DESC, like_count DESC, sort_time DESC, content_kind ASC, id ASC`

category/subcategory list는 content kind가 ranking으로 고정이므로 마지막 tie-break는 ID다.

같은 dataset snapshot에서 반복 요청 시 완전히 같은 순서를 반환해야 한다.

## 11. 다국어 계획

P1-3은 NFKC + lower + trigram을 사용하여 한글·영문·숫자 혼합을 동일 character-level contract로 처리한다.

형태소 분석, 언어별 stemming, 전문 FTS는 도입하지 않는다.

향후 다음 조건 중 하나가 관측되면 별도 단계에서 FTS/PGroonga/semantic retrieval을 검토한다.

- corpus 확대 후 trigram index 비용이 과도함
- 긴 자연어 질의 비중 증가
- 형태소·동의어 recall 부족이 실제 테스트에서 반복됨
- 다국어 번역 검색 요구가 제품 요구사항이 됨

## 12. 검색 로그·privacy

P1-3은 raw search query를 DB에 저장하지 않는다.

- search history 없음
- query analytics table 없음
- telemetry에 query text 없음

후속 analytics가 필요하면 별도 설계에서 목적, 최소 수집, hashing 가능성, retention, 삭제 정책을 먼저 확정한다.

## 13. Hosted 검증 계획

migration 적용 전:

1. migration history 재확인
2. `pg_trgm` 설치 여부 재확인
3. 대상 index/function collision 확인

적용 후 transaction rollback fixture:

1. exact title > prefix > summary/body 순서
2. item title/brand/description 순서
3. 3자 typo fuzzy candidate
4. 2자 query가 short path만 사용하는지
5. NFKC/case/whitespace normalization
6. category/subcategory/facet match
7. hidden ranking exact match 미노출
8. hidden item exact match 미노출
9. popular unique views → likes → time → id 순서
10. relevance/latest/popular keyset page overlap 0
11. 동일 timestamp/metric tie에서 ID 안정성
12. cursor mismatch application fallback
13. category/subcategory pagination overlap 0
14. fixture rollback 후 잔여 0
15. `EXPLAIN`에서 3자 이상 candidate가 trigram index를 사용할 수 있는지 확인
16. reverse facet lookup index 확인
17. advisor warning은 의도와 실제 위험을 구분하여 검토

## 14. CI 계약

PR 생성 전 exact head에서 다음을 한 번 최종 수행한다.

1. `npm ci`
2. `npm run verify:p1-2`
3. `npm run lint`
4. `npm run build`

P1-3 static contract verifier를 추가할 경우 CI에서 lint/build 전에 실행한다.

불필요한 중간 Actions 실행은 하지 않는다.
