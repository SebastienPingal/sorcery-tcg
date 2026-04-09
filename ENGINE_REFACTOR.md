# Game Engine Refactor — Design Document

## Goals

- Decompose all game actions into the most granular atomic actions possible
- Game state is pure serializable data; the UI is a read-only projection of it
- Event sourcing: the action log is the source of truth; state can be rebuilt by replaying it
- Enable save/load of games
- Enable undo at player decision boundaries, locked on information reveal
- Support triggered abilities via a FIFO trigger queue (no player reactions)
- Engine is a standalone TypeScript module, decoupled from React and the store

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  React UI                    │  reads GameState, dispatches PlayerActions
├─────────────────────────────────────────────┤
│               Zustand Store                  │  bridges UI ↔ engine, holds UI-only state
├─────────────────────────────────────────────┤
│            Engine Orchestrator               │  receives PlayerAction, runs the pipeline
├──────────────┬──────────────────────────────┤
│  Composite   │  Trigger Queue (FIFO)        │  PlayerAction → AtomicAction[]
│  Resolvers   │  no player reactions         │  triggers fire after each mutation
├──────────────┴──────────────────────────────┤
│            Atomic Action Applier             │  (state, action) => state
├─────────────────────────────────────────────┤
│          Event Log  /  Undo Stack            │  append-only log + snapshots
├─────────────────────────────────────────────┤
│                 GameState                    │  plain JSON-serializable data
└─────────────────────────────────────────────┘
```

### Pipeline (per Player Action)

```
PlayerAction received
  │
  ├─ 1. decompose → AtomicAction[]
  │       (composite resolver; sequence may contain SELECT_TARGET / SELECT_SQUARE)
  │
  ├─ 2. run all CHECK_* first (dry-run, no state change) → abort entire sequence if any fails
  │
  ├─ 3. push GameState snapshot → undo stack
  │
  ├─ 4. for each remaining AtomicAction:
  │       ┌─ if SELECT_TARGET or SELECT_SQUARE:
  │       │     store remaining sequence in pendingInteraction (serializable)
  │       │     return state to UI → wait for player input
  │       │     [on cancel]  → restore snapshot, clear sequence
  │       │     [on confirm] → fill resultKey, resume from here
  │       └─ else (mutation):
  │             a. apply mutation → new GameState
  │             b. append to event log
  │             c. if action.type ∈ INFORMATION_REVEALING_ACTIONS → undoStack.lock()
  │             d. check trigger registry → enqueue triggered effects
  │
  ├─ 5. drain trigger queue (FIFO):
  │       for each queued trigger:
  │         decompose → AtomicAction[]
  │         run same pipeline (no new undo snapshot)
  │         loop detection: drop if (sourceId, triggerType, targetId) already seen this chain
  │         cascading triggers are allowed (no depth limit)
  │
  └─ 6. return final GameState → store updates UI
```

---

## Key Data Types

```ts
type Region   = 'surface' | 'underground' | 'underwater' | 'void';
type PlayerId = string;

interface Square   { row: number; col: number }
interface Location { square: Square; region: Region }
// A Location fully identifies where a unit is — square + which level of that square.
// Burrowing steps: { same square, 'underground' }. Airborne: diagonal square, 'surface'. Etc.

interface UnitStats {
  attackPower:  number;          // used as DEAL_DAMAGE amount when this unit strikes
  defensePower: number;          // CHECK_MINION_DEATH threshold (damage >= defensePower → dies)
  movement:     number;          // total steps available (base 1 + Movement +X)
  keywords:     KeywordAbility[];
}
// computeStats(id, state) is the single read point — aggregates:
//   1. base card value (power: number → both equal; power: { attack, defense } → split)
//   2. modifiers from passive abilities of all in-play permanents
//   3. modifiers from state.floatingEffects targeting this unit
// Avatars: attackPower from card.attackPower; no defensePower (they lose life, not damage tokens).

