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

  it('allows playing a site from hand via avatar ability', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const player = game.players[pid];
    const avatarId = player.avatarInstanceId;
    const avatar = game.instances[avatarId];
    const abilityId = avatar.card.type === 'avatar' ? avatar.card.abilities[0]?.id : '';
    const siteInHand = player.hand.find((id) => game.instances[id]?.card.type === 'site');
    const targetSquare = avatar.location?.square;
    if (!abilityId || !siteInHand || !targetSquare) return;
    const err = dispatchPlayerAction(game, {
      type: 'ACTIVATE_ABILITY',
      playerId: pid,
      abilityId,
      targetSquare,
      siteInstanceId: siteInHand,
    });
    expect(err).toBeNull();
    expect(player.hand.includes(siteInHand)).toBe(false);
    expect(game.realm[targetSquare.row][targetSquare.col].siteInstanceId).toBe(siteInHand);
  });

  it('site attacks do not cause death blow at deaths door', () => {
    const game = createGame();
    game.status = 'playing';
    game.activePlayerId = 'player1';
    const defenderId: PlayerId = 'player2';
    const attackerId: PlayerId = 'player1';
    const defender = game.players[defenderId];
    const attacker = game.players[attackerId];
    defender.isAtDeathsDoor = true;
    defender.deathsDoorTurn = game.turnNumber - 1;
    defender.life = 0;
    const lifeBefore = defender.life;

    const square = { row: 1, col: 1 };
    const site = game.instances[game.players[defenderId].atlasCards[0]];
    site.card = {
      ...site.card,
      type: 'site',
      threshold: {},
      isWaterSite: false,
      abilities: [],
    };
    site.controllerId = defenderId;
    site.location = { square, region: 'surface' };
    game.realm[square.row][square.col].siteInstanceId = site.instanceId;

    const minion = game.instances[game.players[attackerId].spellbookCards.find((id) => game.instances[id].card.type === 'minion')!];
    minion.controllerId = attackerId;
    minion.location = { square, region: 'surface' };
    minion.tapped = false;
    minion.summoningSickness = false;
    game.realm[square.row][square.col].unitInstanceIds.push(minion.instanceId);

    const err = dispatchPlayerAction(game, {
      type: 'MOVE_AND_ATTACK',
      unitId: minion.instanceId,
      path: [],
      attackTargetId: site.instanceId,
    });
    expect(err).toBeNull();
    expect(game.status).not.toBe('ended');
    expect(game.winner).toBeNull();
    expect(defender.life).toBe(lifeBefore);
  });
});
