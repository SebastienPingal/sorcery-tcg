import type { AvatarCard, CardInstance, GameState, LogEntry, Player, PlayerId } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { computeAffinity, computeMana, makeEmptyRealm, opponent, shuffle, uid } from './utils';

function makeInstance(cardId: string, ownerId: PlayerId): CardInstance {
  const rawCard = CARD_REGISTRY[cardId];
  if (!rawCard) throw new Error(`Unknown card: ${cardId}`);
  const card = (() => {
    if (rawCard.type !== 'avatar') return rawCard;
    const avatar = rawCard as AvatarCard;
    if (avatar.abilities.length > 0) return rawCard;
    // Many real avatars currently have empty parsed abilities.
    // Ensure the baseline game action always exists.
    return {
      ...avatar,
      abilities: [{
        id: `${avatar.id}_play_or_draw_site`,
        trigger: 'tap',
        cost: { tap: true },
        description: 'Play or draw a site.',
        effect: { type: 'play_or_draw_site' },
      }],
    } as AvatarCard;
  })();
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
  instances: Record<string, CardInstance>,
): Player {
  const avatarInst = makeInstance(avatarCardId, id);
  instances[avatarInst.instanceId] = avatarInst;

  const atlasInstances = shuffle(atlasCardIds).map((cardId) => {
    const inst = makeInstance(cardId, id);
    instances[inst.instanceId] = inst;
    return inst.instanceId;
  });

  const spellbookInstances = shuffle(spellbookCardIds).map((cardId) => {
    const inst = makeInstance(cardId, id);
    instances[inst.instanceId] = inst;
    return inst.instanceId;
  });

  const avatar = CARD_REGISTRY[avatarCardId];
  const life = avatar.type === 'avatar' ? avatar.startingLife : 20;

  return {
    id,
    name,
    life,
    maxLife: life,
    isAtDeathsDoor: false,
    deathsDoorTurn: null,
    manaPool: 0,
    manaUsed: 0,
    elementalAffinity: {},
    avatarInstanceId: avatarInst.instanceId,
    atlasCards: atlasInstances,
    spellbookCards: spellbookInstances,
    hand: [],
    cemetery: [],
  };
}

function makeLog(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  return { id: uid(), timestamp: Date.now(), message, type };
}

function drawCards(state: GameState, playerId: PlayerId, count: number, from: 'atlas' | 'spellbook'): void {
  const player = state.players[playerId];
  const deck = from === 'atlas' ? player.atlasCards : player.spellbookCards;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      state.winner = opponent(playerId);
      state.status = 'ended';
      state.log.push(makeLog(`${player.name} has no cards to draw — they lose!`, 'phase'));
      return;
    }
    player.hand.push(deck.shift()!);
  }
}

function resolveStartPhase(state: GameState): void {
  const pid = state.activePlayerId;
  const player = state.players[pid];

  for (const inst of Object.values(state.instances)) {
    if (inst.controllerId === pid) {
      inst.tapped = false;
      inst.summoningSickness = false;
    }
  }

  player.manaPool = computeMana(state, pid);
  player.manaUsed = 0;
  player.elementalAffinity = computeAffinity(state, pid);

  if (state.turnNumber === 1) {
    state.log.push(makeLog(
      `${player.name} — Start Phase (mana: ${player.manaPool}, no draw on turn 1)`,
      'phase',
    ));
    return;
  }

  state.pendingInteraction = { type: 'choose_draw', playerId: pid };
  state.log.push(makeLog(
    `${player.name} — Start Phase (mana: ${player.manaPool}) — choose your draw`,
    'phase',
  ));
}

export interface GameSetupConfig {
  player1: { name: string; avatarId: string; atlasIds: string[]; spellbookIds: string[] };
  player2: { name: string; avatarId: string; atlasIds: string[]; spellbookIds: string[] };
  firstPlayer: PlayerId;
}

export function initGame(config: GameSetupConfig): GameState {
  const instances: Record<string, CardInstance> = {};
  const realm = makeEmptyRealm();

  const p1 = makePlayer(
    'player1',
    config.player1.name,
    config.player1.avatarId,
    config.player1.atlasIds,
    config.player1.spellbookIds,
    instances,
  );
  const p2 = makePlayer(
    'player2',
    config.player2.name,
    config.player2.avatarId,
    config.player2.atlasIds,
    config.player2.spellbookIds,
    instances,
  );

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
    pendingInteraction: { type: 'mulligan', playerId: config.firstPlayer },
    winner: null,
    firstPlayerChosen: true,
    currentTurn: { spellsCastCount: 0, attacksDeclared: [], unitsThatMoved: [] },
  };

  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    drawCards(state, pid, 3, 'atlas');
    drawCards(state, pid, 3, 'spellbook');
  }

  return state;
}

export function startGame(state: GameState): void {
  state.status = 'playing';
  state.pendingInteraction = null;
  resolveStartPhase(state);
  state.phase = 'main';
  state.step = 'main_open';
  state.log.push(makeLog(
    `${state.players[state.activePlayerId].name} goes first! First turn: you must play a site on your Avatar's square.`,
    'phase',
  ));
}