interface Modifier {
  stat:      'attackPower' | 'defensePower' | 'both_power' | 'movement';
  operation: 'add' | 'set';
  amount:    number;
}

interface FloatingEffect {
  id:                string;
  targetId:          string;
  modifier:          Modifier;
  expiresAfterTurns: number;   // decremented by TICK_FLOATING_EFFECTS; removed at 0
  ownerPlayerId:     PlayerId;
}
// GameState gains: floatingEffects: FloatingEffect[]

type PendingInteraction =
  | { type: 'select_target'; prompt: string; conditions: TargetCondition[];
      resumeSequence: AtomicAction[] }
  | { type: 'select_square'; prompt: string; conditions: SquareCondition[];
      resumeSequence: AtomicAction[] }
  | { type: 'choose_draw'; playerId: PlayerId }
  | { type: 'mulligan';    playerId: PlayerId }
  | null;
```

---

## Atomic Actions

An `AtomicAction` is either a **check** (validates a condition, throws on failure — no state change) or a **mutation** (modifies state, appended to event log).

Checks are run as a dry-run pass before any mutation is applied; a single failure aborts the whole sequence.

### Checks

```ts
type CheckAction =
  | { type: 'CHECK_IS_ACTIVE_PLAYER';       playerId: PlayerId }
  | { type: 'CHECK_PHASE';                  phase: Phase }
  | { type: 'CHECK_HAS_MANA';               playerId: PlayerId; amount: number }
  | { type: 'CHECK_ELEMENTAL_THRESHOLD';    playerId: PlayerId; threshold: ElementalThreshold }
  | { type: 'CHECK_CARD_IN_HAND';           playerId: PlayerId; instanceId: string }
  | { type: 'CHECK_NOT_TAPPED';             instanceId: string }
  | { type: 'CHECK_NO_SUMMONING_SICKNESS';  instanceId: string }
  | { type: 'CHECK_UNIT_ON_BOARD';          instanceId: string }
  | { type: 'CHECK_ABILITY_USABLE';         instanceId: string; abilityId: string }
  | { type: 'CHECK_SQUARE_HAS_SITE';        square: Square }
  | { type: 'CHECK_SQUARE_CONTROLLED';      square: Square; playerId: PlayerId }
  | { type: 'CHECK_LOCATION_VALID';         location: Location; conditions: LocationCondition[] }
  | { type: 'CHECK_LOCATION_REACHABLE';     unitId: string; location: Location }
  | { type: 'CHECK_TARGET_VALID';           targetId: string; conditions: TargetCondition[] }
  | { type: 'CHECK_NOT_AT_DEATHS_DOOR';     playerId: PlayerId }
  | { type: 'CHECK_CAN_ENTER_REGION';       instanceId: string; region: Region }
  // 'underground' → Burrowing required  → else DESTROY_UNIT on entry
  // 'underwater'  → Submerge required   → else DESTROY_UNIT on entry
  // 'void'        → Voidwalk required   → else BANISH on entry
  // Used as a pre-flight check; the actual hazard consequence is a mutation applied mid-MOVE_UNIT.
```

### Mana

```ts
  | { type: 'PAY_MANA';          playerId: PlayerId; amount: number }
  | { type: 'GAIN_MANA';         playerId: PlayerId; amount: number }
  | { type: 'CLEAR_MANA';        playerId: PlayerId }
  | { type: 'COMPUTE_MANA_POOL'; playerId: PlayerId }   // recount from controlled sites
  | { type: 'COMPUTE_AFFINITY';  playerId: PlayerId }   // recount elemental thresholds
