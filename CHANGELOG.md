# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Extension and toolbar icons.
- Clicking the toolbar button or pressing Alt+Shift+T focuses the tab manager if it is already open, or opens it otherwise.
- Japanese UI, selected automatically from the browser language.
- Search is case-insensitive and matches words in order.
- `site:` filter to search by site, and `loaded:` (short form `l:`) filter to search by load state.
- While searching, windows with no matching tabs are hidden.

### Changed

- Tab and window state is now event-driven, with a periodic reconcile to catch missed events.
- Collapsed windows are not rendered, and hover actions are rendered only when needed, so large tab counts stay responsive.
- Icons are rendered as inline SVG.
- Rebuilt on Svelte 5 and Vite 8.
- Favicons are loaded with `no-referrer` and fall back to Chrome's `_favicon` endpoint.

### Removed

- Background message relay between the service worker and the manager page.

### Security

- Permissions are limited to `tabs` and `favicon`.
- An explicit Content Security Policy is set for extension pages.
- Favicons are fetched with a `no-referrer` policy so page URLs are not leaked.
