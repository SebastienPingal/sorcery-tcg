import type { GameState } from './gameState';
import type { MutationAction } from './atomicActions';
import type { ArtifactCard, CardInstance, MagicCard, MinionCard, PlayerId, Region, Square } from '../../types';
import {
  canCasterCastCard,
  computeAffinity,
  computeMana,
  getAttackPower,
  getEligibleSpellcasters,
  getManaAvailable,
  getMovementRange,
  hasKeyword,
  isValidMinionPlacement,
  isWaterLocation,
  meetsThreshold,
  opponent,
  resolveMovementStep,
  squareDistance,
  squareEq,
  uid,
  validSitePlacements,
} from '../utils';
import { CARD_REGISTRY } from '../../data/cards';
import { getSpellResolver } from '../spellResolvers';
import { fireGenesis, fireDeathrite, fireEndOfTurn, fireOnStrike, fireOnMove } from '../triggerResolvers';
import '../powerModifiers'; // registers card-specific power modifiers

function drawCards(state: GameState, playerId: PlayerId, count: number, from: 'atlas' | 'spellbook'): void {
  const player = state.players[playerId];
  const deck = from === 'atlas' ? player.atlasCards : player.spellbookCards;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      state.winner = opponent(playerId);
      state.status = 'ended';
      return;
    }
    const instanceId = deck.shift()!;
    player.hand.push(instanceId);
  }
}

function sendToCemetery(state: GameState, instanceId: string, ownerId: PlayerId): void {
  const inst = state.instances[instanceId];
  if (!inst) return;
  inst.location = null;
  state.players[ownerId].cemetery.push(instanceId);
}

function hasStatusToken(inst: CardInstance, token: string): boolean {
  return inst.tokens.includes(token);
}

function removeStatusToken(inst: CardInstance, token: string): void {
  inst.tokens = inst.tokens.filter((t) => t !== token);
}

export function addStatusToken(inst: CardInstance, token: string): void {
  if (!hasStatusToken(inst, token)) inst.tokens.push(token);
}

function applyKeywordStatusTokens(inst: CardInstance): void {
  if (hasKeyword(inst, 'lance')) addStatusToken(inst, 'lance');
  if (hasKeyword(inst, 'stealth')) addStatusToken(inst, 'stealth');
  if (hasKeyword(inst, 'ward')) addStatusToken(inst, 'ward');
}

function consumeStealthOnInteract(inst: CardInstance): void {
  removeStatusToken(inst, 'stealth');
}

function consumeLanceOnStrike(state: GameState, inst: CardInstance): void {
  removeStatusToken(inst, 'lance');
  const lanceTokenArtifactId = inst.carriedArtifacts.find((artId) =>
    state.instances[artId]?.tokens.includes('lance_token')
  );
  if (!lanceTokenArtifactId) return;
  inst.carriedArtifacts = inst.carriedArtifacts.filter((id) => id !== lanceTokenArtifactId);
  const lanceTokenInst = state.instances[lanceTokenArtifactId];
  if (!lanceTokenInst) return;
  lanceTokenInst.carriedBy = null;
  sendToCemetery(state, lanceTokenArtifactId, lanceTokenInst.ownerId);
}

function breakWardShield(inst: CardInstance): boolean {
  if (!hasStatusToken(inst, 'ward')) return false;
  removeStatusToken(inst, 'ward');
  return true;
}

function attachLanceTokenIfNeeded(state: GameState, unitInst: CardInstance): void {
  if (!hasKeyword(unitInst, 'lance')) return;
  const hasLanceTokenAlready = unitInst.carriedArtifacts.some((artId) =>
    state.instances[artId]?.tokens.includes('lance_token')
  );
  if (hasLanceTokenAlready) return;

  const lanceCard = CARD_REGISTRY.lance;
  if (!lanceCard || lanceCard.type !== 'artifact') return;

  const lanceTokenInstanceId = `${uid()}-lance-token`;
  const lanceTokenInst: CardInstance = {
    instanceId: lanceTokenInstanceId,
    cardId: lanceCard.id,
    card: lanceCard as ArtifactCard,
    ownerId: unitInst.ownerId,
    controllerId: unitInst.controllerId,
    location: unitInst.location,
    tapped: false,
    damage: 0,
    summoningSickness: false,
    carriedArtifacts: [],
    carriedBy: unitInst.instanceId,
    isRubble: false,
    tokens: ['lance_token'],
    temporaryAbilities: [],
    counters: {},
  };

  state.instances[lanceTokenInstanceId] = lanceTokenInst;
  unitInst.carriedArtifacts.push(lanceTokenInstanceId);
}

