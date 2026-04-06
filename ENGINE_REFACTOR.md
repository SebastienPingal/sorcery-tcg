# Game Engine Refactor — Design Document

## Goals

- Decompose all game actions into the most granular atomic actions possible
- Game state is pure serializable data; UI is a read-only projection of it
- Event sourcing: the action log is the source of truth; state can be rebuilt by replaying it
- Enable save/load of games
- Enable undo at player decision boundaries
- Support triggered abilities (cards reacting to atomic actions) via a trigger queue
- Keep the engine in a standalone TypeScript module, decoupled from React and the store

---

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│                  React UI                    │  ← reads GameState, dispatches PlayerActions
├─────────────────────────────────────────────┤
│               Zustand Store                  │  ← bridges UI ↔ engine, holds UI-only state
├─────────────────────────────────────────────┤
│            Engine Orchestrator               │  ← receives PlayerAction, coordinates layers
├──────────────┬──────────────────────────────┤
│  Composite   │  Trigger Queue               │  ← PlayerAction → sequence of AtomicActions
│  Resolvers   │  (FIFO, no player reactions) │     triggers fire after relevant atomics
├──────────────┴──────────────────────────────┤
│            Atomic Action Applier             │  ← applies one AtomicAction → new GameState
├─────────────────────────────────────────────┤
│       Event Log  /  Undo Stack              │  ← append-only log + snapshots for undo
├─────────────────────────────────────────────┤
│                 GameState                    │  ← plain serializable data (JSON-safe)
└─────────────────────────────────────────────┘
```

---

## Atomic Actions

An `AtomicAction` is the smallest indivisible unit of game change or validation.
It is either a **check** (validates a condition, throws if invalid) or a **mutation** (modifies state).

All atomic actions are typed as a discriminated union. Every mutation is appended to the event log.

### Checks (validation — no state change)

```ts
type CheckAction =
  | { type: 'CHECK_HAS_MANA';            playerId: PlayerId; amount: number }
  | { type: 'CHECK_ELEMENTAL_THRESHOLD'; playerId: PlayerId; threshold: ElementalThreshold }
  | { type: 'CHECK_CARD_IN_HAND';        playerId: PlayerId; instanceId: string }
  | { type: 'CHECK_NOT_TAPPED';          instanceId: string }
  | { type: 'CHECK_NO_SUMMONING_SICKNESS'; instanceId: string }
  | { type: 'CHECK_UNIT_ON_BOARD';       instanceId: string }
  | { type: 'CHECK_SQUARE_HAS_SITE';     square: Square }
  | { type: 'CHECK_SQUARE_CONTROLLED';   square: Square; playerId: PlayerId }
  | { type: 'CHECK_SQUARE_REACHABLE';    unitId: string; square: Square }
  | { type: 'CHECK_TARGET_VALID';        targetId: string; conditions: TargetCondition[] }
  | { type: 'CHECK_SQUARE_VALID';        square: Square; conditions: SquareCondition[] }
  | { type: 'CHECK_IS_ACTIVE_PLAYER';    playerId: PlayerId }
  | { type: 'CHECK_PHASE';               phase: Phase }
  | { type: 'CHECK_ABILITY_USABLE';      instanceId: string; abilityId: string }
  | { type: 'CHECK_NOT_AT_DEATHS_DOOR';  playerId: PlayerId }  // for death blow logic
```

### Mana Mutations

```ts
  | { type: 'PAY_MANA';             playerId: PlayerId; amount: number }
  | { type: 'GAIN_MANA';            playerId: PlayerId; amount: number }
  | { type: 'COMPUTE_MANA_POOL';    playerId: PlayerId }   // recount from controlled sites
  | { type: 'COMPUTE_AFFINITY';     playerId: PlayerId }   // recount elemental thresholds
```

### Card Zone Mutations

```ts
  | { type: 'MOVE_CARD_TO_HAND';      instanceId: string; playerId: PlayerId }
  | { type: 'MOVE_CARD_TO_CEMETERY';  instanceId: string }
  | { type: 'MOVE_CARD_TO_DECK_TOP';  instanceId: string; deck: 'atlas' | 'spellbook' }
  | { type: 'MOVE_CARD_FROM_HAND';    instanceId: string }   // removes from hand (before placing)
  | { type: 'SHUFFLE_DECK';           playerId: PlayerId; deck: 'atlas' | 'spellbook' }
  | { type: 'DRAW_CARD';              playerId: PlayerId; deck: 'atlas' | 'spellbook' }
