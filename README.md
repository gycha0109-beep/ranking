# 랭킹위키

랭킹위키는 다양한 주제의 순위를 축적하고, 각 랭킹의 범위·선정 기준·선정 이유를 공개하며, 검색·Facet 탐색·반응·댓글·사용자 투표를 결합하는 위키형 랭킹 아카이브입니다.

## Current lifecycle

**P1 COMPLETE / P2 ACTIVE** — P2-1 User Voting은 `SUCCESS / CLOSED`, P2-2 Ranking Change History & Vote Finalization을 진행 중입니다.

P2-1은 `user_vote` 랭킹의 계정 기반 1인 1표, 공개 aggregate, 수동 open/close, 제재 연동, moderation auto-close를 제공합니다.

P2-2는 닫힌 투표 라운드를 공식 순위로 원자적으로 확정하고, 변경 전/후 순위와 투표 스냅샷을 immutable revision으로 보존하며, 확정 불가능한 라운드를 사유와 함께 감사 가능한 방식으로 폐기하는 계약을 추가합니다.

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
- transactional ranking save infrastructure
- moderation review
- role/capability access control
- sanctions/appeals
- audit/security event/maintenance surfaces
- `user_vote` poll open/close control
- 닫힌 투표 라운드 결과 확정/폐기 및 revision 기록

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
- `user_vote` ranking account voting
- vote change/cancel while open
- public vote counts/percentages/current rank
- 공식 투표 확정 이력 조회

### User Voting V1
- `ranking_type='user_vote'` only
- manual `open | closed`
- public-safe candidates minimum 2 to open
- one selected item per authenticated account/ranking
- deterministic order: votes DESC → seed position ASC → item UUID ASC
- raw ballots hidden behind RPC-only access
- account suspension enforced through existing `engagement_write`
- first remaining ballot freezes authored ranking/candidate configuration
- moderation/publication controls remain available and may auto-close voting
- finalization/void consumes the completed round ballots only after immutable snapshot creation

### Ranking Change History / Vote Finalization
- immutable `ranking_revisions` / `ranking_revision_entries`
- `vote_finalization` and `vote_void` terminal revision types
- required operator reason and internal actor attribution
- before/after canonical positions and item label/reason snapshots
- finalization materializes deterministic vote order into `ranking_entries.position` atomically
- collision-free two-phase position permutation
- unusable moderated rounds can be audibly voided without canonical position changes
- raw revision tables are RPC-only; public history omits actor and ballot identities
- public detail shows recent official ranking-order history
- physical ranking deletion is blocked after revision history exists; archive remains available

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
- `user_vote` Ranking ItemList uses current vote-derived order; finalized rounds naturally converge to materialized canonical order

## 검증

```bash
npm run verify:p1-2
npm run verify:p1-3
npm run verify:p1-4
npm run verify:p1-5
npm run verify:p2-1
npm run verify:p2-2
npm run lint
npm run build
```

GitHub Actions는 위 gate를 동일 순서로 실행합니다.

## DB 변경 원칙

Persistent Hosted Supabase 변경은 repository migration으로만 관리하고 Hosted에는 migration action으로 적용합니다. 임의 persistent DDL을 SQL console에서 직접 수행하지 않습니다.

P2-1 repository migrations:

- `20260816010000_p2_1_user_voting.sql`
- `20260816011000_p2_1_vote_fk_indexes.sql`

P2-2 repository migration:

- `20260816020000_p2_2_ranking_history_vote_finalization.sql`

## P2 확정/보류 범위

1. User Voting — P2-1 `SUCCESS / CLOSED`
2. Ranking Change History / Vote Finalization — P2-2 active
3. Sponsor transparency/management — P2-3 planned
4. Launch Hardening — planned after P2-3
5. UI overhaul + deploy — planned after P2 closure
6. External data import / crawling — deferred until after deployment/operational need is confirmed

각 P2 stage는 별도 design/review/final-contract lifecycle을 거칩니다.