```

### Card Zones

```ts
  | { type: 'MOVE_CARD_TO_HAND';        instanceId: string; playerId: PlayerId }
  | { type: 'MOVE_CARD_FROM_HAND';      instanceId: string }
  | { type: 'MOVE_CARD_TO_CEMETERY';    instanceId: string }
  | { type: 'MOVE_CARD_TO_DECK_TOP';    instanceId: string; deck: 'atlas' | 'spellbook' }
  | { type: 'MOVE_CARD_TO_DECK_BOTTOM'; instanceId: string; playerId: PlayerId;
      deck: 'atlas' | 'spellbook' }
  | { type: 'DRAW_CARD';                playerId: PlayerId; deck: 'atlas' | 'spellbook' }
  // ⚠ information-revealing → locks undo
  | { type: 'SHUFFLE_DECK';             playerId: PlayerId; deck: 'atlas' | 'spellbook' }
  | { type: 'PEEK_DECK';                playerId: PlayerId; deck: 'atlas' | 'spellbook';
      count: number; resolvedIds: string[] }
  // resolvedIds computed once at decomposition time → deterministic replay
  // ⚠ information-revealing → locks undo
  | { type: 'REORDER_DECK_TOP';         playerId: PlayerId; deck: 'atlas' | 'spellbook';
      order: string[] }
  | { type: 'FORCE_DISCARD';            playerId: PlayerId; instanceId: string | 'random' }
  | { type: 'REVEAL_HAND';              playerId: PlayerId }
  // ⚠ information-revealing → locks undo
  | { type: 'BANISH';                   instanceId: string; from: 'board' | 'cemetery' | 'hand' }
  // removed from game entirely — does NOT go to cemetery
```

### Board — Units

```ts
  | { type: 'PLACE_UNIT';  instanceId: string; location: Location }
  // For 2×2 units: location is the anchor; engine derives all 4 occupied locations.
  // Fires on_enter trigger for the new location.

  | { type: 'REMOVE_UNIT'; instanceId: string }

  | { type: 'MOVE_UNIT';   instanceId: string; path: Location[] }
  // path is Location[] — each step may change square, region, or both.
  // After each step: hazard check fires (underground/underwater/void without keyword
  //   → DESTROY_UNIT or BANISH).
  // on_enter fires for each NEW location entered along the path (including pass-through).
  // Carried units + carried artifacts update to the same final location atomically.
  // TAP and RECORD_MOVE are separate actions in the composite resolver.

  | { type: 'FORCE_MOVE_UNIT'; instanceId: string; destination: Location }
  // Forced movement (push/pull/teleport).
  // Does NOT tap. Cannot be intercepted. Movement keywords (Airborne etc.) do NOT apply.
  // Region hazards still apply on arrival.

  | { type: 'TAP';                      instanceId: string }
  | { type: 'UNTAP';                    instanceId: string }
  | { type: 'UNTAP_ALL';                playerId: PlayerId }
  | { type: 'SET_SUMMONING_SICKNESS';   instanceId: string; value: boolean }
  | { type: 'CLEAR_SUMMONING_SICKNESS'; playerId: PlayerId }
```

### Board — Sites

```ts
  | { type: 'PLACE_SITE';  instanceId: string; square: Square }
  | { type: 'REMOVE_SITE'; square: Square }
  | { type: 'SET_RUBBLE';  square: Square; value: boolean }

  | { type: 'MOVE_SITE';   instanceId: string; toSquare: Square }
  // Moves site to a void square. All occupants (surface + subsurface units, artifacts, auras)
  // relocate to toSquare atomically.
  // Occupants are NOT considered to have moved themselves — no on_enter triggers for them.
  // Destination must be void (checked by CHECK_LOCATION_VALID).

  | { type: 'SWAP_SITES';  instanceId1: string; instanceId2: string }
  // Atomically exchanges two sites and all their occupants.
  // Cannot be two sequential MOVE_SITEs (neither target is void during the swap).
  // Same rule: occupants not considered to have moved themselves.