function checkDeathsDoor(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  if (player.life <= 0 && !player.isAtDeathsDoor) {
    player.life = 0;
    player.isAtDeathsDoor = true;
    player.deathsDoorTurn = state.turnNumber;
  }
}

function isDeathsDoorImmune(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return player.isAtDeathsDoor && player.deathsDoorTurn === state.turnNumber;
}

export function killUnit(state: GameState, inst: CardInstance): void {
  // Fire deathrite before removing from board (location still valid)
  fireDeathrite(state, inst);
  if (inst.location) {
    const { row, col } = inst.location.square;
    const cell = state.realm[row][col];
    cell.unitInstanceIds = cell.unitInstanceIds.filter((id) => id !== inst.instanceId);
    cell.subsurfaceUnitIds = cell.subsurfaceUnitIds.filter((id) => id !== inst.instanceId);
  }
  for (const artId of inst.carriedArtifacts) {
    const artInst = state.instances[artId];
    if (artInst) artInst.carriedBy = null;
  }
  inst.carriedArtifacts = [];
  sendToCemetery(state, inst.instanceId, inst.ownerId);
}

function dealDamage(state: GameState, targetId: string, amount: number, sourceId?: string): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';
  if (amount > 0 && target.card.type === 'minion' && target.location) {
    const cell = state.realm[target.location.square.row][target.location.square.col];
    const barricadeId = cell.artifactInstanceIds.find((id) => {
      const art = state.instances[id];
      return art && art.cardId === 'makeshift_barricade' && art.controllerId === target.controllerId;
    });
    if (barricadeId) {
      if (amount >= 3) {
        const barricade = state.instances[barricadeId];
        cell.artifactInstanceIds = cell.artifactInstanceIds.filter((id) => id !== barricadeId);
        sendToCemetery(state, barricadeId, barricade.ownerId);
      }
      return null;
    }
  }
  if (amount > 0 && breakWardShield(target)) return null;

  if (target.card.type === 'avatar') {
    const player = state.players[target.controllerId];
    if (player.isAtDeathsDoor) {
      if (!isDeathsDoorImmune(state, target.controllerId)) {
        state.winner = opponent(target.controllerId);
        state.status = 'ended';
      }
    } else {
      player.life -= amount;
      checkDeathsDoor(state, target.controllerId);
    }
    return null;
  }

  if (target.card.type === 'minion') {
    const source = sourceId ? state.instances[sourceId] : null;
    if (amount > 0 && source && hasKeyword(source, 'lethal')) {
      killUnit(state, target);
      return null;
    }
    const card = target.card as MinionCard;
    const maxPower = typeof card.power === 'number' ? card.power : Math.max(card.power.attack, card.power.defense);
    target.damage += amount;
    const threshold = maxPower === 0 ? 1 : maxPower;
    if (target.damage >= threshold) killUnit(state, target);
  }

  return null;
}

