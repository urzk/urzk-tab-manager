import type { ChromeApi } from "../lib/chrome/api";

const isManager = (t: chrome.tabs.Tab, managerUrl: string): boolean =>
  t.url === managerUrl || t.pendingUrl === managerUrl;

/**
 * Switches to the manager tab in the given window (the leftmost one if there
 * are several) or opens a new one there. Manager tabs in other windows are
 * ignored. Without a window id, Chrome's current window is used.
 */
export async function openManager(
  api: ChromeApi,
  managerUrl: string,
  currentWindowId: number | undefined,
): Promise<void> {
  try {
    const inWindow = await api.tabs.query(
      currentWindowId === undefined
        ? { currentWindow: true }
        : { windowId: currentWindowId },
    );
    const target = inWindow
      .filter((t) => isManager(t, managerUrl))
      .sort((a, b) => a.index - b.index)[0];
    if (target?.id !== undefined) {
      await api.tabs.update(target.id, { active: true });
    } else {
      await api.tabs.create({ url: managerUrl, windowId: currentWindowId });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("openManager failed", e);
  }
}
