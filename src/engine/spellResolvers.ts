import type { GameState, Square, CardInstance } from '../types';
import { isWaterSite, nearbySquares, squareDistance } from './utils';
import { killUnit, addStatusToken } from './core/applyAtomicAction';

// ─── Spell targeting descriptors ────────────────────────────────────────────
// Tells the UI what kind of target the spell expects so it can highlight
// the right squares/units and gate clicks.

export type SpellTargeting =
  | { type: 'none' }
  | { type: 'unit'; filter?: (state: GameState, unitId: string, casterId: string) => boolean }
  | { type: 'site'; validSquares: (state: GameState, casterSquare: Square) => Square[] };

// ─── Spell resolver function ────────────────────────────────────────────────
// Receives the game state (already mutated: mana paid, card removed from hand)
// and must apply the spell's effect. Returns an error string or null.

export type SpellResolverFn = (
  state: GameState,
  casterId: string,
  targetSquare?: Square,
  targetInstanceId?: string,
) => string | null;

export interface SpellResolver {
  targeting: SpellTargeting;
  resolve: SpellResolverFn;
}

// ─── Registry ───────────────────────────────────────────────────────────────
const registry = new Map<string, SpellResolver>();

export function registerSpellResolver(cardId: string, resolver: SpellResolver): void {
  registry.set(cardId, resolver);
}

export function getSpellResolver(cardId: string): SpellResolver | undefined {
  return registry.get(cardId);
}

// ─── Built-in resolvers ─────────────────────────────────────────────────────

// Boil — "Destroy all minions occupying target water site up to two steps away."
registerSpellResolver('boil', {
  targeting: {
    type: 'site',
    validSquares: (state, casterSquare) => {
      const squares: Square[] = [];
      for (const row of state.realm) {
        for (const cell of row) {
          const sq = { row: cell.row, col: cell.col };
          if (squareDistance(casterSquare, sq) > 2) continue;
          if (!isWaterSite(state, sq)) continue;
          squares.push(sq);
        }
      }
      return squares;
    },
  },
  resolve: (state, casterId, targetSquare) => {
    if (!targetSquare) return 'Must specify a target square';
    if (!isWaterSite(state, targetSquare)) return 'Target must be a water site';
    const casterInst = state.instances[casterId];
    if (!casterInst?.location) return 'Caster has no location';
    if (squareDistance(casterInst.location.square, targetSquare) > 2) return 'Target is too far away';
    const cell = state.realm[targetSquare.row][targetSquare.col];
    const allUnitIds = [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds];
    for (const unitId of allUnitIds) {
      const inst = state.instances[unitId];
      if (inst && inst.card.type === 'minion') {
        killUnit(state, inst);
      }
    }
    return null;
  },
});

// Baptize — "Ward each allied minion at target water site."
registerSpellResolver('baptize', {
  targeting: {
    type: 'site',
    validSquares: (state, _casterSquare) => {
      const squares: Square[] = [];
      for (const row of state.realm) {
        for (const cell of row) {
          const sq = { row: cell.row, col: cell.col };
          if (!isWaterSite(state, sq)) continue;
          squares.push(sq);
        }
      }
      return squares;
    },
  },
  resolve: (state, casterId, targetSquare) => {
    if (!targetSquare) return 'Must specify a target square';
    if (!isWaterSite(state, targetSquare)) return 'Target must be a water site';
    const casterInst = state.instances[casterId];
    if (!casterInst) return 'Caster not found';
    const cell = state.realm[targetSquare.row][targetSquare.col];
    for (const unitId of [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]) {
      const inst = state.instances[unitId];
      if (inst && inst.card.type === 'minion' && inst.controllerId === casterInst.controllerId) {
        addStatusToken(inst, 'ward');
      }
    }
    return null;
  },
});

