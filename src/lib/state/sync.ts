import type { ChromeApi } from "../chrome/api";
import { subscribeEvents } from "../chrome/events";
import { emptyState, toTabLite, type ChromeEvent, type State } from "./model";
import { applyEvent } from "./reducer";
import { fromSnapshot, reconcile } from "./reconcile";

export type SyncOptions = {
  scheduleFrame?: (cb: () => void) => void; // default requestAnimationFrame
  debounceMs?: number; // default 500
  intervalMs?: number; // default 30_000
  onMismatch?: (n: number) => void; // dev diagnostics
};
export type TabSync = {
  subscribe(fn: (s: State) => void): () => void; // called immediately with current state
  start(): Promise<void>; // subscribe events → queue → snapshot → if queue non-empty, snapshot again
  setVisible(v: boolean): void; // false: unsubscribe events + stop timers; true: start() again
  reconcileNow(): Promise<void>;
  stop(): void;
};

/** Startup snapshots taken at most while events keep arriving. */
const MAX_STARTUP_SNAPSHOTS = 3;

const defaultFrame = (cb: () => void): void => {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => cb());
  else setTimeout(cb, 16);
};

/**
 * Keeps a State in step with Chrome: folds live events into it, notifies
 * subscribers at most once per frame, and reconciles against `getAll`
 * `debounceMs` after the last event, every `intervalMs` while visible, and on
 * becoming visible. Dormant (no listeners, no timers) while hidden.
 */
export function createTabSync(api: ChromeApi, opts: SyncOptions = {}): TabSync {
  const scheduleFrame = opts.scheduleFrame ?? defaultFrame;
  const debounceMs = opts.debounceMs ?? 500;
  const intervalMs = opts.intervalMs ?? 30_000;

  // idle: never started; starting: snapshotting with events queued;
  // live: applying events; dormant: hidden; stopped: terminal
  let mode: "idle" | "starting" | "live" | "dormant" | "stopped" = "idle";
  let visible = true;
  let state: State = emptyState;
  let notified: State = state;
  const subscribers = new Set<(s: State) => void>();
  let unsubscribeEvents: (() => void) | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let framePending = false;
  // bumped whenever a run is abandoned (dormant/stop); stale async work checks it
  let generation = 0;
  // counts every event received, live or queued
  let eventSeq = 0;
  let booting: Promise<void> | undefined;
  let inFlight: Promise<void> | undefined;
  let queued: Promise<void> | undefined;

  async function snapshot(): Promise<State> {
    const [windows, current, managerTab] = await Promise.all([
      api.windows.getAll({ populate: true }),
      api.windows.getCurrent().catch(() => undefined),
      api.tabs.getCurrent().catch(() => undefined),
    ]);
    // R11: the manager tab's window is authoritative; it follows detaches
    return fromSnapshot(
      windows,
      managerTab?.windowId ?? current?.id,
      managerTab?.id,
    );
  }

  function notify() {
    if (state === notified) return;
    notified = state;
    for (const fn of [...subscribers]) fn(state);
  }

  function scheduleNotify() {
    if (framePending) return;
    framePending = true;
    scheduleFrame(() => {
      framePending = false;
      if (mode !== "stopped") notify();
    });
  }

  function restartDebounce() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void reconcileNow();
    }, debounceMs);
  }

  function clearTimers() {
    clearTimeout(debounceTimer);
    clearInterval(intervalTimer);
    debounceTimer = intervalTimer = undefined;
  }

  /** Detaches from Chrome and cancels pending async work; keeps state. */
  function halt() {
    generation++;
    unsubscribeEvents?.();
    unsubscribeEvents = undefined;
    clearTimers();
    booting = undefined;
  }

  function onEvent(e: ChromeEvent) {
    eventSeq++;
    if (mode !== "live") return; // starting: the next snapshot covers it
    state = applyEvent(state, e);
    if (e.type === "tabReplaced") {
      // onReplaced carries no tab state; fetch it (ruling R9)
      const gen = generation;
      api.tabs.get(e.addedTabId).then(
        (tab) => {
          if (gen !== generation) return;
          state = applyEvent(state, {
            type: "tabUpdated",
            tab: toTabLite(tab),
          });
          scheduleNotify();
        },
        () => {},
      );
    }
    scheduleNotify();
    restartDebounce();
  }

  async function boot(): Promise<void> {
    const gen = generation;
    mode = "starting";
    unsubscribeEvents = subscribeEvents(api, onEvent);
    let sawEvents = false;
    for (let i = 1; i <= MAX_STARTUP_SNAPSHOTS; i++) {
      const seq = eventSeq;
      let snap: State;
      try {
        snap = await snapshot();
      } catch {
        // halted (hidden/stopped) while in flight: the halt owns the mode
        if (gen !== generation) return;
        // Every attempt so far failed while still current: go live with the
        // state we have and let the debounce reconcile retry the snapshot.
        sawEvents = true;
        break;
      }
      if (gen !== generation) return;
      // reconcile keeps unchanged objects from the previous state (resume)
      state = reconcile(state, snap).state;
      sawEvents = eventSeq !== seq;
      // events queued during this snapshot may or may not be in it: retake
      if (!sawEvents) break;
    }
    mode = "live";
    if (sawEvents) restartDebounce();
    intervalTimer = setInterval(() => void reconcileNow(), intervalMs);
    notify();
  }

  function start(): Promise<void> {
    if (mode === "idle") {
      if (!visible) {
        mode = "dormant";
        return Promise.resolve();
      }
      booting = boot();
    }
    return booting ?? Promise.resolve();
  }

  async function runReconcile(): Promise<void> {
    if (mode !== "live") return;
    const gen = generation;
    const seq = eventSeq;
    let snap: State;
    try {
      snap = await snapshot();
    } catch {
      return; // keep the current state; the next trigger retries
    }
    if (gen !== generation || mode !== "live") return;
    const { state: next, mismatches } = reconcile(state, snap);
    state = next;
    if (mismatches > 0) opts.onMismatch?.(mismatches);
    // Race fix: events that arrived while the snapshot was in flight were
    // already folded into `state`, but they may or may not be reflected in the
    // snapshot, so neither "replay them on top" nor "trust the snapshot" is
    // safe. Take the snapshot and schedule another reconcile, which sees them.
    if (eventSeq !== seq) restartDebounce();
    scheduleNotify();
  }

  function reconcileNow(): Promise<void> {
    if (!inFlight) {
      inFlight = runReconcile().finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    }
    queued ??= inFlight.then(() => {
      queued = undefined;
      return reconcileNow();
    });
    return queued;
  }

  return {
    subscribe(fn) {
      if (mode === "stopped") return () => {};
      subscribers.add(fn);
      fn(state);
      return () => {
        subscribers.delete(fn);
      };
    },
    start,
    setVisible(v) {
      if (mode === "stopped") return;
      visible = v;
      if (!v && (mode === "starting" || mode === "live")) {
        halt();
        mode = "dormant";
      } else if (v && mode === "dormant") {
        booting = boot();
      }
    },
    reconcileNow() {
      return mode === "stopped" ? Promise.resolve() : reconcileNow();
    },
    stop() {
      if (mode === "stopped") return;
      halt();
      mode = "stopped";
      subscribers.clear();
    },
  };
}
