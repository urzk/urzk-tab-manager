<script lang="ts">
  import { onMount, setContext, untrack } from "svelte";
  import { createActions } from "../../lib/chrome/actions";
  import type { ChromeApi } from "../../lib/chrome/api";
  import { t } from "../../lib/i18n";
  import { parseQuery } from "../../lib/query";
  import { emptyState, type State } from "../../lib/state/model";
  import { createTabSync, type TabSync } from "../../lib/state/sync";
  import WindowSection from "./WindowSection.svelte";

  type Props = {
    api: ChromeApi;
    getURL: (p: string) => string;
    sync?: TabSync;
  };
  let props: Props = $props();

  // The page is created once per mount; later prop changes are not supported.
  const { api, getURL, sync } = untrack(() => ({
    api: props.api,
    getURL: props.getURL,
    sync:
      props.sync ??
      createTabSync(props.api, {
        onMismatch: import.meta.env.DEV
          ? (n) => console.warn("reconcile mismatches", n)
          : undefined,
      }),
  }));

  setContext("getURL", getURL);
  const actions = createActions(api);

  let tabState = $state.raw<State>(emptyState);
  let input = $state("");
  let hoveredId = $state<number | null>(null);

  const query = $derived(parseQuery(input));
  const currentId = $derived(tabState.currentWindowId);
  const current = $derived(
    currentId === undefined ? undefined : tabState.windows.get(currentId),
  );
  const others = $derived(
    tabState.windowOrder.filter(
      (id) =>
        id !== currentId &&
        tabState.windows.has(id) &&
        tabState.tabIdsByWindow.has(id),
    ),
  );

  const onHover = (id: number | null) => {
    hoveredId = id;
  };

  onMount(() => {
    const unsubscribe = sync.subscribe((s) => {
      tabState = s;
    });
    void sync.start();
    const onVisibility = () =>
      sync.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
      sync.stop();
    };
  });
</script>

{#snippet section(id: number, isCurrent: boolean)}
  {@const win = tabState.windows.get(id)}
  {@const tabIds = tabState.tabIdsByWindow.get(id)}
  {#if win && tabIds}
    <WindowSection
      window={win}
      {tabIds}
      tabs={tabState.tabs}
      {isCurrent}
      {query}
      {actions}
      {hoveredId}
      {onHover}
    />
  {/if}
{/snippet}

<main>
  <div class="head-container">
    <h1>{t("heading")}</h1>
    <input
      class="search-input"
      type="text"
      placeholder={t("searchPlaceholder")}
      aria-label={t("searchPlaceholder")}
      bind:value={input}
    />
  </div>
  <div class="container-tabs">
    {#if current}
      <!-- remount on change so the new current window starts expanded -->
      {#key current.id}
        {@render section(current.id, true)}
      {/key}
    {/if}
    {#each others as id (id)}
      {@render section(id, false)}
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
