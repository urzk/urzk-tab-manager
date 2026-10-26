import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { bumpVersion, rollChangelog } from "./lib/release.mjs";

const root = resolve(import.meta.dirname, "..");
const kind = process.argv[2];

if (kind !== "patch" && kind !== "minor" && kind !== "major") {
  console.error("usage: node scripts/release.mjs <patch|minor|major>");
  process.exit(1);
}

/** @param {string} cmd @param {string[]} args @param {boolean} [inherit] */
const run = (cmd, args, inherit = false) =>
  execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: inherit ? "inherit" : undefined,
  });

if (run("git", ["status", "--porcelain"]).trim() !== "") {
  console.error("working tree is not clean; commit or stash changes first");
  process.exit(1);
}

const pkgPath = resolve(root, "package.json");
const changelogPath = resolve(root, "CHANGELOG.md");
const origPkgText = readFileSync(pkgPath, "utf8");
const origChangelog = readFileSync(changelogPath, "utf8");
const pkg = JSON.parse(origPkgText);
const version = bumpVersion(pkg.version, kind);
const tag = `v${version}`;
// Roll in memory first: it throws on an empty Unreleased section before the slow tests run.
const rolled = rollChangelog(origChangelog, version, localDate());

run("pnpm", ["test"], true);

let committed = false;
try {
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(changelogPath, rolled);
  run("git", ["add", "package.json", "CHANGELOG.md"]);
  run("git", ["commit", "-m", `release: ${tag}`], true);
  committed = true;
  run("git", ["tag", "-a", tag, "-m", tag]);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (committed) {
    console.error(`release commit was created but tagging failed: ${msg}`);
    console.error(`to retry the tag:   git tag -a ${tag} -m ${tag}`);
    console.error("to undo the commit: git reset --hard HEAD~1");
  } else {
    console.error(`release failed before the commit: ${msg}`);
    writeFileSync(pkgPath, origPkgText);
    writeFileSync(changelogPath, origChangelog);
    try {
      run("git", ["reset", "-q", "package.json", "CHANGELOG.md"]);
    } catch {
      // nothing staged or git unavailable; files are already restored
    }
    console.error("package.json and CHANGELOG.md were restored and unstaged");
  }
  process.exit(1);
}
process.stdout.write(
  `released ${tag}\npush with: git push && git push --tags\n`,
);

function localDate() {
  const d = new Date();
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
