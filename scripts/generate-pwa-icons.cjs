const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ==========================================
// 1. Generate Adaptive Vector Favicon (SVG)
// Based on the user's preferred BookUser icon:
// - Book Spine/Cover: M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20
// - User Head: circle cx="12" cy="8" r="2.2" (filled for bold presence)
// - User Shoulders: M15.5 13.5a3.5 3.5 0 1 0-7 0
// - Strictly grey gradient & black/white, high contrast
// ==========================================

const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
  <defs>
    <!-- Light Mode Tab: Bold Charcoal Grey Gradient -->
    <linearGradient id="tabCharcoal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="50%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#52525b"/>
    </linearGradient>
    <!-- Dark Mode Tab: Bold Silver Platinum Grey Gradient -->
    <linearGradient id="tabSilver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <style>
      .emblem-path {
        stroke: url(#tabCharcoal);
        fill: none;
      }
      .emblem-head {
        fill: url(#tabCharcoal);
      }
      @media (prefers-color-scheme: dark) {
        .emblem-path {
          stroke: url(#tabSilver);
        }
        .emblem-head {
          fill: url(#tabSilver);
        }
      }
    </style>
  </defs>

  <!-- Book Spine & Pages -->
  <path class="emblem-path" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" 
        stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- User Head (Solid filled for bold iconic presence) -->
  <circle class="emblem-head" cx="12" cy="8" r="2.2"/>
  <!-- User Shoulders -->
  <path class="emblem-path" d="M15.5 13.5a3.5 3.5 0 1 0-7 0" 
        stroke-width="2.3" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(__dirname, '../static/favicon.svg'), svgFavicon, 'utf8');
console.log('✓ Created static/favicon.svg (Dual-theme BookUser vector favicon)');

// ==========================================
// 2. High-Precision PNG Rasterizer
// Renders the exact BookUser geometry with subpixel antialiasing & grey gradient
// ==========================================

function makePng(width, height, rawData) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.slice(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idatCompressed = zlib.deflateSync(rawData, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatCompressed), chunk('IEND', Buffer.alloc(0))]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToArc(px, py, cx, cy, r, sa, ea) {
  const d = Math.hypot(px - cx, py - cy);
  let angle = Math.atan2(py - cy, px - cx);
  if (angle < 0) angle += Math.PI * 2;
  let s = sa, e = ea;
  if (e < s) e += Math.PI * 2;
  let inArc = false;
  if (angle >= s && angle <= e) inArc = true;
  else if (angle + Math.PI * 2 >= s && angle + Math.PI * 2 <= e) inArc = true;

  if (inArc) return Math.abs(d - r);
  const p1x = cx + r * Math.cos(sa), p1y = cy + r * Math.sin(sa);
  const p2x = cx + r * Math.cos(ea), p2y = cy + r * Math.sin(ea);
  return Math.min(Math.hypot(px - p1x, py - p1y), Math.hypot(px - p2x, py - p2y));
}

function sampleBookUserCoverage(x, y) {
  // Head circle at (12, 8), r = 2.2
  const headDist = Math.hypot(x - 12, y - 8);
  if (headDist <= 2.2) return 1.0;

  const strokeR = 1.15; // 2.3px stroke
  let minDist = headDist - 2.2;

  // Shoulders arc
  minDist = Math.min(minDist, distToArc(x, y, 12, 13.5, 3.5, Math.PI, Math.PI * 2));
  // Book spine
  minDist = Math.min(minDist, distToSegment(x, y, 4, 4.5, 4, 19.5));
  // Top-left arc
  minDist = Math.min(minDist, distToArc(x, y, 6.5, 4.5, 2.5, Math.PI, Math.PI * 1.5));
  // Top horizontal
  minDist = Math.min(minDist, distToSegment(x, y, 6.5, 2, 18.5, 2));
  // Top-right arc
  minDist = Math.min(minDist, distToArc(x, y, 18.5, 3, 1, Math.PI * 1.5, Math.PI * 2));
  // Right vertical
  minDist = Math.min(minDist, distToSegment(x, y, 19.5, 3, 19.5, 20));
  // Bottom-right arc
  minDist = Math.min(minDist, distToArc(x, y, 18.5, 20, 1, 0, Math.PI * 0.5));
  // Bottom horizontal
  minDist = Math.min(minDist, distToSegment(x, y, 18.5, 21, 6.5, 21));
  // Bottom-left inner curl
  minDist = Math.min(minDist, distToArc(x, y, 6.5, 20.5, 0.5, Math.PI * 0.5, Math.PI * 1.5));
  // Bottom fold line
  minDist = Math.min(minDist, distToSegment(x, y, 6.5, 20, 19.5, 20));
  // Bottom-left spine arc
  minDist = Math.min(minDist, distToArc(x, y, 6.5, 19.5, 2.5, Math.PI * 0.5, Math.PI));

  const edgeDist = minDist - strokeR;
  if (edgeDist <= -0.5) return 1.0;
  if (edgeDist >= 0.5) return 0.0;
  return 0.5 - edgeDist;
}

// Render rasterized BookUser PNG
function renderBookUserPng(targetSize, options = {}) {
  const { bg = 'transparent', color = 'silver', padding = 0 } = options;
  const raw = Buffer.alloc(targetSize * (1 + targetSize * 4));

  const contentSize = targetSize * (1 - padding * 2);
  const offset = targetSize * padding;

  for (let ty = 0; ty < targetSize; ty++) {
    const rowOffset = ty * (1 + targetSize * 4);
    raw[rowOffset] = 0;

    for (let tx = 0; tx < targetSize; tx++) {
      let r = 0, g = 0, b = 0, a = 0;

      // Background
      if (bg === 'squircle' || bg === 'solid') {
        const normX = tx / targetSize;
        const normY = ty / targetSize;
        const corner = bg === 'solid' ? 0 : 0.22;
        const dx = Math.max(0, Math.abs(normX - 0.5) - (0.5 - corner));
        const dy = Math.max(0, Math.abs(normY - 0.5) - (0.5 - corner));
        if (Math.sqrt(dx * dx + dy * dy) <= corner) {
          r = 10; g = 10; b = 12; a = 255; // Dark graphite
        }
      }

      // Emblem sampling
      if (tx >= offset && tx < offset + contentSize &&
          ty >= offset && ty < offset + contentSize) {
        
        let cov = 0;
        const steps = targetSize <= 32 ? 4 : 2;
        for (let sy = 0; sy < steps; sy++) {
          for (let sx = 0; sx < steps; sx++) {
            const u = (((tx - offset) + (sx + 0.5) / steps) / contentSize) * 24;
            const v = (((ty - offset) + (sy + 0.5) / steps) / contentSize) * 24;
            cov += sampleBookUserCoverage(u, v);
          }
        }
        const emblemAlpha = cov / (steps * steps);

        if (emblemAlpha > 0.01) {
          const t = (tx + ty) / (targetSize * 2);
          let grey = 0;
          if (color === 'silver') {
            grey = Math.round(255 - t * 105); // 255 -> 150
          } else {
            grey = Math.round(18 + t * 65);   // 18 -> 83
          }

          if (a === 0) {
            r = grey; g = grey; b = grey;
            a = Math.round(emblemAlpha * 255);
          } else {
            r = Math.round(r * (1 - emblemAlpha) + grey * emblemAlpha);
            g = Math.round(g * (1 - emblemAlpha) + grey * emblemAlpha);
            b = Math.round(b * (1 - emblemAlpha) + grey * emblemAlpha);
            a = Math.max(a, Math.round(emblemAlpha * 255));
          }
        }
      }

      const px = rowOffset + 1 + tx * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  return makePng(targetSize, targetSize, raw);
}

// 3. Generate Favicon PNGs (Transparent, High Contrast Silver Metallic)
const png32 = renderBookUserPng(32, { bg: 'transparent', color: 'silver', padding: 0.04 });
fs.writeFileSync(path.join(__dirname, '../static/favicon-32x32.png'), png32);
console.log('✓ Created static/favicon-32x32.png');

const png16 = renderBookUserPng(16, { bg: 'transparent', color: 'silver', padding: 0.04 });
fs.writeFileSync(path.join(__dirname, '../static/favicon-16x16.png'), png16);
console.log('✓ Created static/favicon-16x16.png');

// 4. Multi-Size favicon.ico
function makeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  const buffers = [];

  images.forEach(img => {
    const entry = Buffer.alloc(16);
    entry[0] = img.width >= 256 ? 0 : img.width;
    entry[1] = img.height >= 256 ? 0 : img.height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    buffers.push(img.data);
    offset += img.data.length;
  });

  return Buffer.concat([header, ...entries, ...buffers]);
}

const ico = makeIco([
  { width: 16, height: 16, data: png16 },
  { width: 32, height: 32, data: png32 }
]);
fs.writeFileSync(path.join(__dirname, '../static/favicon.ico'), ico);
console.log('✓ Created static/favicon.ico (Multi-size 16/32)');

// 5. PWA Icons (Deep Charcoal Background + Bold Silver BookUser)
const appleIcon = renderBookUserPng(180, { bg: 'squircle', color: 'silver', padding: 0.20 });
fs.writeFileSync(path.join(__dirname, '../static/apple-touch-icon.png'), appleIcon);
console.log('✓ Created static/apple-touch-icon.png');

const pwa192 = renderBookUserPng(192, { bg: 'squircle', color: 'silver', padding: 0.20 });
fs.writeFileSync(path.join(__dirname, '../static/icon-192.png'), pwa192);
console.log('✓ Created static/icon-192.png');

const pwa512 = renderBookUserPng(512, { bg: 'squircle', color: 'silver', padding: 0.20 });
fs.writeFileSync(path.join(__dirname, '../static/icon-512.png'), pwa512);
console.log('✓ Created static/icon-512.png');

const maskable192 = renderBookUserPng(192, { bg: 'solid', color: 'silver', padding: 0.24 });
fs.writeFileSync(path.join(__dirname, '../static/icon-maskable-192.png'), maskable192);
console.log('✓ Created static/icon-maskable-192.png');

const maskable512 = renderBookUserPng(512, { bg: 'solid', color: 'silver', padding: 0.24 });
fs.writeFileSync(path.join(__dirname, '../static/icon-maskable-512.png'), maskable512);
console.log('✓ Created static/icon-maskable-512.png');

// Clean up unused previous files if any
['logo-colored.png', 'logo-silver.png', 'logo-charcoal.png'].forEach(f => {
  const p = path.join(__dirname, '../static', f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

console.log('🎉 All BookUser favicon & PWA assets generated successfully!');
