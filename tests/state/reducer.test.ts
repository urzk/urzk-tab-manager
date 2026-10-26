import { describe, expect, test } from "vitest";
import {
  emptyState,
  tabIndex,
  toTabLite,
  type ChromeEvent,
  type State,
  type TabLite,
} from "../../src/lib/state/model";
import { applyEvent } from "../../src/lib/state/reducer";

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

/** stateOf([[1,2,3],[4]]): window ids 100, 101, ...; first tab of each window is active. */
function stateOf(wins: number[][]): State {
  const windows = new Map();
  const lists = new Map();
  const tabs = new Map();
  const order: number[] = [];
  wins.forEach((ids, i) => {
    const w = 100 + i;
    order.push(w);
    windows.set(w, { id: w, focused: i === 0 });
    lists.set(w, ids);
    ids.forEach((id, j) => tabs.set(id, tab(id, w, { active: j === 0 })));
  });
  return { windowOrder: order, windows, tabIdsByWindow: lists, tabs };
}

const fold = (s: State, ...es: ChromeEvent[]) => es.reduce(applyEvent, s);
const ids = (s: State, w: number) => s.tabIdsByWindow.get(w);
const activeIds = (s: State) =>
  [...s.tabs.values()]
    .filter((t) => t.active)
    .map((t) => t.id)
    .sort();

