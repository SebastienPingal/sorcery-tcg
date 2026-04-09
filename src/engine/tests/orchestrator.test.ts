import { describe, expect, it } from 'vitest';
import { initGame, startGame } from '../gameEngine';
import { dispatchPlayerAction, getEventLog } from '../orchestrator';
import { buildFireAtlas, buildFireSpellbook, buildWaterAtlas, buildWaterSpellbook } from '../../data/cards';
import type { CardInstance, GameState, KeywordAbility, PlayerId, Square } from '../../types';

function createGame(): GameState {
  const game = initGame({
    player1: {
      name: 'Player 1',
      avatarId: 'sorcerer',
      atlasIds: buildFireAtlas(),
      spellbookIds: buildFireSpellbook(),
    },
    player2: {
      name: 'Player 2',
      avatarId: 'sparkmage',
      atlasIds: buildWaterAtlas(),
      spellbookIds: buildWaterSpellbook(),
    },
    firstPlayer: 'player1',
  });
  game.pendingInteraction = null;
  startGame(game);
  return game;
}

function placeSite(
  game: GameState,
  square: Square,
  controllerId: PlayerId,
  options?: { isWaterSite?: boolean; flooded?: boolean },
): CardInstance {
  const site = Object.values(game.instances).find(
    (inst) => inst.card.type === 'site' && inst.ownerId === controllerId && !inst.location,
  );
  if (!site || site.card.type !== 'site') throw new Error('No site instance available');
  site.controllerId = controllerId;
  site.location = { square, region: 'surface' };
  site.card = { ...site.card, isWaterSite: options?.isWaterSite ?? site.card.isWaterSite };
  if (options?.flooded) {
    site.temporaryAbilities.push({
      id: `flooded_${square.row}_${square.col}`,
      trigger: 'passive',
      keyword: 'flooded',
      description: 'Flooded',
      effect: { type: 'noop' },
    });
  }
  game.realm[square.row][square.col].siteInstanceId = site.instanceId;
  return site;
}

