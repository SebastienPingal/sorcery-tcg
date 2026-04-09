import React, { useState } from 'react';
import type { GameState, Square, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { selectReachableSquares, selectValidSitePlacements } from '../../engine/selectors';
import { hasKeyword } from '../../engine/utils';
import styles from './RealmGrid.module.css';

interface RealmGridProps {
  game: GameState;
  humanPlayerId: PlayerId;
  flipped?: boolean;
}

export const RealmGrid: React.FC<RealmGridProps> = ({ game, humanPlayerId, flipped = false }) => {
  const {
    selectedInstanceId,
    selectInstance,
    castSpell,
    playSiteViaAbility,
    pendingAvatarAbility,
    setPendingMove,
    setSquareDetail,
    showCardDetail,
    hoverInstance,
  } = useGameStore();

  // Track which cell is hovered for spread animation
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const selectedInst = selectedInstanceId ? game.instances[selectedInstanceId] : null;
  const isMyTurn = game.activePlayerId === humanPlayerId;
  const player = game.players[humanPlayerId];
  const avatarInst = game.instances[player.avatarInstanceId];
  const fallbackPlaySiteAbilityId =
    avatarInst.card.type === 'avatar' && !avatarInst.tapped
      ? avatarInst.card.abilities.find((ability) =>
          ability.id.includes('play_site') ||
          ability.id.includes('flamecaller_play') ||
          ability.id.includes('sparkmage_play'),
        )?.id ?? null
      : null;
  const activePlaySiteAbilityId = pendingAvatarAbility ?? fallbackPlaySiteAbilityId;

  const getHighlightedSquares = (): { squares: Square[]; attackSquares: Square[]; mode: string } => {
    if (!selectedInst) return { squares: [], attackSquares: [], mode: '' };
    const card = selectedInst.card;

    // Sites can only be placed when a pendingAvatarAbility is active
    if (card.type === 'site' && !selectedInst.location) {
      return { squares: selectValidSitePlacements(game, humanPlayerId), attackSquares: [], mode: 'place_site' };
    }

    if (!selectedInst.location && (card.type === 'minion' || card.type === 'magic' || card.type === 'artifact')) {
      const squares: Square[] = [];
      const allowVoidSummon = card.type === 'minion' && hasKeyword(selectedInst, 'voidwalk');
      for (const row of game.realm) {
        for (const cell of row) {
          if (cell.siteInstanceId) {
            const siteInst = game.instances[cell.siteInstanceId];
            if (siteInst?.controllerId === humanPlayerId) {
              squares.push({ row: cell.row, col: cell.col });
            } else if (allowVoidSummon && siteInst?.isRubble) {
              squares.push({ row: cell.row, col: cell.col });
            }
          } else if (allowVoidSummon) {
            squares.push({ row: cell.row, col: cell.col });
          }
        }
      }
      const mode = card.type === 'minion' ? 'cast_minion' : card.type === 'artifact' ? 'cast_artifact' : 'cast_magic';
      return { squares, attackSquares: [], mode };
    }

    if (selectedInst.location && (card.type === 'minion' || card.type === 'avatar') && isMyTurn) {
      if (!selectedInst.tapped && !selectedInst.summoningSickness) {
        const reachable = selectReachableSquares(game, selectedInst);
        // Also include the current square (attack in place / use abilities here)
        const startSq = selectedInst.location.square;
        if (!reachable.some(s => s.row === startSq.row && s.col === startSq.col)) {
          reachable.unshift({ row: startSq.row, col: startSq.col });
        }
        // Separate attack targets (squares with enemies) from plain movement squares
        const attackSqs: Square[] = [];
        for (const sq of reachable) {
          const cell = game.realm[sq.row][sq.col];
          const hasEnemyUnit = cell.unitInstanceIds.some(
            id => game.instances[id]?.controllerId !== humanPlayerId
          );
          const site = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
          const hasEnemySite = !!site && site.controllerId !== humanPlayerId && !site.isRubble;
          if (hasEnemyUnit || hasEnemySite) attackSqs.push(sq);
        }
        return { squares: reachable, attackSquares: attackSqs, mode: 'move' };
      }
    }

    return { squares: [], attackSquares: [], mode: '' };
  };

  const { squares: highlightedSquares, attackSquares: attackTargetSquares, mode: highlightMode } = getHighlightedSquares();

  const isHighlighted = (sq: Square): boolean =>
    highlightedSquares.some(h => h.row === sq.row && h.col === sq.col);

  const handleSquareClick = (row: number, col: number) => {
    const sq: Square = { row, col };
    const cell = game.realm[row][col];
    if (!selectedInst) return;

    const card = selectedInst.card;
    const avatarInstId = player.avatarInstanceId;

    if (card.type === 'site' && !selectedInst.location && isHighlighted(sq)) {
      playSiteViaAbility(humanPlayerId, activePlaySiteAbilityId ?? '', selectedInstanceId!, sq);
      return;
    }

    if ((card.type === 'minion' || card.type === 'artifact') && !selectedInst.location && isHighlighted(sq)) {
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
      // Two-step: pick destination first, then choose action in a modal
      setPendingMove({ unitInstanceId: selectedInst.instanceId, destSquare: sq });
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
      if (
        selectedInst.card.type === 'site' &&
        !selectedInst.location &&
        inst.location
      ) {
        const sq = inst.location.square;
        if (isHighlighted(sq)) {
          playSiteViaAbility(humanPlayerId, activePlaySiteAbilityId ?? '', selectedInstanceId!, sq);
          return;
        }
      }
      if (highlightMode === 'move' && inst.controllerId !== humanPlayerId) {
        const sq = inst.location?.square;
        if (sq && isHighlighted(sq)) {
          // Two-step: open action modal for the destination square
          setPendingMove({ unitInstanceId: selectedInst.instanceId, destSquare: sq });
          return;
        }
      }
      if (selectedInst.card.type === 'magic' && !selectedInst.location && inst.controllerId !== humanPlayerId) {
        const player = game.players[humanPlayerId];
        castSpell(player.avatarInstanceId, selectedInst.instanceId, undefined, instanceId);
        selectInstance(null);
        return;
      }
      // Artifact → click any unit/avatar to attach it
      if (selectedInst.card.type === 'artifact' && !selectedInst.location) {
        const player = game.players[humanPlayerId];
        castSpell(player.avatarInstanceId, selectedInst.instanceId, undefined, instanceId);
        selectInstance(null);
        return;
      }
    }

    // Re-clicking the already-selected unit in move mode → open action modal on current square
    if (instanceId === selectedInstanceId && highlightMode === 'move') {
      const sq = inst.location?.square;
      if (sq) setPendingMove({ unitInstanceId: instanceId, destSquare: sq });
      return;
    }

    if (inst.controllerId === humanPlayerId) {
      selectInstance(instanceId === selectedInstanceId ? null : instanceId);
    }
  };

  const handleCardRightClick = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    showCardDetail(instanceId);
  };

  const handleCellRightClick = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSquareDetail({ row, col });
  };

  const isAttackTarget = (sq: Square): boolean =>
    attackTargetSquares.some(h => h.row === sq.row && h.col === sq.col);

  const renderCell = (row: number, col: number) => {
    const cell = game.realm[row][col];
    const sq = { row, col };
    const highlighted = isHighlighted(sq);
    const attackTarget = isAttackTarget(sq);
    const siteInst = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
    const isWaterSite = siteInst?.card.type === 'site' && siteInst.card.isWaterSite;
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;

    let cellType = 'void';
    if (siteInst) {
      if (siteInst.isRubble) cellType = 'rubble';
      else if (isWaterSite) cellType = 'water';
      else cellType = siteInst.controllerId === humanPlayerId ? 'land_p1' : 'land_p2';
    }

    return (
      <div
        key={`${row}-${col}`}
        className={`${styles.cell} ${styles[cellType]} ${attackTarget ? styles.attackTarget : highlighted ? styles.highlighted : ''} ${isHovered ? styles.cellHovered : ''}`}
        onClick={() => handleSquareClick(row, col)}
        onContextMenu={(e) => handleCellRightClick(e, row, col)}
        onMouseEnter={() => setHoveredCell({ row, col })}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <span className={styles.coord}>{row},{col}</span>

        {cell.subsurfaceUnitIds.length > 0 && (
          <div className={`${styles.unitsLayer} ${styles.undergroundLayer}`}>
            {cell.subsurfaceUnitIds.map((id, index) => {
              const inst = game.instances[id];
              if (!inst) return null;
              const isSelected = id === selectedInstanceId;
              const isOwn = inst.controllerId === humanPlayerId;
              const spread = isHovered ? 32 : 12;
              const offset = (index - (cell.subsurfaceUnitIds.length - 1) / 2) * spread;
              const tokenOffsetStyle = { '--stack-offset-x': `${offset}px` } as React.CSSProperties;

              return (
                <div
                  key={id}
                  className={`
                    ${styles.unitToken}
                    ${styles.undergroundToken}
                    ${isOwn ? styles.ownUnit : styles.enemyUnit}
                  ${inst.controllerId === 'player1' ? styles.player1Unit : styles.player2Unit}
                    ${isSelected ? styles.selectedToken : ''}
                    ${inst.tapped ? styles.tappedToken : ''}
                    ${inst.summoningSickness ? styles.sickToken : ''}
                  `}
                  style={tokenOffsetStyle}
                  onClick={(e) => handleUnitClick(e, id)}
                  onContextMenu={(e) => handleCardRightClick(e, id)}
                  onMouseEnter={() => hoverInstance(id)}
                  onMouseLeave={() => hoverInstance(null)}
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
              ${siteInst.controllerId === 'player1' ? styles.sitePlayer1 : styles.sitePlayer2}
              ${siteInst.card.image ? styles.siteLandscape : ''}
              ${isHovered ? styles.siteHovered : ''}
            `}
            onClick={(e) => {
              if (highlighted) {
                // Placing a card — treat click on site as click on the square
                handleSquareClick(row, col);
              } else {
                e.stopPropagation();
                handleUnitClick(e, siteInst.instanceId);
              }
            }}
            onContextMenu={(e) => handleCardRightClick(e, siteInst.instanceId)}
            onMouseEnter={() => hoverInstance(siteInst.instanceId)}
            onMouseLeave={() => hoverInstance(null)}
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
            const spread = isHovered ? 32 : 12;
            const offset = (index - (cell.unitInstanceIds.length - 1) / 2) * spread;
            const tokenOffsetStyle = { '--stack-offset-x': `${offset}px` } as React.CSSProperties;

            return (
              <div
                key={id}
                className={`
                  ${styles.unitToken}
                  ${styles.surfaceToken}
                  ${isOwn ? styles.ownUnit : styles.enemyUnit}
                  ${inst.controllerId === 'player1' ? styles.player1Unit : styles.player2Unit}
                  ${isSelected ? styles.selectedToken : ''}
                  ${inst.tapped ? styles.tappedToken : ''}
                  ${inst.summoningSickness ? styles.sickToken : ''}
                `}
                style={tokenOffsetStyle}
                onClick={(e) => handleUnitClick(e, id)}
                onContextMenu={(e) => handleCardRightClick(e, id)}
                onMouseEnter={() => hoverInstance(id)}
                onMouseLeave={() => hoverInstance(null)}
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
                {inst.carriedArtifacts.length > 0 && (
                  <div className={styles.carriedArtifactsRow}>
                    {inst.carriedArtifacts.map(artId => {
                      const artInst = game.instances[artId];
                      if (!artInst) return null;
                      return (
                        <div
                          key={artId}
                          className={styles.carriedArtifactBadge}
                          title={artInst.card.name}
                          onContextMenu={(e) => handleCardRightClick(e, artId)}
                          onMouseEnter={(e) => { e.stopPropagation(); hoverInstance(artId); }}
                          onMouseLeave={(e) => { e.stopPropagation(); hoverInstance(null); }}
                        >
                          {artInst.card.image ? (
                            <img
                              src={artInst.card.image}
                              alt={artInst.card.name}
                              className={styles.carriedArtifactImage}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span className={styles.carriedArtifactLabel}>{artInst.card.name.substring(0, 3)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

  const opponentId = humanPlayerId === 'player1' ? 'player2' : 'player1';
  const rows = flipped ? [...game.realm].reverse() : game.realm;

  return (
    <div className={styles.realm}>
      <div className={styles.playerLabel}>↑ {game.players[opponentId].name} (Opponent)</div>
      <div className={styles.grid}>
        {rows.map((row) => row.map((_, c) => renderCell(row[c].row, c)))}
      </div>
      <div className={styles.playerLabel}>↓ {game.players[humanPlayerId].name} (You)</div>
    </div>
  );
};
