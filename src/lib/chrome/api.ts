export type Listener<A extends unknown[]> = {
  addListener(fn: (...a: A) => void): void;
  removeListener(fn: (...a: A) => void): void;
};

/** The slice of the `chrome.*` API the app uses. All Chrome access goes through this. */
export interface ChromeApi {
  windows: {
    getAll(o: { populate: true }): Promise<chrome.windows.Window[]>;
    getCurrent(): Promise<chrome.windows.Window>;
    update(id: number, info: chrome.windows.UpdateInfo): Promise<unknown>;
    remove(id: number): Promise<void>;
    create(data: chrome.windows.CreateData): Promise<unknown>;
    onCreated: Listener<[chrome.windows.Window]>;
    onRemoved: Listener<[number]>;
    onFocusChanged: Listener<[number]>;
  };
  tabs: {
    query(q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
    get(id: number): Promise<chrome.tabs.Tab>;
    getCurrent(): Promise<chrome.tabs.Tab | undefined>;
    update(id: number, p: chrome.tabs.UpdateProperties): Promise<unknown>;
    move(id: number, p: { index: number; windowId?: number }): Promise<unknown>;
    remove(id: number): Promise<void>;
    discard(id: number): Promise<unknown>;
    create(p: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
    onCreated: Listener<[chrome.tabs.Tab]>;
    onUpdated: Listener<[number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab]>;
    onMoved: Listener<[number, chrome.tabs.OnMovedInfo]>;
    onAttached: Listener<[number, chrome.tabs.OnAttachedInfo]>;
    onDetached: Listener<[number, chrome.tabs.OnDetachedInfo]>;
    onRemoved: Listener<[number, chrome.tabs.OnRemovedInfo]>;
    onReplaced: Listener<[number, number]>;
    onActivated: Listener<[chrome.tabs.OnActivatedInfo]>;
  };
}

export function realChromeApi(): ChromeApi {
  return chrome as unknown as ChromeApi;
}
