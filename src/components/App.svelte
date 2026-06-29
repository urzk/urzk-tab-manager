<script lang="ts">
  import { onMount } from "svelte";
  import Window from "./Window.svelte";

  let currentWindowId: number | undefined;
  let windowIds: (number | undefined)[] = [];

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
  <h1>Tabs</h1>
  <div class="container-tabs">
    {#if currentWindowId}
      {#key currentWindowId}
        <Window windowId={currentWindowId} isCurrent />
      {/key}
    {/if}
    {#each windowIds as id (id)}
      {#if id && id !== currentWindowId}
        <Window windowId={id} />
      {/if}
    {/each}
  </div>
</main>
