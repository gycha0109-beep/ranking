# 랭킹위키

랭킹위키는 다양한 주제의 순위를 축적하고, 각 랭킹의 범위·선정 기준·선정 이유를 공개하며, 검색·Facet 탐색·반응·댓글·사용자 투표를 결합하는 위키형 랭킹 아카이브입니다.

## Current lifecycle

**P1 COMPLETE / P2-1 CLOSED / P2-2 CLOSED / P2-3 CLOSED / OPS-1 CLOSED / CONTENT-1 CLOSED / CONTENT-2 CLOSED / CONTENT-3 CLOSED / CONTENT-4 CLOSED / UI-1 CLOSED / LAUNCH-1 CLOSED**

- P2-1 User Voting: `SUCCESS / CLOSED`
- P2-2 Ranking Change History & Vote Finalization: `SUCCESS / CLOSED`
- P2-3 Sponsor Transparency / Management: `SUCCESS / CLOSED`
- OPS-1 Production Content Operations / Editorial Quality: `SUCCESS / CLOSED`
- CONTENT-1 Verified Production Seed Batch: `SUCCESS / CLOSED`
- CONTENT-2 Production Editorial Expansion / Coverage Batch: `SUCCESS / CLOSED`
- CONTENT-3 Recurring Editorial Refresh / Revalidation Cadence: `SUCCESS / CLOSED`
- CONTENT-4 Production Coverage Expansion / Editorial Operating Cycle: `SUCCESS / CLOSED`
- UI-1 Public Experience Redesign & Launch Surface Consolidation: `SUCCESS / CLOSED`
- LAUNCH-1 Production Deployment & Launch Hardening: `SUCCESS / CLOSED`

P2-1은 `user_vote` 랭킹의 계정 기반 1인 1표, 공개 aggregate, 수동 open/close, 제재 연동, moderation auto-close를 제공합니다.

P2-2는 닫힌 투표 라운드를 공식 순위로 원자적으로 확정하고, 변경 전/후 순위와 투표 스냅샷을 immutable revision으로 보존하며, 확정 불가능한 라운드를 사유와 함께 감사 가능한 방식으로 폐기합니다.

P2-3는 협찬 주체와 ranking/item/placement 상업 관계를 정규화하고, 공개 disclosure·기간 상태·편집 영향·관리 capability·append-only audit를 제공하면서 sponsorship 존재 자체가 검색·투표·랭킹 계산에 자동 영향을 주지 않도록 분리합니다. 최종 근거는 `docs/p2-3-sponsor-transparency-implementation.md`를 기준으로 합니다.

OPS-1은 draft capture는 유연하게 유지하면서 공개 발행만 fail-closed 품질 계약으로 제한합니다. Scope, Criteria, 공개 근거 출처, 순위 연속성, 아이템 중복, 선정 사유, active item 상태, `TOP N` 제목과 실제 항목 수 일치를 DB와 관리자 UI에서 함께 검증합니다. 최종 근거는 `docs/ops-1-production-content-operations.md`를 기준으로 합니다.

CONTENT-1은 OPS-1 계약을 실제 Production 콘텐츠에 적용해 공식·공공 데이터 기반 랭킹 4개를 발행했고, 실제 콘텐츠에서 발견된 지표형 랭킹 의미/표시 문제를 `ranking_type='metric'`과 명시적 `score_json` 값으로 보강했습니다. 최종 근거는 `docs/content-1-verified-production-seed-batch.md`를 기준으로 합니다.

CONTENT-2는 기존 OPS-1/metric 계약을 새 도메인에 그대로 적용해 스포츠/KBO 3개와 문화·유산/UNESCO 1개 랭킹을 추가했습니다. 별도 schema/RPC 기능 추가 없이 카테고리 확장, canonical item 재사용, 반복 source-backed authoring, Production 검색/상세 노출을 검증했습니다. 최종 근거는 `docs/content-2-production-editorial-expansion.md`를 기준으로 합니다.

