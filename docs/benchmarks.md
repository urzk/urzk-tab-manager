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
scripts/open-many-tabs.sh dist 1000 4
```

Requires the restructured build from the 1.0 work, where `dist/` is
self-contained with `dist/manifest.json`. Run `pnpm build` first.

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

### If the extension does not load

Branded Google Chrome 137+ ignores `--load-extension`. The script passes
`--disable-features=DisableLoadExtensionCommandLineSwitch` to work around this,
but if the extension still does not appear (no new-tab override, no
`Extension: ...` row in Task Manager), use one of these alternatives:

- Point `CHROME` at Chrome for Testing or Chromium, which still honor
  `--load-extension`.
- Or load the directory manually: open `chrome://extensions`, enable Developer
  mode, click "Load unpacked", and select the extension directory, in the same
  profile the script printed (`--user-data-dir`).

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
