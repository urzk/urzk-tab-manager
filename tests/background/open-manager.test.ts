import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openManager } from "../../src/background/open-manager";
import { createFakeChrome, type FakeSeed } from "../../src/mock/fake-chrome";

const MANAGER = "chrome-extension://abc/manager/index.html";

const tab = (n: string, url = `https://${n}.test/`) => ({ title: n, url });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const allTabs = (f: ReturnType<typeof createFakeChrome>) =>
  f.truth().flatMap((w) => w.tabs!);

function spies(f: ReturnType<typeof createFakeChrome>) {
  return {
    update: vi.spyOn(f.tabs, "update"),
    wupdate: vi.spyOn(f.windows, "update"),
    create: vi.spyOn(f.tabs, "create"),
  };
}

describe("openManager", () => {
  it("switches to the manager tab in the current window", async () => {
    const seed: FakeSeed = {
      windows: [
        { tabs: [tab("a"), tab("m1", MANAGER)] },
        { tabs: [tab("m2", MANAGER)] },
      ],
    };
    const f = createFakeChrome(seed);
    const [w1] = f.truth();
    const target = w1.tabs!.find((t) => t.title === "m1")!;
    const s = spies(f);
    await openManager(f, MANAGER, w1.id);
    expect(s.update).toHaveBeenCalledWith(target.id, { active: true });
    expect(s.wupdate).not.toHaveBeenCalled();
    expect(s.create).not.toHaveBeenCalled();
  });

  it("opens a new one in the current window when only another window has one", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("a")] }, { tabs: [tab("m2", MANAGER)] }],
    });
    const [w1] = f.truth();
    const s = spies(f);
    await openManager(f, MANAGER, w1.id);
    expect(s.create).toHaveBeenCalledWith({ url: MANAGER, windowId: w1.id });
    expect(s.update).not.toHaveBeenCalled();
    expect(s.wupdate).not.toHaveBeenCalled();
    expect(
      allTabs(f).filter((t) => t.url === MANAGER && t.windowId === w1.id),
    ).toHaveLength(1);
  });

  it("picks the leftmost of several manager tabs in the current window", async () => {
    const f = createFakeChrome({
      windows: [
        { tabs: [tab("a"), tab("m1", MANAGER), tab("b"), tab("m2", MANAGER)] },
      ],
    });
    const [w1] = f.truth();
    // report them out of order to make sure the index decides
    vi.spyOn(f.tabs, "query").mockResolvedValue([...w1.tabs!].reverse());
    const s = spies(f);
    await openManager(f, MANAGER, w1.id);
    expect(s.update).toHaveBeenCalledWith(w1.tabs![1].id, { active: true });
  });

  it("matches a tab whose pendingUrl is the manager", async () => {
    const f = createFakeChrome({ windows: [{ tabs: [tab("a")] }] });
    const [w1] = f.truth();
    const pending = {
      id: 99,
      windowId: w1.id,
      index: 1,
      pendingUrl: MANAGER,
    } as chrome.tabs.Tab;
    vi.spyOn(f.tabs, "query").mockResolvedValue([pending]);
    const update = vi.spyOn(f.tabs, "update").mockResolvedValue(undefined);
    const create = vi.spyOn(f.tabs, "create");
    await openManager(f, MANAGER, w1.id);
    expect(update).toHaveBeenCalledWith(99, { active: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not treat Chrome's own new tab page as the manager", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("a"), tab("nt", "chrome://newtab/")] }],
    });
    const [w1] = f.truth();
    const s = spies(f);
    await openManager(f, MANAGER, w1.id);
    expect(s.update).not.toHaveBeenCalled();
    expect(s.create).toHaveBeenCalledWith({ url: MANAGER, windowId: w1.id });
  });

  it("creates a tab when none exists", async () => {
    const f = createFakeChrome({ windows: [{ tabs: [tab("a")] }] });
    const [w1] = f.truth();
    await openManager(f, MANAGER, w1.id);
    const tabs = allTabs(f);
    expect(tabs).toHaveLength(2);
    expect(tabs.some((t) => t.url === MANAGER && t.windowId === w1.id)).toBe(
      true,
    );
  });

  it("uses the current window when the window id is unknown", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("a")] }, { tabs: [tab("m2", MANAGER)] }],
      currentWindowIndex: 1,
    });
    const [, w2] = f.truth();
    const query = vi.spyOn(f.tabs, "query");
    const s = spies(f);
    await openManager(f, MANAGER, undefined);
    expect(query).toHaveBeenCalledWith({ currentWindow: true });
    expect(s.update).toHaveBeenCalledWith(w2.tabs![0].id, { active: true });
    expect(s.create).not.toHaveBeenCalled();
  });

  it("swallows errors", async () => {
    const f = createFakeChrome({ windows: [] });
    vi.spyOn(f.tabs, "query").mockRejectedValue(new Error("boom"));
    await expect(openManager(f, MANAGER, 1)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
