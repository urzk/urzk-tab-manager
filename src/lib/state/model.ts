export type TabLite = {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  discarded: boolean;
  active: boolean;
  pinned: boolean;
  status?: string;
};

export type WindowLite = {
  id: number;
  state?: `${chrome.windows.WindowState}`;
  focused: boolean;
};

export type State = {
  windowOrder: readonly number[];
  windows: ReadonlyMap<number, WindowLite>;
  tabIdsByWindow: ReadonlyMap<number, readonly number[]>;
  tabs: ReadonlyMap<number, TabLite>;
  currentWindowId?: number;
  managerTabId?: number;
};

export type ChromeEvent =
  | { type: "windowCreated"; window: WindowLite }
  | { type: "windowRemoved"; windowId: number }
  | { type: "windowFocusChanged"; windowId: number }
  | { type: "tabCreated"; tab: TabLite; index: number }
  | { type: "tabUpdated"; tab: TabLite }
  | {
      type: "tabMoved";
      tabId: number;
      windowId: number;
      fromIndex: number;
      toIndex: number;
    }
  | {
      type: "tabDetached";
      tabId: number;
      oldWindowId: number;
      oldPosition: number;
    }
  | {
      type: "tabAttached";
      tabId: number;
      newWindowId: number;
      newPosition: number;
    }
  | { type: "tabRemoved"; tabId: number; windowId: number }
  | { type: "tabReplaced"; addedTabId: number; removedTabId: number }
  | { type: "tabActivated"; tabId: number; windowId: number };

export const emptyState: State = {
  windowOrder: [],
  windows: new Map(),
  tabIdsByWindow: new Map(),
  tabs: new Map(),
};

export function toTabLite(t: chrome.tabs.Tab): TabLite {
  const url = t.url || t.pendingUrl || "";
  const lite: TabLite = {
    id: t.id ?? -1,
    windowId: t.windowId,
    title: t.title || url,
    url,
    discarded: !!t.discarded,
    active: !!t.active,
    pinned: !!t.pinned,
  };
  if (t.favIconUrl) lite.favIconUrl = t.favIconUrl;
  if (t.status) lite.status = t.status;
  return lite;
}

export function toWindowLite(w: chrome.windows.Window): WindowLite {
  const lite: WindowLite = { id: w.id ?? -1, focused: !!w.focused };
  if (w.state) lite.state = w.state;
  return lite;
}

/** Position of the tab within its window's list, -1 if unknown or detached. */
export function tabIndex(s: State, tabId: number): number {
  const tab = s.tabs.get(tabId);
  if (tab) {
    const i = s.tabIdsByWindow.get(tab.windowId)?.indexOf(tabId) ?? -1;
    if (i >= 0) return i;
  }
  for (const ids of s.tabIdsByWindow.values()) {
    const i = ids.indexOf(tabId);
    if (i >= 0) return i;
  }
  return -1;
}
