import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { changelogSection } from "./lib/release.mjs";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/changelog-section.mjs <version>");
  process.exit(1);
}

try {
  const text = readFileSync(
    resolve(import.meta.dirname, "../CHANGELOG.md"),
    "utf8",
  );
  process.stdout.write(changelogSection(text, version));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
