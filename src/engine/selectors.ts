import type { CardInstance, ElementalThreshold, GameState, MinionCard, Player, PlayerId, Square } from '../types';
import {
  computeAffinity,
  getManaAvailable,
  getMovementRange,
  isValidMinionPlacement,
  REALM_COLS,
  REALM_ROWS,
  reachableSquares,
  validSitePlacements,
} from './utils';

export function selectValidSitePlacements(state: GameState, playerId: PlayerId): Square[] {
  return validSitePlacements(state, playerId);
}

export function selectReachableSquares(
  state: GameState,
  instance: CardInstance,
): Square[] {
  return reachableSquares(state, instance, getMovementRange(instance));
}

export function selectAffinity(state: GameState, playerId: PlayerId): ElementalThreshold {
  return computeAffinity(state, playerId);
}

export function selectManaAvailable(player: Player): number {
  return getManaAvailable(player);
}

export function selectValidMinionPlacements(
  state: GameState,
  playerId: PlayerId,
  cardInstance: CardInstance,
): Square[] {
  const card = cardInstance.card;
  if (card.type !== 'minion') return [];
  const result: Square[] = [];
  for (let row = 0; row < REALM_ROWS; row++) {
    for (let col = 0; col < REALM_COLS; col++) {
      const square = { row, col };
      if (isValidMinionPlacement(state, playerId, card, cardInstance, square)) {
        result.push(square);
      }
    }
  }
  return result;
}
