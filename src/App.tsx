import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { RealmGrid } from './components/Realm/RealmGrid';
import { Hand } from './components/Hand/Hand';
import { PlayerInfo } from './components/PlayerInfo/PlayerInfo';
import { GameLog } from './components/GameLog/GameLog';
import { Controls } from './components/Controls/Controls';
import { MulliganScreen } from './components/GameLog/MulliganScreen';
import styles from './App.module.css';

const HUMAN_PLAYER = 'player1' as const;

const App: React.FC = () => {
  const { game, startQuickGame } = useGameStore();

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
            ⚔ Quick Play (vs Yourself)
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

  return (
    <div className={styles.app}>
      {/* Mulligan overlay */}
      {game.status === 'mulligan' && (
        <MulliganScreen game={game} humanPlayerId={HUMAN_PLAYER} />
      )}

      {/* Top bar: opponent info */}
      <div className={styles.topBar}>
        <PlayerInfo
          game={game}
          playerId="player2"
          isActive={game.activePlayerId === 'player2'}
        />
        <Hand game={game} playerId="player2" isHidden={true} />
      </div>

      {/* Main area */}
      <div className={styles.mainArea}>
        {/* Game log (left) */}
        <div className={styles.logPanel}>
          <GameLog entries={game.log} />
        </div>

        {/* Realm (center) */}
        <div className={styles.realmPanel}>
          <RealmGrid game={game} humanPlayerId={HUMAN_PLAYER} />
        </div>

        {/* Controls (right) */}
        <div className={styles.controlsPanel}>
          <Controls game={game} humanPlayerId={HUMAN_PLAYER} />
        </div>
      </div>

      {/* Bottom: player hand */}
      <div className={styles.bottomBar}>
        <PlayerInfo
          game={game}
          playerId={HUMAN_PLAYER}
          isActive={game.activePlayerId === HUMAN_PLAYER}
        />
        <Hand game={game} playerId={HUMAN_PLAYER} />
      </div>
    </div>
  );
};

export default App;
