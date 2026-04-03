import type {
  GameState, PlayerId, CardInstance, Square, Player,
  LogEntry,
  MinionCard, SiteCard, MagicCard,
} from '../types';
import {
  uid, shuffle, makeEmptyRealm, opponent, computeAffinity,
  computeMana, meetsThreshold, validSitePlacements,
  getAttackPower, getMovementRange,
  getManaAvailable, squareEq,
} from './utils';
import { CARD_REGISTRY } from '../data/cards';

// ─── Factory helpers ──────────────────────────────────────────────────────────
function makeInstance(cardId: string, ownerId: PlayerId): CardInstance {
  const card = CARD_REGISTRY[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return {
    instanceId: uid(),
    cardId,
    card,
    ownerId,
    controllerId: ownerId,
    location: null,
    tapped: false,
    damage: 0,
    summoningSickness: false,
    carriedArtifacts: [],
    carriedBy: null,
    isRubble: false,
    tokens: [],
    temporaryAbilities: [],
    counters: {},
  };
}

function makePlayer(
  id: PlayerId,
  name: string,
  avatarCardId: string,
  atlasCardIds: string[],
  spellbookCardIds: string[],
  instances: Record<string, CardInstance>
): Player {
  const avatarInst = makeInstance(avatarCardId, id);
  instances[avatarInst.instanceId] = avatarInst;

  const shuffledAtlas = shuffle(atlasCardIds);
  const atlasInstances = shuffledAtlas.map(cid => {
    const inst = makeInstance(cid, id);
    instances[inst.instanceId] = inst;
    return inst.instanceId;
  });

  const shuffledSpellbook = shuffle(spellbookCardIds);
  const spellInstances = shuffledSpellbook.map(cid => {
    const inst = makeInstance(cid, id);
    instances[inst.instanceId] = inst;
    return inst.instanceId;
  });

  const card = CARD_REGISTRY[avatarCardId];
  const life = card.type === 'avatar' ? card.startingLife : 20;

  return {
    id,
    name,
    life,
    maxLife: life,
    isAtDeathsDoor: false,
    manaPool: 0,
    manaUsed: 0,
    elementalAffinity: {},
    avatarInstanceId: avatarInst.instanceId,
    atlasCards: atlasInstances,
    spellbookCards: spellInstances,
    hand: [],
    cemetery: [],
  };
}

function makeLog(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  return { id: uid(), timestamp: Date.now(), message, type };
}

// ─── Game initialisation ──────────────────────────────────────────────────────
export interface GameSetupConfig {
  player1: { name: string; avatarId: string; atlasIds: string[]; spellbookIds: string[] };
  player2: { name: string; avatarId: string; atlasIds: string[]; spellbookIds: string[] };
  firstPlayer: PlayerId;
}

export function initGame(config: GameSetupConfig): GameState {
  const instances: Record<string, CardInstance> = {};
  const realm = makeEmptyRealm();

  const p1 = makePlayer('player1', config.player1.name, config.player1.avatarId,
    config.player1.atlasIds, config.player1.spellbookIds, instances);
  const p2 = makePlayer('player2', config.player2.name, config.player2.avatarId,
    config.player2.atlasIds, config.player2.spellbookIds, instances);

  // Place avatars: middle of bottom rows (row 3 for p1, row 0 for p2, col 2)
  const p1Avatar = instances[p1.avatarInstanceId];
  p1Avatar.location = { square: { row: 3, col: 2 }, region: 'surface' };
  realm[3][2].unitInstanceIds.push(p1Avatar.instanceId);

  const p2Avatar = instances[p2.avatarInstanceId];
  p2Avatar.location = { square: { row: 0, col: 2 }, region: 'surface' };
  realm[0][2].unitInstanceIds.push(p2Avatar.instanceId);

  const state: GameState = {
    status: 'mulligan',
    phase: 'start',
    step: 'untap',
    turnNumber: 1,
    activePlayerId: config.firstPlayer,
    players: { player1: p1, player2: p2 },
    instances,
    realm,
    log: [makeLog('Game started!', 'phase')],
    pendingInteraction: null,
    winner: null,
    firstPlayerChosen: true,
    currentTurn: { spellsCastCount: 0, attacksDeclared: [], unitsThatMoved: [] },
  };

  // Draw starting hands: 3 atlas + 3 spellbook each
  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    drawCards(state, pid, 3, 'atlas');
    drawCards(state, pid, 3, 'spellbook');
  }

  // Set up mulligan prompt for active player
  state.pendingInteraction = {
    type: 'mulligan',
    playerId: config.firstPlayer,
  };

  return state;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
export function drawCards(state: GameState, playerId: PlayerId, count: number, from: 'atlas' | 'spellbook'): void {
  const player = state.players[playerId];
  const deck = from === 'atlas' ? player.atlasCards : player.spellbookCards;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      // Lose immediately if deck is empty
      state.winner = opponent(playerId);
      state.status = 'ended';
      state.log.push(makeLog(`${player.name} has no cards to draw — they lose!`, 'phase'));
      return;
    }
    const instanceId = deck.shift()!;
    player.hand.push(instanceId);
  }
}

