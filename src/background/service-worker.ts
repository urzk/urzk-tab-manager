import { realChromeApi } from "../lib/chrome/api";
import { openManager } from "./open-manager";

// Registered synchronously at top level (MV3). The `_execute_action` shortcut
// triggers this listener too.
chrome.action.onClicked.addListener((tab) => {
  void openManager(
    realChromeApi(),
    chrome.runtime.getURL("newtab/index.html"),
    tab.windowId,
  );
});
