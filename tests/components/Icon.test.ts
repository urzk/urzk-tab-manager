import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import Icon from "../../src/icons/Icon.svelte";
import { icons } from "../../src/icons/paths";

afterEach(cleanup);

describe("Icon", () => {
  // FontAwesome's .svg-inline--fa box (1.25em wide, -0.125em baseline) is
  // what spaces the window buttons and centres the card buttons.
  it("renders every icon through FontAwesome", () => {
    for (const name of Object.keys(icons) as (keyof typeof icons)[]) {
      const { container } = render(Icon, { props: { name } });
      const svg = container.querySelector("svg")!;
      expect(svg.classList.contains("svg-inline--fa"), name).toBe(true);
      expect(svg.getAttribute("data-icon"), name).toBe(icons[name].iconName);
      cleanup();
    }
  });

  it("updates when the name changes", async () => {
    const { container, rerender } = render(Icon, {
      props: { name: "caretRight" },
    });
    await rerender({ name: "caretDown" });
    expect(container.querySelector("svg")!.getAttribute("data-icon")).toBe(
      icons.caretDown.iconName,
    );
  });
});
