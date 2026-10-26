<script lang="ts">
  import Icon from "../../icons/Icon.svelte";
  import type { icons } from "../../icons/paths";
  import type { Actions } from "../../lib/chrome/actions";
  import { t } from "../../lib/i18n";
  import { moveTarget, type Direction } from "../../lib/move";
  import type { TabLite } from "../../lib/state/model";

  type Props = {
    tab: TabLite;
    index: number;
    count: number;
    pinnedCount: number;
    columns: number;
    isCurrent: boolean;
    hasQuery: boolean;
    actions: Actions;
    move: (dir: Direction) => void;
  };
  let {
    tab,
    index,
    count,
    pinnedCount,
    columns,
    isCurrent,
    hasQuery,
    actions,
    move,
  }: Props = $props();

  const canMove = (dir: Direction) =>
    !hasQuery &&
    moveTarget(index, dir, columns, count, pinnedCount) !== undefined;
  // pinned tabs stay among the pinned ones, so their "end" is the zone's end
  const zoneEnd = $derived(tab.pinned ? pinnedCount - 1 : count - 1);

  type Btn = {
    title: string;
    position: string;
    isActive: boolean;
    icon: keyof typeof icons;
    onClick: () => void;
  };

  const buttons: Btn[] = $derived([
    {
      title: t("discardTab"),
      position: "topleft",
      isActive: !tab.discarded,
      icon: "minus",
      onClick: () => void actions.discardTab(tab.id),
    },
    {
      title: t("closeTab"),
      position: "topright",
      isActive: true,
      icon: "xmark",
      onClick: () => void actions.closeTab(tab.id),
    },
    {
      title: t("popOut"),
      position: "bottomleft",
      isActive: true,
      icon: "upRightFromSquare",
      onClick: () => void actions.popOut(tab.id),
    },
    {
      title: t("moveToCurrentEnd"),
      position: "bottomright",
      isActive: !isCurrent || index !== zoneEnd,
      icon: isCurrent ? "arrowDown" : "arrowUp",
      onClick: () => void actions.moveToCurrentWindow(tab.id, tab.pinned),
    },
    {
      title: t("moveUp"),
      position: "top",
      isActive: canMove("up"),
      icon: "arrowUp",
      onClick: () => move("up"),
    },
    {
      title: t("moveLeft"),
      position: "left",
      isActive: canMove("left"),
      icon: "arrowLeft",
      onClick: () => move("left"),
    },
    {
      title: t("moveRight"),
      position: "right",
      isActive: canMove("right"),
      icon: "arrowRight",
      onClick: () => move("right"),
    },
    {
      title: t("moveDown"),
      position: "bottom",
      isActive: canMove("down"),
      icon: "arrowDown",
      onClick: () => move("down"),
    },
  ]);
</script>

{#each buttons as b (b.position)}
  <div
    title={b.title}
    class={`tab-button tab-button-${b.position}`}
    class:tab-button-active={b.isActive}
    role="button"
    tabindex="-1"
    onclick={b.onClick}
    onkeydown={null}
  >
    <Icon name={b.icon} />
  </div>
{/each}

<style>
  .tab-button {
    cursor: pointer;
    display: none;
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: #111;
    color: #ddd;
    font-size: 16px;
    line-height: 1;
    text-align: center;
    animation: tab-button-fade-in 0.5s ease;
    z-index: 100;
  }

  @keyframes tab-button-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .tab-button-active {
    display: flex;
    align-items: center;
  }

  .tab-button-topleft {
    border-radius: 10px;
    transform: translate(-50%, -50%);
    top: 0;
    left: 0;
  }

  .tab-button-topright {
    border-radius: 10px;
    transform: translate(50%, -50%);
    top: 0;
    right: 0;
  }

  .tab-button-bottomleft {
    border-radius: 5px;
    transform: translate(-50%, 50%);
    bottom: 0;
    left: 0;
  }

  .tab-button-bottomright {
    border-radius: 10px;
    transform: translate(50%, 50%);
    bottom: 0;
    right: 0;
  }

  .tab-button-top {
    transform: translate(-50%, -50%);
    top: 0.25rem;
    left: 50%;
  }

  .tab-button-left {
    transform: translate(-50%, -50%);
    top: 50%;
    left: 0.25rem;
  }

  .tab-button-right {
    transform: translate(50%, -50%);
    top: 50%;
    right: 0.25rem;
  }

  .tab-button-bottom {
    transform: translate(-50%, 50%);
    bottom: 0.25rem;
    left: 50%;
  }
</style>
