# 랭킹위키 Implementation Plan v0.2

## 0. 문서 목적

이 문서는 랭킹위키 MVP를 실제 구현하기 위한 단계별 실행 계획이다.

Usecase 문서와 DB ERD 문서에서 확정한 범위를 기준으로, 구현 순서·작업 단위·검수 기준·범위 제외 사항을 고정한다.

이 문서의 핵심 기준은 다음이다.

```txt
P0-Core = 관리자 랭킹 문서 발행 루프 구현
P1 = 검색, 반응, 댓글, 관련 랭킹 등 참여/탐색 강화
P2 = 투표, 스폰서, 크롤링, 자동화, 변경 이력
```

P0-Core 구현 중에는 기능을 넓히지 않는다.  
목표는 “랭킹위키 전체 완성”이 아니라 “관리자가 신뢰 가능한 랭킹 문서를 만들고 발행하는 흐름”을 완성하는 것이다.

---

## 1. 구현 원칙

### 1.1 P0-Core만 먼저 구현한다

P0-Core의 목표는 다음 흐름을 실제로 작동시키는 것이다.

```txt
관리자 로그인
→ 카테고리/서브카테고리/Facet/아이템 생성
→ 랭킹 문서 생성
→ Ranking Scope와 선정 기준 입력
→ 랭킹 엔트리 구성
→ 미리보기
→ published 발행
→ 공개 페이지 노출
```

P0-Core에서 구현하지 않는 것:

- 검색 페이지
- 반응 버튼
- 댓글 작성
- 댓글 관리
- 유저 투표
- 스폰서 판매 관리
- 크롤링
- 자동 랭킹 생성
- 복잡한 Facet 다중 필터 UI
- 대댓글/신고/제재 시스템
- 랭킹 변경 이력 UI
- 결제

---

### 1.2 랭킹 문서가 서비스의 중심이다

구현 우선순위는 커뮤니티가 아니라 랭킹 문서다.

가장 먼저 완성해야 하는 핵심 페이지는 다음이다.

```txt
/rankings/[slug]
```

이 페이지에서 최소한 다음 정보가 보여야 한다.

- 랭킹 제목
- 요약
- Ranking Scope
- 랭킹 유형
- 선정 기준
- 순위표
- 각 순위별 선정 이유
- 아이템 상세 링크
- 최종 업데이트일

---

### 1.3 Facet은 P0에서 데이터 연결까지만 구현한다

Facet은 P0에서 반드시 데이터 구조로 필요하다.

P0에서 Facet의 역할:

- 관리자 CMS에서 Facet Group 생성
- 관리자 CMS에서 Facet 생성
- 아이템에 Facet 연결
- 랭킹에 Facet 연결
- 공개 랭킹 상세/목록 카드에서 Facet 칩 표시

P1로 넘길 것:

- Facet 다중 조합 필터
- Facet 기반 고급 검색
- URL query 기반 필터 조합
- 조건 조합별 SEO 페이지 자동 생성

즉, P0에서는 Facet을 “분류와 표시”에 사용하고, “고급 탐색 UI”에는 사용하지 않는다.

---

### 1.4 scope_json과 ranking_facets의 역할을 분리한다

구현 시 `scope_json`과 `ranking_facets`는 서로 역할이 다르다.

| 항목 | 역할 |
|---|---|
| `scope_json` | 사람이 읽는 후보군 범위 설명과 유연한 확장용 스냅샷 |
| `ranking_facets` | 검색, 필터, 내부 연결에 쓰는 정규화된 조건 연결 |

공개 탐색과 필터링의 기준은 `ranking_facets`를 우선한다.

랭킹 상세에서 사용자가 이해하는 후보군 설명은 `scope_json`을 활용한다.

---

### 1.5 ranking_sources는 선택 입력이다

`ranking_sources` 테이블은 P0에서 만들 수 있다.

다만 랭킹 발행 필수 입력값으로 강제하지 않는다.

P0 발행 필수값:

