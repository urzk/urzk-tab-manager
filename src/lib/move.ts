export type Direction = "up" | "down" | "left" | "right";

/**
 * Position a tab card moves to (left/right) or swaps with (up/down) in its
 * window's full tab order, or undefined when the move is not possible.
 *
 * Chrome keeps pinned tabs before unpinned ones and silently clamps moves
 * that would cross that boundary, so such moves are refused here.
 */
export function moveTarget(
  index: number,
  dir: Direction,
  columns: number,
  count: number,
  pinnedCount: number,
): number | undefined {
  const cols = Math.max(1, columns);
  const step =
    dir === "left" ? -1 : dir === "right" ? 1 : dir === "up" ? -cols : cols;
  const to = index + step;
  if (to < 0 || to >= count) return undefined;
  if (index < pinnedCount !== to < pinnedCount) return undefined;
  return to;
}