```

### Artifacts

Each action does exactly one thing — carry relationship and board position are fully independent:

```ts
  | { type: 'ATTACH_ARTIFACT';             artifactId: string; carrierId: string }
  // sets artifact.carriedBy = carrierId — does NOT change artifact's board location

  | { type: 'DETACH_ARTIFACT';             artifactId: string }
  // clears artifact.carriedBy — does NOT move the artifact
  // must be followed by PLACE_ARTIFACT_ON_SQUARE or DESTROY_ARTIFACT

  | { type: 'PLACE_ARTIFACT_ON_SQUARE';    artifactId: string; square: Square }
  // sets artifact's board location (after DETACH, or entering play uncarried)

  | { type: 'REMOVE_ARTIFACT_FROM_SQUARE'; artifactId: string }
  // clears artifact's board location (before ATTACH, or before DESTROY_ARTIFACT)

  | { type: 'DESTROY_ARTIFACT';            artifactId: string }
  // sends artifact to cemetery (distinct from dropping it on the ground)
```

> Composite operations:
> - `PICK_UP_ARTIFACT` → `REMOVE_ARTIFACT_FROM_SQUARE` + `ATTACH_ARTIFACT`
> - `DROP_ARTIFACT`    → `DETACH_ARTIFACT` + `PLACE_ARTIFACT_ON_SQUARE`
> - On carrier death   → `DETACH_ARTIFACT` + `PLACE_ARTIFACT_ON_SQUARE` (same square)

### Unit Carrying

Some units can carry other units (same Pick Up / Drop mechanic as artifacts, once per turn).

**Key difference from artifact carrying:** a carried unit keeps its board square — it remains targetable, can cast spells, and activate abilities. Only the carry relationship changes.

```ts
  | { type: 'ATTACH_UNIT_TO_CARRIER';   unitId: string; carrierId: string }
  // sets unit.carriedBy = carrierId — unit stays at its current square

  | { type: 'DETACH_UNIT_FROM_CARRIER'; unitId: string }
  // clears unit.carriedBy — unit stays at its current square
```

> - `PICK_UP_UNIT` → `ATTACH_UNIT_TO_CARRIER` only (unit already shares the square)
> - `DROP_UNIT`    → `DETACH_UNIT_FROM_CARRIER` only (unit stays at the same square)
> - On carrier death → `DETACH_UNIT_FROM_CARRIER` (carried unit stays at death square)
> - If carried unit moves independently to a different square → `DETACH_UNIT_FROM_CARRIER` fires automatically

Carrier's movement keywords (Airborne, Burrowing, Submerge, Voidwalk) are **passively granted** to carried units — computed at read time in `computeStats`, no mutation needed.

### Combat — Damage & Life

> **`DEAL_DAMAGE` vs `LOSE_LIFE`:**
> - `DEAL_DAMAGE` — combat, spells, abilities hitting a unit or avatar.
>   - On a minion: accumulates `damage` tokens; dies when `damage >= getDefensePower(id, state)`.
>   - On an avatar: reduces life. Can trigger Death's Door. Can deliver a death blow.
>   - Blocked by Death's Door immunity (the turn the avatar entered it).
> - `LOSE_LIFE` — site attack; the site controller loses life directly.
>   - **Cannot** deliver a death blow (rule: site attacks are life loss, not damage).
>   - Also blocked by Death's Door immunity.

> **Damage persistence:** minion damage resets at the **end of the active player's turn**
> (`RESET_ALL_DAMAGE` fires before `SWITCH_ACTIVE_PLAYER`). Damage dealt to opponent's minions
> during your turn persists into their turn and resets at the end of theirs. Avatars never reset life.

> **Split Power:** 26 minions have `power: { attack, defense }`. `DEAL_DAMAGE` amount always uses
> `getAttackPower(sourceId, state)`; death threshold uses `getDefensePower(targetId, state)`.
> Both functions scan passives and floatingEffects in addition to the base card value.

```ts
  | { type: 'DEAL_DAMAGE';    sourceId: string; targetId: string; amount: number }
  | { type: 'LOSE_LIFE';      playerId: PlayerId; amount: number }
  | { type: 'GAIN_LIFE';      playerId: PlayerId; amount: number }
  | { type: 'RESET_DAMAGE';   instanceId: string }
  | { type: 'RESET_ALL_DAMAGE' }   // End Phase sweep — ALL minions on board, both players
