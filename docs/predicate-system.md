# Universal Predicate System

A composable, registry-based predicate engine used to validate game rules declaratively. The same system powers caster eligibility, minion placement restrictions, and (in the future) spell targeting, ability targeting, and any other context that needs to answer "is this valid?".

## Architecture

```
Card data (declarative)          Engine (runtime)
─────────────────────           ─────────────────
PredicateRestriction   ──────>  evaluateRestriction(ctx, restriction)
  all / any / not                     │
    PredicateClause                   ├── resolveEntry() → name + params
      string | {predicate,params}     ├── registry.get(name) → PredicateFn
      | {group: nested restriction}   └── fn(ctx, params) → boolean
```

### Core types (`src/types/index.ts`)

| Type | Description |
|------|-------------|
| `PredicateEntry` | `string` (shorthand) or `{ predicate: string; params: Record<string, unknown> }` |
| `PredicateClause` | A `PredicateEntry` or `{ group: PredicateRestriction }` for nesting |
| `PredicateRestriction` | `{ all?, any?, not? }` — each is an array of `PredicateClause` |
| `PredicateContext` | Runtime context: `{ state, playerId, square?, instance?, card?, target? }` |

### Evaluation rules

- `all`: every clause must return `true`
- `any`: at least one clause must return `true` (empty = skip)
- `not`: every clause must return `false`
- Empty restriction `{}` passes by default
- Groups nest recursively: `{ group: { all: [...], not: [...] } }`

## Source files

- Types: `src/types/index.ts` (`PredicateEntry`, `PredicateClause`, `PredicateRestriction`, `PredicateContext`)
- Registry + evaluator + built-in predicates: `src/engine/predicates.ts`
- Integration helpers: `src/engine/utils.ts` (`canCasterCastCard`, `getEligibleSpellcasters`, `isValidMinionPlacement`)
- Selectors: `src/engine/selectors.ts` (`selectValidMinionPlacements`)
- Validation in cast flow: `src/engine/core/applyAtomicAction.ts` (inside `castSpell()`)
- Tests: `src/engine/tests/predicates.test.ts`

## Built-in predicates

### Instance predicates (evaluate `ctx.instance`)

Used for caster eligibility and unit evaluation.

| Name | Params | Description |
|------|--------|-------------|
| `spellcaster` | — | Is a spellcaster (keyword + element compatibility if `ctx.card` provided) |
| `has_keyword` | `{ keyword }` | Has the given keyword ability |
| `has_subtype` | `{ subtype }` | Minion has the given subtype (in subtypes array or typeLine) |
| `is_avatar` | `{ value? }` | Is (or is not, if `value: false`) an avatar |
| `is_minion` | — | Is a minion |
| `in_region` | `{ region }` | Instance is in the given region |
| `has_token` | `{ token }` | Instance has the given status token |
| `rules_text_matches` | `{ pattern }` | Rules text contains pattern (case-insensitive) |
| `is_friendly` | — | Controlled by `ctx.playerId` |
| `is_enemy` | — | Controlled by opponent |
| `is_tapped` | — | Is tapped |
| `is_untapped` | — | Is untapped |

### Target predicates (evaluate `ctx.target`)

Used for spell/ability targeting validation.

| Name | Params | Description |
|------|--------|-------------|
| `target_is_minion` | — | Target is a minion |
| `target_is_avatar` | — | Target is an avatar |
| `target_is_site` | — | Target is a site |
| `target_is_friendly` | — | Target controlled by player |
| `target_is_enemy` | — | Target controlled by opponent |
| `target_has_keyword` | `{ keyword }` | Target has keyword |
| `target_has_subtype` | `{ subtype }` | Target has subtype |
| `target_has_token` | `{ token }` | Target has status token |
| `target_in_region` | `{ region }` | Target is in region |
| `target_on_water_site` | — | Target is on a water site |

### Square predicates (evaluate `ctx.square`)

Used for placement restrictions and square targeting.

