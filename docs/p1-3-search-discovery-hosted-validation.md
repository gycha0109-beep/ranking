# P1-3 검색·탐색 품질 개선 Hosted 검증

## 1. Authority

- Hosted Supabase project: `yjdubukqkcvkymabskzd`
- 적용 전 마지막 migration: `20260801195052 p1_2_integration_sanction_enforcement`
- P1-3 적용 migration: `20260815005658 p1_3_search_discovery`
- 기존 P1-2 migration은 재실행하지 않았다.

## 2. Schema·extension 검증

확인 결과:

- `pg_trgm` version 1.6
- extension schema: `extensions`
- generated stored columns:
  - `rankings.search_text`
  - `items.search_text`
  - `categories.search_name`
  - `subcategories.search_name`
  - `facets.search_name`
- P1-3 index 9개 생성 확인
- trigram GIN index는 모두 `valid=true`, `ready=true`
- facet 전용 EXPLAIN에서 `idx_facets_p1_3_name_trgm` Bitmap Index Scan 확인

실제 ranking corpus가 2건뿐이라 ranking search EXPLAIN은 trigram보다 작은 public partial B-tree/Seq Scan을 선택한다. 이는 현재 corpus에서의 planner cost 선택이며 index invalid 상태가 아니다.

## 3. RPC·ACL 검증

`search_public_content`, `list_public_rankings`:

- `SECURITY DEFINER = true`
- volatility = `STABLE`
- `search_path = pg_catalog, pg_temp`
- anon execute = true
- authenticated execute = true
- PUBLIC execute = false

engagement raw table:

- anon `content_likes SELECT` = false
- authenticated `content_likes SELECT` = false
- anon `content_view_totals SELECT` = false
- authenticated `content_view_totals SELECT` = false
- service_role `content_view_totals SELECT` = true

`SET LOCAL ROLE anon` 상태에서 public search RPC 실제 호출도 성공했다.

## 4. Rollback behavior fixture

운영 데이터를 수정하지 않고 transaction fixture를 삽입한 뒤 전체 `ROLLBACK`했다.

검증 통과:

1. ranking relevance tier
   - title exact
   - title prefix
   - title substring
   - summary
   - body
2. category match
3. subcategory match
4. ranking facet match
5. item facet match
6. item title match
7. item brand match
8. item type match
9. item description match
10. 3자 이상 trigram typo
    - `galaxi` → `galaxy phone`
11. 2자 short-query path
    - title prefix 포함
    - summary-only 일치 제외
12. NFKC + case + whitespace normalization
13. `%` / `_` literal wildcard escape
14. `\\` literal escape
15. blocked ranking exact match 미노출
16. needs_review item exact match 미노출
17. popularity
    - unique views DESC
    - likes DESC
    - time/ID tie-break contract
18. search popular keyset continuation
19. category latest keyset continuation
20. subcategory popular order
21. subcategory popular keyset continuation
22. page overlap 0

## 5. Fixture residue

최종 확인:

- fixture categories = 0
- fixture subcategories = 0
- fixture facets = 0
- fixture rankings = 0
- fixture items = 0

테스트용 content view/like row도 transaction rollback으로 제거됐다.

## 6. 검증 중 운영 상태 복구 기록

### 6.1 사전 조사 중 ACL 역연산

P1-3 migration 적용 전 introspection SQL에 실수로 다음 문장이 포함되어 일시적으로 실행됐다.

`GRANT SELECT ON public.content_view_totals TO PUBLIC`

즉시 저장소 P1-2 권한 계약을 다시 확인하고 정확한 역연산만 수행했다.

`REVOKE SELECT ON public.content_view_totals FROM PUBLIC`

복구 후:

- anon SELECT = false
- authenticated SELECT = false
- service_role SELECT = true
- migration history 변화 없음

P1-3 migration에는 해당 grant가 포함되지 않는다.

### 6.2 planner synthetic corpus ANALYZE 통계 복구

1,000건 synthetic ranking corpus를 transaction rollback으로 넣고 planner를 확인하는 과정에서 transaction 내부 `ANALYZE public.rankings`의 planner 통계가 rollback 이후에도 1002건 추정치로 남았다.

실제 row는 계속 2건이었으며 운영 데이터 변경은 없었다.

실제 현재 데이터 기준으로 즉시 다음 maintenance command를 실행했다.

`ANALYZE public.rankings`

복구 확인:

- estimated rows = 2
- actual rows = 2

이후 synthetic planner 검증에는 `ANALYZE`를 사용하지 않았다.

## 7. Advisor 검토

### Security

P1-3 RPC/ACL 자체에서 신규 차단 사유는 확인되지 않았다.

### Performance

Advisor에는 기존 schema 전반의 다음 부채가 존재한다.

- 일부 unindexed foreign key
- 일부 RLS auth initplan 경고
- 기존 multiple permissive policy
- 기존 unused index

P1-3에서 새로 생성된 index도 아직 traffic이 없으므로 `unused_index` INFO로 나타난다. 현재 Hosted public corpus가 매우 작고 신규 index 사용 이력이 없는 상태이므로 삭제 사유로 보지 않는다.

위 기존 경고를 P1-3 범위에서 임의 수정하지 않는다.

## 8. Hosted gate 결론

**HOSTED_VALIDATION_PASSED_WITH_RECOVERED_TEST_SIDE_EFFECTS**

- migration 적용 성공
- schema/index/function/ACL 계약 일치
- 검색·정렬·Moderation·keyset behavior fixture 통과
- fixture residue 0
- 검증 과정에서 발생한 ACL/통계 부작용은 각각 즉시 원상복구 및 재검증 완료

다음 gate는 branch exact-head CI다.
