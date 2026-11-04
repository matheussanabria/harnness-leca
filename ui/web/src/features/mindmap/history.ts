// Immutable undo/redo stack over document snapshots (structural sharing keeps snapshots cheap).
export const HISTORY_CAP = 200;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Records `next` as the new present; identical references are ignored. */
export function push<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  const past = [...history.past, history.present].slice(-HISTORY_CAP);
  return { past, present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_CAP), present: next, future: rest };
}
