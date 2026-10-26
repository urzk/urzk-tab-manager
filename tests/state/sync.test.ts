import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Listener } from "../../src/lib/chrome/api";
import { toTabLite, type State } from "../../src/lib/state/model";
import { createTabSync, type TabSync } from "../../src/lib/state/sync";
import {
  createFakeChrome,
  type FakeChrome,
  type FakeSeed,
} from "../../src/mock/fake-chrome";

// ---- helpers ----------------------------------------------------------------

const tab = (n: string) => ({ title: n, url: `https://${n}.test/` });
const seed = (extra: Partial<FakeSeed> = {}): FakeSeed => ({
  windows: [{ tabs: [tab("a"), tab("b"), tab("c")] }, { tabs: [tab("d")] }],
  ...extra,
});

/** Lets pending microtasks (fake delivery, getAll, frames) run under fake timers. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

type Norm = { windowId: number; tabs: { id: number; title: string }[] }[];
const norm = (s: State): Norm =>
  s.windowOrder.map((windowId) => ({
    windowId,
    tabs: (s.tabIdsByWindow.get(windowId) ?? []).map((id) => ({
      id,
      title: s.tabs.get(id)!.title,
    })),
  }));
const normTruth = (f: FakeChrome): Norm =>
  f.truth().map((w) => ({
    windowId: w.id!,
    tabs: w.tabs!.map((t) => ({ id: t.id!, title: toTabLite(t).title })),
  }));
const tabId = (f: FakeChrome, w: number, i: number) =>
  f.truth()[w].tabs![i].id!;

function allListeners(f: FakeChrome): Listener<never[]>[] {
  const { windows: w, tabs: t } = f;
  return [
    w.onCreated,
    w.onRemoved,
    w.onFocusChanged,
    t.onCreated,
    t.onUpdated,
    t.onMoved,
    t.onAttached,
    t.onDetached,
    t.onRemoved,
    t.onReplaced,
    t.onActivated,
  ] as unknown as Listener<never[]>[];
}

/** Counts listeners currently attached through addListener/removeListener. */
function countListeners(f: FakeChrome): () => number {
  let n = 0;
  for (const l of allListeners(f)) {
    const add = l.addListener.bind(l);
    const remove = l.removeListener.bind(l);
    l.addListener = (fn) => {
      n++;
      add(fn);
    };
    l.removeListener = (fn) => {
      n--;
      remove(fn);
    };
  }
  return () => n;
}

let errors: ReturnType<typeof vi.spyOn>;
let syncs: TabSync[] = [];

function make(f: FakeChrome, opts: Parameters<typeof createTabSync>[1] = {}) {
  const sync = createTabSync(f, {
    scheduleFrame: (cb) => queueMicrotask(cb),
    ...opts,
  });
  syncs.push(sync);
  const seen: State[] = [];
  sync.subscribe((s) => seen.push(s));
  return { sync, seen, last: () => seen[seen.length - 1] };
}

beforeEach(() => {
  vi.useFakeTimers();
  errors = vi.spyOn(console, "error");
});

