import type { GameState, Square } from '../types';
import { isWaterSite, squareDistance } from './utils';
import { killUnit } from './core/applyAtomicAction';

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
