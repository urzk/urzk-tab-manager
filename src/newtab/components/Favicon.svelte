<script lang="ts">
  import { getContext } from "svelte";
  import { fallbackFavicon, faviconSrc } from "../../lib/favicon";
  import { t } from "../../lib/i18n";
  import type { TabLite } from "../../lib/state/model";

  let { tab }: { tab: TabLite } = $props();

  const getURL = getContext<(p: string) => string>("getURL");
  // Remember which icon URL failed, so a changed favIconUrl gets a fresh try
  // while an error on the fallback itself can never loop.
  let failedIcon = $state<string | null>(null);
  const failed = $derived(failedIcon === (tab.favIconUrl ?? ""));
  const src = $derived(
    failed ? fallbackFavicon(tab.url, getURL) : faviconSrc(tab, getURL),
  );
</script>

<img
  {src}
  alt={t("faviconAlt")}
  class="tab-favicon"
  width="24"
  height="24"
  loading="lazy"
  decoding="async"
  referrerpolicy="no-referrer"
  onerror={() => {
    failedIcon = tab.favIconUrl ?? "";
  }}
/>

<style>
  .tab-favicon {
    width: 24px;
    height: 24px;
  }
</style>
