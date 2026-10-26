import type { ChromeEvent, State, TabLite, WindowLite } from "./model";

type Lists = ReadonlyMap<number, readonly number[]>;

function sameTab(a: TabLite, b: TabLite): boolean {
  return (
    a.id === b.id &&
    a.windowId === b.windowId &&
    a.title === b.title &&
    a.url === b.url &&
    a.favIconUrl === b.favIconUrl &&
    a.discarded === b.discarded &&
    a.active === b.active &&
    a.pinned === b.pinned &&
    a.status === b.status
  );
}

function withEntry<K, V>(m: ReadonlyMap<K, V>, k: K, v: V): Map<K, V> {
  const n = new Map(m);
  n.set(k, v);
  return n;
}

function without<K, V>(m: ReadonlyMap<K, V>, k: K): Map<K, V> {
  const n = new Map(m);
  n.delete(k);
  return n;
}

function insertClamped(
  ids: readonly number[],
  id: number,
  index: number,
): number[] {
  const out = ids.filter((x) => x !== id);
  const at = Math.min(Math.max(index, 0), out.length);
  out.splice(at, 0, id);
  return out;
}

/** Removes the id from every window list (normally exactly one holds it). */
function removeFromLists(lists: Lists, id: number): Lists {
  let out: Map<number, readonly number[]> | undefined;
  for (const [w, ids] of lists) {
    if (ids.includes(id)) {
      out ??= new Map(lists);
      out.set(
        w,
        ids.filter((x) => x !== id),
      );
    }
  }
  return out ?? lists;
}

/** Ensures the window exists (appended to the order, unfocused, empty). */
function ensureWindow(s: State, windowId: number): State {
  if (s.windows.has(windowId)) return s;
  return {
    ...s,
    windowOrder: [...s.windowOrder, windowId],
    windows: withEntry(s.windows, windowId, { id: windowId, focused: false }),
    tabIdsByWindow: s.tabIdsByWindow.has(windowId)
      ? s.tabIdsByWindow
      : withEntry(s.tabIdsByWindow, windowId, []),
  };
}

/** Sets `active` on one tab and clears it on the other tabs of the given window. */
function activate(s: State, tabId: number, windowId: number): State {
  const target = s.tabs.get(tabId);
  if (!target) return s;
  let tabs: Map<number, TabLite> | undefined;
  const put = (t: TabLite) => {
    tabs ??= new Map(s.tabs);
    tabs.set(t.id, t);
  };
  if (!target.active) put({ ...target, active: true });
  for (const id of s.tabIdsByWindow.get(windowId) ?? []) {
    const t = s.tabs.get(id);
    if (t && id !== tabId && t.active) put({ ...t, active: false });
  }
  return tabs ? { ...s, tabs } : s;
}

function hasActiveTab(s: State, windowId: number, except: number): boolean {
  return (s.tabIdsByWindow.get(windowId) ?? []).some(
    (id) => id !== except && s.tabs.get(id)?.active,
  );
}

function place(
  s: State,
  tabId: number,
  windowId: number,
  index: number,
): State {
  const tab = s.tabs.get(tabId);
  if (!tab) return s;
  const base = ensureWindow(s, windowId);
  const lists = removeFromLists(base.tabIdsByWindow, tabId);
  const ids = insertClamped(lists.get(windowId) ?? [], tabId, index);
  return {
    ...base,
    tabIdsByWindow: withEntry(lists, windowId, ids),
    tabs:
      tab.windowId === windowId
        ? base.tabs
        : withEntry(base.tabs, tabId, { ...tab, windowId }),
  };
}

