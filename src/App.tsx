import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { RealmGrid } from './components/Realm/RealmGrid';
import { Hand } from './components/Hand/Hand';
import { PlayerInfo } from './components/PlayerInfo/PlayerInfo';
import { GameLog } from './components/GameLog/GameLog';
import { Controls } from './components/Controls/Controls';
import { MulliganScreen } from './components/GameLog/MulliganScreen';
import { CardDetail } from './components/CardDetail/CardDetail';
import type { PlayerId } from './types';
import styles from './App.module.css';

const App: React.FC = () => {
  const { game, startQuickGame } = useGameStore();

  // Hot-seat: show a "pass the device" screen between turns
  const [handoff, setHandoff] = useState(false);
  const prevActiveRef = useRef<PlayerId | null>(null);

  // Detect turn change → trigger handoff screen
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    if (prevActiveRef.current && prevActiveRef.current !== game.activePlayerId) {
      setHandoff(true);
    }
    prevActiveRef.current = game.activePlayerId;
  }, [game?.activePlayerId, game?.status]);

  // Keyboard shortcut: Escape to deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useGameStore.getState().selectInstance(null);
        useGameStore.getState().clearError();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!game) {
    return (
      <div className={styles.startScreen}>
        <div className={styles.startPanel}>
          <h1 className={styles.logo}>SORCERY</h1>
          <h2 className={styles.subtitle}>Contested Realm</h2>
          <p className={styles.tagline}>A digital adaptation of the TCG</p>
          <button className={styles.startBtn} onClick={startQuickGame}>
            ⚔ Hot-seat (2 players, 1 computer)
          </button>
          <div className={styles.deckInfo}>
            <p>Player 1: Sorcerer (Fire/Earth) vs Player 2: Sparkmage (Water/Air)</p>
          </div>
        </div>
      </div>
    );
  }

  if (game.status === 'ended') {
    return (
      <div className={styles.endScreen}>
        <div className={styles.endPanel}>
          <h1 className={styles.winTitle}>
            {game.winner ? `${game.players[game.winner].name} Wins!` : 'Game Over'}
          </h1>
          <button className={styles.restartBtn} onClick={startQuickGame}>
            ↺ New Game
          </button>
        </div>
      </div>
    );
  }

  // During mulligan: pendingInteraction tells us whose turn it is to mulligan
  const mulliganPlayer: PlayerId =
    game.pendingInteraction?.type === 'mulligan'
      ? game.pendingInteraction.playerId
      : 'player1';

  // During play: the active player is "you" for this turn
  const humanPlayerId: PlayerId =
    game.status === 'mulligan' ? mulliganPlayer : game.activePlayerId;

  const opponentId: PlayerId = humanPlayerId === 'player1' ? 'player2' : 'player1';

  // Board is flipped when player2 is the current human (their side should be at the bottom)
  const flipped = humanPlayerId === 'player2';

  return (
    <div className={styles.app}>
      <CardDetail game={game} />

      {/* Mulligan overlay */}
      {game.status === 'mulligan' && (
        <MulliganScreen game={game} humanPlayerId={humanPlayerId} />
      )}

      {/* Pass-the-device handoff screen */}
      {handoff && (
        <div className={styles.handoffOverlay}>
          <div className={styles.handoffPanel}>
            <div className={styles.handoffIcon}>🤝</div>
            <h2 className={styles.handoffTitle}>
              Pass the device to {game.players[game.activePlayerId].name}
            </h2>
            <p className={styles.handoffSub}>
              Cover the screen while your opponent picks up the device.
            </p>
            <button className={styles.handoffBtn} onClick={() => setHandoff(false)}>
              Ready — I'm {game.players[game.activePlayerId].name}
            </button>
          </div>
        </div>
      )}

      {/* Opponent bar (top) */}
      <div className={styles.topBar}>
        <PlayerInfo game={game} playerId={opponentId} isActive={game.activePlayerId === opponentId} />
        <Hand game={game} playerId={opponentId} isHidden={true} />
      </div>

      {/* Main area */}
      <div className={styles.mainArea}>
        <div className={styles.logPanel}>
          <GameLog entries={game.log} />
        </div>
        <div className={styles.realmPanel}>
          <RealmGrid game={game} humanPlayerId={humanPlayerId} flipped={flipped} />
        </div>
        <div className={styles.controlsPanel}>
          <Controls game={game} humanPlayerId={humanPlayerId} />
        </div>
      </div>

      {/* Current player bar (bottom) */}
      <div className={styles.bottomBar}>
        <PlayerInfo game={game} playerId={humanPlayerId} isActive={game.activePlayerId === humanPlayerId} />
        <Hand game={game} playerId={humanPlayerId} />
      </div>
    </div>
  );
};

export default App;
