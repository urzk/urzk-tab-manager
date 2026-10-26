import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import en from "../../public/_locales/en/messages.json";
import { setFallbackMessages } from "../../src/lib/i18n";
import { createTabSync, type TabSync } from "../../src/lib/state/sync";
import {
  createFakeChrome,
  type FakeChrome,
  type FakeSeed,
} from "../../src/mock/fake-chrome";
import App from "../../src/newtab/components/App.svelte";

const tab = (title: string) => ({
  title,
  url: `https://${title.replace(/\s/g, "")}.test/`,
});

// Window ids/tab ids follow the fake's allocation: window 1 → tabs 2,3,4;
// window 5 → tabs 6,7,8.
const twoByThree = (): FakeSeed => ({
  windows: [
    { tabs: [tab("alpha"), tab("beta"), tab("gamma")] },
    { tabs: [tab("delta"), tab("alpha two"), tab("zeta")] },
  ],
});

let errorSpy: ReturnType<typeof vi.spyOn>;
let fake: FakeChrome;
let sync: TabSync;

function setup(seed: FakeSeed = twoByThree()) {
  fake = createFakeChrome(seed);
  sync = createTabSync(fake, { scheduleFrame: (cb) => setTimeout(cb, 0) });
  const result = render(App, {
    props: {
      api: fake,
      getURL: (p: string) => "chrome-extension://test" + p,
      sync,
    },
  });
  return result;
}

const section = (c: HTMLElement, windowId: number) =>
  c.querySelector<HTMLElement>(`#window-${windowId}`);
const tabIdsIn = (c: HTMLElement) =>
  [...c.querySelectorAll(".tab")].map((e) => e.id);