```

### Combat — Death & Death's Door

```ts
  | { type: 'CHECK_MINION_DEATH'; instanceId: string }
  // evaluates damage >= getDefensePower(id, state) → triggers DESTROY_UNIT if true

  | { type: 'DESTROY_UNIT';       instanceId: string }
  // removes from board, sends to cemetery, fires on_death trigger (Deathrite)

  | { type: 'BURY_UNIT';          instanceId: string }
  // removes from board, sends to cemetery — does NOT fire on_death (no Deathrite)

  | { type: 'CHECK_DEATHS_DOOR';  playerId: PlayerId }
  | { type: 'ENTER_DEATHS_DOOR';  playerId: PlayerId }
  | { type: 'CHECK_DEATH_BLOW';   playerId: PlayerId }
  | { type: 'SET_WINNER';         playerId: PlayerId }
```

### Floating Effects

```ts
  | { type: 'APPLY_FLOATING_EFFECT';  effect: FloatingEffect }
  | { type: 'TICK_FLOATING_EFFECTS';  playerId: PlayerId }
  // called during END_TURN — decrements expiresAfterTurns, removes effects at 0
  | { type: 'REMOVE_FLOATING_EFFECT'; effectId: string }
```

### Tokens, Counters, Conditions

```ts
  | { type: 'SUMMON_TOKEN';    tokenCardId: string; location: Location; controllerId: PlayerId }
  | { type: 'ADD_COUNTER';     instanceId: string; counter: string; amount: number }
  | { type: 'REMOVE_COUNTER';  instanceId: string; counter: string; amount: number }
  | { type: 'SET_CONDITION';   instanceId: string; condition: Condition; value: boolean }
  // Conditions: tapped, disabled, silenced, stealth, ward, no_retaliation, ...
  | { type: 'BREAK_WARD';      instanceId: string }
  // absorbs one targeting/damage/destruction effect; fires on ward-break trigger
```

### Misc

```ts
  | { type: 'CHOOSE_RANDOM';  scope: 'unit' | 'spell' | 'square'; resolvedId: string }
  // randomness resolved at decomposition time; resolvedId stored in log → deterministic replay
  // ⚠ information-revealing → locks undo

  | { type: 'SWAP_POSITIONS'; instanceId1: string; instanceId2: string }  // two units
  | { type: 'EXCHANGE_LIFE';  player1Id: PlayerId; player2Id: PlayerId }
  | { type: 'SUMMON_AS_COPY'; instanceId: string; copyOfCardId: string; location: Location }
```

### Turn & Phase

```ts
  | { type: 'ADVANCE_PHASE' }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SWITCH_ACTIVE_PLAYER' }
  | { type: 'INCREMENT_TURN' }
  | { type: 'RECORD_ATTACK';    unitId: string }
  | { type: 'RECORD_MOVE';      unitId: string }
  | { type: 'RECORD_SPELL_CAST' }
  | { type: 'SET_PENDING_INTERACTION';   interaction: PendingInteraction }
  | { type: 'CLEAR_PENDING_INTERACTION' }
```

### UI / Sequencing

```ts
  | { type: 'SELECT_TARGET'; prompt: string; conditions: TargetCondition[]; resultKey: string }
  | { type: 'SELECT_SQUARE'; prompt: string; conditions: SquareCondition[];  resultKey: string }
  // When the engine encounters these, execution pauses.
  // The remaining sequence is stored in pendingInteraction.resumeSequence (serializable).
  // On cancel  → restore pre-action snapshot (full rollback of any partial mutations).
  // On confirm → fill resultKey into the sequence and resume.
```

### Triggers

```ts
  | { type: 'TRIGGER_FIRED';    triggerType: TriggerType; sourceId: string; payload: TriggerPayload }
  | { type: 'TRIGGER_RESOLVED'; triggerId: string }
