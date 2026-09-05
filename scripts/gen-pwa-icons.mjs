// One-off generator for the PWA manifest icons — reproduces the exact house
// glyph already used in-app (portal-landing.tsx, sidebar.tsx) rather than
// inventing new brand art. Run with: node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const BG = "#0e0704";
const TERRACOTTA = "#c8522a";
const TEAL = "#0e7c6b";

function glyphSvg({ canvas, scale, offset }) {
  return `<svg width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${canvas}" height="${canvas}" fill="${BG}"/>
  <g transform="translate(${offset},${offset}) scale(${scale})">
    <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill="${TERRACOTTA}"/>
    <path d="M14 3 L25 12 L14 16 L3 12 Z" fill="${TEAL}"/>
  </g>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });

const targets = [
  { file: "public/icons/icon-192.png", canvas: 192, scale: 192 * 0.625 / 28, offsetRatio: (1 - 0.625) / 2 },
  { file: "public/icons/icon-512.png", canvas: 512, scale: 512 * 0.625 / 28, offsetRatio: (1 - 0.625) / 2 },
  { file: "public/icons/icon-512-maskable.png", canvas: 512, scale: 512 * 0.45 / 28, offsetRatio: (1 - 0.45) / 2 },
];

for (const t of targets) {
  const offset = t.canvas * t.offsetRatio;
  const svg = glyphSvg({ canvas: t.canvas, scale: t.scale, offset });
  await sharp(Buffer.from(svg)).png().toFile(t.file);
  console.log("wrote", t.file);
}
