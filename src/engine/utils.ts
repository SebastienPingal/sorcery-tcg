import type {
  Square, CardInstance, GameState, Player, PlayerId,
  RealmSquare, ElementalThreshold, Power, MinionCard, ArtifactCard, Location, Element, Card, CasterEligibilityRules, CasterFilter,
} from '../types';

// ─── UUID ─────────────────────────────────────────────────────────────────────
let _counter = 0;
export function uid(): string {
  return `${Date.now()}-${++_counter}`;
}

// ─── Shuffle ──────────────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────
export const REALM_ROWS = 4;
export const REALM_COLS = 5;

export function makeEmptyRealm(): RealmSquare[][] {
  return Array.from({ length: REALM_ROWS }, (_, row) =>
    Array.from({ length: REALM_COLS }, (_, col) => ({
      row,
      col,
      siteInstanceId: null,
      unitInstanceIds: [],
      artifactInstanceIds: [],
      subsurfaceUnitIds: [],
      auraInstanceIds: [],
    }))
  );
}

export function getSquare(realm: RealmSquare[][], sq: Square): RealmSquare {
  return realm[sq.row][sq.col];
}

export function squareEq(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Returns squares that share a border (no diagonals) */
export function adjacentSquares(sq: Square): Square[] {
  const result: Square[] = [];
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const r = sq.row + dr;
    const c = sq.col + dc;
    if (r >= 0 && r < REALM_ROWS && c >= 0 && c < REALM_COLS) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

/** Returns all squares within 1 step including diagonals */
export function nearbySquares(sq: Square): Square[] {
  const result: Square[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = sq.row + dr;
      const c = sq.col + dc;
      if (r >= 0 && r < REALM_ROWS && c >= 0 && c < REALM_COLS) {
        result.push({ row: r, col: c });
      }
    }
  }
  return result;
}

/** Manhattan distance between two squares */
export function squareDistance(a: Square, b: Square): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// ─── Instance helpers ─────────────────────────────────────────────────────────
export function getInstance(state: GameState, instanceId: string): CardInstance | undefined {
  return state.instances[instanceId];
}

export function getAvatarInstance(state: GameState, playerId: PlayerId): CardInstance {
  const player = state.players[playerId];
  return state.instances[player.avatarInstanceId];
}

export function getAvatarSquare(state: GameState, playerId: PlayerId): Square | null {
  const inst = getAvatarInstance(state, playerId);
  return inst.location?.square ?? null;
}

export function getInstancesOnSquare(state: GameState, sq: Square): CardInstance[] {
  const cell = state.realm[sq.row][sq.col];
  return [
    ...cell.unitInstanceIds,
    ...cell.artifactInstanceIds,
  ].map(id => state.instances[id]).filter(Boolean);
}

// ─── Power helpers ────────────────────────────────────────────────────────────
interface ArtifactPowerBonus {
  attack: number;
  defense: number;
}

function getArtifactPowerBonus(inst: CardInstance, state?: GameState): ArtifactPowerBonus {
  if (!state) return { attack: 0, defense: 0 };
  let attack = 0;
  let defense = 0;
  for (const artId of inst.carriedArtifacts) {
    const artInst = state.instances[artId];
    if (!artInst || artInst.card.type !== 'artifact' || artInst.carriedBy !== inst.instanceId) continue;
    if (artInst.tokens.includes('lance_token')) {
      // Lance token grants +1 power while carried, then breaks on first strike.
      attack += 1;
      defense += 1;
      continue;
    }
    const power = (artInst.card as ArtifactCard).power;
    if (!power) continue;
    if (typeof power === 'number') {
      attack += power;
      defense += power;
    } else {
      attack += power.attack;
      defense += power.defense;
    }
  }
  return { attack, defense };
}

export function getComputedPower(inst: CardInstance, state?: GameState): { attack: number; defense: number } {
  const card = inst.card;
  if (card.type === 'minion') {
    const p = (card as MinionCard).power;
    const baseAttack = typeof p === 'number' ? p : p.attack;
    const baseDefense = typeof p === 'number' ? p : p.defense;
    const bonus = getArtifactPowerBonus(inst, state);
    return { attack: baseAttack + bonus.attack, defense: baseDefense + bonus.defense };
  }
  if (card.type === 'avatar') {
    return { attack: card.attackPower, defense: card.attackPower };
  }
  if (card.type === 'artifact') {
    const p = (card as ArtifactCard).power;
    if (!p) return { attack: 0, defense: 0 };
    if (typeof p === 'number') return { attack: p, defense: p };
    return { attack: p.attack, defense: p.defense };
  }
  return { attack: 0, defense: 0 };
}

export function getAttackPower(inst: CardInstance, state?: GameState): number {
  return getComputedPower(inst, state).attack;
}

export function getDefensePower(inst: CardInstance, state?: GameState): number {
  return getComputedPower(inst, state).defense;
}

export function getMaxPower(p: Power): number {
  return typeof p === 'number' ? p : Math.max(p.attack, p.defense);
}

// ─── Elemental helpers ────────────────────────────────────────────────────────
export function computeAffinity(state: GameState, playerId: PlayerId): ElementalThreshold {
  const affinity: ElementalThreshold = {};
  for (const row of state.realm) {
    for (const cell of row) {
      if (!cell.siteInstanceId) continue;
      const inst = state.instances[cell.siteInstanceId];
      if (!inst || inst.controllerId !== playerId) continue;
      const site = inst.card;
      if (site.type !== 'site') continue;
      for (const [el, val] of Object.entries(site.threshold) as [keyof ElementalThreshold, number][]) {
        affinity[el] = (affinity[el] ?? 0) + (val ?? 0);
      }
    }
  }
  return affinity;
}

export function meetsThreshold(
  affinity: ElementalThreshold,
  required: ElementalThreshold
): boolean {
  for (const [el, req] of Object.entries(required) as [keyof ElementalThreshold, number][]) {
    if ((affinity[el] ?? 0) < (req ?? 0)) return false;
  }
  return true;
}

export function computeMana(state: GameState, playerId: PlayerId): number {
  let mana = 0;
  for (const row of state.realm) {
    for (const cell of row) {
      if (!cell.siteInstanceId) continue;
      const inst = state.instances[cell.siteInstanceId];
      if (inst?.controllerId === playerId && !inst.isRubble) mana++;
    }
  }
  return mana;
}

// ─── Site placement helpers ───────────────────────────────────────────────────
export function validSitePlacements(state: GameState, playerId: PlayerId): Square[] {
  const avatarInst = state.instances[state.players[playerId].avatarInstanceId];
  const avatarSquare = avatarInst.location?.square;

  const valid: Square[] = [];
  const controlledSquares: Square[] = [];

  // Collect all squares with player's sites
  for (const row of state.realm) {
    for (const cell of row) {
      if (cell.siteInstanceId) {
        const inst = state.instances[cell.siteInstanceId];
        if (inst?.controllerId === playerId) {
          controlledSquares.push({ row: cell.row, col: cell.col });
        }
      }
    }
  }

  const isVoidOrRubble = (sq: Square) => {
    const cell = state.realm[sq.row][sq.col];
    if (!cell.siteInstanceId) return true; // void
    const inst = state.instances[cell.siteInstanceId];
    return inst?.isRubble === true;
  };

  if (controlledSquares.length === 0) {
    // First site must be placed on the avatar's own square
    if (!avatarSquare) return [];
    return isVoidOrRubble(avatarSquare) ? [avatarSquare] : [];
  }

  // Must place adjacent to a controlled site
  const seen = new Set<string>();
  for (const sq of controlledSquares) {
    for (const adj of adjacentSquares(sq)) {
      const key = `${adj.row},${adj.col}`;
      if (!seen.has(key) && isVoidOrRubble(adj)) {
        seen.add(key);
        valid.push(adj);
      }
    }
  }
  return valid;
}

// ─── Movement helpers ─────────────────────────────────────────────────────────
export function getMovementRange(inst: CardInstance): number {
  let base = 1;
  for (const ab of inst.card.type === 'minion'
    ? (inst.card as MinionCard).abilities
    : []) {
    if (ab.movementBonus) base += ab.movementBonus;
  }
  for (const ab of inst.temporaryAbilities) {
    if (ab.movementBonus) base += ab.movementBonus;
  }
  return base;
}

export function reachableSquares(
  state: GameState,
  inst: CardInstance,
  range: number
): Square[] {
  const start = inst.location;
  if (!start) return [];

  const visited = new Set<string>();
  const frontier: Array<{ location: Location; steps: number }> = [{ location: start, steps: 0 }];
  const resultBySquare = new Map<string, Square>();

  while (frontier.length > 0) {
    const { location, steps } = frontier.shift()!;
    const key = `${location.square.row},${location.square.col}:${location.region}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (steps > 0) {
      const squareKey = `${location.square.row},${location.square.col}`;
      if (!resultBySquare.has(squareKey)) resultBySquare.set(squareKey, location.square);
    }

    if (steps >= range) continue;

    const candidates = movementStepCandidates(inst, location.square);
    for (const sq of candidates) {
      const step = resolveMovementStep(state, inst, location, sq);
      if (!('location' in step)) continue;
      frontier.push({ location: step.location, steps: steps + 1 });
    }
  }

  return Array.from(resultBySquare.values());
}

export function hasKeyword(inst: CardInstance, keyword: string): boolean {
  if (keyword === 'spellcaster' && inst.card.type === 'avatar') return true;
  const card = inst.card as { keywords?: string[] };
  if (card.keywords?.includes(keyword)) return true;
  for (const ab of inst.temporaryAbilities) {
    if (ab.keyword === keyword) return true;
  }
  return false;
}

interface SpellcasterProfile {
  allowedElements: Set<Element>;
  blockedElements: Set<Element>;
}

const ELEMENTS: Element[] = ['air', 'earth', 'fire', 'water'];

function getCardTextForSpellcasterProfile(inst: CardInstance): string {
  const cardRules = inst.card.rulesText ?? '';
  const cardAbilities = 'abilities' in inst.card
    ? inst.card.abilities.map((ability) => ability.description ?? '').join('\n')
    : '';
  const temporaryRules = inst.temporaryAbilities.map((ability) => ability.description ?? '').join('\n');
  return `${cardRules}\n${cardAbilities}\n${temporaryRules}`.toLowerCase();
}

function getSpellcasterProfile(inst: CardInstance): SpellcasterProfile {
  const text = getCardTextForSpellcasterProfile(inst);
  const profile: SpellcasterProfile = {
    allowedElements: new Set<Element>(),
    blockedElements: new Set<Element>(),
  };

  for (const element of ELEMENTS) {
    const nonPattern = new RegExp(`\\bnon[-\\s]+${element}\\s+spellcaster\\b`, 'i');
    if (nonPattern.test(text)) profile.blockedElements.add(element);
  }

  const dualElementMatches = text.matchAll(/\b(air|earth|fire|water)\s+and\s+(air|earth|fire|water)\s+spellcaster\b/g);
  for (const match of dualElementMatches) {
    profile.allowedElements.add(match[1] as Element);
    profile.allowedElements.add(match[2] as Element);
  }

  const singleElementMatches = text.matchAll(/\b(air|earth|fire|water)\s+spellcaster\b/g);
  for (const match of singleElementMatches) {
    const matchedElement = match[1] as Element;
    const start = match.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 6), start);
    if (prefix.endsWith('non-') || prefix.endsWith('non ')) continue;
    profile.allowedElements.add(matchedElement);
  }

  return profile;
}

function getSpellThresholdElements(card: Card): Element[] {
  if (!('threshold' in card) || !card.threshold) return [];
  const elements: Element[] = [];
  for (const element of ELEMENTS) {
    if ((card.threshold[element] ?? 0) > 0) elements.push(element);
  }
  return elements;
}

function hasSubtype(inst: CardInstance, subtype: string): boolean {
  if (inst.card.type !== 'minion') return false;
  const normalized = subtype.toLowerCase();
  const subtypes = (inst.card as MinionCard).subtypes ?? [];
  if (subtypes.some((s) => s.toLowerCase() === normalized)) return true;
  const typeLine = inst.card.typeLine ?? '';
  return new RegExp(`\\b${normalized}\\b`, 'i').test(typeLine);
}

function matchesCasterFilter(caster: CardInstance, card: Card, filter: CasterFilter): boolean {
  switch (filter.type) {
    case 'spellcaster':
      return canSpellcasterCastCard(caster, card);
    case 'has_keyword':
      return hasKeyword(caster, filter.keyword);
    case 'has_subtype':
      return hasSubtype(caster, filter.subtype);
    case 'is_avatar':
      return (caster.card.type === 'avatar') === filter.value;
    case 'in_region':
      return caster.location?.region === filter.region;
    case 'has_token':
      return caster.tokens.includes(filter.token);
    case 'rules_text_matches': {
      const text = (caster.card.rulesText ?? '').toLowerCase();
      return text.includes(filter.pattern.toLowerCase());
    }
    default:
      return false;
  }
}

function evaluateCasterEligibilityRules(caster: CardInstance, card: Card, rules: CasterEligibilityRules): boolean {
  if (rules.all && !rules.all.every((filter) => matchesCasterFilter(caster, card, filter))) return false;
  if (rules.any && rules.any.length > 0 && !rules.any.some((filter) => matchesCasterFilter(caster, card, filter))) return false;
  if (rules.not && rules.not.some((filter) => matchesCasterFilter(caster, card, filter))) return false;
  return true;
}

function inferCasterEligibilityRules(card: Card): CasterEligibilityRules {
  if (card.casterEligibility) return card.casterEligibility;
  return { all: [{ type: 'spellcaster' }] };
}

export function canSpellcasterCastCard(spellcaster: CardInstance, card: Card): boolean {
  if (!hasKeyword(spellcaster, 'spellcaster')) return false;
  const thresholdElements = getSpellThresholdElements(card);
  if (thresholdElements.length === 0) return true;
  const profile = getSpellcasterProfile(spellcaster);

  for (const element of thresholdElements) {
    if (profile.blockedElements.has(element)) return false;
  }

  if (profile.allowedElements.size === 0) return true;
  return thresholdElements.every((element) => profile.allowedElements.has(element));
}

export function canCasterCastCard(caster: CardInstance, card: Card): boolean {
  const rules = inferCasterEligibilityRules(card);
  return evaluateCasterEligibilityRules(caster, card, rules);
}

export function getEligibleSpellcasters(
  state: GameState,
  playerId: PlayerId,
  cardToCast: Card,
): CardInstance[] {
  return Object.values(state.instances).filter((inst) => (
    inst.controllerId === playerId &&
    !!inst.location &&
    !hasKeyword(inst, 'disable') &&
    canCasterCastCard(inst, cardToCast)
  ));
}

function movementStepCandidates(inst: CardInstance, fromSquare: Square): Square[] {
  const squares = hasKeyword(inst, 'airborne') ? nearbySquares(fromSquare) : adjacentSquares(fromSquare);
  // Same-square steps represent vertical movement between regions.
  return [fromSquare, ...squares];
}

function isWaterSite(state: GameState, square: Square): boolean {
  const cell = state.realm[square.row][square.col];
  if (!cell.siteInstanceId) return false;
  const siteInst = state.instances[cell.siteInstanceId];
  if (!siteInst || siteInst.card.type !== 'site') return false;
  if (siteInst.card.isWaterSite) return true;
  return hasKeyword(siteInst, 'flooded');
}

function isLandSite(state: GameState, square: Square): boolean {
  const cell = state.realm[square.row][square.col];
  if (!cell.siteInstanceId) return false;
  return !isWaterSite(state, square);
}

export function isWaterLocation(state: GameState, location: Location): boolean {
  if (location.region === 'void' || location.region === 'underground') return false;
  return isWaterSite(state, location.square);
}

export function resolveMovementStep(
  state: GameState,
  inst: CardInstance,
  from: Location,
  toSquare: Square,
): { location: Location; error: null } | { error: string } {
  const sameSquare = squareEq(from.square, toSquare);
  const hasVoidwalk = hasKeyword(inst, 'voidwalk');
  const hasBurrowing = hasKeyword(inst, 'burrowing');
  const hasSubmerge = hasKeyword(inst, 'submerge');
  const neighborSquares = hasKeyword(inst, 'airborne') ? nearbySquares(from.square) : adjacentSquares(from.square);

  if (!sameSquare && !neighborSquares.some((sq) => squareEq(sq, toSquare))) {
    return { error: 'Invalid movement path' };
  }

  if (sameSquare) {
    if (from.region === 'surface' && hasBurrowing && isLandSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'underground' }, error: null };
    }
    if (from.region === 'underground' && hasBurrowing && isLandSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'surface' }, error: null };
    }
    if (from.region === 'surface' && hasSubmerge && isWaterSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'underwater' }, error: null };
    }
    if (from.region === 'underwater' && hasSubmerge && isWaterSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'surface' }, error: null };
    }
    return { error: 'Cannot change region at this location' };
  }

  const cell = state.realm[toSquare.row][toSquare.col];
  const hasSite = Boolean(cell.siteInstanceId);

  if (!hasSite) {
    if (!hasVoidwalk) return { error: 'Cannot move to void without Voidwalk' };
    return { location: { square: toSquare, region: 'void' }, error: null };
  }

  if (from.region === 'void' && !hasVoidwalk) {
    return { error: 'Only Voidwalk units can move in the void' };
  }

  if (from.region === 'underground') {
    if (!isLandSite(state, toSquare)) return { error: 'Burrowing units can only move underground through land sites' };
    return { location: { square: toSquare, region: 'underground' }, error: null };
  }

  if (from.region === 'underwater') {
    if (!isWaterSite(state, toSquare)) return { error: 'Submerged units can only move underwater through water sites' };
    return { location: { square: toSquare, region: 'underwater' }, error: null };
  }

  if (from.region === 'void') {
    if (hasSubmerge && isWaterSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'underwater' }, error: null };
    }
    if (hasBurrowing && isLandSite(state, toSquare)) {
      return { location: { square: toSquare, region: 'underground' }, error: null };
    }
    return { location: { square: toSquare, region: 'surface' }, error: null };
  }

  return { location: { square: toSquare, region: 'surface' }, error: null };
}

// ─── Player helpers ───────────────────────────────────────────────────────────
export function opponent(playerId: PlayerId): PlayerId {
  return playerId === 'player1' ? 'player2' : 'player1';
}

export function getManaAvailable(player: Player): number {
  return player.manaPool - player.manaUsed;
}
