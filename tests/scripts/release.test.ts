import { describe, expect, test } from "vitest";
import {
  bumpVersion,
  changelogSection,
  rollChangelog,
} from "../../scripts/lib/release.mjs";

describe("bumpVersion", () => {
  test("bumps patch", () =>
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4"));
  test("bumps minor and resets patch", () =>
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0"));
  test("bumps major and resets minor and patch", () =>
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0"));
  test("0.x major becomes 1.0.0", () =>
    expect(bumpVersion("0.1.0", "major")).toBe("1.0.0"));
  test("rejects non X.Y.Z versions", () => {
    expect(() => bumpVersion("1.2", "patch")).toThrow();
    expect(() => bumpVersion("1.2.3-beta", "patch")).toThrow();
  });
  test("rejects unknown kind", () => {
    // @ts-expect-error invalid kind on purpose
    expect(() => bumpVersion("1.2.3", "huge")).toThrow();
  });
});

describe("rollChangelog", () => {
  const text =
    "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Thing\n\n## [0.1.0] - 2026-01-01\n\n- Old\n";

  test("rolls unreleased into version heading", () => {
    expect(rollChangelog(text, "1.0.0", "2026-10-26")).toBe(
      "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-26\n\n### Added\n\n- Thing\n\n## [0.1.0] - 2026-01-01\n\n- Old\n",
    );
  });

  test("throws on empty unreleased", () => {
    expect(() =>
      rollChangelog(
        "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-01-01\n\n- Old\n",
        "1.0.0",
        "2026-10-26",
      ),
    ).toThrow("Unreleased section is empty");
    expect(() =>
      rollChangelog("# Changelog\n\n## [Unreleased]\n", "1.0.0", "2026-10-26"),
    ).toThrow("Unreleased section is empty");
  });
});

describe("changelogSection", () => {
  const text =
    "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-26\n\n### Added\n\n- Thing\n\n## [0.1.0] - 2026-01-01\n\n- Old\n";

  test("returns the body between the version heading and the next heading", () => {
    expect(changelogSection(text, "1.0.0")).toBe("### Added\n\n- Thing\n");
  });
  test("returns the last section through end of file", () => {
    expect(changelogSection(text, "0.1.0")).toBe("- Old\n");
  });
  test("throws when the section is missing", () => {
    expect(() => changelogSection(text, "2.0.0")).toThrow(/2\.0\.0/);
  });
});
