import type { Card, KeywordAbility } from '../types';

type KeywordPattern = { keyword: KeywordAbility; pattern: RegExp };

// Token-anchored patterns: match one whole token (not substring inside a sentence).
// Used for extracting keywords from the first paragraph of rules text, where the
// paragraph is a keyword list (single words / comma-separated words) rather than
// a descriptive sentence.
const KEYWORD_PATTERNS: KeywordPattern[] = [
  { keyword: 'airborne', pattern: /^airborne$/i },
  { keyword: 'burrowing', pattern: /^burrow(?:ing|er|ers)?$/i },
  { keyword: 'charge', pattern: /^charge$/i },
  { keyword: 'deathrite', pattern: /^deathrite$/i },
  { keyword: 'disable', pattern: /^disable(?:d)?$/i },
  { keyword: 'genesis', pattern: /^genesis$/i },
  { keyword: 'immobile', pattern: /^immobile$/i },
  { keyword: 'lance', pattern: /^lance$/i },
  { keyword: 'lethal', pattern: /^lethal$/i },
  { keyword: 'ranged', pattern: /^ranged$/i },
  { keyword: 'spellcaster', pattern: /^spellcaster(?:s)?$/i },
  { keyword: 'stealth', pattern: /^stealth$/i },
  { keyword: 'submerge', pattern: /^submerge(?:d|r|rs|s)?$/i },
  { keyword: 'voidwalk', pattern: /^voidwalk(?:er|ers)?$/i },
  { keyword: 'ward', pattern: /^ward(?:ed|s)?$/i },
  { keyword: 'waterbound', pattern: /^waterbound$/i },
  { keyword: 'flooded', pattern: /^flood(?:ed|ing|s)?$/i },
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

// Extracts keywords only from the first paragraph of rules text, and only when
// that paragraph is a keyword list — single keyword words separated by commas
// or whitespace (optionally with a numeric modifier like "Ranged 2").
// Sentence-like text is rejected to avoid grabbing conditional references such
// as "while Warded" or "Other nearby Mortals have +1 power".
export function extractKeywordsFromText(text: string): KeywordAbility[] {
  const firstParagraph = text.split(/\r?\n\r?\n/)[0] ?? '';
  const cleaned = firstParagraph.replace(/[.,;:!?]+$/g, '').trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(/[,\s]+/).filter(Boolean);
  const found: KeywordAbility[] = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) continue; // numeric modifier (e.g. "Ranged 2")
    const match = KEYWORD_PATTERNS.find((kp) => kp.pattern.test(token));
    if (!match) return []; // a non-keyword token means this isn't a keyword list
    found.push(match.keyword);
  }
  return Array.from(new Set(found));
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
