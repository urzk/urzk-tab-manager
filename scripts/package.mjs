import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(root, "dist/manifest.json"), "utf8"));

if (manifest.version !== version) {
  console.error(`dist/manifest.json version ${manifest.version} != package.json ${version}`);
  process.exit(1);
}

mkdirSync(resolve(root, "release"), { recursive: true });
const out = resolve(root, `release/urzk-tab-manager-${version}.zip`);
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", out, ".", "-x", "*.DS_Store"], { cwd: resolve(root, "dist"), stdio: "inherit" });
process.stdout.write(`wrote ${out}\n`);