function placeMinion(
  game: GameState,
  square: Square,
  controllerId: PlayerId,
  keywords: KeywordAbility[],
  region: 'surface' | 'underground' | 'underwater' | 'void' = 'surface',
): CardInstance {
  const minion = Object.values(game.instances).find(
    (inst) => inst.card.type === 'minion' && inst.ownerId === controllerId && !inst.location,
  );
  if (!minion || minion.card.type !== 'minion') throw new Error('No minion instance available');
  minion.controllerId = controllerId;
  minion.location = { square, region };
  minion.tapped = false;
  minion.summoningSickness = false;
  minion.card = { ...minion.card, keywords };
  const cell = game.realm[square.row][square.col];
  if (region === 'underground' || region === 'underwater') cell.subsurfaceUnitIds.push(minion.instanceId);
  else cell.unitInstanceIds.push(minion.instanceId);
  return minion;
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

  it('allows airborne units to move diagonally', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    game.activePlayerId = pid;
    const start = { row: 1, col: 1 };
    const target = { row: 0, col: 0 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, target, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['airborne']);

    const err = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [target] });
    expect(err).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: target, region: 'surface' });
  });

  it('allows burrowing descent and blocks underground travel through water sites', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 2, col: 1 };
    const landStep = { row: 2, col: 2 };
    const waterStep = { row: 2, col: 3 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, landStep, pid, { isWaterSite: false });
    placeSite(game, waterStep, pid, { isWaterSite: true });
    const minion = placeMinion(game, start, pid, ['burrowing']);

    const descendErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [start] });
    expect(descendErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: start, region: 'underground' });

    game.instances[minion.instanceId].tapped = false;
    const tunnelErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [landStep] });
    expect(tunnelErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: landStep, region: 'underground' });

    game.instances[minion.instanceId].tapped = false;
    const invalidErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [waterStep] });
    expect(invalidErr).toBe('Burrowing units can only move underground through land sites');
  });

  it('allows submerge descent and blocks underwater travel through non-water sites', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 2, col: 1 };
    const waterStep = { row: 2, col: 2 };
    const landStep = { row: 2, col: 3 };
    placeSite(game, start, pid, { isWaterSite: true });
    placeSite(game, waterStep, pid, { isWaterSite: true });
    placeSite(game, landStep, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['submerge']);

    const submergeErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [start] });
    expect(submergeErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: start, region: 'underwater' });

    game.instances[minion.instanceId].tapped = false;
    const swimErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [waterStep] });
    expect(swimErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: waterStep, region: 'underwater' });

    game.instances[minion.instanceId].tapped = false;
    const invalidErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [landStep] });
    expect(invalidErr).toBe('Submerged units can only move underwater through water sites');
  });

  it('allows voidwalk movement into void and back onto a site', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 1, col: 1 };
    const voidSq = { row: 1, col: 2 };
    const destination = { row: 1, col: 3 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, destination, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['voidwalk']);

    const intoVoidErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [voidSq] });
    expect(intoVoidErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: voidSq, region: 'void' });

    game.instances[minion.instanceId].tapped = false;
    const outErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [destination] });
    expect(outErr).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: destination, region: 'surface' });
  });

  it('treats flooded sites as water for waterbound movement checks', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const drySquare = { row: 0, col: 0 };
    const floodedSquare = { row: 0, col: 1 };
    placeSite(game, drySquare, pid, { isWaterSite: false });
    placeSite(game, floodedSquare, pid, { isWaterSite: false, flooded: true });

    const dryMinion = placeMinion(game, drySquare, pid, ['waterbound']);
    const dryErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: dryMinion.instanceId, path: [] });
    expect(dryErr).toBe('Waterbound unit is disabled off water locations');

    const floodedMinion = placeMinion(game, floodedSquare, pid, ['waterbound']);
    const floodedErr = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: floodedMinion.instanceId, path: [] });
    expect(floodedErr).toBeNull();
  });

  it('allows casting a voidwalk minion onto rubble (void destination)', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const player = game.players[pid];
    player.manaPool = 99;
    player.manaUsed = 0;
    player.elementalAffinity = { air: 99, earth: 99, fire: 99, water: 99 };

    const targetSquare = { row: 2, col: 2 };
    const rubble = placeSite(game, targetSquare, pid, { isWaterSite: false });
    rubble.isRubble = true;

    const minionId = Object.values(game.instances).find(
      (inst) => inst.ownerId === pid && inst.card.type === 'minion' && !inst.location,
    )?.instanceId;
    if (!minionId) throw new Error('No minion instance available');
    if (!player.hand.includes(minionId)) player.hand.push(minionId);
    const minionInst = game.instances[minionId];
    if (minionInst.card.type !== 'minion') throw new Error('Expected minion');
    minionInst.card = { ...minionInst.card, keywords: ['voidwalk'] };

    const err = dispatchPlayerAction(game, {
      type: 'CAST_SPELL',
      casterId: player.avatarInstanceId,
      cardInstanceId: minionId,
      targetSquare,
    });
    expect(err).toBeNull();
    expect(game.instances[minionId].location).toEqual({ square: targetSquare, region: 'void' });
  });

  it('allows summoning burrowing minions underground on land sites', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const player = game.players[pid];
    player.manaPool = 99;
    player.manaUsed = 0;
    player.elementalAffinity = { air: 99, earth: 99, fire: 99, water: 99 };

    const targetSquare = { row: 1, col: 1 };
    placeSite(game, targetSquare, pid, { isWaterSite: false });
    const minionId = Object.values(game.instances).find(
      (inst) => inst.ownerId === pid && inst.card.type === 'minion' && !inst.location,
    )?.instanceId;
    if (!minionId) throw new Error('No minion instance available');
    if (!player.hand.includes(minionId)) player.hand.push(minionId);
    const minionInst = game.instances[minionId];
    if (minionInst.card.type !== 'minion') throw new Error('Expected minion');
    minionInst.card = { ...minionInst.card, keywords: ['burrowing'] };

    const err = dispatchPlayerAction(game, {
      type: 'CAST_SPELL',
      casterId: player.avatarInstanceId,
      cardInstanceId: minionId,
      targetSquare,
      targetRegion: 'underground',
    });
    expect(err).toBeNull();
    expect(game.instances[minionId].location).toEqual({ square: targetSquare, region: 'underground' });
  });

  it('allows summoning submerge minions underwater on water sites', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const player = game.players[pid];
    player.manaPool = 99;
    player.manaUsed = 0;
    player.elementalAffinity = { air: 99, earth: 99, fire: 99, water: 99 };

    const targetSquare = { row: 1, col: 1 };
    placeSite(game, targetSquare, pid, { isWaterSite: true });
    const minionId = Object.values(game.instances).find(
      (inst) => inst.ownerId === pid && inst.card.type === 'minion' && !inst.location,
    )?.instanceId;
    if (!minionId) throw new Error('No minion instance available');
    if (!player.hand.includes(minionId)) player.hand.push(minionId);
    const minionInst = game.instances[minionId];
    if (minionInst.card.type !== 'minion') throw new Error('Expected minion');
    minionInst.card = { ...minionInst.card, keywords: ['submerge'] };

    const err = dispatchPlayerAction(game, {
      type: 'CAST_SPELL',
      casterId: player.avatarInstanceId,
      cardInstanceId: minionId,
      targetSquare,
      targetRegion: 'underwater',
    });
    expect(err).toBeNull();
    expect(game.instances[minionId].location).toEqual({ square: targetSquare, region: 'underwater' });
  });

  it('allows charge units to move despite summoning sickness', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 1, col: 1 };
    const destination = { row: 1, col: 2 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, destination, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['charge']);
    minion.summoningSickness = true;

    const err = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [destination] });
    expect(err).toBeNull();
    expect(game.instances[minion.instanceId].location).toEqual({ square: destination, region: 'surface' });
  });

  it('rejects movement actions for disabled units', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 1, col: 1 };
    const destination = { row: 1, col: 2 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, destination, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['disable']);

    const err = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [destination] });
    expect(err).toBe('Disabled units cannot move or attack');
  });

  it('rejects steps for immobile units', () => {
    const game = createGame();
    const pid: PlayerId = game.activePlayerId;
    const start = { row: 1, col: 1 };
    const destination = { row: 1, col: 2 };
    placeSite(game, start, pid, { isWaterSite: false });
    placeSite(game, destination, pid, { isWaterSite: false });
    const minion = placeMinion(game, start, pid, ['immobile']);

    const err = dispatchPlayerAction(game, { type: 'MOVE_AND_ATTACK', unitId: minion.instanceId, path: [destination] });
    expect(err).toBe('Immobile units cannot take steps');
  });

  it('kills minions on any positive damage from lethal sources', () => {
    const game = createGame();
    const attackerId: PlayerId = 'player1';
    const defenderId: PlayerId = 'player2';
    game.activePlayerId = attackerId;
    const square = { row: 1, col: 1 };
    placeSite(game, square, attackerId, { isWaterSite: false });

    const attacker = placeMinion(game, square, attackerId, ['lethal']);
    const defender = placeMinion(game, square, defenderId, []);
    if (attacker.card.type !== 'minion' || defender.card.type !== 'minion') throw new Error('Expected minions');
    attacker.card = { ...attacker.card, power: 1 };
    defender.card = { ...defender.card, power: 8 };

    const err = dispatchPlayerAction(game, {
      type: 'MOVE_AND_ATTACK',
      unitId: attacker.instanceId,
      path: [],
      attackTargetId: defender.instanceId,
    });
    expect(err).toBeNull();
    expect(game.players[defender.ownerId].cemetery).toContain(defender.instanceId);
  });
});
