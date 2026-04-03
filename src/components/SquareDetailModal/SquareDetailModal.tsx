import React from 'react';
import type { GameState, CardInstance } from '../../types';
import { useGameStore } from '../../store/gameStore';
import styles from './SquareDetailModal.module.css';

interface SquareDetailModalProps {
  game: GameState;
}

function CardLarge({ inst, isSite }: { inst: CardInstance; isSite?: boolean }) {
  const { showCardDetail } = useGameStore();
  return (
    <div
      className={`${styles.cardLarge} ${isSite ? styles.cardLargeSite : ''}`}
      onClick={() => showCardDetail(inst.instanceId)}
      title={`${inst.card.name} — cliquer pour détails`}
    >
      {inst.card.image ? (
        <img
          src={inst.card.image}
          alt={inst.card.name}
          className={styles.cardLargeImg}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className={styles.cardLargeFallback}>{inst.card.name}</div>
      )}
      <div className={styles.cardLargeFooter}>
        <span className={styles.cardLargeName}>{inst.card.name}</span>
        {inst.tapped && <span className={styles.cardTag}>Tapped</span>}
        {inst.summoningSickness && <span className={styles.cardTag}>Sick</span>}
        {inst.damage > 0 && <span className={styles.cardTagDmg}>-{inst.damage} dmg</span>}
        {inst.carriedArtifacts.length > 0 && (
          <span className={styles.cardTag}>+{inst.carriedArtifacts.length} artifact(s)</span>
        )}
      </div>
    </div>
  );
}

export const SquareDetailModal: React.FC<SquareDetailModalProps> = ({ game }) => {
  const { squareDetail, setSquareDetail } = useGameStore();

  if (!squareDetail) return null;

  const { row, col } = squareDetail;
  const cell = game.realm[row][col];

  const siteInst = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
  const surfaceUnits = cell.unitInstanceIds.map(id => game.instances[id]).filter(Boolean) as CardInstance[];
  const undergroundUnits = cell.subsurfaceUnitIds.map(id => game.instances[id]).filter(Boolean) as CardInstance[];

  const total = (siteInst ? 1 : 0) + surfaceUnits.length + undergroundUnits.length;

  return (
    <div className={styles.overlay} onClick={() => setSquareDetail(null)}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Case ({row}, {col})</span>
          <span className={styles.count}>{total} carte{total > 1 ? 's' : ''}</span>
          <button className={styles.closeBtn} onClick={() => setSquareDetail(null)}>✕</button>
        </div>

        <div className={styles.cards}>
          {/* Site */}
          {siteInst && !siteInst.isRubble && (
            <CardLarge inst={siteInst} isSite />
          )}
          {siteInst?.isRubble && (
            <div className={styles.rubbleCard}>
              <div className={styles.rubbleLabel}>🪨 Rubble</div>
              <div className={styles.rubbleName}>{siteInst.card.name}</div>
            </div>
          )}

          {/* Surface units */}
          {surfaceUnits.map(inst => (
            <CardLarge key={inst.instanceId} inst={inst} />
          ))}

          {/* Underground units */}
          {undergroundUnits.map(inst => (
            <CardLarge key={inst.instanceId} inst={inst} />
          ))}

          {total === 0 && (
            <div className={styles.empty}>Case vide</div>
          )}
        </div>

        <div className={styles.hint}>Clic sur une carte → voir les détails</div>
      </div>
    </div>
  );
};
