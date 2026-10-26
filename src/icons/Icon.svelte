<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { icons } from "./paths";

  let { name }: { name: keyof typeof icons } = $props();
</script>

<!-- FontAwesomeIcon renders its SVG once at mount and ignores later prop
     changes, so remount it whenever the icon changes. -->
{#key name}
  <FontAwesomeIcon icon={icons[name]} />
{/key}
