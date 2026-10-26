import type { ChromeApi, Listener } from "../lib/chrome/api";

/**
 * In-memory fake of the slice of chrome.windows / chrome.tabs the app uses.
 * It models Chrome's event semantics (ordering, argument shapes, silent index
 * shifts) so reducers can be tested against it. Nothing here touches a global
 * `chrome`.
 */

const WINDOW_ID_NONE = -1;

export type FakeSeedTab = {
  title: string;
  url: string;
  favIconUrl?: string;
  pinned?: boolean;
  discarded?: boolean;
};

export type FakeSeed = {
  windows: { tabs: FakeSeedTab[]; state?: `${chrome.windows.WindowState}` }[];
  currentWindowIndex?: number;
  /** When true, `tabs.discard` swaps the tab id and fires `onReplaced`, then `onUpdated` for the new id (default: false). */
  replaceOnDiscard?: boolean;
};

export type FakeChrome = ChromeApi & {
  /** Fresh copy of the real state: windows in creation order, tabs sorted by index. */
  truth(): chrome.windows.Window[];
  deliver: "sync" | "manual";
  flush(): void;
  setTitle(tabId: number, title: string): void;
  /** Silently discards the next n events emitted (not yet-queued ones). */
  dropNextEvents(n: number): void;
};

type FakeWindow = {
  id: number;
  state: `${chrome.windows.WindowState}`;
  tabs: chrome.tabs.Tab[];
};

const clone = <T>(v: T): T => structuredClone(v);

