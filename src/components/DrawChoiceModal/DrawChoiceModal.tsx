import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import styles from './DrawChoiceModal.module.css';

interface DrawChoiceModalProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

export const DrawChoiceModal: React.FC<DrawChoiceModalProps> = ({ game, humanPlayerId }) => {
  const { chooseDrawSource } = useGameStore();

  if (game.pendingInteraction?.type !== 'choose_draw') return null;
  if (game.pendingInteraction.playerId !== humanPlayerId) return null;

  const player = game.players[humanPlayerId];
  const atlasCount = player.atlasCards.length;
  const spellbookCount = player.spellbookCards.length;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>Draw a Card</div>
          <div className={styles.subtitle}>
            {player.name} — Turn {game.turnNumber}
          </div>
        </div>

        <p className={styles.prompt}>
          Choose which deck to draw from:
        </p>

        <div className={styles.choices}>
          <button
            className={styles.choiceBtn}
            onClick={() => chooseDrawSource(humanPlayerId, 'atlas')}
            disabled={atlasCount === 0}
          >
            <span className={styles.choiceIcon}>🗺</span>
            <span className={styles.choiceName}>Atlas</span>
            <span className={styles.choiceDesc}>Draw a Site card</span>
            <span className={styles.choiceCount}>{atlasCount} remaining</span>
          </button>

          <button
            className={styles.choiceBtn}
            onClick={() => chooseDrawSource(humanPlayerId, 'spellbook')}
            disabled={spellbookCount === 0}
          >
            <span className={styles.choiceIcon}>📖</span>
            <span className={styles.choiceName}>Spellbook</span>
            <span className={styles.choiceDesc}>Draw a Spell card</span>
            <span className={styles.choiceCount}>{spellbookCount} remaining</span>
          </button>
        </div>
      </div>
    </div>
  );
};
