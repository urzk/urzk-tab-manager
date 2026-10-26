import type { ChromeApi } from "../lib/chrome/api";

const isManager = (t: chrome.tabs.Tab, managerUrl: string): boolean =>
  [t.url, t.pendingUrl].some(
    (u) =>
      u !== undefined && (u === managerUrl || u.startsWith("chrome://newtab")),
  );

/** Focuses an open manager tab (preferring the current window) or opens one. */
export async function openManager(
  api: ChromeApi,
  managerUrl: string,
  currentWindowId: number | undefined,
): Promise<void> {
  try {
    const found = (await api.tabs.query({})).filter((t) =>
      isManager(t, managerUrl),
    );
    const target =
      found.find((t) => t.windowId === currentWindowId) ?? found[0];
    if (target?.id !== undefined) {
      await api.tabs.update(target.id, { active: true });
      await api.windows.update(target.windowId, { focused: true });
    } else {
      await api.tabs.create({ url: managerUrl, windowId: currentWindowId });
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("openManager failed", e);
  }
}
