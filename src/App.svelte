<script>
  import { onMount } from "svelte";
  import ItemTab from "./components/ItemTab.svelte";

  let tabs = [];

  onMount(() => {
    // Chrome タブ一覧を取得
    chrome.tabs.query({ currentWindow: true }, function (result) {
      tabs = result;
    });
  });
</script>

<main>
  <div class="container-tabs">
    <h2>Open Tabs</h2>
    <ul>
      {#each tabs as tab}
        <ItemTab title={tab.title} url={tab.url} />
      {/each}
    </ul>
  </div>
</main>

<style>
  .container-tabs {
    padding: 4rem;
  }
  .container-tabs ul {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    margin: 0;
    padding: 0;
  }
</style>
