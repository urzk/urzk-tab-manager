import { expect, test } from "vitest";
import { buildManifest } from "../../build/manifest-plugin";

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
