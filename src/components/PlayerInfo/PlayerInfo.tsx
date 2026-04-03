import React from 'react';
import type { GameState, PlayerId } from '../../types';
import { computeAffinity, getManaAvailable } from '../../engine/utils';
import { ELEMENT_SYMBOLS, ELEMENT_COLORS } from '../../utils/elementSymbols';
import styles from './PlayerInfo.module.css';

interface PlayerInfoProps {
  game: GameState;
  playerId: PlayerId;
  isActive: boolean;
  compact?: boolean;
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ game, playerId, isActive, compact }) => {
  const player = game.players[playerId];
  const avatarInst = game.instances[player.avatarInstanceId];
  const affinity = computeAffinity(game, playerId);
  const manaAvail = getManaAvailable(player);

  const lifePercent = Math.max(0, (player.life / player.maxLife) * 100);
  const lifeColor = player.isAtDeathsDoor
    ? '#ff0000'
    : lifePercent > 50 ? '#4caf50' : lifePercent > 25 ? '#ff9800' : '#f44336';

  if (compact) {
    return (
      <div className={`${styles.playerInfoCompact} ${isActive ? styles.active : ''} ${player.isAtDeathsDoor ? styles.deathsDoor : ''}`}>
        {/* Row 1: name + active badge */}
        <div className={styles.compactName}>
          {player.name}
          {isActive && <span className={styles.activeBadge}> ◆</span>}
          {avatarInst?.tapped && <span className={styles.tappedBadge}> ⟳</span>}
        </div>

        {/* Row 2: life */}
        <div className={styles.compactLifeRow}>
          <span className={styles.lifeLabel}>♥</span>
          <div className={styles.lifeBarWrapper}>
            <div className={styles.lifeBar}>
              <div className={styles.lifeBarFill} style={{ width: `${lifePercent}%`, backgroundColor: lifeColor }} />
            </div>
            {player.isAtDeathsDoor && (
              <div className={styles.deathsDoorOverlay}>☠ Death's Door</div>
            )}
          </div>
          <span className={styles.lifeNum} style={{ color: lifeColor }}>
            {player.life}/{player.maxLife}
          </span>
        </div>

        {/* Row 3: mana + affinity + decks */}
        <div className={styles.compactStatsRow}>
          <span className={styles.compactStat}>◈ {manaAvail}/{player.manaPool}</span>
          <span className={styles.compactDivider}>·</span>
          {Object.entries(affinity).filter(([, v]) => v! > 0).map(([el, v]) => (
            <span key={el} className={styles.compactAffinity}
              style={{ color: ELEMENT_COLORS[el as keyof typeof ELEMENT_COLORS] }}>
              {ELEMENT_SYMBOLS[el as keyof typeof ELEMENT_SYMBOLS]}×{v}
            </span>
          ))}
          {Object.keys(affinity).length === 0 && <span className={styles.noAffinity}>—</span>}
          <span className={styles.compactDivider}>·</span>
          <span className={styles.compactStat}>📜{player.atlasCards.length} 📖{player.spellbookCards.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.playerInfo} ${isActive ? styles.active : ''} ${player.isAtDeathsDoor ? styles.deathsDoor : ''}`}>
      <div className={styles.name}>
        {player.name}
        {isActive && <span className={styles.activeBadge}> ◆ Active</span>}
        </div>

      {/* Life bar */}
      <div className={styles.lifeSection}>
        <span className={styles.lifeLabel}>♥</span>
        <div className={styles.lifeBarWrapper}>
          <div className={styles.lifeBar}>
            <div
              className={styles.lifeBarFill}
              style={{ width: `${lifePercent}%`, backgroundColor: lifeColor }}
            />
          </div>
          {player.isAtDeathsDoor && (
            <div className={styles.deathsDoorOverlay}>☠ Death's Door</div>
          )}
        </div>
        <span className={styles.lifeNum} style={{ color: lifeColor }}>
          {player.life}/{player.maxLife}
        </span>
      </div>

      {/* Mana */}
      <div className={styles.manaSection}>
        <span className={styles.manaLabel}>◈ Mana:</span>
        <span className={styles.manaVal}>{manaAvail}/{player.manaPool}</span>
        <div className={styles.manaDots}>
          {Array.from({ length: player.manaPool }, (_, i) => (
            <div
              key={i}
              className={`${styles.manaDot} ${i < manaAvail ? styles.manaFull : styles.manaUsed}`}
            />
          ))}
        </div>
      </div>

      {/* Elemental affinity */}
      <div className={styles.affinitySection}>
        <span className={styles.affinityLabel}>Affinity:</span>
        <div className={styles.affinityBadges}>
          {Object.entries(affinity)
            .filter(([, v]) => v! > 0)
            .map(([el, v]) => (
              <div
                key={el}
                className={styles.affinityBadge}
                style={{ color: ELEMENT_COLORS[el as keyof typeof ELEMENT_COLORS] }}
              >
                {ELEMENT_SYMBOLS[el as keyof typeof ELEMENT_SYMBOLS]}×{v}
              </div>
            ))}
          {Object.keys(affinity).length === 0 && (
            <span className={styles.noAffinity}>—</span>
          )}
        </div>
      </div>

      {/* Deck sizes */}
      <div className={styles.deckSection}>
        <span className={styles.deckInfo}>
          📜 Atlas: {player.atlasCards.length} &nbsp;
          📖 Spellbook: {player.spellbookCards.length}
        </span>
      </div>

      {/* Avatar status */}
      {avatarInst?.tapped && (
        <div className={styles.avatarTapped}>Avatar: Tapped</div>
      )}
    </div>
  );
};
