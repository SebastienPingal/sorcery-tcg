import type {
  Square, CardInstance, GameState, Player, PlayerId,
  RealmSquare, ElementalThreshold, Power, MinionCard, ArtifactCard,
} from '../types';

// ─── UUID ─────────────────────────────────────────────────────────────────────
let _counter = 0;
export function uid(): string {
  return `${Date.now()}-${++_counter}`;
}

// ─── Shuffle ──────────────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────
export const REALM_ROWS = 4;
export const REALM_COLS = 5;

export function makeEmptyRealm(): RealmSquare[][] {
  return Array.from({ length: REALM_ROWS }, (_, row) =>
    Array.from({ length: REALM_COLS }, (_, col) => ({
      row,
      col,
      siteInstanceId: null,
      unitInstanceIds: [],
      artifactInstanceIds: [],
      subsurfaceUnitIds: [],
      auraInstanceIds: [],
    }))
  );
}

export function getSquare(realm: RealmSquare[][], sq: Square): RealmSquare {
  return realm[sq.row][sq.col];
}

export function squareEq(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Returns squares that share a border (no diagonals) */
export function adjacentSquares(sq: Square): Square[] {
  const result: Square[] = [];
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const r = sq.row + dr;
    const c = sq.col + dc;
    if (r >= 0 && r < REALM_ROWS && c >= 0 && c < REALM_COLS) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

/** Returns all squares within 1 step including diagonals */
export function nearbySquares(sq: Square): Square[] {
  const result: Square[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = sq.row + dr;
      const c = sq.col + dc;
      if (r >= 0 && r < REALM_ROWS && c >= 0 && c < REALM_COLS) {
        result.push({ row: r, col: c });
      }
    }
  }
  return result;
}

/** Manhattan distance between two squares */
export function squareDistance(a: Square, b: Square): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// ─── Instance helpers ─────────────────────────────────────────────────────────
export function getInstance(state: GameState, instanceId: string): CardInstance | undefined {
  return state.instances[instanceId];
}

export function getAvatarInstance(state: GameState, playerId: PlayerId): CardInstance {
  const player = state.players[playerId];
  return state.instances[player.avatarInstanceId];
}

export function getAvatarSquare(state: GameState, playerId: PlayerId): Square | null {
  const inst = getAvatarInstance(state, playerId);
  return inst.location?.square ?? null;
}

export function getInstancesOnSquare(state: GameState, sq: Square): CardInstance[] {
  const cell = state.realm[sq.row][sq.col];
  return [
    ...cell.unitInstanceIds,
    ...cell.artifactInstanceIds,
  ].map(id => state.instances[id]).filter(Boolean);
}

// ─── Power helpers ────────────────────────────────────────────────────────────
export function getAttackPower(inst: CardInstance): number {
  const card = inst.card;
  if (card.type === 'minion') {
    const p = (card as MinionCard).power;
    return typeof p === 'number' ? p : p.attack;
  }
  if (card.type === 'avatar') return card.attackPower;
  if (card.type === 'artifact') {
    const p = (card as ArtifactCard).power;
    if (!p) return 0;
    return typeof p === 'number' ? p : p.attack;
  }
  return 0;
}

export function getDefensePower(inst: CardInstance): number {
  const card = inst.card;
  if (card.type === 'minion') {
    const p = (card as MinionCard).power;
    return typeof p === 'number' ? p : p.defense;
  }
  if (card.type === 'avatar') return card.attackPower;
  if (card.type === 'artifact') {
    const p = (card as ArtifactCard).power;
    if (!p) return 0;
    return typeof p === 'number' ? p : p.defense;
  }
  return 0;
}

export function getMaxPower(p: Power): number {
  return typeof p === 'number' ? p : Math.max(p.attack, p.defense);
}

// ─── Elemental helpers ────────────────────────────────────────────────────────
export function computeAffinity(state: GameState, playerId: PlayerId): ElementalThreshold {
  const player = state.players[playerId];
  const affinity: ElementalThreshold = {};
  for (const row of state.realm) {
    for (const cell of row) {
      if (!cell.siteInstanceId) continue;
      const inst = state.instances[cell.siteInstanceId];
      if (!inst || inst.controllerId !== playerId) continue;
      const site = inst.card;
      if (site.type !== 'site') continue;
      for (const [el, val] of Object.entries(site.threshold) as [keyof ElementalThreshold, number][]) {
        affinity[el] = (affinity[el] ?? 0) + (val ?? 0);
      }
    }
  }
  return affinity;
}

export function meetsThreshold(
  affinity: ElementalThreshold,
  required: ElementalThreshold
): boolean {
  for (const [el, req] of Object.entries(required) as [keyof ElementalThreshold, number][]) {
    if ((affinity[el] ?? 0) < (req ?? 0)) return false;
  }
  return true;
}

export function computeMana(state: GameState, playerId: PlayerId): number {
  let mana = 0;
  for (const row of state.realm) {
    for (const cell of row) {
      if (!cell.siteInstanceId) continue;
      const inst = state.instances[cell.siteInstanceId];
      if (inst?.controllerId === playerId && !inst.isRubble) mana++;
    }
  }
  return mana;
}

// ─── Site placement helpers ───────────────────────────────────────────────────
export function validSitePlacements(state: GameState, playerId: PlayerId): Square[] {
  const avatarInst = state.instances[state.players[playerId].avatarInstanceId];
  const avatarSquare = avatarInst.location?.square;

  const valid: Square[] = [];
  const controlledSquares: Square[] = [];

  // Collect all squares with player's sites
  for (const row of state.realm) {
    for (const cell of row) {
      if (cell.siteInstanceId) {
        const inst = state.instances[cell.siteInstanceId];
        if (inst?.controllerId === playerId) {
          controlledSquares.push({ row: cell.row, col: cell.col });
        }
      }
    }
  }

  const isVoidOrRubble = (sq: Square) => {
    const cell = state.realm[sq.row][sq.col];
    if (!cell.siteInstanceId) return true; // void
    const inst = state.instances[cell.siteInstanceId];
    return inst?.isRubble === true;
  };

  if (controlledSquares.length === 0) {
    // First site must be placed on the avatar's own square
    if (!avatarSquare) return [];
    return isVoidOrRubble(avatarSquare) ? [avatarSquare] : [];
  }

  // Must place adjacent to a controlled site
  const seen = new Set<string>();
  for (const sq of controlledSquares) {
    for (const adj of adjacentSquares(sq)) {
      const key = `${adj.row},${adj.col}`;
      if (!seen.has(key) && isVoidOrRubble(adj)) {
        seen.add(key);
        valid.push(adj);
      }
    }
  }
  return valid;
}

// ─── Movement helpers ─────────────────────────────────────────────────────────
export function getMovementRange(inst: CardInstance): number {
  let base = 1;
  for (const ab of inst.card.type === 'minion'
    ? (inst.card as MinionCard).abilities
    : []) {
    if (ab.movementBonus) base += ab.movementBonus;
  }
  for (const ab of inst.temporaryAbilities) {
    if (ab.movementBonus) base += ab.movementBonus;
  }
  return base;
}

export function reachableSquares(
  state: GameState,
  inst: CardInstance,
  range: number
): Square[] {
  const startSq = inst.location?.square;
  if (!startSq) return [];

  const hasAirborne = hasKeyword(inst, 'airborne');

  const visited = new Set<string>();
  const frontier: Array<{ sq: Square; steps: number }> = [{ sq: startSq, steps: 0 }];
  const result: Square[] = [];

  while (frontier.length > 0) {
    const { sq, steps } = frontier.shift()!;
    const key = `${sq.row},${sq.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (steps > 0) result.push(sq);
    if (steps < range) {
      const neighbors = hasAirborne ? nearbySquares(sq) : adjacentSquares(sq);
      for (const n of neighbors) {
        const nKey = `${n.row},${n.col}`;
        if (!visited.has(nKey)) {
          const cell = state.realm[n.row][n.col];
          // Can't move through void unless voidwalk
          if (!cell.siteInstanceId && !hasKeyword(inst, 'voidwalk')) continue;
          frontier.push({ sq: n, steps: steps + 1 });
        }
      }
    }
  }
  return result;
}

export function hasKeyword(inst: CardInstance, keyword: string): boolean {
  const card = inst.card;
  if (card.type === 'minion') {
    if ((card as MinionCard).keywords.includes(keyword as any)) return true;
  }
  for (const ab of [...(card.type === 'minion' ? (card as MinionCard).abilities : []), ...inst.temporaryAbilities]) {
    if (ab.keyword === keyword) return true;
  }
  return false;
}

// ─── Player helpers ───────────────────────────────────────────────────────────
export function opponent(playerId: PlayerId): PlayerId {
  return playerId === 'player1' ? 'player2' : 'player1';
}

export function getManaAvailable(player: Player): number {
  return player.manaPool - player.manaUsed;
}
