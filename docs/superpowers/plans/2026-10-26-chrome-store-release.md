# Urzk Tab Manager — Chrome Web Store Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the extension publishable on the Chrome Web Store as "Urzk Tab Manager" 1.0.0: low memory at 1000+ tabs, state always converging to Chrome's real state, no needless permissions or data egress, en/ja, versioned releases via CI.

**Architecture:** The new-tab page subscribes to `chrome.windows`/`chrome.tabs` events itself and folds them into an immutable `State` through a pure reducer; a sync controller batches updates per animation frame and periodically reconciles against `chrome.windows.getAll({populate:true})`. All Chrome access goes through a `ChromeApi` interface, implemented by real Chrome and by an in-memory fake used for tests, property tests and the `dev:mock` demo page. A tiny module service worker handles only the toolbar action / shortcut.

**Tech Stack:** Svelte 5 (runes), Vite 8, TypeScript, vitest + fast-check + @testing-library/svelte + jsdom, ESLint (eslint-plugin-svelte, typescript-eslint), pnpm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-26-chrome-store-release-design.md`

## Global Constraints

- Extension name: `Urzk Tab Manager`; first release version `1.0.0`; semver.
- `package.json` `version` is the only version source; `build/manifest.template.json` must NOT contain `version`.
- Manifest V3; `permissions: ["tabs", "favicon"]` only; no host permissions, no `storage`, `scripting`, `externally_connectable`.
- CSP `extension_pages`: `"script-src 'self'; object-src 'self'"`. No remote code, no `eval`, no CDN.
- `default_locale: "en"`; every user-visible string comes from `public/_locales/{en,ja}/messages.json`.
- Shortcut: `_execute_action` with `suggested_key.default: "Alt+Shift+T"`.
- No `{@html}` anywhere (lint-enforced). Never build RegExp or match patterns from user input.
- Every `chrome.*` mutation is awaited and caught; failures are logged with `console.warn` only in dev and repaired by reconcile.
- No `console.log` in production code paths; dev-only diagnostics guarded by `import.meta.env.DEV`.
- Reconcile timing: debounce `500` ms after last event; interval `30_000` ms while visible; immediately on becoming visible.
- Flip animation enabled only when visible tab count ≤ `FLIP_MAX_TABS = 200` (tunable after measurement).
- Favicon allowed schemes: `http:`, `https:`, `data:`, `chrome:`; fallback `chrome.runtime.getURL("/_favicon/?pageUrl=<encoded>&size=32")`; `<img referrerpolicy="no-referrer" loading="lazy" decoding="async">`.
- `minimum_chrome_version: "104"`.
- Layout, colors, card size (288px, gap 16px), button positions, key bindings (Enter / arrows) stay as today.
- Tests: vitest. Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The manager's own tab is moved to another window** (drag-out or "pop out") → the "Current window" section must follow it (`currentWindowId` updates). Test: Task 8 `follows manager tab when it is detached to another window`.
2. **Events for windows/tabs not in state** (devtools/app windows, events racing startup, `onReplaced` with unknown ids) → ignored without throwing, and the next reconcile restores truth. Test: Task 5 `ignores events for unknown tabs and windows`.
3. **Rapid repeated move/swap clicks while earlier moves are in flight** → no exception; final UI equals Chrome's order. Test: Task 6 property test includes interleaved moves; Task 12 `swapTabs ignores a failed second move`.
4. **Odd URLs/titles** (empty `url` with `pendingUrl`, `chrome://`, `file://`, `javascript:`, unparsable URLs, 2 KB titles) → no throw in `site:` filtering or favicon selection; text is rendered as text. Tests: Task 9 `site: never throws on unparsable urls`, Task 10 `rejects javascript: and file: schemes`.
5. **Pinned-tab move constraints** (Chrome refuses moving an unpinned tab before pinned ones) → action fails quietly, UI shows Chrome's actual order after the event/reconcile. Test: Task 12 `moveTab swallows chrome errors`.

---

## File Map

| Path | Responsibility |
|---|---|
| `build/manifest.template.json` | Manifest template (no `version`) |
| `public/_locales/{en,ja}/messages.json` | All strings |
| `public/icons/icon-{16,32,48,128}.png` | Generated icons |
| `vite.config.ts` | Build: root `src`, inputs newtab + service worker, manifest plugin |
| `vite.mock.config.ts` | `dev:mock` demo page server |
| `build/manifest-plugin.ts` | `buildManifest()` + Vite plugin that emits `dist/manifest.json` |
| `src/newtab/index.html`, `src/newtab/main.ts` | Production new-tab entry |
| `src/newtab/components/*.svelte` | `App`, `WindowSection`, `TabCard`, `TabActions`, `Favicon` |
| `src/icons/*.svelte` + `src/icons/index.ts` | Inline SVG icons |
| `src/background/service-worker.ts` | Action / shortcut: focus-or-open manager |
| `src/lib/chrome/api.ts` | `ChromeApi` interface + `realChromeApi()` |
| `src/lib/chrome/actions.ts` | User operations (move/close/discard…) with error swallowing |
| `src/lib/state/model.ts` | `TabLite`, `WindowLite`, `State`, `ChromeEvent`, converters |
| `src/lib/state/reducer.ts` | `applyEvent` |
| `src/lib/state/reconcile.ts` | `fromSnapshot`, `reconcile` |
| `src/lib/state/sync.ts` | `createTabSync` controller |
| `src/lib/query.ts` | Search parse + filter |
| `src/lib/favicon.ts` | Favicon URL selection |
| `src/lib/i18n.ts` | `t()` |
| `src/mock/fake-chrome.ts` | In-memory `ChromeApi` with event emission |
| `src/mock/demo-seed.ts`, `src/mock/index.html`, `src/mock/main.ts` | Demo page |
| `scripts/package.mjs` | Zip `dist/` |
| `scripts/lib/release.mjs`, `scripts/release.mjs` | Version bump + CHANGELOG + tag |
| `scripts/icons.mjs`, `assets/icon.svg`, `assets/promo-small.svg` | Icon/promo PNG export |
| `scripts/open-many-tabs.sh` | Benchmark launcher |
| `tests/**` | vitest suites mirroring `src/lib/**` |
| `.github/workflows/{ci,release}.yml`, `.github/dependabot.yml` | CI |
| `docs/benchmarks.md` | Measurements before/after |
| `store/{en,ja}.md`, `PRIVACY.md`, `README.md`, `README.ja.md`, `CHANGELOG.md` | Store/docs |

