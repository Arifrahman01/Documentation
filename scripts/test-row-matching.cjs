const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const manifest = JSON.parse(fs.readFileSync('scripts/builder-images-manifest.json', 'utf8'));

const testCases = [
  { file: '1. Finance/Story Builder Spec - Finance.xlsx', sheet: 'Financial Performance' },
  { file: '1. Finance/Story Builder Spec - Finance.xlsx', sheet: 'Financial Position and Cov Rat.' },
  { file: '2. Marketing/Story Builder Spec - Marketing.xlsx', sheet: 'Price&Quantity Benchmark' },
  { file: '3. Operation Mining/Story Builder Spec - Operation Mining.xlsx', sheet: 'OP_Overview_JB' },
  { file: '5. Supply Chain/Story Builder Spec - Supply Chain.xlsx', sheet: 'Procurement Cycle' }
];

for (const tc of testCases) {
  const fullPath = path.join('D:/Jhonlin/SAP/SAC/Document', tc.file);
  const wb = XLSX.readFile(fullPath);
  const ws = wb.Sheets[tc.sheet];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i] || [];
    if (row.some(c => typeof c === 'string' && (c.toLowerCase().includes('widget') || c.toLowerCase().includes('measure') || c.toLowerCase() === 'no'))) {
      headerIdx = i;
      break;
    }
  }

  const sheetImgs = (manifest[tc.file] && manifest[tc.file][tc.sheet]) || [];
  console.log(`\n=== ${tc.file} -> ${tc.sheet} (Header row: ${headerIdx}, Total imgs: ${sheetImgs.length}) ===`);

  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.some(c => c !== undefined && c !== null && String(c).trim() !== '')) continue;
    
    // Find image matching this row or nearest row
    const matchedImgs = sheetImgs.filter(img => img.row === r);
    const no = row[0] || '';
    const widget = String(row[1] || '').slice(0, 40);
    console.log(`Row ${r} [W: ${widget}]: Matched ${matchedImgs.length} images -> ${matchedImgs.map(m => m.savedImage).join(', ')}`);
  }
}
