import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { hasKeyword } from '../../engine/utils';
import styles from './Controls.module.css';

interface ControlsProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

export const Controls: React.FC<ControlsProps> = ({ game, humanPlayerId }) => {
  const {
    selectedInstanceId, selectInstance,
    pendingAvatarAbility, setPendingAvatarAbility,
    drawSiteViaAbility,
    activateAbility, endTurn, clearError, actionError,
  } = useGameStore();

  const isMyTurn = game.activePlayerId === humanPlayerId;
  const player = game.players[humanPlayerId];
  const avatarInst = game.instances[player.avatarInstanceId];
  const avatarCard = avatarInst.card;
  const avatarAbilities = avatarCard.type === 'avatar' ? avatarCard.abilities : [];

  const isPlayOrDrawSite = (abilityId: string) => {
    const ability = avatarAbilities.find((ab) => ab.id === abilityId);
    return ability?.effect.type === 'play_or_draw_site';
  };

  const handleAvatarAbility = (abilityId: string) => {
    if (!isMyTurn || avatarInst.tapped) return;

    if (isPlayOrDrawSite(abilityId)) {
      // Playing a site is already auto-triggered from hand selection.
      // The explicit avatar button is now dedicated to drawing a site.
      drawSiteViaAbility(humanPlayerId, abilityId);
    } else {
      // Other abilities resolve immediately
      activateAbility(humanPlayerId, abilityId);
    }
  };

  const handleCancelPending = () => {
    setPendingAvatarAbility(null);
    selectInstance(null);
  };

  const selectedInst = selectedInstanceId ? game.instances[selectedInstanceId] : null;

  return (
    <div className={styles.controls}>
      {/* Turn info */}
      <div className={styles.turnInfo}>
        <span className={styles.phase}>
          {isMyTurn ? '▶ YOUR TURN' : "⏳ Opponent's Turn"}
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

      {/* Pending "play or draw site" resolution */}
      {pendingAvatarAbility && isMyTurn && (
        <div className={styles.pendingAbility}>
          <div className={styles.pendingTitle}>⚡ Play a Site</div>
          <div className={styles.pendingHint}>
            {selectedInst?.card.type === 'site'
              ? '→ Click a highlighted square to place the site'
              : 'Select a site from your hand to place it.'}
          </div>
          <button className={styles.cancelPendingBtn} onClick={handleCancelPending}>
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Avatar abilities (only when no pending action and no draw choice pending) */}
      {isMyTurn && !pendingAvatarAbility && game.pendingInteraction?.type !== 'choose_draw' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{avatarCard.name}'s Abilities</div>
          <div className={styles.abilities}>
            {avatarAbilities.map(ab => (
              (() => {
                const playOrDraw = isPlayOrDrawSite(ab.id);
                const buttonLabel = playOrDraw ? 'Draw a site from Atlas' : ab.description;
                return (
              <button
                key={ab.id}
                className={`${styles.abilityBtn} ${avatarInst.tapped ? styles.tappedAbility : ''}`}
                disabled={avatarInst.tapped}
                onClick={() => handleAvatarAbility(ab.id)}
                title={buttonLabel}
              >
                <span className={styles.abilityIcon}>⚡</span>
                <span className={styles.abilityText}>{buttonLabel}</span>
              </button>
                );
              })()
            ))}
            {avatarInst.tapped && (
              <div className={styles.avatarTappedMsg}>Avatar is tapped</div>
            )}
          </div>
        </div>
      )}

      {/* Selected card info (spells / units on board) */}
      {selectedInstanceId && !pendingAvatarAbility && game.pendingInteraction?.type !== 'choose_draw' && (
        <div className={styles.selectedInfo}>
          <div className={styles.sectionTitle}>Selected:</div>
          <div className={styles.selectedName}>
            {game.instances[selectedInstanceId]?.card.name}
          </div>
          <div className={styles.selectedHint}>
            {getSelectionHint(game, selectedInstanceId)}
          </div>
          <button className={styles.cancelBtn} onClick={() => selectInstance(null)}>
            Cancel (ESC)
          </button>
        </div>
      )}

      {/* Selected site during pending ability */}
      {selectedInstanceId && pendingAvatarAbility && selectedInst?.card.type === 'site' && (
        <div className={styles.selectedInfo}>
          <div className={styles.selectedName}>{selectedInst.card.name}</div>
          <div className={styles.selectedHint}>→ Click a highlighted square to place it</div>
          <button className={styles.cancelBtn} onClick={() => selectInstance(null)}>
            ↩ Pick a different site
          </button>
        </div>
      )}

      {/* End turn */}
      <div className={styles.endTurnSection}>
        <button
          className={`${styles.endTurnBtn} ${(!isMyTurn || game.pendingInteraction?.type === 'choose_draw') ? styles.disabled : ''}`}
          onClick={() => isMyTurn && game.pendingInteraction?.type !== 'choose_draw' && endTurn()}
          disabled={!isMyTurn || game.pendingInteraction?.type === 'choose_draw'}
        >
          {!isMyTurn ? '⏳ Waiting…' : game.pendingInteraction?.type === 'choose_draw' ? '📥 Draw first…' : '⏭ End Turn'}
        </button>
      </div>

      {/* Quick help */}
      <div className={styles.help}>
        <div className={styles.helpTitle}>Controls</div>
        <div className={styles.helpLine}>• Activate ability → then act</div>
        <div className={styles.helpLine}>• Click unit on board → move/attack</div>
        <div className={styles.helpLine}>• Click spell in hand → cast it</div>
        <div className={styles.helpLine}>• Right-click any card → details</div>
        <div className={styles.helpLine}>• ESC → cancel selection</div>
      </div>
    </div>
  );
};

function getSelectionHint(game: GameState, instanceId: string): string {
  const inst = game.instances[instanceId];
  if (!inst) return '';
  const card = inst.card;
  if (!inst.location) {
    if (card.type === 'minion') return '→ Click one of your sites to summon';
    if (card.type === 'magic') return '→ Click an enemy unit to target';
    if (card.type === 'artifact') return '→ Click a square or unit to place';
    if (card.type === 'aura') return '→ Click a square to place the aura';
  } else {
    if (card.type === 'minion' || card.type === 'avatar') {
      if (inst.tapped) return '✗ Already tapped this turn';
      if (inst.summoningSickness && !hasKeyword(inst, 'charge')) return '✗ Summoning sickness — wait until next turn';
      if (inst.summoningSickness && hasKeyword(inst, 'charge')) return '✓ Charge lets this unit act this turn';
      return '→ Click a highlighted square to move or attack';
    }
  }
  return '';
}
