chrome.tabs.onActivated.addListener((activeInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_ACTIVATED", data: activeInfo });
});

chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_ATTACHED", data: attachInfo });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onCreated.addListener((tab) => {
  // chrome.runtime.sendMessage({ type: "TAB_CREATED", data: tab });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_DETACHED", data: detachInfo });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_MOVED", data: moveInfo });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // chrome.runtime.sendMessage({ type: "TAB_REMOVED", data: removeInfo });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  // chrome.runtime.sendMessage({ type: "TAB_REPLACED", data: removeInfo });
  chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // chrome.runtime.sendMessage({ type: "TAB_UPDATED", data: tab });
    chrome.runtime.sendMessage({ type: "TAB_CHANGED" });
  }
});
