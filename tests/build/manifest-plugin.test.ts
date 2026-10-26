import { expect, test } from "vitest";
import { buildManifest } from "../../build/manifest-plugin";
import template from "../../build/manifest.template.json";

const tpl = { manifest_version: 3, name: "__MSG_extName__" };

test("injects version after manifest_version", () => {
  const m = buildManifest(tpl, "1.0.0");
  expect(m.version).toBe("1.0.0");
  expect(Object.keys(m).slice(0, 2)).toEqual(["manifest_version", "version"]);
});

test("rejects template containing version", () => {
  expect(() => buildManifest({ ...tpl, version: "0.1.0" }, "1.0.0")).toThrow(
    /must not contain version/,
  );
});

test("rejects non-semver", () => {
  expect(() => buildManifest(tpl, "1.0")).toThrow();
});

test("template icons exist on disk", () => {
  // Files under public/ that Vite can see; keys look like "../../public/icons/x.png".
  const onDisk = new Set(Object.keys(import.meta.glob("../../public/**/*")));
  const maps: Record<string, string>[] = [
    template.icons,
    template.action.default_icon,
  ];
  for (const map of maps) {
    expect(Object.keys(map)).toEqual(["16", "32", "48", "128"]);
    for (const path of Object.values(map)) {
      expect(onDisk.has(`../../public/${path}`), path).toBe(true);
    }
  }
});
