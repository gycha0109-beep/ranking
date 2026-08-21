# IA-2B — Semantic Projection Ingestion & Duplicate Advisory

## Decision

IA-2에서 만든 `ranking_semantic_projections`를 그대로 사용한다. 이번 단계에서는 새 ontology table, AI classifier, embedding, vector DB를 추가하지 않는다.

운영 흐름은 다음과 같다.

```text
RAW ranking
  ↓ optional admin review
reviewed semantic projection
  ↓ bounded same-Subject comparison
identity / duplicate advisory
```

Semantic projection은 계속 optional이다. Projection이 없으면 Ranking은 `unclassified`이며 저장·수정·발행이 정상적으로 가능하다.

## Ingestion contract

관리자 랭킹 편집 화면에서 별도의 IA-2B 패널을 제공한다.

입력 필드:

- `subject_key` — 필수 canonical subject key
- `intent_key` — 선택
- `method_key` — 선택
- `coordinates` — non-version open-world JSON object
- `version_coordinates` — snapshot/version JSON object

입력은 authored ranking 본문에 포함되지 않는다. `scope_json`도 수정하지 않는다.

저장 시 서버가 다음을 강제한다.

- 관리자 세션 확인
- key 정규화 및 허용 문자 검증
- JSON root object 검증
- 각 JSON 입력 8,000자 상한
- `classification_state = reviewed`
- `confidence = 1`
- `projection_version = ia-2b-admin-manual-v1`
- Claim/View/Version signature는 클라이언트가 정하지 않고 IA-2 DB trigger가 재계산

Public client에는 write 권한을 추가하지 않는다. 실제 write는 관리자 인증 후 server-only Supabase admin client로 수행한다.

## Unclassified is a first-class state

운영자는 projection을 삭제할 수 있다. 삭제는 Ranking 본문, status, `published_at`, entries, criteria, sources를 건드리지 않는다.

따라서 분류 오류가 생겨도 게시물을 삭제하거나 수정할 필요가 없다.

```text
classified → projection delete → unclassified
```

`분류 실패 = 게시 실패`는 여전히 금지된다.

## Duplicate advisory

현재 projection과 동일한 `subject_key` 안에서만 후보를 조회한다. 후보 수는 IA-2의 `SEMANTIC_SUBJECT_CANDIDATE_LIMIT`를 그대로 사용한다.

우선순위:

1. `same_version` — 같은 Claim + Method/View + Version. **중복 가능성 높음**
2. `same_view` — 같은 Claim + Method/View, 다른 Version
3. `same_claim` — 같은 Claim, 다른 Method/View
4. `same_subject` — 같은 Subject, 다른 조건

Advisory는 최대 12개만 UI에 노출한다.

중요: Advisory는 설명과 비교 링크만 제공한다. 같은 `version_signature`가 존재해도 저장·발행을 차단하지 않는다. DB signature에도 UNIQUE constraint를 추가하지 않는다.

## Current UX

IA-2B 패널은 `/admin/rankings/[id]/edit`에 위치한다.

- 현재 상태: `unclassified | inferred | reviewed`
- 좌표 편집
- reviewed projection 저장
- projection 해제
- identity/duplicate advisory 확인
- 관련 랭킹 편집 화면으로 이동

기존 Ranking E2E editor는 그대로 유지된다.

## Non-goals

- 자유 게시 폼에 semantic field 의무화
- title/body에서 자동 의미 추론
- AI/LLM/embedding 도입
- 자동 canonical ontology 승격
- 자동 병합
- 중복 게시 hard block
- Topic page / Ranking Space UI
- public user tagging workflow

## Follow-up boundary

다음 단계가 필요하다면 `unresolved raw label → canonical concept alias` 또는 deterministic suggestion을 별도로 검증한다. 그 단계에서도 suggestion과 publication authorization은 분리한다.
