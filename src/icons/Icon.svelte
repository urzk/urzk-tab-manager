<script lang="ts">
  import { icons } from "./paths";

  let { name }: { name: keyof typeof icons } = $props();
  const icon = $derived(icons[name]);
</script>

<svg
  aria-hidden="true"
  viewBox={icon.viewBox}
  fill="currentColor"
  width="1em"
  height="1em"
>
  <path d={icon.d} />
</svg>
