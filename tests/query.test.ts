import { describe, expect, it } from "vitest";
import { isEmptyQuery, matchesTab, parseQuery } from "../src/lib/query";
import type { TabLite } from "../src/lib/state/model";

const tab = (over: Partial<TabLite> = {}): TabLite => ({
  id: 1,
  windowId: 1,
  title: "Title",
  url: "https://example.com/",
  discarded: false,
  active: false,
  pinned: false,
  ...over,
});

describe("parseQuery", () => {
  it("parses words, site and loaded", () => {
    expect(parseQuery("Foo loaded: site:Example.COM bar")).toEqual({
      words: ["foo", "bar"],
      site: "example.com",
      loadedOnly: true,
    });
  });
  it("l: is alias of loaded:", () => {
    expect(parseQuery("l:").loadedOnly).toBe(true);
  });
  it("empty input gives empty query", () => {
    expect(parseQuery("   ")).toEqual({ words: [], loadedOnly: false });
    expect(isEmptyQuery(parseQuery(""))).toBe(true);
    expect(isEmptyQuery(parseQuery("a"))).toBe(false);
  });
  it("site: with empty host is a plain word; last site wins", () => {
    expect(parseQuery("site:").words).toEqual(["site:"]);
    expect(parseQuery("site:a.com site:b.com").site).toBe("b.com");
  });
});

describe("matchesTab", () => {
  it("words match in order", () => {
    const q = parseQuery("foo bar");
    expect(matchesTab(q, tab({ title: "Foo x Bar" }))).toBe(true);
    expect(matchesTab(q, tab({ title: "Bar x Foo" }))).toBe(false);
  });
  it("case-insensitive", () => {
    expect(matchesTab(parseQuery("FOO"), tab({ title: "fOo" }))).toBe(true);
  });
  it("site matches subdomains but not suffix lookalikes", () => {
    const q = parseQuery("site:example.com");
    expect(matchesTab(q, tab({ url: "https://a.example.com/x" }))).toBe(true);
    expect(matchesTab(q, tab({ url: "https://example.com/" }))).toBe(true);
    expect(matchesTab(q, tab({ url: "https://example.com./" }))).toBe(true);
    expect(matchesTab(q, tab({ url: "https://badexample.com/" }))).toBe(false);
  });
  it("site: never throws on unparsable urls", () => {
    const q = parseQuery("site:example.com");
    for (const url of ["", "chrome://newtab", "not a url"]) {
      expect(matchesTab(q, tab({ url }))).toBe(false);
    }
  });
  it("loaded excludes discarded", () => {
    const q = parseQuery("loaded:");
    expect(matchesTab(q, tab({ discarded: true }))).toBe(false);
    expect(matchesTab(q, tab())).toBe(true);
  });
  it("regex metacharacters are literal", () => {
    const q = parseQuery("a.*b");
    expect(matchesTab(q, tab({ title: "axxb" }))).toBe(false);
    expect(matchesTab(q, tab({ title: "a.*b" }))).toBe(true);
  });
});