---

### Task 1: Benchmark launcher and baseline measurement

**Files:**
- Create: `scripts/open-many-tabs.sh`, `docs/benchmarks.md`

**Interfaces:**
- Produces: `scripts/open-many-tabs.sh <extension-dir> [tabs=1000] [windows=4]` — launches Chrome with a throwaway profile (`--user-data-dir="$(mktemp -d)"`), `--load-extension=<extension-dir>`, and opens `tabs` lightweight `data:text/html,<title>Tab N</title>` pages spread across `windows` windows (`--new-window` per batch).

- [ ] **Step 1:** Write the script (bash, `set -euo pipefail`; macOS path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, overridable with `$CHROME`). First batch starts Chrome; later batches reuse the same `--user-data-dir` with `--new-window`.
- [ ] **Step 2:** Before any code change, run `pnpm build` (today's root `manifest.json` points at `dist/index.html`, so the extension dir is the repo root), then `scripts/open-many-tabs.sh . 1000 4`.
- [ ] **Step 3 (human):** Open a new tab, wait for render, record in `docs/benchmarks.md` a "Baseline (pre-1.0)" table: Chrome Task Manager memory of the extension's new-tab page and of "Extension: …" service worker, `document.querySelectorAll('*').length` from DevTools, and time-to-render (DevTools Performance: navigation start → last long task). Note Chrome version and machine.
- [ ] **Step 4:** Commit `chore: add benchmark launcher and baseline measurements`.

---

### Task 2: Toolchain upgrade (Svelte 5, Vite 8, vitest, ESLint)

**Files:**
- Modify: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `svelte.config.js`, `src/main.ts`, `.prettierrc`
- Create: `eslint.config.js`, `vitest.config.ts`, `tests/setup.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces scripts: `dev`, `build`, `check`, `lint`, `test` (`vitest run`), `format`.

- [ ] **Step 1:** Upgrade devDependencies to latest: `svelte@^5`, `vite@^8`, `@sveltejs/vite-plugin-svelte@latest`, `svelte-check@latest`, `@tsconfig/svelte@latest`, `@types/chrome@latest`, `prettier-plugin-svelte@latest`, `typescript@latest`. Add `vitest`, `jsdom`, `@testing-library/svelte`, `fast-check`, `eslint`, `eslint-plugin-svelte`, `typescript-eslint`, `globals`. If `pnpm check` fails because svelte-check does not support the installed TypeScript major, pin `typescript@~5.9` and note it in the commit message.
- [ ] **Step 2:** Fix `tsconfig.json`: it currently has two `compilerOptions` keys (the second silently drops the first). Merge into one, add `"strict": true`, `"types": ["chrome", "vite/client"]`, and add `tests/**/*.ts` and `build/**/*.ts` to `include`.
- [ ] **Step 3:** `src/main.ts`: replace `new App({target})` with `mount(App, { target })` from `svelte`. Existing components keep working in Svelte 5 legacy mode for now.
- [ ] **Step 4:** `eslint.config.js` (flat config): `typescript-eslint` recommended + `eslint-plugin-svelte` recommended, and rules `"svelte/no-at-html-tags": "error"`, `"no-console": ["error", { allow: ["warn", "error"] }]`, `"no-eval": "error"`.
- [ ] **Step 5:** `vitest.config.ts`: `svelte()` plugin, `test.environment: "jsdom"`, `setupFiles: ["tests/setup.ts"]`, `resolve.conditions: ["browser"]`. `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 6:** Run `pnpm install && pnpm check && pnpm lint && pnpm test && pnpm build`. Expected: all pass (fix lint findings in existing code minimally; existing `console.log` in `App.svelte` is removed here).
- [ ] **Step 7:** Load the repo root in `chrome://extensions` → new tab still works. Commit `chore: upgrade to Svelte 5 / Vite 8, add vitest and eslint`.

---

### Task 3: Build restructure, manifest version injection, packaging

**Files:**
- Create: `build/manifest.template.json`, `build/manifest-plugin.ts`, `src/newtab/index.html`, `src/newtab/main.ts`, `src/background/service-worker.ts` (placeholder: empty module with a comment), `scripts/package.mjs`, `tests/build/manifest-plugin.test.ts`
- Move: `src/components/*` → `src/newtab/components/`, `src/app.css` → `src/newtab/app.css`
- Delete: `manifest.json`, `tablist.html`, `tablist.js`, `background/background.js`, `index.html`, `src/main.ts`, `public/vite.svg`, `src/assets/svelte.svg`
- Modify: `vite.config.ts`, `package.json` (scripts `package`), `.gitignore` (`release/`)

**Interfaces:**
- Produces: `buildManifest(template: Record<string, unknown>, version: string): Record<string, unknown>` — throws `Error("manifest template must not contain version")` if template has `version`; throws on non-semver `version`; returns `{ ...template, version }` with `version` placed right after `manifest_version`.
- Produces: `manifestPlugin(): Plugin` — in `generateBundle`, reads `build/manifest.template.json` + `package.json` and emits `manifest.json` via `this.emitFile({ type: "asset" })`. The template lives outside `public/` so Vite never copies it raw.
- Build output: `dist/newtab/index.html`, `dist/service-worker.js`, `dist/manifest.json`, `dist/_locales/**`, `dist/icons/**`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/build/manifest-plugin.test.ts
import { buildManifest } from "../../build/manifest-plugin";
const tpl = { manifest_version: 3, name: "__MSG_extName__" };
test("injects version after manifest_version", () => {
  const m = buildManifest(tpl, "1.0.0");
  expect(m.version).toBe("1.0.0");
  expect(Object.keys(m).slice(0, 2)).toEqual(["manifest_version", "version"]);
});
test("rejects template containing version", () => {
  expect(() => buildManifest({ ...tpl, version: "0.1.0" }, "1.0.0")).toThrow(/must not contain version/);
});
test("rejects non-semver", () => {
  expect(() => buildManifest(tpl, "1.0")).toThrow();
});
```

- [ ] **Step 2:** `pnpm test tests/build` → FAIL (module not found).
- [ ] **Step 3:** Implement `build/manifest-plugin.ts`. Template `build/manifest.template.json` contains every key from spec §3.4: `manifest_version`, `name: "__MSG_extName__"`, `description: "__MSG_extDescription__"`, `default_locale: "en"`, `minimum_chrome_version: "104"`, `icons`, `permissions: ["tabs","favicon"]`, `action: { default_title: "__MSG_actionTitle__", default_icon }`, `background: { service_worker: "service-worker.js", type: "module" }`, `chrome_url_overrides: { newtab: "newtab/index.html" }`, `commands: { _execute_action: { suggested_key: { default: "Alt+Shift+T" }, description: "__MSG_commandOpen__" } }`, `content_security_policy`.
- [ ] **Step 4:** `vite.config.ts`: `root: "src"`, `publicDir: "../public"`, `base: "./"`, `build.outDir: "../dist"`, `emptyOutDir: true`, `rollupOptions.input: { newtab: "src/newtab/index.html", "service-worker": "src/background/service-worker.ts" }` (paths resolved from project root), `output.entryFileNames: c => c.name === "service-worker" ? "service-worker.js" : "assets/[name]-[hash].js"`, plugins `[svelte(), manifestPlugin()]`. Create minimal `public/_locales/en/messages.json` with `extName`, `extDescription`, `actionTitle`, `commandOpen` (Task 11 completes it). Omit `icons`/`action.default_icon` until Task 20 adds them.
- [ ] **Step 5:** `scripts/package.mjs`: read version from `package.json`, require `dist/manifest.json` version to equal it, run `zip -r -X ../release/urzk-tab-manager-<version>.zip .` with `cwd: dist` (create `release/`). Script `"package": "pnpm build && node scripts/package.mjs"`.
- [ ] **Step 6:** Keep `package.json` `version` at `0.1.0` (Task 21 releases 1.0.0); set `"description": "Tab manager that replaces the new tab page"`.
- [ ] **Step 7:** Run `pnpm test && pnpm build && pnpm package`; check `unzip -l release/*.zip` lists `manifest.json` at root and no `src/`. Load `dist/` in Chrome → new tab renders as before.
- [ ] **Step 8:** Commit `build: self-contained dist with version-injected manifest and zip packaging`.

---

### Task 4: `ChromeApi` interface and in-memory fake Chrome

**Files:**
- Create: `src/lib/chrome/api.ts`, `src/mock/fake-chrome.ts`, `tests/mock/fake-chrome.test.ts`

**Interfaces:**
- Produces (`api.ts`):

```ts
export type Listener<A extends unknown[]> = { addListener(fn: (...a: A) => void): void; removeListener(fn: (...a: A) => void): void };
export interface ChromeApi {
  windows: {
    getAll(o: { populate: true }): Promise<chrome.windows.Window[]>;
    getCurrent(): Promise<chrome.windows.Window>;
    update(id: number, info: chrome.windows.UpdateInfo): Promise<unknown>;
    remove(id: number): Promise<void>;
    create(data: chrome.windows.CreateData): Promise<unknown>;
    onCreated: Listener<[chrome.windows.Window]>;
    onRemoved: Listener<[number]>;
    onFocusChanged: Listener<[number]>;
  };
  tabs: {
    query(q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
    get(id: number): Promise<chrome.tabs.Tab>;
    getCurrent(): Promise<chrome.tabs.Tab | undefined>;
    update(id: number, p: chrome.tabs.UpdateProperties): Promise<unknown>;
    move(id: number, p: { index: number; windowId?: number }): Promise<unknown>;
    remove(id: number): Promise<void>;
    discard(id: number): Promise<unknown>;
    create(p: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
    onCreated: Listener<[chrome.tabs.Tab]>;
    onUpdated: Listener<[number, chrome.tabs.TabChangeInfo, chrome.tabs.Tab]>;
    onMoved: Listener<[number, chrome.tabs.TabMoveInfo]>;
    onAttached: Listener<[number, chrome.tabs.TabAttachInfo]>;
    onDetached: Listener<[number, chrome.tabs.TabDetachInfo]>;
    onRemoved: Listener<[number, chrome.tabs.TabRemoveInfo]>;
    onReplaced: Listener<[number, number]>;
    onActivated: Listener<[chrome.tabs.TabActiveInfo]>;
  };
}
export function realChromeApi(): ChromeApi; // returns chrome narrowed to ChromeApi
```

- Produces (`fake-chrome.ts`): `createFakeChrome(seed?: FakeSeed): FakeChrome` where `FakeSeed = { windows: { tabs: { title: string; url: string; favIconUrl?: string; pinned?: boolean; discarded?: boolean }[]; state?: chrome.windows.WindowState }[]; currentWindowIndex?: number }` and `FakeChrome = ChromeApi & { truth(): chrome.windows.Window[]; deliver: "sync" | "manual"; flush(): void; setTitle(tabId: number, title: string): void; dropNextEvents(n: number): void }`.
  - Semantics mirror Chrome: indexes contiguous per window; `move` with `index: -1` appends; moving unpinned before pinned **rejects** with `Error("Cannot move tab")`; `remove` of the last tab removes the window (fires `tabs.onRemoved{isWindowClosing:true}` then `windows.onRemoved`); `windows.create({tabId})` fires `onDetached`(old) then `windows.onCreated` then `onAttached`(new); cross-window `move` fires `onDetached` then `onAttached`; `discard` fires `onReplaced(newId, oldId)` (Chrome may change id on discard) — make this optional via `seed.replaceOnDiscard`; default `false` fires `onUpdated{discarded:true}`.
  - Events are queued; `deliver: "sync"` (default) flushes after each mutation via `queueMicrotask`; `"manual"` waits for `flush()`. `dropNextEvents(n)` discards the next n events (for reconcile tests).
  - `getCurrent()` returns the window at `currentWindowIndex` (default 0); `tabs.getCurrent()` returns undefined.

- [ ] **Step 1: Write failing tests** in `tests/mock/fake-chrome.test.ts`: `getAll returns seeded windows with contiguous indexes`; `move within window reorders and fires onMoved(fromIndex,toIndex)`; `cross-window move fires onDetached then onAttached`; `removing last tab fires tabs.onRemoved(isWindowClosing) then windows.onRemoved`; `move unpinned before pinned rejects`; `manual delivery holds events until flush`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `test: add ChromeApi interface and in-memory fake chrome`.

---

### Task 5: State model and reducer

**Files:**
- Create: `src/lib/state/model.ts`, `src/lib/state/reducer.ts`, `tests/state/reducer.test.ts`

**Interfaces:**
- Produces (`model.ts`):

```ts
export type TabLite = { id: number; windowId: number; title: string; url: string; favIconUrl?: string; discarded: boolean; active: boolean; pinned: boolean; status?: string };
export type WindowLite = { id: number; state?: chrome.windows.WindowState; focused: boolean };
export type State = {
  windowOrder: readonly number[];
  windows: ReadonlyMap<number, WindowLite>;
  tabIdsByWindow: ReadonlyMap<number, readonly number[]>;
  tabs: ReadonlyMap<number, TabLite>;
  currentWindowId?: number;
  managerTabId?: number;
};
export type ChromeEvent =
  | { type: "windowCreated"; window: WindowLite }
  | { type: "windowRemoved"; windowId: number }
  | { type: "windowFocusChanged"; windowId: number }
  | { type: "tabCreated"; tab: TabLite; index: number }
  | { type: "tabUpdated"; tab: TabLite }
  | { type: "tabMoved"; tabId: number; windowId: number; fromIndex: number; toIndex: number }
  | { type: "tabDetached"; tabId: number; oldWindowId: number; oldPosition: number }
  | { type: "tabAttached"; tabId: number; newWindowId: number; newPosition: number }
  | { type: "tabRemoved"; tabId: number; windowId: number }
  | { type: "tabReplaced"; addedTabId: number; removedTabId: number }
  | { type: "tabActivated"; tabId: number; windowId: number };
export const emptyState: State;
export function toTabLite(t: chrome.tabs.Tab): TabLite; // url = t.url || t.pendingUrl || ""; title = t.title || url
export function toWindowLite(w: chrome.windows.Window): WindowLite;
export function tabIndex(s: State, tabId: number): number; // position in tabIdsByWindow, -1 if unknown
```

- Produces (`reducer.ts`): `applyEvent(s: State, e: ChromeEvent): State` — never mutates input; returns the **same object** when the event changes nothing (unknown ids); unchanged `TabLite` objects keep identity.
  - `tabCreated` for an unknown window creates the window entry (appended to `windowOrder`, `focused:false`).
  - `tabDetached` removes the id from the old window but keeps the `TabLite` in `tabs` (pending attach); `tabAttached` inserts at `newPosition` and sets `windowId`; if `tabId === managerTabId`, sets `currentWindowId = newWindowId`.
  - `tabRemoved` / `windowRemoved` delete tabs; `windowRemoved` deletes all its tabs.
  - `tabReplaced` renames `removedTabId` → `addedTabId` in place (same position, `id` updated; `managerTabId` updated if it matches).
  - `tabActivated` sets `active` true for the tab and false for other tabs in that window (new objects only for the two that change).
  - `windowFocusChanged` sets `focused` (`-1` = none focused).

- [ ] **Step 1: Write failing tests** (one `test` each, using a small builder `stateOf([[1,2,3],[4]])` defined in the test file):
  - `tabCreated inserts at index`; `tabCreated for unknown window creates it`
  - `tabMoved reorders within window` (`[1,2,3]` move 1 → 2 gives `[2,3,1]`)
  - `detach then attach moves tab across windows at position`
  - `tabRemoved deletes tab`; `windowRemoved deletes window and its tabs`
  - `tabReplaced keeps position and swaps id`
  - `tabActivated toggles active within window only`
  - `tabUpdated preserves identity of other tabs` (`expect(next.tabs.get(2)).toBe(prev.tabs.get(2))`)
  - `ignores events for unknown tabs and windows` (tabMoved/tabRemoved/tabUpdated/tabReplaced with unknown ids → `expect(next).toBe(prev)`; no throw) — **Review Focus 2**
  - `attaching manager tab updates currentWindowId`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(state): add tab state model and pure event reducer`.

---

### Task 6: Property test — reducer tracks the fake Chrome

**Files:**
- Create: `src/lib/chrome/events.ts`, `tests/state/reducer.property.test.ts`

**Interfaces:**
- Produces (`events.ts`): `subscribeEvents(api: ChromeApi, onEvent: (e: ChromeEvent) => void): () => void` — attaches one listener per Chrome event, converts arguments into `ChromeEvent` (`tabUpdated` uses the third `tab` argument via `toTabLite`; `tabCreated` uses `tab.index`), returns an unsubscribe function that removes every listener.
- Consumes: `createFakeChrome`, `applyEvent`, `fromSnapshot` (Task 7 — for this task, build the initial state with a local helper that folds `getAll` output; Task 7 replaces it with `fromSnapshot`).

- [ ] **Step 1: Write the property test**: with `fc.commands` (or an array of op records) generate 1–60 ops from {createTab(windowIdx), removeTab(i), moveWithin(i, toIndex), moveToOtherWindow(i, windowIdx), popOut(i), setTitle(i), discard(i), activate(i), focusWindow(w)} applied to a fake seeded with 1–3 windows × 1–8 tabs. Subscribe with `subscribeEvents`, fold events with `applyEvent`, await delivery, then assert `normalize(state)` equals `normalize(truth())` where `normalize` yields `[{windowId, tabs:[{id,title,url,pinned,discarded,active}]}]` in window order. Ops that the fake rejects are allowed and simply ignored (covers **Review Focus 3/5**). `numRuns: 300`.
- [ ] **Step 2:** Run → FAIL (no `events.ts`). **Step 3:** Implement `subscribeEvents`. **Step 4:** Run → PASS; any counterexample is a reducer or fake bug — fix the root cause (use superpowers:systematic-debugging), never weaken the property.
- [ ] **Step 5:** Commit `test(state): property test reducer against fake chrome`.

---

### Task 7: Snapshot and reconcile

**Files:**
- Create: `src/lib/state/reconcile.ts`, `tests/state/reconcile.test.ts`
- Modify: `tests/state/reducer.property.test.ts` (use `fromSnapshot`; add the drop-events property)

**Interfaces:**
- Produces:
  - `fromSnapshot(windows: chrome.windows.Window[], currentWindowId: number | undefined, managerTabId: number | undefined): State` — window order as given; tab order by `tab.index`.
  - `reconcile(local: State, snapshot: State): { state: State; mismatches: number }` — `mismatches` counts windows whose order/membership differs plus tabs whose order or any `TabLite` field differs. Returns `local` itself when `mismatches === 0`. Reuses the local `TabLite` object for every tab whose fields are equal, and the local `tabIdsByWindow` array for every window whose id list is equal.

- [ ] **Step 1: Write failing tests**: `returns local unchanged when equal` (`toBe`, mismatches 0); `fixes tab order and counts 1 mismatch`; `adds missing and removes extra windows`; `reuses identical TabLite objects`; `updates changed title only`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Add property `reconcile converges after dropped events`: same generator as Task 6 plus `dropNextEvents(k)` ops; after all ops, `reconcile(state, fromSnapshot(await getAll(...)))` normalizes equal to truth. Run → PASS.
- [ ] **Step 6:** Commit `feat(state): snapshot and reconcile`.

---

### Task 8: Sync controller

**Files:**
- Create: `src/lib/state/sync.ts`, `tests/state/sync.test.ts`

**Interfaces:**
- Produces:

```ts
export type SyncOptions = {
  scheduleFrame?: (cb: () => void) => void;   // default requestAnimationFrame
  debounceMs?: number;                        // default 500
  intervalMs?: number;                        // default 30_000
  onMismatch?: (n: number) => void;           // dev diagnostics
};
export type TabSync = {
  subscribe(fn: (s: State) => void): () => void; // called immediately with current state
  start(): Promise<void>;       // subscribe events → queue → snapshot → if queue non-empty, snapshot again
  setVisible(v: boolean): void; // false: unsubscribe events + stop timers; true: start() again
  reconcileNow(): Promise<void>;
  stop(): void;
};
export function createTabSync(api: ChromeApi, opts?: SyncOptions): TabSync;
```

  - Events received after startup are applied with `applyEvent` into a pending state; listeners are notified once per `scheduleFrame`.
  - Every event (re)starts the debounce timer → `reconcileNow()`. `windowFocusChanged` also triggers the debounce (window `state` such as minimized has no event; reconcile picks it up).
  - `managerTabId` comes from `api.tabs.getCurrent()`; `currentWindowId` from `api.windows.getCurrent()` at each snapshot; afterwards it follows the manager tab via the reducer.
  - Overlapping `reconcileNow()` calls coalesce (one in flight, at most one queued).

- [ ] **Step 1: Write failing tests** (vitest fake timers, fake chrome, `scheduleFrame: cb => queueMicrotask(cb)`):
  - `start produces snapshot state`
  - `events during startup trigger a second snapshot` (manual delivery: mutate before `getAll` resolves; assert `getAll` called twice and final state equals truth)
  - `batches several events into one notification per frame`
  - `reconciles 500ms after the last event` (drop an event, advance 499 → still wrong, advance 1 → correct)
  - `reconciles every 30s while visible`, `does nothing while hidden`, `resyncs when becoming visible`
  - `follows manager tab when it is detached to another window` — **Review Focus 1**
  - `stop removes all listeners`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(state): sync controller with batching and reconcile`.

---

### Task 9: Search query

**Files:**
- Create: `src/lib/query.ts`, `tests/query.test.ts`

**Interfaces:**
- Produces:
  - `type Query = { words: string[]; site?: string; loadedOnly: boolean }`
  - `parseQuery(input: string): Query` — tokens split on whitespace; `loaded:`/`l:` → `loadedOnly`; `site:<host>` → `site` (lowercased; last one wins); other tokens → `words` (lowercased).
  - `isEmptyQuery(q: Query): boolean`
  - `matchesTab(q: Query, t: TabLite): boolean` — words must appear in the title **in order** (`indexOf` from the end of the previous match), case-insensitive; `site` matches when `new URL(t.url).hostname` equals it or ends with `.` + it; unparsable URL → no site match (never throws); `loadedOnly` excludes `discarded`.

- [ ] **Step 1: Write failing tests**: `parses words, site and loaded`; `l: is alias of loaded:`; `words match in order` (`"foo bar"` matches "Foo x Bar", not "Bar x Foo"); `case-insensitive`; `site matches subdomains but not suffix lookalikes` (`site:example.com` matches `a.example.com`, not `badexample.com`); `site: never throws on unparsable urls` (`""`, `"chrome://newtab"`, `"not a url"`) — **Review Focus 4**; `regex metacharacters are literal` (`"a.*b"` does not match "axxb").
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: in-memory tab search`.

---

### Task 10: Favicon selection

**Files:**
- Create: `src/lib/favicon.ts`, `tests/favicon.test.ts`

**Interfaces:**
- Produces:
  - `faviconSrc(t: Pick<TabLite, "url" | "favIconUrl">, getURL: (p: string) => string): string` — `favIconUrl` if its scheme is in the allowed list, else `fallbackFavicon(t.url, getURL)`.
  - `fallbackFavicon(pageUrl: string, getURL: (p: string) => string): string` — `getURL("/_favicon/?pageUrl=" + encodeURIComponent(pageUrl) + "&size=32")`.

- [ ] **Step 1: Write failing tests**: `uses favIconUrl for https`; `uses favIconUrl for data:`; `falls back when empty`; `rejects javascript: and file: schemes` — **Review Focus 4**; `fallback encodes pageUrl`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: favicon source selection with _favicon fallback`.

---

### Task 11: i18n

**Files:**
- Create: `src/lib/i18n.ts`, `public/_locales/ja/messages.json`, `tests/i18n.test.ts`
- Modify: `public/_locales/en/messages.json`

**Interfaces:**
- Produces: `t(key: MessageKey, subs?: string | string[]): string` — uses `chrome.i18n.getMessage` when available, else the fallback dictionary set via `setFallbackMessages(m: Record<string, {message: string; placeholders?: …}>)` (used by tests and `dev:mock`; implement `$NAME$` placeholder substitution for the fallback only). `MessageKey` is a string union of the keys below.
- Keys (en / ja draft):

| key | en | ja |
|---|---|---|
| extName | Urzk Tab Manager | Urzk Tab Manager |
| extDescription | See and manage every tab in every window from your new tab page. | 新しいタブで、すべてのウィンドウのタブを一覧・整理できます。 |
| actionTitle / commandOpen | Open Urzk Tab Manager | Urzk Tab Manager を開く |
| heading | Tabs | タブ |
| searchPlaceholder | Search tabs... | タブを検索… |
| windowTitle (`$ID$`) | Window (ID: #$ID$) | ウィンドウ (ID: #$ID$) |
| currentWindowTitle (`$ID$`) | Current Window (ID: #$ID$) | 現在のウィンドウ (ID: #$ID$) |
| tabCountOne | 1 tab | 1 タブ |
| tabCount (`$COUNT$`) | $COUNT$ tabs | $COUNT$ タブ |
| toggleWindow | Show or hide tabs | タブの表示/非表示 |
| minimizeWindow / focusWindow / closeWindow | minimize window / focus window / close window | ウィンドウを最小化 / ウィンドウにフォーカス / ウィンドウを閉じる |
| discardTab / closeTab / popOut | discard tab / close tab / pop out to new window | タブを破棄 / タブを閉じる / 新しいウィンドウに切り出す |
| moveToCurrentEnd | move to end of current window | 現在のウィンドウの末尾へ移動 |
| moveUp / moveLeft / moveRight / moveDown | move up / move left / move right / move down | 上へ / 左へ / 右へ / 下へ |
| faviconAlt | favicon | ファビコン |

- [ ] **Step 1: Write failing tests**: `en and ja have identical keys`; `every placeholder used in en exists in ja`; `every t("…") key used under src/ exists in en` (glob `src/**/*.{ts,svelte}`, regex `/\bt\("([A-Za-z]+)"/g`); `fallback substitutes placeholders`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement + write both dictionaries. **Step 4:** PASS. **Step 5:** Commit `feat: en/ja localization`.

---

### Task 12: User actions

**Files:**
- Create: `src/lib/chrome/actions.ts`, `tests/chrome/actions.test.ts`

**Interfaces:**
- Produces: `createActions(api: ChromeApi): Actions` with
  `focusTab(t: TabLite)`, `closeTab(id)`, `discardTab(id)`, `moveTab(id: number, index: number)`, `moveToWindow(id: number, windowId: number)` (index −1), `moveToCurrentWindow(id: number)` (uses `api.windows.getCurrent()`), `swapTabs(aId: number, aIndex: number, bId: number, bIndex: number)` (move a→bIndex then b→aIndex), `popOut(id)`, `focusWindow(id)`, `minimizeWindow(id)`, `closeWindow(id)` — all `Promise<void>`, never reject (catch, `if (import.meta.env.DEV) console.warn(...)`).
- Indexes passed in come from the latest `State` (`tabIndex`) — callers never use stale `TabLite` fields.

- [ ] **Step 1: Write failing tests** with the fake: `focusTab activates tab and focuses window`; `moveTab swallows chrome errors` (unpinned before pinned → resolves) — **Review Focus 5**; `swapTabs ignores a failed second move` (stub second `move` to reject → resolves) — **Review Focus 3**; `moveToCurrentWindow appends to current window`; `popOut creates window with tab`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: chrome actions with error isolation`.

---

### Task 13: Inline SVG icons and tab card components

**Files:**
- Create: `src/icons/Icon.svelte`, `src/icons/paths.ts`, `src/newtab/components/Favicon.svelte`, `src/newtab/components/TabCard.svelte`, `src/newtab/components/TabActions.svelte`, `tests/components/TabCard.test.ts`
- Delete: `src/newtab/components/Tab.svelte`, `src/newtab/components/TabButton.svelte`

**Interfaces:**
- `paths.ts`: `export const icons = { arrowUp, arrowDown, arrowLeft, arrowRight, minus, xmark, upRightFromSquare, caretDown, caretRight, windowMinimize, windowMaximize, rectangleXmark } as const satisfies Record<string, { viewBox: string; d: string }>` — copy the path data from `@fortawesome/free-solid-svg-icons` (CC BY 4.0; add attribution in README and a header comment).
- `Icon.svelte` props: `{ name: keyof typeof icons }` → `<svg aria-hidden="true" viewBox fill="currentColor" width="1em" height="1em"><path d/></svg>`.
- `Favicon.svelte` props: `{ tab: TabLite }` — `getURL = getContext<(p: string) => string>("getURL")`; `src = faviconSrc(tab, getURL)`; on `error` switch once to `fallbackFavicon`; attributes per Global Constraints; `alt={t("faviconAlt")}`. Tests render inside a wrapper that sets the context.
- `TabCard.svelte` props: `{ tab: TabLite; index: number; count: number; columns: number; isCurrent: boolean; hasQuery: boolean; showActions: boolean; actions: Actions; neighbor: (index: number) => number | undefined; onHover: (id: number | null) => void }`. Renders the card (same markup/classes/CSS as old `Tab.svelte`), Enter/arrow key handlers (arrows use `actions.moveTab` / `actions.swapTabs` with `index ± 1` / `index ± columns`), `mouseenter`/`focusin` → `onHover(tab.id)`, `mouseleave`/`focusout` → `onHover(null)`. `{#if showActions}<TabActions …/>{/if}`.
- `TabActions.svelte`: the 8 buttons with the old positions/CSS and `isActive` rules from old `Tab.svelte`, titles from `t()`, fade-in via `@keyframes` 0.5s.

- [ ] **Step 1: Write failing tests** (`@testing-library/svelte`, fake chrome actions, `setFallbackMessages(en)`): `renders title and url as text` (title `"<img src=x onerror=alert(1)>"` appears as text, no `img[src=x]`); `actions only render when showActions`; `move buttons hidden when hasQuery`; `Enter focuses tab`; `ArrowRight moves tab to index+1`; `favicon falls back on error` (fire `error` → src contains `/_favicon/`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(ui): lightweight tab card with on-demand actions and inline icons`.

---

### Task 14: Window section and App wiring

**Files:**
- Create: `src/newtab/components/WindowSection.svelte`, `tests/components/App.test.ts`
- Modify: `src/newtab/components/App.svelte`, `src/newtab/main.ts`, `src/newtab/app.css`
- Delete: `src/newtab/components/Window.svelte`; remove `@fortawesome/*` from `package.json`

**Interfaces:**
- `App.svelte` props `{ api: ChromeApi; getURL: (p: string) => string; sync?: TabSync }` — calls `setContext("getURL", getURL)`; (default `createTabSync(api, { onMismatch: import.meta.env.DEV ? n => console.warn("reconcile mismatches", n) : undefined })`). Holds `let state = $state.raw(emptyState)`; `onMount` → `sync.subscribe(s => state = s)`, `sync.start()`, `visibilitychange` → `sync.setVisible(document.visibilityState === "visible")`; cleanup `sync.stop()`. `query = $derived(parseQuery(input))`. Single `hoveredId = $state<number | null>(null)` passed down. Renders current window first, then others in `windowOrder`.
- `WindowSection.svelte` props `{ window: WindowLite; tabIds: readonly number[]; tabs: ReadonlyMap<number, TabLite>; isCurrent: boolean; query: Query; actions: Actions; hoveredId: number | null; onHover }`. `expanded = $state(isCurrent)`; `visible = $derived(isEmptyQuery(query) ? tabIds : tabIds.filter(id => matchesTab(query, tabs.get(id)!)))`; header shows `t(isCurrent ? "currentWindowTitle" : "windowTitle", String(id))` and count (`tabCountOne`/`tabCount`) — count is `visible.length` immediately (no spinner); minimize button only when `window.state !== "minimized"`. Body `{#if expanded}` keyed `{#each visible as id (id)}`, `animate:flip` only when `visible.length <= FLIP_MAX_TABS` (export `FLIP_MAX_TABS = 200` from `src/newtab/constants.ts`). `columns` from `bind:clientWidth` as today. The index passed to `TabCard` is the tab's position in `tabIds` (full window order).
- `main.ts`: `mount(App, { target, props: { api: realChromeApi(), getURL: (p) => chrome.runtime.getURL(p) } })`.

- [ ] **Step 1: Write failing tests** (fake chrome seeded 2 windows × 3 tabs): `current window expanded, others collapsed and not rendered` (no `.tab` elements from window 2 in DOM); `expanding renders tabs`; `search filters across windows and updates counts`; `closing a tab in chrome updates the list` (fake `remove` → after frame, card gone); `count shows "1 tab" singular`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; delete old components and FontAwesome deps. **Step 4:** `pnpm test && pnpm check && pnpm lint && pnpm build` PASS; `grep -r fortawesome src package.json` → nothing.
- [ ] **Step 5:** Load `dist/` in Chrome, exercise: open/close/move/discard/pop-out/minimize, drag the manager tab to another window (Review Focus 1), search with `site:`/`l:`. Commit `feat(ui): event-driven App and window sections on Svelte 5`.

---

### Task 15: Service worker — focus or open manager

**Files:**
- Modify: `src/background/service-worker.ts`
- Create: `src/background/open-manager.ts`, `tests/background/open-manager.test.ts`

**Interfaces:**
- Produces: `openManager(api: ChromeApi, managerUrl: string, currentWindowId: number | undefined): Promise<void>` — `api.tabs.query({ url: managerUrl })`; prefer a tab in `currentWindowId`, else the first; if found → `tabs.update(id, {active:true})` + `windows.update(windowId, {focused:true})`; else `tabs.create({ url: managerUrl, windowId: currentWindowId })`. Errors caught.
- `service-worker.ts`: `chrome.action.onClicked.addListener(tab => openManager(realChromeApi(), chrome.runtime.getURL("newtab/index.html"), tab.windowId))`. Nothing else.
- Note: Chrome reports overridden new-tab pages with `url: "chrome://newtab/"` in `tabs.query`. Step 4 verifies; if the extension URL does not match, query `{ url: ["chrome://newtab/", managerUrl] }` instead and make the test cover both.

- [ ] **Step 1: Write failing tests**: `focuses existing manager tab in current window first`; `falls back to manager tab in another window`; `creates a tab when none exists`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; then in Chrome: click toolbar icon with/without an open manager tab, and press `Alt+Shift+T`; apply the `chrome://newtab/` fallback if needed.
- [ ] **Step 5:** Commit `feat: toolbar action and shortcut focus or open the manager`.

---

### Task 16: `dev:mock` demo page

**Files:**
- Create: `vite.mock.config.ts`, `src/mock/index.html`, `src/mock/main.ts`, `src/mock/demo-seed.ts`

**Interfaces:**
- `demo-seed.ts`: `demoSeed: FakeSeed` — 3 windows (12, 7, 5 tabs) with realistic but fictional titles/URLs (e.g. docs, news, recipes; `example.com`-style domains only), favicons as `data:` SVGs, some `discarded`.
- `main.ts`: `setFallbackMessages(lang === "ja" ? ja : en)` where `lang` comes from `?lang=` (default en); `mount(App, { props: { api: createFakeChrome(demoSeed), getURL: p => p } })`.
- Script `"dev:mock": "vite --config vite.mock.config.ts"` (root `src/mock`, port 5174).

- [ ] **Step 1:** Implement. **Step 2:** `pnpm dev:mock`, open `http://localhost:5174/?lang=ja` in the browser pane: tabs render, hover actions work, search works. **Step 3:** Commit `chore: add mock demo page`.

---

### Task 17: After-measurement and tuning

**Files:**
- Modify: `docs/benchmarks.md`, possibly `src/newtab/constants.ts`

- [ ] **Step 1:** `pnpm build && scripts/open-many-tabs.sh dist 1000 4`.
- [ ] **Step 2 (human):** Record the same metrics as Task 1 under "1.0.0 candidate"; additionally record DOM node count with the current window expanded vs. all collapsed, and whether reordering animation stutters at 200 visible tabs.
- [ ] **Step 3:** If flip stutters at 200, lower `FLIP_MAX_TABS` to the largest smooth value tried (100 / 50). Write a "Decision" line: whether virtual scrolling is needed (spec: out of scope here; open a follow-up if yes).
- [ ] **Step 4:** Commit `docs: record 1.0.0 benchmark results`.

---

### Task 18: Release script and CHANGELOG

**Files:**
- Create: `scripts/lib/release.mjs`, `scripts/release.mjs`, `CHANGELOG.md`, `tests/scripts/release.test.ts`
- Modify: `package.json` (scripts `release:patch|minor|major`)

**Interfaces:**
- `bumpVersion(v: string, kind: "patch" | "minor" | "major"): string` (rejects non-`X.Y.Z`).
- `rollChangelog(text: string, version: string, date: string): string` — replaces the first `## [Unreleased]` with `## [Unreleased]\n\n## [<version>] - <date>`; throws `Error("Unreleased section is empty")` if there is no content between `## [Unreleased]` and the next `## ` heading.
- `release.mjs <kind>`: require clean git tree, run `pnpm test`, write version to `package.json`, roll `CHANGELOG.md` with today's date (`YYYY-MM-DD`), `git commit -m "release: v<version>"`, `git tag v<version>`; print "push with: git push && git push --tags". Special case: when current version is `0.x` and kind is `major`, result is `1.0.0`.
- `CHANGELOG.md` (Keep a Changelog) `## [Unreleased]` lists the 1.0.0 changes (Added: action/shortcut, ja locale, search improvements; Changed: performance rewrite, Svelte 5; Removed: background message relay; Security: favicon referrer policy, minimal permissions).

- [ ] **Step 1: Write failing tests**: `bumps patch/minor/major`; `0.1.0 major → 1.0.0`; `rolls unreleased into version heading`; `throws on empty unreleased`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `chore: release script and changelog`.

---

### Task 19: CI, release workflow, Dependabot

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`

- [ ] **Step 1:** `ci.yml` on `pull_request` and `push: branches: [main]`: `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` (node 24, cache pnpm), `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm audit --prod`. Pin action versions to major tags. `permissions: contents: read`.
- [ ] **Step 2:** `release.yml` on `push: tags: ["v*"]`: same setup; step fails unless `"v$(node -p "require('./package.json').version")" == "$GITHUB_REF_NAME"`; `pnpm package`; `softprops/action-gh-release` (or `gh release create`) attaching `release/*.zip`. `permissions: contents: write`.
- [ ] **Step 3:** `dependabot.yml`: ecosystems `npm` and `github-actions`, `interval: weekly`.
- [ ] **Step 4:** Validate locally with `npx --yes @action-validator/cli .github/workflows/*.yml` (or `actionlint` if installed). Commit `ci: add CI, release workflow and dependabot`.

---

### Task 20: Icons, store listing, privacy policy, README

**Files:**
- Create: `assets/icon.svg`, `assets/promo-small.svg`, `scripts/icons.mjs`, `public/icons/icon-{16,32,48,128}.png`, `store/en.md`, `store/ja.md`, `store/screenshots/*.png`, `store/promo-small-440x280.png`, `PRIVACY.md`, `README.ja.md`
- Modify: `README.md`, `build/manifest.template.json` (add `icons` and `action.default_icon`), `package.json` (`"icons": "node scripts/icons.mjs"`, devDependency `@resvg/resvg-js`)

- [ ] **Step 1:** Design `assets/icon.svg`: a 128×128 rounded square in the app's dark palette (`#222` bg, `#ddd` cards) showing a 2×2 grid of tab cards; must stay legible at 16px (test by viewing the 16px PNG). `scripts/icons.mjs` renders it to the four sizes and `promo-small.svg` (440×280, icon + "Urzk Tab Manager") to `store/promo-small-440x280.png`.
- [ ] **Step 2:** Add `icons` / `action.default_icon` to the manifest template; update `tests/build/manifest-plugin.test.ts` with `template icons exist on disk` (every path in `icons` resolves under `public/`). Run → PASS.
- [ ] **Step 3:** Screenshots: `pnpm dev:mock`, browser pane at 1280×800 (`resize_window`), capture 3 shots each for `?lang=en` and `?lang=ja` (overview; hover actions; search with `site:`) into `store/screenshots/{en,ja}-{1,2,3}.png`.
- [ ] **Step 4:** `PRIVACY.md` (en + ja sections): no data collected, stored or transmitted; tab info processed in memory only; favicons loaded by the browser from URLs the open pages specify, without referrer; no analytics; contact via GitHub issues.
- [ ] **Step 5:** `store/{en,ja}.md`: short description (≤132 chars), detailed description, single-purpose statement, permission justifications (`tabs`: read titles/URLs to list and manage tabs; `favicon`: show cached favicons when a page's own icon is unavailable), data-usage disclosure answers ("does not collect user data"), privacy policy URL `https://github.com/urzk/urzk-tab-manager/blob/main/PRIVACY.md`.
- [ ] **Step 6:** `README.md` (en) and `README.ja.md`: features, search syntax, shortcut (and `chrome://extensions/shortcuts` to change it), install/dev (`pnpm dev:mock`, `pnpm build`, load `dist/`), release flow (`pnpm release:*`, push tag), benchmark link, manual test checklist from spec §12, Font Awesome CC BY 4.0 attribution, GPL-3.0 license.
- [ ] **Step 7 (human):** Review the ja copy in `store/ja.md`, `public/_locales/ja/messages.json`, `README.ja.md`.
- [ ] **Step 8:** `pnpm test && pnpm build`; commit `docs: icons, store listing, privacy policy and README`.

---

### Task 21: Final verification

- [ ] **Step 1:** `pnpm audit` → no advisories (fix by upgrading; document any unfixable dev-only advisory in the PR).
- [ ] **Step 2:** `grep -rn "console.log\|@html\|eval(" src` → nothing; `unzip -p release/*.zip manifest.json` shows `version`, `permissions: ["tabs","favicon"]`, CSP.
- [ ] **Step 3:** Run `/security-review`, then superpowers:requesting-code-review on the whole branch; address findings.
- [ ] **Step 4 (human):** Manual checklist (spec §12) on `dist/` in Chrome, en and ja UI (`--lang=ja` launch flag).
- [ ] **Step 5:** `pnpm release:major` → `1.0.0` tag. Do **not** push until the user approves; then superpowers:finishing-a-development-branch.
