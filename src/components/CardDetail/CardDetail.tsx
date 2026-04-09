import React, { useState } from 'react';
import type { GameState, MinionCard, SiteCard, AvatarCard } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { ELEMENT_SYMBOLS } from '../../utils/elementSymbols';
import styles from './CardDetail.module.css';

interface CardDetailProps {
  game: GameState;
}

export const CardDetail: React.FC<CardDetailProps> = ({ game }) => {
  const { cardDetailId, showCardDetail } = useGameStore();
  const [zoomed, setZoomed] = useState(false);

  if (!cardDetailId) return null;
  const inst = game.instances[cardDetailId];
  if (!inst) return null;
  const { card, tapped, damage, summoningSickness } = inst;
  const hasWard = inst.tokens.includes('ward');
  const hasStealth = inst.tokens.includes('stealth');
  const boundArtifacts = inst.carriedArtifacts
    .map((id) => game.instances[id])
    .filter(Boolean) as typeof inst[];
  const boundBearer = inst.carriedBy ? game.instances[inst.carriedBy] : null;

  const isSite = card.type === 'site';

  const getTypeColor = () => {
    switch (card.type) {
      case 'avatar':   return '#4a90d9';
      case 'site':     return '#7d5c3c';
      case 'minion':   return '#2d6e2d';
      case 'artifact': return '#6d4c8e';
      case 'aura':     return '#2d7d7d';
      case 'magic':    return '#c94040';
      default:         return '#555';
    }
  };

  const renderThreshold = (threshold: Record<string, number | undefined>) =>
    Object.entries(threshold)
      .filter(([, v]) => v && v > 0)
      .map(([el, v]) => (
        <span key={el} className={`${styles.element} ${styles[el]}`}>
          {ELEMENT_SYMBOLS[el as keyof typeof ELEMENT_SYMBOLS]}{v! > 1 ? `×${v}` : ''}
        </span>
      ));

  const typeIcon = { avatar: '👤', site: '🏔', minion: '⚔', artifact: '🔮', aura: '✨', magic: '💥' }[card.type] ?? '?';

  return (
    <>
    {/* Lightbox: full-size image */}
    {zoomed && card.image && (
      <div className={styles.lightbox} onClick={() => setZoomed(false)}>
        <img
          src={card.image}
          alt={card.name}
          className={`${styles.lightboxImg} ${isSite ? styles.lightboxImgSite : ''}`}
        />
        <span className={styles.lightboxHint}>Click anywhere to close</span>
      </div>
    )}

    <div className={styles.overlay} onClick={() => showCardDetail(null)}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>

        {/* Left: image */}
        <div className={`${styles.imageCol} ${isSite ? styles.imageColSite : ''}`}>
          {card.image ? (
            <img
              src={card.image}
              alt={card.name}
              className={`${styles.cardImage} ${isSite ? styles.cardImageSite : ''} ${styles.imageClickable}`}
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              title="Click to zoom"
            />
          ) : (
            <div className={styles.imageFallback} style={{ background: getTypeColor() }}>
              <span className={styles.fallbackIcon}>{typeIcon}</span>
            </div>
          )}
        </div>

        {/* Right: info */}
        <div className={styles.infoCol}>
          <div className={styles.nameRow}>
            <span className={styles.cardName}>{card.name}</span>
            {'manaCost' in card && (
              <span className={styles.manaBubble}>{(card as any).manaCost}</span>
            )}
          </div>

          <div className={styles.typeLine} style={{ borderBottomColor: getTypeColor() }}>
            <span className={styles.typeText}>
              {card.typeLine || `${card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)} ${card.type}`}
            </span>
            {isSite && (
              <span className={styles.thresholdRow}>
                {renderThreshold((card as SiteCard).threshold)}
              </span>
            )}
            {'threshold' in card && !isSite && (card as any).threshold && (
              <span className={styles.thresholdRow}>
                {renderThreshold((card as any).threshold)}
              </span>
            )}
          </div>

          {/* Power */}
          {card.type === 'minion' && (() => {
            const p = (card as MinionCard).power;
            const val = typeof p === 'number' ? `${p}` : `${p.attack} / ${p.defense}`;
            return (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Power</span>
                <span className={styles.statValue}>
                  {val}{damage > 0 && <span className={styles.damaged}> (-{damage})</span>}
                </span>
              </div>
            );
          })()}
          {card.type === 'avatar' && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Attack</span>
              <span className={styles.statValue}>{(card as AvatarCard).attackPower}</span>
            </div>
          )}

          {/* Text */}
          <div className={styles.textBox}>
            {card.type === 'minion' && (card as MinionCard).keywords.length > 0 && (
              <p className={styles.keywords}>{(card as MinionCard).keywords.join(', ')}</p>
            )}
            {card.rulesText ? (
              <p className={styles.rulesText}>{card.rulesText}</p>
            ) : (
              'abilities' in card && (card as any).abilities?.map((ab: any, i: number) => (
                <p key={i} className={styles.abilityLine}>{ab.description}</p>
              ))
            )}
            {card.flavorText && (
              <p className={styles.flavorText}>"{card.flavorText}"</p>
            )}
          </div>

          {(boundArtifacts.length > 0 || boundBearer) && (
            <div className={styles.boundSection}>
              <div className={styles.boundLabel}>Bound Cards</div>
              <div className={styles.boundList}>
                {boundBearer && (
                  <button
                    className={styles.boundCard}
                    onClick={() => showCardDetail(boundBearer.instanceId)}
                    title="Show bearer details"
                  >
                    {boundBearer.card.image ? (
                      <img
                        src={boundBearer.card.image}
                        alt={boundBearer.card.name}
                        className={styles.boundCardImg}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className={styles.boundCardFallback}>{boundBearer.card.name}</div>
                    )}
                    <span className={styles.boundRole}>Carried by</span>
                  </button>
                )}
                {boundArtifacts.map((art) => (
                  <button
                    key={art.instanceId}
                    className={styles.boundCard}
                    onClick={() => showCardDetail(art.instanceId)}
                    title="Show bound card details"
                  >
                    {art.card.image ? (
                      <img
                        src={art.card.image}
                        alt={art.card.name}
                        className={styles.boundCardImg}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className={styles.boundCardFallback}>{art.card.name}</div>
                    )}
                    <span className={styles.boundRole}>Attached</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(tapped || summoningSickness || hasWard || hasStealth) && (
            <div className={styles.tags}>
              {tapped && <span className={styles.tagTapped}>Tapped</span>}
              {summoningSickness && <span className={styles.tagSick}>Summoning Sickness</span>}
              {hasWard && <span className={styles.tagWard}>Ward</span>}
              {hasStealth && <span className={styles.tagStealth}>Stealth</span>}
            </div>
          )}
        </div>

        <button className={styles.closeBtn} onClick={() => showCardDetail(null)}>✕</button>
      </div>
    </div>
    </>
  );
};
