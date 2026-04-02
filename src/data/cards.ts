import type {
  AvatarCard, SiteCard, MinionCard, ArtifactCard, MagicCard, Card
} from '../types';
import { REAL_CARDS } from './realCards';

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
  ...AVATARS,
  ...SITES,
  ...MINIONS,
  ...ARTIFACTS,
  ...MAGICS,
  ...REAL_CARDS,  // official cards from curiosa.io API
];

export const CARD_REGISTRY: Record<string, Card> = Object.fromEntries(
  ALL_CARDS.map(c => [c.id, c])
);

// ─── Pre-built decks using real cards ─────────────────────────────────────────
// Fire/Earth deck — uses Ancient Dragon, Accusation, Active Volcano
export function buildFireAtlas(): string[] {
  return [
    // Real cards
    ...Array(4).fill('accursed_desert'),    // Fire×1
    ...Array(2).fill('active_volcano'),     // Fire×2 (Elite: max 2)
    ...Array(1).fill('altar_of_malachai'),  // Neutral (Unique: max 1)
    // Fill to 30
    ...Array(4).fill('site_arid_desert'),
    ...Array(4).fill('site_red_desert'),
    ...Array(4).fill('site_volcanic_field'),
    ...Array(4).fill('site_humble_village'),
    ...Array(4).fill('site_steppe'),
    ...Array(4).fill('site_mountain_pass'),
    ...Array(3).fill('site_dark_tower'),
  ]; // 30 sites
}

// Water/Air deck — uses Aaj-kegon Ghost Crabs, Abaddon Succubus, Adept Illusionist, Aino, Abyssal Assault
export function buildWaterAtlas(): string[] {
  return [
    // Real cards
    ...Array(4).fill('algae_bloom'),        // Water×1
    ...Array(2).fill('accursed_tower'),     // Air×1
    // Fill to 30
    ...Array(4).fill('site_spring_river'),
    ...Array(4).fill('site_autumn_river'),
    ...Array(4).fill('site_floodplain'),
    ...Array(4).fill('site_ocean_trench'),
    ...Array(4).fill('site_humble_village'),
    ...Array(4).fill('site_steppe'),
    ...Array(4).fill('site_holy_ground'),
    ...Array(4).fill('site_mountain_pass'),
  ]; // 30 sites
}

export function buildFireSpellbook(): string[] {
  return [
    // Real cards
    ...Array(4).fill('amazon_warriors'),       // Ordinary Minion Earth×1
    ...Array(4).fill('alvalinne_dryads'),       // Ordinary Minion Earth×1
    ...Array(4).fill('albespine_pikemen'),      // Exceptional Minion Earth×2
    ...Array(2).fill('ancient_dragon'),         // Elite Minion Fire×3 (max 2)
    ...Array(2).fill('accusation'),             // Exceptional Magic Fire×2
    ...Array(2).fill('all_mortals_gone'),       // Unique Magic Air×2 (max 1 but Unique)
    // Fill to 60
    ...Array(4).fill('minion_rimland_nomads'),
    ...Array(4).fill('minion_foot_soldier'),
    ...Array(4).fill('minion_lava_salamander'),
    ...Array(4).fill('minion_seasoned_sellsword'),
    ...Array(4).fill('minion_cave_trolls'),
    ...Array(4).fill('magic_heat_ray'),
    ...Array(4).fill('magic_firebolt'),
    ...Array(4).fill('minion_sand_worm'),
    ...Array(4).fill('minion_king_of_the_realm'),
    ...Array(4).fill('artifact_spear_of_destiny'),
    ...Array(4).fill('minion_plumed_pegasus'),
    ...Array(4).fill('minion_scourge_zombies'),
  ]; // 60
}

export function buildWaterSpellbook(): string[] {
  return [
    // Real cards
    ...Array(2).fill('aaj_kegon_ghost_crabs'),  // Elite Minion Water×2 (max 2)
    ...Array(2).fill('abaddon_succubus'),         // Elite Minion Water×2
    ...Array(4).fill('accursed_albatross'),       // Exceptional Minion Water×1
    ...Array(2).fill('adept_illusionist'),        // Elite Minion Water×2
    ...Array(1).fill('aino'),                     // Unique Minion Water×2
    ...Array(2).fill('aethermoeba'),              // Elite Minion Air×2
    ...Array(1).fill('adtonitum'),                // Unique Minion Air×3
    ...Array(4).fill('abyssal_assault'),          // Exceptional Magic Water×2
    // Fill to 60
    ...Array(4).fill('minion_foot_soldier'),
    ...Array(4).fill('minion_seasoned_sellsword'),
    ...Array(4).fill('minion_plumed_pegasus'),
    ...Array(4).fill('minion_rimland_nomads'),
    ...Array(4).fill('magic_lightning_bolt'),
    ...Array(4).fill('magic_heat_ray'),
    ...Array(4).fill('minion_amazon_warriors'),
    ...Array(4).fill('minion_cave_trolls'),
    ...Array(4).fill('minion_sand_worm'),
    ...Array(4).fill('minion_scourge_zombies'),
    ...Array(4).fill('artifact_spear_of_destiny'),
    ...Array(4).fill('minion_king_of_the_realm'),
  ]; // 60
}
