import type {
  PredicateContext, PredicateClause, PredicateEntry, PredicateRestriction,
  Element, MinionCard,
} from '../types';
import { adjacentSquares, hasKeyword, REALM_ROWS } from './utils';

// ─── Predicate function signature ────────────────────────────────────────────
export type PredicateFn = (ctx: PredicateContext, params?: Record<string, unknown>) => boolean;

// ─── Registry ────────────────────────────────────────────────────────────────
const registry = new Map<string, PredicateFn>();

export function registerPredicate(name: string, fn: PredicateFn): void {
  registry.set(name, fn);
}

export function getPredicate(name: string): PredicateFn | undefined {
  return registry.get(name);
}

// ─── Evaluator ───────────────────────────────────────────────────────────────
function resolveEntry(entry: PredicateEntry): { name: string; params?: Record<string, unknown> } {
  if (typeof entry === 'string') return { name: entry };
  if ('predicate' in entry) return { name: entry.predicate, params: entry.params };
  // Legacy format: { type: 'name', ...params }
  const { type: name, ...rest } = entry as Record<string, unknown>;
  return { name: name as string, params: Object.keys(rest).length > 0 ? rest : undefined };
}

function evaluateClause(ctx: PredicateContext, clause: PredicateClause): boolean {
  // Nested group
  if (typeof clause === 'object' && 'group' in clause) {
    return evaluateRestriction(ctx, clause.group);
  }
  // Predicate entry
  const { name, params } = resolveEntry(clause as PredicateEntry);
  const fn = registry.get(name);
  if (!fn) throw new Error(`Unknown predicate: "${name}"`);
  return fn(ctx, params);
}

export function evaluateRestriction(ctx: PredicateContext, restriction: PredicateRestriction): boolean {
  if (restriction.all && !restriction.all.every((c) => evaluateClause(ctx, c))) return false;
  if (restriction.any && restriction.any.length > 0 && !restriction.any.some((c) => evaluateClause(ctx, c))) return false;
  if (restriction.not && restriction.not.some((c) => evaluateClause(ctx, c))) return false;
  return true;
}

// ─── Built-in predicates ─────────────────────────────────────────────────────

// -- Instance predicates (caster eligibility, unit targeting) --

registerPredicate('spellcaster', (ctx) => {
  if (!ctx.instance) return false;
  if (!hasKeyword(ctx.instance, 'spellcaster')) return false;
  // If a card is provided, also check element compatibility
  if (ctx.card) return canSpellcasterCastCard(ctx.instance, ctx.card);
  return true;
});

registerPredicate('has_keyword', (ctx, params) => {
  if (!ctx.instance || !params?.keyword) return false;
  return hasKeyword(ctx.instance, params.keyword as string);
});

registerPredicate('has_subtype', (ctx, params) => {
  if (!ctx.instance || !params?.subtype) return false;
  return instanceHasSubtype(ctx.instance, params.subtype as string);
});

registerPredicate('is_avatar', (ctx, params) => {
  const isAvatar = ctx.instance?.card.type === 'avatar';
  if (params?.value !== undefined) return isAvatar === params.value;
  return isAvatar;
});

registerPredicate('is_minion', (ctx) => {
  return ctx.instance?.card.type === 'minion';
});

registerPredicate('in_region', (ctx, params) => {
  if (!params?.region) return false;
  return ctx.instance?.location?.region === params.region;
});

registerPredicate('has_token', (ctx, params) => {
  if (!ctx.instance || !params?.token) return false;
  return ctx.instance.tokens.includes(params.token as string);
});

registerPredicate('rules_text_matches', (ctx, params) => {
  if (!ctx.instance || !params?.pattern) return false;
  const text = (ctx.instance.card.rulesText ?? '').toLowerCase();
  return text.includes((params.pattern as string).toLowerCase());
});

registerPredicate('is_friendly', (ctx) => {
  if (!ctx.instance) return false;
  return ctx.instance.controllerId === ctx.playerId;
});

registerPredicate('is_enemy', (ctx) => {
  if (!ctx.instance) return false;
  return ctx.instance.controllerId !== ctx.playerId;
});

registerPredicate('is_tapped', (ctx) => {
  return ctx.instance?.tapped === true;
});

