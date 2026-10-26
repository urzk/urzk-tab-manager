import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { subscribeEvents } from "../../src/lib/chrome/events";
import {
  emptyState,
  toTabLite,
  toWindowLite,
  type State,
} from "../../src/lib/state/model";
import { applyEvent } from "../../src/lib/state/reducer";
import {
  createFakeChrome,
  type FakeChrome,
  type FakeSeed,
} from "../../src/mock/fake-chrome";

// ---- normalisation --------------------------------------------------------

type NormTab = {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  discarded: boolean;
  active: boolean;
};
type NormWindow = { windowId: number; focused: boolean; tabs: NormTab[] };

const pick = (t: {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  discarded: boolean;
  active: boolean;
}): NormTab => ({
  id: t.id,
  windowId: t.windowId,
  title: t.title,
  url: t.url,
  pinned: t.pinned,
  discarded: t.discarded,
  active: t.active,
});

function normalizeState(s: State): NormWindow[] {
  return s.windowOrder.map((windowId) => ({
    windowId,
    focused: s.windows.get(windowId)?.focused ?? false,
    tabs: (s.tabIdsByWindow.get(windowId) ?? []).map((id) => {
      const t = s.tabs.get(id);
      if (!t) throw new Error(`tab ${id} listed but missing`);
      return pick(t);
    }),
  }));
}

// Truth tabs go through toTabLite so both sides share the title/url fallback.
function normalizeTruth(wins: chrome.windows.Window[]): NormWindow[] {
  return wins.map((w) => ({
    windowId: w.id!,
    focused: !!w.focused,
    tabs: (w.tabs ?? []).map((t) => pick(toTabLite(t))),
  }));
}

/** Local stand-in for Task 7's `fromSnapshot`: folds getAll output as events. */
function stateFromGetAll(wins: chrome.windows.Window[]): State {
  let s = emptyState;
  for (const w of wins) {
    s = applyEvent(s, { type: "windowCreated", window: toWindowLite(w) });
    const tabs = [...(w.tabs ?? [])].sort((a, b) => a.index - b.index);
    for (const t of tabs) {
      s = applyEvent(s, {
        type: "tabCreated",
        tab: toTabLite(t),
        index: t.index,
      });
    }
    for (const t of tabs) {
      if (t.active)
        s = applyEvent(s, {
          type: "tabActivated",
          tabId: t.id!,
          windowId: w.id!,
        });
    }
  }
  return s;
}

// ---- operations -----------------------------------------------------------

type Op =
  | { op: "createTab"; w: number }
  | { op: "removeTab"; i: number }
  | { op: "moveWithin"; i: number; to: number }
  | { op: "moveToOtherWindow"; i: number; w: number; to: number }
  | { op: "popOut"; i: number }
  | { op: "setTitle"; i: number; title: string }
  | { op: "discard"; i: number }
  | { op: "activate"; i: number }
  | { op: "focusWindow"; w: number }
  | { op: "pinToggle"; i: number }
  | { op: "createWindow" };

const nat = fc.nat({ max: 1000 });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constant("createTab" as const), w: nat }),
  fc.record({ op: fc.constant("removeTab" as const), i: nat }),
  fc.record({
    op: fc.constant("moveWithin" as const),
    i: nat,
    to: fc.integer({ min: -1, max: 12 }),
  }),
  fc.record({
    op: fc.constant("moveToOtherWindow" as const),
    i: nat,
    w: nat,
    to: fc.integer({ min: -1, max: 12 }),
  }),
  fc.record({ op: fc.constant("popOut" as const), i: nat }),
  fc.record({
    op: fc.constant("setTitle" as const),
    i: nat,
    title: fc.string({ maxLength: 6 }),
  }),
  fc.record({ op: fc.constant("discard" as const), i: nat }),
  fc.record({ op: fc.constant("activate" as const), i: nat }),
  fc.record({ op: fc.constant("focusWindow" as const), w: nat }),
  fc.record({ op: fc.constant("pinToggle" as const), i: nat }),
  fc.record({ op: fc.constant("createWindow" as const) }),
);

const seedTabArb = fc.record({
  title: fc.string({ maxLength: 4 }),
  url: fc.constantFrom("https://a.test/", "https://b.test/", ""),
  pinned: fc.boolean(),
  discarded: fc.boolean(),
});

const seedArb: fc.Arbitrary<FakeSeed> = fc.record({
  windows: fc.array(
    fc
      .array(seedTabArb, { minLength: 1, maxLength: 8 })
      // the fake requires pinned tabs to form a prefix
      .map((tabs) => ({
        tabs: [
          ...tabs.filter((t) => t.pinned),
          ...tabs.filter((t) => !t.pinned),
        ],
      })),
    { minLength: 1, maxLength: 3 },
  ),
  replaceOnDiscard: fc.boolean(),
});

