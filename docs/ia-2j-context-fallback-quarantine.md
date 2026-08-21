# IA-2J — Rejected Context Fallback Production Quarantine

## Status

**SAFETY REMEDIATION — IA-2H operational fallback quarantined.**

IA-2I independently demonstrated that the IA-2H repeated Item-neighborhood signal is unsafe as a standalone semantic Subject fallback. The signal recovered all 20 intended context-reuse cases but also exposed an existing Subject for all 20 novel rankings that deliberately reused a familiar Item universe.

Observed IA-2I safety result:

- `context_only_recoveries = 20`
- `context_false_exposures = 20`
- `novel_familiar_items exposure = 1.0`
- lexical + context selective precision = `0.6610169491525424`

The failure is architectural rather than a threshold calibration issue: the same entity set can support multiple unrelated ranking questions.

## Remediation

The Admin ranking edit route now freezes:

```text
IA_2H_CONTEXT_FALLBACK_QUARANTINED = true
```

While quarantined:

1. the server does not execute `getRankingSubjectContextSuggestions(id)` for the editor,
2. the editor does not mount `SemanticContextFallbackPanel`,
3. the existing IA-2C lexical Canonical Subject suggestion remains available,
4. reviewed Alias behavior remains available,
5. administrators may still create a completely new Subject,
6. projection save, publication, ranking content, and public discovery behavior are unchanged.

The IA-2H helper, action, UI component, documentation, and retrospective evidence remain in the repository for auditability. Quarantine is operational suppression, not evidence deletion.

## Why thresholds are not tuned

IA-2J does not increase Jaccard, shared Item count, or historical support requirements. Those controls cannot prove semantic identity. A new ranking can use the exact same Items and still ask a different question.

Therefore Item graph may remain a candidate-generation or neighborhood signal, but it cannot independently authorize Canonical Subject reuse.

## Re-enable boundary

The fallback must remain quarantined until a separate semantic-identity anchor is:

1. defined without relying on Item overlap alone,
2. evaluated against the sealed IA-2I `novel_familiar_items` failure class or a new independent holdout,
3. shown to preserve the open-world new-Subject path,
4. independently validated before operational activation.

No automatic merge/remap, global ontology, publication block, embedding model, or LLM classifier is introduced by IA-2J.

## Authority

- IA-2I evidence main: `1cce802dd11d436caa625cd723ded26793533d4e`
- IA-2I sealed fixture blob: `b748a118fa527c376f12db31ce43291270c8c13a`
- IA-2H frozen lexical matcher blob: `49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47`
- IA-2H rejected context helper blob: `ae6edc3086280324c7537f7afe14b1e08a2ef5c7`

```text
IA-2H_EVIDENCE = PRESERVED
IA-2H_OPERATIONAL_FALLBACK = QUARANTINED
LEXICAL_SUGGESTION = ACTIVE_UNCHANGED
NEW_SUBJECT_PATH = ACTIVE_UNCHANGED
PUBLICATION_SEMANTICS = UNCHANGED
```