registerPredicate('is_untapped', (ctx) => {
  return ctx.instance?.tapped === false;
});

// -- Target predicates (spell/ability targeting — evaluate ctx.target) --

registerPredicate('target_is_minion', (ctx) => {
  return ctx.target?.card.type === 'minion';
});

registerPredicate('target_is_avatar', (ctx) => {
  return ctx.target?.card.type === 'avatar';
});

registerPredicate('target_is_site', (ctx) => {
  return ctx.target?.card.type === 'site';
});

registerPredicate('target_is_friendly', (ctx) => {
  if (!ctx.target) return false;
  return ctx.target.controllerId === ctx.playerId;
});

registerPredicate('target_is_enemy', (ctx) => {
  if (!ctx.target) return false;
  return ctx.target.controllerId !== ctx.playerId;
});

registerPredicate('target_has_keyword', (ctx, params) => {
  if (!ctx.target || !params?.keyword) return false;
  return hasKeyword(ctx.target, params.keyword as string);
});

registerPredicate('target_has_subtype', (ctx, params) => {
  if (!ctx.target || !params?.subtype) return false;
  return instanceHasSubtype(ctx.target, params.subtype as string);
});

registerPredicate('target_has_token', (ctx, params) => {
  if (!ctx.target || !params?.token) return false;
  return ctx.target.tokens.includes(params.token as string);
});

registerPredicate('target_in_region', (ctx, params) => {
  if (!ctx.target || !params?.region) return false;
  return ctx.target.location?.region === params.region;
});

registerPredicate('target_on_water_site', (ctx) => {
  if (!ctx.target?.location?.square) return false;
  const sq = ctx.target.location.square;
  const cell = ctx.state.realm[sq.row][sq.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  if (!site || site.card.type !== 'site') return false;
  return site.card.isWaterSite || hasKeyword(site, 'flooded');
});

// -- Square predicates (placement, square targeting) --

registerPredicate('on_water_site', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  if (!site || site.card.type !== 'site') return false;
  return site.card.isWaterSite || hasKeyword(site, 'flooded');
});

registerPredicate('on_land_site', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  if (!site || site.card.type !== 'site') return false;
  return !site.card.isWaterSite && !hasKeyword(site, 'flooded');
});

registerPredicate('on_void', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  return !cell.siteInstanceId;
});

registerPredicate('column', (ctx, params) => {
  if (!ctx.square || !params?.columns) return false;
  return (params.columns as number[]).includes(ctx.square.col);
});

registerPredicate('row', (ctx, params) => {
  if (!ctx.square || !params?.rows) return false;
  return (params.rows as number[]).includes(ctx.square.row);
});

registerPredicate('on_owner_back_row', (ctx) => {
  if (!ctx.square) return false;
  const backRow = ctx.playerId === 'player1' ? REALM_ROWS - 1 : 0;
  return ctx.square.row === backRow;
});

registerPredicate('on_controlled_site', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  return site?.controllerId === ctx.playerId;
});

registerPredicate('on_enemy_site', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  return site != null && site.controllerId !== ctx.playerId;
});

registerPredicate('square_has_enemy_unit', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  return [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds].some((id) => {
    const inst = ctx.state.instances[id];
    return inst && inst.controllerId !== ctx.playerId;
  });
});

registerPredicate('square_has_friendly_unit', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  return [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds].some((id) => {
    const inst = ctx.state.instances[id];
    return inst && inst.controllerId === ctx.playerId;
  });
});

registerPredicate('square_is_empty', (ctx) => {
  if (!ctx.square) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  return cell.unitInstanceIds.length === 0 && cell.subsurfaceUnitIds.length === 0;
});

registerPredicate('adjacent_to_friendly_unit', (ctx) => {
  if (!ctx.square) return false;
  return adjacentSquares(ctx.square).some((adj) => {
    const cell = ctx.state.realm[adj.row][adj.col];
    return [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds].some((id) => {
      const inst = ctx.state.instances[id];
      return inst && inst.controllerId === ctx.playerId;
    });
  });
});

