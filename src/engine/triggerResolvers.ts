import type { GameState, CardInstance, Square } from '../types';
import { addStatusToken, killUnit } from './core/applyAtomicAction';
import { adjacentSquares, nearbySquares, opponent } from './utils';

// ─── Trigger resolver types ─────────────────────────────────────────────────
// A trigger resolver is a function called when a specific game event fires
// for a card that has the matching keyword (genesis, deathrite, etc.).

export type TriggerType = 'genesis' | 'deathrite' | 'end_of_turn' | 'on_strike' | 'on_move';

export type TriggerResolverFn = (
  state: GameState,
  instance: CardInstance,
) => void;

// ─── Registry ───────────────────────────────────────────────────────────────
// Keyed by `${cardId}:${triggerType}` for fast lookup.

const registry = new Map<string, TriggerResolverFn>();

function key(cardId: string, trigger: TriggerType): string {
  return `${cardId}:${trigger}`;
}

export function registerTriggerResolver(
  cardId: string,
  trigger: TriggerType,
  fn: TriggerResolverFn,
): void {
  registry.set(key(cardId, trigger), fn);
}

export function getTriggerResolver(
  cardId: string,
  trigger: TriggerType,
): TriggerResolverFn | undefined {
  return registry.get(key(cardId, trigger));
}

// ─── Firing helpers ─────────────────────────────────────────────────────────
// Called by the engine at the right moments (enter realm, die).

export function fireGenesis(state: GameState, instance: CardInstance): void {
  const resolver = getTriggerResolver(instance.cardId, 'genesis');
  if (!resolver) return;
  resolver(state, instance);
}

export function fireDeathrite(state: GameState, instance: CardInstance): void {
  const resolver = getTriggerResolver(instance.cardId, 'deathrite');
  if (!resolver) return;
  resolver(state, instance);
}

export function fireEndOfTurn(state: GameState, playerId: string): void {
  for (const inst of Object.values(state.instances)) {
    if (inst.controllerId !== playerId || !inst.location) continue;
    const resolver = getTriggerResolver(inst.cardId, 'end_of_turn');
    if (resolver) resolver(state, inst);
  }
}

// Fired after a carrier unit has finished moving to a new square.
// Iterates the carrier's carried artifacts and fires on_move for each registered.
export function fireOnMove(state: GameState, carrier: CardInstance): void {
  for (const artId of carrier.carriedArtifacts) {
    const art = state.instances[artId];
    if (!art) continue;
    const resolver = getTriggerResolver(art.cardId, 'on_move');
    if (resolver) resolver(state, art);
  }
}

