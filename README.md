# 랭킹위키

랭킹위키는 다양한 주제의 순위를 축적하고, 각 랭킹의 범위·선정 기준·선정 이유를 공개하며, 검색·Facet 탐색·반응·댓글을 결합하는 위키형 랭킹 아카이브입니다.

## Current lifecycle

**P1 COMPLETE** — P1-2 engagement/moderation, P1-3 global search/discovery, P1-4 Facet advanced discovery, P1-5 technical SEO/integration closure까지 구현·검증하는 단계입니다.

다음 제품 단계는 P2이며, 우선 후보는 User Voting입니다. P2의 스폰서, 변경 이력, 외부 데이터 import/crawling은 별도 설계·승인 없이 P1에 섞지 않습니다.

## 실행

```bash
npm ci
npm run dev
```

필수 환경변수는 `.env.example`을 기준으로 설정합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용
- `ADMIN_BOOTSTRAP_EMAIL` — 개발 환경의 첫 관리자 bootstrap 용도
- `NEXT_PUBLIC_SITE_URL` — canonical/robots/sitemap 절대 URL의 production origin

`NEXT_PUBLIC_SITE_URL`이 없으면 Vercel의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용하고, 둘 다 없을 때만 local/CI를 위해 `http://localhost:3000`을 사용합니다.

## 현재 기능

### 관리자/발행
- Category/Subcategory/Facet/Item CMS
- Ranking draft/edit/preview/publish
- transactional ranking save
- moderation review
- role/capability access control
- sanctions/appeals
- audit/security event/maintenance surfaces

### 공개 탐색
- 공개 홈/카테고리/서브카테고리
- ranking/item detail
- related rankings
- global `/search`
- relevance/latest/popular ordering
- Facet 다중 조합: 동일 그룹 OR, 다른 그룹 AND
- keyset pagination

### 참여
- likes
- bookmarks
- daily unique views
- comments
- comment reports
- notifications

### Technical SEO
- route-specific canonical metadata
- public ranking/item Open Graph/Twitter metadata
- category/subcategory canonical policy
- `/search` noindex
- Facet/sort/cursor browse variants noindex
- private/admin/account/login noindex
- public-safe `sitemap.xml`
- `robots.txt`
- Ranking `ItemList`/Breadcrumb JSON-LD
- generic Item `WebPage`/`Thing` JSON-LD

## 검증

```bash
npm run verify:p1-2
npm run verify:p1-3
npm run verify:p1-4
npm run verify:p1-5
npm run lint
npm run build
```

GitHub Actions는 위 gate를 동일 순서로 실행합니다.

## DB 변경 원칙

Persistent Hosted Supabase 변경은 repository migration으로만 관리하고 Hosted에는 migration action으로 적용합니다. 임의 persistent DDL을 SQL console에서 직접 수행하지 않습니다.

P1-5 Technical SEO 자체는 DB migration을 추가하지 않습니다.

## P2 후보 범위

- User Voting
- Ranking Change History
- Sponsor transparency/management
- External data import / crawling

P2 구현은 별도 design/review/final-contract lifecycle 이후 시작합니다.