function playSite(state: GameState, playerId: PlayerId, siteInstanceId: string, targetSquare: Square): string | null {
  const player = state.players[playerId];
  if (!player.hand.includes(siteInstanceId)) return 'Site not in hand';
  const siteInst = state.instances[siteInstanceId];
  if (siteInst.card.type !== 'site') return 'Not a site card';

  const valid = validSitePlacements(state, playerId);
  if (!valid.some((sq) => squareEq(sq, targetSquare))) return 'Invalid site placement location';

  const cell = state.realm[targetSquare.row][targetSquare.col];
  if (cell.siteInstanceId) {
    const existing = state.instances[cell.siteInstanceId];
    if (!existing.isRubble) return 'Square already has a site';
    sendToCemetery(state, existing.instanceId, existing.ownerId);
  }

  siteInst.location = { square: targetSquare, region: 'surface' };
  siteInst.controllerId = playerId;
  cell.siteInstanceId = siteInstanceId;
  applyKeywordStatusTokens(siteInst);
  player.hand = player.hand.filter((id) => id !== siteInstanceId);
  player.manaPool += 1;
  player.elementalAffinity = computeAffinity(state, playerId);
  fireGenesis(state, siteInst);
  // Re-compute affinity after genesis (e.g. Algae Bloom adds temporary threshold)
  player.elementalAffinity = computeAffinity(state, playerId);
  return null;
}