```

---

## Player Actions (Composite)

A `PlayerAction` is what a player initiates. The composite resolver decomposes it into an ordered `AtomicAction[]`. Checks always come before mutations; a failed check aborts the whole sequence with no state change.

### `CAST_SPELL`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_PHASE('main')
CHECK_CARD_IN_HAND(cardId)
CHECK_HAS_MANA(cost)
CHECK_ELEMENTAL_THRESHOLD(threshold)
[CHECK_LOCATION_VALID / CHECK_TARGET_VALID]   ← if the spell requires a target
PAY_MANA(cost)
MOVE_CARD_FROM_HAND(cardId)
→ branch by card type:
    Minion:
      CHECK_SQUARE_HAS_SITE(targetSquare)
      CHECK_SQUARE_CONTROLLED(targetSquare)
      PLACE_UNIT(instanceId, { square: targetSquare, region: 'surface' })
      SET_SUMMONING_SICKNESS(instanceId, true)
      TRIGGER_FIRED('on_enter', instanceId)
    Artifact:
      [ATTACH_ARTIFACT or PLACE_ARTIFACT_ON_SQUARE]
      TRIGGER_FIRED('on_enter', instanceId)
    Aura:
      PLACE_UNIT(instanceId, targetLocation)
      TRIGGER_FIRED('on_enter', instanceId)
    Magic (instant):
      [SELECT_TARGET if needed]
      [DEAL_DAMAGE / GAIN_LIFE / ... per effect]
      MOVE_CARD_TO_CEMETERY(instanceId)
RECORD_SPELL_CAST
```

### `PLAY_SITE`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_CARD_IN_HAND(instanceId)
CHECK_LOCATION_VALID(targetSquare, [valid placement rules])
MOVE_CARD_FROM_HAND(instanceId)
[SET_RUBBLE(square, false)]   ← if replacing rubble
PLACE_SITE(instanceId, targetSquare)
COMPUTE_MANA_POOL(playerId)
COMPUTE_AFFINITY(playerId)
TRIGGER_FIRED('on_enter', instanceId)
```

### `MOVE_AND_ATTACK`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_UNIT_ON_BOARD(unitId)
CHECK_NOT_TAPPED(unitId)
CHECK_NO_SUMMONING_SICKNESS(unitId)
CHECK_LOCATION_REACHABLE(unitId, destination)
MOVE_UNIT(unitId, path)              ← path: Location[]
  [per step: hazard check + on_enter if new location]
TAP(unitId)
RECORD_MOVE(unitId)
→ if attacking a unit:
    CHECK_TARGET_VALID(targetId, [is enemy, reachable, region rules])
    RECORD_ATTACK(unitId)
    DEAL_DAMAGE(attackerId, targetId, getAttackPower(attacker))
    DEAL_DAMAGE(targetId, attackerId, getAttackPower(target))   ← simultaneous
    CHECK_MINION_DEATH(targetId)
      → if dead: DESTROY_UNIT(targetId), TRIGGER_FIRED('on_death', targetId)
    CHECK_MINION_DEATH(attackerId)
      → if dead: DESTROY_UNIT(attackerId), TRIGGER_FIRED('on_death', attackerId)
    → if target is avatar:
        CHECK_DEATH_BLOW(targetPlayerId)   → if death blow: SET_WINNER(attackerPlayerId)
        CHECK_DEATHS_DOOR(targetPlayerId)  → if life <= 0: ENTER_DEATHS_DOOR(targetPlayerId)
→ if attacking a site:
    CHECK_TARGET_VALID(siteSquare, [has enemy site, attacker is there])
    RECORD_ATTACK(unitId)
    LOSE_LIFE(siteOwnerId, getAttackPower(attacker))   ← life loss, NOT damage → no death blow
    CHECK_DEATHS_DOOR(siteOwnerId)
      → if life <= 0 and not yet at death's door: ENTER_DEATHS_DOOR(siteOwnerId)
```

