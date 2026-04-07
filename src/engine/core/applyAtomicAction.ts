import type { GameState } from './gameState';
import type { MutationAction } from './atomicActions';
import {
  castSpell,
  playSite,
  moveAndAttack,
  activateAvatarAbility,
  chooseDrawSource,
  doMulligan,
  dealDamage,
  drawCards,
  advancePhase,
} from '../gameEngine';
import { opponent } from '../utils';

export function applyAtomicAction(state: GameState, action: MutationAction): string | null {
  switch (action.type) {
    case 'PAY_MANA':
      state.players[action.playerId].manaUsed += action.amount;
      return null;
    case 'MOVE_CARD_FROM_HAND': {
      const owner = state.instances[action.instanceId]?.ownerId;
      if (!owner) return 'Card owner not found';
      state.players[owner].hand = state.players[owner].hand.filter((id) => id !== action.instanceId);
      return null;
    }
    case 'MOVE_CARD_TO_CEMETERY': {
      const owner = state.instances[action.instanceId]?.ownerId;
      if (!owner) return 'Card owner not found';
      state.players[owner].cemetery.push(action.instanceId);
      return null;
    }
    case 'DRAW_CARD':
      drawCards(state, action.playerId, 1, action.deck);
      return null;
    case 'ADVANCE_PHASE':
      advancePhase(state);
      return null;
    case 'SWITCH_ACTIVE_PLAYER':
      state.activePlayerId = opponent(state.activePlayerId);
      return null;
    case 'INCREMENT_TURN':
      state.turnNumber += 1;
      return null;
    case 'CLEAR_MANA':
      state.players[action.playerId].manaUsed = state.players[action.playerId].manaPool;
      return null;
    case 'RESET_ALL_DAMAGE':
      for (const inst of Object.values(state.instances)) {
        if (inst.card.type === 'minion') inst.damage = 0;
      }
      return null;
    case 'SET_PENDING_INTERACTION':
      state.pendingInteraction = action.interaction;
      return null;
    case 'CLEAR_PENDING_INTERACTION':
      state.pendingInteraction = null;
      return null;
    case 'DEAL_DAMAGE':
      return dealDamage(state, action.targetId, action.amount, state.activePlayerId);
    case 'PLAY_SITE_LEGACY':
      return playSite(state, action.playerId, action.siteInstanceId, action.square);
    case 'CAST_SPELL_LEGACY':
      return castSpell(state, action.casterId, action.cardInstanceId, action.targetSquare, action.targetInstanceId);
    case 'MOVE_AND_ATTACK_LEGACY':
      return moveAndAttack(state, action.unitId, action.path, action.attackTargetId);
    case 'ACTIVATE_ABILITY_LEGACY':
      return activateAvatarAbility(state, action.playerId, action.abilityId, action.targetSquare, action.siteInstanceId);
    case 'CHOOSE_DRAW_LEGACY':
      return chooseDrawSource(state, action.playerId, action.source);
    case 'MULLIGAN_LEGACY':
      doMulligan(state, action.playerId, action.returnIds);
      return null;
    case 'PLACE_UNIT':
    case 'PLACE_SITE':
    case 'TAP':
    case 'RECORD_MOVE':
    case 'RECORD_ATTACK':
      return null;
    default:
      return null;
  }
}
