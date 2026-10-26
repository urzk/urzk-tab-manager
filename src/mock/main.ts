import "../newtab/app.css";
import { mount } from "svelte";
import App from "../newtab/components/App.svelte";
import { setFallbackMessages } from "../lib/i18n";
import en from "../../public/_locales/en/messages.json";
import ja from "../../public/_locales/ja/messages.json";
import { createFakeChrome } from "./fake-chrome";
import { demoSeed } from "./demo-seed";

const lang = new URLSearchParams(location.search).get("lang");
setFallbackMessages(lang === "ja" ? ja : en);
document.documentElement.lang = lang === "ja" ? "ja" : "en";

const app = mount(App, {
  target: document.getElementById("app")!,
  props: { api: createFakeChrome(demoSeed), getURL: (p: string) => p },
});

export default app;
