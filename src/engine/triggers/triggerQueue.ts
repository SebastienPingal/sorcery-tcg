export interface TriggerItem {
  triggerType: string;
  sourceId: string;
  targetId?: string;
}

export interface TriggerQueueState {
  queue: TriggerItem[];
  seenKeys: Set<string>;
}

export function createTriggerQueue(): TriggerQueueState {
  return { queue: [], seenKeys: new Set<string>() };
}

export function enqueueTrigger(state: TriggerQueueState, item: TriggerItem): TriggerQueueState {
  const key = `${item.sourceId}|${item.triggerType}|${item.targetId ?? ''}`;
  if (state.seenKeys.has(key)) return state;
  const nextSeen = new Set(state.seenKeys);
  nextSeen.add(key);
  return { queue: [...state.queue, item], seenKeys: nextSeen };
}

export function dequeueTrigger(state: TriggerQueueState): { next: TriggerQueueState; item?: TriggerItem } {
  if (state.queue.length === 0) return { next: state };
  const [item, ...rest] = state.queue;
  return { next: { ...state, queue: rest }, item };
}
