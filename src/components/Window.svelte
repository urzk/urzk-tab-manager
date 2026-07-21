<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import Tab from "./Tab.svelte";

  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCaretDown,
    faCaretRight,
    faSpinner,
    faRectangleXmark,
    faWindowMaximize,
    faWindowMinimize,
  } from "@fortawesome/free-solid-svg-icons";

  export let window: chrome.windows.Window;
  export let isCurrent: boolean = false;
  export let query: { discarded?: boolean; url?: string[]; title?: string };

  let tabs: chrome.tabs.Tab[] = [];
  let isHidden: boolean = !isCurrent;
  let width: number = 0;
  let isLoading: boolean = true;

  const tabWidth = 288;
  const tabGap = 16;

  $: windowId = window.id as number;
  $: columns = Math.floor((width + tabGap) / (tabWidth + tabGap));
  $: hasQuery = Object.keys(query).length !== 0;

  const messageListener = (message: any) => {
    if (message.windowId === windowId) {
      updateTabs();
    }
  };

  const updateTabs = async () => {
    isLoading = true;
    try {
      tabs = await chrome.tabs.query({ windowId, ...query });
    } catch (e) {
      console.error(e);
      tabs = [];
    }
    isLoading = false;
  };

  $: query, updateTabs();

  const focusWindow = () => {
    chrome.windows.update(windowId, { focused: true });
  };

  const minimizeWindow = () => {
    chrome.windows.update(windowId, { state: "minimized" });
  };

  const closeWindow = () => {
    chrome.windows.remove(windowId);
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
      >{isCurrent ? "Current " : ""}Window (ID: #{windowId},
      {#if isLoading}
        <FontAwesomeIcon icon={faSpinner} spin />
      {:else}
        {tabs.length} tabs
      {/if})</a
    >&nbsp;
    <div class="window-buttons">
      {#if window.state !== "minimized"}
        <small title="minimize window" on:click={minimizeWindow}
          ><FontAwesomeIcon icon={faWindowMinimize} /></small
        >
      {/if}
      <small title="focus window" on:click={focusWindow}
        ><FontAwesomeIcon icon={faWindowMaximize} /></small
      ><small title="close window" on:click={closeWindow}
        ><FontAwesomeIcon icon={faRectangleXmark} /></small
      >
    </div>
  </h2>
  <ul class:is-hidden={isHidden} bind:clientWidth={width}>
    {#each tabs as tab (tab.id)}
      <li animate:flip={{ duration: 400 }}>
        <Tab {tab} {tabs} {isCurrent} {columns} {hasQuery} />
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

  .window-buttons {
    display: inline-flex;
    align-items: center;
  }
</style>
