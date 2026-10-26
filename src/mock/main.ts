import "../newtab/app.css";
import { mount } from "svelte";
import App from "../newtab/components/App.svelte";
import { setFallbackMessages } from "../lib/i18n";
import en from "../../public/_locales/en/messages.json";
import ja from "../../public/_locales/ja/messages.json";
import { createFakeChrome } from "./fake-chrome";
import { demoSeed } from "./demo-seed";

const params = new URLSearchParams(location.search);
const lang = params.get("lang");
setFallbackMessages(lang === "ja" ? ja : en);
document.documentElement.lang = lang === "ja" ? "ja" : "en";

const app = mount(App, {
  target: document.getElementById("app")!,
  props: { api: createFakeChrome(demoSeed), getURL: (p: string) => p },
});

applyScreenshotParams(params);

/**
 * Demo-only hooks for store screenshots, driven by URL params:
 * - `q=<query>`: pre-fill the search box
 * - `expand=all`: expand every window
 * - `hover=<n>`: show the hover actions of the n-th tab card (1-based)
 */
function applyScreenshotParams(p: URLSearchParams) {
  const q = p.get("q");
  const expandAll = p.get("expand") === "all";
  const hover = Number(p.get("hover"));
  if (q === null && !expandAll && !hover) return;
  const apply = () => {
    const cards = document.querySelectorAll<HTMLElement>(".tab");
    if (cards.length === 0) return requestAnimationFrame(apply);
    if (expandAll) {
      document
        .querySelectorAll<HTMLElement>('.window-toggle[aria-expanded="false"]')
        .forEach((el) => el.click());
    }
    if (q !== null) {
      const input = document.querySelector<HTMLInputElement>(".search-input")!;
      input.value = q;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (hover) {
      cards[hover - 1]?.dispatchEvent(new MouseEvent("mouseenter"));
    }
  };
  requestAnimationFrame(apply);
}

export default app;
