import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { CardView } from '../Card/CardView';
import { meetsThreshold } from '../../engine/utils';
import { selectAffinity, selectManaAvailable, selectValidSitePlacements } from '../../engine/selectors';
import styles from './Hand.module.css';

interface HandProps {
  game: GameState;
  playerId: PlayerId;
  isHidden?: boolean;
}

export const Hand: React.FC<HandProps> = ({ game, playerId, isHidden }) => {
  const {
    selectedInstanceId, selectInstance,
    pendingAvatarAbility, setPendingAvatarAbility,
    playSiteViaAbility,
    showCardDetail,
    hoverInstance,
  } = useGameStore();

  const player = game.players[playerId];
  const avatarInst = game.instances[player.avatarInstanceId];
  const avatarPlayOrDrawAbilityId = avatarInst.card.type === 'avatar'
    ? avatarInst.card.abilities.find((ability) => ability.effect.type === 'play_or_draw_site')?.id ?? null
    : null;
  const isMyHand = playerId === game.activePlayerId || !isHidden;

  if (isHidden) {
    return (
      <div className={styles.hiddenHand}>
        <div className={styles.hiddenCards}>
          {player.hand.map((id, i) => (
            <div
              key={id}
              className={styles.hiddenCard}
              style={{ zIndex: i, marginLeft: i === 0 ? 0 : -20 }}
            />
          ))}
        </div>
        <span className={styles.handCount}>{player.hand.length} cards</span>
      </div>
    );
  }

  const affinity = selectAffinity(game, playerId);
  const manaAvail = selectManaAvailable(player);

  // A card is "actionable" (can be clicked to select for playing) based on context:
  // - Sites: ONLY when pendingAvatarAbility is set (must go through avatar ability)
  // - Spells: when mana + threshold are met
  const isActionable = (instanceId: string): boolean => {
    const inst = game.instances[instanceId];
    if (!inst) return false;
    const card = inst.card;

    if (card.type === 'site') {
      if (avatarInst.tapped) return false;
      if (pendingAvatarAbility !== null) return true;
      // Also actionable if avatar has the generic play-or-draw-site ability and is untapped
      return !!avatarPlayOrDrawAbilityId;
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
      if (pendingAvatarAbility) return null;
      if (avatarInst.tapped) return 'Avatar tapped';
      return null;
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

    // Sites: select and auto-activate the avatar's play-site ability if available
    if (inst.card.type === 'site') {
      const fallbackAbilityId = !avatarInst.tapped ? avatarPlayOrDrawAbilityId : null;
      const activeAbilityId = pendingAvatarAbility ?? fallbackAbilityId ?? 'auto_play_site';
      if (avatarInst.tapped) return;

      const placements = selectValidSitePlacements(game, playerId);
      if (placements.length === 1) {
        playSiteViaAbility(playerId, activeAbilityId, instanceId, placements[0]);
        return;
      }

      if (!pendingAvatarAbility) setPendingAvatarAbility(activeAbilityId);
      selectInstance(instanceId);
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
              onMouseEnter={() => hoverInstance(instanceId)}
              onMouseLeave={() => hoverInstance(null)}
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
