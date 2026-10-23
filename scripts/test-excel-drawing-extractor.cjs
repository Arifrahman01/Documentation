const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';
const OUTPUT_DIR = path.resolve(__dirname, '../static/img/sac/builder');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Find all xlsx files
const folders = fs.readdirSync(BASE_DIR).filter(f => fs.statSync(path.join(BASE_DIR, f)).isDirectory());
const allXlsx = [];
for (const f of folders) {
  const p = path.join(BASE_DIR, f);
  const files = fs.readdirSync(p).filter(x => x.startsWith('Story Builder Spec') && x.endsWith('.xlsx'));
  for (const file of files) {
    allXlsx.push({
      folder: f,
      file: file,
      fullPath: path.join(p, file)
    });
  }
}

console.log(`Found ${allXlsx.length} Story Builder Spec Excel files.`);
