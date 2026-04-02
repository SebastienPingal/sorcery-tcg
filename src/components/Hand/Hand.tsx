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
  const {
    selectedInstanceId, selectInstance,
    pendingAvatarAbility,
    showCardDetail,
  } = useGameStore();

  const player = game.players[playerId];
  const isMyHand = playerId === game.activePlayerId || !isHidden;

  if (isHidden) {
    return (
      <div className={styles.hand}>
        <div className={styles.hiddenHand}>
          {player.hand.map((id, i) => (
            <div key={id} className={styles.hiddenCard}
              style={{ transform: `rotate(${(i - player.hand.length / 2) * 3}deg)` }}>
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

  // A card is "actionable" (can be clicked to select for playing) based on context:
  // - Sites: ONLY when pendingAvatarAbility is set (must go through avatar ability)
  // - Spells: when mana + threshold are met
  const isActionable = (instanceId: string): boolean => {
    const inst = game.instances[instanceId];
    if (!inst) return false;
    const card = inst.card;

    if (card.type === 'site') {
      // Sites can only be selected during the "play or draw site" avatar ability
      return pendingAvatarAbility !== null;
    }

    if ('manaCost' in card) {
      if (manaAvail < card.manaCost) return false;
      if ('threshold' in card && card.threshold) {
        if (!meetsThreshold(affinity, card.threshold)) return false;
      }
      return true;
    }
    return false;
  };

  const getUnplayableReason = (instanceId: string): string | null => {
    const inst = game.instances[instanceId];
    if (!inst) return null;
    const card = inst.card;

    if (card.type === 'site') {
      return pendingAvatarAbility ? null : 'Use Avatar ability';
    }
    if ('manaCost' in card) {
      if (manaAvail < card.manaCost) return `Need ${card.manaCost} mana`;
      if ('threshold' in card && card.threshold) {
        if (!meetsThreshold(affinity, card.threshold)) return 'Threshold';
      }
    }
    return null;
  };

  const handleCardClick = (instanceId: string) => {
    const inst = game.instances[instanceId];
    if (!inst) return;

    // Sites: only selectable when avatar ability is pending
    if (inst.card.type === 'site') {
      if (pendingAvatarAbility) {
        selectInstance(instanceId === selectedInstanceId ? null : instanceId);
      }
      return;
    }

    // Other cards: select normally if actionable
    if (isActionable(instanceId)) {
      selectInstance(instanceId === selectedInstanceId ? null : instanceId);
    }
  };

  const handleRightClick = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    showCardDetail(instanceId);
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
          const actionable = isActionable(instanceId);
          const selected = selectedInstanceId === instanceId;
          const reason = getUnplayableReason(instanceId);

          return (
            <div
              key={instanceId}
              className={`
                ${styles.cardWrapper}
                ${actionable ? styles.actionable : styles.notActionable}
                ${selected ? styles.selectedWrapper : ''}
              `}
              onClick={() => handleCardClick(instanceId)}
              onContextMenu={(e) => handleRightClick(e, instanceId)}
            >
              <CardView instance={inst} selected={selected} />
              {reason && (
                <div className={styles.unplayableOverlay}>{reason}</div>
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