```txt
title
category_id
summary
ranking_type
scope_json
ranking_entries 1개 이상
ranking_criteria 1개 이상
```

선택 입력:

```txt
ranking_sources
```

---

### 1.6 검증은 서버에서 최종 수행한다

클라이언트 validation은 UX 보조용이다.

다음 검증은 반드시 서버 측 action 또는 route handler에서 다시 수행한다.

- 관리자 권한 검증
- category/subcategory 정합성 검증
- slug 중복 검증
- 발행 필수값 검증
- ranking_entries 존재 여부 검증
- ranking_criteria 존재 여부 검증
- draft/published 접근 권한 검증

---

## 2. 전제 스택

기본 구현 전제는 다음과 같다.

```txt
Next.js App Router
TypeScript
Supabase
PostgreSQL
Tailwind CSS
Server Actions 또는 Route Handlers
```

이미 다른 스택이 선택된 경우에도 구현 순서는 동일하게 유지한다.

---

## 3. 구현 마일스톤 요약

| 단계 | 목표 | 산출물 |
|---:|---|---|
| 0 | 프로젝트 구조 확인 | 현재 구조 파악, env 확인 |
| 1 | DB 스키마 구현 | Supabase migration |
| 2 | Auth/Admin 권한 구현 | 로그인, admin role 보호 |
| 3 | Seed 데이터 구현 | 초기 카테고리/랭킹 데이터 |
| 4 | Data Access Layer 구현 | 공개/관리자 조회 함수 |
| 5 | 공개 페이지 구현 | 홈, 카테고리, 랭킹 상세, 아이템 상세 |
| 6 | 관리자 기본 CMS 구현 | Category/Subcategory/Facet/Item CRUD |
| 7 | 랭킹 작성 CMS 구현 | Ranking, Criteria, Sources, Entry 편집 |
| 8 | 미리보기/발행 구현 | draft/published 전환 |
| 9 | QA/검수 | 발행 루프 E2E 확인 |
| 10 | 문서화/배포 준비 | README, env, seed 절차 정리 |

---

## Phase 0. 프로젝트 초기 점검

### 목표

기존 프로젝트 상태를 확인하고 구현 범위를 고정한다.

### 작업

- Next.js 프로젝트 구조 확인
- Supabase 연결 방식 확인
- 환경변수 확인
- 현재 존재하는 라우트 확인
- 현재 존재하는 DB migration 확인
- 기존 인증 구조 확인
- Tailwind/UI 컴포넌트 구조 확인

### 체크리스트

```txt
.env.local 또는 환경변수에 Supabase URL/Key가 있는가
Supabase client/server helper가 있는가
App Router 구조인가
admin route가 이미 있는가
migration 디렉터리가 있는가
seed 실행 방식이 있는가
```

### 완료 기준

- 현재 프로젝트 구조를 파악했다.
- P0-Core 외 기능은 구현하지 않는다고 확정했다.
- 기존 코드가 있다면 보존하고 필요한 범위만 수정한다.

---

## Phase 1. Supabase DB 스키마 구현

### 목표

ERD 문서 기준으로 P0-Core에 필요한 테이블을 만든다.

### P0 테이블

```txt
profiles
user_roles

categories
subcategories

facet_groups
facets

items
item_facets

rankings
ranking_entries
ranking_facets
ranking_criteria
ranking_sources
```

### P1 테이블

P1 기능은 구현하지 않더라도, 필요하면 테이블만 미리 만들 수 있다.

```txt
reactions
comments
```

다만 UI와 기능은 P1로 둔다.

---

### 주요 제약

#### 상태값 / 타입값 제약

P0에서는 enum 타입 또는 CHECK constraint 중 하나를 사용해 주요 문자열 필드의 허용값을 제한한다.

대상 예시:

```txt
rankings.status: draft, published, archived
rankings.ranking_type: editor_pick, popularity, quality, purpose, user_vote, sponsored
items.status: active, hidden, archived
user_roles.role: admin, editor, user
facet_groups.applies_to: ranking, item, both
```

처음에는 CHECK constraint로 시작해도 된다.

