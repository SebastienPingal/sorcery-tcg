import React from 'react';
import type { GameState, PlayerId, CardInstance } from '../../types';
import { useGameStore } from '../../store/gameStore';
import styles from './MoveActionModal.module.css';

interface MoveActionModalProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

function CardThumb({ inst, onClick, label }: { inst: CardInstance; onClick: () => void; label: string }) {
  const isSite = inst.card.type === 'site';
  return (
    <div className={styles.cardThumbWrapper} onClick={onClick}>
      <div className={`${styles.cardThumb} ${isSite ? styles.cardThumbSite : ''}`}>
        {inst.card.image ? (
          <img
            src={inst.card.image}
            alt={inst.card.name}
            className={styles.cardThumbImg}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={styles.cardThumbFallback}>{inst.card.name}</div>
        )}
        <div className={styles.cardThumbOverlay}>
          <span className={styles.cardThumbLabel}>{label}</span>
        </div>
      </div>
      <div className={styles.cardThumbName}>{inst.card.name}</div>
    </div>
  );
}

export const MoveActionModal: React.FC<MoveActionModalProps> = ({ game, humanPlayerId }) => {
  const { pendingMove, setPendingMove, moveAndAttack, selectInstance } = useGameStore();

  if (!pendingMove) return null;

  const { unitInstanceId, destSquare } = pendingMove;
  const unit = game.instances[unitInstanceId];
  if (!unit) return null;

  const cell = game.realm[destSquare.row][destSquare.col];
  const currentSq = unit.location?.square;
  const isSameSquare = currentSq?.row === destSquare.row && currentSq?.col === destSquare.col;
  const path = isSameSquare ? [] : [destSquare];

  const enemyUnits: CardInstance[] = cell.unitInstanceIds
    .map(id => game.instances[id])
    .filter((inst): inst is CardInstance => !!inst && inst.controllerId !== humanPlayerId);

  const enemySite: CardInstance | null = (() => {
    const s = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
    return s && s.controllerId !== humanPlayerId && !s.isRubble ? s : null;
  })();

  const hasTargets = enemyUnits.length > 0 || !!enemySite;
  const canMove = !isSameSquare;

  const cancel = () => { setPendingMove(null); selectInstance(null); };
  const doMove = () => { moveAndAttack(unitInstanceId, path); selectInstance(null); };
  const doAttack = (targetId: string) => { moveAndAttack(unitInstanceId, path, targetId); selectInstance(null); };

  return (
    <div className={styles.overlay} onClick={cancel}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Attacker card */}
            <div className={styles.attackerThumb}>
              {unit.card.image ? (
                <img src={unit.card.image} alt={unit.card.name} className={styles.attackerImg}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className={styles.cardThumbFallback}>{unit.card.name}</div>
              )}
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.title}>{unit.card.name}</div>
            <div className={styles.subtitle}>
              {isSameSquare ? 'Rester sur place' : `→ Vers (${destSquare.row}, ${destSquare.col})`}
            </div>
          </div>
        </div>

        {hasTargets && (
          <>
            <div className={styles.sectionLabel}>⚔ Choisir une cible</div>
            <div className={styles.targets}>
              {enemyUnits.map(target => (
                <CardThumb
                  key={target.instanceId}
                  inst={target}
                  onClick={() => doAttack(target.instanceId)}
                  label="Attaquer"
                />
              ))}
              {enemySite && (
                <CardThumb
                  inst={enemySite}
                  onClick={() => doAttack(enemySite.instanceId)}
                  label="Attaquer"
                />
              )}
            </div>
          </>
        )}

        <div className={styles.bottomActions}>
          {canMove && (
            <button className={styles.moveBtn} onClick={doMove}>
              → Se déplacer seulement
            </button>
          )}
          <button className={styles.cancelBtn} onClick={cancel}>
            ✕ Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
