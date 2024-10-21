<script lang="ts">
  export let tab: chrome.tabs.Tab;
  export let tabs: chrome.tabs.Tab[];

  const selectTab = (tabId?: number) => {
    if (!tabId) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.update(tabId, { active: true });
    }
  };

  const closeTab = (tabId?: number) => {
    if (!tabId) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.remove(tabId);
    }
  };

  const discardTab = (tabId?: number) => {
    if (!tabId) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.discard(tabId);
    }
  };

  const checkIndex = (index: number) => {
    if (index < 0 || tabs.length <= index) {
      console.error("error: Invalid index");
      return false;
    } else {
      return true;
    }
  };

  const moveTab = (tab: chrome.tabs.Tab, shift: number) => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index + shift;
      checkIndex(newIndex) && chrome.tabs.move(tab.id, { index: newIndex });
    }
  };

  const swapTab = (tab1: chrome.tabs.Tab, tab2: chrome.tabs.Tab) => {
    const index1 = tab1.index;
    const index2 = tab2.index;
    if (!tab1.id || !tab2.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.move(tab1.id, { index: index2 });
      chrome.tabs.move(tab2.id, { index: index1 });
    }
  };

  const moveTabVerticalShift = 4;

  const moveTabToUp = (tab: chrome.tabs.Tab) => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index - moveTabVerticalShift;
      checkIndex(newIndex) && swapTab(tab, tabs[newIndex]);
    }
  };

  const moveTabToDown = (tab: chrome.tabs.Tab) => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index + moveTabVerticalShift;
      checkIndex(newIndex) && swapTab(tab, tabs[newIndex]);
    }
  };

  const moveTabToLeft = (tab: chrome.tabs.Tab) => {
    moveTab(tab, -1);
  };

  const moveTabToRight = (tab: chrome.tabs.Tab) => {
    moveTab(tab, 1);
  };
</script>

<div class="item-tab" id={tab.id}>
  <div
    class="item-tab-button item-tab-button-discard"
    role="button"
    tabindex="0"
    on:click={discardTab(tab.id)}
  >
    &minus;
  </div>
  <div
    class="item-tab-button item-tab-button-close"
    role="button"
    tabindex="0"
    on:click={closeTab(tab.id)}
  >
    &cross;
  </div>
  <div
    class="item-tab-button item-tab-button-up"
    role="button"
    tabindex="0"
    on:click={moveTabToUp(tab)}
  >
    &uparrow;
  </div>
  <div
    class="item-tab-button item-tab-button-left"
    role="button"
    tabindex="0"
    on:click={moveTabToLeft(tab)}
  >
    &leftarrow;
  </div>
  <div
    class="item-tab-button item-tab-button-right"
    role="button"
    tabindex="0"
    on:click={moveTabToRight(tab)}
  >
    &rightarrow;
  </div>
  <div
    class="item-tab-button item-tab-button-down"
    role="button"
    tabindex="0"
    on:click={moveTabToDown(tab)}
  >
    &downarrow;
  </div>
  <div
    class="item-tab-container"
    class:item-tab-container-discarded={tab.discarded}
    role="button"
    tabindex="0"
    on:click={selectTab(tab.id)}
    on:keydown={selectTab(tab.id)}
  >
    <img src={tab.favIconUrl} alt="favicon" class="item-tab-favicon" />
    <div class="item-tab-text">
      <h3 class="item-tab-title">{tab.title}</h3>
      <p class="item-tab-url">{tab.url}</p>
    </div>
  </div>
</div>

<style>
  .item-tab-container-discarded {
    opacity: 0.5;
  }
  .item-tab {
    position: relative;
  }

  .item-tab-container {
    background-color: aliceblue;
    border-radius: 0.25rem;
    color: black;
    display: flex;
    height: 96px;
    justify-content: space-between;
    padding: 1rem;
  }

  .item-tab-button {
    opacity: 0;
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: #000;
    color: white;
    font-size: 20px;
    line-height: 1;
    text-align: center;
    transition: opacity 0.5s ease;
    z-index: 100;
  }

  .item-tab:hover > .item-tab-button {
    opacity: 1;
  }

  .item-tab-button-discard {
    border-radius: 100px;
    transform: translate(-50%, -50%);
    top: 0;
    left: 0;
  }
  .item-tab-button-close {
    border-radius: 100px;
    transform: translate(50%, -50%);
    top: 0;
    right: 0;
  }

  .item-tab-button-up {
    transform: translate(-50%, -50%);
    top: 0.25rem;
    left: 50%;
  }
  .item-tab-button-left {
    transform: translate(-50%, -50%);
    top: 50%;
    left: 0.25rem;
  }

  .item-tab-button-right {
    transform: translate(50%, -50%);
    top: 50%;
    right: 0.25rem;
  }

  .item-tab-button-down {
    transform: translate(-50%, 50%);
    bottom: 0.25rem;
    left: 50%;
  }

  .item-tab-favicon {
    width: 24px;
    height: 24px;
  }
  .item-tab-text {
    width: 80%;
  }
  .item-tab-title {
    margin-top: 0;
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-tab-url {
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