#### slug 제약

```txt
categories.slug unique
subcategories unique(category_id, slug)
items.slug unique
rankings.slug unique
facets unique(facet_group_id, slug)
```

MVP에서는 `items.slug`를 전역 unique로 둔다.

향후 item_type별 URL 구조가 필요해지면 다음 정책으로 전환할 수 있다.

```txt
unique(item_type, slug)
```

#### ranking_entries 제약

```txt
unique(ranking_id, position)
unique(ranking_id, item_id)
position > 0
```

#### item_facets / ranking_facets 제약

```txt
primary key(item_id, facet_id)
primary key(ranking_id, facet_id)
```

#### comments 제약

P1에서 comments를 만들 경우, 댓글은 ranking 또는 item 중 하나에만 연결되게 한다.

```txt
CHECK (
  (ranking_id IS NOT NULL AND item_id IS NULL)
  OR
  (ranking_id IS NULL AND item_id IS NOT NULL)
)
```

---

### Category/Subcategory 정합성

Ranking이 `subcategory_id`를 가질 경우, 해당 Subcategory의 `category_id`는 `rankings.category_id`와 일치해야 한다.

P0에서는 다음 중 하나로 보장한다.

1. 애플리케이션 validation
2. DB trigger
3. 제약 가능한 구조로 재설계

P0에서는 애플리케이션 validation으로 시작해도 된다.

---

### RLS 원칙

실제 정책 SQL은 구현 시 작성한다.

원칙은 다음과 같다.

```txt
published rankings = 공개 읽기 가능
draft rankings = admin/editor만 읽기 가능
categories/subcategories/facets/items = 공개 페이지에서는 visible/active만 읽기
admin/editor = P0 테이블 쓰기 가능
일반 user = P0에서는 쓰기 권한 없음
```

### 완료 기준

- 모든 P0 테이블이 생성된다.
- FK 관계가 정상이다.
- unique/CHECK 제약이 적용된다.
- RLS 기본 원칙이 적용된다.
- seed 데이터를 넣을 수 있다.
- schema 변경 후 타입 에러 없이 빌드된다.

---

## Phase 2. Auth/Admin 권한 구현

### 목표

관리자만 CMS에 접근하고 데이터를 수정할 수 있게 한다.

---

### 2.1 Supabase Auth 연결

작업:

- 회원가입 또는 로그인 페이지 구현
- 로그인 세션 확인
- 로그아웃 구현
- 로그인 후 `next` 파라미터가 있으면 해당 경로로 복귀

---

### 2.2 profiles 생성 처리

사용자가 처음 로그인하면 `profiles` row가 생성되어야 한다.

구현 방식 후보:

- DB trigger
- 로그인 후 애플리케이션에서 upsert

P0에서는 단순한 upsert 방식도 허용한다.

---

### 2.3 admin role 확인

`user_roles`에서 현재 사용자가 `admin` 또는 `editor`인지 확인한다.

P0 권장:

```txt
admin = 전체 CMS 접근 가능
editor = 선택적으로 나중에 도입
```

처음에는 `admin`만 구현해도 된다.

---

### 2.4 admin route 보호

보호 대상:

```txt
/admin
/admin/categories
/admin/subcategories
/admin/facets
/admin/items
/admin/rankings
/admin/rankings/new
/admin/rankings/[id]/edit
/admin/rankings/[id]/preview
```

비로그인 사용자:

```txt
/login?next=/admin
```

권한 없는 로그인 사용자:

```txt
Not authorized 화면 표시
```

---

### 2.5 첫 관리자 부트스트랩

첫 admin 지정 방식은 다음 중 하나를 제공한다.

1. Supabase SQL Editor에서 특정 `user_id` 또는 email 기준으로 `user_roles`에 admin row를 직접 삽입한다.
2. 개발 환경에서만 `ADMIN_BOOTSTRAP_EMAIL`을 읽어 해당 이메일 사용자를 admin으로 승격한다.

운영 환경에서는 임의 자동 승격을 막는다.