| Name | Params | Description |
|------|--------|-------------|
| `on_water_site` | — | Square has a water site |
| `on_land_site` | — | Square has a land (non-water) site |
| `on_void` | — | Square has no site |
| `column` | `{ columns: number[] }` | Square column is in the given list |
| `row` | `{ rows: number[] }` | Square row is in the given list |
| `on_owner_back_row` | — | Square is on the player's back row (player-relative) |
| `on_controlled_site` | — | Square has a site controlled by player |
| `on_enemy_site` | — | Square has a site controlled by opponent |
| `square_has_enemy_unit` | — | Square has at least one enemy unit |
| `square_has_friendly_unit` | — | Square has at least one friendly unit |
| `square_is_empty` | — | Square has no units |
| `adjacent_to_friendly_unit` | — | An adjacent square has a friendly unit |
| `adjacent_to_enemy_unit` | — | An adjacent square has an enemy unit |
| `site_has_element` | `{ element }` | Site on square provides the given element threshold |
| `adjacent_to_element` | `{ element }` | An adjacent site provides the given element |

## Usage on cards

### Caster eligibility (`BaseCard.casterEligibility`)

Replaces the old `CasterEligibilityRules` / `CasterFilter` system. If omitted, defaults to `{ all: ['spellcaster'] }`.

```typescript
// Any spellcaster (default behavior)
casterEligibility: { all: ['spellcaster'] }

// Only allied Mortals
casterEligibility: { all: [{ predicate: 'has_subtype', params: { subtype: 'Mortal' } }] }

// Spellcaster OR has 'marked' token, but NOT avatar
casterEligibility: {
  any: ['spellcaster', { predicate: 'has_token', params: { token: 'marked' } }],
  not: ['is_avatar'],
}
```

### Placement restrictions (`MinionCard.placementRestriction`)

Optional field. If omitted, no restriction (standard placement rules apply). The restriction is evaluated AFTER the standard checks (controlled site, region compatibility).

```typescript
// Only outer columns
placementRestriction: { all: [{ predicate: 'column', params: { columns: [0, 4] } }] }

// Water site with enemy unit
placementRestriction: { all: ['on_water_site', 'square_has_enemy_unit'] }

// Water site AND (enemy present OR outer column)
placementRestriction: {
  all: [
    'on_water_site',
    { group: {
      any: ['square_has_enemy_unit', { predicate: 'column', params: { columns: [0, 4] } }],
    }},
  ],
}
```

## Adding a new predicate

1. Open `src/engine/predicates.ts`
2. Call `registerPredicate` with a name and function:

```typescript
registerPredicate('my_new_check', (ctx, params) => {
  // ctx.state, ctx.playerId, ctx.square, ctx.instance, ctx.card, ctx.target
  // params: optional Record<string, unknown> from card data
  return /* boolean */;
});
```

3. Use it on card data:

```typescript
placementRestriction: { all: ['my_new_check'] }
// or with params:
placementRestriction: { all: [{ predicate: 'my_new_check', params: { foo: 42 } }] }
```

No changes needed to the evaluator, types, or game flow.

## Legacy format support

The evaluator also accepts the old `{ type: 'name', ...params }` format for backward compatibility with existing card data. This is resolved transparently in `resolveEntry()`. New code should use the canonical format (`string` or `{ predicate, params }`).

## How the engine uses it

### Caster eligibility (in `utils.ts`)

`canCasterCastCard(caster, card, state?)` builds a `PredicateContext` with `instance = caster` and evaluates the card's `casterEligibility` restriction.

`getEligibleSpellcasters(state, playerId, card)` filters all instances through `canCasterCastCard` plus basic checks (controlled, in realm, not disabled).

### Placement validation (in `utils.ts` and `applyAtomicAction.ts`)

`isValidMinionPlacement(state, playerId, card, cardInstance, square)` evaluates the card's `placementRestriction` if present.

Called inside `castSpell()` after the standard placement checks (site ownership, region compatibility).

`selectValidMinionPlacements(state, playerId, cardInstance)` in `selectors.ts` iterates the full board and returns all squares passing the restriction — for UI highlighting.