```

### Board Mutations

```ts
  | { type: 'PLACE_UNIT';           instanceId: string; square: Square }
  | { type: 'REMOVE_UNIT';          instanceId: string }
  | { type: 'MOVE_UNIT';            instanceId: string; path: Square[] }
  | { type: 'TAP';                  instanceId: string }
  | { type: 'UNTAP';                instanceId: string }
  | { type: 'UNTAP_ALL';            playerId: PlayerId }
  | { type: 'SET_SUMMONING_SICKNESS'; instanceId: string; value: boolean }
  | { type: 'CLEAR_SUMMONING_SICKNESS'; playerId: PlayerId }
  | { type: 'PLACE_SITE';           instanceId: string; square: Square }
  | { type: 'REMOVE_SITE';          square: Square }
  | { type: 'SET_RUBBLE';           square: Square; value: boolean }
```

### Artifacts

```ts
  | { type: 'ATTACH_ARTIFACT';      artifactId: string; carrierId: string }
  | { type: 'DETACH_ARTIFACT';      artifactId: string }
  | { type: 'PLACE_ARTIFACT_ON_SQUARE'; artifactId: string; square: Square }
  | { type: 'PICK_UP_ARTIFACT';     unitId: string; artifactId: string }
  | { type: 'DROP_ARTIFACT';        unitId: string; artifactId: string; square: Square }
```

### Damage & Life

> **Rule distinction:**
> - `DEAL_DAMAGE` — damages a unit or avatar directly (from combat, spells, abilities).
>   - On a **minion**: accumulates as `damage` tokens; minion dies when `damage >= power`.
>   - On an **avatar**: reduces life. Can trigger Death's Door. Can deliver a death blow.
>   - Is blocked by Death's Door immunity (the turn an avatar enters it).
> - `LOSE_LIFE` — the controller of a site loses life when that site is attacked.
>   - Bypasses minions. Reduces life directly.
>   - **Cannot** deliver a death blow (rule: site attacks never cause a death blow).
>   - Is also blocked by Death's Door immunity.

```ts
  | { type: 'DEAL_DAMAGE';     sourceId: string; targetId: string; amount: number }
  | { type: 'LOSE_LIFE';       playerId: PlayerId; amount: number }  // site attack, life loss effects
  | { type: 'GAIN_LIFE';       playerId: PlayerId; amount: number }
  | { type: 'RESET_DAMAGE';    instanceId: string }   // end of turn, minion only
  | { type: 'RESET_ALL_DAMAGE'; }                     // end of turn sweep
```

### Death & Death's Door

```ts
  | { type: 'CHECK_MINION_DEATH';  instanceId: string }  // check if damage >= power, trigger destroy
  | { type: 'DESTROY_UNIT';        instanceId: string }   // remove from board, send to cemetery
  | { type: 'CHECK_DEATHS_DOOR';   playerId: PlayerId }   // check if life <= 0
  | { type: 'ENTER_DEATHS_DOOR';   playerId: PlayerId }
  | { type: 'CHECK_DEATH_BLOW';    playerId: PlayerId }   // already at death's door + damaged → win
  | { type: 'SET_WINNER';          playerId: PlayerId }
```

### Turn & Phase

```ts
  | { type: 'ADVANCE_PHASE' }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SWITCH_ACTIVE_PLAYER' }
  | { type: 'INCREMENT_TURN' }
  | { type: 'CLEAR_MANA';          playerId: PlayerId }
  | { type: 'RECORD_ATTACK';       unitId: string }
  | { type: 'RECORD_MOVE';         unitId: string }
  | { type: 'RECORD_SPELL_CAST'; }
  | { type: 'SET_PENDING_INTERACTION'; interaction: PendingInteraction }
  | { type: 'CLEAR_PENDING_INTERACTION' }
```

### Tokens, Counters, Conditions

```ts
  | { type: 'ADD_COUNTER';         instanceId: string; counter: string; amount: number }
  | { type: 'REMOVE_COUNTER';      instanceId: string; counter: string; amount: number }
  | { type: 'SET_CONDITION';       instanceId: string; condition: Condition; value: boolean }
  | { type: 'SUMMON_TOKEN';        tokenCardId: string; square: Square; controllerId: PlayerId }
```

### Trigger System

```ts
  | { type: 'TRIGGER_FIRED';  triggerType: TriggerType; sourceId: string; payload: TriggerPayload }
  | { type: 'TRIGGER_RESOLVED'; triggerId: string }
