# IA-2 — Ranking Identity & Coordinate Architecture

## Decision

랭킹 작성 원본은 계속 자유 형식으로 유지한다. 의미 좌표는 작성 요구사항이 아니라 **게시 이후에도 붙이거나 수정할 수 있는 optional semantic projection**이다.

```text
RAW RANKING (authoritative authored artifact)
  title / summary / body / entries / criteria / sources / scope_json
        ↓ optional post-hoc interpretation
SEMANTIC PROJECTION
  Subject + Intent + Coordinates + Method/View + Version Coordinates
        ↓
DISCOVERY / IDENTITY
  Claim → Method/View → Version + semantic neighborhood
```

`분류 실패 = 게시 실패`가 되어서는 안 된다. Projection row가 없으면 해당 Ranking은 단순히 `unclassified`이며 기존 검색·카테고리·IA-1 discovery 경로를 그대로 사용한다.

## Why `scope_json` is not reused

`rankings.scope_json`은 현재 후보 범위와 방법론을 설명하는 authored/public methodology contract다. IA-2 semantic coordinates는 검색·중복 감지·연관 탐색을 위한 system interpretation이므로 별도 저장한다. Semantic projection을 수정해도 authored scope가 바뀌지 않아야 한다.

## Projection contract

`ranking_semantic_projections`는 Ranking당 최대 1개의 현재 projection을 갖는다.

- `subject_key`: 무엇에 관한 랭킹인가. 사람이 읽는 제목이 아니라 canonical slug-like key.
- `intent_key`: 추천, 공식 순위, 비교 등 질문의 의도.
- `coordinates`: 시간/버전을 제외한 open-world qualifier JSON object. 예: `{"season":"summer","audience":"20s"}`.
- `method_key`: 같은 Claim을 어떤 산정 방식/View로 보여주는지.
- `version_coordinates`: 날짜, 시즌, cycle 등 snapshot/version 차원.
- `classification_state`: `inferred | reviewed`.
- `confidence`: 0..1.
- `projection_version`: classifier/review vocabulary version.

Coordinates의 key 집합은 고정 enum이 아니다. 새로운 조건은 자유롭게 등장할 수 있다. 다만 raw user string이 자동으로 canonical ontology가 되는 것은 아니며, classifier/review vocabulary가 정규화 책임을 가진다.

## Identity hierarchy

세 단계 signature는 모두 **non-unique**다. 동일 signature가 다른 Ranking에 존재해도 발행을 막지 않는다.

1. `claim_signature` = Subject + Intent + non-version Coordinates
2. `view_signature` = Claim + Method/View
3. `version_signature` = View + Version Coordinates

의미:

- same `version_signature`: 같은 랭킹 정의·같은 시점. duplicate warning 후보지만 hard block 아님.
- same `view_signature`: 같은 랭킹 시리즈의 다른 시점/version.
- same `claim_signature`: 같은 질문의 다른 산정 방식/view.
- same `subject_key`: 같은 주제의 다른 조건.

## Discovery safety

Semantic projection은 `reviewed`이거나 machine confidence가 최소 `0.90` 이상일 때만 IA-2 discovery 관계를 만든다. 낮은 confidence projection은 저장할 수 있지만 관련 랭킹을 강제로 연결하지 않는다.

IA-2 semantic candidate source는 같은 `subject_key`로만 제한하고 bounded limit를 적용한다. Candidate가 semantic relation으로 인정되지 않더라도 기존 IA-1 contextual gate(Item Jaccard + title lexical Jaccard)를 통과하면 기존 방식으로 관계를 유지할 수 있다.

## Public visibility

Projection 자체는 공개 Ranking의 discovery metadata만 읽을 수 있다. RLS는 Ranking의 `published` 및 moderation/image moderation public visibility를 그대로 상속한다. Anonymous/authenticated client에는 SELECT만 허용하고 write 권한은 주지 않는다.

## Seed policy

현재 Production의 13개 published metric Ranking은 제목과 기존 `scope_json`이 명확히 지지하는 범위에서만 deterministic seed projection을 추가한다. Seed는 `inferred` 상태이며 Ranking의 제목·본문·순위·출처·발행 상태를 변경하지 않는다.

## Explicit non-goals

- 사용자가 게시 폼에서 Subject/Coordinate를 의무 입력하게 만들지 않는다.
- AI/embedding/vector DB를 도입하지 않는다.
- global ontology registry를 이번 단계에서 만들지 않는다.
- signature 중복을 UNIQUE constraint로 막지 않는다.
- semantic projection으로 authored title/body/scope를 자동 수정하지 않는다.
- Topic 페이지나 생성형 랭킹 UI를 이번 단계에서 만들지 않는다.

## Future stages

후속 단계에서는 `unresolved qualifier → proposed concept → canonical dimension/value` lifecycle, near-duplicate warning, exact/nearest coordinate search, Topic projection을 별도 검증할 수 있다. 이때도 RAW ranking과 semantic interpretation의 분리는 유지한다.