// ─── Phase advancement ────────────────────────────────────────────────────────
export function advancePhase(state: GameState): void {
  if (state.status !== 'playing') return;

  const pid = state.activePlayerId;
  const player = state.players[pid];

  if (state.phase === 'start') {
    // Start phase already resolved, move to main
    state.phase = 'main';
    state.step = 'main_open';
    state.log.push(makeLog(`${player.name} — Main Phase`, 'phase'));
  } else if (state.phase === 'main') {
    // End phase
    state.phase = 'end';
    resolveEndPhase(state);
  }
  // end phase auto-transitions to next player's start phase
}

function resolveStartPhase(state: GameState): void {
  const pid = state.activePlayerId;
  const player = state.players[pid];

  // Step 1: Untap all
  for (const instanceId of Object.keys(state.instances)) {
    const inst = state.instances[instanceId];
    if (inst.controllerId === pid) {
      inst.tapped = false;
      inst.summoningSickness = false;
    }
  }

  // Step 2: Sites provide mana
  player.manaPool = computeMana(state, pid);
  player.manaUsed = 0;

  // Step 3: Update elemental affinity
  player.elementalAffinity = computeAffinity(state, pid);

  // Step 4: Draw — skip on the very first turn (player1, turn 1); otherwise prompt
  if (state.turnNumber === 1) {
    // First player skips their draw on turn 1 (rule: going first = no draw)
    state.log.push(makeLog(
      `${player.name} — Start Phase (mana: ${player.manaPool}, no draw on turn 1)`,
      'phase'
    ));
    return;
  }
  // Prompt the active player to choose which deck to draw from
  state.pendingInteraction = { type: 'choose_draw', playerId: pid };
  state.log.push(makeLog(
    `${player.name} — Start Phase (mana: ${player.manaPool}) — choose your draw`,
    'phase'
  ));
}


function resolveEndPhase(state: GameState): void {
  const pid = state.activePlayerId;
  const player = state.players[pid];

  // Step 2: Remove all damage from minions
  for (const inst of Object.values(state.instances)) {
    if (inst.controllerId === pid && inst.card.type === 'minion') {
      inst.damage = 0;
    }
  }
  // Also remove from all minions as per rules (end of turn = all minion damage cleared)
  for (const inst of Object.values(state.instances)) {
    if (inst.card.type === 'minion' && inst.location) {
      inst.damage = 0;
    }
  }

  // Step 3: Effects that last "for your turn" end
  // (handled by duration counters in future)

  // Lose remaining mana
  player.manaUsed = player.manaPool;

  state.log.push(makeLog(`${player.name} ends their turn.`, 'phase'));

  // Switch active player
  const nextPid = opponent(pid);
  state.activePlayerId = nextPid;
  state.phase = 'start';
  state.step = 'untap';
  state.turnNumber += 1;
  state.currentTurn = { spellsCastCount: 0, attacksDeclared: [], unitsThatMoved: [] };

  // Start next player's turn
  resolveStartPhase(state);
  // If a draw choice is pending, stay in start phase until player chooses
  if (state.pendingInteraction?.type !== 'choose_draw') {
    state.phase = 'main';
    state.step = 'main_open';
    state.log.push(makeLog(`${state.players[nextPid].name} — Main Phase`, 'phase'));
  }
}