CONTENT-3는 공개 랭킹의 authoritative source 재검증을 구조화해 append-only 검증 이력, 다음 검증일, freshness 상태와 관리자 재검증 workflow를 추가했습니다. 최초 8개 공개 metric 랭킹을 모두 재검증했고 실제 stale 상태였던 UNESCO 세계유산 랭킹을 감지·교정했습니다. 최종 근거는 `docs/content-3-recurring-editorial-revalidation.md`를 기준으로 합니다.

CONTENT-4는 기존 OPS-1/metric/CONTENT-3 계약만으로 OECD PISA 3개와 FIFA 남녀 세계랭킹 2개를 추가해 서로 다른 source volatility와 canonical entity 의미를 반복 운영에서 검증했습니다. 별도 schema/RPC/application 기능 추가 없이 Production을 13개 공개 랭킹·42개 active item으로 확장했습니다. 최종 근거는 `docs/content-4-production-coverage-expansion.md`를 기준으로 합니다.

UI-1은 기존 P1/P2 데이터·검색·투표·SEO 계약을 변경하지 않고 public surface의 정보 구조와 responsive UI를 재설계했습니다.

LAUNCH-1은 실제 Vercel Production 배포, 환경/Auth/SEO/security hardening, 실제 Production browser/runtime acceptance, main-only Git deployment 정책, 반복 가능한 Production QA suite까지 검증하고 닫았습니다. 최종 근거는 `docs/launch-1-closeout.md`를 기준으로 합니다.

## 실행

```bash
npm ci
npm run dev
```

필수 환경변수는 `.env.example`을 기준으로 설정합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 secret
- `ADMIN_BOOTSTRAP_EMAIL` — **개발 환경 전용** 첫 관리자 bootstrap; Production에는 설정하지 않음
- `NEXT_PUBLIC_SITE_URL` — canonical/robots/sitemap 절대 URL의 production origin

`NEXT_PUBLIC_SITE_URL`이 없으면 Vercel의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용하고, 둘 다 없을 때만 local/CI를 위해 `http://localhost:3000`을 사용합니다. 실배포에서는 최종 production origin을 `NEXT_PUBLIC_SITE_URL`로 명시하는 것을 기준 계약으로 합니다.

## 현재 기능

### 관리자/발행
- Category/Subcategory/Facet/Item CMS
- Ranking draft/edit/preview/publish
- transactional ranking save infrastructure
- OPS-1 editorial readiness와 fail-closed publication quality gate
- published editorial field 수정 전 unpublish 요구
- ranking entry/criteria/source 변경 시 published parent 재검증
- `metric` 공식 지표 랭킹 생성/편집
- CONTENT-3 revalidation freshness 상태와 다음 검증일 표시
- append-only ranking revalidation 이력 조회/기록
- moderation review
- role/capability access control
- sanctions/appeals
- audit/security event/maintenance surfaces
- `user_vote` poll open/close control
- 닫힌 투표 라운드 결과 확정/폐기 및 revision 기록
- sponsor entity 관리
- sponsorship draft/publish/archive 관리
- ranking/item/placement sponsorship target 관리
- sponsorship normalized-authority readiness와 append-only audit 조회

### 공개 탐색
- 공개 홈/카테고리/서브카테고리
- ranking/item detail
- related rankings/items
- global `/search`
- relevance/latest/popular ordering
- Facet 다중 조합: 동일 그룹 OR, 다른 그룹 AND
- keyset pagination
- `metric` 랭킹의 `공식 지표` 라벨과 명시적 지표값 표시
- ranking/item 협찬·상업 관계 disclosure
- 협찬 관계 `upcoming / current / historical` 기간 상태 공개

### 참여
- likes
- bookmarks
- daily unique views
- comments/replies/edit/delete
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

