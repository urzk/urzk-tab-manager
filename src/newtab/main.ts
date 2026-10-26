import "./app.css";
import { mount } from "svelte";
import { realChromeApi } from "../lib/chrome/api";
import { localizeDocument } from "../lib/i18n";
import App from "./components/App.svelte";

localizeDocument(document);

const app = mount(App, {
  target: document.getElementById("app")!,
  props: {
    api: realChromeApi(),
    getURL: (p: string) => chrome.runtime.getURL(p),
  },
});

export default app;
