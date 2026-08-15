# P1-3 검색·탐색 품질 개선 현행 구조 조사

## 1. Authority

- 기준 `main`: `9b267d465159e2d2f6186d13a8c589d08cc56945`
- 조사 시 열린 PR: 없음
- Hosted Supabase project: `yjdubukqkcvkymabskzd`
- Hosted 마지막 migration: `20260801195052 p1_2_integration_sanction_enforcement`
- P1-2 integration migration은 이미 적용되어 있으므로 재실행하지 않는다.

## 2. 공개 탐색 진입점

현재 공개 경로는 다음과 같다.

- `/`: featured 랭킹, 카테고리, 최근 발행 랭킹
- `/categories`: 공개 카테고리 디렉터리
- `/categories/[categorySlug]`: 카테고리의 공개 랭킹 전체 목록
- `/categories/[categorySlug]/[subcategorySlug]`: 서브카테고리의 공개 랭킹 전체 목록
- `/rankings/[rankingSlug]`: 랭킹 상세 및 관련 랭킹
- `/items/[itemSlug]`: 아이템 상세, 포함 랭킹, 관련 아이템

전역 `/search` 경로와 공개 `/items` 목록 경로는 없다.

홈 검색 입력은 disabled 상태이며 실제 검색 요청을 만들지 않는다. Navbar에도 검색 입력이나 검색 링크가 없다.

## 3. 현재 공개 조회 계층

공개 화면은 `src/lib/supabase/public.ts`의 anon client를 사용한다.

주요 조회는 `src/lib/queries/public.ts`에 집중되어 있다.

- `getHomeData()`
- `getVisibleCategories()`
- `getCategoryBySlug()`
- `getSubcategoryBySlug()`
- `getPublishedRankingsByCategory()`
- `getPublishedRankingsBySubcategory()`
- `getPublishedRankingBySlug()`
- `getItemBySlug()`
- `getRankingsContainingItem()`
- `getRelatedRankings()`
- `getRelatedItems()`

전역 검색용 DB 함수, query module, Server Action은 없다.

## 4. 현재 검색 가능한 데이터 필드

### 랭킹

공개 본문에 존재하는 후보 필드:

- `title`
- `summary`
- `body`
- `ranking_type`
- category `name`
- subcategory `name`
- 연결 facet `name`

검색에서 제외해야 하는 필드:

- moderation reason / review note
- SEO 내부 운용 필드
- 임의 `scope_json`
- 운영·감사 메타데이터

### 아이템

공개 본문에 존재하는 후보 필드:

- `title`
- `description`
- `item_type`
- `brand_or_creator`
- 연결 facet `name`

검색에서 제외해야 하는 필드:

- `external_url`, `affiliate_url`
- 임의 `metadata`
- moderation reason / review note

### 분류

- categories: `name`, `slug`, `description`, `is_visible`
- subcategories: `name`, `slug`, `description`, `is_visible`
- facets: `name`, `slug`, `description`

P1-3 검색 결과 타입은 랭킹과 아이템으로 제한하고, category/subcategory/facet은 결과 자체가 아니라 관련 콘텐츠의 검색 신호와 탐색 경로로 사용한다.

## 5. 공개·Moderation 계약

Hosted RLS 기준 공개 조건은 다음과 같다.

### 랭킹

- `status = 'published'`
- `moderation_status IN ('clean', 'suggestive')`
- `image_moderation_status IN ('clean', 'suggestive')`

### 아이템

- `status = 'active'`
- `moderation_status IN ('clean', 'suggestive')`
- `image_moderation_status IN ('clean', 'suggestive')`

### ranking_entries

- entry moderation이 공개 가능해야 한다.
- parent ranking 역시 공개 조건을 만족해야 한다.

### category / subcategory

- anon 공개는 `is_visible = true`다.

검색 RPC가 `SECURITY DEFINER`를 사용할 경우 RLS를 우회하므로 위 조건을 RPC 내부에 중복 강제해야 한다.

## 6. 현재 정렬과 pagination

### 홈

- featured: `published_at DESC`, 1건
- recent: `published_at DESC`, 6건

UI 섹션 제목은 현재 “최근 업데이트”지만 실제 정렬은 `published_at DESC`이므로 계약이 불일치한다.

### 카테고리 / 서브카테고리

- `published_at DESC`
- limit 없음
- cursor 없음
- 전체 결과를 한 번에 렌더링

### 아이템 포함 랭킹

- `ranking_entries.created_at DESC`
- limit 없음

