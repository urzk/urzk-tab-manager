import type { TabLite } from "../state/model";
import type { ChromeApi } from "./api";

/**
 * User-initiated Chrome operations. None of them ever rejects: on failure the
 * error is logged (dev only) and the sync layer's reconcile repairs the display.
 * Indexes must come from the latest `State` (`tabIndex`), not stale `TabLite`s.
 */
export type Actions = {
  focusTab(t: TabLite): Promise<void>;
  closeTab(id: number): Promise<void>;
  discardTab(id: number): Promise<void>;
  moveTab(id: number, index: number): Promise<void>;
  moveToWindow(id: number, windowId: number): Promise<void>;
  moveToCurrentWindow(id: number): Promise<void>;
  swapTabs(
    aId: number,
    aIndex: number,
    bId: number,
    bIndex: number,
  ): Promise<void>;
  popOut(id: number): Promise<void>;
  focusWindow(id: number): Promise<void>;
  minimizeWindow(id: number): Promise<void>;
  closeWindow(id: number): Promise<void>;
};

export function createActions(api: ChromeApi): Actions {
  /** Runs `fn`, swallowing failures. Resolves true only if it succeeded. */
  async function guard(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.warn(`[actions] ${name} failed`, err);
      return false;
    }
  }
  const run = async (name: string, fn: () => Promise<unknown>) => {
    await guard(name, fn);
  };

  return {
    focusTab: (t) =>
      run("focusTab", async () => {
        await api.tabs.update(t.id, { active: true });
        await api.windows.update(t.windowId, { focused: true });
      }),
    closeTab: (id) => run("closeTab", () => api.tabs.remove(id)),
    discardTab: (id) => run("discardTab", () => api.tabs.discard(id)),
    moveTab: (id, index) => run("moveTab", () => api.tabs.move(id, { index })),
    moveToWindow: (id, windowId) =>
      run("moveToWindow", () => api.tabs.move(id, { windowId, index: -1 })),
    moveToCurrentWindow: (id) =>
      run("moveToCurrentWindow", async () => {
        const w = await api.windows.getCurrent();
        await api.tabs.move(id, { windowId: w.id, index: -1 });
      }),
    swapTabs: async (aId, aIndex, bId, bIndex) => {
      const first = await guard("swapTabs", () =>
        api.tabs.move(aId, { index: bIndex }),
      );
      if (first) {
        await run("swapTabs", () => api.tabs.move(bId, { index: aIndex }));
      }
    },
    popOut: (id) => run("popOut", () => api.windows.create({ tabId: id })),
    focusWindow: (id) =>
      run("focusWindow", () => api.windows.update(id, { focused: true })),
    minimizeWindow: (id) =>
      run("minimizeWindow", () =>
        api.windows.update(id, { state: "minimized" }),
      ),
    closeWindow: (id) => run("closeWindow", () => api.windows.remove(id)),
  };
}
