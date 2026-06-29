<script lang="ts">
  import { onMount } from "svelte";
  import Window from "./Window.svelte";

  let currentWindowId: number | undefined;
  let windowIds: (number | undefined)[] = [];
  let inputValue: string = "";

  const getQuery = (value: string) => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return undefined;
    }
    return "*" + words.join("*") + "*";
  };

  $: query = getQuery(inputValue);

  // メッセージリスナーを設定
  const messageListener = (message: any) => {
    if (
      message.type === "WINDOW_CREATED" ||
      message.type === "WINDOW_REMOVED" ||
      (message.type === "TAB_DETACHED" && message.windowId === currentWindowId) // for Tab Manager tab moved to another existing window
    ) {
      updateWindows();
    }
  };

  // タブ情報を更新する関数
  const updateWindows = () => {
    chrome.windows.getCurrent({}, (result) => {
      currentWindowId = result.id;
    });
    chrome.windows.getAll({}, (result) => {
      windowIds = result.map((w) => w.id);
    });
  };

  onMount(() => {
    // メッセージリスナーを登録
    chrome.runtime.onMessage.addListener(messageListener);
    // 現在のタブ一覧を取得して初期化
    updateWindows();
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  });
</script>

<main>
  <div class="head-container">
    <h1>Tabs</h1>
    <input
      class="search-input"
      type="text"
      placeholder="Search tabs..."
      bind:value={inputValue}
    />
  </div>
  <div class="container-tabs">
    {#if currentWindowId}
      {#key currentWindowId}
        <Window windowId={currentWindowId} {query} isCurrent />
      {/key}
    {/if}
    {#each windowIds as id (id)}
      {#if id && id !== currentWindowId}
        <Window windowId={id} {query} />
      {/if}
    {/each}
  </div>
</main>

<style>
  .head-container {
    display: flex;
    align-items: center;
  }
  .search-input {
    border: 0;
    border-radius: 16px;
    background-color: #ddd;
    font-size: 16px;
    line-height: 1.5;
    margin-left: 16px;
    outline: none;
    padding: 4px 16px;
  }
</style>