function castSpell(
  state: GameState,
  casterId: string,
  cardInstanceId: string,
  targetSquare?: Square,
  targetInstanceId?: string,
  targetRegion?: Region,
): string | null {
  const casterInst = state.instances[casterId];
  if (!casterInst) return 'Caster not found';
  if (!casterInst.location) return 'Caster must be in the realm';
  const playerId = casterInst.controllerId;
  const player = state.players[playerId];
  const cardInst = state.instances[cardInstanceId];
  if (!cardInst) return 'Card not found';
  if (!player.hand.includes(cardInstanceId)) return 'Card not in hand';
  const card = cardInst.card;
  if (card.type === 'avatar' || card.type === 'site') return 'Cannot cast this card type as a spell';
  if (hasKeyword(casterInst, 'disable')) return 'Disabled caster cannot cast spells';
  if (!canCasterCastCard(casterInst, card)) return 'Selected caster cannot cast this spell';
  if (casterInst.controllerId !== cardInst.ownerId) return 'Caster must be allied to cast this spell';
  if (getEligibleSpellcasters(state, playerId, card).length === 0) return 'No eligible caster can cast this spell';
  const casterRegion = casterInst.location.region;
  if (targetInstanceId) {
    const targeted = state.instances[targetInstanceId];
    if (!targeted) return 'Target not found';
    if (!targeted.location || targeted.location.region !== casterRegion) {
      return 'Spell target must be in caster region';
    }
  }
  const manaCost = 'manaCost' in card ? card.manaCost : 0;
  if (getManaAvailable(player) < manaCost) return 'Not enough mana';
  if ('threshold' in card && card.threshold && !meetsThreshold(player.elementalAffinity, card.threshold)) {
    return 'Elemental threshold not met';
  }
  player.manaUsed += manaCost;
  player.hand = player.hand.filter((id) => id !== cardInstanceId);

  if (card.type === 'minion') {
    if (!targetSquare) return 'Must specify a target square for minion placement';
    const cell = state.realm[targetSquare.row][targetSquare.col];
    const occupyingSite = cell.siteInstanceId ? state.instances[cell.siteInstanceId] : null;
    const isVoidDestination = !occupyingSite || occupyingSite.isRubble;
    if (isVoidDestination) {
      if (!hasKeyword(cardInst, 'voidwalk')) return 'Target square has no site';
      if (targetRegion && targetRegion !== 'void') return 'Invalid region for void summon';
      if (!isValidMinionPlacement(state, playerId, card, cardInst, targetSquare)) return 'Placement restriction not met';
      cardInst.location = { square: targetSquare, region: 'void' };
      cardInst.summoningSickness = !hasKeyword(cardInst, 'charge');
      cardInst.tapped = false;
      applyKeywordStatusTokens(cardInst);
      attachLanceTokenIfNeeded(state, cardInst);
      cell.unitInstanceIds.push(cardInst.instanceId);
      state.currentTurn.spellsCastCount += 1;
      fireGenesis(state, cardInst);
      return null;
    }
    const siteInst = occupyingSite;
    if (!siteInst) return 'Target square has no site';
    if (siteInst.controllerId !== playerId) return 'Must place on a site you control';
    if (!isValidMinionPlacement(state, playerId, card, cardInst, targetSquare)) return 'Placement restriction not met';
    const isWaterSite = siteInst.card.type === 'site' && (siteInst.card.isWaterSite || hasKeyword(siteInst, 'flooded'));
    const placementRegion: Region = targetRegion ?? 'surface';
    if (placementRegion === 'underground') {
      if (!hasKeyword(cardInst, 'burrowing')) return 'Only burrowing minions can be summoned underground';
      if (isWaterSite) return 'Cannot summon burrowing minions underground at water sites';
    } else if (placementRegion === 'underwater') {
      if (!hasKeyword(cardInst, 'submerge')) return 'Only submerge minions can be summoned underwater';
      if (!isWaterSite) return 'Can only summon underwater at water sites';
    } else if (placementRegion !== 'surface') {
      return 'Invalid summon region';
    }
    cardInst.location = { square: targetSquare, region: placementRegion };
    cardInst.summoningSickness = !hasKeyword(cardInst, 'charge');
    cardInst.tapped = false;
    applyKeywordStatusTokens(cardInst);
    attachLanceTokenIfNeeded(state, cardInst);
    if (placementRegion === 'underground' || placementRegion === 'underwater') {
      cell.subsurfaceUnitIds.push(cardInst.instanceId);
    } else {
      cell.unitInstanceIds.push(cardInst.instanceId);
    }
    state.currentTurn.spellsCastCount += 1;
    fireGenesis(state, cardInst);
    return null;
  }

  if (card.type === 'artifact') {
    if (targetInstanceId) {
      const unitInst = state.instances[targetInstanceId];
      if (!unitInst) return 'Target unit not found';
      if (unitInst.controllerId !== playerId && breakWardShield(unitInst)) {
        sendToCemetery(state, cardInst.instanceId, playerId);
        state.currentTurn.spellsCastCount += 1;
        return null;
      }
      if (unitInst.controllerId !== playerId && hasStatusToken(unitInst, 'stealth')) {
        return 'Cannot target stealth unit';
      }
      cardInst.location = unitInst.location;
      cardInst.carriedBy = targetInstanceId;
      unitInst.carriedArtifacts.push(cardInst.instanceId);
      state.currentTurn.spellsCastCount += 1;
      return null;
    }
    if (targetSquare) {
      const cell = state.realm[targetSquare.row][targetSquare.col];
      if (!cell.siteInstanceId) return 'Target square has no site';
      const siteInst = state.instances[cell.siteInstanceId];
      if (siteInst.controllerId !== playerId) return 'Must place on a site you control';
      cardInst.location = { square: targetSquare, region: 'surface' };
      cell.artifactInstanceIds.push(cardInst.instanceId);
      state.currentTurn.spellsCastCount += 1;
      return null;
    }
    return 'Must specify placement for artifact';
  }

  if (card.type === 'aura') {
    if (!targetSquare) return 'Must specify target square for aura';
    cardInst.location = { square: targetSquare, region: 'surface' };
    state.realm[targetSquare.row][targetSquare.col].auraInstanceIds.push(cardInst.instanceId);
    state.currentTurn.spellsCastCount += 1;
    return null;
  }

  if (card.type === 'magic') {
    // Check for a card-specific spell resolver first
    const resolver = getSpellResolver(card.id);
    if (resolver) {
      const error = resolver.resolve(state, casterId, targetSquare, targetInstanceId);
      if (error) return error;
      sendToCemetery(state, cardInst.instanceId, playerId);
      state.currentTurn.spellsCastCount += 1;
      return null;
    }

    // Fallback: generic deal_damage abilities
    const magic = cardInst.card as MagicCard;
    for (const ability of magic.abilities) {
      if (ability.effect.type === 'deal_damage' && targetInstanceId) {
        const targetInst = state.instances[targetInstanceId];
        if (targetInst && targetInst.controllerId !== playerId) {
          if (breakWardShield(targetInst)) {
            continue;
          }
          if (hasStatusToken(targetInst, 'stealth')) {
            return 'Cannot target stealth unit';
          }
        }
        const error = dealDamage(state, targetInstanceId, ability.effect.amount, cardInst.instanceId);
        if (error) return error;
      }
    }
    sendToCemetery(state, cardInst.instanceId, playerId);
    state.currentTurn.spellsCastCount += 1;
    return null;
  }

  return null;
}

