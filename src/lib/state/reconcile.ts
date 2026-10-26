import {
  toTabLite,
  toWindowLite,
  type State,
  type TabLite,
  type WindowLite,
} from "./model";

/** Builds a State from `chrome.windows.getAll({ populate: true })` output. */
export function fromSnapshot(
  windows: chrome.windows.Window[],
  currentWindowId: number | undefined,
  managerTabId: number | undefined,
): State {
  const windowOrder: number[] = [];
  const wins = new Map<number, WindowLite>();
  const lists = new Map<number, readonly number[]>();
  const tabs = new Map<number, TabLite>();
  for (const w of windows) {
    const lite = toWindowLite(w);
    windowOrder.push(lite.id);
    wins.set(lite.id, lite);
    const ids: number[] = [];
    for (const t of [...(w.tabs ?? [])].sort((a, b) => a.index - b.index)) {
      const tl = toTabLite(t);
      tabs.set(tl.id, tl);
      ids.push(tl.id);
    }
    lists.set(lite.id, ids);
  }
  return {
    windowOrder,
    windows: wins,
    tabIdsByWindow: lists,
    tabs,
    currentWindowId,
    managerTabId,
  };
}

const sameList = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

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

const sameWindow = (a: WindowLite, b: WindowLite) =>
  a.id === b.id && a.state === b.state && a.focused === b.focused;

/**
 * Merges a fresh snapshot into the locally tracked state. Result content equals
 * the snapshot; objects equal by value are taken from `local` so that identity
 * based change detection (keyed lists) sees no change. Pure.
 */
export function reconcile(
  local: State,
  snapshot: State,
): { state: State; mismatches: number } {
  let mismatches = 0;

  const orderSame = sameList(local.windowOrder, snapshot.windowOrder);
  if (!orderSame) mismatches++;

  const windows = new Map<number, WindowLite>();
  const lists = new Map<number, readonly number[]>();
  for (const id of snapshot.windowOrder) {
    const sw = snapshot.windows.get(id)!;
    const lw = local.windows.get(id);
    if (lw && sameWindow(lw, sw)) windows.set(id, lw);
    else {
      windows.set(id, sw);
      // a window missing locally is already counted through the order check
      if (lw) mismatches++;
    }
    const sl = snapshot.tabIdsByWindow.get(id) ?? [];
    const ll = local.tabIdsByWindow.get(id);
    if (ll && sameList(ll, sl)) lists.set(id, ll);
    else {
      lists.set(id, sl);
      if (ll) mismatches++;
    }
  }

  const tabs = new Map<number, TabLite>();
  for (const [id, st] of snapshot.tabs) {
    const lt = local.tabs.get(id);
    if (lt && sameTab(lt, st)) tabs.set(id, lt);
    else {
      tabs.set(id, st);
      if (lt) mismatches++;
    }
  }

  // tabs or windows only present on one side
  for (const id of local.tabs.keys()) if (!snapshot.tabs.has(id)) mismatches++;
  for (const id of snapshot.tabs.keys()) if (!local.tabs.has(id)) mismatches++;
  for (const id of local.windowOrder)
    if (!snapshot.windows.has(id)) mismatches++;
  for (const id of snapshot.windowOrder)
    if (!local.windows.has(id)) mismatches++;

  const sameCtx =
    local.currentWindowId === snapshot.currentWindowId &&
    local.managerTabId === snapshot.managerTabId;
  if (mismatches === 0 && sameCtx) return { state: local, mismatches: 0 };

  return {
    state: {
      windowOrder: orderSame ? local.windowOrder : snapshot.windowOrder,
      windows,
      tabIdsByWindow: lists,
      tabs,
      currentWindowId: snapshot.currentWindowId,
      managerTabId: snapshot.managerTabId,
    },
    mismatches,
  };
}
