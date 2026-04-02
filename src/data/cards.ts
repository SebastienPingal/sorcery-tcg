import type {
  AvatarCard, SiteCard, MinionCard, ArtifactCard, MagicCard, Card
} from '../types';
import { REAL_CARDS } from './realCards';

const REAL_IMAGE_BY_ID = new Map(
  REAL_CARDS
    .filter(card => typeof card.image === 'string' && card.image.length > 0)
    .map(card => [card.id, card.image as string])
);

const REAL_IMAGE_BY_NAME = new Map(
  REAL_CARDS
    .filter(card => typeof card.image === 'string' && card.image.length > 0)
    .map(card => [card.name.toLowerCase(), card.image as string])
);

const LOCAL_TO_REAL_ID: Record<string, string> = {
  avatar_sparkmage: 'sparkmage',
  avatar_sorcerer: 'sorcerer',
};

function withFallbackImage<T extends Card>(card: T): T {
  if (card.image) return card;
  const mappedId = LOCAL_TO_REAL_ID[card.id];
  const image = (mappedId ? REAL_IMAGE_BY_ID.get(mappedId) : undefined)
    ?? REAL_IMAGE_BY_NAME.get(card.name.toLowerCase());
  return image ? ({ ...card, image } as T) : card;
}

// ─── Avatars ──────────────────────────────────────────────────────────────────
export const AVATARS: AvatarCard[] = [
  {
    id: 'avatar_sparkmage',
    name: 'Sparkmage',
    type: 'avatar',
    rarity: 'unique',
    startingLife: 20,
    attackPower: 1,
    flavorText: "Your Avatar's enemies are in for a shock!",
    abilities: [
      {
        id: 'sparkmage_play_site',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Play or draw a site.',
        effect: { type: 'play_or_draw_site' },
      },
      {
        id: 'sparkmage_shock',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Target nearby location. Deal damage to another random unit there equal to the sum of Fire affinity on spells cast this turn.',
        effect: { type: 'deal_damage', amount: 0, target: 'unit' }, // computed dynamically
      },
    ],
  },
  {
    id: 'avatar_flamecaller',
    name: 'Flamecaller',
    type: 'avatar',
    rarity: 'unique',
    startingLife: 20,
    attackPower: 1,
    flavorText: 'You call from the ashes to rise.',
    abilities: [
      {
        id: 'flamecaller_play_site',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Play or draw a site.',
        effect: { type: 'play_or_draw_site' },
      },
      {
        id: 'flamecaller_projectile',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Shoot a projectile. It deals damage equal to the sum of all Fire affinity on spells cast this turn.',
        effect: { type: 'deal_damage', amount: 0, target: 'unit' },
      },
    ],
  },
  {
    id: 'avatar_sorcerer',
    name: 'Sorcerer',
    type: 'avatar',
    rarity: 'unique',
    startingLife: 20,
    attackPower: 1,
    flavorText: 'Your Avatar has entered the contest.',
    abilities: [
      {
        id: 'sorcerer_play_site',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Play or draw a site.',
        effect: { type: 'play_or_draw_site' },
      },
      {
        id: 'sorcerer_draw_spell',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Draw a spell.',
        effect: { type: 'draw_spell' },
      },
    ],
  },
];

