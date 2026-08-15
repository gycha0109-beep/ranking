# P1-3 검색·탐색 품질 개선 설계 리뷰

## 리뷰 결론

전역 검색, stable keyset, explicit popularity, Moderation hard boundary 방향은 타당하다. 다만 최초 설계안을 그대로 구현하면 SECURITY DEFINER leakage, 짧은 query full scan, fuzzy score 불안정, 과도한 search index, raw query logging 유혹, popularity 의미 불명확 문제가 생길 수 있다.

아래 보완을 구현 전 필수 조건으로 반영한다.

## 발견 사항과 보완

### 1. SECURITY DEFINER search leakage

검색 함수가 engagement aggregate를 직접 읽기 위해 SECURITY DEFINER를 사용하면 기존 RLS가 자동 안전망이 되지 않는다.

보완:

- ranking/item union 각 branch에 공개 status + text moderation + image moderation을 직접 반복한다.
- category/subcategory-derived match는 visible 분류만 반영한다.
- facet 자체는 공개 metadata이지만 hidden content 연결에서 score가 파생되지 않게 content 공개 조건을 먼저 고정한다.
- 반환 column을 고정하며 `SELECT *`를 사용하지 않는다.
- direct table grant를 추가하지 않는다.
- 함수 EXECUTE만 anon/authenticated에 허용한다.
- Hosted에서 hidden exact-match fixture를 필수 검증한다.

### 2. search path hardening

SECURITY DEFINER에서 mutable schema를 무심코 search path에 두면 name shadowing 위험이 있다.

보완:

- object는 `public.`, `private.`, `extensions.`로 명시한다.
- 함수 search path는 최소화한다.
- pg_trgm operator/function도 가능한 한 extension schema를 명시한다.

### 3. 짧은 query와 trigram

2자 이하 query는 충분한 trigram을 만들지 못해 broad `%query%`가 index 효과를 잃을 수 있다.

보완:

- normalized length 2만 허용하는 별도 short-query path를 둔다.
- short path는 title/brand/item type/category/subcategory/facet exact 또는 prefix만 사용한다.
- summary/body/description substring과 fuzzy는 3자 이상에서만 사용한다.
- 0~1자는 DB RPC를 호출하지 않는다.

### 4. combined document similarity 희석

title+body를 합친 긴 document 전체에 단순 `similarity()`를 적용하면 긴 body 때문에 title typo가 희석될 수 있다.

보완:

- generated `search_text` GIN은 candidate broad filtering에 사용한다.
- ranking title, item title, brand 등 주요 field의 `word_similarity()`를 별도로 score한다.
- exact/prefix/substr tier가 fuzzy 보조치보다 항상 우선한다.

### 5. float cursor 안정성

`similarity()`의 실수 값을 cursor key로 직접 쓰면 표현·버전 차이에 취약하다.

보완:

- relevance를 integer로 정규화한다.
- `round(word_similarity * 9999)` 범위만 fuzzy 보조치로 사용한다.
- cursor에는 integer score를 저장한다.

### 6. popularity 가중합의 정당성

views와 likes를 임의 가중치로 합치면 왜 그 수치가 맞는지 설명할 근거가 없다.

보완:

- composite score를 만들지 않는다.
- `unique_view_count DESC → like_count DESC → time DESC → ID` lexicographic contract를 사용한다.
- popularity metric은 engagement telemetry가 아니라 사용자 노출 정렬 기준이며 원본 viewer 식별정보를 사용하지 않는다.

### 7. likes/view aggregate 직접 노출

`content_likes.user_id`, daily viewer hash는 검색과 무관하고 민감도가 높다.

보완:

- search RPC 내부에서 count/total만 읽는다.
- result에는 숫자 aggregate만 반환한다.
- raw event/table 직접 SELECT 권한은 현행 그대로 유지한다.

### 8. too many trigram indexes

모든 text field에 개별 GIN을 만들면 write cost와 storage가 불필요하게 커진다.

보완:

- content table은 generated `search_text`당 GIN 1개씩만 둔다.
- category/subcategory/facet은 name lookup용 최소 index만 둔다.
- field-specific exact/prefix scoring은 후보 집합 안에서 계산한다.

### 9. category/facet reverse lookup

현행 join table PK는 content ID가 선두라 facet에서 content로 역탐색할 때 비효율적이다.

보완:

- `(facet_id, ranking_id)`와 `(facet_id, item_id)` index를 추가한다.

### 10. unbounded category pages

검색만 추가하고 기존 category list를 그대로 두면 P1-3이 탐색 성능 문제를 남긴다.

보완:

- category/subcategory list도 bounded RPC + keyset으로 전환한다.
- page size 20, DB max 50을 강제한다.

### 11. offset pagination

offset은 concurrent insert가 있을 때 중복·누락이 발생하고 deep page 비용도 커진다.

보완:

- relevance/latest/popular 모두 keyset을 사용한다.
- 모든 order에 UUID 최종 tie-break를 둔다.

### 12. related recommendation 의미 변경 위험

P1-3 검색과 추천을 한꺼번에 재랭킹하면 기존 wiki connection 의미가 바뀐다.

보완:

- priority/match count/date 의미는 그대로 둔다.
- 마지막 ID tie-break만 추가하여 결정성만 개선한다.

### 13. 홈 공개 count의 RLS 의존

anon RLS가 현재 숨김을 막더라도 application query가 moderation 조건을 생략하면 계약이 불명확하다.

보완:

- 홈 count query에도 explicit moderation/image moderation 조건을 추가한다.

### 14. “최근 업데이트” 용어

현재 query는 `published_at DESC`다.

보완:

- P1-3에서는 UI를 “최근 발행”으로 맞춘다.
- updated-at sort는 별도 기능으로 만들지 않는다.

### 15. raw query logging

검색 품질 개선 과정에서 query log를 곧바로 저장하면 PII가 telemetry에 축적될 수 있다.

보완:

- P1-3은 raw query를 저장하지 않는다.
- 별도 analytics schema가 필요하면 privacy/retention 설계를 먼저 한다.

### 16. 다국어 범위 과장

trigram은 문자 기반 유사도이므로 언어별 형태소 의미를 이해하는 검색은 아니다.

보완:

- P1-3의 다국어 지원 표현은 “한글·영문·숫자 character-level normalization/search”로 제한한다.
- 형태소·동의어·번역 recall 개선은 후속 단계다.

### 17. Hosted production corpus 부족

현재 public ranking 1건, item 6건으로는 planner와 relevance 품질을 증명할 수 없다.

보완:

- transaction rollback synthetic fixture를 사용한다.
- 운영 row를 수정하지 않는다.
- fixture 잔여 0을 검증한다.

## 최종 구현 조건

1. SECDEF 함수 내부 explicit public predicate
2. fixed/minimal search path + schema qualification
3. 2자 short-query path 분리
4. exact/prefix tier가 fuzzy보다 우선
5. integer relevance cursor
6. popularity 가중합 금지
7. aggregate만 반환, raw engagement 미노출
8. content search GIN 최소화
9. facet reverse index
10. category/subcategory bounded keyset
11. 모든 sort UUID final tie-break
12. recommendation은 ID tie-break만 변경
13. home count explicit moderation
14. “최근 발행” 용어 정합
15. raw query log 금지
16. multilingual claim 제한
17. Hosted rollback fixture