README에는 반드시 다음을 문서화한다.

```txt
첫 admin 계정 생성 방법
user_roles에 admin row를 넣는 SQL 예시
ADMIN_BOOTSTRAP_EMAIL 사용 시 주의사항
```

---

### 완료 기준

- 비로그인 사용자는 admin 접근 불가
- admin role 사용자는 CMS 접근 가능
- 일반 로그인 사용자는 CMS 접근 불가
- 첫 관리자 지정 방법이 README에 문서화됨

---

## Phase 3. Seed 데이터 구현

### 목표

빈 화면을 피하고 공개 페이지/관리자 CMS를 검수할 수 있는 최소 데이터를 만든다.

### Seed 구성

#### categories

```txt
식품
콘텐츠
게임
```

#### subcategories

```txt
식품 > 닭가슴살
식품 > 단백질 보충제
콘텐츠 > 웹툰
```

#### facet_groups

```txt
brand
form
purpose
platform
genre
status
```

#### facets

```txt
brand: 한끼통살, 허닭, 랭커
form: 수비드, 훈제, 볼
purpose: 맛있는, 가성비, 다이어트용
platform: 네이버, 카카오
genre: 로맨스, 액션, 공포
status: 완결, 연재중
```

#### rankings

```txt
2026 맛있는 수비드 닭가슴살 TOP 10
가성비 닭가슴살 브랜드 순위
입문자용 네이버 웹툰 TOP 10
```

#### items

최소 10개 이상 생성한다.

닭가슴살 계열과 웹툰 예시를 섞어도 된다.

### Seed 실행 방식

다음 중 하나를 제공한다.

```txt
supabase/seed.sql
scripts/seed.ts
scripts/seed.mjs
```

### 완료 기준

- seed 실행 후 홈에 랭킹이 보인다.
- 랭킹 상세에 ranking_entries가 보인다.
- 아이템 상세에서 포함된 랭킹이 보인다.
- facet이 카드 또는 상세에 표시된다.

---

## Phase 4. Data Access Layer 구현

### 목표

페이지와 CMS가 직접 복잡한 Supabase query를 반복하지 않도록 조회/수정 함수를 분리한다.

### 권장 파일 구조

```txt
src/lib/supabase/
  client.ts
  server.ts
  admin.ts

src/lib/queries/
  public.ts
  admin.ts
  rankings.ts
  items.ts
  categories.ts
  facets.ts

src/lib/actions/
  admin-categories.ts
  admin-subcategories.ts
  admin-facets.ts
  admin-items.ts
  admin-rankings.ts
```

기존 프로젝트 구조가 다르면 현재 구조에 맞춰 적용한다.

### 공개 조회 함수

필수 함수 예시:

```txt
getHomeData()
getVisibleCategories()
getCategoryBySlug(slug)
getSubcategoryBySlug(categorySlug, subcategorySlug)
getPublishedRankingsByCategory(categorySlug)
getPublishedRankingsBySubcategory(categorySlug, subcategorySlug)
getPublishedRankingBySlug(slug)
getItemBySlug(slug)
getRankingsContainingItem(itemId)
```

### 관리자 조회/수정 함수

필수 함수 예시:

```txt
listAdminCategories()
createCategory()
updateCategory()

listAdminSubcategories()
createSubcategory()
updateSubcategory()

listFacetGroups()
createFacetGroup()
createFacet()
updateFacet()

listAdminItems()
createItem()
updateItem()

listAdminRankings()
createRankingDraft()
updateRanking()
updateRankingCriteria()
updateRankingSources()
updateRankingFacets()
updateRankingEntries()
publishRanking()
unpublishRanking()
```

### 오류 처리 원칙

공개 페이지와 관리자 페이지 모두 다음 상태를 구분한다.

```txt
데이터 없음
권한 없음
조회 실패
저장 실패
validation 실패
```

### 완료 기준

- 공개 페이지는 published 데이터만 조회한다.
- 관리자 페이지는 draft/published를 모두 조회한다.
- query 실패와 빈 데이터 상태가 구분된다.
- 페이지 컴포넌트에 복잡한 DB query가 과하게 흩어지지 않는다.