function sameOrder(
  a: readonly number[] | undefined,
  b: readonly number[],
): boolean {
  return !!a && a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Merges event fields into an existing tab; window membership and `active` stay put. */
function updateFields(s: State, incoming: TabLite): State {
  const prev = s.tabs.get(incoming.id);
  if (!prev) return s;
  const next: TabLite = {
    ...incoming,
    windowId: prev.windowId,
    active: prev.active,
  };
  if (sameTab(prev, next)) return s;
  return { ...s, tabs: withEntry(s.tabs, prev.id, next) };
}

function removeTab(s: State, tabId: number): State {
  if (!s.tabs.has(tabId)) return s;
  return {
    ...s,
    tabs: without(s.tabs, tabId),
    tabIdsByWindow: removeFromLists(s.tabIdsByWindow, tabId),
  };
}

function replaceTab(s: State, removedId: number, addedId: number): State {
  const old = s.tabs.get(removedId);
  if (!old || removedId === addedId) return s;
  const managerTabId = s.managerTabId === removedId ? addedId : s.managerTabId;
  const withManager = (n: State): State =>
    managerTabId === s.managerTabId ? n : { ...n, managerTabId };
  if (s.tabs.has(addedId)) return withManager(removeTab(s, removedId));
  const lists = new Map<number, readonly number[]>();
  for (const [w, ids] of s.tabIdsByWindow) {
    lists.set(
      w,
      ids.includes(removedId)
        ? ids.map((x) => (x === removedId ? addedId : x))
        : ids,
    );
  }
  const tabs = without(s.tabs, removedId);
  tabs.set(addedId, { ...old, id: addedId });
  return withManager({ ...s, tabs, tabIdsByWindow: lists });
}

function createTab(s: State, tab: TabLite, index: number): State {
  if (s.tabs.has(tab.id)) {
    return place(updateFields(s, tab), tab.id, tab.windowId, index);
  }
  const base = ensureWindow(s, tab.windowId);
  const ids = insertClamped(
    base.tabIdsByWindow.get(tab.windowId) ?? [],
    tab.id,
    index,
  );
  const next: State = {
    ...base,
    tabs: withEntry(base.tabs, tab.id, tab),
    tabIdsByWindow: withEntry(base.tabIdsByWindow, tab.windowId, ids),
  };
  return tab.active ? activate(next, tab.id, tab.windowId) : next;
}

function moveTab(
  s: State,
  tabId: number,
  windowId: number,
  toIndex: number,
): State {
  if (!s.tabs.has(tabId) || !s.windows.has(windowId)) return s;
  const next = place(s, tabId, windowId, toIndex);
  const before = s.tabIdsByWindow.get(windowId);
  const after = next.tabIdsByWindow.get(windowId)!;
  return sameOrder(before, after) && next.tabs === s.tabs ? s : next;
}

function detachTab(s: State, tabId: number): State {
  const tab = s.tabs.get(tabId);
  if (!tab) return s;
  const lists = removeFromLists(s.tabIdsByWindow, tabId);
  if (lists === s.tabIdsByWindow && !tab.active) return s;
  return {
    ...s,
    tabIdsByWindow: lists,
    // a detached tab is never the active one (matches Chrome)
    tabs: tab.active
      ? withEntry(s.tabs, tabId, { ...tab, active: false })
      : s.tabs,
  };
}

function attachTab(
  s: State,
  tabId: number,
  windowId: number,
  position: number,
): State {
  if (!s.tabs.has(tabId)) return s;
  let next = place(ensureWindow(s, windowId), tabId, windowId, position);
  const tab = next.tabs.get(tabId)!;
  if (tab.active) next = activate(next, tabId, windowId);
  else if (!hasActiveTab(next, windowId, tabId))
    next = activate(next, tabId, windowId);
  return next.managerTabId === tabId
    ? { ...next, currentWindowId: windowId }
    : next;
}

function removeWindow(s: State, windowId: number): State {
  if (!s.windows.has(windowId) && !s.tabIdsByWindow.has(windowId)) return s;
  const tabs = new Map(s.tabs);
  for (const id of s.tabIdsByWindow.get(windowId) ?? []) tabs.delete(id);
  for (const [id, t] of s.tabs) if (t.windowId === windowId) tabs.delete(id);
  return {
    ...s,
    windowOrder: s.windowOrder.filter((w) => w !== windowId),
    windows: without(s.windows, windowId),
    tabIdsByWindow: without(s.tabIdsByWindow, windowId),
    tabs,
  };
}

function createWindow(s: State, window: WindowLite): State {
  const prev = s.windows.get(window.id);
  if (prev) {
    return prev.state === window.state && prev.focused === window.focused
      ? s
      : { ...s, windows: withEntry(s.windows, window.id, window) };
  }
  const base = ensureWindow(s, window.id);
  return { ...base, windows: withEntry(base.windows, window.id, window) };
}

function focusWindow(s: State, windowId: number): State {
  let windows: Map<number, WindowLite> | undefined;
  for (const [id, w] of s.windows) {
    const focused = id === windowId;
    if (w.focused !== focused) {
      windows ??= new Map(s.windows);
      windows.set(id, { ...w, focused });
    }
  }
  return windows ? { ...s, windows } : s;
}

export function applyEvent(s: State, e: ChromeEvent): State {
  switch (e.type) {
    case "windowCreated":
      return createWindow(s, e.window);
    case "windowRemoved":
      return removeWindow(s, e.windowId);
    case "windowFocusChanged":
      return focusWindow(s, e.windowId);
    case "tabCreated":
      return createTab(s, e.tab, e.index);
    case "tabUpdated":
      return updateFields(s, e.tab);
    case "tabMoved":
      return moveTab(s, e.tabId, e.windowId, e.toIndex);
    case "tabDetached":
      return detachTab(s, e.tabId);
    case "tabAttached":
      return attachTab(s, e.tabId, e.newWindowId, e.newPosition);
    case "tabRemoved":
      return removeTab(s, e.tabId);
    case "tabReplaced":
      return replaceTab(s, e.removedTabId, e.addedTabId);
    case "tabActivated":
      return activate(s, e.tabId, e.windowId);
  }
}
