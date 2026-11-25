// Tuesday 24 November 2026, summed up in one image.
// A dependency-free PNG renderer (Node standard library only). The program
// draws a newspaper front page - one lead story, four stories in a grid,
// one wide story and a footer line - with a built-in 5x7 bitmap font,
// then writes a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024, H = 1024;
const buf = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
const INK: RGB = [13, 26, 43];       // deep navy page
const CARD: RGB = [24, 41, 63];      // story panel
const PAPER: RGB = [242, 239, 230];  // off-white type
const RED: RGB = [216, 64, 64];
const GOLD: RGB = [232, 184, 75];
const SKY: RGB = [111, 195, 223];
const DIM: RGB = [154, 167, 184];

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x), x1 = Math.min(W, x + w);
  const y0 = Math.max(0, y), y1 = Math.min(H, y + h);
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
    const o = (j * W + i) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
  }
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
}
function seg(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 3): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++)
    for (let k = 0; k < w; k++)
      px(Math.round(x0 + (x1 - x0) * i / n) + k, Math.round(y0 + (y1 - y0) * i / n), c);
}
function ring(cx: number, cy: number, r: number, c: RGB, w = 3): void {
  for (let a = 0; a < 360; a += 0.8) {
    const t = a * Math.PI / 180;
    for (let k = 0; k < w; k++) px(Math.round(cx + (r - k) * Math.cos(t)), Math.round(cy + (r - k) * Math.sin(t)), c);
  }
}

// 5x7 bitmap font: each glyph is 7 rows of 5 bits, most significant bit left.
// Row values are plain numbers, e.g. A = 01110 / 10001 / 10001 / 11111 ...
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 16, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31], J: [7, 2, 2, 2, 2, 17, 14],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 10, 4, 4, 4, 10, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 19, 21, 25, 17, 17, 14], '1': [4, 12, 4, 4, 4, 4, 31],
  '2': [14, 17, 1, 6, 8, 16, 31], '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 4, 4, 4],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 1, 14],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0, 4],
  ',': [0, 0, 0, 0, 0, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 31, 0, 0, 0], ':': [0, 4, 0, 0, 0, 4, 0],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
  '/': [1, 1, 2, 4, 8, 16, 16], '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8], '%': [25, 26, 2, 4, 8, 19, 25],
  '&': [12, 18, 20, 8, 21, 18, 13], '+': [0, 4, 4, 31, 4, 4, 0],
  ';': [0, 4, 0, 0, 0, 4, 8],
};
function drawText(s: string, x: number, y: number, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (g[r] & (16 >> col)) rect(cx + col * scale, y + r * scale, scale, scale, c);
    cx += 6 * scale;
  }
  return cx - x;
}
function textW(s: string, scale: number): number { return s.length * 6 * scale; }
function wrap(s: string, maxChars: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > maxChars) { out.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

// ---- the front page of Tuesday 24 November 2026 ----
rect(0, 0, W, H, INK);

// Masthead: small gold kicker, then the day in huge type.
drawText('THE WORLD IN ONE DAY', (W - textW('THE WORLD IN ONE DAY', 3)) / 2, 30, 3, GOLD);
drawText('TUESDAY', (W - textW('TUESDAY', 9)) / 2, 66, 9, PAPER);
drawText('24 NOVEMBER 2026', (W - textW('24 NOVEMBER 2026', 5)) / 2, 150, 5, PAPER);
rect(64, 198, W - 128, 5, RED);

type Icon = (x: number, y: number) => void;
interface Story { tag: string; head: string; icon: Icon; }
const stories: Story[] = [
  { tag: 'USA - COURTS', head: 'US JURY FINDS HUAWEI GUILTY OF TRADE-SECRET THEFT AND BANK FRAUD',
    icon: (x, y) => { seg(x + 8, y + 52, x + 60, y + 12, GOLD, 5); rect(x + 52, y + 4, 14, 16, GOLD); rect(x + 4, y + 48, 14, 16, GOLD); } },
  { tag: 'MIDDLE EAST', head: 'DRONE ATTACK HITS RIYADH TOWER; AT LEAST 11 WOUNDED',
    icon: (x, y) => { rect(x + 22, y + 6, 24, 52, SKY); seg(x + 22, y + 6, x + 34, y - 6, SKY, 3); rect(x + 28, y + 16, 12, 8, INK); rect(x + 28, y + 30, 12, 8, INK); rect(x + 28, y + 44, 12, 8, INK); } },
  { tag: 'UKRAINE WAR', head: 'UKRAINE HITS RUSSIAN SHIPS IN FINLAND GULF AND OFF LIBYA',
    icon: (x, y) => { seg(x + 6, y + 40, x + 62, y + 40, SKY, 4); seg(x + 14, y + 40, x + 54, y + 40, SKY, 4); seg(x + 34, y + 40, x + 34, y + 8, SKY, 4); seg(x + 34, y + 8, x + 52, y + 22, RED, 3); seg(x + 6, y + 50, x + 62, y + 50, DIM, 2); } },
  { tag: 'GULF - ENERGY', head: 'FOUR TANKERS HIT MINES IN STRAIT OF HORMUZ, IRAN SAYS',
    icon: (x, y) => { ring(x + 34, y + 26, 14, RED, 3); for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; seg(x + 34 + Math.round(16 * Math.cos(t)), y + 26 + Math.round(16 * Math.sin(t)), x + 34 + Math.round(24 * Math.cos(t)), y + 26 + Math.round(24 * Math.sin(t)), RED, 2); } seg(x + 6, y + 52, x + 62, y + 52, SKY, 3); } },
  { tag: 'COLOMBIA', head: 'GUNMEN HOLD 25 HOSTAGES AT SUPERMARKET IN CARTAGENA',
    icon: (x, y) => { rect(x + 8, y + 18, 52, 40, SKY); rect(x + 28, y + 38, 12, 20, INK); rect(x + 14, y + 26, 10, 8, INK); rect(x + 44, y + 26, 10, 8, INK); rect(x + 4, y + 12, 60, 6, GOLD); } },
  { tag: 'SPACE - ASIA', head: "CHINA LAUNCHES SHENZHOU 24 CARRYING PAKISTAN'S FIRST ASTRONAUT",
    icon: (x, y) => { seg(x + 34, y + 2, x + 22, y + 30, SKY, 4); seg(x + 34, y + 2, x + 46, y + 30, SKY, 4); rect(x + 26, y + 28, 16, 18, SKY); seg(x + 30, y + 46, x + 26, y + 60, GOLD, 3); seg(x + 38, y + 46, x + 42, y + 60, GOLD, 3); seg(x + 34, y + 46, x + 34, y + 62, RED, 3); } },
];

