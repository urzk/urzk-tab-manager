<script lang="ts">
  export let title: string = "";
  export let url: string = "";
  export let id: number = 0;
  export let faviconUrl: string = "";

  const selectTab = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };
</script>

<li class="item-tab" {id}>
  <div class="item-tab-button-left">&leftarrow;</div>
  <div class="item-tab-container" on:click={() => selectTab(id)}>
    <img src={faviconUrl} alt="favicon" class="item-tab-favicon" />
    <div class="item-tab-text">
      <h3 class="item-tab-title">{title}</h3>
      <p class="item-tab-url">{url}</p>
    </div>
  </div>
  <div class="item-tab-button-right">&rightarrow;</div>
</li>

<style>
  li {
    margin: 0;
    padding: 0;
    width: 300px;
  }

  .item-tab {
    position: relative;
    background-color: aliceblue;
    border-radius: 0.25rem;
    color: black;
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
