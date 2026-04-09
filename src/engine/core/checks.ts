import type { GameState } from './gameState';
import type { CheckAction } from './atomicActions';
import { getManaAvailable, hasKeyword, meetsThreshold } from '../utils';

export class GameError extends Error {}

export function runCheck(state: GameState, action: CheckAction): void {
  switch (action.type) {
    case 'CHECK_IS_ACTIVE_PLAYER':
      if (state.activePlayerId !== action.playerId) throw new GameError('Not active player');
      return;
    case 'CHECK_PHASE':
      if (state.phase !== action.phase) throw new GameError(`Expected phase ${action.phase}`);
      return;
    case 'CHECK_HAS_MANA': {
      const player = state.players[action.playerId];
      if (getManaAvailable(player) < action.amount) throw new GameError('Not enough mana');
      return;
    }
    case 'CHECK_ELEMENTAL_THRESHOLD': {
      const player = state.players[action.playerId];
      if (!meetsThreshold(player.elementalAffinity, action.threshold)) {
        throw new GameError('Elemental threshold not met');
      }
      return;
    }
    case 'CHECK_CARD_IN_HAND': {
      const player = state.players[action.playerId];
      if (!player.hand.includes(action.instanceId)) throw new GameError('Card not in hand');
      return;
    }
    case 'CHECK_UNIT_ON_BOARD': {
      const inst = state.instances[action.instanceId];
      if (!inst?.location) throw new GameError('Unit is not on board');
      return;
    }
    case 'CHECK_NOT_TAPPED':
      if (state.instances[action.instanceId]?.tapped) throw new GameError('Instance is tapped');
      return;
    case 'CHECK_NO_SUMMONING_SICKNESS':
      if (state.instances[action.instanceId]?.summoningSickness && !hasKeyword(state.instances[action.instanceId], 'charge')) {
        throw new GameError('Summoning sickness');
      }
      return;
    case 'CHECK_SQUARE_HAS_SITE': {
      const cell = state.realm[action.square.row][action.square.col];
      if (!cell.siteInstanceId) throw new GameError('Square has no site');
      return;
    }
    case 'CHECK_SQUARE_CONTROLLED': {
      const cell = state.realm[action.square.row][action.square.col];
      if (!cell.siteInstanceId) throw new GameError('Square has no site');
      const site = state.instances[cell.siteInstanceId];
      if (site.controllerId !== action.playerId) throw new GameError('Square not controlled');
      return;
    }
    case 'CHECK_TARGET_VALID':
      if (!state.instances[action.targetId]) throw new GameError('Invalid target');
      return;
    case 'CHECK_ABILITY_USABLE': {
      const inst = state.instances[action.instanceId];
      if (!inst) throw new GameError('Instance not found');
      const abilities = (inst.card as { abilities?: Array<{ id: string }> }).abilities ?? [];
      if (!abilities.some((ability) => ability.id === action.abilityId)) {
        throw new GameError('Ability missing');
      }
      return;
    }
    default:
      return;
  }
}

export function runChecks(state: GameState, actions: CheckAction[]): void {
  for (const action of actions) runCheck(state, action);
}
