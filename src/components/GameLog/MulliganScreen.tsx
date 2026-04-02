import React, { useState } from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { CardView } from '../Card/CardView';
import styles from './MulliganScreen.module.css';

interface MulliganScreenProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

export const MulliganScreen: React.FC<MulliganScreenProps> = ({ game, humanPlayerId }) => {
  const { acceptHand, takeMulligan } = useGameStore();
  const [selectedForReturn, setSelectedForReturn] = useState<Set<string>>(new Set());

  const player = game.players[humanPlayerId];
  const hand = player.hand.map(id => game.instances[id]).filter(Boolean);

  const toggleReturn = (id: string) => {
    setSelectedForReturn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMulligan = () => {
    if (selectedForReturn.size === 0) return;
    takeMulligan(humanPlayerId, Array.from(selectedForReturn));
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2 className={styles.title}>Opening Hand</h2>
        <p className={styles.subtitle}>
          Select up to 3 cards to return for a mulligan, or keep your hand.
        </p>

        <div className={styles.hand}>
          {hand.map(inst => inst && (
            <div
              key={inst.instanceId}
              className={`${styles.cardWrapper} ${selectedForReturn.has(inst.instanceId) ? styles.returning : ''}`}
              onClick={() => toggleReturn(inst.instanceId)}
            >
              <CardView instance={inst} selected={selectedForReturn.has(inst.instanceId)} />
              {selectedForReturn.has(inst.instanceId) && (
                <div className={styles.returnBadge}>↩ Return</div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.keepBtn} onClick={() => acceptHand(humanPlayerId)}>
            ✓ Keep Hand
          </button>
          <button
            className={styles.mulliganBtn}
            disabled={selectedForReturn.size === 0}
            onClick={handleMulligan}
          >
            ↩ Mulligan ({selectedForReturn.size} card{selectedForReturn.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};
