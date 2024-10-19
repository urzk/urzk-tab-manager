chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "tablist.html" });
});
