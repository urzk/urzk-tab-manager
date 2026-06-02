<script lang="ts">
  export let title: string;
  export let className: string;
  export let isActive: boolean;
  export let onClick: () => void;
</script>

<div
  {title}
  class={`tab-button ${className}`}
  class:tab-button-active={isActive}
  role="button"
  tabindex="-1"
  on:click={onClick}
>
  <slot />
</div>

<style>
  .tab-button {
    cursor: pointer;
    display: none;
    opacity: 0;
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: #111;
    color: #ddd;
    font-size: 16px;
    line-height: 1;
    text-align: center;
    transition: opacity 0.5s ease;
    z-index: 100;
  }

  .tab-button-active {
    display: flex;
    align-items: center;
  }

  :global(.tab:hover) > .tab-button {
    opacity: 1;
  }

  .tab-button-to-current {
    border-radius: 100px;
    transform: translate(50%, 50%);
    bottom: 0;
    right: 0;
  }

  .tab-button-discard {
    border-radius: 100px;
    transform: translate(-50%, -50%);
    top: 0;
    left: 0;
  }

  .tab-button-close {
    border-radius: 100px;
    transform: translate(50%, -50%);
    top: 0;
    right: 0;
  }

  .tab-button-up {
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

  .tab-button-down {
    transform: translate(-50%, 50%);
    bottom: 0.25rem;
    left: 50%;
  }
</style>
