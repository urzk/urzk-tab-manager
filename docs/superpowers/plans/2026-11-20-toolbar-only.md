# Toolbar-only manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop overriding the new tab page and make the toolbar button open or switch to the manager in the current window only.

**Architecture:** Drop `chrome_url_overrides` from the manifest template, move the page from `src/newtab` to `src/manager` (built to `manager/index.html`), and narrow `openManager` to tabs in the clicked window. Copy everywhere stops describing a new tab page.

**Tech Stack:** Chrome MV3, Svelte 5, Vite 8, vitest.

**Spec:** docs/superpowers/specs/2026-11-20-toolbar-only-design.md

## Global Constraints

- Permissions stay `["tabs", "favicon"]`.
- Manager page URL: `chrome.runtime.getURL("manager/index.html")`.
- Several manager tabs in the current window → activate the leftmost (lowest `index`).
- Created tab: `tabs.create({ url, windowId })`, no `index` (end of window).

## Review Focus

- A manager tab still loading (only `pendingUrl` set) in the current window must be reused, not duplicated — Task 1 test "matches pendingUrl".
- The only manager tab is in another window → a new one opens in the current window and the other window is not focused — Task 1 test.
- Chrome's own `chrome://newtab/` tab in the current window must not be taken for the manager — Task 1 test.
- `currentWindowId` undefined (action clicked with no window id) → look in Chrome's current window (`{ currentWindow: true }`), no crash — Task 1 test.
- The built `dist/manifest.json` has no `chrome_url_overrides` and the page exists at `dist/manager/index.html` — Task 2 verification.

---

### Task 1: openManager uses the current window only

**Files:**
- Modify: `src/background/open-manager.ts`
- Test: `tests/background/open-manager.test.ts`

**Interfaces:**
- Produces: `openManager(api: ChromeApi, managerUrl: string, currentWindowId: number | undefined): Promise<void>` (signature unchanged).

- [ ] **Step 1: Rewrite the tests**
  - "focuses the manager tab in the current window": expect `tabs.update(id, {active: true})`, `tabs.create` not called, `windows.update` not called.
  - "opens a new one in the current window when only another window has one": expect `tabs.create({url: MANAGER, windowId: w1.id})`, `tabs.update`/`windows.update` not called.
  - "picks the leftmost of several manager tabs in the current window".
  - "matches a tab whose pendingUrl is the manager" (kept).
  - "does not treat chrome://newtab/ as the manager": creates a tab.
  - "creates a tab when none exists" (kept), "creates without windowId when currentWindowId is undefined", "swallows errors" (kept).
- [ ] **Step 2: Run** `pnpm vitest run tests/background/open-manager.test.ts` — expect failures on the other-window, newtab and windows.update cases.
- [ ] **Step 3: Implement** — `tabs.query({ windowId: currentWindowId })`, or `{ currentWindow: true }` when the id is undefined, keep tabs whose `url` or `pendingUrl` equals `managerUrl`, sort by `index`, activate the first; otherwise create.
- [ ] **Step 4: Run** the test file — PASS.
- [ ] **Step 5: Commit** `feat(background): open the manager in the current window only`.

### Task 2: Remove the new tab override and rename the page

**Files:**
- Modify: `build/manifest.template.json` (drop `chrome_url_overrides`), `vite.config.ts` (input `manager: src/manager/index.html`), `src/background/service-worker.ts` (`manager/index.html`), `src/mock/main.ts`, `src/mock/index.html` comment, tests importing `src/newtab/...`.
- Move: `src/newtab/` → `src/manager/` (`git mv`).
- Test: `tests/build/manifest-plugin.test.ts` — add "manifest has no chrome_url_overrides".

- [ ] **Step 1:** Add the manifest test; run it — FAIL.
- [ ] **Step 2:** Make the changes above; `pnpm check && pnpm test` — PASS.
- [ ] **Step 3:** `pnpm build` → `dist/manager/index.html` exists, `grep -c chrome_url_overrides dist/manifest.json` is 0.
- [ ] **Step 4: Commit** `feat!: stop overriding the new tab page`.

### Task 3: Copy and docs

**Files:** `public/_locales/{en,ja}/messages.json` (extDescription), `store/en.md`, `store/ja.md`, `README.md`, `README.ja.md`, `PRIVACY.md`, `assets/promo-small.svg` (+ `pnpm` icon/promo regeneration if text changes), `docs/benchmarks.md`, `docs/architecture.md`, `CHANGELOG.md` (Unreleased).

- [ ] **Step 1:** Replace "new tab page" framing with "opens from the toolbar button or Alt+Shift+T"; describe the current-window behaviour in the toolbar feature bullet; keep the short description ≤ 132 chars.
- [ ] **Step 2:** `grep -rniE "new ?tab|newtab|新しいタブ|新規タブ"` outside historical specs/plans returns only intended mentions (e.g. "does not replace the new tab page").
- [ ] **Step 3:** `pnpm check && pnpm lint && pnpm test && pnpm build && pnpm package` — all pass.
- [ ] **Step 4: Commit** `docs: describe the toolbar-only manager`.
