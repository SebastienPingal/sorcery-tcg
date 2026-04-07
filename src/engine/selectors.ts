import type { CardInstance, ElementalThreshold, GameState, Player, PlayerId, Square } from '../types';
import {
  computeAffinity,
  getManaAvailable,
  getMovementRange,
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