afterEach(() => {
  for (const s of syncs) s.stop();
  syncs = [];
  expect(errors).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---- tests ------------------------------------------------------------------

describe("TabSync", () => {
  test("subscribe calls back immediately with the empty state", () => {
    const f = createFakeChrome(seed());
    const { seen } = make(f);
    expect(seen).toHaveLength(1);
    expect(seen[0].windowOrder).toEqual([]);
  });

  test("start produces snapshot state", async () => {
    const f = createFakeChrome(seed());
    const { sync, seen, last } = make(f);
    await sync.start();
    expect(seen).toHaveLength(2);
    expect(norm(last())).toEqual(normTruth(f));
    expect(last().currentWindowId).toBe(f.truth()[0].id);
    expect(last().managerTabId).toBeUndefined();
  });

  test("start while started is a no-op", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync } = make(f);
    await sync.start();
    await sync.start();
    expect(getAll).toHaveBeenCalledTimes(1);
  });

  test("events during startup trigger a second snapshot", async () => {
    const f = createFakeChrome(seed());
    f.deliver = "manual";
    const orig = f.windows.getAll;
    let calls = 0;
    const getAll = vi
      .spyOn(f.windows, "getAll")
      .mockImplementation(async (o) => {
        const r = await orig(o);
        if (++calls === 1) {
          // the first snapshot is now stale and its events are delivered
          f.setTitle(tabId(f, 0, 1), "changed");
          f.flush();
        }
        return r;
      });
    const { sync, last } = make(f);
    await sync.start();
    expect(getAll).toHaveBeenCalledTimes(2);
    expect(norm(last())).toEqual(normTruth(f));
    expect(last().tabs.get(tabId(f, 0, 1))!.title).toBe("changed");
  });

  test("startup gives up after 3 snapshots and relies on the debounce", async () => {
    const f = createFakeChrome(seed());
    f.deliver = "manual";
    const orig = f.windows.getAll;
    let calls = 0;
    const getAll = vi
      .spyOn(f.windows, "getAll")
      .mockImplementation(async (o) => {
        const r = await orig(o);
        calls++;
        if (calls <= 3) {
          f.setTitle(tabId(f, 0, 0), `t${calls}`);
          f.flush();
        }
        return r;
      });
    const { sync, last } = make(f);
    await sync.start();
    expect(getAll).toHaveBeenCalledTimes(3);
    expect(last().tabs.get(tabId(f, 0, 0))!.title).toBe("t2");
    await vi.advanceTimersByTimeAsync(500);
    expect(getAll).toHaveBeenCalledTimes(4);
    expect(norm(last())).toEqual(normTruth(f));
  });

  test("batches several events into one notification per frame", async () => {
    const f = createFakeChrome(seed());
    const { sync, seen, last } = make(f);
    await sync.start();
    const before = seen.length;
    f.setTitle(tabId(f, 0, 0), "x");
    f.setTitle(tabId(f, 0, 1), "y");
    await f.tabs.move(tabId(f, 0, 2), { index: 0 });
    await settle();
    expect(seen.length).toBe(before + 1);
    expect(norm(last())).toEqual(normTruth(f));
  });

  test("does not notify when a frame finds the state unchanged", async () => {
    const f = createFakeChrome(seed());
    const { sync, seen } = make(f);
    await sync.start();
    const before = seen.length;
    await sync.reconcileNow(); // no mismatch: identity kept
    await settle();
    expect(seen.length).toBe(before);
  });

  test("reconciles 500ms after the last event", async () => {
    const f = createFakeChrome(seed());
    const onMismatch = vi.fn();
    const { sync, last } = make(f, { onMismatch });
    await sync.start();
    const a = tabId(f, 0, 0);
    f.dropNextEvents(1);
    f.setTitle(a, "lost"); // dropped
    f.setTitle(tabId(f, 0, 1), "seen"); // delivered, starts the debounce
    await settle();
    expect(last().tabs.get(a)!.title).toBe("a");
    await vi.advanceTimersByTimeAsync(499);
    expect(last().tabs.get(a)!.title).toBe("a");
    expect(onMismatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(last().tabs.get(a)!.title).toBe("lost");
    expect(norm(last())).toEqual(normTruth(f));
    expect(onMismatch).toHaveBeenCalledWith(1);
  });

  test("each event restarts the debounce", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync } = make(f);
    await sync.start();
    f.setTitle(tabId(f, 0, 0), "1");
    await vi.advanceTimersByTimeAsync(400);
    f.setTitle(tabId(f, 0, 0), "2");
    await vi.advanceTimersByTimeAsync(400);
    expect(getAll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  test("windowFocusChanged triggers the debounce", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync } = make(f);
    await sync.start();
    await f.windows.update(f.truth()[1].id!, { focused: true });
    await vi.advanceTimersByTimeAsync(500);
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  test("reconciles every 30s while visible", async () => {
    const f = createFakeChrome(seed());
    const { sync, last } = make(f);
    await sync.start();
    const a = tabId(f, 0, 0);
    f.dropNextEvents(1);
    f.setTitle(a, "lost"); // no event arrives, so no debounce
    await vi.advanceTimersByTimeAsync(29_999);
    expect(last().tabs.get(a)!.title).toBe("a");
    await vi.advanceTimersByTimeAsync(1);
    expect(last().tabs.get(a)!.title).toBe("lost");
  });

  test("does nothing while hidden", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const listeners = countListeners(f);
    const { sync, seen } = make(f);
    await sync.start();
    expect(listeners()).toBe(11);
    sync.setVisible(false);
    expect(listeners()).toBe(0);
    const before = seen.length;
    f.setTitle(tabId(f, 0, 0), "hidden");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(seen.length).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("resyncs when becoming visible", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync, last } = make(f);
    await sync.start();
    sync.setVisible(false);
    f.setTitle(tabId(f, 0, 0), "hidden");
    await f.tabs.remove(tabId(f, 0, 2));
    await settle();
    sync.setVisible(true);
    await settle();
    expect(getAll).toHaveBeenCalledTimes(2);
    expect(norm(last())).toEqual(normTruth(f));
    // live again
    f.setTitle(tabId(f, 0, 1), "live");
    await settle();
    expect(norm(last())).toEqual(normTruth(f));
  });

  test("setVisible(true) while visible does not resync", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync } = make(f);
    await sync.start();
    sync.setVisible(true);
    await settle();
    expect(getAll).toHaveBeenCalledTimes(1);
  });

  test("follows manager tab when it is detached to another window", async () => {
    const f = createFakeChrome(seed());
    const [A, B] = f.truth().map((w) => w.id!);
    const manager = f.truth()[0].tabs![1];
    vi.spyOn(f.tabs, "getCurrent").mockResolvedValue(manager);
    const { sync, last } = make(f);
    await sync.start();
    expect(last().managerTabId).toBe(manager.id);
    expect(last().currentWindowId).toBe(A);
    await f.tabs.move(manager.id!, { windowId: B, index: -1 });
    await settle();
    expect(last().currentWindowId).toBe(B);
    expect(norm(last())).toEqual(normTruth(f));
  });

  test("tabReplaced fetches the new tab and applies it", async () => {
    const f = createFakeChrome(seed({ replaceOnDiscard: true }));
    // swallow the sync's onUpdated listener so only onReplaced carries news
    vi.spyOn(f.tabs.onUpdated, "addListener").mockImplementation(() => {});
    const get = vi.spyOn(f.tabs, "get");
    const { sync, last } = make(f);
    await sync.start();
    const old = tabId(f, 0, 1);
    await f.tabs.discard(old);
    const added = tabId(f, 0, 1);
    expect(added).not.toBe(old);
    await settle();
    expect(get).toHaveBeenCalledWith(added);
    expect(last().tabs.has(old)).toBe(false);
    expect(last().tabs.get(added)!.discarded).toBe(true);
  });

  test("tabReplaced ignores a failing tabs.get and still debounces", async () => {
    const f = createFakeChrome(seed({ replaceOnDiscard: true }));
    vi.spyOn(f.tabs, "get").mockRejectedValue(new Error("No tab"));
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync, last } = make(f);
    await sync.start();
    await f.tabs.discard(tabId(f, 0, 1));
    await settle();
    expect(norm(last())).toEqual(normTruth(f));
    await vi.advanceTimersByTimeAsync(500);
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  test("overlapping reconcileNow calls coalesce", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const { sync } = make(f);
    await sync.start();
    getAll.mockClear();
    const p = [sync.reconcileNow(), sync.reconcileNow(), sync.reconcileNow()];
    await Promise.all(p);
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  test("events during an in-flight reconcile restart the debounce", async () => {
    const f = createFakeChrome(seed());
    f.deliver = "manual";
    const { sync, last } = make(f);
    await sync.start();
    const orig = f.windows.getAll;
    const getAll = vi
      .spyOn(f.windows, "getAll")
      .mockImplementationOnce(async (o) => {
        const r = await orig(o); // snapshot taken before the change below
        f.setTitle(tabId(f, 0, 0), "late");
        f.flush();
        // the snapshot stays in flight for a while after the event
        await new Promise((res) => setTimeout(res, 300));
        return r;
      });
    const p = sync.reconcileNow();
    await vi.advanceTimersByTimeAsync(300);
    await p;
    // the stale snapshot won, but another reconcile is on its way
    expect(last().tabs.get(tabId(f, 0, 0))!.title).toBe("a");
    // the debounce counts from the end of the reconcile, not from the event
    await vi.advanceTimersByTimeAsync(499);
    expect(getAll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(getAll).toHaveBeenCalledTimes(2);
    expect(last().tabs.get(tabId(f, 0, 0))!.title).toBe("late");
  });

  test("getAll errors keep the current state", async () => {
    const f = createFakeChrome(seed());
    const { sync, seen, last } = make(f);
    await sync.start();
    const before = last();
    const n = seen.length;
    vi.spyOn(f.windows, "getAll").mockRejectedValueOnce(new Error("boom"));
    await sync.reconcileNow();
    await settle();
    expect(last()).toBe(before);
    expect(seen.length).toBe(n);
  });

  test("stop removes all listeners", async () => {
    const f = createFakeChrome(seed());
    const getAll = vi.spyOn(f.windows, "getAll");
    const listeners = countListeners(f);
    const { sync, seen } = make(f);
    await sync.start();
    f.setTitle(tabId(f, 0, 0), "x"); // pending debounce
    await settle();
    expect(listeners()).toBe(11);
    sync.stop();
    expect(listeners()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const n = seen.length;
    f.setTitle(tabId(f, 0, 0), "y");
    sync.setVisible(false);
    sync.setVisible(true);
    await sync.start();
    await sync.reconcileNow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen.length).toBe(n);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(listeners()).toBe(0);
  });

  test("a boot snapshot failing after stop() does not revive the sync", async () => {
    const f = createFakeChrome(seed());
    let fail!: (e: Error) => void;
    const getAll = vi.spyOn(f.windows, "getAll").mockImplementationOnce(
      () =>
        new Promise((_, rej) => {
          fail = rej;
        }),
    );
    const { sync, seen } = make(f);
    const started = sync.start();
    sync.stop();
    fail(new Error("boom"));
    await started;
    await settle();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });

  test("a boot snapshot failing after a hide still resyncs on show", async () => {
    const f = createFakeChrome(seed());
    let fail!: (e: Error) => void;
    vi.spyOn(f.windows, "getAll").mockImplementationOnce(
      () =>
        new Promise((_, rej) => {
          fail = rej;
        }),
    );
    const listeners = countListeners(f);
    const { sync, last } = make(f);
    const started = sync.start();
    sync.setVisible(false);
    fail(new Error("boom"));
    await started;
    await settle();
    expect(vi.getTimerCount()).toBe(0);
    sync.setVisible(true);
    await settle();
    expect(listeners()).toBe(11);
    f.setTitle(tabId(f, 0, 0), "live");
    await settle();
    expect(last().tabs.get(tabId(f, 0, 0))!.title).toBe("live");
  });

  test("currentWindowId follows the manager tab across reconciles (R11)", async () => {
    const f = createFakeChrome(seed());
    const [, B] = f.truth().map((w) => w.id!);
    const managerId = tabId(f, 0, 1);
    vi.spyOn(f.tabs, "getCurrent").mockImplementation(async () =>
      f.tabs.get(managerId),
    );
    const onMismatch = vi.fn();
    const { sync, last } = make(f, { onMismatch });
    await sync.start();
    await f.tabs.move(managerId, { windowId: B, index: -1 });
    await settle();
    expect(last().currentWindowId).toBe(B);
    await vi.advanceTimersByTimeAsync(500);
    expect(last().currentWindowId).toBe(B);
    expect(onMismatch).not.toHaveBeenCalled();
  });
});