/** Runs one op against the fake, resolving indices against the current truth. */
function run(f: FakeChrome, o: Op): Promise<unknown> | void {
  const wins = f.truth();
  const tabs = wins.flatMap((w) => w.tabs ?? []);
  const tabAt = (i: number) =>
    tabs.length ? tabs[i % tabs.length] : undefined;
  const winAt = (i: number) =>
    wins.length ? wins[i % wins.length] : undefined;
  switch (o.op) {
    case "createTab": {
      const w = winAt(o.w);
      return f.tabs.create(w ? { windowId: w.id } : {});
    }
    case "createWindow":
      return f.windows.create({});
    case "focusWindow": {
      const w = winAt(o.w);
      return w && f.windows.update(w.id!, { focused: true });
    }
  }
  const t = tabAt(o.i);
  if (!t) return;
  switch (o.op) {
    case "removeTab":
      return f.tabs.remove(t.id!);
    case "moveWithin":
      return f.tabs.move(t.id!, { index: o.to });
    case "moveToOtherWindow": {
      const others = wins.filter((w) => w.id !== t.windowId);
      if (others.length === 0) return;
      const w = others[o.w % others.length];
      return f.tabs.move(t.id!, { index: o.to, windowId: w.id });
    }
    case "popOut":
      return f.windows.create({ tabId: t.id! });
    case "setTitle":
      f.setTitle(t.id!, o.title); // synchronous; throws if the tab is gone
      return Promise.resolve();
    case "discard":
      return f.tabs.discard(t.id!);
    case "activate":
      return f.tabs.update(t.id!, { active: true });
    case "pinToggle":
      return f.tabs.update(t.id!, { pinned: !t.pinned });
  }
}

// ---- property -------------------------------------------------------------

/** Op outcomes across all runs, so the property cannot silently go vacuous. */
const outcomes = { executed: 0, rejected: 0, skipped: 0 };

describe("reducer tracks the fake chrome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("folded state equals the fake's truth after every op", async () => {
    await fc.assert(
      fc.asyncProperty(
        seedArb,
        fc.array(opArb, { minLength: 1, maxLength: 60 }),
        async (seed, ops) => {
          const errors = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
          const f = createFakeChrome(seed);
          // manual delivery: every op's events are flushed synchronously after it
          f.deliver = "manual";
          let state: State = emptyState;
          // subscribe before the snapshot; nothing is pending yet
          const unsubscribe = subscribeEvents(f, (e) => {
            state = applyEvent(state, e);
          });
          try {
            state = stateFromGetAll(await f.windows.getAll({ populate: true }));
            expect(normalizeState(state)).toEqual(normalizeTruth(f.truth()));
            for (const o of ops) {
              try {
                const p = run(f, o);
                if (p === undefined) outcomes.skipped++;
                else {
                  await p;
                  outcomes.executed++;
                }
              } catch {
                // the fake rejected the op (pin zone, missing window, ...): ignored
                outcomes.rejected++;
              }
              f.flush();
              expect(normalizeState(state)).toEqual(normalizeTruth(f.truth()));
            }
            expect(errors).not.toHaveBeenCalled();
          } finally {
            unsubscribe();
            errors.mockRestore();
          }
        },
      ),
      { numRuns: 300 },
    );
    const total = outcomes.executed + outcomes.rejected + outcomes.skipped;
    // observed locally: ~91% executed, ~6% rejected, ~3% skipped
    expect(
      outcomes.executed / total,
      `op outcomes ${JSON.stringify(outcomes)}`,
    ).toBeGreaterThanOrEqual(0.6);
  });

  test("unsubscribe removes every listener", async () => {
    const f = createFakeChrome({
      windows: [
        {
          tabs: [
            { title: "a", url: "" },
            { title: "b", url: "" },
          ],
        },
      ],
      replaceOnDiscard: true,
    });
    f.deliver = "manual";
    let count = 0;
    const unsubscribe = subscribeEvents(f, () => count++);
    unsubscribe();
    const w = f.truth()[0];
    const [a, b] = w.tabs!;
    await f.tabs.discard(b.id!); // onReplaced
    f.setTitle(a.id!, "renamed"); // onUpdated
    await f.tabs.create({ windowId: w.id }); // onCreated, onActivated
    await f.tabs.update(a.id!, { pinned: true }); // onUpdated (+ onMoved if needed)
    await f.tabs.move(a.id!, { index: 0 });
    await f.windows.update(w.id!, { focused: true });
    await f.windows.create({ tabId: a.id! }); // detach/attach/window created/focus
    await f.windows.create({}); // window created, tab created, focus
    await f.tabs.remove(a.id!); // onRemoved, window removed, focus
    f.flush();
    expect(count).toBe(0);
  });
});
