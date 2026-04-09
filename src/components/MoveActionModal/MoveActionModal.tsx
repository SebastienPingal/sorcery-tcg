import React from 'react';
import type { GameState, PlayerId, CardInstance } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { getMovementRange, resolveMovementStep } from '../../engine/utils';
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
  const {
    pendingMove,
    pendingSummon,
    setPendingMove,
    setPendingSummon,
    moveAndAttack,
    castSpell,
    selectInstance,
  } = useGameStore();

  if (!pendingMove && !pendingSummon) return null;

  if (pendingSummon) {
    const inst = game.instances[pendingSummon.cardInstanceId];
    if (!inst) return null;
    const cancelSummon = () => {
      setPendingSummon(null);
      selectInstance(null);
    };
    const chooseSummon = (region: 'surface' | 'underground' | 'underwater' | 'void') => {
      castSpell(
        pendingSummon.casterId,
        pendingSummon.cardInstanceId,
        pendingSummon.targetSquare,
        undefined,
        region,
      );
      setPendingSummon(null);
      selectInstance(null);
    };

    return (
      <div className={styles.overlay} onClick={cancelSummon}>
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.attackerThumb}>
                {inst.card.image ? (
                  <img
                    src={inst.card.image}
                    alt={inst.card.name}
                    className={styles.attackerImg}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className={styles.cardThumbFallback}>{inst.card.name}</div>
                )}
              </div>
            </div>
            <div className={styles.headerRight}>
              <div className={styles.title}>{inst.card.name}</div>
              <div className={styles.subtitle}>
                Choose summon mode at ({pendingSummon.targetSquare.row}, {pendingSummon.targetSquare.col})
              </div>
            </div>
          </div>

          <div className={styles.bottomActions}>
            {pendingSummon.options.map((region) => (
              <button key={region} className={styles.moveBtn} onClick={() => chooseSummon(region)}>
                {region === 'surface' && 'Summon on surface'}
                {region === 'underground' && 'Summon burrowed'}
                {region === 'underwater' && 'Summon submerged'}
                {region === 'void' && 'Summon in void'}
              </button>
            ))}
            <button className={styles.cancelBtn} onClick={cancelSummon}>
              ✕ Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { unitInstanceId, destSquare } = pendingMove!;
  const unit = game.instances[unitInstanceId];
  if (!unit) return null;
  const unitLocation = unit.location;
  if (!unitLocation) return null;

  const cell = game.realm[destSquare.row][destSquare.col];
  const currentSq = unitLocation.square;
  const isSameSquare = currentSq.row === destSquare.row && currentSq.col === destSquare.col;
  const path = isSameSquare ? [] : [destSquare];

  let currentLocation = unitLocation;
  let basePathError: string | null = null;
  const movementRange = getMovementRange(unit);
  for (const stepSquare of path) {
    const step = resolveMovementStep(game, unit, currentLocation, stepSquare);
    if (!('location' in step)) {
      basePathError = step.error;
      break;
    }
    currentLocation = step.location;
  }

  const regionPathOptions: Array<{ path: typeof path; label: string }> = [];
  if (!basePathError && unit.location) {
    const regionStep = resolveMovementStep(game, unit, currentLocation, destSquare);
    if ('location' in regionStep && regionStep.location.region !== currentLocation.region) {
      const regionPath = [...path, destSquare];
      if (regionPath.length > movementRange) {
        // Region toggle costs a step; hide invalid option when unit lacks movement.
        // This prevents presenting actions the engine will reject.
      } else {
      const to = regionStep.location.region;
      let label = `Move and switch region (${to})`;
      if (to === 'underground') label = 'Move and burrow';
      if (to === 'underwater') label = 'Move and submerge';
      if (to === 'surface') label = currentLocation.region === 'underground' ? 'Move and unburrow' : 'Move and surface';
      regionPathOptions.push({ path: regionPath, label });
      }
    }
  }

  const enemyUnits: CardInstance[] = cell.unitInstanceIds
    .map(id => game.instances[id])
    .filter((inst): inst is CardInstance => !!inst && inst.controllerId !== humanPlayerId);

  const enemySite: CardInstance | null = (() => {
    const s = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
    return s && s.controllerId !== humanPlayerId && !s.isRubble ? s : null;
  })();

  const hasTargets = enemyUnits.length > 0 || !!enemySite;
  const canMove = !isSameSquare || regionPathOptions.length > 0;

  const cancel = () => {
    setPendingMove(null);
    selectInstance(null);
  };
  const doMove = (movePath = path) => {
    moveAndAttack(unitInstanceId, movePath);
    selectInstance(null);
  };
  const doAttack = (targetId: string) => {
    moveAndAttack(unitInstanceId, path, targetId);
    selectInstance(null);
  };

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
          {canMove && !basePathError && (
            <button className={styles.moveBtn} onClick={() => doMove()}>
              → Se déplacer seulement
            </button>
          )}
          {!basePathError && regionPathOptions.map((option) => (
            <button key={option.label} className={styles.moveBtn} onClick={() => doMove(option.path)}>
              → {option.label}
            </button>
          ))}
          {basePathError && (
            <button className={styles.cancelBtn} onClick={cancel} title={basePathError}>
              ✕ Invalid move ({basePathError})
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
