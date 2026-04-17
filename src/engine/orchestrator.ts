import type { GameState } from './core/gameState';
import type { EventLogEntry, MutationAction, PlayerAction } from './core/atomicActions';
import { INFORMATION_REVEALING_ACTIONS } from './core/atomicActions';
import { runChecks, GameError } from './core/checks';
import { applyAtomicAction } from './core/applyAtomicAction';
import { decomposePlayerAction } from './composite/resolvePlayerAction';
import { appendEvent } from './log/eventLog';
import { createUndoStack, lockUndo, pushUndo, type UndoStack } from './undo/undoStack';
import { createTriggerQueue, dequeueTrigger, type TriggerQueueState } from './triggers/triggerQueue';

export interface EngineRuntime {
  eventLog: EventLogEntry[];
  undo: UndoStack;
  triggerQueue: TriggerQueueState;
  actionIndex: number;
}

function ensureRuntime(state: GameState): EngineRuntime {
  const holder = state as GameState & { __engineRuntime?: EngineRuntime };
  if (!holder.__engineRuntime) {
    holder.__engineRuntime = {
      eventLog: [],
      undo: createUndoStack(),
      triggerQueue: createTriggerQueue(),
      actionIndex: 0,
    };
  }
  return holder.__engineRuntime;
}

export function getEventLog(state: GameState): EventLogEntry[] {
  return ensureRuntime(state).eventLog;
}

export function dispatchPlayerAction(state: GameState, playerAction: PlayerAction): string | null {
  const runtime = ensureRuntime(state);

  if (state.pendingInteraction) {
    const pendingType = state.pendingInteraction.type;
    if (pendingType === 'choose_draw' && playerAction.type !== 'CHOOSE_DRAW') {
      return 'Must resolve draw choice first';
    }
    if (pendingType === 'mulligan' && playerAction.type !== 'MULLIGAN') {
      return 'Must resolve mulligan first';
    }
    if (pendingType === 'select_target' && playerAction.type !== 'CHOOSE_TARGET') {
      return 'Must resolve target selection first';
    }
    if (pendingType === 'select_square') {
      return 'Square selection interaction is not implemented';
    }
  }

  const { checks, mutations } = decomposePlayerAction(state, playerAction);

  try {
    runChecks(state, checks);
  } catch (error) {
    if (error instanceof GameError) return error.message;
    return 'Action validation failed';
  }

  runtime.undo = pushUndo(runtime.undo, state);

  for (const action of mutations) {
    const error = applyAtomicAction(state, action);
    if (error) return error;
    runtime.eventLog = appendEvent(runtime.eventLog, runtime.actionIndex, action as MutationAction);
    if (INFORMATION_REVEALING_ACTIONS.has(action.type)) {
      runtime.undo = lockUndo(runtime.undo);
    }
  }

  runtime.actionIndex += 1;

  let queueState = runtime.triggerQueue;
  while (true) {
    const { next, item } = dequeueTrigger(queueState);
    queueState = next;
    if (!item) break;
  }
  runtime.triggerQueue = queueState;

  return null;
}
