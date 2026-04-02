import { create } from 'zustand';
import type { GameState, PlayerId, Square } from '../types';
import {
  initGame, startGame, doMulligan, castSpell, playSite,
  activateAvatarAbility, moveAndAttack, advancePhase,
  type GameSetupConfig,
} from '../engine/gameEngine';
import {
  AVATARS,
  buildFireAtlas, buildFireSpellbook,
  buildWaterAtlas, buildWaterSpellbook,
} from '../data/cards';

interface GameStore {
  game: GameState | null;
  selectedInstanceId: string | null;
  hoveredInstanceId: string | null;
  highlightedSquares: Square[];
  actionError: string | null;

  // Setup
  initGame: (config: GameSetupConfig) => void;
  startQuickGame: () => void;

  // Mulligan
  acceptHand: (playerId: PlayerId) => void;
  takeMulligan: (playerId: PlayerId, returnIds: string[]) => void;

  // Game actions
  selectInstance: (instanceId: string | null) => void;
  hoverInstance: (instanceId: string | null) => void;
  castSpell: (casterId: string, cardId: string, targetSquare?: Square, targetId?: string) => void;
  playSite: (playerId: PlayerId, siteId: string, square: Square) => void;
  activateAbility: (playerId: PlayerId, abilityId: string, targetSquare?: Square, siteId?: string) => void;
  moveAndAttack: (unitId: string, path: Square[], attackTargetId?: string) => void;
  endTurn: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedInstanceId: null,
  hoveredInstanceId: null,
  highlightedSquares: [],
  actionError: null,

  initGame: (config) => {
    const game = initGame(config);
    set({ game, selectedInstanceId: null, highlightedSquares: [], actionError: null });
  },

  startQuickGame: () => {
    const config: GameSetupConfig = {
      player1: {
        name: 'Player 1',
        avatarId: AVATARS[2].id, // Sorcerer
        atlasIds: buildFireAtlas(),
        spellbookIds: buildFireSpellbook(),
      },
      player2: {
        name: 'Player 2',
        avatarId: AVATARS[0].id, // Sparkmage
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
    startGame(newGame);
    set({ game: newGame, actionError: null });
  },

  takeMulligan: (playerId, returnIds) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    doMulligan(newGame, playerId, returnIds);
    startGame(newGame);
    set({ game: newGame, actionError: null });
  },

  selectInstance: (instanceId) => {
    set({ selectedInstanceId: instanceId, highlightedSquares: [] });
  },

  hoverInstance: (instanceId) => {
    set({ hoveredInstanceId: instanceId });
  },

  castSpell: (casterId, cardId, targetSquare, targetId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = castSpell(newGame, casterId, cardId, targetSquare, targetId);
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  playSite: (playerId, siteId, square) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = playSite(newGame, playerId, siteId, square);
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
    const err = activateAvatarAbility(newGame, playerId, abilityId, targetSquare, siteId);
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  moveAndAttack: (unitId, path, attackTargetId) => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    const err = moveAndAttack(newGame, unitId, path, attackTargetId);
    if (err) {
      set({ actionError: err });
    } else {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  endTurn: () => {
    const { game } = get();
    if (!game) return;
    const newGame = structuredClone(game);
    advancePhase(newGame);
    if (newGame.phase === 'main') {
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    } else {
      advancePhase(newGame);
      set({ game: newGame, actionError: null, selectedInstanceId: null });
    }
  },

  clearError: () => set({ actionError: null }),
}));
