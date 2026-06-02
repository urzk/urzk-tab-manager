chrome.windows.onCreated.addListener((window) => {
  chrome.runtime.sendMessage({ type: "WINDOW_CREATED" });
});

chrome.windows.onRemoved.addListener((windowId) => {
  chrome.runtime.sendMessage({ type: "WINDOW_REMOVED" });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_ACTIVATED", data: activeInfo });
});

chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  chrome.runtime.sendMessage({
    type: "TAB_ATTACHED",
    windowId: attachInfo.newWindowId,
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  chrome.runtime.sendMessage({
    type: "TAB_CREATED",
    windowId: tab.windowId,
  });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  chrome.runtime.sendMessage({
    type: "TAB_DETACHED",
    windowId: detachInfo.oldWindowId,
  });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  chrome.runtime.sendMessage({
    type: "TAB_MOVED",
    windowId: moveInfo.windowId,
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.runtime.sendMessage({
    type: "TAB_REMOVED",
    windowId: removeInfo.windowId,
  });
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  chrome.runtime.sendMessage({
    type: "TAB_REPLACED",
    // windowId: removeInfo.windowId,
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.runtime.sendMessage({ type: "TAB_UPDATED", windowId: tab.windowId });
});