// ─── Sites ────────────────────────────────────────────────────────────────────
export const SITES: SiteCard[] = [
  {
    id: 'site_arid_desert',
    name: 'Arid Desert',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { fire: 1 },
    abilities: [],
    flavorText: 'The sands remember all who cross them.',
  },
  {
    id: 'site_humble_village',
    name: 'Humble Village',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { earth: 1 },
    abilities: [],
    flavorText: 'Simple folk, simple needs.',
  },
  {
    id: 'site_ancient_forest',
    name: 'Ancient Forest',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { earth: 1 },
    abilities: [],
    flavorText: 'The trees here predate civilization.',
  },
  {
    id: 'site_mountain_pass',
    name: 'Mountain Pass',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { earth: 1 },
    abilities: [],
  },
  {
    id: 'site_spring_river',
    name: 'Spring River',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: true,
    threshold: { water: 1 },
    abilities: [],
  },
  {
    id: 'site_autumn_river',
    name: 'Autumn River',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: true,
    threshold: { water: 1 },
    abilities: [],
    flavorText: 'The current carries everything downstream.',
  },
  {
    id: 'site_dark_tower',
    name: 'Dark Tower',
    type: 'site',
    rarity: 'exceptional',
    isWaterSite: false,
    threshold: { air: 1 },
    abilities: [],
    flavorText: 'Its shadow stretches further than its height.',
  },
  {
    id: 'site_holy_ground',
    name: 'Holy Ground',
    type: 'site',
    rarity: 'exceptional',
    isWaterSite: false,
    threshold: { air: 1 },
    abilities: [],
  },
  {
    id: 'site_floodplain',
    name: 'Floodplain',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: true,
    threshold: { water: 1 },
    abilities: [],
  },
  {
    id: 'site_steppe',
    name: 'Steppe',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { earth: 1 },
    abilities: [],
  },
  {
    id: 'site_red_desert',
    name: 'Red Desert',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { fire: 1 },
    abilities: [],
  },
  {
    id: 'site_volcanic_field',
    name: 'Volcanic Field',
    type: 'site',
    rarity: 'exceptional',
    isWaterSite: false,
    threshold: { fire: 2 },
    abilities: [],
    flavorText: 'The earth itself burns here.',
  },
  {
    id: 'site_sky_fortress',
    name: 'Sky Fortress',
    type: 'site',
    rarity: 'elite',
    isWaterSite: false,
    threshold: { air: 2 },
    abilities: [],
    flavorText: 'Built among the clouds, unreachable to most.',
  },
  {
    id: 'site_deep_cave',
    name: 'Deep Cave',
    type: 'site',
    rarity: 'ordinary',
    isWaterSite: false,
    threshold: { earth: 1 },
    abilities: [],
  },
  {
    id: 'site_ocean_trench',
    name: 'Ocean Trench',
    type: 'site',
    rarity: 'exceptional',
    isWaterSite: true,
    threshold: { water: 2 },
    abilities: [],
  },
];

