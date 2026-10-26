import { describe, expect, test } from "vitest";
import type { State, TabLite, WindowLite } from "../../src/lib/state/model";
import { fromSnapshot, reconcile } from "../../src/lib/state/reconcile";

function tab(
  id: number,
  windowId: number,
  extra: Partial<TabLite> = {},
): TabLite {
  return {
    id,
    windowId,
    title: `t${id}`,
    url: `https://e.com/${id}`,
    discarded: false,
    active: false,
    pinned: false,
    ...extra,
  };
}

type MutState = {
  windowOrder: number[];
  windows: Map<number, WindowLite>;
  tabIdsByWindow: Map<number, number[]>;
  tabs: Map<number, TabLite>;
  currentWindowId?: number;
  managerTabId?: number;
};

function stateOf(wins: number[][], base = 100): MutState {
  const windows = new Map();
  const lists = new Map();
  const tabs = new Map();
  const order: number[] = [];
  wins.forEach((ids, i) => {
    const w = base + i;
    order.push(w);
    windows.set(w, { id: w, focused: i === 0 });
    lists.set(w, [...ids]);
    ids.forEach((id, j) => tabs.set(id, tab(id, w, { active: j === 0 })));
  });
  return {
    windowOrder: order,
    windows,
    tabIdsByWindow: lists,
    tabs,
    currentWindowId: base,
  };
}

const clone = (s: State): MutState => ({
  ...s,
  windowOrder: [...s.windowOrder],
  windows: new Map([...s.windows].map(([k, v]) => [k, { ...v }])),
  tabIdsByWindow: new Map([...s.tabIdsByWindow].map(([k, v]) => [k, [...v]])),
  tabs: new Map([...s.tabs].map(([k, v]) => [k, { ...v }])),
});

describe("fromSnapshot", () => {
  test("keeps window order, sorts tabs by index, stores ids", () => {
    const s = fromSnapshot(
      [
        {
          id: 5,
          focused: true,
          state: "normal",
          tabs: [
            { id: 2, index: 1, windowId: 5, url: "u2" },
            { id: 1, index: 0, windowId: 5, url: "u1" },
          ],
        },
        { id: 3, focused: false },
      ] as chrome.windows.Window[],
      5,
      2,
    );
    expect(s.windowOrder).toEqual([5, 3]);
    expect(s.tabIdsByWindow.get(5)).toEqual([1, 2]);
    expect(s.tabIdsByWindow.get(3)).toEqual([]);
    expect(s.windows.get(5)).toEqual({ id: 5, focused: true, state: "normal" });
    expect(s.tabs.get(1)?.url).toBe("u1");
    expect(s.currentWindowId).toBe(5);
    expect(s.managerTabId).toBe(2);
  });
});

describe("reconcile", () => {
  test("returns local unchanged when equal", () => {
    const local = stateOf([[1, 2], [3]]);
    const r = reconcile(local, clone(local));
    expect(r.mismatches).toBe(0);
    expect(r.state).toBe(local);
  });

  test("fixes tab order and counts 1 mismatch", () => {
    const local = stateOf([[1, 2, 3]]);
    const snap = clone(local);
    snap.tabIdsByWindow.set(100, [3, 1, 2]);
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state.tabIdsByWindow.get(100)).toEqual([3, 1, 2]);
    expect(r.state.tabs.get(1)).toBe(local.tabs.get(1));
  });

  test("adds missing and removes extra windows", () => {
    const local = stateOf([[1], [2]]);
    const snap = stateOf([[2], [9]], 101);
    snap.tabs.set(2, local.tabs.get(2)!);
    const r = reconcile(local, snap);
    expect(r.mismatches).toBeGreaterThan(0);
    expect(r.state.windowOrder).toEqual([101, 102]);
    expect(r.state.windows.has(100)).toBe(false);
    expect(r.state.tabs.has(1)).toBe(false);
    expect(r.state.tabs.has(9)).toBe(true);
    expect(r.state.tabIdsByWindow.get(101)).toBe(local.tabIdsByWindow.get(101));
  });

  test("reuses identical TabLite objects", () => {
    const local = stateOf([[1, 2]]);
    const snap = clone(local);
    snap.windows.set(100, { id: 100, focused: false });
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state.windows.get(100)?.focused).toBe(false);
    for (const id of [1, 2]) {
      expect(r.state.tabs.get(id)).toBe(local.tabs.get(id));
    }
    expect(r.state.tabIdsByWindow.get(100)).toBe(local.tabIdsByWindow.get(100));
    expect(r.state.windowOrder).toBe(local.windowOrder);
  });

  test("updates changed title only", () => {
    const local = stateOf([[1, 2]]);
    const snap = clone(local);
    snap.tabs.set(2, { ...snap.tabs.get(2)!, title: "new" });
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state.tabs.get(2)?.title).toBe("new");
    expect(r.state.tabs.get(1)).toBe(local.tabs.get(1));
    expect(r.state.tabIdsByWindow.get(100)).toBe(local.tabIdsByWindow.get(100));
  });

  test("compares favIconUrl and status", () => {
    const local = stateOf([[1]]);
    const snap = clone(local);
    snap.tabs.set(1, {
      ...snap.tabs.get(1)!,
      favIconUrl: "f",
      status: "loading",
    });
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state.tabs.get(1)).toEqual(snap.tabs.get(1));
  });

  test("takes currentWindowId and managerTabId from the snapshot", () => {
    const local = { ...stateOf([[1]]), managerTabId: 1 };
    const snap: State = {
      ...clone(local),
      currentWindowId: 7,
      managerTabId: undefined,
    };
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state).not.toBe(local);
    expect(r.state.currentWindowId).toBe(7);
    expect(r.state.managerTabId).toBeUndefined();
  });

  test("counts a ctx-only difference as 1 mismatch", () => {
    const local = stateOf([[1, 2]]);
    const snap: State = { ...clone(local), managerTabId: 2 };
    const r = reconcile(local, snap);
    expect(r.mismatches).toBe(1);
    expect(r.state).not.toBe(local);
    expect(r.state.currentWindowId).toBe(snap.currentWindowId);
    expect(r.state.managerTabId).toBe(2);
    expect(r.state.tabs.get(1)).toBe(local.tabs.get(1));
  });

  test("does not mutate its inputs", () => {
    const local = stateOf([[1, 2], [3]]);
    const snap = stateOf([[2, 1], [4]], 100);
    snap.tabs.set(2, { ...snap.tabs.get(2)!, title: "x" });
    const l0 = clone(local);
    const s0 = clone(snap);
    reconcile(local, snap);
    expect(local).toEqual(l0);
    expect(snap).toEqual(s0);
  });
});
