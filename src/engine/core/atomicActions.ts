import type { ElementalThreshold, GamePhase, Location, PlayerId, Region, Square } from '../../types';

export type CheckAction =
  | { type: 'CHECK_IS_ACTIVE_PLAYER'; playerId: PlayerId }
  | { type: 'CHECK_PHASE'; phase: GamePhase }
  | { type: 'CHECK_HAS_MANA'; playerId: PlayerId; amount: number }
  | { type: 'CHECK_ELEMENTAL_THRESHOLD'; playerId: PlayerId; threshold: ElementalThreshold }
  | { type: 'CHECK_CARD_IN_HAND'; playerId: PlayerId; instanceId: string }
  | { type: 'CHECK_UNIT_ON_BOARD'; instanceId: string }
  | { type: 'CHECK_NOT_TAPPED'; instanceId: string }
  | { type: 'CHECK_NO_SUMMONING_SICKNESS'; instanceId: string }
  | { type: 'CHECK_SQUARE_HAS_SITE'; square: Square }
  | { type: 'CHECK_SQUARE_CONTROLLED'; square: Square; playerId: PlayerId }
  | { type: 'CHECK_TARGET_VALID'; targetId: string }
  | { type: 'CHECK_ABILITY_USABLE'; instanceId: string; abilityId: string };

export type MutationAction =
  | { type: 'PAY_MANA'; playerId: PlayerId; amount: number }
  | { type: 'MOVE_CARD_FROM_HAND'; instanceId: string }
  | { type: 'MOVE_CARD_TO_CEMETERY'; instanceId: string }
  | { type: 'PLACE_UNIT'; instanceId: string; location: Location }
  | { type: 'PLACE_SITE'; instanceId: string; square: Square }
  | { type: 'TAP'; instanceId: string }
  | { type: 'RECORD_MOVE'; unitId: string }
  | { type: 'RECORD_ATTACK'; unitId: string }
  | { type: 'DRAW_CARD'; playerId: PlayerId; deck: 'atlas' | 'spellbook' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'SWITCH_ACTIVE_PLAYER' }
  | { type: 'INCREMENT_TURN' }
  | { type: 'CLEAR_MANA'; playerId: PlayerId }
  | { type: 'RESET_ALL_DAMAGE' }
  | { type: 'SET_PENDING_INTERACTION'; interaction: import('../../types').PendingInteraction }
  | { type: 'CLEAR_PENDING_INTERACTION' }
  | { type: 'DEAL_DAMAGE'; sourceId: string; targetId: string; amount: number }
  | { type: 'PLAY_SITE'; playerId: PlayerId; siteInstanceId: string; square: Square }
  | { type: 'CAST_SPELL'; casterId: string; cardInstanceId: string; targetSquare?: Square; targetInstanceId?: string; targetRegion?: Region }
  | { type: 'MOVE_AND_ATTACK'; unitId: string; path: Square[]; attackTargetId?: string }
  | { type: 'ACTIVATE_ABILITY'; playerId: PlayerId; abilityId: string; targetSquare?: Square; siteInstanceId?: string }
  | { type: 'CHOOSE_DRAW'; playerId: PlayerId; source: 'atlas' | 'spellbook' }
  | { type: 'CHOOSE_TARGET'; targetId: string }
  | { type: 'MULLIGAN'; playerId: PlayerId; returnIds: string[] };

export type SequencingAction =
  | { type: 'SELECT_TARGET'; prompt: string; resultKey: string }
  | { type: 'SELECT_SQUARE'; prompt: string; resultKey: string };

export type AtomicAction = CheckAction | MutationAction | SequencingAction;

export type PlayerAction =
  | { type: 'CAST_SPELL'; casterId: string; cardInstanceId: string; targetSquare?: Square; targetInstanceId?: string; targetRegion?: Region }
  | { type: 'PLAY_SITE'; playerId: PlayerId; siteInstanceId: string; targetSquare: Square }
  | { type: 'MOVE_AND_ATTACK'; unitId: string; path: Square[]; attackTargetId?: string }
  | { type: 'ACTIVATE_ABILITY'; playerId: PlayerId; abilityId: string; targetSquare?: Square; siteInstanceId?: string }
  | { type: 'END_TURN' }
  | { type: 'CHOOSE_DRAW'; playerId: PlayerId; source: 'atlas' | 'spellbook' }
  | { type: 'CHOOSE_TARGET'; targetId: string }
  | { type: 'MULLIGAN'; playerId: PlayerId; returnIds: string[] };

export interface EventLogEntry {
  id: string;
  playerActionIndex: number;
  atomicAction: MutationAction;
  timestamp: number;
}

export const INFORMATION_REVEALING_ACTIONS = new Set<MutationAction['type']>([
  'DRAW_CARD',
  'CHOOSE_DRAW',
]);
