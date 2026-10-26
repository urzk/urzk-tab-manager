import type { Listener } from "../../src/lib/chrome/api";
import { describe, expect, it } from "vitest";
import {
  createFakeChrome,
  type FakeChrome,
  type FakeSeed,
} from "../../src/mock/fake-chrome";

const tab = (n: string, extra: Record<string, unknown> = {}) => ({
  title: n,
  url: `https://${n}.test/`,
  ...extra,
});

const seed = (): FakeSeed => ({
  windows: [
    { tabs: [tab("a"), tab("b"), tab("c")] },
    { tabs: [tab("d"), tab("e")] },
  ],
});

type Entry = [string, ...unknown[]];

function record(f: FakeChrome): Entry[] {
  const log: Entry[] = [];
  const hook = <A extends unknown[]>(name: string, l: Listener<A>) =>
    l.addListener((...a: A) => {
      log.push([name, ...a]);
    });
  hook("w.created", f.windows.onCreated);
  hook("w.removed", f.windows.onRemoved);
  hook("w.focus", f.windows.onFocusChanged);
  hook("t.created", f.tabs.onCreated);
  hook("t.updated", f.tabs.onUpdated);
  hook("t.moved", f.tabs.onMoved);
  hook("t.attached", f.tabs.onAttached);
  hook("t.detached", f.tabs.onDetached);
  hook("t.removed", f.tabs.onRemoved);
  hook("t.replaced", f.tabs.onReplaced);
  hook("t.activated", f.tabs.onActivated);
  return log;
}

const names = (log: Entry[]) => log.map((e) => e[0]);
const manual = (s: FakeSeed = seed()) => {
  const f = createFakeChrome(s);
  f.deliver = "manual";
  return f;
};
const ids = (f: FakeChrome, w: number) => f.truth()[w].tabs!.map((t) => t.id!);
const titles = (f: FakeChrome, w: number) =>
  f.truth()[w].tabs!.map((t) => t.title);