registerPredicate('adjacent_to_enemy_unit', (ctx) => {
  if (!ctx.square) return false;
  return adjacentSquares(ctx.square).some((adj) => {
    const cell = ctx.state.realm[adj.row][adj.col];
    return [...cell.unitInstanceIds, ...cell.subsurfaceUnitIds].some((id) => {
      const inst = ctx.state.instances[id];
      return inst && inst.controllerId !== ctx.playerId;
    });
  });
});

registerPredicate('site_has_element', (ctx, params) => {
  if (!ctx.square || !params?.element) return false;
  const cell = ctx.state.realm[ctx.square.row][ctx.square.col];
  if (!cell.siteInstanceId) return false;
  const site = ctx.state.instances[cell.siteInstanceId];
  if (!site || site.card.type !== 'site') return false;
  const el = params.element as Element;
  return (site.card.threshold[el] ?? 0) > 0;
});

registerPredicate('adjacent_to_element', (ctx, params) => {
  if (!ctx.square || !params?.element) return false;
  const el = params.element as Element;
  return adjacentSquares(ctx.square).some((adj) => {
    const cell = ctx.state.realm[adj.row][adj.col];
    if (!cell.siteInstanceId) return false;
    const site = ctx.state.instances[cell.siteInstanceId];
    if (!site || site.card.type !== 'site') return false;
    return (site.card.threshold[el] ?? 0) > 0;
  });
});

// ─── Spellcaster element compatibility (internal) ────────────────────────────
// Ported from the old canSpellcasterCastCard logic in utils.ts.

import type { Card, CardInstance } from '../types';

const ELEMENTS: Element[] = ['air', 'earth', 'fire', 'water'];

function getCardTextForProfile(inst: CardInstance): string {
  const cardRules = inst.card.rulesText ?? '';
  const cardAbilities = 'abilities' in inst.card
    ? inst.card.abilities.map((a) => a.description ?? '').join('\n')
    : '';
  const temporaryRules = inst.temporaryAbilities.map((a) => a.description ?? '').join('\n');
  return `${cardRules}\n${cardAbilities}\n${temporaryRules}`.toLowerCase();
}

function getSpellcasterProfile(inst: CardInstance): { allowed: Set<Element>; blocked: Set<Element> } {
  const text = getCardTextForProfile(inst);
  const allowed = new Set<Element>();
  const blocked = new Set<Element>();

  for (const el of ELEMENTS) {
    if (new RegExp(`\\bnon[-\\s]+${el}\\s+spellcaster\\b`, 'i').test(text)) blocked.add(el);
  }
  for (const m of text.matchAll(/\b(air|earth|fire|water)\s+and\s+(air|earth|fire|water)\s+spellcaster\b/g)) {
    allowed.add(m[1] as Element);
    allowed.add(m[2] as Element);
  }
  for (const m of text.matchAll(/\b(air|earth|fire|water)\s+spellcaster\b/g)) {
    const el = m[1] as Element;
    const start = m.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 6), start);
    if (prefix.endsWith('non-') || prefix.endsWith('non ')) continue;
    allowed.add(el);
  }
  return { allowed, blocked };
}

function getSpellThresholdElements(card: Card): Element[] {
  if (!('threshold' in card) || !card.threshold) return [];
  return ELEMENTS.filter((el) => (card.threshold[el] ?? 0) > 0);
}

function canSpellcasterCastCard(spellcaster: CardInstance, card: Card): boolean {
  if (!hasKeyword(spellcaster, 'spellcaster')) return false;
  const thresholdElements = getSpellThresholdElements(card);
  if (thresholdElements.length === 0) return true;
  const profile = getSpellcasterProfile(spellcaster);
  for (const el of thresholdElements) {
    if (profile.blocked.has(el)) return false;
  }
  if (profile.allowed.size === 0) return true;
  return thresholdElements.every((el) => profile.allowed.has(el));
}

function instanceHasSubtype(inst: CardInstance, subtype: string): boolean {
  if (inst.card.type !== 'minion') return false;
  const normalized = subtype.toLowerCase();
  const subtypes = (inst.card as MinionCard).subtypes ?? [];
  if (subtypes.some((s) => s.toLowerCase() === normalized)) return true;
  const typeLine = inst.card.typeLine ?? '';
  return new RegExp(`\\b${normalized}\\b`, 'i').test(typeLine);
}
