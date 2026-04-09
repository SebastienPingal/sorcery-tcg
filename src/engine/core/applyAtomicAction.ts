import type { GameState } from './gameState';
import type { MutationAction } from './atomicActions';
import type { CardInstance, MagicCard, MinionCard, PlayerId, Square } from '../../types';
import {
  computeAffinity,
  computeMana,
  getAttackPower,
  getManaAvailable,
  getMovementRange,
  hasKeyword,
  meetsThreshold,
  opponent,
  squareEq,
  validSitePlacements,
} from '../utils';

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

function killUnit(state: GameState, inst: CardInstance): void {
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

function dealDamage(state: GameState, targetId: string, amount: number): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';

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
  player.hand = player.hand.filter((id) => id !== siteInstanceId);
  player.manaPool += 1;
  player.elementalAffinity = computeAffinity(state, playerId);
  return null;
}

function castSpell(
  state: GameState,
  casterId: string,
  cardInstanceId: string,
  targetSquare?: Square,
  targetInstanceId?: string,
): string | null {
  const casterInst = state.instances[casterId];
  if (!casterInst) return 'Caster not found';
  const playerId = casterInst.controllerId;
  const player = state.players[playerId];
  const cardInst = state.instances[cardInstanceId];
  if (!cardInst) return 'Card not found';
  if (!player.hand.includes(cardInstanceId)) return 'Card not in hand';
  const card = cardInst.card;
  if (card.type === 'avatar' || card.type === 'site') return 'Cannot cast this card type as a spell';
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
    if (!cell.siteInstanceId) return 'Target square has no site';
    const siteInst = state.instances[cell.siteInstanceId];
    if (siteInst.controllerId !== playerId) return 'Must place on a site you control';
    cardInst.location = { square: targetSquare, region: 'surface' };
    cardInst.summoningSickness = true;
    cardInst.tapped = false;
    cell.unitInstanceIds.push(cardInst.instanceId);
    return null;
  }

  if (card.type === 'artifact') {
    if (targetInstanceId) {
      const unitInst = state.instances[targetInstanceId];
      if (!unitInst) return 'Target unit not found';
      cardInst.location = unitInst.location;
      cardInst.carriedBy = targetInstanceId;
      unitInst.carriedArtifacts.push(cardInst.instanceId);
      return null;
    }
    if (targetSquare) {
      const cell = state.realm[targetSquare.row][targetSquare.col];
      if (!cell.siteInstanceId) return 'Target square has no site';
      const siteInst = state.instances[cell.siteInstanceId];
      if (siteInst.controllerId !== playerId) return 'Must place on a site you control';
      cardInst.location = { square: targetSquare, region: 'surface' };
      cell.artifactInstanceIds.push(cardInst.instanceId);
      return null;
    }
    return 'Must specify placement for artifact';
  }

  if (card.type === 'aura') {
    if (!targetSquare) return 'Must specify target square for aura';
    cardInst.location = { square: targetSquare, region: 'surface' };
    state.realm[targetSquare.row][targetSquare.col].auraInstanceIds.push(cardInst.instanceId);
    return null;
  }

  if (card.type === 'magic') {
    const magic = cardInst.card as MagicCard;
    for (const ability of magic.abilities) {
      if (ability.effect.type === 'deal_damage' && targetInstanceId) {
        const error = dealDamage(state, targetInstanceId, ability.effect.amount);
        if (error) return error;
      }
    }
    sendToCemetery(state, cardInst.instanceId, playerId);
    return null;
  }

  return null;
}

function resolveAttack(state: GameState, attacker: CardInstance, targetId: string): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';
  const attackerSq = attacker.location?.square;
  const targetSq = target.location?.square;
  if (!attackerSq || !targetSq) return 'Invalid locations';
  if (!squareEq(attackerSq, targetSq) && target.card.type !== 'site') return "Target must be at attacker's location";

  if (target.card.type === 'site') {
    const targetPlayerId = target.controllerId;
    const atkPower = getAttackPower(attacker);
    const defender = state.players[targetPlayerId];
    // Site hits are life loss, not avatar damage: they never deliver a death blow.
    // While at Death's Door, life cannot change (no gain/loss through life effects).
    if (defender.isAtDeathsDoor) return null;
    defender.life -= atkPower;
    checkDeathsDoor(state, targetPlayerId);
    return null;
  }

  const attackerPower = getAttackPower(attacker);
  const defenderPower = getAttackPower(target);
  const aErr = dealDamage(state, attacker.instanceId, defenderPower);
  if (aErr) return aErr;
  const dErr = dealDamage(state, target.instanceId, attackerPower);
  if (dErr) return dErr;
  return null;
}

function moveAndAttack(state: GameState, unitInstanceId: string, path: Square[], attackTargetId?: string): string | null {
  const inst = state.instances[unitInstanceId];
  if (!inst) return 'Unit not found';
  if (inst.tapped) return 'Unit is already tapped';
  if (inst.summoningSickness) return 'Unit has summoning sickness';
  const range = getMovementRange(inst);
  if (path.length > range) return `Unit can only move ${range} step(s)`;
  const startSq = inst.location?.square;
  if (!startSq) return 'Unit has no location';

  if (path.length > 0) {
    const fromCell = state.realm[startSq.row][startSq.col];
    fromCell.unitInstanceIds = fromCell.unitInstanceIds.filter((id) => id !== unitInstanceId);
    const finalSq = path[path.length - 1];
    const toCell = state.realm[finalSq.row][finalSq.col];
    if (!toCell.siteInstanceId && !hasKeyword(inst, 'voidwalk')) {
      fromCell.unitInstanceIds.push(unitInstanceId);
      return 'Cannot move to void without Voidwalk';
    }
    inst.location = { square: finalSq, region: 'surface' };
    toCell.unitInstanceIds.push(unitInstanceId);
    state.currentTurn.unitsThatMoved.push(unitInstanceId);
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
    for (const inst of Object.values(state.instances)) {
      if (inst.card.type === 'minion' && inst.location) inst.damage = 0;
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
      return dealDamage(state, action.targetId, action.amount);
    case 'PLAY_SITE':
      return playSite(state, action.playerId, action.siteInstanceId, action.square);
    case 'CAST_SPELL':
      return castSpell(state, action.casterId, action.cardInstanceId, action.targetSquare, action.targetInstanceId);
    case 'MOVE_AND_ATTACK':
      return moveAndAttack(state, action.unitId, action.path, action.attackTargetId);
    case 'ACTIVATE_ABILITY':
      return activateAvatarAbility(state, action.playerId, action.abilityId, action.targetSquare, action.siteInstanceId);
    case 'CHOOSE_DRAW':
      return chooseDrawSource(state, action.playerId, action.source);
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