function resolveAttack(state: GameState, attacker: CardInstance, targetId: string): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';
  const attackerLocation = attacker.location;
  const targetLocation = target.location;
  const attackerSq = attackerLocation?.square;
  const targetSq = targetLocation?.square;
  if (!attackerSq || !targetSq || !attackerLocation || !targetLocation) return 'Invalid locations';
  if (target.controllerId !== attacker.controllerId && hasStatusToken(target, 'stealth')) {
    return 'Cannot target stealth unit';
  }
  const sameSquare = squareEq(attackerSq, targetSq);
  const sameRegion = attackerLocation.region === targetLocation.region;
  const canRangedStrike = sameRegion && hasKeyword(attacker, 'ranged') && squareDistance(attackerSq, targetSq) === 1;
  if (target.card.type !== 'site' && !sameRegion) return 'Target must be in same region';
  if (!sameSquare && !canRangedStrike) return "Target must be at attacker's location";

  const attackerHasLance = hasStatusToken(attacker, 'lance');
  const attackerStrikePower = getAttackPower(attacker, state);

  if (target.card.type === 'site') {
    const targetPlayerId = target.controllerId;
    const defender = state.players[targetPlayerId];
    // Site hits are life loss, not avatar damage: they never deliver a death blow.
    // While at Death's Door, life cannot change (no gain/loss through life effects).
    consumeStealthOnInteract(attacker);
    if (attackerHasLance) consumeLanceOnStrike(state, attacker);
    if (defender.isAtDeathsDoor) return null;
    defender.life -= attackerStrikePower;
    checkDeathsDoor(state, targetPlayerId);
    return null;
  }

  if (canRangedStrike && !sameSquare) {
    consumeStealthOnInteract(attacker);
    const rangedErr = dealDamage(state, target.instanceId, attackerStrikePower, attacker.instanceId);
    if (rangedErr) return rangedErr;
    if (attackerHasLance) consumeLanceOnStrike(state, attacker);
    fireOnStrike(state, attacker, target);
    return null;
  }

  const defenderHasLance = hasStatusToken(target, 'lance');
  const defenderStrikePower = getAttackPower(target, state);
  const attackerStrikesFirst = attackerHasLance;
  const defenderStrikesFirst = defenderHasLance;

  const attackerStrike = (): string | null => {
    consumeStealthOnInteract(attacker);
    const err = dealDamage(state, target.instanceId, attackerStrikePower, attacker.instanceId);
    if (attackerHasLance) consumeLanceOnStrike(state, attacker);
    if (!err) fireOnStrike(state, attacker, target);
    return err;
  };
  const defenderStrike = (): string | null => {
    consumeStealthOnInteract(target);
    const err = dealDamage(state, attacker.instanceId, defenderStrikePower, target.instanceId);
    if (defenderHasLance) consumeLanceOnStrike(state, target);
    if (!err) fireOnStrike(state, target, attacker);
    return err;
  };

  if (attackerStrikesFirst && !defenderStrikesFirst) {
    const firstErr = attackerStrike();
    if (firstErr) return firstErr;
    if (!state.instances[target.instanceId]?.location) return null;
    return defenderStrike();
  }
  if (defenderStrikesFirst && !attackerStrikesFirst) {
    const firstErr = defenderStrike();
    if (firstErr) return firstErr;
    if (!state.instances[attacker.instanceId]?.location) return null;
    return attackerStrike();
  }

  const aErr = defenderStrike();
  if (aErr) return aErr;
  const dErr = attackerStrike();
  if (dErr) return dErr;
  return null;
}