### Sponsor Transparency / Management
- normalized `sponsors`, `sponsorships`, append-only `sponsorship_events`
- dedicated `sponsorship_manage` capability for admin/super_admin
- target type: ranking / item / ranking-placement
- relationship type, disclosure text, period, editorial influence scope/note 관리
- draft → published → archived lifecycle
- public-safe disclosure RPCs; internal note/actor/admin metadata 비공개
- public `upcoming / current / historical` disclosure state
- sponsored ranking publication requires a published ranking-level disclosure
- placement publication requires the ranking/item pair to exist
- ranking save cannot silently remove a published sponsored placement
- legacy `ranking_entries.sponsor_flag` is non-authoritative and true re-authoring is rejected
- sponsorship metadata does not automatically alter relevance/popular/latest ordering, canonical ranking positions, or vote aggregation
- integrated `sponsorship_change` audit stream/detail

### OPS-1 Editorial Quality
- incomplete draft/quick-create capture는 허용
- publish 시 title/category/summary 필수
- `scope_json.target / period / method` 모두 필수
- 공개 랭킹 최소 2개 entry
- entry item 중복 금지
- position은 `1..N` 연속·중복 없음
- 모든 entry에 공개 선정 사유 필요
- published ranking에는 active item만 허용
- 최소 1개 criterion 및 모든 criterion의 name/description 필수
- non-`user_vote` 랭킹은 최소 1개 검증 가능한 공개 source 필요
- Google/Bing/Naver/Daum 검색결과 및 YouTube results URL은 직접 근거 source로 인정하지 않음
- 제목의 명시적 `TOP N` / `탑 N`과 실제 entry 수 일치 강제
- 관리자 목록과 preview에서 readiness blocker 표시
- Moderation Gate와 P2-3 Sponsorship Gate는 OPS-1과 별도이며 우회되지 않음

### CONTENT-1 Verified Production Seed Batch
- 공식·공공 데이터 기반 Production 랭킹 4개 발행
- World Bank WDI 기반 `2024 명목 GDP TOP 5`, `2024 인구 TOP 5`
- 국가데이터처 기반 `2025 시도 순유입률 TOP 3`, `2025 시도 순유출률 TOP 3`
- `통계` 카테고리와 `세계` / `대한민국` 서브카테고리 추가
- 재사용 가능한 국가·지역 canonical item 추가
- `ranking_type='metric'` first-class 지원
- metric public label `공식 지표`
- metric entry는 rating-style `editor_score` 대신 명시적 `score_json.scores` 값 사용
- 4개 랭킹 모두 OPS-1 `editorial_ready=true`, blocker 0
- home/category/detail/search Production acceptance 완료

### CONTENT-2 Production Editorial Expansion
- Production 랭킹 4개 추가: KBO 3개, UNESCO 세계유산 1개
- `스포츠` / `문화·유산` top-level 카테고리와 `KBO` / `세계유산` 서브카테고리 추가
- KBO 구단 canonical item 8개 추가
- 기존 국가 item 재사용 + 이탈리아/프랑스/스페인 canonical item 추가
- 모든 CONTENT-2 랭킹은 `ranking_type='metric'`
- 20개 entry 모두 explicit `score_json.scores`, rating-style `editor_score` 0
- 4개 랭킹 모두 OPS-1 `editorial_ready=true`, blocker 0
- category/detail/search Production acceptance 완료
- 별도 schema/RPC migration 없이 기존 콘텐츠 계약의 cross-domain 재사용성 확인

### CONTENT-3 Recurring Editorial Refresh / Revalidation Cadence
- append-only `ranking_revalidations` authority
- outcome: `verified_unchanged / updated / source_changed / source_unavailable`
- freshness state: `never_reviewed / attention_required / overdue / due_soon / current`
- 마지막 검증시각과 다음 검증일 구조화
- 검증 시 현재 `ranking_sources` metadata snapshot 보존
- 관리자 랭킹 목록에서 freshness/다음 검증일 표시
- 랭킹별 재검증 결과 기록 및 이력 조회
- 최초 공개 metric 랭킹 8개 전체 revalidation 완료
- UNESCO stale snapshot 감지 후 이탈리아 `62건` 1위 / 중국 `61건` 2위로 OPS-1 절차를 거쳐 교정
- 최종 8개 공개 metric 랭킹 모두 latest freshness `current`