// Lead story: full-width panel for the Huawei verdict.
const lead = stories[0];
rect(32, 216, 960, 150, CARD);
rect(32, 216, 960, 5, RED);
lead.icon(48, 240);
drawText(lead.tag, 140, 252, 3, GOLD);
wrap(lead.head, 40).slice(0, 3).forEach((ln, k) => drawText(ln, 140, 292 + k * 26, 3, PAPER));

// Grid: four stories, two by two.
const grid = stories.slice(1, 5);
grid.forEach((s, i) => {
  const x = 32 + (i % 2) * 488, y = 382 + Math.floor(i / 2) * 174;
  rect(x, y, 464, 158, CARD);
  rect(x, y, 464, 5, RED);
  s.icon(x + 14, y + 16);
  drawText(s.tag, x + 92, y + 30, 2, GOLD);
  wrap(s.head, 23).slice(0, 3).forEach((ln, k) => drawText(ln, x + 20, y + 82 + k * 26, 3, PAPER));
});

// Wide story: Shenzhou 24 across the bottom.
const wide = stories[5];
rect(32, 730, 960, 150, CARD);
rect(32, 730, 960, 5, RED);
wide.icon(48, 754);
drawText(wide.tag, 140, 766, 3, GOLD);
wrap(wide.head, 40).slice(0, 3).forEach((ln, k) => drawText(ln, 140, 806 + k * 26, 3, PAPER));

// Footer: the rest of the day in one line.
const foot = 'ALSO: TURKISH HELICOPTER CRASH KILLS 5 - SENEGAL REGAIN AFRICA CUP TITLE - 14 NATIONS BACK ICJ ROHINGYA RULING - NEPAL QUAKE 5.6';
wrap(foot, 62).forEach((ln, k) => drawText(ln, (W - textW(ln, 2)) / 2, 908 + k * 26, 2, DIM));

// ---- PNG encoding: zlib deflate + CRC32, standard library only ----
const table: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  table[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const byte of b) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
const scan = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  scan[y * (W * 3 + 1)] = 0; // filter: none
  Buffer.from(buf.buffer, y * W * 3, W * 3).copy(scan, y * (W * 3 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(scan, { level: 9 })),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
