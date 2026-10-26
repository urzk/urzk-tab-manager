#!/usr/bin/env bash
# Launch Chrome with an extension loaded and open many lightweight tabs.
#
# Usage: scripts/open-many-tabs.sh <extension-dir> [tabs=1000] [windows=4]
#
# Env:
#   CHROME   Chrome binary (default: macOS Google Chrome app)
#   DRY_RUN  set to 1 to print the Chrome command lines instead of running them
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DRY_RUN="${DRY_RUN:-0}"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <extension-dir> [tabs=1000] [windows=4]" >&2
  exit 2
fi

EXT_DIR="$1"
TABS="${2:-1000}"
WINDOWS="${3:-4}"

if [[ "$TABS" -lt 1 || "$WINDOWS" -lt 1 ]]; then
  echo "tabs and windows must be >= 1" >&2
  exit 2
fi

EXT_DIR="$(cd "$EXT_DIR" && pwd)"
if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "warning: $EXT_DIR has no manifest.json; Chrome will not load it as an extension" >&2
fi
PROFILE="$(mktemp -d)"
echo "note: if the extension does not appear, use Chrome for Testing/Chromium via CHROME=..., or load $EXT_DIR manually at chrome://extensions (Load unpacked) in profile $PROFILE" >&2
PER_WINDOW=$(( (TABS + WINDOWS - 1) / WINDOWS ))

# Print a command line in a copy-pasteable, shell-escaped form.
print_cmd() {
  printf '%q ' "$@"
  printf '\n'
}

tab_url() {
  printf 'data:text/html,<title>Tab %d</title>' "$1"
}

tab=1
for (( w = 1; w <= WINDOWS && tab <= TABS; w++ )); do
  urls=()
  for (( i = 0; i < PER_WINDOW && tab <= TABS; i++, tab++ )); do
    urls+=("$(tab_url "$tab")")
  done

  common=("--user-data-dir=$PROFILE" "--load-extension=$EXT_DIR" "--no-first-run"
    "--disable-features=DisableLoadExtensionCommandLineSwitch")
  if (( w == 1 )); then
    cmd=("$CHROME" "${common[@]}" "${urls[@]}")
  else
    cmd=("$CHROME" "${common[@]}" "--new-window" "${urls[@]}")
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "# window $w: ${#urls[@]} tabs"
    print_cmd "${cmd[@]}"
  elif (( w == 1 )); then
    # First batch starts Chrome; keep it running in the background.
    "${cmd[@]}" >/dev/null 2>&1 &
    sleep 3
  else
    "${cmd[@]}" >/dev/null 2>&1 || true
    sleep 1
  fi
done

if [[ "$DRY_RUN" != "1" ]]; then
  echo "opened $((tab - 1)) tabs in up to $WINDOWS windows (profile: $PROFILE)"
fi
