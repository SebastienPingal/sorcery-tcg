import React, { useState } from 'react';
import { PRECON_DECKS } from '../../data/cards';
import type { GameSetupConfig } from '../../engine/gameEngine';
import styles from './DeckSelectScreen.module.css';

interface DeckSelectScreenProps {
  onStart: (config: GameSetupConfig) => void;
}

const AVATAR_IMAGES: Record<string, string> = {
  savior:      'https://d27a44hjr9gen3.cloudfront.net/cards/got-savior-b-s.png',
  necromancer: 'https://d27a44hjr9gen3.cloudfront.net/cards/got-necromancer-b-s.png',
  persecutor:  'https://d27a44hjr9gen3.cloudfront.net/cards/got-persecutor-b-s.png',
  harbinger:   'https://d27a44hjr9gen3.cloudfront.net/cards/got-harbinger-b-s.png',
};

type DeckId = typeof PRECON_DECKS[number]['id'];

function DeckCard({ deck, selected, onClick }: {
  deck: typeof PRECON_DECKS[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`${styles.deckCard} ${selected ? styles.deckCardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.avatarImg}>
        <img
          src={AVATAR_IMAGES[deck.avatarId]}
          alt={deck.name}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className={styles.deckInfo}>
        <div className={styles.deckName}>{deck.name}</div>
        <div className={styles.deckDesc}>{deck.description}</div>
        <div className={styles.deckCounts}>
          <span>{deck.atlasIds.length} sites</span>
          <span>·</span>
          <span>{deck.spellbookIds.length} spells</span>
        </div>
      </div>
      {selected && <div className={styles.checkmark}>✓</div>}
    </div>
  );
}

export const DeckSelectScreen: React.FC<DeckSelectScreenProps> = ({ onStart }) => {
  const [p1Deck, setP1Deck] = useState<DeckId | null>(null);
  const [p2Deck, setP2Deck] = useState<DeckId | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const handleP1Select = (id: DeckId) => {
    setP1Deck(id);
  };

  const handleNextStep = () => {
    setStep(2);
  };

  const handleP2Select = (id: DeckId) => {
    setP2Deck(id);
  };

  const handleStart = () => {
    const deck1 = PRECON_DECKS.find(d => d.id === p1Deck)!;
    const deck2 = PRECON_DECKS.find(d => d.id === p2Deck)!;
    onStart({
      player1: {
        name: 'Player 1',
        avatarId: deck1.avatarId,
        atlasIds: [...deck1.atlasIds],
        spellbookIds: [...deck1.spellbookIds],
      },
      player2: {
        name: 'Player 2',
        avatarId: deck2.avatarId,
        atlasIds: [...deck2.atlasIds],
        spellbookIds: [...deck2.spellbookIds],
      },
      firstPlayer: 'player1',
    });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <h1 className={styles.logo}>SORCERY</h1>
        <h2 className={styles.subtitle}>Contested Realm</h2>

        {step === 1 ? (
          <>
            <div className={styles.stepTitle}>Player 1 — choose your deck</div>
            <div className={styles.deckGrid}>
              {PRECON_DECKS.map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  selected={p1Deck === deck.id}
                  onClick={() => handleP1Select(deck.id as DeckId)}
                />
              ))}
            </div>
            <button
              className={styles.nextBtn}
              disabled={!p1Deck}
              onClick={handleNextStep}
            >
              Next →
            </button>
          </>
        ) : (
          <>
            <div className={styles.stepTitle}>Player 2 — choose your deck</div>
            <div className={styles.deckGrid}>
              {PRECON_DECKS.map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  selected={p2Deck === deck.id}
                  onClick={() => handleP2Select(deck.id as DeckId)}
                />
              ))}
            </div>
            <div className={styles.bottomRow}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className={styles.nextBtn}
                disabled={!p2Deck}
                onClick={handleStart}
              >
                ⚔ Start Game
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
