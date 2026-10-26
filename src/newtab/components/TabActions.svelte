<script lang="ts">
  import Icon from "../../icons/Icon.svelte";
  import type { icons } from "../../icons/paths";
  import type { Actions } from "../../lib/chrome/actions";
  import { t } from "../../lib/i18n";
  import type { TabLite } from "../../lib/state/model";

  type Props = {
    tab: TabLite;
    index: number;
    count: number;
    columns: number;
    isCurrent: boolean;
    hasQuery: boolean;
    actions: Actions;
    move: (dir: "up" | "down" | "left" | "right") => void;
  };
  let {
    tab,
    index,
    count,
    columns,
    isCurrent,
    hasQuery,
    actions,
    move,
  }: Props = $props();

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
      isActive: !isCurrent || index !== count - 1,
      icon: isCurrent ? "arrowDown" : "arrowUp",
      onClick: () => void actions.moveToCurrentWindow(tab.id),
    },
    {
      title: t("moveUp"),
      position: "top",
      isActive: !hasQuery && index >= columns,
      icon: "arrowUp",
      onClick: () => move("up"),
    },
    {
      title: t("moveLeft"),
      position: "left",
      isActive: !hasQuery && index > 0,
      icon: "arrowLeft",
      onClick: () => move("left"),
    },
    {
      title: t("moveRight"),
      position: "right",
      isActive: !hasQuery && index < count - 1,
      icon: "arrowRight",
      onClick: () => move("right"),
    },
    {
      title: t("moveDown"),
      position: "bottom",
      isActive: !hasQuery && index < count - columns,
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
