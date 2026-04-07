import type { EventLogEntry, MutationAction } from '../core/atomicActions';
import { uid } from '../utils';

export function appendEvent(
  entries: EventLogEntry[],
  playerActionIndex: number,
  atomicAction: MutationAction,
): EventLogEntry[] {
  return entries.concat({
    id: uid(),
    playerActionIndex,
    atomicAction,
    timestamp: Date.now(),
  });
}
