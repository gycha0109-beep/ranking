# IA-2K — Independent Semantic Anchor Feasibility Audit

## Verdict

**NO_SAFE_AUTOMATIC_INDEPENDENT_ANCHOR_FOUND**

IA-2K audits whether the current RankingWiki data model already contains an independent signal that can safely distinguish:

1. the same semantic ranking question expressed differently, from
2. a genuinely new ranking question over familiar entities.

This Stage is evidence-only. It does not change ranking creation, publication, semantic projection ingestion, Alias behavior, public discovery, or the IA-2J quarantine.

## Authority

- Starting main: `172d11fc17949db075f15c6001d3c08f87309cb8`
- IA-2H rejected context helper blob: `ae6edc3086280324c7537f7afe14b1e08a2ef5c7`
- Frozen lexical matcher blob: `49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47`
- Sealed IA-2I holdout blob: `b748a118fa527c376f12db31ce43291270c8c13a`
- Hosted project: `yjdubukqkcvkymabskzd`
- Hosted projected rankings observed: `13`
- Reviewed Alias rows observed: `0`

The hosted read-only observations are frozen in `tests/ia-2k/hosted-anchor-audit.json`.

## Hosted pairwise observations

Across the 13 projected rankings:

| Observation | Count |
| --- | ---: |
| Same-Subject pairs | 8 |
| Same-Subject pairs with the same `method_key` | 8 |
| Same-Subject pairs with different `coordinates` | 8 |
| Same-Subject pairs with different ranking criteria | 8 |
| Different-Subject pairs | 70 |
| Same subcategory + same intent but different Subject | 1 |
| Same subcategory + same method but different Subject | 1 |

The single concrete collision is:

```text
world-population-2024-top-5
world-nominal-gdp-2024-top-5
```

Both use:

```text
subcategory = the same world-country metrics subcategory
intent_key = metric-comparison
method_key = world-bank-wdi
```

but their Subjects are correctly distinct:

```text
world-country-population
world-country-nominal-gdp
```

Therefore `subcategory + intent + method` is not sufficient Subject identity authority.

## Why exact Coordinates or criteria are also unsafe

All eight existing same-Subject pairs differ in both Coordinates and ranking criteria.

Examples:

### PISA

One Subject:

```text
pisa-country-performance
```

but Coordinates deliberately vary:

```text
domain = mathematics
domain = reading
domain = science
```

and criteria vary correspondingly.

### KBO

One Subject:

```text
kbo-team-season-performance
```

but Coordinates deliberately vary:

```text
metric = batting-average
metric = era
metric = winning-percentage
```

and criteria are `팀 타율`, `팀 평균자책점`, and `승률`.

### Korea migration

One Subject spans both:

```text
direction = net-inmigration
direction = net-outmigration
```

### FIFA

One Subject spans:

```text
team_gender = men
team_gender = women
```

Exact Coordinate or criterion equivalence would therefore fragment Subject concepts that the current IA-2 architecture intentionally models as one broader Claim with varying semantic coordinates.

## Signal decision matrix

| Candidate signal | Finding | Authority allowed |
| --- | --- | --- |
| Item overlap / Item neighborhood | IA-2I showed 20/20 false exposures for new questions over familiar Items | Neighborhood/candidate context only |
| Subcategory | Multiple semantic questions can inhabit one subcategory | No Subject authority |
| `intent_key` | `metric-comparison` spans distinct Subjects | No Subject authority |
| `method_key` | GDP and population share `world-bank-wdi` but are distinct Subjects | Supporting context only |
| Exact Coordinates | Every observed same-Subject pair changes Coordinates | Too narrow |
| Exact criteria | Every observed same-Subject pair changes criteria | Too narrow |
| Title/summary lexical content | Useful only through the already validated high-precision lexical matcher; broader semantic equivalence is not independently established | Existing lexical matcher only |
| Reviewed Alias | Explicit human-reviewed equivalence is semantically authoritative by design | Safe, but current Hosted rows = 0 |

## Architectural conclusion

The existing data contains useful context but no second automatic signal that is both:

1. broad enough to recover semantic surface variants, and
2. selective enough to preserve the open-world new-Subject invariant.

The evidence therefore does **not** justify re-enabling the IA-2H graph-only fallback, combining Item overlap with `method_key`, or promoting criteria/Coordinates to exact Subject identity rules.

This is not evidence that a semantic anchor is impossible. It is evidence that **the currently available fields do not provide one with demonstrated safety**.

## Operational boundary

The current production state must remain:

```text
IA-2H_OPERATIONAL_FALLBACK = QUARANTINED
LEXICAL_SUGGESTION = ACTIVE_UNCHANGED
REVIEWED_ALIAS = AVAILABLE
NEW_SUBJECT_PATH = ACTIVE_UNCHANGED
PUBLICATION_SEMANTICS = UNCHANGED
```

A future semantic-equivalence mechanism must not be activated merely because it improves recall. It must independently prove that familiar Items, shared methods, or related coordinates do not cause new ranking questions to be collapsed into existing Subjects.

## Next evidence direction

The safest next step is not another automatic heuristic. It is to accumulate **reviewed semantic equivalence evidence** through the existing Alias/manual governance path and measure actual operator decisions.

That evidence can later answer:

- which surface variants operators repeatedly map to an existing Canonical Subject,
- which apparently similar phrases are deliberately kept as new Subjects,
- whether recurrent equivalence patterns justify a future deterministic rule,
- and whether any future semantic model has a real labeled evaluation set instead of synthetic intuition alone.

No global ontology, embedding/vector system, LLM classifier, automatic merge/remap, or publication block is authorized by IA-2K.

## Stage status

```text
IA-2K_FEASIBILITY_AUDIT = COMPLETE
SAFE_EXISTING_AUTOMATIC_ANCHOR = NONE_FOUND
IA-2H_REENABLE = FORBIDDEN
REVIEWED_ALIAS_AUTHORITY = PRESERVED
OPEN_WORLD_NEW_SUBJECT_PATH = PRESERVED
NEXT = REVIEWED_EQUIVALENCE_EVIDENCE_ACCUMULATION
```