// ─── Minions ──────────────────────────────────────────────────────────────────
export const MINIONS: MinionCard[] = [
  {
    id: 'minion_rimland_nomads',
    name: 'Rimland Nomads',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 2,
    threshold: { fire: 1 },
    power: 2,
    subtypes: ['Mortal'],
    keywords: [],
    abilities: [
      {
        id: 'rimland_movement',
        trigger: 'passive',
        description: 'Movement +1',
        effect: { type: 'move_unit', steps: 1 },
        movementBonus: 1,
      },
    ],
    flavorText: 'As the lands shift, so shall we.',
  },
  {
    id: 'minion_amazon_warriors',
    name: 'Amazon Warriors',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 3,
    threshold: { earth: 1 },
    power: 5,
    subtypes: ['Mortal'],
    keywords: [],
    abilities: [],
    flavorText: "Tonight we keep watch. And tomorrow, before the dawn, we shall arm ourselves with our weapons and besiege their hollow vessels, make better bitter foes.",
  },
  {
    id: 'minion_foot_soldier',
    name: 'Foot Soldier',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 1,
    threshold: {},
    power: 1,
    subtypes: ['Mortal'],
    keywords: [],
    abilities: [],
    flavorText: 'Farewell, farewell, O warrior brave, Nobody can from Death thee save.',
  },
  {
    id: 'minion_plumed_pegasus',
    name: 'Plumed Pegasus',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 3,
    threshold: { air: 1 },
    power: 3,
    subtypes: ['Beast'],
    keywords: ['airborne'],
    abilities: [
      {
        id: 'pegasus_airborne',
        trigger: 'passive',
        keyword: 'airborne',
        description: 'Airborne',
        effect: { type: 'noop' },
      },
    ],
    flavorText: 'An Ordinary Beast of extraordinary extravagance.',
  },
  {
    id: 'minion_cave_trolls',
    name: 'Cave Trolls',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 3,
    threshold: { earth: 1 },
    power: 3,
    subtypes: ['Monster'],
    keywords: ['burrowing'],
    abilities: [
      {
        id: 'cave_trolls_burrowing',
        trigger: 'passive',
        keyword: 'burrowing',
        description: 'Burrowing',
        effect: { type: 'noop' },
      },
    ],
    flavorText: 'We dig, we lug, we pull. We dig, then we drag and pull.',
  },
  {
    id: 'minion_lava_salamander',
    name: 'Lava Salamander',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 2,
    threshold: { fire: 1 },
    power: 2,
    subtypes: ['Beast'],
    keywords: [],
    abilities: [
      {
        id: 'lava_fire_spellcaster',
        trigger: 'passive',
        keyword: 'spellcaster',
        description: 'Fire Spellcaster. Takes no damage from Fire.',
        effect: { type: 'noop' },
      },
    ],
  },
  {
    id: 'minion_seasoned_sellsword',
    name: 'Seasoned Sellsword',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 2,
    threshold: {},
    power: 3,
    subtypes: ['Mortal'],
    keywords: [],
    abilities: [],
    flavorText: 'Coin first, questions later.',
  },
  {
    id: 'minion_king_of_the_realm',
    name: 'King of the Realm',
    type: 'minion',
    rarity: 'unique',
    manaCost: 7,
    threshold: { earth: 2 },
    power: 7,
    subtypes: ['Mortal'],
    keywords: [],
    abilities: [
      {
        id: 'king_passive',
        trigger: 'passive',
        description: 'Other Mortals have +1 power. You control all Mortals.',
        effect: { type: 'noop' },
      },
    ],
    flavorText: 'Other Mortals bow before Leontes.',
  },
  {
    id: 'minion_scourge_zombies',
    name: 'Scourge Zombies',
    type: 'minion',
    rarity: 'ordinary',
    manaCost: 4,
    threshold: {},
    power: 4,
    subtypes: ['Undead'],
    keywords: [],
    abilities: [
      {
        id: 'zombies_trigger',
        trigger: 'passive',
        description: 'Whenever an allied Mortal dies on land, you may summon Scourge Zombies from your cemetery to its location, tapped.',
        effect: { type: 'noop' },
      },
    ],
  },
  {
    id: 'minion_sand_worm',
    name: 'Sand Worm',
    type: 'minion',
    rarity: 'exceptional',
    manaCost: 4,
    threshold: { earth: 2 },
    power: 6,
    subtypes: ['Beast'],
    keywords: ['burrowing'],
    abilities: [
      {
        id: 'sand_worm_burrowing',
        trigger: 'passive',
        keyword: 'burrowing',
        description: 'Burrowing',
        effect: { type: 'noop' },
      },
    ],
  },
];

// ─── Artifacts ────────────────────────────────────────────────────────────────
export const ARTIFACTS: ArtifactCard[] = [
  {
    id: 'artifact_spear_of_destiny',
    name: 'Spear of Destiny',
    type: 'artifact',
    rarity: 'unique',
    manaCost: 5,
    subtypes: ['weapon'],
    isAutomaton: false,
    isMonument: false,
    keywords: [],
    abilities: [
      {
        id: 'spear_throw',
        trigger: 'tap',
        cost: { tap: true },
        description: 'Throw Spear of Destiny at any minion anywhere. It teleports to that minion\'s location and kills it.',
        effect: { type: 'deal_damage', amount: 999, target: 'unit' },
      },
    ],
    flavorText: "Nor mortal's blood sate a hunger erst whetted by divine.",
  },
];

// ─── Magics ───────────────────────────────────────────────────────────────────
export const MAGICS: MagicCard[] = [
  {
    id: 'magic_heat_ray',
    name: 'Heat Ray',
    type: 'magic',
    rarity: 'ordinary',
    manaCost: 3,
    threshold: { fire: 1 },
    abilities: [
      {
        id: 'heat_ray_effect',
        trigger: 'tap',
        description: 'Shoot a piercing projectile. Deal 2 damage to one unit at each location along its path.',
        effect: { type: 'deal_damage', amount: 2, target: 'unit' },
      },
    ],
    flavorText: 'An Ordinary Magic of focused fire.',
  },
  {
    id: 'magic_firebolt',
    name: 'Firebolt',
    type: 'magic',
    rarity: 'ordinary',
    manaCost: 1,
    threshold: { fire: 1 },
    abilities: [
      {
        id: 'firebolt_effect',
        trigger: 'tap',
        description: 'Deal 1 damage to target unit.',
        effect: { type: 'deal_damage', amount: 1, target: 'unit' },
      },
    ],
  },
  {
    id: 'magic_lightning_bolt',
    name: 'Lightning Bolt',
    type: 'magic',
    rarity: 'exceptional',
    manaCost: 2,
    threshold: { air: 1 },
    abilities: [
      {
        id: 'lightning_bolt_effect',
        trigger: 'tap',
        description: 'Deal 3 damage to target unit or site.',
        effect: { type: 'deal_damage', amount: 3, target: 'unit' },
      },
    ],
  },
];