// ─── Start game from mulligan ─────────────────────────────────────────────────
export function startGame(state: GameState): void {
  state.status = 'playing';
  state.pendingInteraction = null;

  // Resolve first player's start phase (turn 1 skips draw)
  resolveStartPhase(state);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((state.pendingInteraction as any)?.type !== 'choose_draw') {
    state.phase = 'main';
    state.step = 'main_open';
    state.log.push(makeLog(
      `${state.players[state.activePlayerId].name} goes first! First turn: you must play a site on your Avatar's square.`,
      'phase'
    ));
  }
}

// ─── Draw choice ─────────────────────────────────────────────────────────────
export function chooseDrawSource(state: GameState, playerId: PlayerId, source: 'atlas' | 'spellbook'): string | null {
  if (state.pendingInteraction?.type !== 'choose_draw') return 'No draw choice pending';
  if (state.pendingInteraction.playerId !== playerId) return 'Not your draw choice';
  const player = state.players[playerId];
  drawCards(state, playerId, 1, source);
  state.pendingInteraction = null;
  state.log.push(makeLog(`${player.name} draws from their ${source}.`));
  state.phase = 'main';
  state.step = 'main_open';
  state.log.push(makeLog(`${player.name} — Main Phase`, 'phase'));
  return null;
}

// ─── Mulligan ─────────────────────────────────────────────────────────────────
export function doMulligan(state: GameState, playerId: PlayerId, returnIds: string[]): void {
  const player = state.players[playerId];

  // Determine which deck each card came from and return them
  for (const id of returnIds) {
    const idx = player.hand.indexOf(id);
    if (idx === -1) continue;
    player.hand.splice(idx, 1);
    const card = state.instances[id].card;
    // Put back at bottom of correct deck
    if (card.type === 'site') {
      player.atlasCards.push(id);
    } else {
      player.spellbookCards.push(id);
    }
  }

  // Redraw same number from respective decks
  const siteCount = returnIds.filter(id => state.instances[id].card.type === 'site').length;
  const spellCount = returnIds.length - siteCount;
  drawCards(state, playerId, siteCount, 'atlas');
  drawCards(state, playerId, spellCount, 'spellbook');

  state.pendingInteraction = null;
  state.log.push(makeLog(`${player.name} took a mulligan.`));
}

// ─── Cast a spell ─────────────────────────────────────────────────────────────
export function castSpell(
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

  // Must be in hand
  if (!player.hand.includes(cardInstanceId)) return 'Card not in hand';

  const card = cardInst.card;
  if (card.type === 'avatar' || card.type === 'site') return 'Cannot cast this card type as a spell';

  // Check mana
  const manaCost = 'manaCost' in card ? card.manaCost : 0;
  if (getManaAvailable(player) < manaCost) return `Not enough mana (need ${manaCost}, have ${getManaAvailable(player)})`;

  // Check elemental threshold
  if ('threshold' in card && card.threshold) {
    if (!meetsThreshold(player.elementalAffinity, card.threshold)) {
      return 'Elemental threshold not met';
    }
  }

  // Deduct mana
  player.manaUsed += manaCost;

  // Remove from hand
  player.hand = player.hand.filter(id => id !== cardInstanceId);

  // Place the card
  if (card.type === 'minion') {
    return placeMinion(state, cardInst, playerId, targetSquare);
  } else if (card.type === 'artifact') {
    return placeArtifact(state, cardInst, playerId, targetSquare, targetInstanceId);
  } else if (card.type === 'aura') {
    return placeAura(state, cardInst, playerId, targetSquare);
  } else if (card.type === 'magic') {
    return resolveMagic(state, cardInst, playerId, casterInst, targetInstanceId);
  }

  return null;
}

function placeMinion(state: GameState, inst: CardInstance, playerId: PlayerId, targetSquare?: Square): string | null {
  // Must be placed atop a controlled site
  let placementSq = targetSquare;
  if (!placementSq) return 'Must specify a target square for minion placement';

  const cell = state.realm[placementSq.row][placementSq.col];
  if (!cell.siteInstanceId) return 'Target square has no site';

  const siteInst = state.instances[cell.siteInstanceId];
  if (siteInst.controllerId !== playerId) return 'Must place on a site you control';

  inst.location = { square: placementSq, region: 'surface' };
  inst.summoningSickness = true;
  inst.tapped = false;
  cell.unitInstanceIds.push(inst.instanceId);

  state.log.push(makeLog(
    `${state.players[playerId].name} summons ${inst.card.name} at (${placementSq.row},${placementSq.col})`,
    'cast'
  ));
  return null;
}

