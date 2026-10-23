const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const manifest = JSON.parse(fs.readFileSync('scripts/builder-images-manifest.json', 'utf8'));
const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';

// Mappings from generate-builder-specs-content.cjs
const mappings = JSON.parse(fs.readFileSync('scripts/generate-builder-specs-content.cjs', 'utf8').match(/const BUILDER_MAPPINGS = ({[\s\S]*?});/)[1]);

let totalWidgets = 0;
let totalMatched = 0;

for (const [slug, cfg] of Object.entries(mappings)) {
  const fullPath = path.join(BASE_DIR, cfg.file);
  if (!fs.existsSync(fullPath)) continue;
  const wb = XLSX.readFile(fullPath);
  const ws = wb.Sheets[cfg.sheet];
  if (!ws) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i] || [];
    if (row.some(c => typeof c === 'string' && (c.toLowerCase().includes('widget') || c.toLowerCase().includes('measure') || c.toLowerCase() === 'no'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) continue;

  const sheetImgs = (manifest[cfg.file] && manifest[cfg.file][cfg.sheet]) || [];
  let wCount = 0;
  let mCount = 0;

  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.some(c => c !== undefined && c !== null && String(c).trim() !== '')) continue;
    wCount++;
    const matched = sheetImgs.find(img => img.row === r);
    if (matched) mCount++;
  }

  totalWidgets += wCount;
  totalMatched += mCount;
  console.log(`${slug} (${cfg.sheet}): ${mCount} / ${wCount} widgets matched images (Total sheet images in Excel: ${sheetImgs.length})`);
}

console.log(`\nOVERALL: ${totalMatched} / ${totalWidgets} widgets have exact row-matched images!`);
