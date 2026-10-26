import type { ChromeApi, Listener } from "./api";
import { toTabLite, toWindowLite, type ChromeEvent } from "../state/model";

/**
 * Attaches one listener per Chrome window/tab event and converts its arguments
 * into a `ChromeEvent`. Returns a function that removes every listener again.
 */
export function subscribeEvents(
  api: ChromeApi,
  onEvent: (e: ChromeEvent) => void,
): () => void {
  const undo: (() => void)[] = [];
  const on = <A extends unknown[]>(
    l: Listener<A>,
    toEvent: (...a: A) => ChromeEvent,
  ) => {
    const fn = (...a: A) => onEvent(toEvent(...a));
    l.addListener(fn);
    undo.push(() => l.removeListener(fn));
  };
  const { windows, tabs } = api;

  on(windows.onCreated, (w) => ({
    type: "windowCreated",
    window: toWindowLite(w),
  }));
  on(windows.onRemoved, (windowId) => ({ type: "windowRemoved", windowId }));
  // WINDOW_ID_NONE (-1) passes through: no window has focus
  on(windows.onFocusChanged, (windowId) => ({
    type: "windowFocusChanged",
    windowId,
  }));

  on(tabs.onCreated, (tab) => ({
    type: "tabCreated",
    tab: toTabLite(tab),
    index: tab.index,
  }));
  on(tabs.onUpdated, (_id, _info, tab) => ({
    type: "tabUpdated",
    tab: toTabLite(tab),
  }));
  on(tabs.onMoved, (tabId, info) => ({
    type: "tabMoved",
    tabId,
    windowId: info.windowId,
    fromIndex: info.fromIndex,
    toIndex: info.toIndex,
  }));
  on(tabs.onDetached, (tabId, info) => ({
    type: "tabDetached",
    tabId,
    oldWindowId: info.oldWindowId,
    oldPosition: info.oldPosition,
  }));
  on(tabs.onAttached, (tabId, info) => ({
    type: "tabAttached",
    tabId,
    newWindowId: info.newWindowId,
    newPosition: info.newPosition,
  }));
  on(tabs.onRemoved, (tabId, info) => ({
    type: "tabRemoved",
    tabId,
    windowId: info.windowId,
  }));
  on(tabs.onReplaced, (addedTabId, removedTabId) => ({
    type: "tabReplaced",
    addedTabId,
    removedTabId,
  }));
  on(tabs.onActivated, (info) => ({
    type: "tabActivated",
    tabId: info.tabId,
    windowId: info.windowId,
  }));

  return () => {
    for (const u of undo.splice(0)) u();
  };
}
