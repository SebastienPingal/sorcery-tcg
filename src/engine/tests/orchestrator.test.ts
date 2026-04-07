import { describe, expect, it } from 'vitest';
import { initGame, startGame } from '../gameEngine';
import { dispatchPlayerAction, getEventLog } from '../orchestrator';
import { buildFireAtlas, buildFireSpellbook, buildWaterAtlas, buildWaterSpellbook } from '../../data/cards';
import type { GameState, PlayerId } from '../../types';

function createGame(): GameState {
  const game = initGame({
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
  });
  game.pendingInteraction = null;
  startGame(game);
  return game;
}

describe('engine orchestrator', () => {
  it('appends event log entries for player actions', () => {
    const game = createGame();
    const before = getEventLog(game).length;
    const err = dispatchPlayerAction(game, { type: 'END_TURN' });
    expect(err).toBeNull();
    expect(getEventLog(game).length).toBeGreaterThan(before);
  });

  it('locks undo on information-revealing actions', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    game.pendingInteraction = { type: 'choose_draw', playerId: pid };
    const err = dispatchPlayerAction(game, { type: 'CHOOSE_DRAW', playerId: pid, source: 'atlas' });
    expect(err).toBeNull();
    const runtime = (game as GameState & { __engineRuntime?: { undo: { locked: boolean } } }).__engineRuntime;
    expect(runtime?.undo.locked).toBe(true);
  });

  it('rejects movement for tapped units via check pass', () => {
    const game = createGame();
    const ownUnitId = Object.values(game.instances).find(
      (inst) => inst.controllerId === game.activePlayerId && inst.card.type === 'minion' && inst.location,
    )?.instanceId;
    if (!ownUnitId) return;
    game.instances[ownUnitId].tapped = true;
    const err = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: ownUnitId, path: [] });
    expect(err).toBe('Instance is tapped');
  });
});
