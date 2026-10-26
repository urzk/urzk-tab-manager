// Renders the extension icons and the store promo tile from assets/*.svg.
// Usage: pnpm icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const font = {
  loadSystemFonts: true,
  defaultFontFamily: "Helvetica",
  sansSerifFamily: "Helvetica",
};

function render(svg, width, out) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font })
    .render()
    .asPng();
  const path = resolve(root, out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  process.stdout.write(`wrote ${out}\n`);
}

const full = read("assets/icon.svg");
// The full artwork's details blur below 48px, so 16 and 32 use a simpler variant.
const small = read("assets/icon-small.svg");

for (const size of [16, 32])
  render(small, size, `public/icons/icon-${size}.png`);
for (const size of [48, 128])
  render(full, size, `public/icons/icon-${size}.png`);
render(read("assets/promo-small.svg"), 440, "store/promo-small-440x280.png");
