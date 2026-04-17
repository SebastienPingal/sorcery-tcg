import React, { useState } from 'react';
import type { ElementalThreshold, GameState, PlayerId } from '../../types';
import { useGameStore } from '../../store/gameStore';
import styles from './DebugPanel.module.css';

interface DebugPanelProps {
  game: GameState;
}

type Tab = 'overview' | 'players' | 'board' | 'instances' | 'pending' | 'raw';

export const DebugPanel: React.FC<DebugPanelProps> = ({ game }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const store = useGameStore();

  if (!open) {
    return (
      <button className={styles.toggle} onClick={() => setOpen(true)}>
        🛠 debug
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Debug — state snapshot</span>
        <button className={styles.close} onClick={() => setOpen(false)} title="Close">×</button>
      </div>
      <div className={styles.tabs}>
        {(['overview', 'players', 'board', 'instances', 'pending', 'raw'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        {tab === 'overview' && <Overview game={game} />}
        {tab === 'players' && <Players game={game} />}
        {tab === 'board' && <Board game={game} />}
        {tab === 'instances' && <Instances game={game} />}
        {tab === 'pending' && <Pending store={store} game={game} />}
        {tab === 'raw' && <Raw game={game} />}
      </div>
    </div>
  );
};

const Overview: React.FC<{ game: GameState }> = ({ game }) => (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>Game</div>
    <div className={styles.kv}>
      <span className={styles.key}>status</span><span className={styles.val}>{game.status}</span>
      <span className={styles.key}>phase / step</span><span className={styles.val}>{game.phase} / {game.step}</span>
      <span className={styles.key}>turn</span><span className={styles.val}>{game.turnNumber}</span>
      <span className={styles.key}>active</span><span className={styles.val}>{game.activePlayerId}</span>
      <span className={styles.key}>spells this turn</span><span className={styles.val}>{game.currentTurn.spellsCastCount}</span>
      <span className={styles.key}>attacks this turn</span><span className={styles.val}>{game.currentTurn.attacksDeclared.length}</span>
      <span className={styles.key}>moves this turn</span><span className={styles.val}>{game.currentTurn.unitsThatMoved.length}</span>
      <span className={styles.key}>pendingInteraction</span><span className={styles.val}>{game.pendingInteraction?.type ?? 'none'}</span>
      <span className={styles.key}>winner</span><span className={styles.val}>{game.winner ?? '—'}</span>
    </div>
  </div>
);

const Players: React.FC<{ game: GameState }> = ({ game }) => (
  <>
    {(['player1', 'player2'] as PlayerId[]).map((pid) => {
      const p = game.players[pid];
      return (
        <div key={pid} className={styles.section}>
          <div className={styles.sectionTitle}>{pid} — {p.name}</div>
          <div className={styles.kv}>
            <span className={styles.key}>life</span><span className={styles.val}>{p.life} / {p.maxLife}{p.isAtDeathsDoor ? ` (death's door t${p.deathsDoorTurn})` : ''}</span>
            <span className={styles.key}>mana</span><span className={styles.val}>{p.manaPool - p.manaUsed} / {p.manaPool} (used {p.manaUsed})</span>
            <span className={styles.key}>affinity</span><span className={styles.val}>{affinityToString(p.elementalAffinity)}</span>
            <span className={styles.key}>avatar</span><span className={styles.val}>{p.avatarInstanceId}</span>
            <span className={styles.key}>hand ({p.hand.length})</span><span className={styles.val}>{p.hand.map((id) => displayName(game, id)).join(', ') || '—'}</span>
            <span className={styles.key}>atlas ({p.atlasCards.length})</span><span className={styles.val}>top: {displayName(game, p.atlasCards[0]) || '—'}</span>
            <span className={styles.key}>spellbook ({p.spellbookCards.length})</span><span className={styles.val}>top: {displayName(game, p.spellbookCards[0]) || '—'}</span>
            <span className={styles.key}>cemetery ({p.cemetery.length})</span><span className={styles.val}>{p.cemetery.map((id) => displayName(game, id)).join(', ') || '—'}</span>
          </div>
        </div>
      );
    })}
  </>
);

const Board: React.FC<{ game: GameState }> = ({ game }) => (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>Realm</div>
    {game.realm.map((row, rIdx) => (
      <div key={rIdx}>
        {row.map((cell) => {
          const site = cell.siteInstanceId ? game.instances[cell.siteInstanceId] : null;
          const anyContent =
            site ||
            cell.unitInstanceIds.length ||
            cell.artifactInstanceIds.length ||
            cell.subsurfaceUnitIds.length ||
            cell.auraInstanceIds.length;
          if (!anyContent) return null;
          return (
            <div key={`${cell.row}-${cell.col}`} className={styles.row}>
              <div className={styles.key}>
                [{cell.row},{cell.col}] {site ? `${site.card.name}${site.isRubble ? ' (rubble)' : ''} · ${site.controllerId}` : '(no site)'}
              </div>
              {cell.unitInstanceIds.length > 0 && (
                <div className={styles.val}>units: {cell.unitInstanceIds.map((id) => displayName(game, id)).join(', ')}</div>
              )}
              {cell.subsurfaceUnitIds.length > 0 && (
                <div className={styles.val}>subsurface: {cell.subsurfaceUnitIds.map((id) => displayName(game, id)).join(', ')}</div>
              )}
              {cell.artifactInstanceIds.length > 0 && (
                <div className={styles.val}>artifacts: {cell.artifactInstanceIds.map((id) => displayName(game, id)).join(', ')}</div>
              )}
              {cell.auraInstanceIds.length > 0 && (
                <div className={styles.val}>auras: {cell.auraInstanceIds.map((id) => displayName(game, id)).join(', ')}</div>
              )}
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

const Instances: React.FC<{ game: GameState }> = ({ game }) => {
  const ids = Object.keys(game.instances);
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Instances ({ids.length})</div>
      {ids.map((id) => {
        const inst = game.instances[id];
        const loc = inst.location
          ? `${inst.location.region}@[${inst.location.square.row},${inst.location.square.col}]`
          : '—';
        return (
          <div key={id} className={styles.row}>
            <div className={styles.key}>{id}</div>
            <div className={styles.val}>
              {inst.card.name} · {inst.card.type} · {inst.controllerId} · {loc}
              {inst.tapped ? ' · tapped' : ''}
              {inst.summoningSickness ? ' · sick' : ''}
              {inst.damage ? ` · dmg ${inst.damage}` : ''}
              {inst.tokens.length ? ` · tokens [${inst.tokens.join(',')}]` : ''}
              {inst.carriedArtifacts.length ? ` · carries [${inst.carriedArtifacts.join(',')}]` : ''}
              {inst.carriedBy ? ` · carriedBy ${inst.carriedBy}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Pending: React.FC<{ store: ReturnType<typeof useGameStore>; game: GameState }> = ({ store, game }) => {
  const entries: Array<[string, unknown]> = [
    ['selectedInstanceId', store.selectedInstanceId],
    ['hoveredInstanceId', store.hoveredInstanceId],
    ['actionError', store.actionError],
    ['pendingAvatarAbility', store.pendingAvatarAbility],
    ['cardDetailId', store.cardDetailId],
    ['pendingMove', store.pendingMove],
    ['pendingSummon', store.pendingSummon],
    ['pendingSpellcastChoice', store.pendingSpellcastChoice],
    ['pendingMagicTarget', store.pendingMagicTarget],
    ['squareDetail', store.squareDetail],
    ['game.pendingInteraction', game.pendingInteraction],
  ];
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Store & Interaction</div>
      {entries.map(([k, v]) => {
        const empty = v === null || v === undefined || (Array.isArray(v) && v.length === 0);
        if (empty) {
          return (
            <div key={k} className={styles.kv}>
              <span className={styles.key}>{k}</span>
              <span className={styles.val}>—</span>
            </div>
          );
        }
        return (
          <div key={k} className={styles.pending}>
            <strong>{k}</strong>
            <pre className={styles.pre}>{JSON.stringify(v, null, 2)}</pre>
          </div>
        );
      })}
    </div>
  );
};

const Raw: React.FC<{ game: GameState }> = ({ game }) => {
  const copy = { ...game } as GameState & { __engineRuntime?: unknown };
  delete copy.__engineRuntime;
  return <pre className={styles.pre}>{JSON.stringify(copy, null, 2)}</pre>;
};

function displayName(game: GameState, id: string | undefined): string {
  if (!id) return '';
  const inst = game.instances[id];
  return inst ? `${inst.card.name}#${id.slice(-4)}` : id;
}

function affinityToString(a: ElementalThreshold): string {
  return (Object.entries(a) as Array<[string, number | undefined]>)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${k.slice(0, 1).toUpperCase()}${v}`)
    .join(' ') || '—';
}
