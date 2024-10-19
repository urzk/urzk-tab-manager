<script lang="ts">
  export let title: string = "";
  export let url: string = "";
  export let id: number = 0;
  //  export let thumb: string;

  const selectTab = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };
</script>

<li class="item-tab" {id} on:click={() => selectTab(id)}>
  <div class="item-tab-thumb"></div>
  <div class="item-tab-text">
    <h3 class="item-tab-title">{title}</h3>
    <p class="item-tab-url">{url}</p>
  </div>
</li>

<style>
  li {
    margin: 0;
    padding: 0;
    width: 300px;
  }

  .item-tab {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    background-color: aliceblue;
    border-radius: 0.25rem;
    color: black;
  }

  .item-tab-thumb {
    width: 25%;
    height: 32px;
    background-color: aqua;
  }
  .item-tab-text {
    width: 70%;
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
