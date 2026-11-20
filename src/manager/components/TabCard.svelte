<script lang="ts">
  import type { Actions } from "../../lib/chrome/actions";
  import { moveTarget, type Direction } from "../../lib/move";
  import type { TabLite } from "../../lib/state/model";
  import Favicon from "./Favicon.svelte";
  import TabActions from "./TabActions.svelte";

  type Props = {
    tab: TabLite;
    index: number;
    count: number;
    /** Number of pinned tabs at the start of the window. */
    pinnedCount: number;
    columns: number;
    isCurrent: boolean;
    hasQuery: boolean;
    showActions: boolean;
    actions: Actions;
    neighbor: (index: number) => number | undefined;
    onHover: (id: number | null) => void;
  };
  let {
    tab,
    index,
    count,
    pinnedCount,
    columns,
    isCurrent,
    hasQuery,
    showActions,
    actions,
    neighbor,
    onHover,
  }: Props = $props();

  function move(dir: Direction) {
    if (hasQuery) return;
    const to = moveTarget(index, dir, columns, count, pinnedCount);
    if (to === undefined) return;
    if (dir === "left" || dir === "right") {
      void actions.moveTab(tab.id, to);
      return;
    }
    const other = neighbor(to);
    if (other === undefined) return;
    void actions.swapTabs(tab.id, index, other, to);
  }

  function onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "Enter":
        void actions.focusTab(tab);
        break;
      case "ArrowUp":
        move("up");
        break;
      case "ArrowLeft":
        move("left");
        break;
      case "ArrowRight":
        move("right");
        break;
      case "ArrowDown":
        move("down");
        break;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="tab"
  id={`tab-${tab.id}`}
  onmouseenter={() => onHover(tab.id)}
  onmouseleave={() => onHover(null)}
  onfocusin={() => onHover(tab.id)}
  onfocusout={(e) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    onHover(null);
  }}
>
  {#if showActions}
    <TabActions
      {tab}
      {index}
      {count}
      {pinnedCount}
      {columns}
      {isCurrent}
      {hasQuery}
      {actions}
      {move}
    />
  {/if}
  <div
    class="tab-container"
    class:tab-container-discarded={tab.discarded}
    role="button"
    tabindex="0"
    onclick={() => void actions.focusTab(tab)}
    onkeydown={onKeyDown}
  >
    <Favicon {tab} />
    <div class="tab-text">
      <h3 class="tab-title">{tab.title}</h3>
      <p class="tab-url">{tab.url}</p>
    </div>
  </div>
</div>

<style>
  .tab {
    position: relative;
  }

  .tab-container {
    background-color: #ddd;
    border-radius: 0.25rem;
    color: black;
    cursor: pointer;
    display: flex;
    height: 96px;
    justify-content: space-between;
    padding: 1rem;
  }

  .tab-container-discarded {
    opacity: 0.5;
  }

  .tab-text {
    width: 80%;
  }
  .tab-title {
    margin-top: 0;
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-url {
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
