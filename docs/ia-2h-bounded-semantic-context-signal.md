# IA-2H — Bounded Semantic Context Signal

## Purpose

IA-2G confirmed that the frozen lexical Subject matcher retains very high selective precision but reaches a recall ceiling on genuinely different semantic surface forms. IA-2H does not broaden fuzzy text matching. It adds one narrowly bounded Item-graph fallback for cases where the lexical matcher abstains.

## Authority

- Starting main: `4f6d195c1568d082725fbd569743870eb39d90e1`
- Frozen lexical matcher blob: `49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47`
- Next.js remains `16.3.1`; it was still the npm `latest` line when IA-2H started.

The lexical matcher remains unchanged. IA-2H is a second-stage advisory signal, not a replacement matcher.

## Safety contract

A context fallback may be shown only when all of the following hold:

1. the normalized Subject input has at least two characters,
2. there is no exact reviewed Alias match,
3. the existing deterministic lexical matcher returns no candidate,
4. the current ranking has a non-null subcategory and at least two Item identities,
5. a prior projection is in the same subcategory,
6. that prior ranking shares at least two Items with the current ranking,
7. Item Jaccard is at least `0.25`,
8. the same Canonical Subject is independently supported by at least two qualifying prior rankings,
9. no competing Subject has even one qualifying Item-neighborhood support.

If any condition fails, IA-2H abstains.

Constants:

```text
SUBJECT_CONTEXT_MIN_SHARED_ITEMS = 2
SUBJECT_CONTEXT_MIN_ITEM_JACCARD = 0.25
SUBJECT_CONTEXT_MIN_SUPPORTING_RANKINGS = 2
SUBJECT_CONTEXT_SUGGESTION_LIMIT = 1
```

## Why repeated consensus is required

Hosted data already contains a concrete collision: `world-country-nominal-gdp` and `world-country-population` share the same subcategory and three of five Item identities. Therefore shared Items alone cannot establish Subject identity.

IA-2H requires repeated support from two separate rankings under one Subject. A single competing Subject is enough to force abstention. This preserves the open-world rule that a new ranking over familiar entities may still express a new semantic concept.

## Hosted retrospective feasibility audit

Before implementation, the proposed rule was evaluated leave-one-out against the 13 existing semantic projections. This is retrospective feasibility evidence, not an independent benchmark.

- Correct context recovery: `6 / 13`
- Incorrect context recovery: `0 / 13`
- Recovered groups: three `pisa-country-performance` rankings and three `kbo-team-season-performance` rankings
- `world-country-nominal-gdp` / `world-country-population`: abstained because each had only one supporting ranking
- FIFA, migration, UNESCO and singleton world metrics: abstained because repeated Item-neighborhood consensus was absent

This demonstrates that the signal is intentionally sparse. It is useful only after a repeated local graph has emerged.

## UX contract

The original semantic editor remains authoritative. IA-2H adds a bounded fallback advisory alongside it and watches the existing Subject input. The fallback becomes visible only after the lexical matcher returns zero suggestions.

Selecting the context candidate only writes the Canonical key into the existing Subject input. It does not save the projection, create an Alias, merge Subjects, publish content, or mutate ranking data. The administrator must still explicitly save through the existing reviewed-projection path.

The operator may always ignore the fallback and save a **새 Subject** unchanged. Context evidence never turns a reuse suggestion into a requirement.

Because the existing finalized-decision evidence contract validates lexical suggestions server-side, an IA-2H fallback selection is currently finalized as ordinary `existing` Canonical reuse rather than being reclassified as a lexical `suggestion`. IA-2H does not weaken the IA-2D evidence contract merely to attribute this new UI assist.

## Data and access boundaries

IA-2H introduces no database table or migration. Its server action is admin-only and read-only. Candidate inputs are bounded:

- semantic projections: max 500
- candidate ranking entries: max 5000
- current ranking Items: max 100

Only discovery-eligible semantic projections contribute. Archived rankings are excluded from context support.

## Explicit non-goals

IA-2H does not introduce:

- embeddings or vector search,
- LLM/AI semantic classification,
- a global ontology or closed taxonomy,
- automatic Alias creation,
- automatic Subject merge/remap,
- publication blocking,
- public taxonomy pages,
- broader fuzzy-string thresholds.

The governing invariant remains:

> 사용자는 자유롭게 랭킹을 만들고, 시스템은 충분히 반복된 관계만 사후적으로 제안한다.
