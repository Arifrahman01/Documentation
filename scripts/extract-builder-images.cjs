const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';
const OUTPUT_DIR = path.resolve(__dirname, '../static/img/sac/builder');
const TEMP_BASE = path.resolve(__dirname, '../temp-excel-extract');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (fs.existsSync(TEMP_BASE)) fs.rmSync(TEMP_BASE, { recursive: true, force: true });
fs.mkdirSync(TEMP_BASE, { recursive: true });

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

const manifest = {};
let totalImagesCopied = 0;

for (const item of allXlsx) {
  const fileKey = `${item.folder}/${item.file}`;
  manifest[fileKey] = {};

  const fileTempDir = path.join(TEMP_BASE, item.file.replace(/[^a-zA-Z0-9]/g, '_'));
  fs.mkdirSync(fileTempDir, { recursive: true });

  try {
    execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${item.fullPath.replace(/'/g, "''")}', '${fileTempDir.replace(/'/g, "''")}')"`);
  } catch (err) {
    console.error(`Failed to extract ${item.file}:`, err.message);
    continue;
  }

  const xlDir = path.join(fileTempDir, 'xl');
  if (!fs.existsSync(xlDir)) continue;

  const wbXmlPath = path.join(xlDir, 'workbook.xml');
  const wbRelsPath = path.join(xlDir, '_rels', 'workbook.xml.rels');
  if (!fs.existsSync(wbXmlPath) || !fs.existsSync(wbRelsPath)) continue;

  const wbXml = fs.readFileSync(wbXmlPath, 'utf8');
  const wbRelsXml = fs.readFileSync(wbRelsPath, 'utf8');

  // Map rId -> target (worksheets/sheetN.xml)
  const relIdToSheetFile = {};
  for (const m of wbRelsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relIdToSheetFile[m[1]] = m[2]; // e.g. worksheets/sheet1.xml
  }

  // Map sheet name -> worksheet file
  const sheetToWorksheet = {};
  for (const m of wbXml.matchAll(/<sheet\s+name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const sheetName = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const rId = m[2];
    let wsFile = relIdToSheetFile[rId];
    if (wsFile) {
      if (wsFile.startsWith('/xl/')) wsFile = wsFile.replace('/xl/', '');
      sheetToWorksheet[sheetName] = wsFile;
    }
  }

  // Process each sheet
  for (const [sheetName, wsFile] of Object.entries(sheetToWorksheet)) {
    manifest[fileKey][sheetName] = [];

    const wsFileName = path.basename(wsFile);
    const wsRelsPath = path.join(xlDir, 'worksheets', '_rels', `${wsFileName}.rels`);
    if (!fs.existsSync(wsRelsPath)) continue;

    const wsRelsXml = fs.readFileSync(wsRelsPath, 'utf8');
    // Find drawing relationship
    const drawingMatch = wsRelsXml.match(/Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/drawing"[^>]*Target="([^"]+)"/);
    if (!drawingMatch) continue;

    let drawingRel = drawingMatch[1]; // e.g. ../drawings/drawing1.xml
    const drawingFileName = path.basename(drawingRel);
    const drawingXmlPath = path.join(xlDir, 'drawings', drawingFileName);
    const drawingRelsPath = path.join(xlDir, 'drawings', '_rels', `${drawingFileName}.rels`);

    if (!fs.existsSync(drawingXmlPath) || !fs.existsSync(drawingRelsPath)) continue;

    const drawingXml = fs.readFileSync(drawingXmlPath, 'utf8');
    const drawingRelsXml = fs.readFileSync(drawingRelsPath, 'utf8');

    // Map rId -> image file in media
    const drawingRelMap = {};
    for (const m of drawingRelsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      drawingRelMap[m[1]] = path.basename(m[2]);
    }

    // Match all anchors
    const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
    for (const anchorMatch of drawingXml.matchAll(anchorRegex)) {
      const block = anchorMatch[1];
      const colMatch = block.match(/<xdr:col>(\d+)<\/xdr:col>/);
      const rowMatch = block.match(/<xdr:row>(\d+)<\/xdr:row>/);
      const rIdMatch = block.match(/r:embed="([^"]+)"/);
      const nameMatch = block.match(/name="([^"]+)"/);

      if (!rIdMatch || !rowMatch) continue;

      const imgBasename = drawingRelMap[rIdMatch[1]];
      if (!imgBasename) continue;

      const srcImgPath = path.join(xlDir, 'media', imgBasename);
      if (!fs.existsSync(srcImgPath)) continue;

      const rowIdx = parseInt(rowMatch[1], 10);
      const colIdx = colMatch ? parseInt(colMatch[1], 10) : 0;

      // Safe filename
      const safeFolder = item.folder.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const safeFile = item.file.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const safeSheet = sheetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const destImgName = `${safeFolder}_${safeSheet}_row${rowIdx}_${imgBasename}`;
      const destPath = path.join(OUTPUT_DIR, destImgName);

      fs.copyFileSync(srcImgPath, destPath);
      totalImagesCopied++;

      manifest[fileKey][sheetName].push({
        row: rowIdx,
        col: colIdx,
        originalImage: imgBasename,
        savedImage: `/img/sac/builder/${destImgName}`,
        name: nameMatch ? nameMatch[1] : 'Widget Screenshot'
      });
    }
  }
}

// Clean up temp dir
if (fs.existsSync(TEMP_BASE)) fs.rmSync(TEMP_BASE, { recursive: true, force: true });

fs.writeFileSync(
  path.resolve(__dirname, 'builder-images-manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log(`Successfully extracted and copied ${totalImagesCopied} builder images to static/img/sac/builder/`);
