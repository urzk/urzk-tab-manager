import { describe, expect, it } from "vitest";
import { fallbackFavicon, faviconSrc } from "../src/lib/favicon";

const getURL = (p: string) => `chrome-extension://id${p}`;

describe("faviconSrc", () => {
  it("uses favIconUrl for https", () => {
    const u = "https://example.com/f.ico";
    expect(faviconSrc({ url: "https://example.com", favIconUrl: u }, getURL)).toBe(u);
  });
  it("uses favIconUrl for data:", () => {
    const u = "data:image/png;base64,AAAA";
    expect(faviconSrc({ url: "https://example.com", favIconUrl: u }, getURL)).toBe(u);
  });
  it("falls back when empty", () => {
    const out = faviconSrc({ url: "https://example.com" }, getURL);
    expect(out).toBe(fallbackFavicon("https://example.com", getURL));
    expect(faviconSrc({ url: "https://example.com", favIconUrl: "" }, getURL)).toBe(out);
  });
  it("rejects javascript: and file: schemes", () => {
    for (const u of ["javascript:alert(1)", "file:///etc/passwd", "not a url"]) {
      const out = faviconSrc({ url: "https://example.com", favIconUrl: u }, getURL);
      expect(out).toBe(fallbackFavicon("https://example.com", getURL));
    }
  });
  it("fallback encodes pageUrl", () => {
    expect(fallbackFavicon("https://a.com/?q=1&r=2", getURL)).toBe(
      "chrome-extension://id/_favicon/?pageUrl=https%3A%2F%2Fa.com%2F%3Fq%3D1%26r%3D2&size=32",
    );
    expect(fallbackFavicon("", getURL)).toBe("chrome-extension://id/_favicon/?pageUrl=&size=32");
  });
});