function placeArtifact(
  state: GameState,
  inst: CardInstance,
  playerId: PlayerId,
  targetSquare?: Square,
  targetUnitId?: string,
): string | null {
  if (targetUnitId) {
    const unitInst = state.instances[targetUnitId];
    if (!unitInst) return 'Target unit not found';
    // Artifact goes to unit's location
    inst.location = unitInst.location;
    inst.carriedBy = targetUnitId;
    unitInst.carriedArtifacts.push(inst.instanceId);
    state.log.push(makeLog(`${state.players[playerId].name} conjures ${inst.card.name} to ${unitInst.card.name}`, 'cast'));
  } else if (targetSquare) {
    const cell = state.realm[targetSquare.row][targetSquare.col];
    if (!cell.siteInstanceId) return 'Target square has no site';
    const siteInst = state.instances[cell.siteInstanceId];
    if (siteInst.controllerId !== playerId) return 'Must place on a site you control';
    inst.location = { square: targetSquare, region: 'surface' };
    cell.artifactInstanceIds.push(inst.instanceId);
    state.log.push(makeLog(`${state.players[playerId].name} conjures ${inst.card.name} at (${targetSquare.row},${targetSquare.col})`, 'cast'));
  } else {
    return 'Must specify placement for artifact';
  }
  return null;
}

function placeAura(state: GameState, inst: CardInstance, playerId: PlayerId, targetSquare?: Square): string | null {
  if (!targetSquare) return 'Must specify target square for aura';
  inst.location = { square: targetSquare, region: 'surface' };
  state.realm[targetSquare.row][targetSquare.col].auraInstanceIds.push(inst.instanceId);
  state.log.push(makeLog(`${state.players[playerId].name} conjures ${inst.card.name} aura`, 'cast'));
  return null;
}

function resolveMagic(
  state: GameState,
  inst: CardInstance,
  playerId: PlayerId,
  _caster: CardInstance,
  targetId?: string,
): string | null {
  const card = inst.card as MagicCard;
  state.log.push(makeLog(`${state.players[playerId].name} casts ${card.name}`, 'cast'));

  // Apply effects
  for (const ability of card.abilities) {
    if (ability.effect.type === 'deal_damage' && targetId) {
      const err = dealDamage(state, targetId, ability.effect.amount, playerId);
      if (err) return err;
    }
  }

  // Magic goes to cemetery
  sendToCemetery(state, inst.instanceId, playerId);
  return null;
}

// ─── Play a site ──────────────────────────────────────────────────────────────
export function playSite(
  state: GameState,
  playerId: PlayerId,
  siteInstanceId: string,
  targetSquare: Square,
): string | null {
  const player = state.players[playerId];

  if (!player.hand.includes(siteInstanceId)) return 'Site not in hand';

  const siteInst = state.instances[siteInstanceId];
  if (siteInst.card.type !== 'site') return 'Not a site card';

  const valid = validSitePlacements(state, playerId);
  if (!valid.some(sq => squareEq(sq, targetSquare))) {
    return 'Invalid site placement location';
  }

  const cell = state.realm[targetSquare.row][targetSquare.col];

  // Replace rubble if needed
  if (cell.siteInstanceId) {
    const existing = state.instances[cell.siteInstanceId];
    if (!existing.isRubble) return 'Square already has a site';
    sendToCemetery(state, existing.instanceId, existing.ownerId);
  }

  // Place the site
  siteInst.location = { square: targetSquare, region: 'surface' };
  siteInst.controllerId = playerId;
  cell.siteInstanceId = siteInstanceId;

  // Remove from hand
  player.hand = player.hand.filter(id => id !== siteInstanceId);

  // Gain 1 mana immediately
  player.manaPool += 1;

  // Update affinity
  player.elementalAffinity = computeAffinity(state, playerId);

  state.log.push(makeLog(
    `${player.name} plays ${siteInst.card.name} at (${targetSquare.row},${targetSquare.col}) — gains 1 mana`,
    'cast'
  ));

  return null;
}

