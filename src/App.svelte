<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import ItemTab from "./components/ItemTab.svelte";

  let tabs: chrome.tabs.Tab[] = [];

  // タブ情報を更新する関数
  const updateTabs = () => {
    chrome.tabs.query({ currentWindow: true }, (result) => {
      tabs = result;
    });
  };

  // メッセージリスナーを設定
  const messageListener = (message: any) => {
    if (message.type === "TAB_CHANGED") {
      updateTabs();
    }
  };

  onMount(() => {
    // 現在のタブ一覧を取得して初期化
    updateTabs();
    // メッセージリスナーを登録
    chrome.runtime.onMessage.addListener(messageListener);
  });
</script>

<main>
  <div class="container-tabs">
    <h2>Tabs</h2>
    <ul>
      {#each tabs as tab (tab.id)}
        <li animate:flip={{ duration: (d) => Math.sqrt(d) * 20 }}>
          <ItemTab
            faviconUrl={tab.favIconUrl}
            id={tab.id}
            index={tab.index}
            title={tab.title}
            url={tab.url}
          />
        </li>
      {/each}
    </ul>
  </div>
</main>

<style>
  .container-tabs {
    padding: 2rem 4rem;
  }
  .container-tabs ul {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0;
    padding: 0;
  }
  .container-tabs ul > li {
    display: block;
    margin: 0;
    padding: 0;
    width: 300px;
  }
</style>
