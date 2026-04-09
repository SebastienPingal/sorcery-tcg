import { describe, expect, it } from 'vitest';
import { CARD_REGISTRY, EXTRACTED_KEYWORDS_BY_CARD_ID } from './cards';
import { extractKeywordsFromText } from './keywordExtraction';

describe('keyword extraction', () => {
  it('extracts keywords from plain ability text', () => {
    const extracted = extractKeywordsFromText('Submerge, Voidwalk. Genesis -> Flood nearby sites.');
    expect(extracted).toEqual(expect.arrayContaining(['submerge', 'voidwalk', 'genesis', 'flooded']));
  });

  it('extracts voidwalk from real card rules text', () => {
    const card = CARD_REGISTRY['aaj_kegon_ghost_crabs'];
    expect(card).toBeTruthy();
    if (!card || !('keywords' in card)) return;
    expect(card.keywords).toEqual(expect.arrayContaining(['submerge', 'voidwalk']));
    expect(EXTRACTED_KEYWORDS_BY_CARD_ID[card.id]).toEqual(expect.arrayContaining(['submerge', 'voidwalk']));
  });

  it('keeps extracted keywords indexed for real card ids', () => {
    const card = CARD_REGISTRY['aaj_kegon_ghost_crabs'];
    expect(card).toBeTruthy();
    if (!card || !('keywords' in card)) return;
    expect(EXTRACTED_KEYWORDS_BY_CARD_ID[card.id]).toEqual(expect.arrayContaining(['submerge', 'voidwalk']));
  });
});
 