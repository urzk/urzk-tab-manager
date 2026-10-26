import { afterEach, describe, expect, it } from "vitest";
import en from "../public/_locales/en/messages.json";
import ja from "../public/_locales/ja/messages.json";
import { setFallbackMessages, t } from "../src/lib/i18n";

type Dict = Record<string, { message: string; placeholders?: object }>;
const sources = import.meta.glob<string>("../src/**/*.{ts,svelte}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const placeholders = (m: string) =>
  [...m.matchAll(/\$([A-Z_]+)\$/g)].map((x) => x[1]).sort();

afterEach(() => setFallbackMessages({}));

describe("locales", () => {
  it("en and ja have identical keys", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it("every placeholder used in en exists in ja", () => {
    for (const [k, v] of Object.entries(en as Dict)) {
      expect(placeholders((ja as Dict)[k].message), k).toEqual(
        placeholders(v.message),
      );
    }
  });

  it("every placeholder is declared with content $1", () => {
    for (const dict of [en, ja] as Dict[]) {
      for (const [k, v] of Object.entries(dict)) {
        for (const p of placeholders(v.message)) {
          const decl = v.placeholders as
            | Record<string, { content: string }>
            | undefined;
          expect(decl?.[p.toLowerCase()]?.content, `${k}:${p}`).toBe("$1");
        }
      }
    }
  });

  it('every t("…") key used under src/ exists in en', () => {
    const used = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const m of text.matchAll(/\bt\(\s*["'`]([A-Za-z]+)["'`]/g))
        used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const k of used) expect(Object.keys(en), k).toContain(k);
  });
});

describe("t fallback", () => {
  it("substitutes placeholders", () => {
    setFallbackMessages({
      tabCount: {
        message: "$COUNT$ tabs",
        placeholders: { count: { content: "$1" } },
      },
      windowTitle: {
        message: "Window #$ID$ / $ID$",
        placeholders: { id: { content: "$1" } },
      },
    });
    expect(t("tabCount" as never, "5")).toBe("5 tabs");
    expect(t("windowTitle" as never, ["7"])).toBe("Window #7 / 7");
  });

  it("returns the key for unknown keys", () => {
    expect(t("nope" as never)).toBe("nope");
  });

  it("returns plain messages", () => {
    setFallbackMessages({ heading: { message: "Tabs" } });
    expect(t("heading")).toBe("Tabs");
  });
});
