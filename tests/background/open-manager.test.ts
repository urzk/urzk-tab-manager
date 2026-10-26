import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openManager } from "../../src/background/open-manager";
import { createFakeChrome, type FakeSeed } from "../../src/mock/fake-chrome";

const MANAGER = "chrome-extension://abc/newtab/index.html";

const tab = (n: string, url = `https://${n}.test/`) => ({ title: n, url });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const allTabs = (f: ReturnType<typeof createFakeChrome>) =>
  f.truth().flatMap((w) => w.tabs!);

describe("openManager", () => {
  it("focuses existing manager tab in current window first", async () => {
    const seed: FakeSeed = {
      windows: [
        { tabs: [tab("a"), tab("m1", MANAGER)] },
        { tabs: [tab("m2", MANAGER)] },
      ],
    };
    const f = createFakeChrome(seed);
    const [w1] = f.truth();
    const target = w1.tabs!.find((t) => t.title === "m1")!;
    const update = vi.spyOn(f.tabs, "update");
    const wupdate = vi.spyOn(f.windows, "update");
    const create = vi.spyOn(f.tabs, "create");
    await openManager(f, MANAGER, w1.id);
    expect(update).toHaveBeenCalledWith(target.id, { active: true });
    expect(wupdate).toHaveBeenCalledWith(w1.id, { focused: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to manager tab in another window", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("a")] }, { tabs: [tab("m2", MANAGER)] }],
    });
    const [w1, w2] = f.truth();
    const target = w2.tabs![0];
    const update = vi.spyOn(f.tabs, "update");
    const wupdate = vi.spyOn(f.windows, "update");
    await openManager(f, MANAGER, w1.id);
    expect(update).toHaveBeenCalledWith(target.id, { active: true });
    expect(wupdate).toHaveBeenCalledWith(w2.id, { focused: true });
  });

  it("matches the chrome://newtab/ form Chrome reports for overridden pages", async () => {
    const f = createFakeChrome({
      windows: [{ tabs: [tab("a"), tab("nt", "chrome://newtab/")] }],
    });
    const [w1] = f.truth();
    const update = vi.spyOn(f.tabs, "update");
    const create = vi.spyOn(f.tabs, "create");
    await openManager(f, MANAGER, w1.id);
    expect(update).toHaveBeenCalledWith(w1.tabs![1].id, { active: true });
    expect(create).not.toHaveBeenCalled();
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
    vi.spyOn(f.windows, "update").mockResolvedValue(undefined);
    await openManager(f, MANAGER, w1.id);
    expect(update).toHaveBeenCalledWith(99, { active: true });
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

  it("swallows errors", async () => {
    const f = createFakeChrome({ windows: [] });
    vi.spyOn(f.tabs, "query").mockRejectedValue(new Error("boom"));
    await expect(openManager(f, MANAGER, 1)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
