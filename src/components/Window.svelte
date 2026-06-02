<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import Tab from "./Tab.svelte";

  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSquareMinus } from "@fortawesome/free-regular-svg-icons";

  export let windowId: number;
  export let isCurrent: boolean = false;

  let tabs: chrome.tabs.Tab[] = [];
  let isHidden: boolean = !isCurrent;

  const messageListener = (message: any) => {
    if (message.windowId === windowId) {
      updateTabs();
    }
  };

  const updateTabs = () => {
    chrome.tabs.query({ windowId }, (result) => {
      tabs = result;
    });
  };

  const openWindow = () => {
    isHidden = false;
  };

  const toggleWindow = () => {
    isHidden = !isHidden;
  };

  const allDiscard = () => {
    tabs.forEach((tab) => {
      if (tab.id) chrome.tabs.discard(tab.id);
    });
  };

  onMount(() => {
    chrome.runtime.onMessage.addListener(messageListener);
    updateTabs();
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  });
</script>

<div class:window-current={isCurrent}>
  <h2 id={`window-${windowId}`}>
    <a href={`#window-${windowId}`} on:click={toggleWindow}
      >{isCurrent ? "Current " : ""}Window (ID: #{windowId}, {tabs.length} tabs)</a
    >&nbsp;<span title="discard all tabs in this window" on:click={allDiscard}
      ><FontAwesomeIcon icon={faSquareMinus} /></span
    >
  </h2>
  <ul class:is-hidden={isHidden}>
    {#each tabs as tab (tab.id)}
      <li animate:flip={{ duration: 400 }}>
        <Tab {tab} {tabs} {isCurrent} />
      </li>
    {/each}
  </ul>
</div>
