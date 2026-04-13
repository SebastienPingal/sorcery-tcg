// ─── Elements ────────────────────────────────────────────────────────────────
export type Element = 'air' | 'earth' | 'fire' | 'water';
export type ElementalThreshold = Partial<Record<Element, number>>;

// ─── Grid ─────────────────────────────────────────────────────────────────────
export type Region = 'void' | 'surface' | 'underground' | 'underwater';

export interface Square {
  row: number; // 0 = opponent back row, 3 = player back row
  col: number; // 0-4 (5 columns)
}

export interface Location {
  square: Square;
  region: Region;
}

// ─── Rarity ───────────────────────────────────────────────────────────────────
export type Rarity = 'ordinary' | 'exceptional' | 'elite' | 'unique';

// ─── Card Types ───────────────────────────────────────────────────────────────
export type CardType = 'avatar' | 'site' | 'minion' | 'artifact' | 'aura' | 'magic';

export type ArtifactSubtype =
  | 'armor' | 'weapon' | 'relic' | 'device' | 'document'
  | 'automaton' | 'monument';

// Power can be a single number or split attack/defense
export type Power = number | { attack: number; defense: number };

// ─── Keyword Abilities ────────────────────────────────────────────────────────
export type KeywordAbility =
  | 'airborne'
  | 'burrowing'
  | 'charge'
  | 'deathrite'
  | 'disable'
  | 'genesis'
  | 'immobile'
  | 'lethal'
  | 'lance'
  | 'ranged'
  | 'spellcaster'
  | 'stealth'
  | 'submerge'
  | 'voidwalk'
  | 'waterbound'
  | 'flooded'
  | 'ward';

// ─── Universal Predicate System ──────────────────────────────────────────────
// Composable predicates reusable for caster eligibility, placement, targeting, etc.

// A predicate entry: string shorthand or parameterised call.
export type PredicateEntry =
  | string                                                   // e.g. 'on_water_site'
  | { predicate: string; params: Record<string, unknown> };  // e.g. { predicate: 'column', params: { columns: [0,4] } }

// Composable restriction with recursive nesting via 'group'.
export type PredicateClause =
  | PredicateEntry
  | { group: PredicateRestriction };

export interface PredicateRestriction {
  all?: PredicateClause[];
  any?: PredicateClause[];
  not?: PredicateClause[];
}

// Context passed to every predicate at evaluation time.
// Each usage (caster, placement, targeting…) populates the relevant fields.
export interface PredicateContext {
  state: GameState;
  playerId: PlayerId;
  square?: Square;         // placement, square targeting
  instance?: CardInstance;  // caster eligibility, the "subject" (e.g. who is casting)
  card?: Card;             // the card being cast / evaluated
  target?: CardInstance;   // spell/ability targeting: the card being targeted
}

export interface MovementBonus {
  type: 'movement_plus';
  value: number;
}

// ─── Ability Definitions ──────────────────────────────────────────────────────
export type AbilityTrigger =
  | 'tap'                  // activated by tapping
  | 'start_of_turn'        // triggered at start phase
  | 'end_of_turn'          // triggered at end phase
  | 'on_enter'             // genesis-style: when card enters realm
  | 'on_death'             // deathrite
  | 'passive';             // always-on

export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  cost?: { mana?: number; tap?: boolean; life?: number };
  threshold?: ElementalThreshold;
  keyword?: KeywordAbility;
  movementBonus?: number;   // Movement +X
  description: string;
  effect: AbilityEffect;
}

export type AbilityEffect =
  | { type: 'play_or_draw_site' }
  | { type: 'draw_spell' }
  | { type: 'deal_damage'; amount: number; target: 'unit' | 'site' | 'avatar' }
  | { type: 'gain_mana'; amount: number }
  | { type: 'gain_life'; amount: number }
  | { type: 'summon_token'; tokenId: string }
  | { type: 'move_unit'; steps: number }
  | { type: 'noop' }; // placeholder for complex effects

