# Toolbar-only manager (no new tab override) — short design

Date: 2026-11-20. Status: approved by the user in conversation.

## Intent

The manager is reached from the toolbar button and Alt+Shift+T, so replacing
Chrome's new tab page is unnecessary. The user wants the new tab page left
alone, and the toolbar button to always work within the window the user is in.

## Goals

- Remove the new tab override (`chrome_url_overrides`). Chrome's own new tab
  page comes back; this also avoids Chrome's "change back?" prompt for
  extensions that replace it.
- Toolbar button / shortcut: switch to a manager tab in the **current window**.
  If the current window has none, open one there. Manager tabs in other
  windows are ignored (no window switching).

## Non-goals

- No UI changes to the manager page itself; store screenshots are reused.
- No new permissions. Still `tabs` and `favicon` only.

## Approaches

- **Chosen: current-window-only lookup in `openManager`.** Query manager tabs,
  keep those in the clicked window, activate the first (leftmost); otherwise
  `tabs.create({ url, windowId })`. The window is already focused (the
  button was clicked in it), so no `windows.update`.
- Rejected: keep the "prefer current, fall back to another window" lookup.
  That is the behaviour the user asked to remove.
- Rejected: query with `{ windowId, url }` filtering in Chrome. URL matching
  of extension pages in `tabs.query` would need the `url` pattern semantics
  and misses `pendingUrl`; filtering in code is simpler and already tested.

## Decisions

- New tab position: end of the current window (`tabs.create` default).
- Several manager tabs in the current window: activate the leftmost.
- Page path: `newtab/index.html` → `manager/index.html` (source dir
  `src/newtab` → `src/manager`). It shows in the address bar and nothing is
  released yet, so renaming costs nothing.
- `chrome://newtab` is no longer treated as a manager tab.

## Text to update

`_locales` (extDescription), store/en.md and store/ja.md (short and detailed
descriptions, single purpose, permission text), README.md, README.ja.md,
PRIVACY.md, assets/promo-small.svg (+ regenerated PNG if it mentions the new
tab page), docs/benchmarks.md, docs/architecture.md, CHANGELOG.md, the mock
page comment. Historical specs/plans are left as they are.

## Tests

`openManager`: activates a manager tab in the current window; creates one in
the current window when only other windows have one; creates one when none
exists; picks the leftmost of several; matches `pendingUrl`; no longer
matches `chrome://newtab/`; swallows errors. Manifest test: no
`chrome_url_overrides`.