검색 결과가 없을 때의 전역 search UX는 존재하지 않는다. 카테고리 페이지에는 단순 empty state만 있다.

## 7. 현재 추천·탐색 계약

### 관련 랭킹

우선순위:

1. 공유 아이템
2. 동일 서브카테고리
3. 동일 카테고리
4. 공유 facet
5. 동일 우선순위에서는 match count가 많은 후보
6. 그 다음 최신 시각

최종 6건을 반환한다.

### 관련 아이템

우선순위:

1. 같은 브랜드·제작자
2. 공유 facet
3. 같은 공개 랭킹
4. 같은 카테고리의 공개 랭킹
5. 동일 우선순위에서는 match count와 최신 시각

최종 결과는 bounded candidate query 후 인메모리 정렬한다.

현재 최종 tie-break에 ID가 없어 timestamp까지 동일하면 순서가 완전하게 고정되지 않는다.

### 인기순

공개 목록에 “인기순” 계약은 없다.

P1-2에서 이미 다음 authoritative engagement aggregate가 존재한다.

- `content_view_totals.unique_view_count`
- `content_likes`
- public count read RPC

원본 viewer hash 또는 일일 view 원장은 검색·인기 목록에 노출하지 않는다.

## 8. PostgreSQL 인덱스 현황

현재 주요 공개 인덱스:

- rankings: `(status, moderation_status, image_moderation_status, published_at DESC)`
- items: `(status, moderation_status, image_moderation_status, created_at DESC)`
- rankings / items slug unique
- ranking_entries: `(ranking_id, moderation_status)`
- ranking_facets PK: `(ranking_id, facet_id)`
- item_facets PK: `(item_id, facet_id)`

부족한 부분:

- 제목·설명·본문용 trigram/FTS 인덱스 없음
- facet reverse lookup용 `(facet_id, ranking_id)` / `(facet_id, item_id)` 없음
- category/subcategory + stable keyset `(time, id)` 인덱스 없음

Hosted에서 `pg_trgm`과 `unaccent`는 사용 가능하지만 조사 시점에는 설치되어 있지 않다.

## 9. 검색 정규화 현황

전역 검색 자체가 없으므로 공통 정규화 계약도 없다.

Hosted PostgreSQL은 Unicode `normalize(..., NFKC)`를 지원한다. P1-3에서는 application과 DB 모두 다음 규칙을 사용해야 한다.

- Unicode NFKC
- lower case
- leading/trailing whitespace 제거
- 연속 whitespace 1칸 축약

## 10. 다국어 검색 현황

현재 데이터 모델은 언어별 컬럼이나 locale-specific tokenizer가 없다.

초기 P1-3은 한글·영문·숫자 혼합을 문자 기반으로 처리한다. 형태소 분석, 언어별 stemming, 번역 동의어 사전, semantic/vector search는 현재 구조에 없다.

## 11. 검색 로그·개인정보 현황

검색 query log 테이블은 없다.

검색어는 이메일, 전화번호, 이름 등 개인 정보를 포함할 수 있으므로 P1-3에서 raw query telemetry를 새로 저장하지 않는다. 검색 분석이 필요해질 경우 별도 privacy/retention 설계 후 도입한다.

## 12. Hosted 데이터 규모

조사 시점:

- rankings total: 2
- public rankings: 1
- items total/public: 6/6
- visible categories: 1
- visible subcategories: 0
- facets: 0
- ranking_entries: 6

현재 production row 수만으로 relevance와 index plan을 검증하기 어렵다. Hosted 검증은 transaction rollback synthetic fixture를 사용해야 한다.

## 13. 발견된 결함·리스크

1. 홈 아카이브 통계 count가 `status`만 검사하고 moderation 조건을 명시하지 않는다. anon RLS가 현재 숨김을 보조하지만 UI 계약 자체가 RLS 구현에 과도하게 의존한다.
2. 홈 “최근 업데이트” 명칭과 실제 `published_at DESC` 정렬이 다르다.
3. 카테고리·서브카테고리 목록이 무제한 조회다.
4. 관련 추천의 마지막 tie-break가 고정되지 않았다.
5. facet reverse lookup 인덱스가 없다.
6. public search RPC와 검색 인덱스가 없다.
7. 인기순의 정의가 없다.
8. 전역 no-result UX가 없다.
9. 검색어 정규화와 길이 제한이 없다.
10. 검색 원문 logging이 향후 무심코 추가될 경우 privacy/retention 경계가 불명확하다.
