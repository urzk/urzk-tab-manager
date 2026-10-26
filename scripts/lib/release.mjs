const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const UNRELEASED = "## [Unreleased]";

/**
 * @param {string} v current version, strictly X.Y.Z
 * @param {"patch" | "minor" | "major"} kind
 * @returns {string}
 */
export function bumpVersion(v, kind) {
  const m = SEMVER.exec(v);
  if (!m) throw new Error(`Invalid version: ${v}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === "major") return major === 0 ? "1.0.0" : `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Invalid kind: ${String(kind)}`);
}

/**
 * Body of a `## ` section, starting after the heading line, up to the next `## ` heading.
 * @param {string} text
 * @param {number} headingEnd index just after the heading text
 */
function bodyAfter(text, headingEnd) {
  const rest = text.slice(headingEnd);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * @param {string} text CHANGELOG.md contents
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function rollChangelog(text, version, date) {
  const at = text.indexOf(UNRELEASED);
  if (at === -1) throw new Error("Unreleased section not found");
  const end = at + UNRELEASED.length;
  if (bodyAfter(text, end).trim() === "")
    throw new Error("Unreleased section is empty");
  return `${text.slice(0, end)}\n\n## [${version}] - ${date}${text.slice(end)}`;
}

/**
 * @param {string} text CHANGELOG.md contents
 * @param {string} version
 * @returns {string} section body without its heading
 */
export function changelogSection(text, version) {
  const heading = new RegExp(
    `^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\].*$`,
    "m",
  );
  const m = heading.exec(text);
  if (!m) throw new Error(`Changelog section for ${version} not found`);
  const body = bodyAfter(text, m.index + m[0].length).trim();
  if (body === "") throw new Error(`Changelog section for ${version} is empty`);
  return `${body}\n`;
}