function removeUnitFromCellByRegion(state: GameState, unitId: string, location: { square: Square; region: 'void' | 'surface' | 'underground' | 'underwater' }): void {
  const cell = state.realm[location.square.row][location.square.col];
  if (location.region === 'underground' || location.region === 'underwater') {
    cell.subsurfaceUnitIds = cell.subsurfaceUnitIds.filter((id) => id !== unitId);
    return;
  }
  cell.unitInstanceIds = cell.unitInstanceIds.filter((id) => id !== unitId);
}

function addUnitToCellByRegion(state: GameState, unitId: string, location: { square: Square; region: 'void' | 'surface' | 'underground' | 'underwater' }): void {
  const cell = state.realm[location.square.row][location.square.col];
  if (location.region === 'underground' || location.region === 'underwater') {
    if (!cell.subsurfaceUnitIds.includes(unitId)) cell.subsurfaceUnitIds.push(unitId);
    return;
  }
  if (!cell.unitInstanceIds.includes(unitId)) cell.unitInstanceIds.push(unitId);
}

function moveAndAttack(state: GameState, unitInstanceId: string, path: Square[], attackTargetId?: string): string | null {
  const inst = state.instances[unitInstanceId];
  if (!inst) return 'Unit not found';
  if (hasKeyword(inst, 'disable')) return 'Disabled units cannot move or attack';
  if (hasKeyword(inst, 'immobile') && path.length > 0) return 'Immobile units cannot take steps';
  if (inst.tapped) return 'Unit is already tapped';
  if (inst.summoningSickness && !hasKeyword(inst, 'charge')) return 'Unit has summoning sickness';
  if (hasKeyword(inst, 'waterbound')) {
    const location = inst.location;
    if (!location || !isWaterLocation(state, location)) return 'Waterbound unit is disabled off water locations';
  }
  const range = getMovementRange(inst);
  if (path.length > range) return `Unit can only move ${range} step(s)`;
  const startLocation = inst.location;
  if (!startLocation) return 'Unit has no location';

  if (path.length > 0) {
    let current = startLocation;
    for (const stepSquare of path) {
      const step = resolveMovementStep(state, inst, current, stepSquare);
      if (!('location' in step)) return step.error;
      current = step.location;
    }

    removeUnitFromCellByRegion(state, unitInstanceId, startLocation);
    inst.location = current;
    addUnitToCellByRegion(state, unitInstanceId, current);
    for (const artId of inst.carriedArtifacts) {
      const art = state.instances[artId];
      if (art) art.location = current;
    }
    state.currentTurn.unitsThatMoved.push(unitInstanceId);
    fireOnMove(state, inst);
  }

  inst.tapped = true;
  state.currentTurn.attacksDeclared.push(unitInstanceId);
  if (attackTargetId) return resolveAttack(state, inst, attackTargetId);
  return null;
}

function activateAvatarAbility(
  state: GameState,
  playerId: PlayerId,
  abilityId: string,
  targetSquare?: Square,
  siteInstanceId?: string,
): string | null {
  const player = state.players[playerId];
  const avatarInst = state.instances[player.avatarInstanceId];
  if (avatarInst.tapped) return 'Avatar is already tapped';
  const card = avatarInst.card;
  if (card.type !== 'avatar') return 'Not an avatar';
  const ability =
    card.abilities.find((a) => a.id === abilityId) ??
    card.abilities.find((a) => a.effect.type === 'play_or_draw_site');
  if (!ability) return 'Ability not found';
  avatarInst.tapped = true;

  if (ability.effect.type === 'play_or_draw_site') {
    if (targetSquare && siteInstanceId) {
      const err = playSite(state, playerId, siteInstanceId, targetSquare);
      if (err) {
        avatarInst.tapped = false;
        return err;
      }
    } else {
      drawCards(state, playerId, 1, 'atlas');
    }
  } else if (ability.effect.type === 'draw_spell') {
    drawCards(state, playerId, 1, 'spellbook');
  }
  return null;
}

function chooseDrawSource(state: GameState, playerId: PlayerId, source: 'atlas' | 'spellbook'): string | null {
  if (state.pendingInteraction?.type !== 'choose_draw') return 'No draw choice pending';
  if (state.pendingInteraction.playerId !== playerId) return 'Not your draw choice';
  drawCards(state, playerId, 1, source);
  state.pendingInteraction = null;
  state.phase = 'main';
  state.step = 'main_open';
  return null;
}

