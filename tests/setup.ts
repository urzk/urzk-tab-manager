// jsdom has no layout: `bind:clientWidth` needs a ResizeObserver to exist,
// but it never fires (clientWidth stays 0, so the grid has one column).
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has no Web Animations API; Svelte's `animate:`/transitions use it.
// This stub finishes every animation on the next microtask.
if (typeof Element !== "undefined" && !Element.prototype.animate) {
  Element.prototype.getAnimations = () => [];
  Element.prototype.animate = function () {
    const a = {
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null,
      currentTime: 0,
      playState: "finished",
      finished: Promise.resolve(),
      cancel() {},
      finish() {
        a.onfinish?.();
      },
      play() {},
      pause() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
    };
    queueMicrotask(() => a.onfinish?.());
    return a as unknown as Animation;
  };
}

export {};