```

---

## Player Actions (Composite)

A `PlayerAction` is what a player initiates. The engine decomposes it into an ordered sequence of `AtomicAction`s. Checks come first; if any check fails the whole sequence is aborted (no state change).

### `CAST_SPELL`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_PHASE('main')
CHECK_CARD_IN_HAND(cardId)
CHECK_HAS_MANA(cost)
CHECK_ELEMENTAL_THRESHOLD(threshold)
[CHECK_SQUARE_VALID / CHECK_TARGET_VALID]   ← if spell needs a target
PAY_MANA(cost)
MOVE_CARD_FROM_HAND(cardId)
→ branch by card type:
  Minion:
    CHECK_SQUARE_HAS_SITE(targetSquare)
    CHECK_SQUARE_CONTROLLED(targetSquare)
    PLACE_UNIT(instanceId, targetSquare)
    SET_SUMMONING_SICKNESS(instanceId, true)
    TRIGGER_FIRED('on_enter', instanceId)
  Site:
    [via PLAY_SITE player action below]
  Artifact:
    [ATTACH_ARTIFACT or PLACE_ARTIFACT_ON_SQUARE]
    TRIGGER_FIRED('on_enter', instanceId)
  Aura:
    PLACE_UNIT(instanceId, targetSquare)
    TRIGGER_FIRED('on_enter', instanceId)
  Magic (instant):
    [DEAL_DAMAGE / GAIN_LIFE / ... per ability effects]
    MOVE_CARD_TO_CEMETERY(instanceId)
RECORD_SPELL_CAST
```

### `PLAY_SITE`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_CARD_IN_HAND(instanceId)
CHECK_SQUARE_VALID(targetSquare, [is valid site placement])
MOVE_CARD_FROM_HAND(instanceId)
[SET_RUBBLE(square, false)]   ← if replacing rubble
PLACE_SITE(instanceId, targetSquare)
COMPUTE_MANA_POOL(playerId)
COMPUTE_AFFINITY(playerId)
TRIGGER_FIRED('on_enter', instanceId)
```

### `MOVE_UNIT`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_UNIT_ON_BOARD(unitId)
CHECK_NOT_TAPPED(unitId)
CHECK_NO_SUMMONING_SICKNESS(unitId)
[CHECK_SQUARE_VALID for each step in path]
CHECK_SQUARE_REACHABLE(unitId, destination)
MOVE_UNIT(unitId, path)
TAP(unitId)
RECORD_MOVE(unitId)
```

### `ATTACK_UNIT`

```
[after MOVE_UNIT or from same square]
CHECK_TARGET_VALID(targetId, [is enemy, is adjacent/reachable])
RECORD_ATTACK(unitId)
DEAL_DAMAGE(attackerId, targetId, attackerPower)
→ if target is minion:
    DEAL_DAMAGE(targetId, attackerId, targetPower)   ← simultaneous strike
    CHECK_MINION_DEATH(targetId)
      → if dead: DESTROY_UNIT(targetId), TRIGGER_FIRED('on_death', targetId)
    CHECK_MINION_DEATH(attackerId)
      → if dead: DESTROY_UNIT(attackerId), TRIGGER_FIRED('on_death', attackerId)
→ if target is avatar:
    CHECK_DEATH_BLOW(targetPlayerId)
      → if death blow: SET_WINNER(attackerPlayerId)
    CHECK_DEATHS_DOOR(targetPlayerId)
      → if life <= 0: ENTER_DEATHS_DOOR(targetPlayerId)
```

### `ATTACK_SITE`

```
CHECK_TARGET_VALID(siteSquare, [has enemy site, attacker is adjacent])
RECORD_ATTACK(unitId)
TAP(unitId)
LOSE_LIFE(siteOwnerId, attackerPower)   ← NOT DEAL_DAMAGE — cannot deliver death blow
CHECK_DEATHS_DOOR(siteOwnerId)
  → if life <= 0 AND not already at death's door: ENTER_DEATHS_DOOR(siteOwnerId)
  → if already at death's door: death blow cannot occur from LOSE_LIFE (rule)
```

### `ACTIVATE_ABILITY`

```
CHECK_IS_ACTIVE_PLAYER
CHECK_UNIT_ON_BOARD(instanceId)
CHECK_ABILITY_USABLE(instanceId, abilityId)   ← checks cost, tap, threshold, not already used
[PAY_MANA(cost)]
[TAP(instanceId)]
[LOSE_LIFE(playerId, lifeCost)]
→ resolve effect (same decomposition as spell effects)
```

