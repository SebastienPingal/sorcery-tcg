import type { CardInstance, KeywordAbility } from '../../types';
import type { GameState } from './gameState';
import { getAttackPower, getDefensePower, getMovementRange, hasKeyword } from '../utils';

export interface UnitStats {
  attackPower: number;
  defensePower: number;
  movement: number;
  keywords: KeywordAbility[];
}

export function computeStats(instanceId: string, state: GameState): UnitStats {
  const inst: CardInstance | undefined = state.instances[instanceId];
  if (!inst) {
    return { attackPower: 0, defensePower: 0, movement: 0, keywords: [] };
  }

  const keywordSet = new Set<KeywordAbility>();
  const candidates: KeywordAbility[] = [
    'airborne', 'burrowing', 'charge', 'deathrite', 'disable', 'genesis',
    'immobile', 'lethal', 'lance', 'ranged', 'spellcaster', 'stealth',
    'submerge', 'voidwalk', 'waterbound', 'flooded', 'ward',
  ];
  for (const kw of candidates) {
    if (hasKeyword(inst, kw)) keywordSet.add(kw);
  }

  return {
    attackPower: getAttackPower(inst, state),
    defensePower: getDefensePower(inst, state),
    movement: getMovementRange(inst),
    keywords: [...keywordSet],
  };
}
