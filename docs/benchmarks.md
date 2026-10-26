# Benchmarks

Measures how the extension's new-tab page behaves with many open tabs.
Use `scripts/open-many-tabs.sh` to load Chrome with the extension and open
lightweight tabs, then record the metrics below.

## Running the launcher

`scripts/open-many-tabs.sh <extension-dir> [tabs=1000] [windows=4]`

- Launches Chrome with a throwaway profile (`--user-data-dir=$(mktemp -d)`) and
  `--load-extension=<extension-dir>`.
- Opens `tabs` tabs (`data:text/html,<title>Tab N</title>`) spread across
  `windows` windows.
- Set `CHROME=/path/to/chrome` to use a different binary.
- Set `DRY_RUN=1` to print the Chrome command lines without running them.

### Baseline (`main`, commit 960b633)

```sh
git worktree add --detach ../urzk-tab-manager-baseline 960b633
cd ../urzk-tab-manager-baseline
pnpm install --frozen-lockfile
pnpm build
cd -
scripts/open-many-tabs.sh ../urzk-tab-manager-baseline 1000 4
```

### 1.0.0 candidate (current branch)

```sh
pnpm build
scripts/open-many-tabs.sh . 1000 4
```

Pass the repo root (`.`), not `dist`: `--load-extension` needs a directory
containing `manifest.json`, and `dist/` only holds the Vite build output
(no manifest). The root manifest points `chrome_url_overrides.newtab` at
`dist/index.html`, so the root is the extension directory for both builds.

## Metrics to record

For each build, after the tabs have opened:

1. **Memory of the new-tab page**: Chrome Task Manager (Shift+Esc) memory for
   the extension's new-tab page row, after opening a new tab.
2. **Memory of the service worker**: Chrome Task Manager memory for the row
   named `Extension: ...` (the background service worker).
3. **DOM node count**: in DevTools console on the new-tab page run
   `document.querySelectorAll('*').length`.
4. **Time-to-render**: DevTools Performance panel. Record a load of the new-tab
   page and measure from navigation start to the end of the last long task
   (> 50 ms).

Also note the Chrome version (`chrome://version`) and the machine
(model, CPU, RAM).

## Results

### Baseline (pre-1.0)

| Chrome version | Machine | New-tab memory (MB) | Service worker memory (MB) | DOM node count | Time-to-render (ms) |
|----------------|---------|---------------------|----------------------------|----------------|---------------------|
|                |         |                     |                            |                |                     |

### 1.0.0 candidate

| Chrome version | Machine | New-tab memory (MB) | Service worker memory (MB) | DOM node count | Time-to-render (ms) |
|----------------|---------|---------------------|----------------------------|----------------|---------------------|
|                |         |                     |                            |                |                     |