### CONTENT-4 Production Coverage Expansion / Editorial Operating Cycle
- Production metric 랭킹 5개 추가: OECD PISA 3개, FIFA 남녀 세계랭킹 2개
- `교육` top-level category와 `PISA` / `FIFA` subcategory 추가
- 16개 canonical entity 추가 + 기존 `japan` item 재사용
- PISA의 국가·경제 교육 시스템을 `country` / `economy`로 의미 분리
- FIFA 국가대표팀을 일반 국가와 분리된 gender-specific `sports_team` entity로 모델링
- 신규 25개 entry 모두 explicit `score_json.scores`, rating-style `editor_score` 0
- 5개 랭킹 모두 OPS-1 `editorial_ready=true`, blocker 0
- 신규 5개 모두 발행 시 CONTENT-3 최초 revalidation 기록과 source snapshot 생성
- PISA historical source는 저빈도, FIFA current source는 다음 공식 업데이트 직후 재검증 cadence 적용
- PISA/FIFA category/detail/search Production acceptance 완료
- 별도 schema/RPC/application 기능 추가 없이 기존 운영 계약의 반복 사용성 확인

### UI-1 public experience
- semantic light design tokens and shared public surfaces
- responsive public navigation with mobile menu
- content-first home
- desktop Facet/sidebar + mobile collapsible filters
- ranking detail prioritizes the ranking table before methodology
- item detail prioritizes ranking footprint
- compact engagement action bar
- voting presentation aligned to the public design system while preserving vote/finalization semantics
- ranking history timeline
- existing comment interaction logic preserved under the UI-1 public shell

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

## Production deployment contract

LAUNCH-1에서 확정한 production 배포 기준은 다음과 같습니다.

- Vercel Git deployment는 `main`만 허용하고 비-main branch/commit Preview deployment는 차단
- production deployment SHA가 authoritative `main` SHA와 일치
- Hosted Supabase project URL과 publishable/anon key 설정
- service role key는 서버 전용 환경변수로만 보관
- `ADMIN_BOOTSTRAP_EMAIL`은 Production에 설정하지 않음
- 최종 production origin을 `NEXT_PUBLIC_SITE_URL`에 설정
- 배포 후 home/categories/search/ranking/item/login/account/admin 핵심 route smoke
- likes/bookmarks/comments/voting/history/auth 핵심 interaction smoke
- `robots.txt`, `sitemap.xml`, canonical/noindex 실제 URL 검증
- Vercel runtime/build error 및 Supabase Auth/API 오류 점검
- 대표 public page의 automated accessibility acceptance와 cross-browser/mobile-emulated read-only QA

## 검증

```bash
npm run verify:p1-2
npm run verify:p1-3
npm run verify:p1-4
npm run verify:p1-5
npm run verify:p2-1
npm run verify:p2-2
npm run verify:p2-3
npm run verify:ops-1
npm run verify:content-1
npm run verify:content-3
npm run verify:ui-1
npm run verify:launch-1
npm run lint
npm run build
```

GitHub Actions는 위 gate를 동일 순서로 실행합니다.

## DB 변경 원칙

Persistent Hosted Supabase 변경은 repository migration으로만 관리하고 Hosted에는 migration action으로 적용합니다. 임의 persistent DDL을 SQL console에서 직접 수행하지 않습니다.

P2-1 repository migrations:
- `20260816010000_p2_1_user_voting.sql`
- `20260816011000_p2_1_vote_fk_indexes.sql`

