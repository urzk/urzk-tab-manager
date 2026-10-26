import type { TabLite } from "./state/model";

const ALLOWED_SCHEMES = new Set(["http:", "https:", "data:", "chrome:"]);

export function fallbackFavicon(
  pageUrl: string,
  getURL: (p: string) => string,
): string {
  return getURL("/_favicon/?pageUrl=" + encodeURIComponent(pageUrl) + "&size=32");
}

export function faviconSrc(
  t: Pick<TabLite, "url" | "favIconUrl">,
  getURL: (p: string) => string,
): string {
  const icon = t.favIconUrl;
  if (icon) {
    try {
      if (ALLOWED_SCHEMES.has(new URL(icon).protocol)) return icon;
    } catch {
      // fall through to fallback
    }
  }
  return fallbackFavicon(t.url, getURL);
}