export function fireOnStrike(state: GameState, attacker: CardInstance, defender: CardInstance): void {
  const resolver = getTriggerResolver(attacker.cardId, 'on_strike');
  if (!resolver) return;
  // Card-specific condition checks before firing
  if (attacker.cardId === 'rowdy_boys') {
    // Only fires when striking Undead
    const subtypes = 'subtypes' in defender.card ? (defender.card.subtypes as string[]) : [];
    const typeLine = (defender.card.typeLine ?? '').toLowerCase();
    const isUndead = subtypes.some((s) => s.toLowerCase() === 'undead') || typeLine.includes('undead');
    if (!isUndead) return;
  }
  resolver(state, attacker);
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function applyWard(inst: CardInstance): void {
  addStatusToken(inst, 'ward');
}

function healPlayer(state: GameState, playerId: string, amount: number): void {
  const player = state.players[playerId as 'player1' | 'player2'];
  if (player.isAtDeathsDoor) return;
  player.life = Math.min(player.life + amount, player.maxLife);
}

function getMinionsAtSquare(state: GameState, sq: Square): CardInstance[] {
  const cell = state.realm[sq.row][sq.col];
  return [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]
    .map((id) => state.instances[id])
    .filter((inst): inst is CardInstance => !!inst && inst.card.type === 'minion');
}

function getAlliedMinionsAtSquare(state: GameState, sq: Square, playerId: string): CardInstance[] {
  return getMinionsAtSquare(state, sq).filter((inst) => inst.controllerId === playerId);
}

function getEnemyMinionsAtSquare(state: GameState, sq: Square, playerId: string): CardInstance[] {
  return getMinionsAtSquare(state, sq).filter((inst) => inst.controllerId !== playerId);
}

// ─── Savior deck: Genesis resolvers ─────────────────────────────────────────

// Virgin in Prayer — "Genesis → Ward an allied minion."
// Auto-wards the nearest allied minion (excluding self). If none, does nothing.
registerTriggerResolver('virgin_in_prayer', 'genesis', (state, instance) => {
  if (!instance.location) return;
  const sq = instance.location.square;
  const playerId = instance.controllerId;

  // Look at same square first, then adjacent
  const candidates: CardInstance[] = [];
  const selfSquare = getMinionsAtSquare(state, sq)
    .filter((m) => m.instanceId !== instance.instanceId && m.controllerId === playerId);
  candidates.push(...selfSquare);

  for (const adj of adjacentSquares(sq)) {
    candidates.push(...getAlliedMinionsAtSquare(state, adj, playerId));
  }

  // Ward the first un-warded candidate
  const target = candidates.find((m) => !m.tokens.includes('ward'));
  if (target) applyWard(target);
});

// Nightwatchmen — "Genesis → Ward this site."
registerTriggerResolver('nightwatchmen', 'genesis', (state, instance) => {
  if (!instance.location) return;
  const { row, col } = instance.location.square;
  const cell = state.realm[row][col];
  if (!cell.siteInstanceId) return;
  const site = state.instances[cell.siteInstanceId];
  if (site) applyWard(site);
});

// Town Priest — "Genesis → Return target adjacent Evil minion to its owner's hand."
// Auto-picks the first adjacent enemy minion (Evil subtype check via typeLine).
registerTriggerResolver('town_priest', 'genesis', (state, instance) => {
  if (!instance.location) return;
  const sq = instance.location.square;

  for (const adj of adjacentSquares(sq)) {
    const enemies = getEnemyMinionsAtSquare(state, adj, instance.controllerId);
    for (const enemy of enemies) {
      const typeLine = (enemy.card.typeLine ?? '').toLowerCase();
      const isEvil = typeLine.includes('evil') ||
        ('subtypes' in enemy.card && (enemy.card.subtypes as string[]).some(
          (s) => s.toLowerCase() === 'evil'));
      if (isEvil) {
        // Return to owner's hand
        if (enemy.location) {
          const { row: r, col: c } = enemy.location.square;
          const cell = state.realm[r][c];
          cell.unitInstanceIds = cell.unitInstanceIds.filter((id) => id !== enemy.instanceId);
          cell.subsurfaceUnitIds = cell.subsurfaceUnitIds.filter((id) => id !== enemy.instanceId);
        }
        enemy.location = null;
        enemy.tapped = false;
        enemy.damage = 0;
        enemy.summoningSickness = false;
        state.players[enemy.ownerId].hand.push(enemy.instanceId);
        return; // Only one target
      }
    }
  }
});

// Guardian Angel — "Genesis → Fly to a weaker allied minion to Ward it."
// Finds the weakest allied minion in the realm, moves there, wards it.
registerTriggerResolver('guardian_angel', 'genesis', (state, instance) => {
  if (!instance.location) return;
  const playerId = instance.controllerId;

  const selfPowerRaw = 'power' in instance.card ? instance.card.power : undefined;
  const selfPower = typeof selfPowerRaw === 'number'
    ? selfPowerRaw
    : selfPowerRaw
      ? Math.max(selfPowerRaw.attack, selfPowerRaw.defense)
      : 0;

  let bestTarget: CardInstance | null = null;
  let bestPower = Infinity;

  for (const inst of Object.values(state.instances)) {
    if (inst.instanceId === instance.instanceId) continue;
    if (inst.controllerId !== playerId) continue;
    if (inst.card.type !== 'minion' || !inst.location) continue;
    const p = typeof inst.card.power === 'number' ? inst.card.power : Math.max(inst.card.power.attack, inst.card.power.defense);
    if (p < selfPower && p < bestPower) {
      bestPower = p;
      bestTarget = inst;
    }
  }

  if (bestTarget?.location) {
    // Move guardian to the target's square
    const fromSq = instance.location.square;
    const toSq = bestTarget.location.square;
    const fromCell = state.realm[fromSq.row][fromSq.col];
    fromCell.unitInstanceIds = fromCell.unitInstanceIds.filter((id) => id !== instance.instanceId);
    const toCell = state.realm[toSq.row][toSq.col];
    if (!toCell.unitInstanceIds.includes(instance.instanceId)) {
      toCell.unitInstanceIds.push(instance.instanceId);
    }
    instance.location = { square: toSq, region: 'surface' };
    // Ward the target
    applyWard(bestTarget);
  }
});

// ─── Savior deck: Site genesis resolvers ────────────────────────────────────

// Blessed Village — "Ward" (site enters play with Ward)
registerTriggerResolver('blessed_village', 'genesis', (_state, instance) => {
  applyWard(instance);
});

// Blessed Well — "Ward" (site enters play with Ward)
registerTriggerResolver('blessed_well', 'genesis', (_state, instance) => {
  applyWard(instance);
});

// Algae Bloom — "Genesis → Provides (A)(E)(F) this turn."
// Temporarily adds air, earth, fire affinity via counters (cleared at end of turn).
registerTriggerResolver('algae_bloom', 'genesis', (_state, instance) => {
  instance.counters['temp_air'] = (instance.counters['temp_air'] ?? 0) + 1;
  instance.counters['temp_earth'] = (instance.counters['temp_earth'] ?? 0) + 1;
  instance.counters['temp_fire'] = (instance.counters['temp_fire'] ?? 0) + 1;
});

// Autumn Bloom — "Genesis → Provides (A)(F)(W) this turn."
registerTriggerResolver('autumn_bloom', 'genesis', (_state, instance) => {
  instance.counters['temp_air'] = (instance.counters['temp_air'] ?? 0) + 1;
  instance.counters['temp_fire'] = (instance.counters['temp_fire'] ?? 0) + 1;
  instance.counters['temp_water'] = (instance.counters['temp_water'] ?? 0) + 1;
});

// Mudslide — "Genesis → Slide all units at land sites in this column one step left or right."
// Simplification: slide left by default; if no left column exists, slide right.
registerTriggerResolver('mudslide', 'genesis', (state, instance) => {
  if (!instance.location) return;
  const { col } = instance.location.square;
  const targetCol = col > 0 ? col - 1 : col + 1;
  const REALM_COLS = 5;
  if (targetCol < 0 || targetCol >= REALM_COLS) return;

  for (let row = 0; row < state.realm.length; row++) {
    const cell = state.realm[row][col];
    if (!cell.siteInstanceId) continue;
    const site = state.instances[cell.siteInstanceId];
    if (!site || site.card.type !== 'site') continue;
    // Only slide from land sites
    if (site.card.isWaterSite) continue;

    const destCell = state.realm[row][targetCol];
    // Move surface units
    for (const unitId of [...cell.unitInstanceIds]) {
      const unit = state.instances[unitId];
      if (!unit) continue;
      cell.unitInstanceIds = cell.unitInstanceIds.filter((id) => id !== unitId);
      destCell.unitInstanceIds.push(unitId);
      unit.location = { square: { row, col: targetCol }, region: 'surface' };
    }
    // Move subsurface units (underground)
    for (const unitId of [...cell.subsurfaceUnitIds]) {
      const unit = state.instances[unitId];
      if (!unit) continue;
      cell.subsurfaceUnitIds = cell.subsurfaceUnitIds.filter((id) => id !== unitId);
      destCell.subsurfaceUnitIds.push(unitId);
      if (unit.location) {
        unit.location = { square: { row, col: targetCol }, region: unit.location.region };
      }
    }
  }
});

// ─── Savior deck: Deathrite resolvers ───────────────────────────────────────

// Muddy Pigs — "Deathrite → You heal 3."
registerTriggerResolver('muddy_pigs', 'deathrite', (state, instance) => {
  healPlayer(state, instance.controllerId, 3);
});

// ─── Savior deck: End of turn resolvers ────────────────────────────────────

// Malakhim — "At the end of your turn, untap Malakhim."
registerTriggerResolver('malakhim', 'end_of_turn', (_state, instance) => {
  instance.tapped = false;
});

// Survivors of Serava — "At the end of your turn, if no enemies are nearby, this gains Stealth."
registerTriggerResolver('survivors_of_serava', 'end_of_turn', (state, instance) => {
  if (!instance.location) return;
  const sq = instance.location.square;

  // Check all nearby squares (including own square) for enemies
  const allSquares = [sq, ...nearbySquares(sq)];
  for (const checkSq of allSquares) {
    const cell = state.realm[checkSq.row][checkSq.col];
    for (const unitId of [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]) {
      const unit = state.instances[unitId];
      if (unit && unit.controllerId !== instance.controllerId) return; // enemy found
    }
  }

  // No enemies nearby — gain stealth
  addStatusToken(instance, 'stealth');
});

// ─── Savior deck: On-move resolvers ────────────────────────────────────────

// Flame of the First Ones — "Whenever the flame stops at a new site, you heal 1
// and your opponent loses 1 life."
// Simplification: fires on every movement (any end-of-move square qualifies).
registerTriggerResolver('flame_of_the_first_ones', 'on_move', (state, instance) => {
  healPlayer(state, instance.controllerId, 1);
  const oppId = opponent(instance.controllerId as 'player1' | 'player2');
  const opp = state.players[oppId];
  if (opp.isAtDeathsDoor) return;
  opp.life -= 1;
  if (opp.life <= 0) {
    opp.life = 0;
    opp.isAtDeathsDoor = true;
    opp.deathsDoorTurn = state.turnNumber;
  }
});

// ─── Savior deck: Combat resolvers ─────────────────────────────────────────

// Rowdy Boys — "Untaps after striking Undead."
registerTriggerResolver('rowdy_boys', 'on_strike', (state, instance) => {
  // The on_strike trigger is fired after combat resolution with the defender info.
  // The untap happens regardless — the check for Undead is done at fire time.
  instance.tapped = false;
});
