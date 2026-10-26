const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { PDFParse } = require('pdf-parse');

// 1. Load .env configuration
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

// 2. Determine target external directory
const targetDir = process.env.EXTERNAL_DOCS_DIR || process.argv[2] || 'D:\\Project\\helpdesk2\\storage\\app\\private';
const OUTPUT_DATA = path.resolve(__dirname, '..', 'data', 'external-documents.json');
const OUTPUT_LIB = path.resolve(__dirname, '..', 'src', 'lib', 'data', 'external-documents.json');

console.log('====================================================');
console.log(' External Document Indexer for AI Copilot');
console.log(' Target Folder :', targetDir);
console.log('====================================================');

if (!fs.existsSync(targetDir)) {
  console.error(`\n[ERROR] Target folder does not exist: ${targetDir}`);
  console.log('Please set EXTERNAL_DOCS_DIR in .env or provide a valid path as argument.');
  process.exit(1);
}

// Directories to ignore
const IGNORE_DIRS = new Set([
  '.thumbnails',
  'trash',
  'chunks',
  'livewire-chunks',
  'livewire-tmp',
  '.git',
  'node_modules',
  '.temp_fsd'
]);

// Allowed document extensions
const ALLOWED_EXTS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.xls',
  '.pptx',
  '.txt',
  '.csv',
  '.sql',
  '.md',
  '.json'
]);

// Skip files larger than 25MB (usually huge raw telemetry or binary dumps)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Recursively collect candidate files
function scanDirectory(dir, baseDir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return fileList;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name.toLowerCase())) continue;
      scanDirectory(fullPath, baseDir, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTS.has(ext)) {
        try {
          const stat = fs.statSync(fullPath);
          fileList.push({
            fullPath,
            relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
            fileName: entry.name,
            ext,
            size: stat.size,
            mtime: stat.mtime
          });
        } catch (_) {}
      }
    }
  }
  return fileList;
}

// Mute verbose PDF.js console warnings during extraction
function withMutedWarnings(fn) {
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = origWarn;
  }
}

async function extractPdfText(filePath) {
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse(new Uint8Array(buf));
    await parser.load();
    const textObj = await parser.getText();
    const text = (textObj && textObj.text) ? textObj.text : '';
    if (typeof parser.destroy === 'function') {
      try { await parser.destroy(); } catch (_) {}
    }
    return text;
  } finally {
    console.warn = origWarn;
  }
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

function extractExcelText(filePath) {
  // Read max 80 rows per sheet to keep extraction fast and context relevant
  const wb = XLSX.readFile(filePath, { sheetRows: 80, dense: true });
  const parts = [];
  const maxSheets = Math.min(wb.SheetNames.length, 12);
  for (let s = 0; s < maxSheets; s++) {
    const sheetName = wb.SheetNames[s];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv && csv.trim()) {
      parts.push(`[Sheet: ${sheetName}]\n${csv.trim().substring(0, 3000)}`);
    }
  }
  return parts.join('\n\n');
}

async function extractPptxText(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });

  const parts = [];
  const maxSlides = Math.min(slideFiles.length, 30);
  for (let i = 0; i < maxSlides; i++) {
    const sf = slideFiles[i];
    const xml = await zip.files[sf].async('string');
    const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
    const slideText = matches.map(m => m.replace(/<\/?[^>]+(>|$)/g, '').trim()).filter(Boolean).join(' ');
    if (slideText) {
      parts.push(`[Slide ${i + 1}] ${slideText}`);
    }
  }
  return parts.join('\n\n');
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '') // remove null bytes
    .replace(/[ \t]+/g, ' ') // collapse multi-spaces
    .replace(/\n{3,}/g, '\n\n') // collapse multiple empty lines
    .trim();
}