---

## Phase 5. 공개 페이지 구현

### 목표

방문자가 랭킹 문서와 아이템을 탐색할 수 있게 한다.

### 공개 라우트

```txt
/
/categories
/categories/[categorySlug]
/categories/[categorySlug]/[subcategorySlug]
/rankings/[rankingSlug]
/items/[itemSlug]
```

검색은 P1이므로 P0에서는 만들지 않는다.

---

### 5.1 홈

표시 정보:

- 대표 랭킹
- 최신 랭킹
- 주요 카테고리
- 빈 상태 안내

완료 기준:

- seed 데이터 기준 최소 3개 랭킹이 보인다.
- 랭킹 클릭 시 상세 페이지로 이동한다.
- 카테고리 클릭 시 카테고리 페이지로 이동한다.

---

### 5.2 카테고리 페이지

표시 정보:

- 카테고리명
- 설명
- 서브카테고리 목록
- 해당 카테고리의 published 랭킹 목록

완료 기준:

- category slug로 접근 가능하다.
- 해당 카테고리의 랭킹만 보인다.
- 빈 상태가 표시된다.

---

### 5.3 서브카테고리 페이지

표시 정보:

- 상위 카테고리
- 서브카테고리명
- 설명
- 해당 서브카테고리의 published 랭킹 목록
- 관련 Facet 칩

완료 기준:

- subcategory slug로 접근 가능하다.
- Facet은 필터 UI가 아니라 보조 정보로 표시한다.
- 랭킹 클릭 시 상세 페이지로 이동한다.

---

### 5.4 랭킹 상세 페이지

표시 정보:

- 제목
- 요약
- 랭킹 유형
- Scope
- Facet 칩
- 선정 기준
- 출처/근거 메모
- 순위표
- 각 순위별 아이템
- 각 아이템 선정 이유
- 아이템 상세 링크
- 최종 업데이트일

완료 기준:

- `ranking_entries.position` 순서대로 표시된다.
- 각 entry의 reason이 보인다.
- ranking_criteria가 보인다.
- ranking_sources는 있으면 보이고 없어도 페이지가 깨지지 않는다.
- draft 상태의 랭킹은 공개 URL에서 보이지 않는다.

---

### 5.5 아이템 상세 페이지

표시 정보:

- 아이템명
- 설명
- 이미지
- item_type
- 브랜드/제작자
- 관련 Facet
- 외부 링크
- 제휴 링크
- 이 아이템이 포함된 랭킹 목록

완료 기준:

- item slug로 접근 가능하다.
- 해당 아이템이 포함된 published 랭킹만 보인다.
- 랭킹 목록 클릭 시 랭킹 상세로 이동한다.

---

## Phase 6. 관리자 기본 CMS 구현

### 목표

관리자가 랭킹 재료를 만들 수 있게 한다.

### 관리자 라우트

```txt
/admin
/admin/categories
/admin/subcategories
/admin/facets
/admin/items
```

---

### 6.1 관리자 대시보드

표시 정보:

- 총 카테고리 수
- 총 아이템 수
- 총 랭킹 수
- draft 랭킹 수
- published 랭킹 수
- 빠른 이동 링크

완료 기준:

- admin 접근 가능
- 일반 유저 접근 불가
- 주요 관리 페이지로 이동 가능

---

### 6.2 Category/Subcategory 관리

필수 기능:

- 목록
- 생성
- 수정
- 공개 여부 변경
- slug 자동 생성 또는 직접 입력

완료 기준:

- 새 카테고리/서브카테고리를 만들 수 있다.
- slug 중복 시 에러를 보여준다.
- 생성한 항목이 공개 페이지에 반영된다.

---

### 6.3 Facet 관리

필수 기능:

- facet_group 목록
- facet_group 생성
- facet 생성
- facet 수정
- group별 facet 표시

완료 기준:

