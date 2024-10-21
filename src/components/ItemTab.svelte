<script lang="ts">
  export let faviconUrl: string = "";
  export let id: number = 0;
  export let index: number;
  export let title: string = "";
  export let url: string = "";

  const selectTab = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };

  const moveTab = (tabId: number, tabIndex: number, shift: number) => {
    chrome.tabs.move(tabId, { index: tabIndex + shift }, (movedTab) => {
      if (chrome.runtime.lastError) {
        console.error("failed to move tab: " + chrome.runtime.lastError);
      }
    });
  };

  const moveTabToLeft = (tabId: number, tabIndex: number) => {
    moveTab(tabId, tabIndex, -1);
  };

  const moveTabToRight = (tabId: number, tabIndex: number) => {
    moveTab(tabId, tabIndex, 1);
  };
</script>

<div class="item-tab" {id}>
  <div
    class="item-tab-button-left"
    role="button"
    tabindex="0"
    on:click={moveTabToLeft(id, index)}
    on:keydown={moveTabToLeft(id, index)}
  >
    &leftarrow;
  </div>
  <div
    class="item-tab-container"
    role="button"
    tabindex="0"
    on:click={selectTab(id)}
    on:keydown={selectTab(id)}
  >
    <img src={faviconUrl} alt="favicon" class="item-tab-favicon" />
    <div class="item-tab-text">
      <h3 class="item-tab-title">{title}</h3>
      <p class="item-tab-url">{url}</p>
    </div>
  </div>
  <div
    class="item-tab-button-right"
    role="button"
    tabindex="0"
    on:click={moveTabToRight(id, index)}
    on:keydown={moveTabToRight(id, index)}
  >
    &rightarrow;
  </div>
</div>

<style>
  .item-tab {
    position: relative;
    background-color: aliceblue;
    border-radius: 0.25rem;
    color: black;
    height: 100%;
  }

  .item-tab-container {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
  }

  .item-tab-button-left,
  .item-tab-button-right {
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: #000;
    color: white;
    font-size: 20px;
    line-height: 1;
    text-align: center;
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
