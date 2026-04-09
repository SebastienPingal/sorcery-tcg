# Keyword Extraction Workflow

This project generates a runtime-ready card file from real card data, with keywords extracted, caster metadata inferred, and manual edge-case overrides applied.

## What is extracted

The extractor currently detects:

- `airborne`
- `burrowing`
- `charge`
- `deathrite`
- `disable`
- `genesis`
- `immobile`
- `lance`
- `lethal`
- `ranged`
- `spellcaster`
- `stealth`
- `submerge`
- `voidwalk`
- `ward`
- `waterbound`
- `flooded`

The generator also infers per-card caster metadata:

- `casterChoicePolicy`:
  - `auto`: resolve caster automatically
  - `require_choice`: ask player to pick caster on realm
  - `custom`: card uses non-standard caster eligibility
- `casterEligibility` filter rules (default spellcaster; custom inferred for known text patterns)

Runtime note:

- The engine does not infer caster eligibility from raw rules text at runtime.
- Caster behavior comes from generated card fields (`casterChoicePolicy`, `casterEligibility`) plus manual overrides.

## Source files

- Raw source: `src/data/realCards.ts`
- Generator script: `scripts/generate-usable-cards.mjs`
- Manual edge-case overrides: `src/data/usableCardOverrides.json`
- Generated runtime file: `src/data/usableCards.ts`
- Registry integration: `src/data/cards.ts`
- Regression tests: `src/data/keywordExtraction.test.ts`

## How it works

1. Read `REAL_CARDS` from `src/data/realCards.ts`.
2. Extract keywords from each card text (`rulesText`, `abilities[].description`) with regex patterns.
3. Merge and deduplicate extracted keywords with existing structured keywords.
4. Infer caster metadata (`casterChoicePolicy`, `casterEligibility`) from card text rules.
5. Apply manual patches from `src/data/usableCardOverrides.json`.
6. Write final cards to `src/data/usableCards.ts`.
7. Runtime uses `USABLE_CARDS` directly via `src/data/cards.ts`.

## When new cards are added

1. Add or refresh cards in `src/data/realCards.ts`.
2. Run:

```bash
pnpm generate:usable-cards
pnpm test -- src/data/keywordExtraction.test.ts
```

3. If a keyword is missing or incorrectly detected:
   - update/add a pattern in `KEYWORD_PATTERNS` inside `scripts/generate-usable-cards.mjs`
   - add a test case that covers the exact phrase style from new cards
4. Re-run tests.

5. For one-off edge cases, add overrides in `src/data/usableCardOverrides.json` and regenerate.
   - This is the preferred way to adjust `casterChoicePolicy` or `casterEligibility` per card.

## Notes for future contributors

- Keep patterns conservative (word boundaries) to avoid false positives.
- Prefer explicit tests for known card phrases that are easy to regress.
- If a new official keyword appears in rules, add it to:
  - `KeywordAbility` in `src/types/index.ts`
  - `KEYWORD_PATTERNS` in `scripts/generate-usable-cards.mjs`
  - keyword extraction tests
