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

run("pnpm", ["test"], true);

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = bumpVersion(pkg.version, kind);
const changelogPath = resolve(root, "CHANGELOG.md");
// Roll first: it throws on an empty Unreleased section before anything is written.
const rolled = rollChangelog(
  readFileSync(changelogPath, "utf8"),
  version,
  localDate(),
);

pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(changelogPath, rolled);

run("git", ["add", "package.json", "CHANGELOG.md"]);
run("git", ["commit", "-m", `release: v${version}`], true);
run("git", ["tag", "-a", `v${version}`, "-m", `v${version}`]);
process.stdout.write(
  `released v${version}\npush with: git push && git push --tags\n`,
);

function localDate() {
  const d = new Date();
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
