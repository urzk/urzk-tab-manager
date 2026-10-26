import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const SEMVER = /^\d+\.\d+\.\d+$/;

export function buildManifest(
  template: Record<string, unknown>,
  version: string,
): Record<string, unknown> {
  if ("version" in template) {
    throw new Error("manifest template must not contain version");
  }
  if (!SEMVER.test(version)) {
    throw new Error(`invalid version "${version}": expected MAJOR.MINOR.PATCH`);
  }
  const { manifest_version, ...rest } = template;
  return { manifest_version, version, ...rest };
}

export function manifestPlugin(): Plugin {
  return {
    name: "urzk-manifest",
    generateBundle() {
      const root = process.cwd();
      const template = JSON.parse(
        readFileSync(resolve(root, "build/manifest.template.json"), "utf8"),
      );
      const pkg = JSON.parse(
        readFileSync(resolve(root, "package.json"), "utf8"),
      );
      const manifest = buildManifest(template, pkg.version);
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2) + "\n",
      });
    },
  };
}