- brand/form/purpose/platform/genre/status를 만들 수 있다.
- item과 ranking 생성 시 facet을 선택할 수 있다.
- Facet은 카테고리 트리를 대체하지 않는다.

---

### 6.4 Item 관리

필수 기능:

- 목록
- 생성
- 수정
- item_type 선택
- 관련 Facet 연결
- 외부 링크/제휴 링크 입력
- status 변경

완료 기준:

- 아이템 생성 가능
- 아이템 수정 가능
- Facet 연결 가능
- 랭킹 엔트리에서 검색/선택 가능
- 아이템 상세 페이지 생성

---

## Phase 7. 랭킹 작성 CMS 구현

### 목표

관리자가 랭킹 문서를 만들고 순위표를 구성할 수 있게 한다.

### 저장 원칙

랭킹 편집은 여러 테이블을 함께 수정하므로 가능한 한 서버 측 action 또는 route handler에서 일괄 처리한다.

특히 다음 작업은 부분 저장 실패에 주의한다.

```txt
ranking 기본 정보 수정
ranking_facets 갱신
ranking_criteria 갱신
ranking_sources 갱신
ranking_entries 갱신
```

P0에서 완전한 DB transaction이 어렵다면, 최소한 다음 원칙을 지킨다.

- 저장 전 서버 측 validation을 먼저 수행한다.
- 실패 시 사용자에게 명확한 에러를 보여준다.
- 기존 데이터를 덮어쓰기 전에 필수값과 중복값을 확인한다.
- entry/criteria/facet 갱신 중 일부만 반영되는 상태를 최대한 피한다.

### 관리자 라우트

```txt
/admin/rankings
/admin/rankings/new
/admin/rankings/[id]/edit
```

---

### 7.1 랭킹 목록

표시 정보:

- 제목
- 상태
- 카테고리
- 서브카테고리
- 랭킹 유형
- 엔트리 수
- 업데이트일
- edit 링크
- preview 링크

완료 기준:

- draft/published 랭킹을 모두 볼 수 있다.
- 상태별 구분이 가능하다.
- 새 랭킹 생성으로 이동 가능하다.

---

### 7.2 랭킹 기본 정보 작성

입력 정보:

- title
- slug
- category
- subcategory
- summary
- body
- ranking_type
- scope_json
- featured
- seo_title
- seo_description

완료 기준:

- draft 랭킹 생성 가능
- 필수값 validation
- category/subcategory 정합성 validation
- slug 중복 validation
- scope_json 입력 또는 UI 기반 구성 가능

P0에서는 scope_json을 단순 JSON textarea로 시작해도 된다.

---

### 7.3 Ranking Facet 연결

입력 정보:

- 관련 facet 다중 선택

완료 기준:

- ranking_facets row가 저장된다.
- ranking 상세에 facet 칩이 표시된다.
- scope_json과 ranking_facets는 완전히 동일하지 않아도 되지만, 의미가 충돌하지 않게 관리자가 확인할 수 있어야 한다.

---

### 7.4 Ranking Criteria 관리

입력 정보:

- 기준명
- 기준 설명
- 가중치
- 정렬 순서

완료 기준:

- 랭킹별 criterion을 1개 이상 추가할 수 있다.
- criterion 없는 상태에서 발행 시 경고 또는 차단한다.
- 공개 상세에 기준이 표시된다.

---

### 7.5 Ranking Sources 관리

입력 정보:

- label
- url
- source_type
- note
- is_public

완료 기준:

- source는 선택 입력이다.
- source가 없어도 발행 가능하다.
- source가 있으면 공개 상세에 표시할 수 있다.
- is_public=false면 공개 페이지에는 노출하지 않는다.

---

### 7.6 Ranking Entry 편집

필수 기능:

- 아이템 검색
- 아이템 추가
- 아이템 즉석 생성
- 순위 입력
- 선정 이유 입력
- 점수 선택 입력
- 내부 메모 선택 입력
- 스폰서 여부 필드 유지
- 삭제
- 순위 변경

완료 기준:

