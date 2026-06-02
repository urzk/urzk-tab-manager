<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowUp,
    faArrowDown,
    faArrowLeft,
    faArrowRight,
    faMinus,
    faUpRightFromSquare,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import TabButton from "./TabButton.svelte";

  export let tab: chrome.tabs.Tab;
  export let tabs: chrome.tabs.Tab[];
  export let isCurrent: boolean;

  const selectTab = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    }
  };

  const closeTab = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.remove(tab.id);
    }
  };

  const discardTab = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.discard(tab.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "Enter":
        selectTab();
        break;
      case "ArrowUp":
        moveTabToUp();
        break;
      case "ArrowLeft":
        moveTabToLeft();
        break;
      case "ArrowRight":
        moveTabToRight();
        break;
      case "ArrowDown":
        moveTabToDown();
        break;
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

  const moveTab = (shift: number) => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index + shift;
      checkIndex(newIndex) && chrome.tabs.move(tab.id, { index: newIndex });
    }
  };

  const moveTabToAnotherWindow = (windowId: number) => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.move(tab.id, { index: -1, windowId });
    }
  };

  const moveTabToCurrentWindow = () => {
    chrome.windows.getCurrent((window) => {
      window.id && moveTabToAnotherWindow(window.id);
    });
  };

  const swapTab = (tab1: chrome.tabs.Tab, tab2: chrome.tabs.Tab) => {
    const index1 = tab1.index;
    const index2 = tab2.index;
    tab1.id &&
      chrome.tabs.move(tab1.id, { index: index2 }, () => {
        tab2.id && chrome.tabs.move(tab2.id, { index: index1 });
      });
  };

  const moveTabVerticalShift = 4;

  const moveTabToUp = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index - moveTabVerticalShift;
      checkIndex(newIndex) && swapTab(tab, tabs[newIndex]);
    }
  };

  const moveTabToDown = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      const newIndex = tab.index + moveTabVerticalShift;
      checkIndex(newIndex) && swapTab(tab, tabs[newIndex]);
    }
  };

  const moveTabToLeft = () => {
    moveTab(-1);
  };

  const moveTabToRight = () => {
    moveTab(1);
  };

  const popOutToNewWindow = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.windows.create({ tabId: tab.id });
    }
  };
</script>

<div class="tab" id={`tab-${tab.id}`}>
  <TabButton
    title="discard tab"
    position="topleft"
    isActive={!tab.discarded}
    onClick={discardTab}
  >
    <FontAwesomeIcon icon={faMinus} />
  </TabButton>
  <TabButton
    title="close tab"
    position="topright"
    isActive={true}
    onClick={closeTab}
  >
    <FontAwesomeIcon icon={faXmark} />
  </TabButton>
  <TabButton
    title="pop out to new window"
    position="bottomleft"
    isActive={true}
    onClick={popOutToNewWindow}
  >
    <FontAwesomeIcon icon={faUpRightFromSquare} />
  </TabButton>
  <TabButton
    title="move to end of current window"
    position="bottomright"
    isActive={!isCurrent || tab.id !== tabs[tabs.length - 1].id}
    onClick={moveTabToCurrentWindow}
  >
    {#if isCurrent}
      <FontAwesomeIcon icon={faArrowDown} />
    {:else}
      <FontAwesomeIcon icon={faArrowUp} />
    {/if}
  </TabButton>

  <TabButton
    title="move up"
    position="top"
    isActive={tab.index >= moveTabVerticalShift}
    onClick={moveTabToUp}
  >
    <FontAwesomeIcon icon={faArrowUp} />
  </TabButton>

  <TabButton
    title="move left"
    position="left"
    isActive={tab.index > 0}
    onClick={moveTabToLeft}
  >
    <FontAwesomeIcon icon={faArrowLeft} />
  </TabButton>
  <TabButton
    title="move right"
    position="right"
    isActive={tab.index < tabs.length - 1}
    onClick={moveTabToRight}
  >
    <FontAwesomeIcon icon={faArrowRight} />
  </TabButton>
  <TabButton
    title="move down"
    position="bottom"
    isActive={tab.index < tabs.length - moveTabVerticalShift}
    onClick={moveTabToDown}
  >
    <FontAwesomeIcon icon={faArrowDown} />
  </TabButton>
  <div
    class="tab-container"
    class:tab-container-discarded={tab.discarded}
    role="button"
    tabindex="0"
    on:click={selectTab}
    on:keydown={onKeyDown}
  >
    <img src={tab.favIconUrl} alt="favicon" class="tab-favicon" />
    <div class="tab-text">
      <h3 class="tab-title">{tab.title}</h3>
      <p class="tab-url">{tab.url}</p>
    </div>
  </div>
</div>

<style>
  .tab {
    position: relative;
  }

  .tab-container {
    background-color: #ddd;
    border-radius: 0.25rem;
    color: black;
    cursor: pointer;
    display: flex;
    height: 96px;
    justify-content: space-between;
    padding: 1rem;
  }

  .tab-container-discarded {
    opacity: 0.5;
  }

  .tab-favicon {
    width: 24px;
    height: 24px;
  }
  .tab-text {
    width: 80%;
  }
  .tab-title {
    margin-top: 0;
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-url {
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
