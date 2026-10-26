import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import en from "../../public/_locales/en/messages.json";
import { setFallbackMessages } from "../../src/lib/i18n";
import { createActions } from "../../src/lib/chrome/actions";
import type { TabLite } from "../../src/lib/state/model";
import { createFakeChrome } from "../../src/mock/fake-chrome";
import TabCard from "../../src/newtab/components/TabCard.svelte";
import Favicon from "../../src/newtab/components/Favicon.svelte";

const context = new Map([
  ["getURL", (p: string) => "chrome-extension://test" + p],
]);

const mkTab = (extra: Partial<TabLite> = {}): TabLite => ({
  id: 11,
  windowId: 1,
  title: "Title",
  url: "https://a.test/",
  discarded: false,
  active: false,
  pinned: false,
  ...extra,
});

function setup(
  props: Partial<{
    tab: TabLite;
    index: number;
    count: number;
    columns: number;
    isCurrent: boolean;
    hasQuery: boolean;
    showActions: boolean;
    neighbor: (i: number) => number | undefined;
  }> = {},
) {
  const fake = createFakeChrome({ windows: [{ tabs: [{ title: "a", url: "https://a.test/" }] }] });
  const actions = createActions(fake);
  for (const k of Object.keys(actions) as (keyof typeof actions)[]) {
    vi.spyOn(actions, k).mockResolvedValue(undefined);
  }
  const onHover = vi.fn();
  const tab = props.tab ?? mkTab();
  const result = render(TabCard, {
    props: {
      tab,
      index: 1,
      count: 5,
      columns: 2,
      isCurrent: true,
      hasQuery: false,
      showActions: false,
      neighbor: (i: number) => (i >= 0 && i < 5 ? 100 + i : undefined),
      actions,
      onHover,
      ...props,
    },
    context,
  });
  return { actions, onHover, tab, ...result };
}

beforeEach(() => setFallbackMessages(en));
afterEach(cleanup);

describe("TabCard", () => {
  it("renders title and url as text", () => {
    const { container } = setup({
      tab: mkTab({ title: "<img src=x onerror=alert(1)>" }),
    });
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img[src=x]")).toBeNull();
    expect(screen.getByText("https://a.test/")).toBeTruthy();
  });

  it("actions only render when showActions", async () => {
    const off = setup();
    expect(off.container.querySelectorAll(".tab-button").length).toBe(0);
    off.unmount();
    const on = setup({ showActions: true });
    expect(on.container.querySelectorAll(".tab-button").length).toBe(8);
  });

  it("move buttons hidden when hasQuery", () => {
    const { container } = setup({ showActions: true, hasQuery: true });
    for (const p of ["top", "left", "right", "bottom"]) {
      expect(
        container.querySelector(`.tab-button-${p}.tab-button-active`),
      ).toBeNull();
    }
    expect(container.querySelector(".tab-button-topright.tab-button-active")).not.toBeNull();
  });

  it("Enter focuses tab", async () => {
    const { actions, tab } = setup();
    await fireEvent.keyDown(screen.getByRole("button", { name: /Title/ }), { key: "Enter" });
    expect(actions.focusTab).toHaveBeenCalledWith(tab);
  });

  it("click focuses tab", async () => {
    const { actions, tab } = setup();
    await fireEvent.click(screen.getByRole("button", { name: /Title/ }));
    expect(actions.focusTab).toHaveBeenCalledWith(tab);
  });

  it("ArrowRight moves tab to index+1", async () => {
    const { actions } = setup();
    await fireEvent.keyDown(screen.getByRole("button", { name: /Title/ }), { key: "ArrowRight" });
    expect(actions.moveTab).toHaveBeenCalledWith(11, 2);
  });

  it("ArrowLeft is range guarded and ArrowDown swaps with neighbor", async () => {
    const { actions } = setup({ index: 0 });
    const card = screen.getByRole("button", { name: /Title/ });
    await fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(actions.moveTab).not.toHaveBeenCalled();
    await fireEvent.keyDown(card, { key: "ArrowDown" });
    expect(actions.swapTabs).toHaveBeenCalledWith(11, 0, 102, 2);
    await fireEvent.keyDown(card, { key: "ArrowUp" });
    expect(actions.swapTabs).toHaveBeenCalledTimes(1);
  });

  it("arrow moves disabled while hasQuery", async () => {
    const { actions } = setup({ hasQuery: true });
    await fireEvent.keyDown(screen.getByRole("button", { name: /Title/ }), { key: "ArrowRight" });
    expect(actions.moveTab).not.toHaveBeenCalled();
  });

  it("hover and focus events report the tab id", async () => {
    const { onHover, container } = setup();
    const root = container.querySelector(".tab")!;
    await fireEvent.mouseEnter(root);
    expect(onHover).toHaveBeenLastCalledWith(11);
    await fireEvent.mouseLeave(root);
    expect(onHover).toHaveBeenLastCalledWith(null);
    await fireEvent.focusIn(root);
    expect(onHover).toHaveBeenLastCalledWith(11);
    await fireEvent.focusOut(root);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("action buttons call actions", async () => {
    const { actions } = setup({ showActions: true, isCurrent: false });
    await fireEvent.click(screen.getByTitle(en.closeTab.message));
    expect(actions.closeTab).toHaveBeenCalledWith(11);
    await fireEvent.click(screen.getByTitle(en.moveToCurrentEnd.message));
    expect(actions.moveToCurrentWindow).toHaveBeenCalledWith(11);
    await fireEvent.click(screen.getByTitle(en.discardTab.message));
    expect(actions.discardTab).toHaveBeenCalledWith(11);
    await fireEvent.click(screen.getByTitle(en.popOut.message));
    expect(actions.popOut).toHaveBeenCalledWith(11);
  });
});

describe("Favicon", () => {
  it("falls back on error, once", async () => {
    render(Favicon, {
      props: { tab: mkTab({ favIconUrl: "chrome://favicon/x" }) },
      context,
    });
    const img = screen.getByAltText("favicon") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("chrome://favicon/x");
    await fireEvent.error(img);
    const fb = img.getAttribute("src")!;
    expect(fb).toContain("/_favicon/");
    await fireEvent.error(img);
    expect(img.getAttribute("src")).toBe(fb);
  });
});
