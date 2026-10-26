import { describe, expect, it } from "vitest";
import { moveTarget, type Direction } from "../src/lib/move";

const dirs: Direction[] = ["up", "down", "left", "right"];

/** True when every pinned tab comes before every unpinned tab. */
const pinnedFirst = (pinned: boolean[]) =>
  pinned.every((p, i) => i === 0 || !p || pinned[i - 1]);

/**
 * Independent reference: a move is allowed when the target is in range and
 * the resulting order (left/right = move, up/down = swap) keeps Chrome's
 * "pinned tabs first" invariant.
 */
function reference(
  index: number,
  dir: Direction,
  columns: number,
  count: number,
  pinnedCount: number,
): number | undefined {
  const step =
    dir === "left"
      ? -1
      : dir === "right"
        ? 1
        : dir === "up"
          ? -columns
          : columns;
  const to = index + step;
  if (to < 0 || to >= count) return undefined;
  const pinned = Array.from({ length: count }, (_, i) => i < pinnedCount);
  if (dir === "left" || dir === "right") {
    const [p] = pinned.splice(index, 1);
    pinned.splice(to, 0, p);
  } else {
    [pinned[index], pinned[to]] = [pinned[to], pinned[index]];
  }
  return pinnedFirst(pinned) ? to : undefined;
}

describe("moveTarget", () => {
  it("matches the reference for every position, direction and layout", () => {
    let checked = 0;
    for (let pinnedCount = 0; pinnedCount <= 3; pinnedCount++)
      for (let unpinned = 0; unpinned <= 6; unpinned++)
        for (let columns = 1; columns <= 4; columns++) {
          const count = pinnedCount + unpinned;
          for (let index = 0; index < count; index++)
            for (const dir of dirs) {
              expect(
                moveTarget(index, dir, columns, count, pinnedCount),
                `p=${pinnedCount} n=${count} c=${columns} i=${index} ${dir}`,
              ).toBe(reference(index, dir, columns, count, pinnedCount));
              checked++;
            }
        }
    expect(checked).toBeGreaterThan(1000);
  });

  it("refuses the reported cross-zone moves (2 pinned, 4 columns)", () => {
    // row 1 col 2 → right / down, row 1 col 3 → left, row 2 col 2 → up
    expect(moveTarget(1, "right", 4, 12, 2)).toBeUndefined();
    expect(moveTarget(2, "left", 4, 12, 2)).toBeUndefined();
    expect(moveTarget(1, "down", 4, 12, 2)).toBeUndefined();
    expect(moveTarget(5, "up", 4, 12, 2)).toBeUndefined();
  });

  it("allows moves within a zone", () => {
    expect(moveTarget(0, "right", 4, 12, 2)).toBe(1);
    expect(moveTarget(3, "left", 4, 12, 2)).toBe(2);
    expect(moveTarget(2, "down", 4, 12, 2)).toBe(6);
    expect(moveTarget(6, "up", 4, 12, 2)).toBe(2);
  });

  it("treats columns below 1 as 1", () => {
    expect(moveTarget(1, "up", 0, 3, 0)).toBe(0);
  });
});