### `ACTIVATE_ABILITY`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_UNIT_ON_BOARD(instanceId)
CHECK_ABILITY_USABLE(instanceId, abilityId)   ← cost, tap, threshold, once-per-turn
[PAY_MANA(cost)]
[TAP(instanceId)]
[LOSE_LIFE(playerId, lifeCost)]
[SELECT_TARGET / SELECT_SQUARE]               ← if ability needs a target
→ resolve effect (same decomposition as spell effects)
```

### `END_TURN`

Per rulebook End Phase order: (1) end_of_turn triggers, (2) floating "this turn" effects expire,
(3) minion damage resets, (4) mana lost, (5) opponent's turn begins.

```
CHECK_IS_ACTIVE_PLAYER
TRIGGER_FIRED('end_of_turn', ...)
TICK_FLOATING_EFFECTS(activePlayerId)
RESET_ALL_DAMAGE
CLEAR_MANA(activePlayerId)
SWITCH_ACTIVE_PLAYER
INCREMENT_TURN
UNTAP_ALL(nextPlayerId)
CLEAR_SUMMONING_SICKNESS(nextPlayerId)
COMPUTE_MANA_POOL(nextPlayerId)
COMPUTE_AFFINITY(nextPlayerId)
→ if not turn 1 first player:
    SET_PENDING_INTERACTION({ type: 'choose_draw', playerId })
    [after player chooses]: DRAW_CARD → ADVANCE_PHASE
  else:
    ADVANCE_PHASE