describe("applyEvent", () => {
  test("tabCreated inserts at index", () => {
    const s = fold(stateOf([[1, 2, 3]]), {
      type: "tabCreated",
      tab: tab(9, 100),
      index: 1,
    });
    expect(ids(s, 100)).toEqual([1, 9, 2, 3]);
    expect(s.tabs.get(9)).toBeDefined();
  });

  test("tabCreated for unknown window creates it", () => {
    const s = fold(stateOf([[1]]), {
      type: "tabCreated",
      tab: tab(9, 200),
      index: 0,
    });
    expect(s.windowOrder).toEqual([100, 200]);
    expect(s.windows.get(200)).toEqual({ id: 200, focused: false });
    expect(ids(s, 200)).toEqual([9]);
  });

  test("tabCreated clamps index and tolerates duplicates", () => {
    const s0 = stateOf([[1, 2]]);
    const s1 = fold(s0, { type: "tabCreated", tab: tab(9, 100), index: 50 });
    expect(ids(s1, 100)).toEqual([1, 2, 9]);
    const s2 = fold(s1, {
      type: "tabCreated",
      tab: tab(9, 100, { title: "new" }),
      index: 0,
    });
    expect(ids(s2, 100)).toEqual([9, 1, 2]);
    expect(s2.tabs.get(9)!.title).toBe("new");
    expect(s0.tabIdsByWindow.get(100)).toEqual([1, 2]);
  });

  test("tabMoved reorders within window", () => {
    const s = fold(stateOf([[1, 2, 3]]), {
      type: "tabMoved",
      tabId: 1,
      windowId: 100,
      fromIndex: 0,
      toIndex: 2,
    });
    expect(ids(s, 100)).toEqual([2, 3, 1]);
  });

  test("tabMoved trusts toIndex over fromIndex and clamps", () => {
    const s = fold(stateOf([[1, 2, 3]]), {
      type: "tabMoved",
      tabId: 3,
      windowId: 100,
      fromIndex: 99,
      toIndex: 99,
    });
    expect(ids(s, 100)).toEqual([1, 2, 3]);
    const s2 = fold(stateOf([[1, 2, 3]]), {
      type: "tabMoved",
      tabId: 1,
      windowId: 100,
      fromIndex: 7,
      toIndex: 99,
    });
    expect(ids(s2, 100)).toEqual([2, 3, 1]);
  });

  test("detach then attach moves tab across windows at position", () => {
    const s = fold(
      stateOf([
        [1, 2, 3],
        [4, 5],
      ]),
      { type: "tabDetached", tabId: 2, oldWindowId: 100, oldPosition: 1 },
      { type: "tabAttached", tabId: 2, newWindowId: 101, newPosition: 1 },
    );
    expect(ids(s, 100)).toEqual([1, 3]);
    expect(ids(s, 101)).toEqual([4, 2, 5]);
    expect(s.tabs.get(2)!.windowId).toBe(101);
    expect(s.tabs.get(2)!.active).toBe(false);
  });

  test("detach keeps the tab in tabs, attach clamps position", () => {
    const d = fold(stateOf([[1, 2], [4]]), {
      type: "tabDetached",
      tabId: 2,
      oldWindowId: 100,
      oldPosition: 1,
    });
    expect(d.tabs.has(2)).toBe(true);
    expect(tabIndex(d, 2)).toBe(-1);
    const a = fold(d, {
      type: "tabAttached",
      tabId: 2,
      newWindowId: 101,
      newPosition: 9,
    });
    expect(ids(a, 101)).toEqual([4, 2]);
  });

  test("tabRemoved deletes tab", () => {
    const s = fold(stateOf([[1, 2, 3]]), {
      type: "tabRemoved",
      tabId: 2,
      windowId: 100,
    });
    expect(ids(s, 100)).toEqual([1, 3]);
    expect(s.tabs.has(2)).toBe(false);
  });

  test("windowRemoved deletes window and its tabs", () => {
    const s = fold(stateOf([[1, 2], [4]]), {
      type: "windowRemoved",
      windowId: 100,
    });
    expect(s.windowOrder).toEqual([101]);
    expect(s.windows.has(100)).toBe(false);
    expect(s.tabIdsByWindow.has(100)).toBe(false);
    expect([...s.tabs.keys()]).toEqual([4]);
  });

  test("windowRemoved leaves currentWindowId alone", () => {
    const s0 = { ...stateOf([[1], [4]]), currentWindowId: 100 };
    expect(
      fold(s0, { type: "windowRemoved", windowId: 100 }).currentWindowId,
    ).toBe(100);
  });

  test("tabReplaced keeps position and swaps id", () => {
    const s0 = { ...stateOf([[1, 2, 3]]), managerTabId: 2 };
    const s = fold(s0, { type: "tabReplaced", addedTabId: 9, removedTabId: 2 });
    expect(ids(s, 100)).toEqual([1, 9, 3]);
    expect(s.tabs.has(2)).toBe(false);
    expect(s.tabs.get(9)!.id).toBe(9);
    expect(s.managerTabId).toBe(9);
  });

  test("tabActivated toggles active within window only", () => {
    const s0 = stateOf([
      [1, 2, 3],
      [4, 5],
    ]);
    const s = fold(s0, { type: "tabActivated", tabId: 3, windowId: 100 });
    expect(s.tabs.get(3)!.active).toBe(true);
    expect(s.tabs.get(1)!.active).toBe(false);
    expect(s.tabs.get(4)!.active).toBe(true);
    expect(s.tabs.get(2)).toBe(s0.tabs.get(2));
    expect(s.tabs.get(4)).toBe(s0.tabs.get(4));
  });

  test("tabActivated for a detached tab never throws and clears the window", () => {
    const d = fold(stateOf([[1, 2], [4]]), {
      type: "tabDetached",
      tabId: 2,
      oldWindowId: 100,
      oldPosition: 1,
    });
    const s = fold(d, { type: "tabActivated", tabId: 2, windowId: 100 });
    expect(s.tabs.get(2)!.active).toBe(true);
    expect(s.tabs.get(1)!.active).toBe(false);
  });

  test("active-tab removal gives the same state in either event order", () => {
    const s0 = stateOf([[1, 2, 3]]); // 1 active
    const rm: ChromeEvent = { type: "tabRemoved", tabId: 1, windowId: 100 };
    const act: ChromeEvent = { type: "tabActivated", tabId: 2, windowId: 100 };
    const a = fold(s0, rm, act);
    const b = fold(s0, act, rm);
    expect(a).toEqual(b);
    expect(activeIds(a)).toEqual([2]);
  });

  test("cross-window move: neighbour activation may arrive between detach and attach", () => {
    const s0 = stateOf([
      [1, 2, 3],
      [4, 5],
    ]); // 1 active in 100, 4 active in 101
    const det: ChromeEvent = {
      type: "tabDetached",
      tabId: 1,
      oldWindowId: 100,
      oldPosition: 0,
    };
    const act: ChromeEvent = { type: "tabActivated", tabId: 2, windowId: 100 };
    const att: ChromeEvent = {
      type: "tabAttached",
      tabId: 1,
      newWindowId: 101,
      newPosition: 1,
    };
    const orders = [
      fold(s0, det, att, act),
      fold(s0, det, act, att),
      fold(s0, act, det, att),
    ];
    expect(orders[1]).toEqual(orders[0]);
    expect(orders[2]).toEqual(orders[0]);
    expect(activeIds(orders[0])).toEqual([2, 4]);
  });

  test("tabUpdated preserves identity of other tabs", () => {
    const prev = stateOf([[1, 2, 3]]);
    const next = fold(prev, {
      type: "tabUpdated",
      tab: tab(1, 100, { title: "x", active: true }),
    });
    expect(next.tabs.get(2)).toBe(prev.tabs.get(2));
    expect(next.tabs.get(1)!.title).toBe("x");
  });

  test("tabUpdated changes fields only, not membership", () => {
    const prev = stateOf([[1], [4]]);
    const next = fold(prev, {
      type: "tabUpdated",
      tab: tab(1, 101, { title: "y" }),
    });
    expect(next.tabs.get(1)!.windowId).toBe(100);
    expect(ids(next, 100)).toEqual([1]);
    expect(
      fold(prev, { type: "tabUpdated", tab: { ...prev.tabs.get(1)! } }),
    ).toBe(prev);
  });

  test("ignores events for unknown tabs and windows", () => {
    const prev = stateOf([[1, 2], [4]]);
    const evs: ChromeEvent[] = [
      { type: "tabMoved", tabId: 99, windowId: 100, fromIndex: 0, toIndex: 1 },
      { type: "tabMoved", tabId: 1, windowId: 999, fromIndex: 0, toIndex: 1 },
      { type: "tabRemoved", tabId: 99, windowId: 100 },
      { type: "tabUpdated", tab: tab(99, 100) },
      { type: "tabReplaced", addedTabId: 50, removedTabId: 99 },
      { type: "tabDetached", tabId: 99, oldWindowId: 100, oldPosition: 0 },
      { type: "tabAttached", tabId: 99, newWindowId: 100, newPosition: 0 },
      { type: "tabActivated", tabId: 99, windowId: 100 },
      { type: "windowRemoved", windowId: 999 },
    ];
    for (const e of evs) expect(applyEvent(prev, e)).toBe(prev);
  });

  test("attaching manager tab updates currentWindowId", () => {
    const s0 = {
      ...stateOf([[1, 2], [4]]),
      managerTabId: 2,
      currentWindowId: 100,
    };
    const s = fold(
      s0,
      { type: "tabDetached", tabId: 2, oldWindowId: 100, oldPosition: 1 },
      { type: "tabAttached", tabId: 2, newWindowId: 101, newPosition: 0 },
    );
    expect(s.currentWindowId).toBe(101);
  });

  test("windowFocusChanged sets focused; -1 clears all", () => {
    const s0 = stateOf([[1], [4]]);
    const s = fold(s0, { type: "windowFocusChanged", windowId: 101 });
    expect(s.windows.get(101)!.focused).toBe(true);
    expect(s.windows.get(100)!.focused).toBe(false);
    const none = fold(s, { type: "windowFocusChanged", windowId: -1 });
    expect([...none.windows.values()].some((w) => w.focused)).toBe(false);
  });

  test("windowCreated adds an empty window once", () => {
    const e: ChromeEvent = {
      type: "windowCreated",
      window: { id: 7, focused: false },
    };
    const s = fold(emptyState, e);
    expect(s.windowOrder).toEqual([7]);
    expect(ids(s, 7)).toEqual([]);
    expect(applyEvent(s, e)).toBe(s);
  });

  test("never mutates input", () => {
    const s0 = stateOf([[1, 2, 3]]);
    const snap = structuredClone({
      l: [...s0.tabIdsByWindow],
      t: [...s0.tabs],
    });
    fold(
      s0,
      { type: "tabMoved", tabId: 1, windowId: 100, fromIndex: 0, toIndex: 2 },
      { type: "tabRemoved", tabId: 2, windowId: 100 },
      { type: "tabActivated", tabId: 3, windowId: 100 },
    );
    expect({ l: [...s0.tabIdsByWindow], t: [...s0.tabs] }).toEqual(snap);
  });
});

describe("toTabLite", () => {
  test("falls back to pendingUrl and url for title, copies status", () => {
    const t = toTabLite({
      id: 3,
      windowId: 1,
      index: 0,
      pendingUrl: "https://p.com",
      status: "loading",
    } as chrome.tabs.Tab);
    expect(t.url).toBe("https://p.com");
    expect(t.title).toBe("https://p.com");
    expect(t.status).toBe("loading");
  });
});
