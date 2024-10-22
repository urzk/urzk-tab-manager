<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import ItemTab from "./ItemTab.svelte";

  export let window: chrome.windows.Window;
  export let isCurrent: boolean = false;

  let tabs: chrome.tabs.Tab[] = [];
  let isHidden: boolean = !isCurrent;

  const updateTabs = () => {
    chrome.tabs.query({ windowId: window.id }, (result) => {
      tabs = result;
    });
  };

  const messageListener = (message: any) => {
    if (message.type === "TAB_CHANGED") {
      updateTabs();
    }
  };

  const openWindow = () => {
    isHidden = false;
  };

  const toggleWindow = () => {
    isHidden = !isHidden;
  };

  onMount(() => {
    updateTabs();
    chrome.runtime.onMessage.addListener(messageListener);
  });
</script>

<div class:window-current={isCurrent} tabindex={isCurrent ? "1" : "0"}>
  <h2 id={window.id}>
    <a href={"#" + window.id} on:click={toggleWindow}
      >{isCurrent ? "Current " : ""}Window (ID: #{window.id}, {tabs.length} tabs)</a
    >
  </h2>
  <ul class:is-hidden={isHidden}>
    {#each tabs as tab (tab.id)}
      <li animate:flip={{ duration: 400 }}>
        <ItemTab {tab} {tabs} />
      </li>
    {/each}
  </ul>
</div>
