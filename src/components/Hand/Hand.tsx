import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { CardView } from '../Card/CardView';
import { getManaAvailable, meetsThreshold, computeAffinity } from '../../engine/utils';
import styles from './Hand.module.css';

interface HandProps {
  game: GameState;
  playerId: PlayerId;
  isHidden?: boolean;
}

export const Hand: React.FC<HandProps> = ({ game, playerId, isHidden }) => {
  const { selectedInstanceId, selectInstance } = useGameStore();
  const player = game.players[playerId];

  if (isHidden) {
    return (
      <div className={styles.hand}>
        <div className={styles.hiddenHand}>
          {player.hand.map((id, i) => (
            <div key={id} className={styles.hiddenCard} style={{ transform: `rotate(${(i - player.hand.length / 2) * 3}deg)` }}>
              <div className={styles.cardBackMini} />
            </div>
          ))}
          <span className={styles.handCount}>{player.hand.length} cards</span>
        </div>
      </div>
    );
  }

  const affinity = computeAffinity(game, playerId);
  const manaAvail = getManaAvailable(player);

  const isPlayable = (instanceId: string): boolean => {
    const inst = game.instances[instanceId];
    if (!inst) return false;
    const card = inst.card;
    if (card.type === 'site') return true; // sites are played via avatar ability
    if ('manaCost' in card) {
      if (manaAvail < card.manaCost) return false;
      if ('threshold' in card && card.threshold) {
        if (!meetsThreshold(affinity, card.threshold)) return false;
      }
      return true;
    }
    return false;
  };

  return (
    <div className={styles.hand}>
      <div className={styles.handLabel}>
        Hand ({player.hand.length}) — Mana: {manaAvail}/{player.manaPool}
      </div>
      <div className={styles.cards}>
        {player.hand.map((instanceId) => {
          const inst = game.instances[instanceId];
          if (!inst) return null;
          const playable = isPlayable(instanceId);
          const selected = selectedInstanceId === instanceId;

          return (
            <div
              key={instanceId}
              className={`${styles.cardWrapper} ${playable ? styles.playable : styles.notPlayable} ${selected ? styles.selectedWrapper : ''}`}
              onClick={() => {
                if (selected) selectInstance(null);
                else selectInstance(instanceId);
              }}
            >
              <CardView
                instance={inst}
                selected={selected}
              />
              {!playable && (
                <div className={styles.unplayableOverlay}>
                  {'manaCost' in inst.card && manaAvail < inst.card.manaCost
                    ? `Need ${inst.card.manaCost} mana`
                    : 'Threshold'}
                </div>
              )}
            </div>
          );
        })}
        {player.hand.length === 0 && (
          <div className={styles.emptyHand}>No cards in hand</div>
        )}
      </div>
    </div>
  );
};