class Emitter<A extends unknown[]> implements Listener<A> {
  private fns: ((...a: A) => void)[] = [];
  addListener(fn: (...a: A) => void) {
    if (!this.fns.includes(fn)) this.fns.push(fn);
  }
  removeListener(fn: (...a: A) => void) {
    this.fns = this.fns.filter((f) => f !== fn);
  }
  dispatch(args: A) {
    for (const fn of [...this.fns]) {
      try {
        fn(...clone(args));
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export function createFakeChrome(seed: FakeSeed = { windows: [] }): FakeChrome {
  let nextId = 1;
  const windows: FakeWindow[] = [];
  let focusedWindowId = WINDOW_ID_NONE;
  const currentWindowId = { v: WINDOW_ID_NONE };
  const queue: (() => void)[] = [];
  let dropCount = 0;
  let scheduled = false;

  const e = {
    wCreated: new Emitter<[chrome.windows.Window]>(),
    wRemoved: new Emitter<[number]>(),
    wFocus: new Emitter<[number]>(),
    tCreated: new Emitter<[chrome.tabs.Tab]>(),
    tUpdated: new Emitter<
      [number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab]
    >(),
    tMoved: new Emitter<[number, chrome.tabs.OnMovedInfo]>(),
    tAttached: new Emitter<[number, chrome.tabs.OnAttachedInfo]>(),
    tDetached: new Emitter<[number, chrome.tabs.OnDetachedInfo]>(),
    tRemoved: new Emitter<[number, chrome.tabs.OnRemovedInfo]>(),
    tReplaced: new Emitter<[number, number]>(),
    tActivated: new Emitter<[chrome.tabs.OnActivatedInfo]>(),
  };

  // ---- event queue -------------------------------------------------------
  function emit<A extends unknown[]>(emitter: Emitter<A>, ...args: A) {
    if (dropCount > 0) {
      dropCount--;
      return;
    }
    const snapshot = clone(args); // state at emission time
    queue.push(() => emitter.dispatch(snapshot));
    if (fake.deliver === "sync" && !scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        flush();
      });
    }
  }

  function flush() {
    while (queue.length > 0) queue.shift()!();
  }

  // ---- state helpers -----------------------------------------------------
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  const findWindow = (id: number) =>
    windows.find((w) => w.id === id) ?? fail(`No window with id: ${id}.`);
  function findTab(id: number): { win: FakeWindow; tab: chrome.tabs.Tab } {
    for (const win of windows) {
      const tab = win.tabs.find((t) => t.id === id);
      if (tab) return { win, tab };
    }
    return fail(`No tab with id: ${id}.`);
  }
  function reindex(win: FakeWindow) {
    win.tabs.forEach((t, i) => {
      t.index = i;
      t.windowId = win.id;
    });
  }
  const pinnedCount = (win: FakeWindow) =>
    win.tabs.filter((t) => t.pinned).length;
  const activeOf = (win: FakeWindow) => win.tabs.find((t) => t.active);

  function makeTab(
    windowId: number,
    p: {
      url?: string;
      title?: string;
      favIconUrl?: string;
      pinned?: boolean;
      discarded?: boolean;
    },
  ): chrome.tabs.Tab {
    const url = p.url ?? "chrome://newtab/";
    const t: chrome.tabs.Tab = {
      id: nextId++,
      windowId,
      index: 0,
      active: false,
      pinned: p.pinned ?? false,
      highlighted: false,
      incognito: false,
      selected: false,
      discarded: p.discarded ?? false,
      autoDiscardable: true,
      groupId: -1,
      status: "complete",
      frozen: false,
      lastAccessed: 0,
      url,
      title: p.title ?? (p.url === undefined ? "New Tab" : url),
    };
    if (p.favIconUrl !== undefined) t.favIconUrl = p.favIconUrl;
    return t;
  }

  function setActive(win: FakeWindow, tab: chrome.tabs.Tab) {
    for (const t of win.tabs) {
      t.active = t === tab;
      t.highlighted = t === tab;
      t.selected = t === tab;
    }
  }

  /** Removes `tab` from its window's list (no events, no window cleanup). Returns old index. */
  function detach(win: FakeWindow, tab: chrome.tabs.Tab): number {
    const i = win.tabs.indexOf(tab);
    win.tabs.splice(i, 1);
    reindex(win);
    tab.active = false;
    tab.highlighted = false;
    tab.selected = false;
    return i;
  }

  /** If the window lost its active tab, activate the tab at `i` or the previous one. */
  function activateNeighbour(win: FakeWindow, i: number) {
    if (win.tabs.length === 0 || activeOf(win)) return;
    const next = win.tabs[Math.min(i, win.tabs.length - 1)];
    setActive(win, next);
    emit(e.tActivated, { tabId: next.id!, windowId: win.id });
  }

  function dropWindow(win: FakeWindow) {
    windows.splice(windows.indexOf(win), 1);
    emit(e.wRemoved, win.id);
    if (focusedWindowId === win.id) {
      const next = windows[0];
      focusedWindowId = next ? next.id : WINDOW_ID_NONE;
      emit(e.wFocus, focusedWindowId);
    }
  }

  const windowView = (
    win: FakeWindow,
    populate: boolean,
  ): chrome.windows.Window => {
    const w: chrome.windows.Window = {
      id: win.id,
      focused: win.id === focusedWindowId,
      incognito: false,
      alwaysOnTop: false,
      state: win.state,
      type: "normal",
    };
    if (populate) w.tabs = clone(win.tabs);
    return w;
  };

  function newWindow(
    state: `${chrome.windows.WindowState}` = "normal",
  ): FakeWindow {
    const win: FakeWindow = { id: nextId++, state, tabs: [] };
    windows.push(win);
    return win;
  }

  function focusWindow(win: FakeWindow) {
    if (focusedWindowId === win.id) return;
    focusedWindowId = win.id;
    emit(e.wFocus, win.id);
  }

  /** New windows are focused from birth; onFocusChanged follows their onCreated. */
  function newFocusedWindow(
    state: `${chrome.windows.WindowState}`,
    focus: boolean,
  ) {
    const win = newWindow(state);
    if (focus) focusedWindowId = win.id;
    return win;
  }

  /** Pinned tabs must stay in a contiguous prefix; throws like Chrome if violated. */
  function checkPinZone(win: FakeWindow, tab: chrome.tabs.Tab, to: number) {
    // `win` is the destination; `to` is the final index once `tab` is placed there.
    const pc = win.tabs.filter((t) => t.pinned && t !== tab).length;
    if (tab.pinned ? to > pc : to < pc) fail("Cannot move tab");
  }

  // ---- seeding -----------------------------------------------------------
  seed.windows.forEach((sw, wi) => {
    const win = newWindow(sw.state);
    let sawUnpinned = false;
    for (const st of sw.tabs) {
      if (st.pinned && sawUnpinned) fail("Seed: pinned tabs must come first");
      if (!st.pinned) sawUnpinned = true;
      win.tabs.push(makeTab(win.id, st));
    }
    reindex(win);
    if (win.tabs.length > 0) setActive(win, win.tabs[0]);
    if (wi === (seed.currentWindowIndex ?? 0)) {
      currentWindowId.v = win.id;
      focusedWindowId = win.id;
    }
  });

  // ---- chrome.windows ----------------------------------------------------
  async function windowsCreate(data: chrome.windows.CreateData) {
    const focus = data.focused !== false;
    if (data.tabId !== undefined) {
      const { win: src, tab } = findTab(data.tabId);
      const from = detach(src, tab);
      emit(e.tDetached, tab.id!, { oldWindowId: src.id, oldPosition: from });
      activateNeighbour(src, from);
      const win = newFocusedWindow(data.state ?? "normal", focus);
      emit(e.wCreated, windowView(win, false));
      win.tabs.push(tab);
      reindex(win);
      setActive(win, tab);
      emit(e.tAttached, tab.id!, { newWindowId: win.id, newPosition: 0 });
      if (src.tabs.length === 0) dropWindow(src);
      if (focus) emit(e.wFocus, win.id);
      return windowView(win, true);
    }
    const win = newFocusedWindow(data.state ?? "normal", focus);
    emit(e.wCreated, windowView(win, false));
    const urls = Array.isArray(data.url) ? data.url : [data.url];
    for (const url of urls) win.tabs.push(makeTab(win.id, { url }));
    reindex(win);
    setActive(win, win.tabs[0]);
    for (const t of win.tabs) emit(e.tCreated, clone(t));
    if (focus) emit(e.wFocus, win.id);
    return windowView(win, true);
  }

  const windowsApi: ChromeApi["windows"] = {
    getAll: async () => windows.map((w) => windowView(w, true)),
    getCurrent: async () => windowView(findWindow(currentWindowId.v), false),
    update: async (id, info) => {
      const win = findWindow(id);
      if (info.state !== undefined) win.state = info.state;
      if (info.focused) focusWindow(win);
      return windowView(win, false);
    },
    remove: async (id) => {
      const win = findWindow(id);
      for (const t of win.tabs) {
        emit(e.tRemoved, t.id!, { windowId: win.id, isWindowClosing: true });
      }
      win.tabs = [];
      dropWindow(win);
    },
    create: windowsCreate,
    onCreated: e.wCreated,
    onRemoved: e.wRemoved,
    onFocusChanged: e.wFocus,
  };

  // ---- chrome.tabs -------------------------------------------------------
  function matches(t: chrome.tabs.Tab, q: chrome.tabs.QueryInfo): boolean {
    if (q.windowId !== undefined && t.windowId !== q.windowId) return false;
    if (
      (q.currentWindow || q.windowId === -2) &&
      t.windowId !== currentWindowId.v
    )
      return false;
    if (q.lastFocusedWindow && t.windowId !== focusedWindowId) return false;
    if (q.active !== undefined && t.active !== q.active) return false;
    if (q.pinned !== undefined && t.pinned !== q.pinned) return false;
    if (q.discarded !== undefined && t.discarded !== q.discarded) return false;
    if (q.index !== undefined && t.index !== q.index) return false;
    if (q.title !== undefined && t.title !== q.title) return false;
    if (q.url !== undefined) {
      const urls = Array.isArray(q.url) ? q.url : [q.url];
      if (!urls.includes(t.url ?? "")) return false;
    }
    return true;
  }

  async function tabsMove(id: number, p: { index: number; windowId?: number }) {
    const { win: src, tab } = findTab(id);
    const dest = p.windowId === undefined ? src : findWindow(p.windowId);
    if (dest === src) {
      const from = tab.index;
      const to =
        p.index === -1
          ? src.tabs.length - 1
          : Math.min(Math.max(p.index, 0), src.tabs.length - 1);
      checkPinZone(src, tab, to);
      if (from === to) return clone(tab);
      src.tabs.splice(from, 1);
      src.tabs.splice(to, 0, tab);
      reindex(src);
      emit(e.tMoved, id, { windowId: src.id, fromIndex: from, toIndex: to });
      return clone(tab);
    }
    const to =
      p.index === -1
        ? dest.tabs.length
        : Math.min(Math.max(p.index, 0), dest.tabs.length);
    checkPinZone(dest, tab, to);
    const from = detach(src, tab);
    emit(e.tDetached, id, { oldWindowId: src.id, oldPosition: from });
    activateNeighbour(src, from);
    dest.tabs.splice(to, 0, tab);
    reindex(dest);
    // the destination already has an active tab; the moved tab arrives inactive
    if (!activeOf(dest)) setActive(dest, tab);
    emit(e.tAttached, id, { newWindowId: dest.id, newPosition: to });
    if (src.tabs.length === 0) dropWindow(src);
    return clone(tab);
  }

  const tabsApi: ChromeApi["tabs"] = {
    query: async (q) =>
      clone(windows.flatMap((w) => w.tabs).filter((t) => matches(t, q))),
    get: async (id) => clone(findTab(id).tab),
    getCurrent: async () => undefined,
    update: async (id, p) => {
      const { win, tab } = findTab(id);
      if (p.url !== undefined && p.url !== tab.url) {
        tab.url = p.url;
        emit(e.tUpdated, id, { url: p.url }, clone(tab));
      }
      if (p.pinned !== undefined && p.pinned !== tab.pinned) {
        // Chrome relocates the tab to the pin boundary before the pin state changes.
        const from = tab.index;
        const pc = pinnedCount(win);
        const to = p.pinned ? pc : pc - 1;
        win.tabs.splice(from, 1);
        win.tabs.splice(to, 0, tab);
        tab.pinned = p.pinned;
        reindex(win);
        if (to !== from)
          emit(e.tMoved, id, {
            windowId: win.id,
            fromIndex: from,
            toIndex: to,
          });
        emit(e.tUpdated, id, { pinned: p.pinned }, clone(tab));
      }
      if (p.active && !tab.active) {
        setActive(win, tab);
        emit(e.tActivated, { tabId: id, windowId: win.id });
      }
      return clone(tab);
    },
    move: tabsMove,
    remove: async (id) => {
      const { win, tab } = findTab(id);
      const closing = win.tabs.length === 1;
      const i = detach(win, tab);
      emit(e.tRemoved, id, { windowId: win.id, isWindowClosing: closing });
      if (closing) dropWindow(win);
      else activateNeighbour(win, i);
    },
    discard: async (id) => {
      const { tab } = findTab(id);
      if (tab.active || tab.discarded)
        return tab.active ? undefined : clone(tab);
      if (seed.replaceOnDiscard) {
        const old = tab.id!;
        tab.id = nextId++;
        tab.discarded = true;
        emit(e.tReplaced, tab.id, old);
        // Chrome still reports the discard itself; onReplaced alone carries no state
        emit(e.tUpdated, tab.id, { discarded: true }, clone(tab));
      } else {
        tab.discarded = true;
        emit(e.tUpdated, id, { discarded: true }, clone(tab));
      }
      return clone(tab);
    },
    create: async (p) => {
      const win =
        p.windowId === undefined
          ? findWindow(currentWindowId.v)
          : findWindow(p.windowId);
      const tab = makeTab(win.id, { url: p.url, pinned: p.pinned });
      const pc = pinnedCount(win);
      const want = p.index ?? win.tabs.length;
      const index = tab.pinned
        ? Math.min(Math.max(want, 0), pc)
        : Math.min(Math.max(want, pc), win.tabs.length);
      win.tabs.splice(index, 0, tab);
      reindex(win);
      const active = p.active !== false || win.tabs.length === 1;
      if (active) setActive(win, tab);
      emit(e.tCreated, clone(tab));
      if (active && win.tabs.length > 1)
        emit(e.tActivated, { tabId: tab.id!, windowId: win.id });
      return clone(tab);
    },
    onCreated: e.tCreated,
    onUpdated: e.tUpdated,
    onMoved: e.tMoved,
    onAttached: e.tAttached,
    onDetached: e.tDetached,
    onRemoved: e.tRemoved,
    onReplaced: e.tReplaced,
    onActivated: e.tActivated,
  };

  const fake: FakeChrome = {
    windows: windowsApi,
    tabs: tabsApi,
    deliver: "sync",
    flush,
    truth: () => windows.map((w) => windowView(w, true)),
    setTitle(tabId, title) {
      const { tab } = findTab(tabId);
      if (tab.title === title) return;
      tab.title = title;
      emit(e.tUpdated, tabId, { title }, clone(tab));
    },
    dropNextEvents(n) {
      dropCount += n;
    },
  };
  return fake;
}
