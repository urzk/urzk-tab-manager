<script lang="ts">
  export let tab: chrome.tabs.Tab;
  export let tabs: chrome.tabs.Tab[];
  export let isCurrent: boolean;

  const selectTab = () => {
    if (!tab.id) {
      console.error("error: Unset tab ID");
    } else {
      chrome.tabs.update(tab.id, { active: true });
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
</script>

<div class="tab" id={tab.id}>
  <div
    class="tab-button tab-button-discard"
    class:tab-button-active={!tab.discarded}
    role="button"
    tabindex="-1"
    on:click={discardTab}
  >
    &minus;
  </div>
  <div
    class="tab-button tab-button-close tab-button-active"
    role="button"
    tabindex="-1"
    on:click={closeTab}
  >
    &cross;
  </div>
  <!-- move to current window -->
  <div
    class="tab-button tab-button-to-current tab-button-active"
    role="button"
    tabindex="-1"
    on:click={moveTabToCurrentWindow}
  >
    {isCurrent ? "↓" : "↑"}
  </div>
  <div
    class="tab-button tab-button-up"
    class:tab-button-active={tab.index >= moveTabVerticalShift}
    role="button"
    tabindex="-1"
    on:click={moveTabToUp}
  >
    &uparrow;
  </div>
  <div
    class="tab-button tab-button-left"
    class:tab-button-active={tab.index > 0}
    role="button"
    tabindex="-1"
    on:click={moveTabToLeft}
  >
    &leftarrow;
  </div>
  <div
    class="tab-button tab-button-right"
    class:tab-button-active={tab.index < tabs.length - 1}
    role="button"
    tabindex="-1"
    on:click={moveTabToRight}
  >
    &rightarrow;
  </div>
  <div
    class="tab-button tab-button-down"
    class:tab-button-active={tab.index < tabs.length - moveTabVerticalShift}
    role="button"
    tabindex="-1"
    on:click={moveTabToDown}
  >
    &downarrow;
  </div>
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
  .tab-container-discarded {
    opacity: 0.5;
  }
  .tab {
    position: relative;
  }

  .tab-container {
    background-color: aliceblue;
    border-radius: 0.25rem;
    color: black;
    cursor: pointer;
    display: flex;
    height: 96px;
    justify-content: space-between;
    padding: 1rem;
  }

  .tab-button {
    cursor: pointer;
    display: none;
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

  .tab-button-active {
    display: block;
  }

  .tab:hover > .tab-button {
    opacity: 1;
  }

  .tab-button-to-current {
    border-radius: 100px;
    transform: translate(50%, 50%);
    bottom: 0;
    right: 0;
  }

  .tab-button-discard {
    border-radius: 100px;
    transform: translate(-50%, -50%);
    top: 0;
    left: 0;
  }

  .tab-button-close {
    border-radius: 100px;
    transform: translate(50%, -50%);
    top: 0;
    right: 0;
  }

  .tab-button-up {
    transform: translate(-50%, -50%);
    top: 0.25rem;
    left: 50%;
  }
  .tab-button-left {
    transform: translate(-50%, -50%);
    top: 50%;
    left: 0.25rem;
  }

  .tab-button-right {
    transform: translate(50%, -50%);
    top: 50%;
    right: 0.25rem;
  }

  .tab-button-down {
    transform: translate(-50%, 50%);
    bottom: 0.25rem;
    left: 50%;
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
