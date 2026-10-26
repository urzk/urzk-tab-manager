<script lang="ts">
  import { flip } from "svelte/animate";
  import Icon from "../../icons/Icon.svelte";
  import type { Actions } from "../../lib/chrome/actions";
  import { t } from "../../lib/i18n";
  import { isEmptyQuery, matchesTab, type Query } from "../../lib/query";
  import type { TabLite, WindowLite } from "../../lib/state/model";
  import { FLIP_MAX_TABS, TAB_GAP, TAB_WIDTH } from "../constants";
  import TabCard from "./TabCard.svelte";

  type Props = {
    window: WindowLite;
    tabIds: readonly number[];
    tabs: ReadonlyMap<number, TabLite>;
    isCurrent: boolean;
    query: Query;
    actions: Actions;
    hoveredId: number | null;
    onHover: (id: number | null) => void;
  };
  let {
    window,
    tabIds,
    tabs,
    isCurrent,
    query,
    actions,
    hoveredId,
    onHover,
  }: Props = $props();

  // Initial value only: the App remounts the section when it becomes current.
  // svelte-ignore state_referenced_locally
  let expanded = $state(isCurrent);
  let width = $state(0);

  const hasQuery = $derived(!isEmptyQuery(query));
  const visible = $derived(
    hasQuery
      ? tabIds.filter((id) => {
          const tab = tabs.get(id);
          return tab !== undefined && matchesTab(query, tab);
        })
      : tabIds,
  );
  // Card positions are in full window order, not the filtered list.
  const positions = $derived(new Map(tabIds.map((id, i) => [id, i])));
  // Chrome keeps pinned tabs first, so they form a prefix of tabIds.
  const pinnedCount = $derived(
    tabIds.filter((id) => tabs.get(id)?.pinned).length,
  );
  const columns = $derived(
    Math.max(1, Math.floor((width + TAB_GAP) / (TAB_WIDTH + TAB_GAP))),
  );
  const title = $derived(
    t(isCurrent ? "currentWindowTitle" : "windowTitle", String(window.id)),
  );
  const countLabel = $derived(
    visible.length === 1
      ? t("tabCountOne")
      : t("tabCount", String(visible.length)),
  );
  const neighbor = (i: number): number | undefined => tabIds[i];

  function toggle() {
    expanded = !expanded;
  }
  function onToggleKey(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }
</script>

{#snippet card(id: number)}
  {@const tab = tabs.get(id)}
  {#if tab}
    <TabCard
      {tab}
      index={positions.get(id) ?? -1}
      count={tabIds.length}
      {pinnedCount}
      {columns}
      {isCurrent}
      {hasQuery}
      showActions={hoveredId === id}
      {actions}
      {neighbor}
      {onHover}
    />
  {/if}
{/snippet}

{#if !hasQuery || visible.length > 0}
  <div>
    <h2 id={`window-${window.id}`}>
      <div
        class="window-toggle"
        role="button"
        tabindex="0"
        title={t("toggleWindow")}
        aria-label={t("toggleWindow")}
        aria-expanded={expanded}
        onclick={toggle}
        onkeydown={onToggleKey}
      >
        <Icon name={expanded ? "caretDown" : "caretRight"} />
      </div>
      <a href={`#window-${window.id}`} onclick={() => (expanded = true)}
        >{title} ({countLabel})</a
      >&nbsp;
      <div class="window-buttons">
        {#if window.state !== "minimized"}
          <button
            type="button"
            class="window-button"
            title={t("minimizeWindow")}
            onclick={() => void actions.minimizeWindow(window.id)}
            ><Icon name="windowMinimize" /></button
          >
        {/if}
        <button
          type="button"
          class="window-button"
          title={t("focusWindow")}
          onclick={() => void actions.focusWindow(window.id)}
          ><Icon name="windowMaximize" /></button
        ><button
          type="button"
          class="window-button"
          title={t("closeWindow")}
          onclick={() => void actions.closeWindow(window.id)}
          ><Icon name="rectangleXmark" /></button
        >
      </div>
    </h2>
    {#if expanded}
      <ul bind:clientWidth={width}>
        {#if visible.length <= FLIP_MAX_TABS}
          {#each visible as id (id)}
            <li animate:flip={{ duration: 400 }}>{@render card(id)}</li>
          {/each}
        {:else}
          {#each visible as id (id)}
            <li>{@render card(id)}</li>
          {/each}
        {/if}
      </ul>
    {/if}
  </div>
{/if}

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

  .window-button {
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: smaller;
    line-height: inherit;
    padding: 0;
  }
</style>