describe("fake chrome", () => {
  it("getAll returns seeded windows with contiguous indexes", async () => {
    const f = createFakeChrome(seed());
    const wins = await f.windows.getAll({ populate: true });
    expect(wins).toHaveLength(2);
    expect(wins.map((w) => w.tabs!.map((t) => t.index))).toEqual([
      [0, 1, 2],
      [0, 1],
    ]);
    const all = wins.flatMap((w) => [w.id!, ...w.tabs!.map((t) => t.id!)]);
    expect(new Set(all).size).toBe(all.length);
    for (const w of wins)
      for (const t of w.tabs!) expect(t.windowId).toBe(w.id);
    expect(wins[0].tabs!.map((t) => t.active)).toEqual([true, false, false]);
    expect(wins[1].tabs!.map((t) => t.active)).toEqual([true, false]);
  });

  it("move within window reorders and fires onMoved(fromIndex,toIndex)", async () => {
    const f = manual();
    const log = record(f);
    const [a, , c] = ids(f, 0);
    await f.tabs.move(a, { index: 2 });
    f.flush();
    expect(titles(f, 0)).toEqual(["b", "c", "a"]);
    expect(f.truth()[0].tabs!.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(log).toEqual([
      ["t.moved", a, { windowId: f.truth()[0].id, fromIndex: 0, toIndex: 2 }],
    ]);
    expect(c).toBeDefined();
  });

  it("move to the current index fires no event; -1 appends", async () => {
    const f = manual();
    const log = record(f);
    const [a, b] = ids(f, 0);
    await f.tabs.move(b, { index: 1 });
    f.flush();
    expect(log).toEqual([]);
    await f.tabs.move(a, { index: -1 });
    f.flush();
    expect(titles(f, 0)).toEqual(["b", "c", "a"]);
    expect(log[0].slice(0, 2)).toEqual(["t.moved", a]);
    expect(log[0][2]).toMatchObject({ fromIndex: 0, toIndex: 2 });
  });

  it("cross-window move fires onDetached then onAttached", async () => {
    const f = manual();
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    const [a, b] = ids(f, 0);
    const moved = (await f.tabs.move(a, {
      windowId: w1,
      index: 1,
    })) as chrome.tabs.Tab;
    f.flush();
    expect(moved).toMatchObject({ id: a, windowId: w1, index: 1 });
    expect(log).toEqual([
      ["t.detached", a, { oldWindowId: w0, oldPosition: 0 }],
      ["t.activated", { tabId: b, windowId: w0 }], // a was active: source activates a neighbour
      ["t.attached", a, { newWindowId: w1, newPosition: 1 }],
    ]);
    expect(f.truth()[1].tabs!.map((t) => t.active)).toEqual([
      true,
      false,
      false,
    ]);
    expect(titles(f, 0)).toEqual(["b", "c"]);
    expect(titles(f, 1)).toEqual(["d", "a", "e"]);
    for (const w of f.truth()) {
      expect(w.tabs!.map((t) => t.index)).toEqual(w.tabs!.map((_, i) => i));
      expect(w.tabs!.filter((t) => t.active)).toHaveLength(1);
      for (const t of w.tabs!) expect(t.windowId).toBe(w.id);
    }
  });

  it("moving the last tab out of a window closes it after detach/attach", async () => {
    const f = manual({ windows: [{ tabs: [tab("a")] }, { tabs: [tab("b")] }] });
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    const a = ids(f, 0)[0];
    await f.tabs.move(a, { windowId: w1, index: -1 });
    f.flush();
    expect(log).toEqual([
      ["t.detached", a, { oldWindowId: w0, oldPosition: 0 }],
      ["t.attached", a, { newWindowId: w1, newPosition: 1 }],
      ["w.removed", w0],
      ["w.focus", w1], // w0 was focused
    ]);
    expect(f.truth().map((w) => w.id)).toEqual([w1]);
  });

  it("removing last tab fires tabs.onRemoved(isWindowClosing) then windows.onRemoved", async () => {
    const f = manual({ windows: [{ tabs: [tab("a")] }, { tabs: [tab("b")] }] });
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    const a = ids(f, 0)[0];
    await f.tabs.remove(a);
    f.flush();
    expect(log.slice(0, 2)).toEqual([
      ["t.removed", a, { windowId: w0, isWindowClosing: true }],
      ["w.removed", w0],
    ]);
    expect(f.truth().map((w) => w.id)).toEqual([w1]);
  });

  it("removing the focused window moves focus to another window", async () => {
    const f = manual({ windows: [{ tabs: [tab("a")] }, { tabs: [tab("b")] }] });
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    await f.windows.remove(w0);
    f.flush();
    expect(names(log)).toEqual(["t.removed", "w.removed", "w.focus"]);
    expect(log[2]).toEqual(["w.focus", w1]);
    expect(f.truth()[0].focused).toBe(true);
  });

  it("move unpinned before pinned rejects", async () => {
    const f = manual({
      windows: [
        {
          tabs: [
            tab("p", { pinned: true }),
            tab("q", { pinned: true }),
            tab("u"),
          ],
        },
      ],
    });
    const log = record(f);
    const [, , u] = ids(f, 0);
    await expect(f.tabs.move(u, { index: 0 })).rejects.toThrow(
      "Cannot move tab",
    );
    await expect(f.tabs.move(u, { index: 1 })).rejects.toThrow(
      "Cannot move tab",
    );
    await expect(f.tabs.move(ids(f, 0)[0], { index: 2 })).rejects.toThrow(
      "Cannot move tab",
    );
    f.flush();
    expect(log).toEqual([]);
    expect(titles(f, 0)).toEqual(["p", "q", "u"]);
  });

  it("manual delivery holds events until flush", async () => {
    const f = manual();
    const log = record(f);
    await f.tabs.move(ids(f, 0)[0], { index: 1 });
    await Promise.resolve();
    expect(log).toEqual([]);
    f.flush();
    expect(names(log)).toEqual(["t.moved"]);
  });

  it("sync delivery flushes after the mutation via microtask", async () => {
    const f = createFakeChrome(seed());
    const log = record(f);
    const p = f.tabs.move(ids(f, 0)[0], { index: 1 });
    expect(log).toEqual([]);
    await p;
    await Promise.resolve();
    expect(names(log)).toEqual(["t.moved"]);
  });

  it("dropNextEvents discards the next n events", async () => {
    const f = manual();
    const log = record(f);
    f.dropNextEvents(1);
    await f.tabs.move(ids(f, 0)[0], { index: 1 });
    await f.tabs.move(ids(f, 0)[0], { index: 2 });
    f.flush();
    expect(names(log)).toEqual(["t.moved"]);
    expect(log[0][2]).toMatchObject({ fromIndex: 0, toIndex: 2 });
  });

  it("removing the active tab activates the tab now at that index, else the previous", async () => {
    const f = manual();
    const log = record(f);
    const wid = f.truth()[0].id!;
    const [a, b, c] = ids(f, 0);
    await f.tabs.remove(a); // active, index 0 -> b takes over
    f.flush();
    expect(f.truth()[0].tabs!.map((t) => t.active)).toEqual([true, false]);
    expect(log).toContainEqual(["t.activated", { tabId: b, windowId: wid }]);
    await f.tabs.update(c, { active: true });
    log.length = 0;
    await f.tabs.remove(c); // active, last -> previous (b)
    f.flush();
    expect(log).toContainEqual(["t.activated", { tabId: b, windowId: wid }]);
    expect(f.truth()[0].tabs!.map((t) => [t.id, t.active])).toEqual([
      [b, true],
    ]);
  });

  it("removing an inactive tab fires no onActivated", async () => {
    const f = manual();
    const log = record(f);
    await f.tabs.remove(ids(f, 0)[2]);
    f.flush();
    expect(names(log)).toEqual(["t.removed"]);
    expect(log[0][2]).toMatchObject({ isWindowClosing: false });
  });

  it("returned and delivered objects are copies", async () => {
    const f = manual();
    const got: chrome.tabs.Tab[] = [];
    f.tabs.onCreated.addListener((t) => {
      t.title = "mutated";
      got.push(t);
    });
    const wins = await f.windows.getAll({ populate: true });
    wins[0].tabs![0].title = "hacked";
    wins[0].tabs!.pop();
    f.truth()[0].tabs![1].title = "hacked";
    const first = ids(f, 0)[0];
    const t = await f.tabs.get(first);
    t.url = "x";
    (await f.tabs.query({}))[0].pinned = true;
    const created = await f.tabs.create({ url: "https://n.test/" });
    created.title = "mutated2";
    f.flush();
    expect(titles(f, 0).slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(f.truth()[0].tabs!).toHaveLength(4);
    expect((await f.tabs.get(first)).url).toBe("https://a.test/");
    expect((await f.tabs.get(created.id!)).title).not.toMatch(/mutated/);
    expect(got).toHaveLength(1);
  });

  it("each listener gets its own copy of event args", async () => {
    const f = manual();
    f.tabs.onCreated.addListener((t) => (t.title = "L1"));
    let seen = "";
    f.tabs.onCreated.addListener((t) => (seen = t.title ?? ""));
    await f.tabs.create({ url: "https://z.test/" });
    f.flush();
    expect(seen).not.toBe("L1");
  });

  it("windows.create({tabId}) fires onDetached, windows.onCreated, onAttached, then focus", async () => {
    const f = manual();
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    const [a, b] = ids(f, 0);
    const win = (await f.windows.create({ tabId: a })) as chrome.windows.Window;
    f.flush();
    const nw = win.id!;
    expect([w0, w1]).not.toContain(nw);
    expect(win.tabs!.map((t) => t.id)).toEqual([a]);
    // a was active in w0, so w0 activates b between detach and attach
    expect(names(log)).toEqual([
      "t.detached",
      "t.activated",
      "w.created",
      "t.attached",
      "w.focus",
    ]);
    expect(log[0]).toEqual([
      "t.detached",
      a,
      { oldWindowId: w0, oldPosition: 0 },
    ]);
    expect(log[1]).toEqual(["t.activated", { tabId: b, windowId: w0 }]);
    expect(log[2][1]).toMatchObject({ id: nw, focused: true });
    expect(log[3]).toEqual([
      "t.attached",
      a,
      { newWindowId: nw, newPosition: 0 },
    ]);
    expect(log[4]).toEqual(["w.focus", nw]);
    const truth = f.truth();
    expect(truth.map((w) => w.id)).toEqual([w0, w1, nw]);
    expect(truth.map((w) => w.focused)).toEqual([false, false, true]);
    expect(truth[2].tabs![0]).toMatchObject({
      id: a,
      windowId: nw,
      index: 0,
      active: true,
    });
  });

  it("windows.create({url}) creates a window with one new tab", async () => {
    const f = manual();
    const log = record(f);
    const win = (await f.windows.create({
      url: "https://n.test/",
    })) as chrome.windows.Window;
    f.flush();
    expect(names(log)).toEqual(["w.created", "t.created", "w.focus"]);
    expect(win.tabs).toHaveLength(1);
    expect(win.tabs![0]).toMatchObject({
      url: "https://n.test/",
      active: true,
      index: 0,
    });
    expect(log[1][1]).toMatchObject({
      id: win.tabs![0].id,
      windowId: win.id,
      index: 0,
    });
  });

  it("windows.update focuses one window only; minimized fires no event", async () => {
    const f = manual();
    const log = record(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    await f.windows.update(w1, { focused: true });
    f.flush();
    expect(log).toEqual([["w.focus", w1]]);
    expect(f.truth().map((w) => w.focused)).toEqual([false, true]);
    log.length = 0;
    await f.windows.update(w0, { state: "minimized" });
    f.flush();
    expect(log).toEqual([]);
    expect(f.truth()[0].state).toBe("minimized");
  });

  it("getCurrent honours currentWindowIndex; tabs.getCurrent is undefined", async () => {
    const f = createFakeChrome({ ...seed(), currentWindowIndex: 1 });
    expect((await f.windows.getCurrent()).id).toBe(f.truth()[1].id);
    expect(await f.tabs.getCurrent()).toBeUndefined();
  });

  it("tabs.update active moves the flag and fires onActivated", async () => {
    const f = manual();
    const log = record(f);
    const wid = f.truth()[0].id!;
    const [, b] = ids(f, 0);
    await f.tabs.update(b, { active: true });
    f.flush();
    expect(log).toEqual([["t.activated", { tabId: b, windowId: wid }]]);
    expect(f.truth()[0].tabs!.map((t) => t.active)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("tabs.update url fires onUpdated with full tab snapshot", async () => {
    const f = manual();
    const log = record(f);
    const [a] = ids(f, 0);
    await f.tabs.update(a, { url: "https://new.test/" });
    f.flush();
    expect(log).toHaveLength(1);
    const [, id, change, snap] = log[0] as [
      string,
      number,
      unknown,
      chrome.tabs.Tab,
    ];
    expect(id).toBe(a);
    expect(change).toEqual({ url: "https://new.test/" });
    expect(snap).toMatchObject({
      id: a,
      url: "https://new.test/",
      title: "a",
      index: 0,
    });
  });

  it("pinning moves the tab to the end of the pinned group then fires onUpdated", async () => {
    const f = manual({
      windows: [
        { tabs: [tab("p", { pinned: true }), tab("x"), tab("y"), tab("z")] },
      ],
    });
    const log = record(f);
    const wid = f.truth()[0].id!;
    const [p, , , z] = ids(f, 0);
    await f.tabs.update(z, { pinned: true });
    f.flush();
    expect(titles(f, 0)).toEqual(["p", "z", "x", "y"]);
    expect(log[0]).toEqual([
      "t.moved",
      z,
      { windowId: wid, fromIndex: 3, toIndex: 1 },
    ]);
    expect(log[1].slice(0, 3)).toEqual(["t.updated", z, { pinned: true }]);
    log.length = 0;
    await f.tabs.update(p, { pinned: false });
    f.flush();
    expect(titles(f, 0)).toEqual(["z", "p", "x", "y"]);
    expect(names(log)).toEqual(["t.moved", "t.updated"]);
    expect(f.truth()[0].tabs!.map((t) => t.pinned)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("setTitle fires onUpdated({title}) and is a no-op if unchanged", async () => {
    const f = manual();
    const log = record(f);
    const [a] = ids(f, 0);
    f.setTitle(a, "a");
    f.setTitle(a, "renamed");
    f.flush();
    expect(log).toHaveLength(1);
    expect(log[0].slice(0, 3)).toEqual(["t.updated", a, { title: "renamed" }]);
    expect((log[0][3] as chrome.tabs.Tab).title).toBe("renamed");
  });

  it("discard fires onUpdated{discarded:true} by default", async () => {
    const f = manual();
    const log = record(f);
    const [, b] = ids(f, 0);
    await f.tabs.discard(b);
    f.flush();
    expect(log[0].slice(0, 3)).toEqual(["t.updated", b, { discarded: true }]);
    expect(f.truth()[0].tabs![1].discarded).toBe(true);
  });

  it("discard with replaceOnDiscard fires onReplaced(newId, oldId) and swaps the id", async () => {
    const f = manual({ ...seed(), replaceOnDiscard: true });
    const log = record(f);
    const [, b] = ids(f, 0);
    await f.tabs.discard(b);
    f.flush();
    const nb = ids(f, 0)[1];
    expect(nb).not.toBe(b);
    expect(log).toEqual([["t.replaced", nb, b]]);
    expect(f.truth()[0].tabs![1]).toMatchObject({
      id: nb,
      index: 1,
      discarded: true,
    });
  });

  it("tabs.create is active by default and deactivates the previous active tab", async () => {
    const f = manual();
    const log = record(f);
    const wid = f.truth()[0].id!;
    const t = await f.tabs.create({
      windowId: wid,
      url: "https://n.test/",
      index: 1,
    });
    f.flush();
    expect(t).toMatchObject({ index: 1, active: true, windowId: wid });
    expect(names(log)).toEqual(["t.created", "t.activated"]);
    expect(log[0][1]).toMatchObject({ id: t.id, index: 1, active: true });
    expect(log[1]).toEqual(["t.activated", { tabId: t.id, windowId: wid }]);
    const tabs = f.truth()[0].tabs!;
    expect(tabs.filter((x) => x.active).map((x) => x.id)).toEqual([t.id]);
    expect(tabs.map((x) => x.index)).toEqual([0, 1, 2, 3]);
    log.length = 0;
    await f.tabs.create({ windowId: wid, active: false });
    f.flush();
    expect(names(log)).toEqual(["t.created"]);
    expect(f.truth()[0].tabs!.filter((x) => x.active)).toHaveLength(1);
  });

  it("query filters by windowId, active and pinned", async () => {
    const f = createFakeChrome({
      windows: [
        { tabs: [tab("p", { pinned: true }), tab("x")] },
        { tabs: [tab("y")] },
      ],
    });
    const [w0] = f.truth().map((w) => w.id!);
    expect((await f.tabs.query({ windowId: w0 })).map((t) => t.title)).toEqual([
      "p",
      "x",
    ]);
    expect((await f.tabs.query({ active: true })).map((t) => t.title)).toEqual([
      "p",
      "y",
    ]);
    expect((await f.tabs.query({ pinned: true })).map((t) => t.title)).toEqual([
      "p",
    ]);
  });

  it("operations on unknown ids reject", async () => {
    const f = createFakeChrome(seed());
    await expect(f.tabs.get(9999)).rejects.toThrow();
    await expect(f.tabs.remove(9999)).rejects.toThrow();
    await expect(f.windows.remove(9999)).rejects.toThrow();
  });
});