// ─── Master card registry ─────────────────────────────────────────────────────
const ALL_CARDS: Card[] = [
  ...AVATARS.map(withFallbackImage),
  ...SITES.map(withFallbackImage),
  ...MINIONS.map(withFallbackImage),
  ...ARTIFACTS.map(withFallbackImage),
  ...MAGICS.map(withFallbackImage),
  ...REAL_CARDS,  // full official card list from curiosa.io API
];

export const CARD_REGISTRY: Record<string, Card> = Object.fromEntries(
  ALL_CARDS.map(c => [c.id, c])
);

// ─── Pre-built decks using real cards ─────────────────────────────────────────
// Fire/Earth deck — uses Ancient Dragon, Accusation, Active Volcano
export function buildFireAtlas(): string[] {
  return [
    ...Array(4).fill('accursed_desert'),
    ...Array(4).fill('arid_desert'),
    ...Array(4).fill('red_desert'),
    ...Array(4).fill('active_volcano'),
    ...Array(4).fill('humble_village'),
    ...Array(4).fill('steppe'),
    ...Array(3).fill('mountain_pass'),
    ...Array(3).fill('dark_tower'),
  ]; // 30 sites
}

// Water/Air deck — uses Aaj-kegon Ghost Crabs, Abaddon Succubus, Adept Illusionist, Aino, Abyssal Assault
export function buildWaterAtlas(): string[] {
  return [
    ...Array(4).fill('algae_bloom'),
    ...Array(4).fill('spring_river'),
    ...Array(4).fill('autumn_river'),
    ...Array(4).fill('floodplain'),
    ...Array(4).fill('deep_sea'),
    ...Array(4).fill('humble_village'),
    ...Array(3).fill('holy_ground'),
    ...Array(3).fill('accursed_tower'),
  ]; // 30 sites
}

export function buildFireSpellbook(): string[] {
  return [
    ...Array(4).fill('amazon_warriors'),
    ...Array(4).fill('alvalinne_dryads'),
    ...Array(4).fill('albespine_pikemen'),
    ...Array(2).fill('ancient_dragon'),
    ...Array(2).fill('accusation'),
    ...Array(1).fill('all_mortals_gone'),
    ...Array(4).fill('angry_mob'),
    ...Array(4).fill('apprentice_wizard'),
    ...Array(4).fill('atlas_wanderers'),
    ...Array(4).fill('arcane_barrage'),
    ...Array(4).fill('blaze'),
    ...Array(4).fill('burning_hands'),
    ...Array(4).fill('chain_lightning'),
    ...Array(4).fill('charge'),
    ...Array(4).fill('amethyst_core'),
    ...Array(4).fill('all_terrain_vestments'),
    ...Array(3).fill('angels_egg'),
  ]; // 60
}

export function buildWaterSpellbook(): string[] {
  return [
    ...Array(2).fill('aaj_kegon_ghost_crabs'),
    ...Array(2).fill('abaddon_succubus'),
    ...Array(4).fill('accursed_albatross'),
    ...Array(2).fill('adept_illusionist'),
    ...Array(1).fill('aino'),
    ...Array(2).fill('aethermoeba'),
    ...Array(1).fill('adtonitum'),
    ...Array(4).fill('abyssal_assault'),
    ...Array(4).fill('anui_undine'),
    ...Array(4).fill('apostles_of_thamariel'),
    ...Array(4).fill('assorted_animals'),
    ...Array(4).fill('attack_by_night'),
    ...Array(4).fill('baptize'),
    ...Array(4).fill('blink'),
    ...Array(4).fill('boil'),
    ...Array(4).fill('browse'),
    ...Array(3).fill('call_of_the_sea'),
    ...Array(3).fill('chaoswish'),
    ...Array(4).fill('mariners_curse'),
  ]; // 60
}
