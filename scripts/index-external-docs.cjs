const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { PDFParse } = require('pdf-parse');

// 0. Lower OS Process Priority immediately so laptop UI / Browser never freezes
try {
  if (os.constants && os.constants.priority) {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  }
} catch (_) {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout (${ms / 1000}s) saat memproses ${label}`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function triggerGc() {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
    }
  } catch (_) {}
}

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
let checkpointInterval = 10;
let batchLimit = 0; // 0 = process all with throttling, >0 = max new extractions per run
let throttleDelayMs = 180; // Pause between each new file extraction so CPU/Disk stays cool

for (const arg of args) {
  if (arg.startsWith('--types=')) {
    selectedTypesArg = arg.slice(8).toLowerCase().trim();
  } else if (arg === '--force' || arg === '--no-cache') {
    forceFullReindex = true;
  } else if (arg.startsWith('--checkpoint=')) {
    const val = parseInt(arg.slice(13), 10);
    if (!isNaN(val) && val > 0) checkpointInterval = val;
  } else if (arg.startsWith('--batch=')) {
    const val = parseInt(arg.slice(8), 10);
    if (!isNaN(val) && val >= 0) batchLimit = val;
  } else if (arg.startsWith('--delay=')) {
    const val = parseInt(arg.slice(8), 10);
    if (!isNaN(val) && val >= 20) throttleDelayMs = val;
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
  const types = selectedTypesArg.split(',').map((t) => t.trim());
  for (const t of types) {
    if (EXT_MAP[t]) {
      EXT_MAP[t].forEach((ext) => ALLOWED_EXTS.add(ext));
    } else if (t.startsWith('.')) {
      ALLOWED_EXTS.add(t);
    } else {
      ALLOWED_EXTS.add('.' + t);
    }
  }
} else {
  ['pdf', 'docx', 'xlsx', 'pptx'].forEach((t) => {
    EXT_MAP[t].forEach((ext) => ALLOWED_EXTS.add(ext));
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
  '.temp_fsd',
  'temp-excel-inspect'
]);

// 4. Determine Target & Output Directories
const targetDir =
  customDir || process.env.EXTERNAL_DOCS_DIR || 'D:\\Project\\helpdesk2\\storage\\app\\private';
const OUTPUT_DATA = path.resolve(__dirname, '..', 'data', 'external-documents.json');
const OUTPUT_LIB = path.resolve(__dirname, '..', 'src', 'lib', 'data', 'external-documents.json');
const STATUS_FILE = path.resolve(__dirname, '..', 'data', 'sync-status.json');

console.log('====================================================');
console.log(' External Document Indexer (Low-CPU & Anti-Hang Mode)');
console.log(' Target Folder   :', targetDir);
console.log(' Jenis Dokumen   :', Array.from(ALLOWED_EXTS).join(', '));
console.log(
  ' Mode Sinkron    :',
  forceFullReindex ? 'Full Re-index (Bertahap Aman)' : 'Inkremental Cepat (Smart Cache)'
);
console.log(
  ' Throttling CPU  :',
  `Jeda ${throttleDelayMs}ms/berkas + Auto GC` + (batchLimit > 0 ? ` (Batas ${batchLimit} berkas baru)` : '')
);
console.log('====================================================');

if (!fs.existsSync(targetDir)) {
  console.error(`\n[ERROR] Target folder tidak ditemukan: ${targetDir}`);
  process.exit(1);
}

// Size limits per format to prevent RAM spikes on laptop
const MAX_PDF_DOCX_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_EXCEL_PPTX_SIZE = 12 * 1024 * 1024; // 12 MB (large spreadsheets unpack huge XML in RAM)
const PER_FILE_TIMEOUT_MS = 12000; // 12 seconds max per file

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

// Atomic JSON write helper to avoid partial file reads or watcher glitches
function atomicWriteFile(filePath, contentStr) {
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmpPath, contentStr, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (_) {
    try {
      fs.writeFileSync(filePath, contentStr, 'utf8');
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

// Extractors with strict memory cleanup
async function extractPdfText(filePath) {
  const origWarn = console.warn;
  console.warn = () => {};
  let buf = null;
  let parser = null;
  try {
    buf = fs.readFileSync(filePath);
    parser = new PDFParse(new Uint8Array(buf));
    buf = null; // Release original buffer reference immediately
    await parser.load();
    const textObj = await parser.getText();
    const text = textObj && textObj.text ? textObj.text : '';
    return text;
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch (_) {}
    }
    parser = null;
    buf = null;
    console.warn = origWarn;
  }
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

async function extractExcelText(filePath) {
  // Yield before synchronous SheetJS parse
  await sleep(10);
  const wb = XLSX.readFile(filePath, {
    sheetRows: 100,
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellNF: false,
    bookDeps: false,
    bookProps: false
  });
  const parts = [];
  const maxSheets = Math.min(wb.SheetNames.length, 10);
  for (let s = 0; s < maxSheets; s++) {
    const sheetName = wb.SheetNames[s];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv && csv.trim()) {
      parts.push(`[Sheet: ${sheetName}]\n${csv.trim().substring(0, 5000)}`);
    }
  }
  return parts.join('\n\n');
}

async function extractPptxText(filePath) {
  let buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  buf = null;
  const slideFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith('ppt/slides/slide') && f.endsWith('.xml')
  );
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });

  const parts = [];
  const maxSlides = Math.min(slideFiles.length, 25);
  for (let i = 0; i < maxSlides; i++) {
    const sf = slideFiles[i];
    const xml = await zip.files[sf].async('string');
    const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
    const slideText = matches
      .map((m) => m.replace(/<\/?[^>]+(>|$)/g, '').trim())
      .filter(Boolean)
      .join(' ');
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

function writeStatusFile(stats, currentFile = '') {
  try {
    const payload = JSON.stringify(
      {
        isSyncRunning: stats.isRunning,
        pid: process.pid,
        total: stats.total,
        processed: stats.processed,
        success: stats.success,
        cached: stats.cached,
        newOrUpdated: stats.newOrUpdated,
        failed: stats.failed || 0,
        currentFile,
        lastCheckpoint: new Date().toISOString()
      },
      null,
      2
    );
    atomicWriteFile(STATUS_FILE, payload);
  } catch (_) {}
}

// Checkpoint Saver: During run, write only to OUTPUT_DATA to avoid triggering Vite HMR in src/lib/data
function saveCheckpoint(docs, stats, isFinal = false) {
  try {
    const jsonStr = JSON.stringify(docs, null, 2);
    atomicWriteFile(OUTPUT_DATA, jsonStr);
    if (isFinal) {
      atomicWriteFile(OUTPUT_LIB, jsonStr);
    }
    writeStatusFile(stats);
  } catch (err) {
    console.error('[CHECKPOINT WARNING]:', err.message);
  }
}

// Graceful Shutdown on SIGTERM / SIGINT
let isShuttingDown = false;
let currentDocuments = [];
let currentStats = { isRunning: true, total: 0, processed: 0, success: 0, cached: 0, newOrUpdated: 0, failed: 0 };

function handleTerminationSignal(sig) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[INFO] Sinyal ${sig} diterima. Menyimpan checkpoint dokumen secara aman...`);
  currentStats.isRunning = false;
  saveCheckpoint(currentDocuments, currentStats, true);
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
  const existingSource = fs.existsSync(OUTPUT_DATA)
    ? OUTPUT_DATA
    : fs.existsSync(OUTPUT_LIB)
      ? OUTPUT_LIB
      : null;

  if (existingSource) {
    try {
      const raw = fs.readFileSync(existingSource, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const d of parsed) {
          if (d.relativePath) {
            existingDocsMap.set(d.relativePath, d);
          }
        }
      }
      if (!forceFullReindex) {
        console.log(`Memuat cache inkremental: ${existingDocsMap.size} dokumen sebelumnya tersedia.`);
      }
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

  // Preserve already-indexed documents whose extension is outside current ALLOWED_EXTS filter
  for (const [, existingDoc] of existingDocsMap.entries()) {
    if (existingDoc.extension && !ALLOWED_EXTS.has(existingDoc.extension.toLowerCase())) {
      documents.push(existingDoc);
    }
  }

  writeStatusFile(stats, 'Memulai pemindaian...');

  let batchCapReached = false;

  for (let i = 0; i < allFiles.length; i++) {
    if (isShuttingDown) break;

    const file = allFiles[i];
    stats.processed = i + 1;
    stats.byExt[file.ext] = (stats.byExt[file.ext] || 0) + 1;

    const isHeavyFormat = file.ext === '.xlsx' || file.ext === '.xls' || file.ext === '.pptx' || file.ext === '.ppt';
    const maxAllowedBytes = isHeavyFormat ? MAX_EXCEL_PPTX_SIZE : MAX_PDF_DOCX_SIZE;

    if (file.size > maxAllowedBytes) {
      stats.skippedSize++;
      continue;
    }

    // Smart Cache Hit Check (0ms per unchanged file)
    const existing = existingDocsMap.get(file.relativePath);
    if (
      !forceFullReindex &&
      existing &&
      existing.sizeBytes === file.size &&
      existing.updatedAt === file.mtime.toISOString()
    ) {
      documents.push(existing);
      stats.cached++;
      stats.success++;

      if ((i + 1) % 30 === 0 || i === allFiles.length - 1) {
        const pct = Math.round(((i + 1) / allFiles.length) * 100);
        console.log(
          `[PROGRES] ${i + 1}/${allFiles.length} (${pct}%) — ${stats.cached} cache, ${stats.newOrUpdated} diekstrak`
        );
        writeStatusFile(stats, file.fileName);
        await sleep(15); // Yield event loop
      }
      continue;
    }

    // If user configured a batch limit and we reached it, keep existing cached copy (if any) for remaining files
    if (batchLimit > 0 && stats.newOrUpdated >= batchLimit) {
      if (!batchCapReached) {
        batchCapReached = true;
        console.log(
          `[INFO] Batas batch (${batchLimit} berkas baru) tercapai. Menyimpan hasil dan mempertahankan cache sisanya...`
        );
      }
      if (existing) {
        documents.push(existing);
        stats.cached++;
        stats.success++;
      }
      continue;
    }

    // New or Modified File -> Extract text sequentially with timeout & cool-down
    try {
      writeStatusFile(stats, file.fileName);

      const rawText = await withTimeout(
        (async () => {
          if (file.ext === '.pdf') {
            return await extractPdfText(file.fullPath);
          } else if (file.ext === '.docx' || file.ext === '.doc') {
            return await extractDocxText(file.fullPath);
          } else if (file.ext === '.xlsx' || file.ext === '.xls') {
            return await extractExcelText(file.fullPath);
          } else if (file.ext === '.pptx' || file.ext === '.ppt') {
            return await extractPptxText(file.fullPath);
          } else {
            return fs.readFileSync(file.fullPath, 'utf8');
          }
        })(),
        PER_FILE_TIMEOUT_MS,
        file.fileName
      );

      const text = cleanText(rawText);
      if (!text || text.length < 5) {
        await sleep(50);
        continue;
      }

      const title = path.basename(file.fileName, file.ext).replace(/[-_]+/g, ' ').trim();
      const folderParts = path
        .dirname(file.relativePath)
        .split('/')
        .filter((p) => p && p !== '.');
      const category = folderParts.length > 0 ? folderParts.join(' / ') : 'General';
      const id =
        'ext_' + crypto.createHash('md5').update(file.relativePath).digest('hex').substring(0, 12);

      const cappedContent =
        text.length > 45000
          ? text.substring(0, 45000) + '\n\n[...Konten dokumen dipotong pada 45.000 karakter...]'
          : text;
      const snippet = text.substring(0, 260).replace(/\n/g, ' ').trim();

      const tags = [
        file.ext.replace('.', '').toUpperCase(),
        ...folderParts.map((p) => p.toLowerCase()),
        ...title
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
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
      console.log(
        `[PROGRES] ${i + 1}/${allFiles.length} (${pct}%) — Diekstrak: ${file.fileName} (${stats.newOrUpdated} baru, ${stats.cached} cache)`
      );

      // Periodic Checkpoint & Garbage Collection
      if (stats.newOrUpdated % 5 === 0) {
        triggerGc();
        await sleep(450); // Extra cool-down every 5 extracted files
      }
      if (stats.newOrUpdated % checkpointInterval === 0) {
        saveCheckpoint(documents, stats, false);
      }

      // Cool-down delay between files so CPU & Disk never spike to 100%
      await sleep(throttleDelayMs);
    } catch (err) {
      stats.failed++;
      console.log(`[SKIP] Melewati ${file.fileName}: ${err.message || 'Format tidak terbaca'}`);
      triggerGc();
      await sleep(100);
    }
  }

  stats.isRunning = false;
  triggerGc();
  console.log('\nMenyimpan berkas indeks dokumen final...');
  saveCheckpoint(documents, stats, true);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const jsonStr = JSON.stringify(documents, null, 2);
  const sizeMb = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(' Selesai Pengindeksan Dokumen!');
  console.log(` Durasi              : ${durationSec} detik`);
  console.log(` Total Terindeks     : ${documents.length} berkas`);
  console.log(`   - Dari Cache      : ${stats.cached} berkas`);
  console.log(`   - Ekstraksi Baru  : ${stats.newOrUpdated} berkas`);
  console.log(` Berkas Dilewati     : ${stats.skippedSize} (ukuran besar), ${stats.failed} (non-teks/skip)`);
  console.log(` Ukuran Indeks JSON  : ${sizeMb} MB`);
  console.log('====================================================');
}

run().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  currentStats.isRunning = false;
  writeStatusFile(currentStats, 'Error');
  process.exit(1);
});
