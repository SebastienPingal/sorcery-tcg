import type { Card, KeywordAbility } from '../types';

type KeywordPattern = { keyword: KeywordAbility; pattern: RegExp };

const KEYWORD_PATTERNS: KeywordPattern[] = [
  { keyword: 'airborne', pattern: /\bairborne\b/i },
  { keyword: 'burrowing', pattern: /\bburrow(?:ing|er|ers)?\b/i },
  { keyword: 'charge', pattern: /\bcharge\b/i },
  { keyword: 'deathrite', pattern: /\bdeathrite\b/i },
  { keyword: 'disable', pattern: /\bdisable(?:d)?\b/i },
  { keyword: 'genesis', pattern: /\bgenesis\b/i },
  { keyword: 'immobile', pattern: /\bimmobile\b/i },
  { keyword: 'lance', pattern: /\blance\b/i },
  { keyword: 'lethal', pattern: /\blethal\b/i },
  { keyword: 'ranged', pattern: /\branged(?:\s+\d+)?\b/i },
  { keyword: 'spellcaster', pattern: /\bspellcaster(?:s)?\b/i },
  { keyword: 'stealth', pattern: /\bstealth\b/i },
  { keyword: 'submerge', pattern: /\bsubmerge(?:d|r|rs|s)?\b/i },
  { keyword: 'voidwalk', pattern: /\bvoidwalk(?:er|ers)?\b/i },
  { keyword: 'ward', pattern: /\bward(?:ed|s)?\b/i },
  { keyword: 'waterbound', pattern: /\bwaterbound\b/i },
  { keyword: 'flooded', pattern: /\bflood(?:ed|ing|s)?\b/i },
];

function collectCardText(card: Card): string {
  const rulesText = card.rulesText ?? '';
  const abilityDescriptions = 'abilities' in card
    ? card.abilities.map((ability) => ability.description ?? '').join('\n')
    : '';
  return `${rulesText}\n${abilityDescriptions}`;
}

function existingKeywords(card: Card): KeywordAbility[] {
  if (!('keywords' in card) || !Array.isArray(card.keywords)) return [];
  return [...card.keywords];
}

export function extractKeywordsFromText(text: string): KeywordAbility[] {
  const found: KeywordAbility[] = [];
  for (const { keyword, pattern } of KEYWORD_PATTERNS) {
    if (pattern.test(text)) found.push(keyword);
  }
  return found;
}

export function extractKeywordsFromCard(card: Card): KeywordAbility[] {
  const merged = new Set<KeywordAbility>(existingKeywords(card));
  for (const keyword of extractKeywordsFromText(collectCardText(card))) {
    merged.add(keyword);
  }
  return Array.from(merged);
}

export function buildKeywordExtractionIndex(cards: Card[]): Record<string, KeywordAbility[]> {
  const entries = cards.map((card) => [card.id, extractKeywordsFromCard(card)] as const);
  return Object.fromEntries(entries);
}

export function applyExtractedKeywords(card: Card): Card {
  const extracted = extractKeywordsFromCard(card);
  if (!('keywords' in card) || !Array.isArray(card.keywords)) return card;
  return { ...card, keywords: extracted };
}