// ─── Draw a site (avatar ability) ────────────────────────────────────────────
export function drawSite(state: GameState, playerId: PlayerId): string | null {
  drawCards(state, playerId, 1, 'atlas');
  state.log.push(makeLog(`${state.players[playerId].name} draws a site.`));
  return null;
}

// ─── Move and Attack ──────────────────────────────────────────────────────────
export function moveAndAttack(
  state: GameState,
  unitInstanceId: string,
  path: Square[],
  attackTargetId?: string,
): string | null {
  const inst = state.instances[unitInstanceId];
  if (!inst) return 'Unit not found';
  if (inst.tapped) return 'Unit is already tapped';
  if (inst.summoningSickness) return 'Unit has summoning sickness';

  const playerId = inst.controllerId;
  const range = getMovementRange(inst);

  if (path.length > range) return `Unit can only move ${range} step(s)`;

  // Validate path
  const startSq = inst.location?.square;
  if (!startSq) return 'Unit has no location';

  // Move unit
  if (path.length > 0) {
    const fromCell = state.realm[startSq.row][startSq.col];
    fromCell.unitInstanceIds = fromCell.unitInstanceIds.filter(id => id !== unitInstanceId);

    const finalSq = path[path.length - 1];
    const toCell = state.realm[finalSq.row][finalSq.col];

    // Check destination is valid (has a site or voidwalk)
    if (!toCell.siteInstanceId && !hasKeyword(inst, 'voidwalk')) {
      // Revert
      fromCell.unitInstanceIds.push(unitInstanceId);
      return 'Cannot move to void without Voidwalk';
    }

    inst.location = { square: finalSq, region: 'surface' };
    toCell.unitInstanceIds.push(unitInstanceId);
    state.currentTurn.unitsThatMoved.push(unitInstanceId);

    state.log.push(makeLog(
      `${inst.card.name} moves to (${finalSq.row},${finalSq.col})`,
      'info'
    ));
  }

  // Tap the unit
  inst.tapped = true;
  state.currentTurn.attacksDeclared.push(unitInstanceId);

  // Attack
  if (attackTargetId) {
    return resolveAttack(state, inst, attackTargetId, playerId);
  }

  return null;
}

function hasKeyword(inst: CardInstance, kw: string): boolean {
  const card = inst.card;
  if (card.type === 'minion' && (card as MinionCard).keywords.includes(kw as any)) return true;
  for (const ab of inst.temporaryAbilities) {
    if (ab.keyword === kw) return true;
  }
  return false;
}

// ─── Combat resolution ────────────────────────────────────────────────────────
export function resolveAttack(
  state: GameState,
  attacker: CardInstance,
  targetId: string,
  playerId: PlayerId,
): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';

  // Must be at same location
  const attackerSq = attacker.location?.square;
  const targetSq = target.location?.square;
  if (!attackerSq || !targetSq) return 'Invalid locations';
  if (!squareEq(attackerSq, targetSq) && target.card.type !== 'site') {
    return 'Target must be at attacker\'s location';
  }

  // Check if target is a site
  if (target.card.type === 'site') {
    return attackSite(state, attacker, target, playerId);
  }

  // Unit vs unit fight
  return fight(state, [attacker], [target]);
}

function attackSite(
  state: GameState,
  attacker: CardInstance,
  siteInst: CardInstance,
  _attackerPlayerId: PlayerId,
): string | null {
  const targetPlayerId = siteInst.controllerId;
  const atkPower = getAttackPower(attacker);

  state.log.push(makeLog(
    `${attacker.card.name} attacks ${siteInst.card.name} for ${atkPower} damage!`,
    'combat'
  ));

  // Damage the site (causes avatar life loss)
  const defender = state.players[targetPlayerId];
  defender.life -= atkPower;

  state.log.push(makeLog(
    `${defender.name} loses ${atkPower} life (now ${defender.life})`,
    'combat'
  ));

  checkDeathsDoor(state, targetPlayerId);
  return null;
}