TRIGGER_FIRED('start_of_turn', ...)
```

---

## System Mechanics

### Movement & Regions

Each step in a `MOVE_UNIT` path is a `Location = { square, region }`. A step may change the square, the region, or both.

| Keyword | Enables | Step type |
|---------|---------|-----------|
| *(none)* | Surface only | Adjacent square, same `surface` region |
| **Airborne** | Diagonal steps | Diagonal square, `surface` region. Also immune to attacks/intercepts by non-Airborne. |
| **Burrowing** | Underground | `{ same square, 'underground' }` (drop down) or `{ adjacent square, 'underground' }` |
| **Submerge** | Underwater | Same as Burrowing for `'underwater'` (water sites only) |
| **Voidwalk** | Void squares | Step into adjacent void, or exit void onto adjacent site surface/subsurface |
| **Movement +X** | Extra steps | `computeStats().movement` = base 1 + X |
| **Moves Freely** | Zero-cost steps | No step budget consumed while condition is satisfied |

Region hazards fire after each step (including forced moves — keywords don't protect in forced movement):

| Entering | Without keyword | Consequence |
|----------|-----------------|-------------|
| `underground` | Burrowing | `DESTROY_UNIT` |
| `underwater` | Submerge | `DESTROY_UNIT` |
| `void` | Voidwalk | `BANISH` |

### Passive Abilities

Passive abilities are **never mutations**. `computeStats(id, state)` is the single read point, aggregating base card value → in-play passive modifiers → active floatingEffects.

Context-sensitive passives (e.g. Waterbound: disabled when not on a water site) are evaluated at read time via `isDisabled(id, state)` — no stored flag.

### Trigger System

After each mutation, the engine checks a **trigger registry** mapping `TriggerType` to in-play cards listening for that trigger. Matches are enqueued (FIFO) and drained before the next player action.

| TriggerType | Fires after |
|-------------|-------------|
| `on_enter` | `PLACE_UNIT` / `PLACE_SITE` |
| `on_death` | `DESTROY_UNIT` (not `BURY_UNIT`) |
| `on_damage` | `DEAL_DAMAGE` |
| `end_of_turn` | Start of `END_TURN` composite |
| `start_of_turn` | After draw choice resolved in `END_TURN` |

Loop detection: each chain tracks a seen-set of `(sourceInstanceId, triggerType, targetId)`. Duplicate enqueue in the same chain is silently dropped. No depth limit.

### Event Log

Every mutation is appended as an `EventLogEntry`. Checks are not logged.

```ts
interface EventLogEntry {
  id:                string;
  playerActionIndex: number;        // groups atomics under their parent player action
  atomicAction:      MutationAction;
  timestamp:         number;
}
```

Randomness (`CHOOSE_RANDOM`) and deck-peek (`PEEK_DECK`) store resolved outcomes directly in the action — replay is fully deterministic.

### Undo System

Snapshot-based, at player action boundaries.

```ts
interface UndoStack {
  snapshots: GameState[];
  locked:    boolean;
  push(state: GameState): void;
  pop():     GameState | undefined;   // no-op if locked
  lock():    void;                    // clears snapshots, sets locked = true
  canUndo(): boolean;                 // !locked && snapshots.length > 0
}
```

**Information-revealing actions** lock the undo stack immediately when they fire — whether from a player action or a triggered ability:

```ts
const INFORMATION_REVEALING_ACTIONS = new Set([
  'DRAW_CARD',     // player sees a new card
  'PEEK_DECK',     // player sees top N cards
  'CHOOSE_RANDOM', // random outcome revealed and stored
  'REVEAL_HAND',   // opponent's hand revealed
]);
```

Undo is only available during the active player's turn. Cancelling a `SELECT_TARGET`/`SELECT_SQUARE` mid-sequence restores the pre-action snapshot (full rollback of any partial mutations).

---

## File Structure

```
src/
  engine/
    core/
      atomicActions.ts        ← full AtomicAction discriminated union
      gameState.ts            ← GameState type (pure serializable data)
      applyAtomicAction.ts    ← (state, action) => state — one switch per action type
      checks.ts               ← all CHECK_* validators, throw GameError on failure
      computeStats.ts         ← computeStats(id, state) → UnitStats
    composite/
      castSpell.ts
      playSite.ts
      moveAndAttack.ts
      activateAbility.ts
      endTurn.ts
      mulligan.ts
    triggers/
      triggerRegistry.ts      ← maps TriggerType → in-play listeners
      triggerQueue.ts         ← FIFO queue + loop detection
    log/
      eventLog.ts             ← append, serialize, replay
    undo/
      undoStack.ts            ← snapshot push/pop + lock
    utils.ts                  ← grid math, pathfinding, region helpers
    gameEngine.ts             ← orchestrator: pipeline entry point
  store/
    gameStore.ts              ← Zustand: calls engine, holds UI-only state
  types/
    index.ts                  ← all shared types
  data/
    cards.ts
    realCards.ts
  components/
    ...                       ← unchanged, reads state from store
```

---

## Known Gaps & Cards Outside Current Framework

Mechanics not yet expressible with the current atomic action set. All are **additive** — no architectural changes needed.

| Mechanic | Cards / scope | Status |
|----------|---------------|--------|
| **Counter-threshold triggers** | Doomsday Device, Immortal Throne | Counter values must be readable in trigger conditions |
| **Oversized units (2×2)** | Large minions | `occupiedLocations: Location[]` on CardInstance |
| **Artifact throw** | Far East Assassin | Read artifact mana cost at resolve time + `DESTROY_ARTIFACT` |
| **Search effects** | Tutor cards | `SELECT_TARGET` with `zone: 'deck' \| 'cemetery'` condition — no new action |

### Edge Cases

| Issue | Mitigation |
|-------|------------|
| **Loop detection key** | Seen-set must include `sourceInstanceId` — two different cards can both respond to the same event |
| **Waterbound context-disable** | `isDisabled(id, state)` checks board position at read time — no stored flag |
| **Lance token** | Counter `'lance': 1` on unit; strike-first + bonus damage at attack resolution; counter removed after first strike |
| **Oversized unit damage grid** | Sum damage values across all occupied squares |
| **Conditional strike** (Escyllion Cyclops) | `SET_CONDITION('no_retaliation')` + check in `MOVE_AND_ATTACK` composite before applying defender's `DEAL_DAMAGE` |
