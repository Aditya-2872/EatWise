/**
 * Generates EatWise PWA icons (192, 512, maskable 512) with zero image
 * dependencies — a tiny PNG encoder + math-drawn art. Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");

/* ---------------- PNG encoder ---------------- */

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const rowBytes = w * 4;
  const raw = Buffer.alloc((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: none
    rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---------------- Art ---------------- */

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const TOP = hexToRgb("#065f46");
const BOTTOM = hexToRgb("#10b981");
const LEAF = hexToRgb("#047857");
const WHITE = [255, 255, 255];

/** Draw the icon into an RGBA buffer. `pad` shrinks art into the maskable safe zone. */
function draw(size, pad = 0) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size / 512; // art designed at 512
  const c = size / 2;
  const scale = 1 - pad; // pad = fraction of half-size trimmed for safe zone

  // Leaf lens: intersection of two circles offset along the 45° diagonal.
  const plateR = 150 * s * scale;
  const plateCx = c;
  const plateCy = c + 14 * s * scale;
  const lensR = 78 * s * scale;
  const lensOff = 46 * s * scale;
  const ux = Math.SQRT1_2;
  const l1 = { x: plateCx - lensOff * ux, y: plateCy + 6 * s * scale + lensOff * ux };
  const l2 = { x: plateCx + lensOff * ux, y: plateCy + 6 * s * scale - lensOff * ux };

  for (let y = 0; y < size; y++) {
    const gt = y / (size - 1);
    const bg = [lerp(TOP[0], BOTTOM[0], gt), lerp(TOP[1], BOTTOM[1], gt), lerp(TOP[2], BOTTOM[2], gt)];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let [r, g, b] = bg;

      const dxp = x - plateCx;
      const dyp = y - plateCy;
      const inPlate = dxp * dxp + dyp * dyp <= plateR * plateR;
      if (inPlate) [r, g, b] = WHITE;

      // Leaf (lens intersection), only inside the plate.
      const d1 = (x - l1.x) ** 2 + (y - l1.y) ** 2 <= lensR * lensR;
      const d2 = (x - l2.x) ** 2 + (y - l2.y) ** 2 <= lensR * lensR;
      if (inPlate && d1 && d2) [r, g, b] = LEAF;

      // Stem: thin line from leaf center toward bottom-right.
      const stemVec = { x: x - plateCx, y: y - (plateCy + 6 * s * scale) };
      const along = stemVec.x * ux - stemVec.y * ux; // projection on 45° axis
      const perp = Math.abs(stemVec.x * ux + stemVec.y * ux);
      if (inPlate && along > 10 * s * scale && along < 86 * s * scale && perp < 4.5 * s * scale) {
        [r, g, b] = LEAF;
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

/** Box downsample RGBA (antialiased shrink). */
function downsample(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4);
  const f = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = Math.floor(y * f); sy < (y + 1) * f; sy++) {
        for (let sx = Math.floor(x * f); sx < (x + 1) * f; sx++) {
          const i = (sy * srcSize + sx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (y * dstSize + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const art512 = draw(512, 0);
const maskable512 = draw(512, 0.2); // art inside 80% safe zone
const art192 = downsample(art512, 512, 192);

writeFileSync(join(OUT, "icon-512.png"), encodePNG(512, 512, art512));
writeFileSync(join(OUT, "maskable-512.png"), encodePNG(512, 512, maskable512));
writeFileSync(join(OUT, "icon-192.png"), encodePNG(192, 192, art192));
console.log("Icons written to public/icons/");
