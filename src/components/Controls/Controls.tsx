import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { computeAffinity, getManaAvailable } from '../../engine/utils';
import styles from './Controls.module.css';

interface ControlsProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

export const Controls: React.FC<ControlsProps> = ({ game, humanPlayerId }) => {
  const {
    selectedInstanceId, selectInstance,
    activateAbility, endTurn, clearError, actionError,
  } = useGameStore();

  const isMyTurn = game.activePlayerId === humanPlayerId;
  const player = game.players[humanPlayerId];
  const avatarInst = game.instances[player.avatarInstanceId];
  const affinity = computeAffinity(game, humanPlayerId);

  const handleEndTurn = () => {
    if (!isMyTurn) return;
    endTurn();
  };

  const handleAvatarAbility = (abilityId: string) => {
    if (!isMyTurn) return;
    if (avatarInst.tapped) return;
    // For play_or_draw_site: if no site in hand, draw. Otherwise prompt.
    const hasSiteInHand = player.hand.some(id => game.instances[id]?.card.type === 'site');
    if (abilityId.includes('play_site') && hasSiteInHand) {
      // Select the ability — user then clicks a square
      // We use "tap & select site from hand" flow: select first site in hand
      const firstSite = player.hand.find(id => game.instances[id]?.card.type === 'site');
      if (firstSite) selectInstance(firstSite);
    } else if (abilityId.includes('play_site') || abilityId.includes('draw_spell')) {
      // Just draw
      activateAbility(humanPlayerId, abilityId);
    } else {
      activateAbility(humanPlayerId, abilityId);
    }
  };

  const avatarCard = avatarInst.card;
  const avatarAbilities = avatarCard.type === 'avatar' ? avatarCard.abilities : [];

  return (
    <div className={styles.controls}>
      {/* Turn info */}
      <div className={styles.turnInfo}>
        <span className={styles.phase}>
          {isMyTurn ? '▶ YOUR TURN' : '⏳ Opponent\'s Turn'}
        </span>
        <span className={styles.phaseLabel}>
          {game.phase.toUpperCase()} PHASE — Turn {game.turnNumber}
        </span>
      </div>

      {/* Error display */}
      {actionError && (
        <div className={styles.error} onClick={clearError}>
          ⚠ {actionError} <span className={styles.dismiss}>(click to dismiss)</span>
        </div>
      )}

      {/* Avatar abilities */}
      {isMyTurn && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{avatarCard.name}'s Abilities</div>
          <div className={styles.abilities}>
            {avatarAbilities.map(ab => (
              <button
                key={ab.id}
                className={styles.abilityBtn}
                disabled={avatarInst.tapped}
                onClick={() => handleAvatarAbility(ab.id)}
                title={ab.description}
              >
                <span className={styles.abilityIcon}>⚡</span>
                <span className={styles.abilityText}>{ab.description.substring(0, 30)}…</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected card info */}
      {selectedInstanceId && (
        <div className={styles.selectedInfo}>
          <div className={styles.sectionTitle}>Selected:</div>
          <div className={styles.selectedName}>
            {game.instances[selectedInstanceId]?.card.name}
          </div>
          <div className={styles.selectedHint}>
            {getSelectionHint(game, selectedInstanceId, humanPlayerId)}
          </div>
          <button className={styles.cancelBtn} onClick={() => selectInstance(null)}>
            Cancel (ESC)
          </button>
        </div>
      )}

      {/* End turn */}
      <div className={styles.endTurnSection}>
        <button
          className={`${styles.endTurnBtn} ${!isMyTurn ? styles.disabled : ''}`}
          onClick={handleEndTurn}
          disabled={!isMyTurn}
        >
          {isMyTurn ? '⏭ End Turn' : '⏳ Waiting…'}
        </button>
      </div>

      {/* Quick help */}
      <div className={styles.help}>
        <div className={styles.helpTitle}>Controls</div>
        <div className={styles.helpLine}>• Click card in hand → select it</div>
        <div className={styles.helpLine}>• Click highlighted square → play/move</div>
        <div className={styles.helpLine}>• Click unit on board → select to move/attack</div>
        <div className={styles.helpLine}>• Right-click → view card details</div>
      </div>
    </div>
  );
};

function getSelectionHint(game: GameState, instanceId: string, playerId: PlayerId): string {
  const inst = game.instances[instanceId];
  if (!inst) return '';
  const card = inst.card;
  if (!inst.location) {
    if (card.type === 'site') return '→ Click a highlighted square to place this site';
    if (card.type === 'minion') return '→ Click a highlighted square (your site) to summon';
    if (card.type === 'magic') return '→ Click an enemy unit to target';
    if (card.type === 'artifact') return '→ Click a square or unit to place';
  } else {
    if (card.type === 'minion' || card.type === 'avatar') {
      if (inst.tapped) return '✗ Already tapped this turn';
      if (inst.summoningSickness) return '✗ Summoning sickness — wait until next turn';
      return '→ Click a highlighted square to move (or attack enemy there)';
    }
  }
  return '';
}
