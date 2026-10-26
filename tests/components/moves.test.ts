import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import en from "../../public/_locales/en/messages.json";
import { setFallbackMessages } from "../../src/lib/i18n";
import { createTabSync } from "../../src/lib/state/sync";
import { createFakeChrome, type FakeChrome } from "../../src/mock/fake-chrome";
import App from "../../src/newtab/components/App.svelte";

// Every card move (buttons and keyboard) against the fake Chrome, which
// rejects moves that break "pinned tabs first". The grid is 4 columns wide,
// like the reported layout: row 1 = indexes 0-3, row 2 = 4-7, row 3 = 8-11.

const WIDTH = 4 * 288 + 3 * 16; // exactly 4 columns
const PINNED = 2;
const COUNT = 12;
type Dir = "up" | "down" | "left" | "right";
const dirs: Dir[] = ["up", "down", "left", "right"];
const keyOf: Record<Dir, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const seed = () => ({
  windows: [
    {
      tabs: Array.from({ length: COUNT }, (_, i) => ({
        title: `tab ${i}`,
        url: `https://t${i}.test/`,
        pinned: i < PINNED,
      })),
    },
    {
      tabs: [
        { title: "other pinned", url: "https://op.test/", pinned: true },
        { title: "other a", url: "https://oa.test/" },
        { title: "other b", url: "https://ob.test/" },
      ],
    },
  ],
});

/** What Chrome should end up with, or null when the move must be refused. */
function expected(order: number[], index: number, dir: Dir): number[] | null {
  const step =
    dir === "left" ? -1 : dir === "right" ? 1 : dir === "up" ? -4 : 4;
  const to = index + step;
  if (to < 0 || to >= order.length) return null;
  // same pinned zone only (indexes < PINNED are pinned)
  if (index < PINNED !== to < PINNED) return null;
  const next = [...order];
  if (dir === "left" || dir === "right") {
    const [id] = next.splice(index, 1);
    next.splice(to, 0, id);
  } else {
    [next[index], next[to]] = [next[to], next[index]];
  }
  return next;
}

let fake: FakeChrome;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setFallbackMessages(en);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  // give the grid a real width so the layout has 4 columns
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        this.cb(
          [{ target } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  expect(warnSpy).not.toHaveBeenCalled();
  expect(errorSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setup() {
  fake = createFakeChrome(seed());
  const sync = createTabSync(fake, {
    scheduleFrame: (cb) => setTimeout(cb, 0),
  });
  const r = render(App, {
    props: { api: fake, getURL: (p: string) => "x:" + p, sync },
  });
  await waitFor(() =>
    expect(r.container.querySelectorAll(".tab").length).toBe(COUNT),
  );
  return r.container;
}

const order = (windowIndex = 0) =>
  fake.truth()[windowIndex].tabs!.map((t) => t.id!);
const cardAt = (c: HTMLElement, index: number) =>
  c.querySelectorAll<HTMLElement>(".tab")[index];
const settle = () => new Promise((r) => setTimeout(r, 20));

describe("card moves respect the pinned zone", () => {
  for (let index = 0; index < COUNT; index++)
    for (const dir of dirs) {
      it(`button: index ${index} ${dir}`, async () => {
        const c = await setup();
        const before = order();
        const want = expected(before, index, dir);
        const card = cardAt(c, index);
        await fireEvent.mouseEnter(card);
        const btn = card.querySelector(
          `.tab-button-${
            { up: "top", down: "bottom", left: "left", right: "right" }[dir]
          }`,
        )!;
        expect(btn.classList.contains("tab-button-active")).toBe(want !== null);
        if (want !== null) {
          await fireEvent.click(btn);
          await waitFor(() => expect(order()).toEqual(want));
        }
      });

      it(`keyboard: index ${index} ${dir}`, async () => {
        const c = await setup();
        const before = order();
        const want = expected(before, index, dir);
        const container = cardAt(c, index).querySelector(".tab-container")!;
        await fireEvent.keyDown(container, { key: keyOf[dir] });
        await settle();
        if (want === null) expect(order()).toEqual(before);
        else await waitFor(() => expect(order()).toEqual(want));
      });
    }

  it("reported cases are refused without errors", async () => {
    const c = await setup();
    const before = order();
    for (const [index, dir] of [
      [1, "right"],
      [2, "left"],
      [1, "down"],
      [5, "up"],
    ] as const) {
      await fireEvent.keyDown(
        cardAt(c, index).querySelector(".tab-container")!,
        { key: keyOf[dir] },
      );
    }
    await settle();
    expect(order()).toEqual(before);
  });
});

describe("move to end of current window", () => {
  const endButton = async (c: HTMLElement, id: number) => {
    const card = c.querySelector<HTMLElement>(`#tab-${id}`)!;
    await fireEvent.mouseEnter(card);
    return card.querySelector(".tab-button-bottomright")!;
  };

  it("pinned tab moves to the end of the pinned zone", async () => {
    const c = await setup();
    const [first, second, ...rest] = order();
    const btn = await endButton(c, first);
    expect(btn.classList.contains("tab-button-active")).toBe(true);
    await fireEvent.click(btn);
    await waitFor(() => expect(order()).toEqual([second, first, ...rest]));
  });

  it("not offered for the last pinned or the last unpinned tab", async () => {
    const c = await setup();
    const ids = order();
    for (const id of [ids[PINNED - 1], ids[COUNT - 1]]) {
      const btn = await endButton(c, id);
      expect(btn.classList.contains("tab-button-active")).toBe(false);
    }
  });

  it("pinned tab from another window joins the current pinned zone", async () => {
    const c = await setup();
    const other = fake.truth()[1].tabs!.map((t) => t.id!);
    // expand the other window
    await fireEvent.click(c.querySelector(`#window-${fake.truth()[1].id} a`)!);
    await waitFor(() =>
      expect(c.querySelector(`#tab-${other[0]}`)).not.toBeNull(),
    );
    const before = order();
    await fireEvent.click(await endButton(c, other[0]));
    await waitFor(() =>
      expect(order()).toEqual([
        ...before.slice(0, PINNED),
        other[0],
        ...before.slice(PINNED),
      ]),
    );
  });

  it("unpinned tab from another window is appended", async () => {
    const c = await setup();
    const other = fake.truth()[1].tabs!.map((t) => t.id!);
    await fireEvent.click(c.querySelector(`#window-${fake.truth()[1].id} a`)!);
    await waitFor(() =>
      expect(c.querySelector(`#tab-${other[1]}`)).not.toBeNull(),
    );
    const before = order();
    await fireEvent.click(await endButton(c, other[1]));
    await waitFor(() => expect(order()).toEqual([...before, other[1]]));
  });
});
