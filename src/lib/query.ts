import type { TabLite } from "./state/model";

export type Query = { words: string[]; site?: string; loadedOnly: boolean };

export function parseQuery(input: string): Query {
  const q: Query = { words: [], loadedOnly: false };
  const trimmed = input.trim();
  if (trimmed === "") return q;
  for (const token of trimmed.split(/\s+/)) {
    const lower = token.toLowerCase();
    if (lower === "loaded:" || lower === "l:") {
      q.loadedOnly = true;
    } else if (lower.startsWith("site:") && lower.length > "site:".length) {
      q.site = lower.slice("site:".length);
    } else {
      q.words.push(lower);
    }
  }
  return q;
}

export function isEmptyQuery(q: Query): boolean {
  return q.words.length === 0 && q.site === undefined && !q.loadedOnly;
}

function hostMatches(url: string, site: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host.endsWith(".")) host = host.slice(0, -1);
  return host === site || host.endsWith("." + site);
}

export function matchesTab(q: Query, t: TabLite): boolean {
  if (q.loadedOnly && t.discarded) return false;
  if (q.site !== undefined && !hostMatches(t.url, q.site)) return false;
  const title = t.title.toLowerCase();
  let from = 0;
  for (const w of q.words) {
    const i = title.indexOf(w, from);
    if (i < 0) return false;
    from = i + w.length;
  }
  return true;
}
