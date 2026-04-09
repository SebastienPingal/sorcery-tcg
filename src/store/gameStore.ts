import { create } from 'zustand';
import type { GameState, PlayerId, Square } from '../types';
import {
  initGame, startGame,
  type GameSetupConfig,
} from '../engine/gameEngine';
import { dispatchPlayerAction } from '../engine/orchestrator';
import {
  buildFireAtlas, buildFireSpellbook,
  buildWaterAtlas, buildWaterSpellbook,
} from '../data/cards';

interface GameStore {
  game: GameState | null;
  selectedInstanceId: string | null;
  hoveredInstanceId: string | null;
  highlightedSquares: Square[];
  actionError: string | null;
  // Avatar "Play or draw a site" is a two-step action:
  // 1. Player clicks the ability button → pendingAvatarAbility is set
  // 2. Player either picks a site from hand (then a square) OR clicks "Draw"
  // The avatar only taps when the action resolves (step 2).
  pendingAvatarAbility: string | null;
  // Card detail overlay (right-click)
  cardDetailId: string | null;
  // Two-step move/attack: first pick destination, then pick action
  pendingMove: { unitInstanceId: string; destSquare: Square } | null;
  // Square detail overlay (right-click on cell)
  squareDetail: Square | null;

  // Setup
  initGame: (config: GameSetupConfig) => void;
  startQuickGame: () => void;

  // Mulligan
  acceptHand: (playerId: PlayerId) => void;
  takeMulligan: (playerId: PlayerId, returnIds: string[]) => void;

