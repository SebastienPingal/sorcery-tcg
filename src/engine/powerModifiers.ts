import type { CardInstance, GameState } from '../types';
import { registerPowerModifier, registerAuraPowerModifier, registerConditionalKeyword, nearbySquares, adjacentSquares } from './utils';

// ─── Revered Revenant ──────────────────────────────────────────────────────
// "Has 0 power unless adjacent to an allied Ward."
// Base power is 3. If not adjacent to an allied ward, override to 0.
registerPowerModifier('revered_revenant', (inst, state) => {
  if (!inst.location) return { attack: 0, defense: 0 };
  const sq = inst.location.square;
  const playerId = inst.controllerId;

  for (const adj of adjacentSquares(sq)) {
    const cell = state.realm[adj.row][adj.col];
    // Check site for ward
    if (cell.siteInstanceId) {
      const site = state.instances[cell.siteInstanceId];
      if (site && site.controllerId === playerId && site.tokens.includes('ward')) {
        return { attack: 0, defense: 0 }; // Keep base power
      }
    }
    // Check units for ward
    for (const unitId of [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds]) {
      const unit = state.instances[unitId];
      if (unit && unit.controllerId === playerId && unit.tokens.includes('ward')) {
        return { attack: 0, defense: 0 }; // Keep base power
      }
    }
  }

  // No adjacent allied ward found — power becomes 0
  // Base is 3, so return -3 to make it 0
  return { attack: -3, defense: -3 };
});

// ─── Angel Ascendant ───────────────────────────────────────────────────────
// "Has Airborne and +1 power while Warded."
registerPowerModifier('angel_ascendant', (inst, _state) => {
  if (inst.tokens.includes('ward')) {
    return { attack: 1, defense: 1 };
  }
  return { attack: 0, defense: 0 };
});

// Angel Ascendant also gains Airborne while Warded
registerConditionalKeyword('angel_ascendant', (inst, keyword) => {
  return keyword === 'airborne' && inst.tokens.includes('ward');
});

// ─── Search Party ──────────────────────────────────────────────────────────
// "Has +1 power for each Search Party in your cemetery."
registerPowerModifier('search_party', (inst, state) => {
  const player = state.players[inst.controllerId as 'player1' | 'player2'];
  let count = 0;
  for (const id of player.cemetery) {
    const cemeteryInst = state.instances[id];
    if (cemeteryInst && cemeteryInst.cardId === 'search_party') count++;
  }
  return { attack: count, defense: count };
});

// ─── Faith Incarnate ───────────────────────────────────────────────────────
// "Has +2 power for each Ward in the realm."
registerPowerModifier('faith_incarnate', (inst, state) => {
  let wardCount = 0;
  for (const other of Object.values(state.instances)) {
    if (!other.location) continue;
    if (other.tokens.includes('ward')) wardCount++;
  }
  return { attack: wardCount * 2, defense: wardCount * 2 };
});

// ─── Consecrated Ground ────────────────────────────────────────────────────
// Site: "Evil has no power here."
// Any minion with the Evil subtype/typeLine on this site has its power reduced to 0.
registerAuraPowerModifier('consecrated_ground', (source, target, _state) => {
  if (!source.location || !target.location) return { attack: 0, defense: 0 };
  // Target must be on the same square as the Consecrated Ground site
  if (source.location.square.row !== target.location.square.row) return { attack: 0, defense: 0 };
  if (source.location.square.col !== target.location.square.col) return { attack: 0, defense: 0 };
  if (target.card.type !== 'minion') return { attack: 0, defense: 0 };

  const subtypes = 'subtypes' in target.card ? (target.card.subtypes as string[]) : [];
  const typeLine = (target.card.typeLine ?? '').toLowerCase();
  const isEvil = subtypes.some((s) => s.toLowerCase() === 'evil') || typeLine.includes('evil');
  if (!isEvil) return { attack: 0, defense: 0 };

  // Zero out the target's power: negate whatever base they'd have
  const basePower = typeof target.card.power === 'number'
    ? { attack: target.card.power, defense: target.card.power }
    : { attack: target.card.power.attack, defense: target.card.power.defense };
  return { attack: -basePower.attack, defense: -basePower.defense };
});

// ─── Mayor of Milborne ─────────────────────────────────────────────────────
// "Other nearby Mortals have +1 power."
registerAuraPowerModifier('mayor_of_milborne', (source, target, _state) => {
  if (target.instanceId === source.instanceId) return { attack: 0, defense: 0 };
  if (!target.location || !source.location) return { attack: 0, defense: 0 };
  if (target.card.type !== 'minion') return { attack: 0, defense: 0 };
  if (target.controllerId !== source.controllerId) return { attack: 0, defense: 0 };

  // Check if target is a Mortal
  const subtypes = 'subtypes' in target.card ? (target.card.subtypes as string[]) : [];
  const isMortal = subtypes.some((s) => s.toLowerCase() === 'mortal');
  if (!isMortal) return { attack: 0, defense: 0 };

  // Check if target is nearby (within 1 step including diagonals)
  const nearby = nearbySquares(source.location.square);
  const isNearby = nearby.some(
    (sq) => sq.row === target.location!.square.row && sq.col === target.location!.square.col,
  );
  if (!isNearby) return { attack: 0, defense: 0 };

  return { attack: 1, defense: 1 };
});
