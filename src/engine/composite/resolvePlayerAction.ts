import type { GameState } from '../core/gameState';
import type { AtomicAction, CheckAction, MutationAction, PlayerAction } from '../core/atomicActions';

function endTurnSequence(state: GameState): AtomicAction[] {
  const current = state.activePlayerId;
  return [
    { type: 'CHECK_IS_ACTIVE_PLAYER', playerId: current },
    { type: 'RESET_ALL_DAMAGE' },
    { type: 'CLEAR_MANA', playerId: current },
    { type: 'ADVANCE_PHASE' },
  ];
}

export function decomposePlayerAction(state: GameState, action: PlayerAction): {
  checks: CheckAction[];
  mutations: MutationAction[];
} {
  switch (action.type) {
    case 'CAST_SPELL':
      return {
        checks: [{ type: 'CHECK_IS_ACTIVE_PLAYER', playerId: state.activePlayerId }],
        mutations: [{
          type: 'CAST_SPELL',
          casterId: action.casterId,
          cardInstanceId: action.cardInstanceId,
          targetSquare: action.targetSquare,
          targetInstanceId: action.targetInstanceId,
          targetRegion: action.targetRegion,
        }],
      };
    case 'PLAY_SITE':
      return {
        checks: [{ type: 'CHECK_IS_ACTIVE_PLAYER', playerId: action.playerId }],
        mutations: [{
          type: 'PLAY_SITE',
          playerId: action.playerId,
          siteInstanceId: action.siteInstanceId,
          square: action.targetSquare,
        }],
      };
    case 'MOVE_AND_ATTACK':
      return {
        checks: [
          { type: 'CHECK_IS_ACTIVE_PLAYER', playerId: state.activePlayerId },
          { type: 'CHECK_UNIT_ON_BOARD', instanceId: action.unitId },
          { type: 'CHECK_NOT_TAPPED', instanceId: action.unitId },
          { type: 'CHECK_NO_SUMMONING_SICKNESS', instanceId: action.unitId },
        ],
        mutations: [{
          type: 'MOVE_AND_ATTACK',
          unitId: action.unitId,
          path: action.path,
          attackTargetId: action.attackTargetId,
        }],
      };
    case 'ACTIVATE_ABILITY':
      return {
        checks: [{ type: 'CHECK_IS_ACTIVE_PLAYER', playerId: action.playerId }],
        mutations: [{
          type: 'ACTIVATE_ABILITY',
          playerId: action.playerId,
          abilityId: action.abilityId,
          targetSquare: action.targetSquare,
          siteInstanceId: action.siteInstanceId,
        }],
      };
    case 'CHOOSE_DRAW':
      return {
        checks: [],
        mutations: [{ type: 'CHOOSE_DRAW', playerId: action.playerId, source: action.source }],
      };
    case 'CHOOSE_TARGET':
      return {
        checks: [],
        mutations: [{ type: 'CHOOSE_TARGET', targetId: action.targetId }],
      };
    case 'MULLIGAN':
      return {
        checks: [],
        mutations: [{ type: 'MULLIGAN', playerId: action.playerId, returnIds: action.returnIds }],
      };
    case 'END_TURN': {
      const sequence = endTurnSequence(state);
      return {
        checks: sequence.filter((item): item is CheckAction => item.type.startsWith('CHECK_')),
        mutations: sequence.filter((item): item is MutationAction => !item.type.startsWith('CHECK_')),
      };
    }
    default:
      return { checks: [], mutations: [] };
  }
}
