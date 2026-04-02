import React from 'react';
import type { GameState, Square, PlayerId } from '../../types';
import type { MinionCard } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { validSitePlacements, getMovementRange, reachableSquares } from '../../engine/utils';
import styles from './RealmGrid.module.css';

interface RealmGridProps {
  game: GameState;
  humanPlayerId: PlayerId;
}

export const RealmGrid: React.FC<RealmGridProps> = ({ game, humanPlayerId }) => {
  const {
    selectedInstanceId,
    selectInstance,
    castSpell,
    playSiteViaAbility,
    pendingAvatarAbility,
    moveAndAttack,
  } = useGameStore();

  const selectedInst = selectedInstanceId ? game.instances[selectedInstanceId] : null;
  const isMyTurn = game.activePlayerId === humanPlayerId;

  const getHighlightedSquares = (): { squares: Square[]; mode: string } => {
    if (!selectedInst) return { squares: [], mode: '' };
    const card = selectedInst.card;

    // Sites can only be placed when a pendingAvatarAbility is active
    if (card.type === 'site' && !selectedInst.location && pendingAvatarAbility) {
      return { squares: validSitePlacements(game, humanPlayerId), mode: 'place_site' };
    }

    if (!selectedInst.location && (card.type === 'minion' || card.type === 'magic')) {
      const squares: Square[] = [];
      for (const row of game.realm) {
        for (const cell of row) {
          if (cell.siteInstanceId) {
            const siteInst = game.instances[cell.siteInstanceId];
            if (siteInst?.controllerId === humanPlayerId) {
              squares.push({ row: cell.row, col: cell.col });
            }
          }
        }
      }
      return { squares, mode: card.type === 'minion' ? 'cast_minion' : 'cast_magic' };
    }

    if (selectedInst.location && (card.type === 'minion' || card.type === 'avatar') && isMyTurn) {
      if (!selectedInst.tapped && !selectedInst.summoningSickness) {
        const range = getMovementRange(selectedInst);
        const reachable = reachableSquares(game, selectedInst, range);
        return { squares: reachable, mode: 'move' };
      }
    }

    return { squares: [], mode: '' };
  };

  const { squares: highlightedSquares, mode: highlightMode } = getHighlightedSquares();

  const isHighlighted = (sq: Square): boolean =>
    highlightedSquares.some(h => h.row === sq.row && h.col === sq.col);

  const handleSquareClick = (row: number, col: number) => {
    const sq: Square = { row, col };
    const cell = game.realm[row][col];
    if (!selectedInst) return;

    const card = selectedInst.card;
    const player = game.players[humanPlayerId];
    const avatarInstId = player.avatarInstanceId;

    if (card.type === 'site' && !selectedInst.location && isHighlighted(sq) && pendingAvatarAbility) {
      playSiteViaAbility(humanPlayerId, pendingAvatarAbility, selectedInstanceId!, sq);
      return;
    }

    if (card.type === 'minion' && !selectedInst.location && isHighlighted(sq)) {
      castSpell(avatarInstId, selectedInstanceId!, sq);
      selectInstance(null);
      return;
    }

    if (card.type === 'magic' && !selectedInst.location) {
      const enemyUnits = cell.unitInstanceIds
        .map(id => game.instances[id])
        .filter(inst => inst && inst.controllerId !== humanPlayerId);
      if (enemyUnits.length > 0) {
        castSpell(avatarInstId, selectedInstanceId!, sq, enemyUnits[0].instanceId);
        selectInstance(null);
      }
      return;
    }

    if (selectedInst.location && isHighlighted(sq) && highlightMode === 'move') {
      const currentSq = selectedInst.location.square;
      const isSameSquare = currentSq.row === sq.row && currentSq.col === sq.col;

      if (isSameSquare) {
        const enemies = cell.unitInstanceIds
          .map(id => game.instances[id])
          .filter(inst => inst && inst.controllerId !== humanPlayerId);
        if (enemies.length > 0) {
          moveAndAttack(selectedInst.instanceId, [], enemies[0].instanceId);
        } else if (cell.siteInstanceId) {
          const siteInst = game.instances[cell.siteInstanceId];
          if (siteInst?.controllerId !== humanPlayerId) {
            moveAndAttack(selectedInst.instanceId, [], cell.siteInstanceId);
          }
        }
      } else {
        const path = [sq];
        const enemies = cell.unitInstanceIds
          .map(id => game.instances[id])
          .filter(inst => inst && inst.controllerId !== humanPlayerId);
        if (enemies.length > 0) {
          moveAndAttack(selectedInst.instanceId, path, enemies[0].instanceId);
        } else {
          moveAndAttack(selectedInst.instanceId, path);
        }
      }
      selectInstance(null);
      return;
    }

    if (cell.unitInstanceIds.length > 0) {
      const topUnit = cell.unitInstanceIds[cell.unitInstanceIds.length - 1];
      const topInst = game.instances[topUnit];
      if (topInst?.controllerId === humanPlayerId) {
        selectInstance(topUnit);
        return;
      }
    }

    selectInstance(null);
  };

  const handleUnitClick = (e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation();
    const inst = game.instances[instanceId];
    if (!inst) return;

    if (selectedInst) {
      if (highlightMode === 'move' && inst.controllerId !== humanPlayerId) {
        const sq = inst.location?.square;
        if (sq && isHighlighted(sq)) {
          moveAndAttack(selectedInst.instanceId, [sq], instanceId);
          selectInstance(null);
          return;
        }
      }
      if (selectedInst.card.type === 'magic' && !selectedInst.location && inst.controllerId !== humanPlayerId) {
        const player = game.players[humanPlayerId];
        castSpell(player.avatarInstanceId, selectedInst.instanceId, undefined, instanceId);
        selectInstance(null);
        return;
      }
    }

    selectInstance(instanceId === selectedInstanceId ? null : instanceId);
  };

  const renderCell = (row: number, col: number) => {
    const cell = game.realm[row][col];
    const sq = { row, col };
    const highlighted = isHighlighted(sq);
    const siteInst = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;

    let cellType = 'void';
    if (siteInst) {
      if (siteInst.isRubble) cellType = 'rubble';
      else if (siteInst.card.type === 'site' && (siteInst.card as any).isWaterSite) cellType = 'water';
      else cellType = siteInst.controllerId === humanPlayerId ? 'land_p1' : 'land_p2';
    }

    return (
      <div
        key={`${row}-${col}`}
        className={`${styles.cell} ${styles[cellType]} ${highlighted ? styles.highlighted : ''}`}
        onClick={() => handleSquareClick(row, col)}
      >
        <span className={styles.coord}>{row},{col}</span>

        {siteInst && !siteInst.isRubble && (
          <div
            className={`${styles.site} ${siteInst.controllerId === humanPlayerId ? styles.siteOwn : styles.siteEnemy}`}
            onClick={(e) => { e.stopPropagation(); handleUnitClick(e, siteInst.instanceId); }}
          >
            <div className={styles.siteName}>{siteInst.card.name}</div>
            <div className={styles.siteAffinity}>
              {Object.entries((siteInst.card as any).threshold ?? {}).map(([el, v]) => (
                <span key={el} className={`${styles.el} ${styles[el]}`}>
                  {el === 'fire' ? '▲' : el === 'water' ? '▼' : el === 'air' ? '△' : '▽'}{String(v)}
                </span>
              ))}
            </div>
          </div>
        )}

        {siteInst?.isRubble && <div className={styles.rubble}>Rubble</div>}

        <div className={styles.units}>
          {cell.unitInstanceIds.map(id => {
            const inst = game.instances[id];
            if (!inst) return null;
            const isSelected = id === selectedInstanceId;
            const isOwn = inst.controllerId === humanPlayerId;
            const power = inst.card.type === 'minion'
              ? (inst.card as MinionCard).power
              : inst.card.type === 'avatar'
                ? inst.card.attackPower
                : null;

            return (
              <div
                key={id}
                className={`
                  ${styles.unitToken}
                  ${isOwn ? styles.ownUnit : styles.enemyUnit}
                  ${isSelected ? styles.selectedToken : ''}
                  ${inst.tapped ? styles.tappedToken : ''}
                  ${inst.summoningSickness ? styles.sickToken : ''}
                `}
                onClick={(e) => handleUnitClick(e, id)}
                title={`${inst.card.name}${inst.tapped ? ' [Tapped]' : ''}${inst.summoningSickness ? ' [Sick]' : ''}`}
              >
                <span className={styles.tokenName}>{inst.card.name.substring(0, 5)}</span>
                {power !== null && (
                  <span className={styles.tokenPower}>
                    {typeof power === 'number' ? power : `${power.attack}/${power.defense}`}
                    {inst.damage > 0 && <span className={styles.dmg}>-{inst.damage}</span>}
                  </span>
                )}
                {inst.card.type === 'avatar' && (
                  <span className={styles.tokenLife}>
                    ♥{game.players[inst.controllerId].life}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {cell.auraInstanceIds.length > 0 && (
          <div className={styles.auraIndicator}>✨</div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.realm}>
      <div className={styles.playerLabel}>↑ {game.players.player2.name} (Opponent)</div>
      <div className={styles.grid}>
        {game.realm.map((row, r) => row.map((_, c) => renderCell(r, c)))}
      </div>
      <div className={styles.playerLabel}>↓ {game.players.player1.name} (You)</div>
    </div>
  );
};
