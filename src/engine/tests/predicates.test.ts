import { describe, expect, it } from 'vitest';
import { initGame, startGame } from '../gameEngine';
import { evaluateRestriction, registerPredicate } from '../predicates';
import { isValidMinionPlacement } from '../utils';
import { selectValidMinionPlacements } from '../selectors';
import { CARD_REGISTRY } from '../../data/cards';
import { buildFireAtlas, buildFireSpellbook, buildWaterAtlas, buildWaterSpellbook } from '../../data/cards';
import type { CardInstance, GameState, KeywordAbility, MinionCard, PlayerId, PredicateContext, PredicateRestriction, Square } from '../../types';

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
  options?: { isWaterSite?: boolean },
): CardInstance {
  const site = Object.values(game.instances).find(
    (inst) => inst.card.type === 'site' && inst.ownerId === controllerId && !inst.location,
  );
  if (!site || site.card.type !== 'site') throw new Error('No site instance available');
  site.controllerId = controllerId;
  site.location = { square, region: 'surface' };
  site.card = { ...site.card, isWaterSite: options?.isWaterSite ?? site.card.isWaterSite };
  game.realm[square.row][square.col].siteInstanceId = site.instanceId;
  return site;
}

function placeMinion(
  game: GameState,
  square: Square,
  controllerId: PlayerId,
  keywords: KeywordAbility[] = [],
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

function makeCtx(game: GameState, playerId: PlayerId, overrides?: Partial<PredicateContext>): PredicateContext {
  return { state: game, playerId, ...overrides };
}

describe('predicate system', () => {
  // ── Individual predicates ───────────────────────────────────────────────

  describe('instance predicates', () => {
    it('spellcaster returns true for units with spellcaster keyword', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const sq = { row: 3, col: 2 };
      placeSite(game, sq, pid);
      const caster = placeMinion(game, sq, pid, ['spellcaster']);
      const ctx = makeCtx(game, pid, { instance: caster });
      expect(evaluateRestriction(ctx, { all: ['spellcaster'] })).toBe(true);
    });

    it('spellcaster returns false for non-spellcasters', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const sq = { row: 3, col: 2 };
      placeSite(game, sq, pid);
      const unit = placeMinion(game, sq, pid, []);
      const ctx = makeCtx(game, pid, { instance: unit });
      expect(evaluateRestriction(ctx, { all: ['spellcaster'] })).toBe(false);
    });

    it('has_keyword checks for a given keyword', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const sq = { row: 3, col: 2 };
      placeSite(game, sq, pid);
      const unit = placeMinion(game, sq, pid, ['airborne', 'lance']);
      const ctx = makeCtx(game, pid, { instance: unit });
      expect(evaluateRestriction(ctx, { all: [{ predicate: 'has_keyword', params: { keyword: 'airborne' } }] })).toBe(true);
      expect(evaluateRestriction(ctx, { all: [{ predicate: 'has_keyword', params: { keyword: 'burrowing' } }] })).toBe(false);
    });

    it('is_avatar identifies avatar instances', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const avatar = game.instances[game.players[pid].avatarInstanceId];
      const ctx = makeCtx(game, pid, { instance: avatar });
      expect(evaluateRestriction(ctx, { all: ['is_avatar'] })).toBe(true);
    });

    it('is_friendly and is_enemy check controller', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1');
      const myUnit = placeMinion(game, sq, 'player1');
      const enemyUnit = placeMinion(game, sq, 'player2');
      expect(evaluateRestriction(makeCtx(game, 'player1', { instance: myUnit }), { all: ['is_friendly'] })).toBe(true);
      expect(evaluateRestriction(makeCtx(game, 'player1', { instance: enemyUnit }), { all: ['is_enemy'] })).toBe(true);
      expect(evaluateRestriction(makeCtx(game, 'player1', { instance: myUnit }), { all: ['is_enemy'] })).toBe(false);
    });
  });

  // ── Square predicates ──────────────────────────────────────────────────

  describe('square predicates', () => {
    it('on_water_site detects water sites', () => {
      const game = createGame();
      const sq = { row: 1, col: 2 };
      placeSite(game, sq, 'player2', { isWaterSite: true });
      const ctx = makeCtx(game, 'player1', { square: sq });
      expect(evaluateRestriction(ctx, { all: ['on_water_site'] })).toBe(true);
    });

    it('on_land_site detects land sites', () => {
      const game = createGame();
      const sq = { row: 3, col: 2 };
      placeSite(game, sq, 'player1', { isWaterSite: false });
      const ctx = makeCtx(game, 'player1', { square: sq });
      expect(evaluateRestriction(ctx, { all: ['on_land_site'] })).toBe(true);
      expect(evaluateRestriction(ctx, { all: ['on_water_site'] })).toBe(false);
    });

    it('on_void detects empty squares', () => {
      const game = createGame();
      const ctx = makeCtx(game, 'player1', { square: { row: 1, col: 0 } });
      expect(evaluateRestriction(ctx, { all: ['on_void'] })).toBe(true);
    });

    it('column restricts to specific columns', () => {
      const game = createGame();
      const ctx0 = makeCtx(game, 'player1', { square: { row: 0, col: 0 } });
      const ctx2 = makeCtx(game, 'player1', { square: { row: 0, col: 2 } });
      const restriction: PredicateRestriction = { all: [{ predicate: 'column', params: { columns: [0, 4] } }] };
      expect(evaluateRestriction(ctx0, restriction)).toBe(true);
      expect(evaluateRestriction(ctx2, restriction)).toBe(false);
    });

    it('square_has_enemy_unit detects enemy presence', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1');
      placeMinion(game, sq, 'player2');
      const ctx = makeCtx(game, 'player1', { square: sq });
      expect(evaluateRestriction(ctx, { all: ['square_has_enemy_unit'] })).toBe(true);
    });

    it('adjacent_to_friendly_unit checks adjacent squares', () => {
      const game = createGame();
      const unitSq = { row: 2, col: 2 };
      const adjSq = { row: 2, col: 3 };
      placeSite(game, unitSq, 'player1');
      placeMinion(game, unitSq, 'player1');
      const ctx = makeCtx(game, 'player1', { square: adjSq });
      expect(evaluateRestriction(ctx, { all: ['adjacent_to_friendly_unit'] })).toBe(true);
      const farSq = { row: 0, col: 0 };
      const farCtx = makeCtx(game, 'player1', { square: farSq });
      expect(evaluateRestriction(farCtx, { all: ['adjacent_to_friendly_unit'] })).toBe(false);
    });

    it('on_owner_back_row is player-relative', () => {
      const game = createGame();
      // player1 back row = 3, player2 back row = 0
      const ctxP1 = makeCtx(game, 'player1', { square: { row: 3, col: 2 } });
      const ctxP2 = makeCtx(game, 'player2', { square: { row: 0, col: 2 } });
      expect(evaluateRestriction(ctxP1, { all: ['on_owner_back_row'] })).toBe(true);
      expect(evaluateRestriction(ctxP2, { all: ['on_owner_back_row'] })).toBe(true);
      // Wrong rows
      expect(evaluateRestriction(makeCtx(game, 'player1', { square: { row: 0, col: 2 } }), { all: ['on_owner_back_row'] })).toBe(false);
    });
  });

  // ── Target predicates ──────────────────────────────────────────────────

  describe('target predicates', () => {
    it('target_is_minion checks the target card type', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1');
      const minion = placeMinion(game, sq, 'player1');
      const avatar = game.instances[game.players['player1'].avatarInstanceId];
      expect(evaluateRestriction(makeCtx(game, 'player1', { target: minion }), { all: ['target_is_minion'] })).toBe(true);
      expect(evaluateRestriction(makeCtx(game, 'player1', { target: avatar }), { all: ['target_is_minion'] })).toBe(false);
    });

    it('target_is_enemy checks controller relative to player', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1');
      const enemyUnit = placeMinion(game, sq, 'player2');
      expect(evaluateRestriction(makeCtx(game, 'player1', { target: enemyUnit }), { all: ['target_is_enemy'] })).toBe(true);
      expect(evaluateRestriction(makeCtx(game, 'player2', { target: enemyUnit }), { all: ['target_is_enemy'] })).toBe(false);
    });

    it('target_has_keyword checks keywords on target', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1');
      const unit = placeMinion(game, sq, 'player1', ['stealth']);
      const restriction: PredicateRestriction = { all: [{ predicate: 'target_has_keyword', params: { keyword: 'stealth' } }] };
      expect(evaluateRestriction(makeCtx(game, 'player1', { target: unit }), restriction)).toBe(true);
    });
  });

  // ── Composition ────────────────────────────────────────────────────────

  describe('composition (all/any/not)', () => {
    it('all requires every predicate to pass', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1', { isWaterSite: true });
      placeMinion(game, sq, 'player2');
      const ctx = makeCtx(game, 'player1', { square: sq });
      // Both: water site AND enemy unit
      expect(evaluateRestriction(ctx, { all: ['on_water_site', 'square_has_enemy_unit'] })).toBe(true);
      // Add a failing condition
      expect(evaluateRestriction(ctx, { all: ['on_water_site', 'on_void'] })).toBe(false);
    });

    it('any requires at least one predicate to pass', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1', { isWaterSite: false });
      const ctx = makeCtx(game, 'player1', { square: sq });
      expect(evaluateRestriction(ctx, { any: ['on_water_site', 'on_land_site'] })).toBe(true);
      expect(evaluateRestriction(ctx, { any: ['on_water_site', 'on_void'] })).toBe(false);
    });

    it('not excludes matching predicates', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1', { isWaterSite: true });
      const ctx = makeCtx(game, 'player1', { square: sq });
      expect(evaluateRestriction(ctx, { not: ['on_land_site'] })).toBe(true);
      expect(evaluateRestriction(ctx, { not: ['on_water_site'] })).toBe(false);
    });

    it('nested groups compose recursively', () => {
      const game = createGame();
      const sq = { row: 2, col: 2 };
      placeSite(game, sq, 'player1', { isWaterSite: true });
      placeMinion(game, sq, 'player2');
      const ctx = makeCtx(game, 'player1', { square: sq });

      // water site AND (enemy OR column 0,4)
      const restriction: PredicateRestriction = {
        all: [
          'on_water_site',
          { group: {
            any: ['square_has_enemy_unit', { predicate: 'column', params: { columns: [0, 4] } }],
          }},
        ],
      };
      expect(evaluateRestriction(ctx, restriction)).toBe(true);
    });

    it('empty restriction passes by default', () => {
      const game = createGame();
      const ctx = makeCtx(game, 'player1', { square: { row: 0, col: 0 } });
      expect(evaluateRestriction(ctx, {})).toBe(true);
    });
  });

  // ── Placement integration ──────────────────────────────────────────────

  describe('placement restrictions', () => {
    it('unrestricted minion passes placement check everywhere', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const sq = { row: 3, col: 2 };
      placeSite(game, sq, pid);
      const minion = Object.values(game.instances).find(
        (inst) => inst.card.type === 'minion' && inst.ownerId === pid && !inst.location,
      )!;
      expect(isValidMinionPlacement(game, pid, minion.card, minion, sq)).toBe(true);
    });

    it('column restriction limits valid squares', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const minion = Object.values(game.instances).find(
        (inst) => inst.card.type === 'minion' && inst.ownerId === pid && !inst.location,
      )!;
      (minion.card as MinionCard).placementRestriction = {
        all: [{ predicate: 'column', params: { columns: [0, 4] } }],
      };
      expect(isValidMinionPlacement(game, pid, minion.card, minion, { row: 3, col: 0 })).toBe(true);
      expect(isValidMinionPlacement(game, pid, minion.card, minion, { row: 3, col: 2 })).toBe(false);
      expect(isValidMinionPlacement(game, pid, minion.card, minion, { row: 3, col: 4 })).toBe(true);
    });

    it('water site + enemy unit compound restriction', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const waterSq = { row: 2, col: 2 };
      const landSq = { row: 3, col: 2 };
      placeSite(game, waterSq, pid, { isWaterSite: true });
      placeSite(game, landSq, pid, { isWaterSite: false });
      placeMinion(game, waterSq, 'player2');

      const minion = Object.values(game.instances).find(
        (inst) => inst.card.type === 'minion' && inst.ownerId === pid && !inst.location,
      )!;
      (minion.card as MinionCard).placementRestriction = {
        all: ['on_water_site', 'square_has_enemy_unit'],
      };
      expect(isValidMinionPlacement(game, pid, minion.card, minion, waterSq)).toBe(true);
      expect(isValidMinionPlacement(game, pid, minion.card, minion, landSq)).toBe(false);
    });

    it('Weathered Trunks selector only returns allied sites with enemy occupants', () => {
      const game = createGame();
      const pid: PlayerId = 'player1';
      const enemyId: PlayerId = 'player2';
      const targetWithEnemy = { row: 2, col: 1 };
      const targetWithoutEnemy = { row: 2, col: 2 };
      placeSite(game, targetWithEnemy, pid, { isWaterSite: false });
      placeSite(game, targetWithoutEnemy, pid, { isWaterSite: false });
      placeMinion(game, targetWithEnemy, enemyId);

      const minion = Object.values(game.instances).find(
        (inst) => inst.card.type === 'minion' && inst.ownerId === pid && !inst.location,
      )!;
      const weathered = CARD_REGISTRY.weathered_trunks;
      if (!weathered || weathered.type !== 'minion') throw new Error('Weathered Trunks card definition missing');
      minion.cardId = 'weathered_trunks';
      minion.card = weathered;

      const valid = selectValidMinionPlacements(game, pid, minion);
      expect(valid).toContainEqual(targetWithEnemy);
      expect(valid).not.toContainEqual(targetWithoutEnemy);
    });
  });

  // ── Custom predicate registration ─────────────────────────────────────

  describe('custom predicate registration', () => {
    it('allows registering and using custom predicates', () => {
      registerPredicate('test_always_true', () => true);
      registerPredicate('test_always_false', () => false);
      const game = createGame();
      const ctx = makeCtx(game, 'player1');
      expect(evaluateRestriction(ctx, { all: ['test_always_true'] })).toBe(true);
      expect(evaluateRestriction(ctx, { all: ['test_always_false'] })).toBe(false);
      expect(evaluateRestriction(ctx, { any: ['test_always_false', 'test_always_true'] })).toBe(true);
    });

    it('custom predicate receives params', () => {
      registerPredicate('test_min_col', (ctx, params) => {
        if (!ctx.square || !params?.min) return false;
        return ctx.square.col >= (params.min as number);
      });
      const game = createGame();
      const ctx3 = makeCtx(game, 'player1', { square: { row: 0, col: 3 } });
      const ctx1 = makeCtx(game, 'player1', { square: { row: 0, col: 1 } });
      const restriction: PredicateRestriction = { all: [{ predicate: 'test_min_col', params: { min: 2 } }] };
      expect(evaluateRestriction(ctx3, restriction)).toBe(true);
      expect(evaluateRestriction(ctx1, restriction)).toBe(false);
    });

    it('throws on unknown predicate name', () => {
      const game = createGame();
      const ctx = makeCtx(game, 'player1');
      expect(() => evaluateRestriction(ctx, { all: ['nonexistent_predicate_xyz'] })).toThrow('Unknown predicate');
    });
  });
});
