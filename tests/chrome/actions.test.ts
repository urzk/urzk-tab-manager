import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActions } from "../../src/lib/chrome/actions";
import type { TabLite } from "../../src/lib/state/model";
import { createFakeChrome, type FakeSeed } from "../../src/mock/fake-chrome";

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

const titles = (f: ReturnType<typeof createFakeChrome>, w: number) =>
  f.truth()[w].tabs!.map((t) => t.title);

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("actions", () => {
  it("focusTab activates tab and focuses window", async () => {
    const f = createFakeChrome(seed());
    const b = f.truth()[1].tabs![1];
    await createActions(f).focusTab({
      id: b.id!,
      windowId: b.windowId,
    } as TabLite);
    const truth = f.truth();
    expect(truth[1].tabs!.find((t) => t.id === b.id)!.active).toBe(true);
    expect(truth[1].focused).toBe(true);
    expect(truth[0].focused).toBe(false);
  });

  it("moveTab swallows chrome errors", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("p", { pinned: true }), tab("u")] }],
    });
    const u = f.truth()[0].tabs![1];
    await expect(createActions(f).moveTab(u.id!, 0)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[actions] moveTab failed",
      expect.any(Error),
    );
    expect(titles(f, 0)).toEqual(["p", "u"]);
  });

  it("swapTabs swaps two tabs", async () => {
    const f = createFakeChrome(seed());
    const [a, , c] = f.truth()[0].tabs!;
    await createActions(f).swapTabs(a.id!, 0, c.id!, 2);
    expect(titles(f, 0)).toEqual(["c", "b", "a"]);
  });

  it("swapTabs ignores a failed second move", async () => {
    const f = createFakeChrome(seed());
    const [a, , c] = f.truth()[0].tabs!;
    const move = f.tabs.move.bind(f.tabs);
    let calls = 0;
    f.tabs.move = (id, p) =>
      ++calls === 2 ? Promise.reject(new Error("boom")) : move(id, p);
    await expect(
      createActions(f).swapTabs(a.id!, 0, c.id!, 2),
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it("swapTabs skips the second move when the first fails", async () => {
    const f = createFakeChrome(seed());
    const [a, , c] = f.truth()[0].tabs!;
    let calls = 0;
    f.tabs.move = () => {
      calls++;
      return Promise.reject(new Error("boom"));
    };
    await createActions(f).swapTabs(a.id!, 0, c.id!, 2);
    expect(calls).toBe(1);
  });

  it("moveToWindow appends to the target window", async () => {
    const f = createFakeChrome(seed());
    const a = f.truth()[0].tabs![0];
    await createActions(f).moveToWindow(a.id!, f.truth()[1].id!);
    expect(titles(f, 1)).toEqual(["d", "e", "a"]);
  });

  it("moveToCurrentWindow appends to current window", async () => {
    const f = createFakeChrome({ ...seed(), currentWindowIndex: 1 });
    const a = f.truth()[0].tabs![0];
    await createActions(f).moveToCurrentWindow(a.id!);
    expect(titles(f, 1)).toEqual(["d", "e", "a"]);
  });

  it("moveToCurrentWindow swallows getCurrent failure", async () => {
    const f = createFakeChrome(seed());
    f.windows.getCurrent = () => Promise.reject(new Error("gone"));
    await expect(
      createActions(f).moveToCurrentWindow(1),
    ).resolves.toBeUndefined();
  });

  it("popOut creates window with tab", async () => {
    const f = createFakeChrome(seed());
    const a = f.truth()[0].tabs![0];
    await createActions(f).popOut(a.id!);
    expect(f.truth()).toHaveLength(3);
    expect(f.truth()[2].tabs!.map((t) => t.id)).toEqual([a.id]);
  });

  it("closeTab and discardTab never reject on unknown ids", async () => {
    const f = createFakeChrome(seed());
    const act = createActions(f);
    await expect(act.closeTab(9999)).resolves.toBeUndefined();
    await expect(act.discardTab(9999)).resolves.toBeUndefined();
  });

  it("closeTab removes the tab", async () => {
    const f = createFakeChrome(seed());
    const a = f.truth()[0].tabs![0];
    await createActions(f).closeTab(a.id!);
    expect(titles(f, 0)).toEqual(["b", "c"]);
  });

  it("window actions: minimize, focus, close", async () => {
    const f = createFakeChrome(seed());
    const act = createActions(f);
    const [w0, w1] = f.truth().map((w) => w.id!);
    await act.minimizeWindow(w0);
    expect(f.truth()[0].state).toBe("minimized");
    await act.focusWindow(w1);
    expect(f.truth()[1].focused).toBe(true);
    await act.closeWindow(w1);
    expect(f.truth()).toHaveLength(1);
    await expect(act.closeWindow(w1)).resolves.toBeUndefined();
  });
});
