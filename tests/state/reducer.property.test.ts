import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { subscribeEvents } from "../../src/lib/chrome/events";
import { emptyState, toTabLite, type State } from "../../src/lib/state/model";
import { applyEvent } from "../../src/lib/state/reducer";
import { fromSnapshot, reconcile } from "../../src/lib/state/reconcile";
import {
  createFakeChrome,
  type FakeChrome,
  type FakeSeed,
} from "../../src/mock/fake-chrome";

// 300 runs of up to 60 ops each; the default 5s is too tight on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

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
type DropOp = { op: "drop"; k: number };

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

const dropArb: fc.Arbitrary<DropOp> = fc.record({
  op: fc.constant("drop" as const),
  k: fc.integer({ min: 1, max: 3 }),
});

// fast-check's default size averages ~6 ops; "max" makes lengths span 1..60
const opsArb = fc.array(opArb, { minLength: 1, maxLength: 60, size: "max" });
const opsWithDropsArb = fc.array(fc.oneof(opArb, dropArb), {
  minLength: 1,
  maxLength: 60,
  size: "max",
});

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
      fc.asyncProperty(seedArb, opsArb, async (seed, ops) => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const f = createFakeChrome(seed);
        // manual delivery: every op's events are flushed synchronously after it
        f.deliver = "manual";
        let state: State = emptyState;
        // subscribe before the snapshot; nothing is pending yet
        const unsubscribe = subscribeEvents(f, (e) => {
          state = applyEvent(state, e);
        });
        try {
          state = fromSnapshot(
            await f.windows.getAll({ populate: true }),
            undefined,
            undefined,
          );
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
      }),
      { numRuns: 300 },
    );
    const total = outcomes.executed + outcomes.rejected + outcomes.skipped;
    // observed locally: ~91% executed, ~6% rejected, ~3% skipped
    expect(
      outcomes.executed / total,
      `op outcomes ${JSON.stringify(outcomes)}`,
    ).toBeGreaterThanOrEqual(0.6);
  });

  test("reconcile converges after dropped events", async () => {
    const lengths: number[] = [];
    let diverged = 0;
    await fc.assert(
      fc.asyncProperty(seedArb, opsWithDropsArb, async (seed, ops) => {
        lengths.push(ops.length);
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const f = createFakeChrome(seed);
        f.deliver = "manual";
        let state: State = emptyState;
        const unsubscribe = subscribeEvents(f, (e) => {
          state = applyEvent(state, e);
        });
        try {
          state = fromSnapshot(
            await f.windows.getAll({ populate: true }),
            undefined,
            undefined,
          );
          for (const o of ops) {
            if (o.op === "drop") {
              f.dropNextEvents(o.k);
              continue;
            }
            try {
              const p = run(f, o);
              if (p !== undefined) await p;
            } catch {
              // rejected by the fake: ignored
            }
            f.flush();
          }
          // state may be arbitrarily wrong here; only the reconciled state counts
          // the fake throws once the current window has been closed
          const currentWindowId = await f.windows
            .getCurrent()
            .then((w) => w.id)
            .catch(() => undefined);
          const snap = fromSnapshot(
            await f.windows.getAll({ populate: true }),
            currentWindowId,
            undefined,
          );
          const r = reconcile(state, snap);
          if (r.mismatches > 0) diverged++;
          expect(normalizeState(r.state)).toEqual(normalizeTruth(f.truth()));
          const again = reconcile(r.state, snap);
          expect(again.mismatches).toBe(0);
          expect(again.state).toBe(r.state);
          expect(errors).not.toHaveBeenCalled();
        } finally {
          unsubscribe();
          errors.mockRestore();
        }
      }),
      { numRuns: 300 },
    );
    // dropped events must actually leave the reducer state wrong in some runs
    expect(diverged).toBeGreaterThan(0);
    expect(Math.min(...lengths)).toBeLessThanOrEqual(5);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(50);
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
