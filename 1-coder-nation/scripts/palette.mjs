// Regenerates the colour scales inside src/styles/tokens.css from two base colours.
//
//   npm run palette                                   -> re-run with the bases already in tokens.css
//   npm run palette -- --primary "#FF6B1A" --secondary "#0B1B3A"   -> set new bases (the final brand colours)
//
// primary   sits at step 500 of its scale, secondary sits at step 900.
// The script also checks the contrast pairs the UI relies on and exits non-zero if one fails.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const TOKENS = resolve(dirname(fileURLToPath(import.meta.url)), "../src/styles/tokens.css");
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// ---------- colour maths (sRGB <-> OKLab/OKLCH) ----------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklch(hex) {
  const [L, a, b] = linearToOklab(hexToRgb(hex).map(toLinear));
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI];
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

// Builds a hex from OKLCH, lowering chroma until the colour fits inside sRGB.
function oklchToHex(L, C, H) {
  const h = (H * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  let best = oklabToLinear([L, 0, 0]);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklabToLinear([L, mid * Math.cos(h), mid * Math.sin(h)]);
    if (inGamut(rgb)) {
      best = rgb;
      lo = mid;
    } else hi = mid;
  }
  return rgbToHex(best);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- scale builders ----------
// A scale pinned to `anchorStep`: lighter steps fade towards a near-white tint, darker steps deepen.
function scaleFrom(baseHex, anchorStep, { lightEnd = 0.975, darkRatio = 0.4, tintChroma = 0.12 } = {}) {
  const [L0, C0, H0] = hexToOklch(baseHex);
  const anchor = STEPS.indexOf(anchorStep);
  const out = {};
  STEPS.forEach((step, i) => {
    if (i === anchor) {
      out[step] = baseHex.toUpperCase();
    } else if (i < anchor) {
      const t = (anchor - i) / anchor; // 0 near the anchor, 1 at step 50
      out[step] = oklchToHex(L0 + (lightEnd - L0) * t, C0 * (1 - (1 - tintChroma) * t ** 1.6), H0);
    } else {
      const t = (i - anchor) / (STEPS.length - 1 - anchor);
      out[step] = oklchToHex(L0 - (L0 - L0 * darkRatio) * t, C0 * (1 - 0.3 * t), H0);
    }
  });
  return out;
}

// Neutral ramp tinted towards the secondary hue so greys feel part of the palette.
function neutralFrom(secondaryHex) {
  const [, , H] = hexToOklch(secondaryHex);
  const L = { 50: 0.985, 100: 0.965, 200: 0.925, 300: 0.87, 400: 0.72, 500: 0.6, 600: 0.48, 700: 0.38, 800: 0.28, 900: 0.2 };
  return Object.fromEntries(STEPS.map((s) => [s, oklchToHex(L[s], s <= 200 ? 0.006 : 0.014, H)]));
}

// ---------- read / write tokens.css ----------
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

let css = readFileSync(TOKENS, "utf8");
const baseMatch = css.match(/palette-base\s+primary=(#[0-9a-fA-F]{6})\s+secondary=(#[0-9a-fA-F]{6})/);
if (!baseMatch) throw new Error("tokens.css is missing the `palette-base primary=#... secondary=#...` comment");

const primary = (flag("primary") ?? baseMatch[1]).toUpperCase();
const secondary = (flag("secondary") ?? baseMatch[2]).toUpperCase();
for (const [name, v] of [["primary", primary], ["secondary", secondary]]) {
  if (!/^#[0-9A-F]{6}$/.test(v)) throw new Error(`--${name} must be a 6-digit hex like #FF6B1A (got ${v})`);
}

const scales = {
  primary: scaleFrom(primary, 500),
  secondary: { ...scaleFrom(secondary, 900), 950: oklchToHex(hexToOklch(secondary)[0] * 0.72, hexToOklch(secondary)[1] * 0.9, hexToOklch(secondary)[2]) },
  neutral: neutralFrom(secondary),
  success: scaleFrom("#1FA463", 500),
  error: scaleFrom("#E5484D", 500),
};

const block = Object.entries(scales)
  .map(([name, steps]) => {
    const lines = Object.entries(steps)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([step, hex]) => `  --color-${name}-${step}: ${hex};`);
    return `  /* ${name} */\n${lines.join("\n")}`;
  })
  .join("\n\n");

css = css.replace(/palette-base\s+primary=#[0-9a-fA-F]{6}\s+secondary=#[0-9a-fA-F]{6}/, `palette-base primary=${primary} secondary=${secondary}`);
css = css.replace(/(\/\* PALETTE:START[^\n]*\*\/\n)[\s\S]*?(\n\s*\/\* PALETTE:END \*\/)/, (_, start, end) => `${start}${block}${end}`);
writeFileSync(TOKENS, css);

// ---------- contrast audit of the pairs the UI actually uses ----------
const p = scales.primary;
const s = scales.secondary;
const n = scales.neutral;
const W = "#FFFFFF";
const pairs = [
  // [label, foreground, background, minimum ratio]
  ["light: body text on page", s[900], n[50], 4.5],
  ["light: body text on card", s[900], W, 4.5],
  ["light: muted text on page", s[600], n[50], 4.5],
  ["light: muted text on card", s[600], W, 4.5],
  ["light: accent text/link on page", p[700], n[50], 4.5],
  ["light: accent text/link on card", p[700], W, 4.5],
  ["light: focus ring on page", s[700], n[50], 3],
  ["navy: body text", W, s[900], 4.5],
  ["navy: muted text", s[200], s[900], 4.5],
  ["navy: muted text on card", s[200], s[800], 4.5],
  ["navy: accent text/link", p[400], s[900], 4.5],
  ["navy: accent text on card", p[400], s[800], 4.5],
  ["navy: focus ring", p[400], s[900], 3],
  ["button: navy text on primary", s[900], p[500], 4.5],
  ["button hover: navy text on primary-400", s[900], p[400], 4.5],
  ["navy: error text", scales.error[300], s[900], 4.5],
  ["navy: success text", scales.success[300], s[900], 4.5],
  ["light: error text", scales.error[700], W, 4.5],
  ["light: success text", scales.success[700], W, 4.5],
];

let failed = 0;
console.log(`\nprimary ${primary}  |  secondary ${secondary}\n`);
for (const [label, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ${label}  [${fg} on ${bg}]`);
}
console.log(failed ? `\n${failed} contrast pair(s) failed. Adjust the semantic mapping in tokens.css or pick other bases.\n` : "\nAll contrast pairs pass.\n");
process.exit(failed ? 1 : 0);
