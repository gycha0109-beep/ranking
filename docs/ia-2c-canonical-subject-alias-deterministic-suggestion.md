# IA-2C — Canonical Subject Alias & Deterministic Suggestion

## Goal

IA-2C reduces accidental Subject fragmentation without turning semantic classification into an authoring gate.

The governing rule remains:

> A ranking may remain unclassified, and a new reviewed Subject may be created freely. Existing canonical Subjects are suggested for reuse, not required.

## Why this stage exists

IA-2B made reviewed semantic projection operational, but an admin still had to remember canonical keys manually. Over time equivalent keys such as `mens-fragrance`, `male-fragrance`, or `men-perfume` could fragment one semantic cluster.

IA-2C adds only the minimum governance layer needed to reduce that drift:

1. derive Canonical Subject candidates from Subjects already used by real projections,
2. rank reuse suggestions deterministically from canonical keys and reviewed aliases,
3. allow an admin to register an exact alternate key as an alias of an existing canonical Subject,
4. resolve exact alias matches during reviewed projection save,
5. continue allowing a completely new Subject when no alias mapping exists.

## Storage contract

`public.ranking_semantic_subject_aliases` is a small reviewed mapping:

- `alias_key` — normalized alternate Subject key,
- `canonical_subject_key` — the chosen canonical key,
- `created_by`, `created_at` — governance provenance.

It is intentionally **not** a closed Subject registry. `canonical_subject_key` is not a foreign key to a taxonomy table.

The table is admin/server-only. `anon` and `authenticated` receive no privileges.

## Canonical candidate source

Canonical Subject suggestions come from actual `ranking_semantic_projections.subject_key` usage plus canonical targets that are retained by reviewed alias mappings.

This means structure follows content. IA-2C does not require creating every possible Subject in advance.

## Deterministic suggestion contract

Suggestions are AI-independent. The browser ranks a bounded set of current canonical options using normalized lexical signals:

- exact match,
- prefix match,
- substring match,
- token overlap,
- trigram Dice similarity,
- current usage count as a deterministic tie-breaker.

At most five suggestions are shown. No embedding, vector database, external model, or probabilistic classifier is required.

A suggestion has no write effect until the admin explicitly selects it or explicitly creates an alias.

## Alias creation guards

Alias creation is reviewed and reversible. The server rejects:

- invalid semantic keys,
- `alias_key = canonical_subject_key`,
- an alias key already used as a real Canonical Subject by a projection,
- alias chains where the requested canonical target is itself an alias,
- a canonical target that has never existed as a real projection Subject and is not already retained as a canonical alias target,
- remapping an existing alias to a different canonical target without first removing it.

These guards prevent cycles and ambiguous normalization without introducing a global ontology.

## Save semantics

When a reviewed projection is saved:

1. the entered Subject key is normalized,
2. an exact alias lookup is performed,
3. if an alias exists, its canonical key is stored in `ranking_semantic_projections.subject_key`,
4. otherwise the entered normalized key is stored unchanged.

Therefore a new Subject remains possible at all times unless the exact key has already been explicitly reviewed as an alias.

## Non-blocking publication contract

IA-2C must never:

- add a mandatory semantic field to `rankings`,
- require an alias or an existing Canonical Subject before projection save,
- require a projection before ranking save or publication,
- make duplicate or Subject suggestions a publication hard block,
- automatically publish, archive, merge, or delete a ranking,
- automatically rewrite existing projections when an alias is removed.

`분류 실패 = 게시 실패` remains forbidden.

## Alias removal

Removing an alias affects future exact resolution only. Existing projections already stored under the canonical key are not reverse-migrated. Any semantic correction to existing projections remains an explicit reviewed operation.

## Deferred work

IA-2C does not add:

- a global Topic/Subject ontology,
- hierarchical broader/narrower relations,
- automatic Korean title interpretation,
- AI classification,
- embedding similarity,
- bulk Subject merges,
- automatic reclassification of existing rankings.

Those are separate decisions that require observed product need.
