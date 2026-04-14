# Motivation

Cards in Sorcery TCG each have unique effects described in their `rulesText`. The engine needs to resolve these effects at cast time, but encoding every card's logic into the `AbilityEffect` type union would:

- Bloat the type system with hundreds of one-off variants
- Require engine changes for every new card
- Couple card data tightly to the core engine

We need a scalable system that lets each card define its own resolution logic independently.

## Requirements

- Each card's effect must be implementable without modifying core engine types
- The UI must know what kind of target a spell expects (unit, site, none) so it can highlight valid targets
- The system must integrate with the existing caster selection flow (`pendingSpellcastChoice`)
- Must support the caster-first, target-second flow (target validity depends on caster position)

# Design Considerations/Options considered

Options considered:

**Option A: Expand AbilityEffect union** (one variant per card effect)
- How it works: Add `{ type: 'destroy_all_minions_at_site'; siteFilter: 'water'; maxRange: 2 }` etc. to `AbilityEffect`
- Pros: Fully type-safe, declarative
- Cons: Hundreds of variants, engine switch/case grows unbounded, every card requires a type change

**Option B: Declarative effect DSL** (composable primitives interpreted by a generic resolver)
- How it works: Cards declare targeting + effects as data, a generic interpreter executes them
- Pros: Data-driven, serializable, could support a card editor
- Cons: High upfront design cost, some cards inevitably won't fit the DSL, risk of a leaky abstraction

**Option C: Card-specific resolver registry** (imperative functions keyed by card ID)
- How it works: A registry maps card IDs to resolver functions, similar to the predicate registry. Each resolver defines its targeting requirements and resolution logic.
- Pros: Each card is self-contained, no type explosion, mirrors existing predicate pattern, easy to add cards, can be replaced by declarative approach later
- Cons: Logic lives outside data, resolvers aren't serializable

# Decision

**Option C: Card-specific resolver registry** (imperative, with migration path to declarative).

Rationale:
- Mirrors the proven `predicates.ts` registry pattern already in the codebase
- Ships cards immediately without upfront DSL design
- Each resolver is isolated and testable
- Can extract patterns into a declarative DSL later once we see what's common across many cards
- The `SpellTargeting` type already provides a declarative targeting layer that the UI consumes

# Implementation

## Architecture

```
spellResolvers.ts (registry)
    |
    |-- SpellTargeting: tells UI what to highlight
    |   - { type: 'none' }
    |   - { type: 'unit', filter? }
    |   - { type: 'site', validSquares(state, casterSquare) }
    |
    |-- SpellResolver: { targeting, resolve(state, casterId, targetSquare?, targetInstanceId?) }
    |
    |-- registerSpellResolver(cardId, resolver)
    |-- getSpellResolver(cardId)
```

## Flow for site-targeting magic (e.g. Boil)

1. Player selects card from hand
2. Store checks eligible casters
3. If multiple casters + `casterChoicePolicy: 'require_choice'` -> `pendingSpellcastChoice` (caster selection UI)
4. After caster resolved -> store checks `getSpellResolver(cardId)`
5. If resolver has `targeting.type === 'site'` -> compute `validSquares` from caster position -> enter `pendingMagicTarget`
6. RealmGrid highlights valid squares
7. Player clicks a highlighted square -> `confirmMagicTarget(square)` -> dispatches `CAST_SPELL`
8. Engine's `castSpell` checks resolver registry -> calls `resolver.resolve()` -> sends spell to cemetery

## Key files

- `src/engine/spellResolvers.ts` - Registry + built-in resolvers
- `src/engine/core/applyAtomicAction.ts` - Checks registry in magic resolution
- `src/store/gameStore.ts` - `pendingMagicTarget` state, `confirmMagicTarget`/`cancelMagicTarget` actions
- `src/components/Realm/RealmGrid.tsx` - `magic_target` highlight mode

## Adding a new card

```ts
// In spellResolvers.ts
registerSpellResolver('card_id', {
  targeting: {
    type: 'site',
    validSquares: (state, casterSquare) => {
      // return valid target squares based on caster position
    },
  },
  resolve: (state, casterId, targetSquare, targetInstanceId) => {
    // apply the effect, return error string or null
  },
});
```

Cards without a resolver fall back to the existing generic `deal_damage` ability loop.