// Divine Lance — "Deal 1 damage to each minion at target site.
// You may break any number of allied Wards to increase the damage by 1 for each."
// For now: auto-breaks all allied wards for maximum damage.
registerSpellResolver('divine_lance', {
  targeting: {
    type: 'site',
    validSquares: (state, _casterSquare) => {
      const squares: Square[] = [];
      for (const row of state.realm) {
        for (const cell of row) {
          if (!cell.siteInstanceId) continue;
          // Any site with minions is a valid target
          if (cell.unitInstanceIds.length > 0 || cell.subsurfaceUnitIds.length > 0) {
            squares.push({ row: cell.row, col: cell.col });
          }
        }
      }
      return squares;
    },
  },
  resolve: (state, casterId, targetSquare) => {
    if (!targetSquare) return 'Must specify a target square';
    const casterInst = state.instances[casterId];
    if (!casterInst) return 'Caster not found';
    const playerId = casterInst.controllerId;

    // Count and break allied wards in the realm
    let wardsBroken = 0;
    for (const inst of Object.values(state.instances)) {
      if (!inst.location) continue;
      if (inst.controllerId !== playerId) continue;
      if (inst.tokens.includes('ward')) {
        inst.tokens = inst.tokens.filter((t) => t !== 'ward');
        wardsBroken++;
      }
    }

    const damage = 1 + wardsBroken;
    const cell = state.realm[targetSquare.row][targetSquare.col];
    for (const unitId of [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]) {
      const inst = state.instances[unitId];
      if (inst && inst.card.type === 'minion') {
        inst.damage += damage;
        // Check if lethal
        const power = typeof inst.card.power === 'number' ? inst.card.power : Math.max(inst.card.power.attack, inst.card.power.defense);
        if (inst.damage >= power) {
          killUnit(state, inst);
        }
      }
    }
    return null;
  },
});

// Holy Nova — "Deal damage to each enemy at affected locations."
// Simplified: 2 damage to each enemy minion at the caster's square and all nearby squares.
// The "break allied Ward to recenter" clause is omitted pending a UI for it.
registerSpellResolver('holy_nova', {
  targeting: { type: 'none' },
  resolve: (state, casterId) => {
    const caster = state.instances[casterId];
    if (!caster?.location) return 'Caster has no location';
    const playerId = caster.controllerId;
    const center = caster.location.square;
    const squares: Square[] = [center, ...nearbySquares(center)];
    for (const sq of squares) {
      const cell = state.realm[sq.row][sq.col];
      for (const unitId of [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]) {
        const inst = state.instances[unitId];
        if (!inst || inst.card.type !== 'minion') continue;
        if (inst.controllerId === playerId) continue;
        // Ward absorbs the damage
        if (inst.tokens.includes('ward')) {
          inst.tokens = inst.tokens.filter((t) => t !== 'ward');
          continue;
        }
        inst.damage += 2;
        const power = typeof inst.card.power === 'number'
          ? inst.card.power
          : Math.max(inst.card.power.attack, inst.card.power.defense);
        if (inst.damage >= power) killUnit(state, inst);
      }
    }
    return null;
  },
});

// Smite — "May be cast by any ally. Strike target adjacent enemy. If it's Evil, banish it instead."
registerSpellResolver('smite', {
  targeting: {
    type: 'unit',
    filter: (state, unitId, casterId) => {
      const target = state.instances[unitId];
      const caster = state.instances[casterId];
      if (!target || !caster || !target.location || !caster.location) return false;
      // Must be enemy
      if (target.controllerId === caster.controllerId) return false;
      // Must be adjacent to caster
      const dist = squareDistance(caster.location.square, target.location.square);
      return dist === 1;
    },
  },
  resolve: (state, casterId, _targetSquare, targetInstanceId) => {
    if (!targetInstanceId) return 'Must specify a target unit';
    const target = state.instances[targetInstanceId];
    const caster = state.instances[casterId];
    if (!target || !caster) return 'Invalid target or caster';

    // Check if Evil
    const typeLine = (target.card.typeLine ?? '').toLowerCase();
    const subtypes = 'subtypes' in target.card ? (target.card.subtypes as string[]) : [];
    const isEvil = typeLine.includes('evil') || subtypes.some((s) => s.toLowerCase() === 'evil');

    if (isEvil) {
      // Banish — remove from game entirely (send to cemetery for now)
      killUnit(state, target);
    } else {
      // Strike — deal damage equal to caster's power
      const casterPower = caster.card.type === 'avatar' ? caster.card.attackPower : 0;
      target.damage += Math.max(casterPower, 1); // at least 1 damage
      if (target.card.type === 'minion') {
        const power = typeof target.card.power === 'number' ? target.card.power : Math.max(target.card.power.attack, target.card.power.defense);
        if (target.damage >= power) killUnit(state, target);
      }
    }
    return null;
  },
});
