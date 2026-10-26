export function bumpVersion(
  v: string,
  kind: "patch" | "minor" | "major",
): string;
export function rollChangelog(
  text: string,
  version: string,
  date: string,
): string;
export function changelogSection(text: string, version: string): string;