beforeEach(() => {
  setFallbackMessages(en);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  expect(errorSpy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("current window expanded, others collapsed and not rendered", async () => {
    const { container } = setup();
    await waitFor(() => expect(section(container, 5)).not.toBeNull());
    expect(tabIdsIn(container)).toEqual(["tab-2", "tab-3", "tab-4"]);
    expect(container.querySelector("#tab-6")).toBeNull();
    // current window first
    const headings = [...container.querySelectorAll("h2")].map((h) => h.id);
    expect(headings).toEqual(["window-1", "window-5"]);
    expect(section(container, 1)!.textContent).toContain(
      "Current Window (ID: #1)",
    );
    expect(section(container, 5)!.textContent).toContain("Window (ID: #5)");
  });

  it("expanding renders tabs", async () => {
    const { container } = setup();
    await waitFor(() => expect(section(container, 5)).not.toBeNull());
    const toggle = within(section(container, 5)!).getByRole("button", {
      name: en.toggleWindow.message,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(tabIdsIn(container)).toEqual([
      "tab-2",
      "tab-3",
      "tab-4",
      "tab-6",
      "tab-7",
      "tab-8",
    ]);
    await fireEvent.keyDown(toggle, { key: "Enter" });
    expect(container.querySelector("#tab-6")).toBeNull();
    await fireEvent.keyDown(toggle, { key: " " });
    expect(container.querySelector("#tab-6")).not.toBeNull();
  });

  it("anchor click expands the window", async () => {
    const { container } = setup();
    await waitFor(() => expect(section(container, 5)).not.toBeNull());
    const a = section(container, 5)!.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("#window-5");
    await fireEvent.click(a);
    expect(container.querySelector("#tab-7")).not.toBeNull();
  });

  it("search filters across windows and updates counts", async () => {
    const { container } = setup();
    await waitFor(() => expect(section(container, 5)).not.toBeNull());
    expect(section(container, 1)!.textContent).toContain("(3 tabs)");
    await fireEvent.click(
      within(section(container, 5)!).getByRole("button", {
        name: en.toggleWindow.message,
      }),
    );
    const input = screen.getByRole("textbox", {
      name: en.searchPlaceholder.message,
    });
    expect(input.getAttribute("placeholder")).toBe(
      en.searchPlaceholder.message,
    );
    await fireEvent.input(input, { target: { value: "alpha" } });
    expect(tabIdsIn(container)).toEqual(["tab-2", "tab-7"]);
    expect(section(container, 1)!.textContent).toContain("(1 tab)");
    expect(section(container, 5)!.textContent).toContain("(1 tab)");
  });

  it("hides windows with no matches only while a query is active", async () => {
    const { container } = setup({
      windows: [
        { tabs: [tab("alpha"), tab("beta")] },
        { tabs: [tab("delta")] },
      ],
    });
    await waitFor(() => expect(section(container, 4)).not.toBeNull());
    const input = screen.getByRole("textbox");
    await fireEvent.input(input, { target: { value: "beta" } });
    expect(section(container, 4)).toBeNull();
    expect(section(container, 1)).not.toBeNull();
    await fireEvent.input(input, { target: { value: "" } });
    expect(section(container, 4)).not.toBeNull();
    expect(section(container, 4)!.textContent).toContain("(1 tab)");
  });

  it("shows windows with zero tabs when there is no query", async () => {
    const { container } = setup({
      windows: [{ tabs: [tab("alpha")] }, { tabs: [] }],
    });
    await waitFor(() => expect(section(container, 3)).not.toBeNull());
    expect(section(container, 3)!.textContent).toContain("(0 tabs)");
  });

  it("closing a tab in chrome updates the list", async () => {
    const { container } = setup();
    await waitFor(() =>
      expect(container.querySelector("#tab-3")).not.toBeNull(),
    );
    await fake.tabs.remove(3);
    await waitFor(() => expect(container.querySelector("#tab-3")).toBeNull());
    expect(tabIdsIn(container)).toEqual(["tab-2", "tab-4"]);
    expect(section(container, 1)!.textContent).toContain("(2 tabs)");
  });

  it('count shows "1 tab" singular', async () => {
    const { container } = setup({ windows: [{ tabs: [tab("solo")] }] });
    await waitFor(() => expect(section(container, 1)).not.toBeNull());
    expect(section(container, 1)!.textContent).toContain("(1 tab)");
    expect(section(container, 1)!.textContent).not.toContain("1 tabs");
  });

  it("window buttons call chrome; minimize hidden when minimized", async () => {
    const { container } = setup({
      windows: [
        { tabs: [tab("alpha")] },
        { tabs: [tab("beta")], state: "minimized" },
      ],
    });
    await waitFor(() => expect(section(container, 3)).not.toBeNull());
    const w1 = within(section(container, 1)!);
    const w3 = within(section(container, 3)!);
    expect(w3.queryByTitle(en.minimizeWindow.message)).toBeNull();
    const update = vi.spyOn(fake.windows, "update");
    const remove = vi.spyOn(fake.windows, "remove");
    await fireEvent.click(w1.getByTitle(en.minimizeWindow.message));
    expect(update).toHaveBeenCalledWith(1, { state: "minimized" });
    await fireEvent.click(w3.getByTitle(en.focusWindow.message));
    expect(update).toHaveBeenCalledWith(3, { focused: true });
    await fireEvent.click(w3.getByTitle(en.closeWindow.message));
    expect(remove).toHaveBeenCalledWith(3);
  });

  it("renders the heading from i18n", async () => {
    setup();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      en.heading.message,
    );
  });

  it("forwards visibility and stops the sync on destroy", async () => {
    const { unmount, container } = setup();
    await waitFor(() => expect(section(container, 1)).not.toBeNull());
    const setVisible = vi.spyOn(sync, "setVisible");
    const stop = vi.spyOn(sync, "stop");
    const vis = vi.spyOn(document, "visibilityState", "get");
    vis.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setVisible).toHaveBeenLastCalledWith(false);
    vis.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setVisible).toHaveBeenLastCalledWith(true);
    unmount();
    expect(stop).toHaveBeenCalled();
    setVisible.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setVisible).not.toHaveBeenCalled();
  });

  it("stays dormant when mounted hidden and syncs once visible", async () => {
    const vis = vi.spyOn(document, "visibilityState", "get");
    vis.mockReturnValue("hidden");
    fake = createFakeChrome(twoByThree());
    const getAll = vi.spyOn(fake.windows, "getAll");
    sync = createTabSync(fake, { scheduleFrame: (cb) => setTimeout(cb, 0) });
    const { container } = render(App, {
      props: {
        api: fake,
        getURL: (p: string) => "chrome-extension://test" + p,
        sync,
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(getAll).not.toHaveBeenCalled();
    expect(section(container, 1)).toBeNull();
    vis.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(section(container, 1)).not.toBeNull());
    expect(getAll).toHaveBeenCalledTimes(1);
  });

  it("reconciles after each window action", async () => {
    const { container } = setup({
      windows: [{ tabs: [tab("alpha")] }, { tabs: [tab("beta")] }],
    });
    await waitFor(() => expect(section(container, 3)).not.toBeNull());
    const reconcile = vi.spyOn(sync, "reconcileNow");
    const w1 = within(section(container, 1)!);
    const w3 = within(section(container, 3)!);
    await fireEvent.click(w1.getByTitle(en.minimizeWindow.message));
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    await fireEvent.click(w3.getByTitle(en.focusWindow.message));
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    await fireEvent.click(w3.getByTitle(en.closeWindow.message));
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(3));
  });

  it("only the hovered card renders actions", async () => {
    const { container } = setup();
    await waitFor(() =>
      expect(container.querySelector("#tab-3")).not.toBeNull(),
    );
    expect(container.querySelectorAll(".tab-button").length).toBe(0);
    await fireEvent.mouseEnter(container.querySelector("#tab-3")!);
    expect(
      container.querySelectorAll("#tab-3 .tab-button").length,
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll("#tab-2 .tab-button").length).toBe(0);
  });

  it("passes the full-window index to cards under a query", async () => {
    const { container } = setup();
    await waitFor(() =>
      expect(container.querySelector("#tab-2")).not.toBeNull(),
    );
    await fireEvent.input(screen.getByRole("textbox"), {
      target: { value: "alpha" },
    });
    expect(tabIdsIn(container)).toEqual(["tab-2"]);
    await fireEvent.mouseEnter(container.querySelector("#tab-2")!);
    // Tab 2 is index 0 of 3 in the full window, so "move to end of current
    // window" is offered. With filtered positions (0 of 1) it would not be.
    expect(
      container.querySelector(
        "#tab-2 .tab-button-bottomright.tab-button-active",
      ),
    ).not.toBeNull();
  });
});