export function fight(
  state: GameState,
  attackers: CardInstance[],
  defenders: CardInstance[],
): string | null {
  // allUnits available for future multi-unit targeting

  state.log.push(makeLog(
    `Fight! ${attackers.map(a => a.card.name).join(', ')} vs ${defenders.map(d => d.card.name).join(', ')}`,
    'combat'
  ));

  // Simultaneous strikes
  const atkTotalPower = attackers.reduce((sum, a) => sum + getAttackPower(a), 0);
  const defTotalPower = defenders.reduce((sum, d) => sum + getAttackPower(d), 0);

  // Apply damage
  for (const def of defenders) {
    dealDamageToUnit(state, def, atkTotalPower);
  }
  for (const atk of attackers) {
    dealDamageToUnit(state, atk, defTotalPower);
  }

  return null;
}

function dealDamageToUnit(state: GameState, inst: CardInstance, amount: number): void {
  if (inst.card.type === 'avatar') {
    const player = state.players[inst.controllerId];
    if (player.isAtDeathsDoor) {
      // Death blow
      state.winner = opponent(inst.controllerId);
      state.status = 'ended';
      state.log.push(makeLog(`DEATH BLOW! ${player.name} is defeated!`, 'combat'));
    } else {
      player.life -= amount;
      state.log.push(makeLog(`${player.name}'s Avatar takes ${amount} damage (life: ${player.life})`, 'combat'));
      checkDeathsDoor(state, inst.controllerId);
    }
    return;
  }

  if (inst.card.type === 'minion') {
    const card = inst.card as MinionCard;
    const maxPower = typeof card.power === 'number' ? card.power : Math.max(card.power.attack, card.power.defense);
    inst.damage += amount;
    state.log.push(makeLog(`${inst.card.name} takes ${amount} damage (${inst.damage}/${maxPower})`, 'combat'));

    // Zero damage is not damage, so 0-power minion needs at least 1
    const threshold = maxPower === 0 ? 1 : maxPower;
    if (inst.damage >= threshold) {
      killUnit(state, inst);
    }
  }
}

export function dealDamage(state: GameState, targetId: string, amount: number, _sourcePlayerId: PlayerId): string | null {
  const target = state.instances[targetId];
  if (!target) return 'Target not found';
  dealDamageToUnit(state, target, amount);
  return null;
}

function checkDeathsDoor(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  if (player.life <= 0 && !player.isAtDeathsDoor) {
    player.life = 0;
    player.isAtDeathsDoor = true;
    state.log.push(makeLog(`${player.name} is at Death's Door!`, 'combat'));
  }
}

function killUnit(state: GameState, inst: CardInstance): void {
  state.log.push(makeLog(`${inst.card.name} dies!`, 'combat'));

  // Remove from realm
  if (inst.location) {
    const { row, col } = inst.location.square;
    const cell = state.realm[row][col];
    cell.unitInstanceIds = cell.unitInstanceIds.filter(id => id !== inst.instanceId);
    cell.subsurfaceUnitIds = cell.subsurfaceUnitIds.filter(id => id !== inst.instanceId);
  }

  // Drop carried artifacts
  for (const artId of inst.carriedArtifacts) {
    const artInst = state.instances[artId];
    if (artInst) artInst.carriedBy = null;
  }
  inst.carriedArtifacts = [];

  sendToCemetery(state, inst.instanceId, inst.ownerId);
}

function sendToCemetery(state: GameState, instanceId: string, ownerId: PlayerId): void {
  const inst = state.instances[instanceId];
  if (!inst) return;
  inst.location = null;
  state.players[ownerId].cemetery.push(instanceId);
}

// ─── Activate avatar ability ──────────────────────────────────────────────────
export function activateAvatarAbility(
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

  const ability = card.abilities.find(a => a.id === abilityId);
  if (!ability) return 'Ability not found';

  // Tap avatar
  avatarInst.tapped = true;

  if (ability.effect.type === 'play_or_draw_site') {
    // Player chooses: play a site from hand or draw one
    // For now, if targetSquare + siteInstanceId provided → play, else → draw
    if (targetSquare && siteInstanceId) {
      avatarInst.tapped = true;
      const err = playSite(state, playerId, siteInstanceId, targetSquare);
      if (err) {
        avatarInst.tapped = false;
        return err;
      }
    } else {
      drawSite(state, playerId);
    }
  } else if (ability.effect.type === 'draw_spell') {
    drawCards(state, playerId, 1, 'spellbook');
    state.log.push(makeLog(`${player.name}'s Avatar draws a spell.`));
  }

  return null;
}