### `END_TURN`

```
CHECK_IS_ACTIVE_PLAYER
RESET_ALL_DAMAGE
CLEAR_MANA(activePlayerId)
SWITCH_ACTIVE_PLAYER
INCREMENT_TURN
UNTAP_ALL(nextPlayerId)
CLEAR_SUMMONING_SICKNESS(nextPlayerId)
COMPUTE_MANA_POOL(nextPlayerId)
COMPUTE_AFFINITY(nextPlayerId)
→ if not turn 1 first player: SET_PENDING_INTERACTION({ type: 'choose_draw', playerId })
   else: ADVANCE_PHASE
TRIGGER_FIRED('start_of_turn', avatarId)   ← after draw choice resolved
```

---

## Trigger System

After each **mutation** atomic action is applied, the engine checks a **trigger registry**: a map from `TriggerType` to all currently-in-play cards that have an ability listening to that trigger.

If a match is found, a `TRIGGER_FIRED` action is appended to the log, and the triggered ability's composite action sequence is pushed to the **trigger queue** (FIFO).

The trigger queue is drained before the next player action is accepted.

```
TriggerType:
  'on_enter'        → fires after PLACE_UNIT / PLACE_SITE
  'on_death'        → fires after DESTROY_UNIT
  'start_of_turn'   → fires during END_TURN resolution (after untap/draw)
  'end_of_turn'     → fires during END_TURN resolution (before mana clear)
  'on_damage'       → fires after DEAL_DAMAGE (for reactive abilities)
  'passive'         → not a trigger — always-on modifier, applied at state read time
```

No player can react between trigger resolutions (no stack, no priority).

---

## Event Sourcing — Event Log

The event log is the source of truth. Every **mutation** atomic action applied to the game state is appended as an `EventLogEntry`. Checks are not logged.

```ts
interface EventLogEntry {
  id: string;
  playerActionIndex: number;   // groups atomics under the parent player action
  atomicAction: MutationAction;
  timestamp: number;
}

interface EventLog {
  entries: EventLogEntry[];
  playerActionCount: number;
}
```

The full `GameState` can be rebuilt by replaying the log from the initial state.

---

## Undo System

Undo operates at **player action boundaries** (not per atomic action, which would be too granular for UX).

**Strategy: snapshot-based** (simpler and instant, event log remains available for replay/audit).

Before each player action is processed, the engine stores a full `GameState` snapshot. Undo restores the previous snapshot.

```ts
interface UndoStack {
  snapshots: GameState[];   // index 0 = start of game
  push(state: GameState): void;
  pop(): GameState | undefined;
  canUndo(): boolean;
}
```

Undo is only available during the active player's turn (cannot undo the opponent's actions after passing turn).

---

## File Structure

```
src/
  engine/
    core/
      atomicActions.ts      ← full AtomicAction discriminated union
      gameState.ts          ← GameState type (pure serializable data)
      applyAtomicAction.ts  ← (state, action) => state  — one switch per action type
      checks.ts             ← all CHECK_* validators, throw GameError on failure
    composite/
      castSpell.ts          ← PlayerAction → AtomicAction[]
      playSite.ts
      moveUnit.ts
      attackUnit.ts
      attackSite.ts
      activateAbility.ts
      endTurn.ts
      mulligan.ts
    triggers/
      triggerRegistry.ts    ← scan in-play cards for matching triggers
      triggerQueue.ts       ← FIFO queue of pending triggered effects
    log/
      eventLog.ts           ← append, serialize, replay
    undo/
      undoStack.ts          ← snapshot push/pop
    utils.ts                ← grid math, pathfinding (unchanged)
    gameEngine.ts           ← orchestrator: receives PlayerAction, runs full pipeline
  store/
    gameStore.ts            ← Zustand: calls engine, holds UI-only state
  types/
    index.ts                ← all shared types
  data/
    cards.ts
    realCards.ts
  components/
    ...                     ← unchanged structure, reads state from store
```

---

## Engine Pipeline (per Player Action)

