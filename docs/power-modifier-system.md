# Motivation

Many cards have conditional power that depends on game state: adjacency to wards, number of allies in the cemetery, aura effects on nearby units, etc. These modifiers are card-specific and highly varied.

Without a system, each card's logic would be hardcoded in `getComputedPower()`, creating a growing switch/if chain that couples the engine to specific cards.

## Requirements

- Card-specific power modifiers must not require changes to `getComputedPower()` itself
- Support both self-modifiers (card's own power changes) and aura modifiers (card affects other units)
- Support conditional keywords (e.g. Angel Ascendant gains Airborne while Warded)
- Power must be recomputed dynamically as game state changes

# Design Considerations/Options considered

**Option A: Hardcoded switch in getComputedPower**
- Pros: Simple, direct
- Cons: Engine coupled to card data, grows linearly with card count

**Option B: Declarative power rules on card data**
- Pros: Data-driven, no code per card
- Cons: Complex DSL needed to express all conditions (adjacent ward, cemetery count, etc.)

**Option C: Imperative power modifier registry**
- Pros: Mirrors trigger/spell resolver pattern, each card is self-contained, no engine changes needed per card
- Cons: Logic lives outside data (same tradeoff as other registries)

# Decision

**Option C: Imperative power modifier registry** — consistent with the resolver registry pattern used for spells and triggers. Can migrate to declarative later alongside the card definition refactor.

# Implementation

## Architecture

```
powerModifiers.ts (registrations)
    |
    |-- registerPowerModifier(cardId, fn)     — self power bonus
    |-- registerAuraPowerModifier(cardId, fn)  — power bonus to OTHER units
    |
    |-- registerConditionalKeyword(cardId, fn) — conditional keyword grants

utils.ts (engine)
    |
    |-- getComputedPower() — calls self modifier + aura modifiers
    |-- hasKeyword()       — calls conditional keyword checker
```

## Self power modifiers

A `PowerModifierFn` receives the card instance and game state, returns `{ attack, defense }` bonus (can be negative).

```ts
registerPowerModifier('revered_revenant', (inst, state) => {
  // Has 0 power unless adjacent to an allied Ward
  // Base is 3, return -3 if no adjacent ward found
  if (adjacentToAlliedWard(inst, state)) return { attack: 0, defense: 0 };
  return { attack: -3, defense: -3 };
});
```

## Aura power modifiers

An `AuraPowerModifierFn` receives the source (aura holder), target (unit being evaluated), and state. Called for every unit on the board by `getComputedPower()`.

```ts
registerAuraPowerModifier('mayor_of_milborne', (source, target, state) => {
  // Other nearby Mortals have +1 power
  if (target === source) return { attack: 0, defense: 0 };
  if (!isNearbyMortal(source, target)) return { attack: 0, defense: 0 };
  return { attack: 1, defense: 1 };
});
```

## Conditional keywords

A `ConditionalKeywordFn` receives the instance and keyword being checked, returns true if the card has that keyword conditionally.

```ts
registerConditionalKeyword('angel_ascendant', (inst, keyword) => {
  // Has Airborne while Warded
  return keyword === 'airborne' && inst.tokens.includes('ward');
});
```

## Implemented modifiers (Savior deck)

| Card | Type | Effect |
|---|---|---|
| Revered Revenant | self | 0 power unless adjacent to allied Ward |
| Angel Ascendant | self + keyword | +1 power & Airborne while Warded |
| Search Party | self | +1 power per Search Party in cemetery |
| Faith Incarnate | self | +2 power per Ward in realm |
| Mayor of Milborne | aura | Other nearby Mortals have +1 power |

## Adding a new modifier

1. Import `registerPowerModifier` (or `registerAuraPowerModifier`, `registerConditionalKeyword`) from `utils.ts`
2. Add the registration call in `powerModifiers.ts`
3. The modifier is automatically picked up by `getComputedPower()` / `hasKeyword()`