// ─── Base Card ────────────────────────────────────────────────────────────────
export interface BaseCard {
  id: string;           // unique card definition id
  name: string;
  type: CardType;
  rarity: Rarity;
  flavorText?: string;
  rulesText?: string;   // raw rules text from official data
  typeLine?: string;    // e.g. "An Ordinary Mortal of magnificent stature"
  image?: string;       // CDN URL
  artist?: string;
  // Controls whether UI must ask which spellcaster casts this card when several are eligible.
  // - auto: resolve caster automatically
  // - require_choice: force player to choose on the realm
  // - custom: card uses non-standard caster eligibility rules
  casterChoicePolicy?: 'auto' | 'require_choice' | 'custom';
  // Preferred modular eligibility model.
  // If omitted, runtime falls back to the default spellcaster rule.
  casterEligibility?: PredicateRestriction;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export interface AvatarCard extends BaseCard {
  type: 'avatar';
  startingLife: number;
  attackPower: number;
  abilities: Ability[];
}

// ─── Site ─────────────────────────────────────────────────────────────────────
export interface SiteCard extends BaseCard {
  type: 'site';
  threshold: ElementalThreshold; // affinities this site provides
  isWaterSite: boolean;          // has water threshold icon
  abilities: Ability[];
}

// ─── Minion ───────────────────────────────────────────────────────────────────
export interface MinionCard extends BaseCard {
  type: 'minion';
  manaCost: number;
  threshold: ElementalThreshold;
  power: Power;
  subtypes: string[];
  keywords: KeywordAbility[];
  abilities: Ability[];
  placementRestriction?: PredicateRestriction;
}

// ─── Artifact ─────────────────────────────────────────────────────────────────
export interface ArtifactCard extends BaseCard {
  type: 'artifact';
  manaCost: number;
  threshold?: ElementalThreshold; // most artifacts have no threshold
  subtypes: ArtifactSubtype[];
  isAutomaton: boolean;  // automatons are also minions
  isMonument: boolean;   // monuments can't be carried
  power?: Power;         // automatons have power
  keywords: KeywordAbility[];
  abilities: Ability[];
}

// ─── Aura ─────────────────────────────────────────────────────────────────────
export interface AuraCard extends BaseCard {
  type: 'aura';
  manaCost: number;
  threshold: ElementalThreshold;
  abilities: Ability[];
  durationTurns?: number; // if limited duration
}

// ─── Magic ────────────────────────────────────────────────────────────────────
export interface MagicCard extends BaseCard {
  type: 'magic';
  manaCost: number;
  threshold: ElementalThreshold;
  abilities: Ability[]; // effects when cast
}

export type Card = AvatarCard | SiteCard | MinionCard | ArtifactCard | AuraCard | MagicCard;

// ─── In-play instances ────────────────────────────────────────────────────────
// A CardInstance is a card that exists on the board with runtime state
export interface CardInstance {
  instanceId: string;      // unique per instance (UUID)
  cardId: string;          // references Card.id
  card: Card;
  ownerId: PlayerId;
  controllerId: PlayerId;
  location: Location | null; // null = not on board (hand/deck/cemetery)
  tapped: boolean;
  damage: number;          // current damage (cleared end of turn for minions)
  summoningSickness: boolean;
  carriedArtifacts: string[]; // instanceIds of carried artifacts
  carriedBy: string | null;   // instanceId of carrying unit
  isRubble: boolean;
  tokens: string[];        // status tokens (stealth, etc.)
  temporaryAbilities: Ability[];
  counters: Record<string, number>;
}

// ─── Players ──────────────────────────────────────────────────────────────────
export type PlayerId = 'player1' | 'player2';

export interface Player {
  id: PlayerId;
  name: string;
  life: number;
  maxLife: number;
  isAtDeathsDoor: boolean;
  deathsDoorTurn: number | null; // turn number when they entered Death's Door (immune that whole turn)
  manaPool: number;
  manaUsed: number;
  elementalAffinity: ElementalThreshold;
  avatarInstanceId: string;
  atlasCards: string[];       // instanceIds in order (top = index 0)
  spellbookCards: string[];   // instanceIds in order
  hand: string[];             // instanceIds
  cemetery: string[];         // instanceIds (face-up, order irrelevant)
}

// ─── Game Board ───────────────────────────────────────────────────────────────
// The realm: 4 rows × 5 cols = 20 squares
export interface RealmSquare {
  row: number;
  col: number;
  siteInstanceId: string | null; // the site card on this square (if any)
  unitInstanceIds: string[];     // units on the surface of this square
  artifactInstanceIds: string[]; // uncarried artifacts on surface
  subsurfaceUnitIds: string[];   // units in subsurface (underground/underwater)
  auraInstanceIds: string[];
}

// ─── Turn & Phase ─────────────────────────────────────────────────────────────
export type GamePhase = 'start' | 'main' | 'end';
export type TurnStep =
  | 'untap'
  | 'mana'
  | 'start_triggers'
  | 'draw'
  | 'main_open'
  | 'end_triggers'
  | 'cleanup_damage'
  | 'cleanup_effects'
  | 'turn_end';

// ─── Actions ──────────────────────────────────────────────────────────────────
export type GameAction =
  | { type: 'ADVANCE_PHASE' }
  | {
    type: 'CAST_SPELL';
    casterId: string;
    cardInstanceId: string;
    targetSquare?: Square;
    targetInstanceId?: string;
    targetRegion?: Region;
  }
  | { type: 'ACTIVATE_ABILITY'; unitInstanceId: string; abilityId: string; targetSquare?: Square; targetInstanceId?: string }
  | { type: 'MOVE_AND_ATTACK'; unitInstanceId: string; path: Square[]; attackTargetId?: string }
  | { type: 'DEFEND'; unitInstanceId: string; attackId: string }
  | { type: 'INTERCEPT'; unitInstanceId: string; attackerId: string }
  | { type: 'PICK_UP_ARTIFACT'; unitInstanceId: string; artifactInstanceId: string }
  | { type: 'DROP_ARTIFACT'; unitInstanceId: string; artifactInstanceId: string }
  | { type: 'PASS_TURN' }
  | { type: 'MULLIGAN'; returnCardIds: string[] }
  | { type: 'SELECT_FIRST_PLAYER'; playerId: PlayerId };

// ─── Game Log ─────────────────────────────────────────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'combat' | 'cast' | 'error' | 'phase';
}

// ─── Pending interaction ──────────────────────────────────────────────────────
export type PendingInteraction =
  | { type: 'select_target'; prompt: string; validTargets: string[]; forAction: GameAction }
  | { type: 'select_square'; prompt: string; validSquares: Square[]; forAction: GameAction }
  | { type: 'defend_prompt'; attackerId: string; targetId: string }
  | { type: 'mulligan'; playerId: PlayerId }
  | { type: 'choose_draw'; playerId: PlayerId }
  | null;

// ─── Full Game State ──────────────────────────────────────────────────────────
export type GameStatus = 'setup' | 'mulligan' | 'playing' | 'ended';

export interface GameState {
  status: GameStatus;
  phase: GamePhase;
  step: TurnStep;
  turnNumber: number;
  activePlayerId: PlayerId;
  players: Record<PlayerId, Player>;
  instances: Record<string, CardInstance>;
  realm: RealmSquare[][];  // [row][col]
  log: LogEntry[];
  pendingInteraction: PendingInteraction;
  winner: PlayerId | null;
  firstPlayerChosen: boolean;
  // Transient state for current turn
  currentTurn: {
    spellsCastCount: number;
    attacksDeclared: string[]; // instanceIds that attacked this turn
    unitsThatMoved: string[];
  };
}
