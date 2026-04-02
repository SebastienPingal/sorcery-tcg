import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../../types';
import styles from './GameLog.module.css';

interface GameLogProps {
  entries: LogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className={styles.log}>
      <div className={styles.title}>Game Log</div>
      <div className={styles.entries}>
        {entries.map(entry => (
          <div key={entry.id} className={`${styles.entry} ${styles[entry.type]}`}>
            <span className={styles.text}>{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
