# Motivation

Many cards have effects that trigger on specific game events: entering the realm (Genesis) or dying (Deathrite). These triggers are card-specific and varied — a minion might ward an ally on entry, heal the player on death, or move to a specific location.

We need a system that:
- Fires triggers at the right moments in the game loop
- Allows each card to define its own trigger logic without modifying core engine types
- Scales to hundreds of unique trigger effects

## Requirements

- Genesis triggers fire after a card is placed on the board (minion summoned, site played)
- Deathrite triggers fire when a minion dies (before removal from board, so location is still valid)
- Only cards with the matching keyword (`genesis`, `deathrite`) should have their triggers checked
- The system must not block or require UI interaction (triggers resolve immediately)

# Design Considerations/Options considered

**Option A: Encode triggers in AbilityEffect union**
- Pros: Type-safe, declarative
- Cons: Same explosion problem as spell effects — hundreds of variants

**Option B: Imperative trigger resolver registry**
- Pros: Mirrors spell resolver pattern, each card is self-contained, no type changes needed
- Cons: Logic lives outside data

**Option C: Event bus / pub-sub**
- Pros: Decoupled, extensible to many event types
- Cons: Over-engineered for current needs, harder to debug ordering

# Decision

**Option B: Imperative trigger resolver registry** — consistent with the spell resolver pattern established for Boil. Can migrate to declarative later.

# Implementation

## Architecture

```
triggerResolvers.ts (registry)
    |
    |-- TriggerType: 'genesis' | 'deathrite' | 'end_of_turn' | 'on_strike'
    |-- TriggerResolverFn: (state, instance) => void
    |
    |-- registerTriggerResolver(cardId, triggerType, fn)
    |-- getTriggerResolver(cardId, triggerType)
    |
    |-- fireGenesis(state, instance)           — calls resolver if registered
    |-- fireDeathrite(state, instance)         — calls resolver if registered
    |-- fireEndOfTurn(state, playerId)         — iterates all units, calls resolvers
    |-- fireOnStrike(state, attacker, defender) — calls resolver with condition checks
```

## Integration points in applyAtomicAction.ts

- **Genesis for minions**: fired after the minion is placed on the board in `castSpell` (both void and normal summon paths)
- **Genesis for sites**: fired after the site is placed in `playSite` (affinity is re-computed after genesis for sites like Algae Bloom that add temporary threshold)
- **Deathrite**: fired at the start of `killUnit`, before the unit is removed from the board (so `instance.location` is still valid for effects that need it)
- **End of turn**: fired at the start of `advancePhase` when transitioning from main phase, before damage reset and temp counter cleanup
- **On strike**: fired after each successful strike in `resolveAttack` (melee and ranged), with card-specific condition checks (e.g. Rowdy Boys only fires vs Undead)

## Adding a new trigger

```ts
// In triggerResolvers.ts
registerTriggerResolver('card_id', 'genesis', (state, instance) => {
  // instance is already on the board at this point
  // apply the effect directly to state
});

registerTriggerResolver('card_id', 'deathrite', (state, instance) => {
  // instance.location is still valid (not yet removed)
  // apply the effect directly to state
});
```

## Shared helpers

- `applyWard(inst)` — adds the `ward` status token
- `healPlayer(state, playerId, amount)` — heals respecting Death's Door and maxLife
- `getMinionsAtSquare(state, sq)` / `getAlliedMinionsAtSquare` / `getEnemyMinionsAtSquare` — convenience filters

## Implemented triggers (Savior deck)

| Card | Trigger | Effect |
|---|---|---|
| Virgin in Prayer | genesis | Ward nearest un-warded allied minion |
| Nightwatchmen | genesis | Ward the site they're placed on |
| Town Priest | genesis | Return adjacent Evil enemy minion to hand |
| Guardian Angel | genesis | Fly to weakest allied minion, ward it |
| Blessed Village | genesis | Site enters play with Ward |
| Blessed Well | genesis | Site enters play with Ward |
| Algae Bloom | genesis | Provides temporary Air/Earth/Fire affinity this turn |
| Autumn Bloom | genesis | Provides temporary Air/Fire/Water affinity this turn |
| Muddy Pigs | deathrite | Controller heals 3 |
| Malakhim | end_of_turn | Untap |
| Survivors of Serava | end_of_turn | Gain Stealth if no enemies nearby |
| Rowdy Boys | on_strike | Untap after striking Undead |

## Note on keyword gating

Genesis and deathrite triggers no longer check `hasKeyword()` before firing. If a resolver is registered for a card, it fires regardless of whether the card has the keyword in its `keywords` array. This is necessary because some card types (sites) don't have a `keywords` field.

## Temporary affinity via counters

Site genesis triggers that grant temporary affinity (Algae Bloom, Autumn Bloom) use the `instance.counters` record with `temp_air`, `temp_earth`, `temp_fire`, `temp_water` keys. These are:
- Read by `computeAffinity()` in `utils.ts`
- Cleared at end of turn in `advancePhase()` (any counter key starting with `temp_`)

## Future trigger types

The `TriggerType` union can be extended with:
- `'start_of_turn'` — periodic triggers at turn start
- `'on_damage'` — when taking damage
- `'on_defend'` — when defending in combat
- `'on_move'` — movement triggers (e.g. Flame of the First Ones)
