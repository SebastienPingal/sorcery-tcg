# Motivation

Aujourd'hui la logique d'une carte est dispersée entre trois endroits :

- `usableCards.ts` — données (stats, keywords, rulesText) dans un fichier JSON de 1104 cartes
- `spellResolvers.ts` — logique de résolution des sorts, keyed par cardId
- `triggerResolvers.ts` — logique des triggers (genesis, deathrite), keyed par cardId

Le lien entre les trois est un string `cardId`. Quand on implémente une carte, il faut éditer plusieurs fichiers et rien ne garantit que la logique est en phase avec les données.

## Requirements

- Chaque carte doit être un fichier autonome contenant ses données ET sa logique
- Les cartes sans logique custom (vanilla) doivent rester simples
- Le moteur (`CARD_REGISTRY`, engine) ne doit pas changer de manière significative
- Les decks (`PRECON_DECKS`, `buildFireAtlas`, etc.) doivent continuer à référencer les cartes par ID

# Design Considerations/Options considered

**Option A : Un fichier par carte**
- Structure : `src/data/cards/boil.ts`, `src/data/cards/muddy_pigs.ts`, etc.
- Pros : Données + logique co-localisées, facile à naviguer, chaque carte est indépendante
- Cons : 1104 fichiers, gros `index.ts` d'import

**Option B : Un fichier par deck/thème**
- Structure : `src/data/cards/savior-deck.ts`, `src/data/cards/necromancer-deck.ts`
- Pros : Moins de fichiers, regroupement logique
- Cons : Les cartes partagées entre decks posent problème, fichiers potentiellement gros

**Option C : Garder le fichier unique avec des registries**
- C'est l'état actuel
- Pros : Simple, pas de refactor
- Cons : Logique dispersée, cardId comme seul lien

# Decision

**Option A : Un fichier par carte.** La majorité des fichiers seront des exports triviaux (data only), et les cartes avec logique seront lisibles d'un seul coup d'oeil.

# Implementation

## 1. Créer le type `CardDefinition`

```ts
// src/data/cards/types.ts
import type { Card, GameState, CardInstance, Square } from '../../types';
import type { SpellResolver } from '../../engine/spellResolvers';

export interface CardTriggers {
  genesis?: (state: GameState, instance: CardInstance) => void;
  deathrite?: (state: GameState, instance: CardInstance) => void;
  // Extensible: start_of_turn, end_of_turn, on_damage, etc.
}

export interface CardDefinition<T extends Card = Card> {
  data: T;
  spellResolver?: SpellResolver;    // pour les magic cards
  triggers?: CardTriggers;          // pour genesis, deathrite, etc.
}
```

## 2. Script pour éclater `usableCards.ts`

Écrire un script Node one-shot (`scripts/split-cards.mjs`) qui :

1. Lit `usableCards.ts` et parse chaque entrée
2. Pour chaque carte, génère un fichier `src/data/cards/{card_id}.ts` :

```ts
// src/data/cards/muddy_pigs.ts
import type { MinionCard } from '../../types';
import type { CardDefinition } from './types';

const card: CardDefinition<MinionCard> = {
  data: {
    id: 'muddy_pigs',
    name: 'Muddy Pigs',
    type: 'minion',
    manaCost: 2,
    threshold: { water: 1 },
    power: 2,
    subtypes: [],
    keywords: ['deathrite'],
    abilities: [],
    // ...
  },
};

export default card;
```

3. Génère `src/data/cards/index.ts` qui importe et exporte tout :

```ts
import muddy_pigs from './muddy_pigs';
import boil from './boil';
// ... 1104 imports

import { buildCardRegistry } from './registry';

export const { CARD_REGISTRY, SPELL_RESOLVERS, TRIGGER_RESOLVERS } =
  buildCardRegistry([muddy_pigs, boil, /* ... */]);
```

## 3. Créer `buildCardRegistry()`

```ts
// src/data/cards/registry.ts
export function buildCardRegistry(definitions: CardDefinition[]) {
  const cards: Record<string, Card> = {};
  
  for (const def of definitions) {
    cards[def.data.id] = def.data;
    
    if (def.spellResolver) {
      registerSpellResolver(def.data.id, def.spellResolver);
    }
    
    if (def.triggers?.genesis) {
      registerTriggerResolver(def.data.id, 'genesis', def.triggers.genesis);
    }
    if (def.triggers?.deathrite) {
      registerTriggerResolver(def.data.id, 'deathrite', def.triggers.deathrite);
    }
  }
  
  return { CARD_REGISTRY: cards };
}
```

## 4. Migrer les resolvers existants

Déplacer la logique de `spellResolvers.ts` et `triggerResolvers.ts` dans les fichiers de cartes correspondants :

- `boil.ts` ← resolver de `spellResolvers.ts`
- `muddy_pigs.ts` ← trigger de `triggerResolvers.ts`
- `virgin_in_prayer.ts` ← trigger de `triggerResolvers.ts`
- `nightwatchmen.ts` ← trigger de `triggerResolvers.ts`
- `town_priest.ts` ← trigger de `triggerResolvers.ts`
- `guardian_angel.ts` ← trigger de `triggerResolvers.ts`

Les fichiers `spellResolvers.ts` et `triggerResolvers.ts` gardent les types, le registry, et les helpers partagés (`applyWard`, `healPlayer`, etc.) mais plus les `registerXxx()` calls.

## 5. Mettre à jour les imports

- `cards.ts` importe `CARD_REGISTRY` depuis `cards/index.ts` au lieu de `usableCards.ts`
- Le moteur continue d'utiliser `CARD_REGISTRY` normalement
- Les decks continuent de référencer les cartes par string ID

## 6. Supprimer les fichiers obsolètes

- `src/data/usableCards.ts` (remplacé par les fichiers individuels)
- `scripts/generate-usable-cards.mjs` (plus nécessaire)

## Ordre d'exécution

1. Créer `types.ts` et `registry.ts`
2. Exécuter le script de split
3. Migrer les resolvers dans les fichiers de cartes
4. Mettre à jour `cards.ts` pour utiliser le nouveau registry
5. Vérifier que tout compile et que les tests passent
6. Supprimer les anciens fichiers

## Risques

- **Performance de build** : 1104 fichiers TS pourraient ralentir la compilation. Si c'est le cas, utiliser des barrel exports ou du lazy loading.
- **Index.ts géant** : l'auto-import de 1104 fichiers sera verbeux. On peut l'auto-générer avec un script `scripts/generate-card-index.mjs`.
- **Dépendances circulaires** : les cartes importent des helpers du moteur (utils, applyAtomicAction). Les helpers partagés (`applyWard`, `healPlayer`) doivent rester dans le moteur, pas dans les fichiers de cartes.
