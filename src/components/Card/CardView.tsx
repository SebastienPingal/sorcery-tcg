import React from 'react';
import type { CardInstance, MinionCard, SiteCard, MagicCard, AvatarCard } from '../../types';
import { ELEMENT_SYMBOLS } from '../../utils/elementSymbols';
import styles from './CardView.module.css';

interface CardViewProps {
  instance: CardInstance;
  selected?: boolean;
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
  showBack?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  instance, selected, onClick, onRightClick, compact, showBack
}) => {
  const { card, tapped, damage, summoningSickness, ownerId } = instance;
  const playerClass = ownerId === 'player1' ? styles.player1 : styles.player2;

  if (showBack) {
    return (
      <div
        className={`${styles.card} ${styles.cardBack} ${selected ? styles.selected : ''}`}
        onClick={onClick}
      >
        <div className={styles.backPattern}>S</div>
      </div>
    );
  }

  // When the card has a full image, render it directly — it already contains all information.
  if (card.image && !compact) {
    return (
      <div
        className={`
          ${styles.card} ${styles.imageOnly} ${playerClass}
          ${tapped ? styles.tapped : ''}
          ${selected ? styles.selected : ''}
          ${summoningSickness ? styles.sick : ''}
        `}
        onClick={onClick}
        onContextMenu={onRightClick}
        title={card.name}
      >
        <img src={card.image} alt={card.name} className={styles.fullImage}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        {summoningSickness && (
          <div className={styles.sickOverlay} title="Summoning Sickness">⧖</div>
        )}
      </div>
    );
  }

  const getTypeColor = () => {
    switch (card.type) {
      case 'avatar': return '#4a90d9';
      case 'site': return '#7d5c3c';
      case 'minion': return '#2d6e2d';
      case 'artifact': return '#6d4c8e';
      case 'aura': return '#2d7d7d';
      case 'magic': return '#c94040';
      default: return '#333';
    }
  };

  const renderThreshold = (threshold: Record<string, number | undefined>) => {
    return Object.entries(threshold)
      .filter(([, v]) => v && v > 0)
      .map(([el, v]) => (
        <span key={el} className={`${styles.element} ${styles[el]}`}>
          {ELEMENT_SYMBOLS[el as keyof typeof ELEMENT_SYMBOLS]}{v! > 1 ? `×${v}` : ''}
        </span>
      ));
  };

  const renderCost = () => {
    if ('manaCost' in card) {
      return (
        <div className={styles.manaCost}>
          <span className={styles.manaNum}>{card.manaCost}</span>
          {'threshold' in card && card.threshold && (
            <span className={styles.threshold}>
              {renderThreshold(card.threshold)}
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  const renderPower = () => {
    if (card.type === 'minion') {
      const p = (card as MinionCard).power;
      return (
        <div className={styles.power}>
          {typeof p === 'number'
            ? <span>{p}</span>
            : <span>{p.attack}/{p.defense}</span>
          }
          {damage > 0 && <span className={styles.damage}>-{damage}</span>}
        </div>
      );
    }
    if (card.type === 'avatar') {
      return (
        <div className={styles.power}>
          <span title="Attack">⚔{(card as AvatarCard).attackPower}</span>
        </div>
      );
    }
    return null;
  };

  const renderSiteThreshold = () => {
    if (card.type === 'site') {
      const site = card as SiteCard;
      return (
        <div className={styles.siteThreshold}>
          {renderThreshold(site.threshold)}
          {site.isWaterSite && <span className={`${styles.element} ${styles.water}`}>▽</span>}
        </div>
      );
    }
    return null;
  };

  const renderKeywords = () => {
    if (card.type === 'minion') {
      const kws = (card as MinionCard).keywords;
      if (kws.length === 0) return null;
      return <div className={styles.keywords}>{kws.join(', ')}</div>;
    }
    return null;
  };

  if (compact) {
    return (
      <div
        className={`
          ${styles.card} ${styles.compact} ${playerClass}
          ${tapped ? styles.tapped : ''}
          ${selected ? styles.selected : ''}
          ${summoningSickness ? styles.sick : ''}
        `}
        style={{ '--card-color': getTypeColor() } as React.CSSProperties}
        onClick={onClick}
        onContextMenu={onRightClick}
        title={card.name}
      >
        <div className={styles.compactName}>{card.name}</div>
        {renderPower()}
      </div>
    );
  }

  return (
    <div
      className={`
        ${styles.card} ${playerClass}
        ${tapped ? styles.tapped : ''}
        ${selected ? styles.selected : ''}
        ${summoningSickness ? styles.sick : ''}
      `}
      style={{ '--card-color': getTypeColor() } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      <div className={styles.header} style={{ backgroundColor: getTypeColor() }}>
        <div className={styles.headerLeft}>{renderCost()}</div>
        <div className={styles.name}>{card.name}</div>
        <div className={styles.headerRight}>{renderPower()}</div>
      </div>

      <div className={styles.art}>
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            className={styles.artImg}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={styles.artPlaceholder} style={{ background: getTypeColor() }}>
            <span className={styles.typeIcon}>{getTypeIcon(card.type)}</span>
          </div>
        )}
      </div>

      <div className={styles.typeLine}>
        <span>{card.typeLine || `${card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)} ${card.type}`}</span>
        {renderSiteThreshold()}
      </div>

      <div className={styles.textBox}>
        {renderKeywords()}
        {/* Show rulesText if available, otherwise fall back to abilities */}
        {card.rulesText ? (
          <div className={styles.rulesText}>{card.rulesText}</div>
        ) : (
          'abilities' in card && card.type !== 'site' && (
            <div className={styles.abilities}>
              {(card as MagicCard).abilities.map((ab, i) => (
                <div key={i} className={styles.abilityLine}>{ab.description}</div>
              ))}
            </div>
          )
        )}
        {card.flavorText && (
          <div className={styles.flavorText}>"{card.flavorText}"</div>
        )}
      </div>

      {summoningSickness && (
        <div className={styles.sickOverlay} title="Summoning Sickness">⧖</div>
      )}
    </div>
  );
};

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    avatar: '👤', site: '🏔', minion: '⚔', artifact: '🔮',
    aura: '✨', magic: '💥',
  };
  return icons[type] ?? '?';
}
