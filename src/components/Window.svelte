<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import Tab from "./Tab.svelte";

  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faEye, faSquareMinus } from "@fortawesome/free-regular-svg-icons";
  import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";

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

  const focusWindow = () => {
    chrome.windows.update(windowId, { focused: true });
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

<div>
  <h2 id={`window-${windowId}`}>
    <div class="window-toggle" on:click={toggleWindow}>
      {#if isHidden}
        <FontAwesomeIcon icon={faCaretRight} />
      {:else}
        <FontAwesomeIcon icon={faCaretDown} />
      {/if}
    </div>
    <a href={`#window-${windowId}`} on:click={openWindow}
      >{isCurrent ? "Current " : ""}Window (ID: #{windowId}, {tabs.length} tabs)</a
    >&nbsp;<span title="discard all tabs in this window" on:click={allDiscard}
      ><FontAwesomeIcon icon={faSquareMinus} /></span
    ><span title="focus window" on:click={focusWindow}
      ><FontAwesomeIcon icon={faEye} /></span
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

<style>
  h2 {
    margin: 1rem 0;
    position: relative;
    scroll-margin-top: 1rem;
  }

  h2 a {
    color: #eee;
  }

  .window-toggle {
    position: absolute;
    left: -1.5rem;
    top: 0rem;
    cursor: pointer;
  }
</style>
