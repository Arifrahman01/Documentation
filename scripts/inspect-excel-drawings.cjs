const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tempDir = path.resolve(__dirname, '../temp-excel-inspect');
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

const sampleXlsx = 'D:\\Jhonlin\\SAP\\SAC\\Document\\1. Finance\\Story Builder Spec - Finance.xlsx';
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${sampleXlsx}', '${tempDir}')"`);

console.log('Unzipped sample excel:');
const xlDir = path.join(tempDir, 'xl');
console.log('xl subdirs:', fs.readdirSync(xlDir));

if (fs.existsSync(path.join(xlDir, 'drawings'))) {
  console.log('drawings:', fs.readdirSync(path.join(xlDir, 'drawings')));
  const dRels = path.join(xlDir, 'drawings', '_rels');
  if (fs.existsSync(dRels)) {
    console.log('drawings/_rels:', fs.readdirSync(dRels));
  }
}

if (fs.existsSync(path.join(xlDir, 'worksheets', '_rels'))) {
  console.log('worksheets/_rels:', fs.readdirSync(path.join(xlDir, 'worksheets', '_rels')));
}

// Check workbook.xml.rels and workbook.xml to see sheet names
const wbXml = fs.readFileSync(path.join(xlDir, 'workbook.xml'), 'utf8');
console.log('Workbook sheets:');
const sheetMatches = [...wbXml.matchAll(/<sheet\s+name="([^"]+)"\s+sheetId="([^"]+)"\s+(?:r:id="([^"]+)")?/g)];
sheetMatches.forEach(m => console.log(`  Sheet name: ${m[1]}, id: ${m[2]}, rId: ${m[3]}`));