  // Game actions
  selectInstance: (instanceId: string | null) => void;
  hoverInstance: (instanceId: string | null) => void;
  setPendingAvatarAbility: (abilityId: string | null) => void;
  castSpell: (casterId: string, cardId: string, targetSquare?: Square, targetId?: string) => void;
  playSiteViaAbility: (playerId: PlayerId, abilityId: string, siteId: string, square: Square) => void;
  drawSiteViaAbility: (playerId: PlayerId, abilityId: string) => void;
  activateAbility: (playerId: PlayerId, abilityId: string, targetSquare?: Square, siteId?: string) => void;
  moveAndAttack: (unitId: string, path: Square[], attackTargetId?: string) => void;
  setPendingMove: (move: { unitInstanceId: string; destSquare: Square } | null) => void;
  setSquareDetail: (sq: Square | null) => void;
  chooseDrawSource: (playerId: PlayerId, source: 'atlas' | 'spellbook') => void;
  endTurn: () => void;
  clearError: () => void;
  showCardDetail: (instanceId: string | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedInstanceId: null,
  hoveredInstanceId: null,
  highlightedSquares: [],
  actionError: null,
  pendingAvatarAbility: null,
  cardDetailId: null,
  pendingMove: null,
  squareDetail: null,

  initGame: (config) => {
    const game = initGame(config);
    set({ game, selectedInstanceId: null, highlightedSquares: [], actionError: null });
  },

  startQuickGame: () => {
    const config: GameSetupConfig = {
      player1: {
        name: 'Player 1',
        avatarId: 'avatar_sorcerer',
        atlasIds: buildFireAtlas(),
        spellbookIds: buildFireSpellbook(),
      },
      player2: {
        name: 'Player 2',
        avatarId: 'avatar_sparkmage',
        atlasIds: buildWaterAtlas(),
        spellbookIds: buildWaterSpellbook(),
      },
      firstPlayer: 'player1',
    };
    const game = initGame(config);
    set({ game, selectedInstanceId: null, highlightedSquares: [], actionError: null });
  },

  acceptHand: (_playerId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const currentMulliganPlayer = newGame.pendingInteraction?.type === 'mulligan'
      ? newGame.pendingInteraction.playerId : newGame.activePlayerId;
    if (currentMulliganPlayer === newGame.activePlayerId) {
      // First player done → set up second player's mulligan
      const next: import('../types').PlayerId = currentMulliganPlayer === 'player1' ? 'player2' : 'player1';
      newGame.pendingInteraction = { type: 'mulligan', playerId: next };
      set({ game: newGame, actionError: null });
    } else {
      // Second player done → start the game
      newGame.pendingInteraction = null;
      startGame(newGame);
      set({ game: newGame, actionError: null });
    }
  },

  takeMulligan: (playerId, returnIds) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, { type: 'MULLIGAN', playerId, returnIds });
    if (err) {
      set({ actionError: err });
      return;
    }
    const currentMulliganPlayer = playerId;
    if (currentMulliganPlayer === newGame.activePlayerId) {
      // First player done → set up second player's mulligan
      const next: import('../types').PlayerId = currentMulliganPlayer === 'player1' ? 'player2' : 'player1';
      newGame.pendingInteraction = { type: 'mulligan', playerId: next };
      set({ game: newGame, actionError: null });
    } else {
      // Second player done → start the game
      newGame.pendingInteraction = null;
      startGame(newGame);
      set({ game: newGame, actionError: null });
    }
  },

  selectInstance: (instanceId) => {
    set({ selectedInstanceId: instanceId, highlightedSquares: [] });
  },

  hoverInstance: (instanceId) => {
    set({ hoveredInstanceId: instanceId });
  },

  setPendingAvatarAbility: (abilityId) => {
    set({ pendingAvatarAbility: abilityId, selectedInstanceId: null });
  },

  showCardDetail: (instanceId) => {
    set({ cardDetailId: instanceId });
  },

  // Play a site via the Avatar's "Tap → Play or draw a site" ability.
  // The avatar taps as part of resolving this action.
  playSiteViaAbility: (playerId, abilityId, siteId, square) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const avatarId = newGame.players[playerId].avatarInstanceId;
    const avatar = newGame.instances[avatarId];
    if (avatar.tapped) {
      set({ actionError: 'Avatar is already tapped' });
      return;
    }
    let err = dispatchPlayerAction(newGame, {
      type: 'ACTIVATE_ABILITY',
      playerId,
      abilityId,
      targetSquare: square,
      siteInstanceId: siteId,
    });
    if (err && err === 'Ability not found') {
      // Fallback path only for ability-id desync; never bypass tap/cost checks.
      err = dispatchPlayerAction(newGame, {
        type: 'PLAY_SITE',
        playerId,
        siteInstanceId: siteId,
        targetSquare: square,
      });
      if (!err) {
        newGame.instances[avatarId].tapped = true;
      }
    }
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null, pendingAvatarAbility: null });
    }
  },

  // Draw a site via the Avatar's "Tap → Play or draw a site" ability.
  drawSiteViaAbility: (playerId, abilityId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, { type: 'ACTIVATE_ABILITY', playerId, abilityId });
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null, pendingAvatarAbility: null });
    }
  },

  castSpell: (casterId, cardId, targetSquare, targetId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, {
      type: 'CAST_SPELL',
      casterId,
      cardInstanceId: cardId,
      targetSquare,
      targetInstanceId: targetId,
    });
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  activateAbility: (playerId, abilityId, targetSquare, siteId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, {
      type: 'ACTIVATE_ABILITY',
      playerId,
      abilityId,
      targetSquare,
      siteInstanceId: siteId,
    });
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  setPendingMove: (move) => set({ pendingMove: move }),
  setSquareDetail: (sq) => set({ squareDetail: sq }),

  moveAndAttack: (unitId, path, attackTargetId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, { type: 'MOVE_AND_ATTACK', unitId, path, attackTargetId });
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null, pendingMove: null });
    }
  },

  chooseDrawSource: (playerId, source) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = dispatchPlayerAction(newGame, { type: 'CHOOSE_DRAW', playerId, source });
    if (err) set({ actionError: err });
    else set({ game: newGame, actionError: null });
  },

  endTurn: () => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    dispatchPlayerAction(newGame, { type: 'END_TURN' });
    // If the next player has a draw choice pending, stay in start phase — don't skip ahead
    if (newGame.pendingInteraction?.type === 'choose_draw') {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    } else if (newGame.phase !== 'main') {
      dispatchPlayerAction(newGame, { type: 'END_TURN' });
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  clearError: () => set({ actionError: null }),
}));
