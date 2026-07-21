<script lang="ts">
  import { onMount } from "svelte";
  import Window from "./Window.svelte";

  let currentWindow: chrome.windows.Window | undefined;
  let windows: (chrome.windows.Window | undefined)[] = [];
  let inputValue: string = "";

  $: currentWindowId = currentWindow?.id;

  const getQuery = (value: string) => {
    let query: { discarded?: boolean; url?: string[]; title?: string } = {};
    if (!value) {
      return query;
    }

    const matchWord = (word: string) => {
      if (!word) {
        return false;
      } else if (word === "loaded:" || word === "l:") {
        query.discarded = false;
        return false;
      } else {
        const match = word.match(/^site:(.+)$/);
        if (match) {
          query.url = ["*://" + match[1] + "/*", "*://*." + match[1] + "/*"];
          return false;
        } else {
          return true;
        }
      }
    };

    const words = value.trim().split(/\s+/).filter(matchWord);
    if (words.length !== 0) {
      query.title = "*" + words.join("*") + "*";
    }

    return query;
  };

  $: query = getQuery(inputValue);

  // メッセージリスナーを設定
  const messageListener = (message: any) => {
    if (
      message.type === "WINDOW_CREATED" ||
      message.type === "WINDOW_FOCUS_CHANGED" ||
      message.type === "WINDOW_REMOVED" ||
      (message.type === "TAB_DETACHED" && message.windowId === currentWindowId) // for Tab Manager tab moved to another existing window
    ) {
      updateWindows();
    }
  };

  // タブ情報を更新する関数
  const updateWindows = () => {
    chrome.windows.getCurrent({}, (result) => {
      currentWindow = result;
    });
    chrome.windows.getAll({}, (result) => {
      console.log("updateWindows", result);
      windows = result;
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
    {#if currentWindow?.id}
      {#key currentWindow?.id}
        <Window window={currentWindow} {query} isCurrent />
      {/key}
    {/if}
    {#each windows as window (window?.id)}
      {#if window?.id && window.id !== currentWindowId}
        <Window {window} {query} />
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