- ranking_entries 1개 이상 생성 가능
- position 중복 방지
- 같은 아이템 중복 추가 방지
- position 순서대로 공개 페이지에 표시
- 각 entry reason이 공개 페이지에 표시
- sponsor_flag는 P0에서 UI 표시까지 강제하지 않아도 된다

---

## Phase 8. 미리보기/발행 플로우 구현

### 목표

draft 랭킹을 검수한 뒤 published 상태로 전환한다.

---

### 8.1 Preview

라우트 후보:

```txt
/admin/rankings/[id]/preview
```

표시 방식:

- 공개 랭킹 상세와 거의 동일한 UI
- draft도 관리자에게만 보임
- 누락 필수값 경고 표시

완료 기준:

- draft 랭킹을 공개 전 확인 가능
- 일반 사용자는 preview 접근 불가
- 누락 필수값이 보인다

---

### 8.2 Publish Validation

발행 전 필수 확인:

```txt
title 존재
category_id 존재
summary 존재
ranking_type 존재
scope_json 존재
ranking_entries 1개 이상
ranking_criteria 1개 이상
category/subcategory 정합성 통과
slug 중복 없음
```

선택:

```txt
ranking_sources
```

Publish validation은 반드시 서버 측에서 수행한다.

클라이언트 validation은 UX 보조용이며, 최종 발행 가능 여부는 server action 또는 route handler에서 다시 검증한다.

---

### 8.3 Publish

작업:

- status를 `published`로 변경
- published_at 설정
- 공개 URL 접근 가능
- 홈/카테고리/서브카테고리 목록에 노출

완료 기준:

- published 전에는 공개 페이지에서 접근 불가
- published 후 공개 페이지 노출
- unpublish 또는 archived 전환 가능하면 더 좋음

---

## Phase 9. QA / 검수 시나리오

### 목표

P0-Core가 실제로 작동하는지 검증한다.

---

### 9.1 DB 검수

확인:

```txt
categories row 존재
subcategories row 존재
facet_groups row 존재
facets row 존재
items row 존재
rankings row 존재
ranking_entries row 존재
ranking_criteria row 존재
ranking_facets row 존재
```

---

### 9.2 공개 페이지 검수

시나리오:

```txt
홈 접속
→ 대표/최신 랭킹 확인
→ 카테고리 페이지 이동
→ 서브카테고리 페이지 이동
→ 랭킹 상세 이동
→ 순위표 확인
→ 아이템 상세 이동
→ 포함된 랭킹 목록 확인
```

성공 기준:

- 404/500 없음
- 빈 상태 안내 정상
- draft 데이터는 공개되지 않음
- published 데이터만 공개됨

---

### 9.3 관리자 CMS 검수

시나리오:

```txt
관리자 로그인
→ 카테고리 생성
→ 서브카테고리 생성
→ Facet 생성
→ 아이템 생성
→ 랭킹 draft 생성
→ criteria 추가
→ ranking_entries 추가
→ 미리보기
→ published 발행
→ 공개 페이지 확인
```

성공 기준:

- 위 흐름이 끊기지 않는다.
- 중복 slug 에러가 표시된다.
- 순위 중복이 방지된다.
- 같은 아이템 중복 추가가 방지된다.
- 발행 필수값 누락 시 경고 또는 차단된다.

---

### 9.4 권한 검수

확인:

```txt
비로그인 → admin 접근 불가
일반 로그인 유저 → admin 접근 불가
admin 유저 → admin 접근 가능
비로그인 → published 공개 페이지 접근 가능
비로그인 → draft 접근 불가
일반 로그인 유저 → draft 접근 불가
```

---

### 9.5 빌드 검수

필수:

```txt
npm run lint
npm run build
```

프로젝트에 맞는 테스트 스크립트가 있으면 함께 실행한다.

---

## Phase 10. 문서화 / 배포 준비

### 목표

다른 에이전트나 사람이 이어받아도 흔들리지 않게 실행 방법을 문서화한다.

### README에 포함할 내용

