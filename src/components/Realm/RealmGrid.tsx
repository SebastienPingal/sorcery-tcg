import React from 'react';
import type { GameState, Square, PlayerId } from '../../types';
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
    showCardDetail,
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

  const handleCardRightClick = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    showCardDetail(instanceId);
  };

  const handleCellRightClick = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = game.realm[row][col];
    const topSurface = cell.unitInstanceIds[cell.unitInstanceIds.length - 1];
    if (topSurface) {
      showCardDetail(topSurface);
      return;
    }
    const topUnderground = cell.subsurfaceUnitIds[cell.subsurfaceUnitIds.length - 1];
    if (topUnderground) {
      showCardDetail(topUnderground);
      return;
    }
    if (cell.siteInstanceId) {
      showCardDetail(cell.siteInstanceId);
    }
  };

  const renderCell = (row: number, col: number) => {
    const cell = game.realm[row][col];
    const sq = { row, col };
    const highlighted = isHighlighted(sq);
    const siteInst = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
    const isWaterSite = siteInst?.card.type === 'site' && siteInst.card.isWaterSite;

    let cellType = 'void';
    if (siteInst) {
      if (siteInst.isRubble) cellType = 'rubble';
      else if (isWaterSite) cellType = 'water';
      else cellType = siteInst.controllerId === humanPlayerId ? 'land_p1' : 'land_p2';
    }

    return (
      <div
        key={`${row}-${col}`}
        className={`${styles.cell} ${styles[cellType]} ${highlighted ? styles.highlighted : ''}`}
        onClick={() => handleSquareClick(row, col)}
        onContextMenu={(e) => handleCellRightClick(e, row, col)}
      >
        <span className={styles.coord}>{row},{col}</span>

        {cell.subsurfaceUnitIds.length > 0 && (
          <div className={`${styles.unitsLayer} ${styles.undergroundLayer}`}>
            {cell.subsurfaceUnitIds.map((id, index) => {
              const inst = game.instances[id];
              if (!inst) return null;
              const isSelected = id === selectedInstanceId;
              const isOwn = inst.controllerId === humanPlayerId;
              const offset = (index - (cell.subsurfaceUnitIds.length - 1) / 2) * 12;
              const tokenOffsetStyle = { '--stack-offset-x': `${offset}px` } as React.CSSProperties;

              return (
                <div
                  key={id}
                  className={`
                    ${styles.unitToken}
                    ${styles.undergroundToken}
                    ${isOwn ? styles.ownUnit : styles.enemyUnit}
                    ${isSelected ? styles.selectedToken : ''}
                    ${inst.tapped ? styles.tappedToken : ''}
                    ${inst.summoningSickness ? styles.sickToken : ''}
                  `}
                  style={tokenOffsetStyle}
                  onClick={(e) => handleUnitClick(e, id)}
                  onContextMenu={(e) => handleCardRightClick(e, id)}
                  title={`${inst.card.name} [Underground]${inst.tapped ? ' [Tapped]' : ''}${inst.summoningSickness ? ' [Sick]' : ''}`}
                >
                  {inst.card.image ? (
                    <img
                      src={inst.card.image}
                      alt={inst.card.name}
                      className={styles.unitImage}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className={styles.tokenName}>{inst.card.name.substring(0, 5)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {siteInst && !siteInst.isRubble && (
          <div
            className={`
              ${styles.site}
              ${siteInst.controllerId === humanPlayerId ? styles.siteOwn : styles.siteEnemy}
              ${siteInst.card.image ? styles.siteLandscape : ''}
            `}
            onClick={(e) => { e.stopPropagation(); handleUnitClick(e, siteInst.instanceId); }}
            onContextMenu={(e) => handleCardRightClick(e, siteInst.instanceId)}
            title={siteInst.card.name}
          >
            {siteInst.card.image ? (
              <img
                src={siteInst.card.image}
                alt={siteInst.card.name}
                className={styles.siteImage}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={styles.siteName}>{siteInst.card.name}</div>
            )}
          </div>
        )}

        {siteInst?.isRubble && <div className={styles.rubble}>Rubble</div>}

        <div className={`${styles.unitsLayer} ${styles.surfaceLayer}`}>
          {cell.unitInstanceIds.map((id, index) => {
            const inst = game.instances[id];
            if (!inst) return null;
            const isSelected = id === selectedInstanceId;
            const isOwn = inst.controllerId === humanPlayerId;
            const offset = (index - (cell.unitInstanceIds.length - 1) / 2) * 12;
            const tokenOffsetStyle = { '--stack-offset-x': `${offset}px` } as React.CSSProperties;

            return (
              <div
                key={id}
                className={`
                  ${styles.unitToken}
                  ${styles.surfaceToken}
                  ${isOwn ? styles.ownUnit : styles.enemyUnit}
                  ${isSelected ? styles.selectedToken : ''}
                  ${inst.tapped ? styles.tappedToken : ''}
                  ${inst.summoningSickness ? styles.sickToken : ''}
                `}
                style={tokenOffsetStyle}
                onClick={(e) => handleUnitClick(e, id)}
                onContextMenu={(e) => handleCardRightClick(e, id)}
                title={`${inst.card.name}${inst.tapped ? ' [Tapped]' : ''}${inst.summoningSickness ? ' [Sick]' : ''}`}
              >
                {inst.card.image ? (
                  <img
                    src={inst.card.image}
                    alt={inst.card.name}
                    className={styles.unitImage}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className={styles.tokenName}>{inst.card.name.substring(0, 5)}</span>
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
