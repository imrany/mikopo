// NOTE: localStorage is shared across ALL tabs on this origin.
// Two tabs will read/write the same stack and can stomp on each
// other's "previous page". Swap `window.localStorage` to
// `window.sessionStorage` below if you want per-tab isolation.
const storage = typeof window !== "undefined" ? window.sessionStorage : undefined;

const STORAGE_KEY = "app-history-stack";
const MAX_ENTRIES = 50;

type HistoryStack = string[];

function readStack(): HistoryStack {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStack(stack: HistoryStack) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_ENTRIES)));
  } catch {
    // storage full / unavailable (private mode) — fail silently
  }
}

/** Record a visited path. Called on every route change. */
export function pushPath(path: string) {
  const stack = readStack();
  if (stack[stack.length - 1] === path) return; // avoid dupes
  stack.push(path);
  writeStack(stack);
}

/**
 * Pop the current page off the stack and return the new top
 * (the page to navigate back to), or undefined if there's none.
 */
export function popPath(): string | undefined {
  const stack = readStack();
  stack.pop(); // remove current page
  const previous = stack[stack.length - 1];
  writeStack(stack);
  return previous;
}

/** Wipe the stack — call on logout. */
export function clearHistory() {
  writeStack([]);
}
