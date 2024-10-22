<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import ItemTab from "./components/ItemTab.svelte";
  import Window from "./components/Window.svelte";

  let currentWindow: chrome.windows.Window;
  let windows: chrome.windows.Window[] = [];

  // タブ情報を更新する関数
  const update = () => {
    chrome.windows.getCurrent({}, (result) => {
      currentWindow = result;
    });
    chrome.windows.getAll({}, (result) => {
      windows = result;
    });
  };

  // メッセージリスナーを設定
  const messageListener = (message: any) => {
    if (message.type === "TAB_CHANGED") {
      update();
    }
  };

  onMount(() => {
    // 現在のタブ一覧を取得して初期化
    update();
    // メッセージリスナーを登録
    chrome.runtime.onMessage.addListener(messageListener);
  });
</script>

<main>
  <h1>Tabs</h1>
  <div class="container-tabs">
    {#each windows as window (window.id)}
      <Window {window} isCurrent={window.id == currentWindow.id} />
    {/each}
  </div>
</main>