```txt
프로젝트 실행 방법
환경변수 목록
Supabase migration 실행 방법
Seed 실행 방법
첫 admin 지정 방법
P0-Core 범위
P1/P2 제외 범위
관리자 발행 루프 검수 방법
```

### .env.example

필수 예시:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_BOOTSTRAP_EMAIL=
```

서비스 롤 키는 서버 전용으로만 사용해야 한다.

### 완료 기준

- 새 환경에서 실행 절차가 문서화됨
- seed 후 공개 페이지 확인 가능
- 첫 admin 지정 방법이 명확함
- P1/P2 기능을 실수로 구현하지 않도록 범위가 적혀 있음

---

## 11. 구현 금지 범위

P0-Core 작업 중 다음을 구현하지 않는다.

```txt
검색 페이지
반응 버튼
댓글 작성/관리
유저 투표
스폰서 판매 관리
크롤러
자동 랭킹 생성
복잡한 Facet 필터 UI
대댓글
신고/제재
랭킹 변경 이력 UI
결제
```

단, ERD상 확장을 막지 않는 필드나 테이블은 둘 수 있다.

예:

```txt
sponsor_flag
ranking_sources
metadata
score_json
```

---

## 12. 에이전트 작업 규칙

에이전트가 구현할 때 지켜야 할 규칙이다.

### 12.1 범위 고정

- Usecase 문서의 P0-Core만 구현한다.
- P1/P2 기능은 UI를 만들지 않는다.
- 필요한 경우 TODO 주석으로만 남긴다.

### 12.2 작은 단위로 작업

권장 작업 단위:

```txt
1. DB migration
2. Auth/admin 보호
3. Seed
4. 공개 조회
5. 공개 페이지
6. 관리자 기본 CRUD
7. 랭킹 CMS
8. preview/publish
9. QA
```

### 12.3 구현 후 보고 형식

각 작업 후 다음 형식으로 보고한다.

```txt
변경 파일
- path/to/file

구현 내용
- 무엇을 구현했는지

검수 결과
- 실행한 명령
- 성공/실패
- 남은 이슈

다음 추천 작업
- 다음 단계
```

### 12.4 추측 금지

불명확한 부분은 임의로 확장하지 않는다.

예:

```txt
댓글도 만들면 좋겠지 → 만들지 않는다.
검색도 필요하겠지 → P1로 둔다.
스폰서 영역도 미리 만들자 → 만들지 않는다.
크롤링 구조도 넣자 → 만들지 않는다.
```

---

## 13. P0-Core 최종 완료 기준

P0-Core는 다음 조건을 모두 만족하면 완료로 본다.

```txt
1. admin 사용자가 CMS에 접근할 수 있다.
2. 카테고리/서브카테고리/Facet/아이템을 만들 수 있다.
3. 랭킹 draft를 만들 수 있다.
4. 랭킹에 Scope와 기준을 입력할 수 있다.
5. 랭킹에 아이템을 순위별로 연결할 수 있다.
6. 각 순위별 선정 이유를 입력할 수 있다.
7. 미리보기에서 공개 상세 형태를 확인할 수 있다.
8. 필수값 검증 후 published로 발행할 수 있다.
9. published 랭킹이 홈/카테고리/랭킹 상세에 노출된다.
10. 아이템 상세에서 해당 아이템이 포함된 published 랭킹을 볼 수 있다.
11. draft 랭킹은 공개 페이지에 노출되지 않는다.
12. npm run build가 성공한다.
```

---

## 14. 최종 결론

랭킹위키 Implementation Plan v0.2의 핵심은 다음이다.

```txt
지금 구현할 것은 커뮤니티도, 크롤러도, 투표 시스템도 아니다.

관리자가 신뢰 가능한 랭킹 문서를 만들고,
그 랭킹을 기준·Scope·선정 이유와 함께 발행하며,
방문자가 공개 페이지에서 랭킹과 아이템을 탐색하는 흐름이다.
```

P0-Core 구현이 끝난 뒤에야 검색, 반응, 댓글, 관련 랭킹, 스폰서, 크롤링을 검토한다.