async function run() {
  const startTime = Date.now();
  console.log('Memindai direktori dokumen...');
  const allFiles = scanDirectory(targetDir, targetDir);
  console.log(`Ditemukan ${allFiles.length} berkas potensial.`);

  const stats = {
    total: allFiles.length,
    success: 0,
    skippedSize: 0,
    failed: 0,
    byExt: {}
  };

  const documents = [];

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    stats.byExt[file.ext] = (stats.byExt[file.ext] || 0) + 1;

    if (file.size > MAX_FILE_SIZE) {
      stats.skippedSize++;
      continue;
    }

    try {
      let rawText = '';
      if (file.ext === '.pdf') {
        rawText = await extractPdfText(file.fullPath);
      } else if (file.ext === '.docx') {
        rawText = await extractDocxText(file.fullPath);
      } else if (file.ext === '.xlsx' || file.ext === '.xls') {
        rawText = extractExcelText(file.fullPath);
      } else if (file.ext === '.pptx') {
        rawText = await extractPptxText(file.fullPath);
      } else {
        // Plain text, SQL, Markdown, CSV, JSON
        rawText = fs.readFileSync(file.fullPath, 'utf8');
      }

      const text = cleanText(rawText);
      if (!text || text.length < 5) {
        continue;
      }

      const title = path.basename(file.fileName, file.ext).replace(/[-_]+/g, ' ').trim();
      const folderParts = path.dirname(file.relativePath).split('/').filter(p => p && p !== '.');
      const category = folderParts.length > 0 ? folderParts.join(' / ') : 'General';
      const id = 'ext_' + crypto.createHash('md5').update(file.relativePath).digest('hex').substring(0, 12);

      // Cap content length per document to 15,000 characters
      const cappedContent = text.length > 15000 
        ? text.substring(0, 15000) + '\n\n[...Konten dokumen dipotong untuk batas memori context...]' 
        : text;
      const snippet = text.substring(0, 260).replace(/\n/g, ' ').trim();

      const tags = [
        file.ext.replace('.', '').toUpperCase(),
        ...folderParts.map(p => p.toLowerCase()),
        ...title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      ].slice(0, 8);

      documents.push({
        id,
        slug: `external/${id}`,
        section: 'EXTERNAL',
        category: category,
        title: title || file.fileName,
        fileName: file.fileName,
        relativePath: file.relativePath,
        extension: file.ext,
        sizeBytes: file.size,
        updatedAt: file.mtime.toISOString(),
        snippet: snippet,
        tags: Array.from(new Set(tags)),
        content: cappedContent
      });

      stats.success++;
      if ((i + 1) % 20 === 0 || i === allFiles.length - 1) {
        process.stdout.write(`\rProgres pemrosesan: ${i + 1}/${allFiles.length} berkas...`);
      }
    } catch (err) {
      stats.failed++;
    }
  }

  console.log('\n\nMenyimpan berkas indeks dokumen...');

  fs.mkdirSync(path.dirname(OUTPUT_DATA), { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_LIB), { recursive: true });

  const jsonStr = JSON.stringify(documents, null, 2);
  fs.writeFileSync(OUTPUT_DATA, jsonStr, 'utf8');
  fs.writeFileSync(OUTPUT_LIB, jsonStr, 'utf8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeMb = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(' Selesai Pengindeksan Dokumen!');
  console.log(` Durasi              : ${durationSec} detik`);
  console.log(` Dokumen Terindeks   : ${documents.length} berkas`);
  console.log(` Berkas Dilewati     : ${stats.skippedSize} (>25MB), ${stats.failed} (non-teks/error)`);
  console.log(` Ukuran Indeks JSON  : ${sizeMb} MB`);
  console.log(` Lokasi Output       :`);
  console.log(`   - ${OUTPUT_DATA}`);
  console.log(`   - ${OUTPUT_LIB}`);
  console.log(' Komposisi Ekstensi  :');
  for (const [ext, count] of Object.entries(stats.byExt)) {
    console.log(`   - ${ext.padEnd(7)} : ${count} berkas`);
  }
  console.log('====================================================');
}

run().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
