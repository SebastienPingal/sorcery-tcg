# Agent Instructions

This repository has extensive documentation in `docs/`.

## Mandatory doc-first workflow

Before implementing any prompt, identify the feature or system it touches and read the corresponding document(s) in `docs/` first.

- If the prompt is about spell effects, read `docs/spell-resolver-system.md`.
- If the prompt is about triggers (Genesis/Deathrite), read `docs/trigger-resolver-system.md`.
- If the prompt is about power calculations or aura bonuses, read `docs/power-modifier-system.md`.
- If the prompt is about filtering, targeting, placement, or caster eligibility, read `docs/predicate-system.md`.
- If the prompt is about keyword extraction/generation, read `docs/keyword-extraction-workflow.md`.
- If the prompt is about card-structure migration/refactor, read `docs/card-definition-refactor.md`.
- If the prompt is about Savior deck completion status, read `docs/savior-deck-status.md`.

When no single doc clearly matches, scan `docs/` and use the closest relevant documentation before coding.