function chooseTarget(state: GameState, targetId: string): string | null {
  if (state.pendingInteraction?.type !== 'select_target') return 'No target selection pending';
  if (!state.pendingInteraction.validTargets.includes(targetId)) return 'Invalid selected target';
  const target = state.instances[targetId];
  if (!target) return 'Target not found';
  const effect = state.pendingInteraction.effect;
  if (effect.type === 'add_status_token') {
    addStatusToken(target, effect.token);
  }
  state.pendingInteraction = null;
  return null;
}

function doMulligan(state: GameState, playerId: PlayerId, returnIds: string[]): void {
  const player = state.players[playerId];
  for (const id of returnIds) {
    const idx = player.hand.indexOf(id);
    if (idx === -1) continue;
    player.hand.splice(idx, 1);
    const card = state.instances[id].card;
    if (card.type === 'site') player.atlasCards.push(id);
    else player.spellbookCards.push(id);
  }
  const siteCount = returnIds.filter((id) => state.instances[id].card.type === 'site').length;
  const spellCount = returnIds.length - siteCount;
  drawCards(state, playerId, siteCount, 'atlas');
  drawCards(state, playerId, spellCount, 'spellbook');
  state.pendingInteraction = null;
}

function advancePhase(state: GameState): void {
  if (state.status !== 'playing') return;
  const pid = state.activePlayerId;

  if (state.phase === 'start') {
    state.phase = 'main';
    state.step = 'main_open';
  } else if (state.phase === 'main') {
    const player = state.players[pid];
    // Fire end-of-turn triggers before cleanup (e.g. Malakhim untaps, Survivors gain stealth)
    fireEndOfTurn(state, pid);
    for (const inst of Object.values(state.instances)) {
      if (inst.card.type === 'minion' && inst.location) inst.damage = 0;
      // Clear temporary affinity counters (e.g. Algae Bloom, Autumn Bloom genesis)
      for (const key of Object.keys(inst.counters)) {
        if (key.startsWith('temp_')) delete inst.counters[key];
      }
    }
    player.manaUsed = player.manaPool;
    const nextPid = opponent(pid);
    state.activePlayerId = nextPid;
    state.phase = 'start';
    state.step = 'untap';
    state.turnNumber += 1;
    state.currentTurn = { spellsCastCount: 0, attacksDeclared: [], unitsThatMoved: [] };

    for (const instanceId of Object.keys(state.instances)) {
      const inst = state.instances[instanceId];
      if (inst.controllerId === nextPid) {
        inst.tapped = false;
        inst.summoningSickness = false;
      }
    }
    const nextPlayer = state.players[nextPid];
    nextPlayer.manaPool = computeMana(state, nextPid);
    nextPlayer.manaUsed = 0;
    nextPlayer.elementalAffinity = computeAffinity(state, nextPid);
    if (state.turnNumber === 1) {
      state.phase = 'main';
      state.step = 'main_open';
    } else {
      state.pendingInteraction = { type: 'choose_draw', playerId: nextPid };
    }
  }
}

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
      return dealDamage(state, action.targetId, action.amount, action.sourceId);
    case 'PLAY_SITE':
      return playSite(state, action.playerId, action.siteInstanceId, action.square);
    case 'CAST_SPELL':
      return castSpell(state, action.casterId, action.cardInstanceId, action.targetSquare, action.targetInstanceId, action.targetRegion);
    case 'MOVE_AND_ATTACK':
      return moveAndAttack(state, action.unitId, action.path, action.attackTargetId);
    case 'ACTIVATE_ABILITY':
      return activateAvatarAbility(state, action.playerId, action.abilityId, action.targetSquare, action.siteInstanceId);
    case 'CHOOSE_DRAW':
      return chooseDrawSource(state, action.playerId, action.source);
    case 'CHOOSE_TARGET':
      return chooseTarget(state, action.targetId);
    case 'MULLIGAN':
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