```
PlayerAction received
  │
  ├─ 1. decompose → AtomicAction[]   (composite resolver)
  │
  ├─ 2. run checks first (dry-run)   → abort whole sequence if any check fails
  │
  ├─ 3. push GameState snapshot      → undo stack
  │
  ├─ 4. for each AtomicAction:
  │       a. apply mutation → new GameState
  │       b. append to event log
  │       c. check trigger registry → enqueue triggered effects
  │
  ├─ 5. drain trigger queue:
  │       for each queued trigger:
  │         decompose → AtomicAction[]
  │         apply (same pipeline, no new undo snapshot)
  │         may enqueue further triggers (cascade)
  │
  └─ 6. return new GameState → store updates UI
```

---

## Design Decisions

### 1. Passive Abilities — Computed at Read Time

Passive abilities (always-on modifiers: +X power, keyword grants, etc.) are **never stored as mutations** in the event log. They are computed on the fly when reading the relevant part of the game state (e.g. `getEffectivePower(instanceId, state)` scans all in-play auras/artifacts and sums their modifiers).

This means state is always minimal and never out-of-sync. No mutation is needed when an aura enters or leaves — the effect disappears automatically because the aura is no longer in play.

### 2. Trigger Cascades — No Depth Limit, Infinite Loop Detection

Triggered abilities can trigger other abilities with no hard depth limit. The trigger queue tracks a **seen set** of `(sourceInstanceId, triggerType, targetId)` tuples per resolution chain. If the same tuple would be enqueued again in the same chain, it is silently dropped (loop detected).

### 3. Undo — Blocked on Information Reveal

Undo is available freely during a player's turn **up until new hidden information is revealed**. The moment a card is drawn (from either deck), the undo stack for that turn is cleared. The player cannot go back past a draw.

Concretely: `DRAW_CARD` triggers a `LOCK_UNDO` side effect in the undo stack.

### 4. Targeting Mid-Sequence — Suspended Sequence

`SELECT_TARGET` and `SELECT_SQUARE` are first-class atomic actions in a sequence. When the engine encounters one, it **pauses execution**, stores the remaining sequence, and emits a `pendingInteraction`. The partial state (including already-applied mutations) is saved to the store. When the player responds, the engine resumes from the stored sequence with the chosen value filled in.

**Cancellation**: If the player cancels a mid-sequence selection, the engine restores the pre-action snapshot (undo). All partial mutations are rolled back cleanly.

The suspended sequence is stored inside `pendingInteraction` to keep the state fully serializable:

```ts
type PendingInteraction =
  | {
      type: 'select_target';
      prompt: string;
      conditions: TargetCondition[];
      resumeSequence: AtomicAction[];  // remaining actions, with placeholder refs filled on resume
    }
  | {
      type: 'select_square';
      prompt: string;
      conditions: SquareCondition[];
      resumeSequence: AtomicAction[];
    }
  | { type: 'choose_draw'; playerId: PlayerId }
  | { type: 'mulligan';    playerId: PlayerId }
  | null;
```

New atomic actions to support this:

```ts
  | { type: 'SELECT_TARGET'; prompt: string; conditions: TargetCondition[]; resultKey: string }
  | { type: 'SELECT_SQUARE'; prompt: string; conditions: SquareCondition[]; resultKey: string }
  | { type: 'LOCK_UNDO' }   // called after DRAW_CARD — clears undo stack
```

---

## Revised Engine Pipeline (per Player Action)

```
PlayerAction received
  │
  ├─ 1. decompose → AtomicAction[]   (composite resolver, may contain SELECT_TARGET / SELECT_SQUARE)
  │
  ├─ 2. run CHECK_* actions first (dry-run, no state change)  → abort if any fails
  │
  ├─ 3. push GameState snapshot → undo stack
  │
  ├─ 4. for each AtomicAction in sequence:
  │       ┌─ if SELECT_TARGET / SELECT_SQUARE:
  │       │     store remaining sequence in pendingInteraction
  │       │     return state to UI → wait for player input
  │       │     [on cancel] → restore snapshot, clear sequence
  │       │     [on confirm] → fill resultKey, resume sequence from here
  │       └─ else:
  │             a. apply mutation → new GameState
  │             b. if DRAW_CARD: also apply LOCK_UNDO → clear undo stack
  │             c. append to event log
  │             d. check trigger registry → enqueue triggered effects
  │
  ├─ 5. drain trigger queue (FIFO):
  │       for each queued trigger:
  │         decompose → AtomicAction[]
  │         apply (same pipeline, no new undo snapshot)
  │         loop detection: drop if same (source, trigger, target) seen in this chain
  │         may enqueue further triggers (cascade)
  │
  └─ 6. return final GameState → store updates UI
```
