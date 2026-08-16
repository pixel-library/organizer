import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.resolve("public/icons");

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const BRAND_TOP = [0x91, 0x00, 0x29];
const BRAND_BOTTOM = [0x5a, 0x00, 0x1a];
const ACCENT = [0xe2, 0x56, 0x82];
const WHITE = [255, 255, 255];

function renderIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * (maskable ? 0.5 : 0.22);
  const cx = size / 2;
  const cy = size / 2;

  const inRoundedRect = (x, y) => {
    if (maskable) return true;
    const dx = Math.max(radius - (cx - x), x - (size - radius), 0);
    const dy = Math.max(radius - (cy - y), y - (size - radius), 0);
    return dx * dx + dy * dy <= radius * radius;
  };

  const inRing = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d >= size * 0.30 && d <= size * 0.36;
  };

  const checkThickness = size * 0.09;
  const checkDist = (x, y) => {
    const p1 = [cx - size * 0.18, cy + size * 0.02];
    const p2 = [cx - size * 0.04, cy + size * 0.16];
    const p3 = [cx + size * 0.22, cy - size * 0.14];
    const seg = (ax, ay, bx, by, px, py) => {
      const abx = bx - ax;
      const aby = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
      const qx = ax + t * abx;
      const qy = ay + t * aby;
      return Math.hypot(px - qx, py - qy);
    };
    return Math.min(seg(p1[0], p1[1], p2[0], p2[1], x, y), seg(p2[0], p2[1], p3[0], p3[1], x, y));
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (inRoundedRect(x, y)) {
        const t = y / size;
        r = Math.round(BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t);
        g = Math.round(BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t);
        b = Math.round(BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t);
        a = 255;
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
        if (edge < 1 && !maskable) {
          r = Math.round(r * 0.92);
          g = Math.round(g * 0.92);
          b = Math.round(b * 0.92);
        }
        if (inRing(x, y)) {
          r = ACCENT[0]; g = ACCENT[1]; b = ACCENT[2];
        } else if (checkDist(x, y) <= checkThickness) {
          r = WHITE[0]; g = WHITE[1]; b = WHITE[2];
        }
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  return encodePng(size, size, px);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", renderIcon(192)],
  ["icon-512.png", renderIcon(512)],
  ["maskable-512.png", renderIcon(512, { maskable: true })],
  ["apple-touch-icon.png", renderIcon(180)]
];
for (const [name, buf] of targets) {
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
}