P2-2 repository migrations:
- `20260816020000_p2_2_ranking_history_vote_finalization.sql`
- `20260816021000_p2_2_public_history_moderation_filter.sql`

P2-3 repository migrations:
- `20260818062000_p2_3_sponsor_transparency.sql`
- `20260818062100_p2_3_sponsor_audit_integration.sql`
- `20260818062200_p2_3_sponsor_fk_indexes.sql`
- `20260818062300_p2_3_disclosure_readiness.sql`

OPS-1 repository migrations:
- `20260819010000_ops_1_editorial_quality.sql`
- `20260819010100_ops_1_trigger_return_fix.sql`

CONTENT-1 repository migrations:
- `20260819020000_content_1_metric_ranking_type.sql`

CONTENT-3 repository migrations:
- `20260819030000_content_3_revalidation_cadence.sql`
- `20260819030100_content_3_rpc_permissions.sql`
- `20260819030200_content_3_actor_fk_index.sql`

CONTENT-2와 CONTENT-4는 DB schema/RPC migration을 추가하지 않았습니다. UI-1과 LAUNCH-1도 DB schema/RPC migration을 추가하지 않았습니다.

## 다음 로드맵

1. User Voting — P2-1 `SUCCESS / CLOSED`
2. Ranking Change History / Vote Finalization — P2-2 `SUCCESS / CLOSED`
3. Sponsor Transparency / Management — P2-3 `SUCCESS / CLOSED`
4. Production Content Operations / Editorial Quality — OPS-1 `SUCCESS / CLOSED`
5. Verified Production Seed Batch — CONTENT-1 `SUCCESS / CLOSED`
6. Production Editorial Expansion / Coverage Batch — CONTENT-2 `SUCCESS / CLOSED`
7. Recurring Editorial Refresh / Revalidation Cadence — CONTENT-3 `SUCCESS / CLOSED`
8. Production Coverage Expansion / Editorial Operating Cycle — CONTENT-4 `SUCCESS / CLOSED`
9. Public Experience Redesign — UI-1 `SUCCESS / CLOSED`
10. Production Deployment & Launch Hardening — LAUNCH-1 `SUCCESS / CLOSED`
11. Product Usage & Discovery Baseline / Real-User Validation Readiness — MEASURE-1 next: 현재 telemetry authority를 감사하고 QA/internal traffic과 실제 사용 신호를 구분할 수 있는 최소 측정 계약, search/discovery signal 공백, baseline KPI를 정의
12. External data import / crawling — 반복 운영에서 sourcing/normalization/update가 실제 병목으로 확인된 뒤 current-state/design부터 진행

현재 Production은 top-level category `5`개, visible subcategory `6`개, 검증 가능한 published ranking `13`개와 active item `42`개를 갖습니다. 13개 공개 랭킹 모두 OPS-1 readiness를 통과하고 있으며, CONTENT-4의 신규 5개에는 최초 CONTENT-3 재검증 기록과 다음 검증일이 설정되어 있습니다.

현재 저장된 engagement는 현 corpus의 실사용 baseline으로 보기 어렵습니다. 누적 unique view `169`는 2026-08-17~18의 이전 QA 대상에 집중되어 있고 `149`가 `best-chicken-breast`에 귀속됩니다. likes `1`, bookmarks `1`, comments `2` 역시 현재 corpus의 실제 수요를 판단하기에 충분하지 않습니다. 또한 structured search-query telemetry table은 현재 존재하지 않습니다. 따라서 다음 단계는 콘텐츠를 맹목적으로 더 늘리기보다 측정 authority와 discovery baseline을 먼저 확립합니다.

P2-4 성격의 external ingestion은 fetch → raw ingestion → normalize → dedupe → staging → admin review → canonical publish까지 별도 대형 subsystem이므로, 운영 병목 근거 없이 선행 구현하지 않습니다.

각 stage는 별도 design/review/final-contract/CI lifecycle을 거칩니다.