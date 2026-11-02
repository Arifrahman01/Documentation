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

// 2. Parse CLI Arguments
const args = process.argv.slice(2);
let customDir = null;
let selectedTypesArg = null;
let forceFullReindex = false;
let checkpointInterval = 20;

for (const arg of args) {
  if (arg.startsWith('--types=')) {
    selectedTypesArg = arg.slice(8).toLowerCase().trim();
  } else if (arg === '--force' || arg === '--no-cache') {
    forceFullReindex = true;
  } else if (arg.startsWith('--checkpoint=')) {
    const val = parseInt(arg.slice(13), 10);
    if (!isNaN(val) && val > 0) checkpointInterval = val;
  } else if (arg.startsWith('--dir=')) {
    customDir = arg.slice(6).trim();
  } else if (!arg.startsWith('--') && !customDir) {
    customDir = arg;
  }
}

// 3. Document Extension Mapping
const EXT_MAP = {
  pdf: ['.pdf'],
  docx: ['.docx', '.doc'],
  xlsx: ['.xlsx', '.xls'],
  pptx: ['.pptx', '.ppt'],
  txt: ['.txt', '.md', '.csv']
};

let ALLOWED_EXTS = new Set();
if (selectedTypesArg) {
  const types = selectedTypesArg.split(',').map(t => t.trim());
  for (const t of types) {
    if (EXT_MAP[t]) {
      EXT_MAP[t].forEach(ext => ALLOWED_EXTS.add(ext));
    } else if (t.startsWith('.')) {
      ALLOWED_EXTS.add(t);
    } else {
      ALLOWED_EXTS.add('.' + t);
    }
  }
} else {
  // Default: Dokumen resmi PDF, Word & Excel
  ['pdf', 'docx', 'xlsx', 'pptx'].forEach(t => {
    EXT_MAP[t].forEach(ext => ALLOWED_EXTS.add(ext));
  });
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

// 4. Determine Target & Output Directories
const targetDir = customDir || process.env.EXTERNAL_DOCS_DIR || 'D:\\Project\\helpdesk2\\storage\\app\\private';
const OUTPUT_DATA = path.resolve(__dirname, '..', 'data', 'external-documents.json');
const OUTPUT_LIB = path.resolve(__dirname, '..', 'src', 'lib', 'data', 'external-documents.json');
const STATUS_FILE = path.resolve(__dirname, '..', 'data', 'sync-status.json');

console.log('====================================================');
console.log(' External Document Indexer for AI Copilot');
console.log(' Target Folder   :', targetDir);
console.log(' Jenis Dokumen   :', Array.from(ALLOWED_EXTS).join(', '));
console.log(' Mode Sinkron    :', forceFullReindex ? 'Full Re-index (Paksa Semua)' : 'Inkremental / Cepat (Dengan Cache)');
console.log(' Checkpoint Tiap :', checkpointInterval, 'berkas');
console.log('====================================================');

if (!fs.existsSync(targetDir)) {
  console.error(`\n[ERROR] Target folder tidak ditemukan: ${targetDir}`);
  process.exit(1);
}

// Skip files larger than 25MB
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

// Extractors
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
  const wb = XLSX.readFile(filePath, { sheetRows: 150, dense: true });
  const parts = [];
  const maxSheets = Math.min(wb.SheetNames.length, 15);
  for (let s = 0; s < maxSheets; s++) {
    const sheetName = wb.SheetNames[s];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv && csv.trim()) {
      parts.push(`[Sheet: ${sheetName}]\n${csv.trim().substring(0, 6000)}`);
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
    .replace(/\0/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Checkpoint Saver (Anti-Data Loss on Abort/Crash)
function saveCheckpoint(docs, stats) {
  try {
    fs.mkdirSync(path.dirname(OUTPUT_DATA), { recursive: true });
    fs.mkdirSync(path.dirname(OUTPUT_LIB), { recursive: true });
    const jsonStr = JSON.stringify(docs, null, 2);
    fs.writeFileSync(OUTPUT_DATA, jsonStr, 'utf8');
    fs.writeFileSync(OUTPUT_LIB, jsonStr, 'utf8');

    // Save lightweight sync status
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      isSyncRunning: stats.isRunning,
      pid: process.pid,
      total: stats.total,
      processed: stats.processed,
      success: docs.length,
      cached: stats.cached,
      newOrUpdated: stats.newOrUpdated,
      lastCheckpoint: new Date().toISOString()
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[CHECKPOINT WARNING]:', err.message);
  }
}

// Graceful Shutdown on SIGTERM / SIGINT
let isShuttingDown = false;
let currentDocuments = [];
let currentStats = { isRunning: true, total: 0, processed: 0, cached: 0, newOrUpdated: 0 };

function handleTerminationSignal(sig) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n\n[INFO] Sinyal ${sig} diterima. Menyimpan checkpoint dokumen...`);
  currentStats.isRunning = false;
  saveCheckpoint(currentDocuments, currentStats);
  console.log(`[INFO] Checkpoint berhasil disimpan (${currentDocuments.length} dokumen). Proses berhenti aman.`);
  process.exit(0);
}

process.on('SIGTERM', () => handleTerminationSignal('SIGTERM'));
process.on('SIGINT', () => handleTerminationSignal('SIGINT'));

async function run() {
  const startTime = Date.now();
  console.log('Memindai direktori dokumen sesuai filter jenis...');
  const allFiles = scanDirectory(targetDir, targetDir);
  console.log(`Ditemukan ${allFiles.length} berkas kandidat.`);

  // Load Existing Index for Smart Incremental Caching
  const existingDocsMap = new Map();
  if (!forceFullReindex && fs.existsSync(OUTPUT_DATA)) {
    try {
      const raw = fs.readFileSync(OUTPUT_DATA, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const d of parsed) {
          if (d.relativePath) {
            existingDocsMap.set(d.relativePath, d);
          }
        }
      }
      console.log(`Memuat cache inkremental: ${existingDocsMap.size} dokumen sebelumnya tersedia.`);
    } catch (_) {}
  }

  const stats = {
    isRunning: true,
    total: allFiles.length,
    processed: 0,
    success: 0,
    cached: 0,
    newOrUpdated: 0,
    skippedSize: 0,
    failed: 0,
    byExt: {}
  };
  currentStats = stats;

  const documents = [];
  currentDocuments = documents;

  for (let i = 0; i < allFiles.length; i++) {
    if (isShuttingDown) break;

    const file = allFiles[i];
    stats.processed = i + 1;
    stats.byExt[file.ext] = (stats.byExt[file.ext] || 0) + 1;

    if (file.size > MAX_FILE_SIZE) {
      stats.skippedSize++;
      continue;
    }

    // Smart Cache Hit Check (0ms per unchanged file)
    const existing = existingDocsMap.get(file.relativePath);
    if (
      existing &&
      existing.sizeBytes === file.size &&
      existing.updatedAt === file.mtime.toISOString()
    ) {
      documents.push(existing);
      stats.cached++;
      stats.success++;

      if ((i + 1) % 25 === 0 || i === allFiles.length - 1) {
        const pct = Math.round(((i + 1) / allFiles.length) * 100);
        process.stdout.write(`\rProgres pemrosesan: ${i + 1}/${allFiles.length} (${pct}%) [${stats.cached} dari cache, ${stats.newOrUpdated} baru]...`);
      }
      continue;
    }

    // New or Modified File -> Extract text
    try {
      let rawText = '';
      if (file.ext === '.pdf') {
        rawText = await extractPdfText(file.fullPath);
      } else if (file.ext === '.docx' || file.ext === '.doc') {
        rawText = await extractDocxText(file.fullPath);
      } else if (file.ext === '.xlsx' || file.ext === '.xls') {
        rawText = extractExcelText(file.fullPath);
      } else if (file.ext === '.pptx' || file.ext === '.ppt') {
        rawText = await extractPptxText(file.fullPath);
      } else {
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

      const cappedContent = text.length > 45000 
        ? text.substring(0, 45000) + '\n\n[...Konten dokumen dipotong pada 45.000 karakter...]' 
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

      stats.newOrUpdated++;
      stats.success++;

      const pct = Math.round(((i + 1) / allFiles.length) * 100);
      process.stdout.write(`\rProgres pemrosesan: ${i + 1}/${allFiles.length} (${pct}%) [${stats.cached} dari cache, ${stats.newOrUpdated} baru]...`);

      // Auto-save checkpoint every interval
      if (stats.newOrUpdated > 0 && stats.newOrUpdated % checkpointInterval === 0) {
        saveCheckpoint(documents, stats);
      }
    } catch (err) {
      stats.failed++;
    }
  }

  stats.isRunning = false;
  console.log('\n\nMenyimpan berkas indeks dokumen final...');
  saveCheckpoint(documents, stats);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const jsonStr = JSON.stringify(documents, null, 2);
  const sizeMb = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(' Selesai Pengindeksan Dokumen!');
  console.log(` Durasi              : ${durationSec} detik`);
  console.log(` Total Terindeks     : ${documents.length} berkas`);
  console.log(`   - Dari Cache      : ${stats.cached} berkas (0 detik)`);
  console.log(`   - Ekstraksi Baru  : ${stats.newOrUpdated} berkas`);
  console.log(` Berkas Dilewati     : ${stats.skippedSize} (>25MB), ${stats.failed} (non-teks/error)`);
  console.log(` Ukuran Indeks JSON  : ${sizeMb} MB`);
  console.log(` Komposisi Ekstensi  :`);
  for (const [ext, count] of Object.entries(stats.byExt)) {
    console.log(`   - ${ext.padEnd(7)} : ${count} berkas`);
  }
  console.log('====================================================');
}

run().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
