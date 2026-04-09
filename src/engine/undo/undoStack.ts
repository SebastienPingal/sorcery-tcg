import type { GameState } from '../core/gameState';

export interface UndoStack {
  snapshots: GameState[];
  locked: boolean;
}

export function createUndoStack(): UndoStack {
  return { snapshots: [], locked: false };
}

export function pushUndo(undo: UndoStack, state: GameState): UndoStack {
  if (undo.locked) return undo;
  return { ...undo, snapshots: [...undo.snapshots, structuredClone(state)] };
}

export function popUndo(undo: UndoStack): { undo: UndoStack; state?: GameState } {
  if (undo.locked || undo.snapshots.length === 0) return { undo };
  const next = [...undo.snapshots];
  const state = next.pop();
  return { undo: { ...undo, snapshots: next }, state };
}

export function lockUndo(undo: UndoStack): UndoStack {
  return { snapshots: [], locked: true };
}
