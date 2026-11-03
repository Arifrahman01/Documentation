const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { PDFParse } = require('pdf-parse');

// 0. Lower OS Process Priority immediately so server / laptop UI never freezes
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
const MANIFEST_FILE = path.resolve(__dirname, '..', 'data', 'sync-manifest.json');

console.log('====================================================');
console.log(' External Document Indexer (Smart Cache & Deduplikasi)');
console.log(' Target Folder   :', targetDir);
console.log(' Jenis Dokumen   :', Array.from(ALLOWED_EXTS).join(', '));
console.log(
  ' Mode Sinkron    :',
  forceFullReindex
    ? 'Full Re-index (Ekstraksi Ulang Semua)'
    : 'Inkremental Pintar (Skip File Lama, Kosong & Duplikat)'
);
console.log(
  ' Throttling CPU  :',
  `Jeda ${throttleDelayMs}ms/berkas baru + Auto GC` +
    (batchLimit > 0 ? ` (Batas ${batchLimit} berkas baru)` : '')
);
console.log('====================================================');

if (!fs.existsSync(targetDir)) {
  console.error(`\n[ERROR] Target folder tidak ditemukan: ${targetDir}`);
  process.exit(1);
}

// Size limits per format to prevent RAM spikes
const MAX_PDF_DOCX_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_EXCEL_PPTX_SIZE = 12 * 1024 * 1024; // 12 MB
const PER_FILE_TIMEOUT_MS = 12000; // 12 seconds max per file

function getMtimeSec(dateOrIso) {
  const ms = new Date(dateOrIso).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

function isSameMtimeSec(secA, secB) {
  if (!secA || !secB) return false;
  return Math.abs(secA - secB) <= 2; // 2-second tolerance for filesystem rounding
}

function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}

function computeTextHash(text) {
  return crypto.createHash('md5').update(text || '').digest('hex');
}

// Strip pdf-parse page break markers (e.g. "-- 1 of 3 --") and check if real text exists
function stripPdfPageMarkers(text) {
  if (!text) return '';
  return text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, '').trim();
}

function isMeaningfulText(text) {
  const stripped = stripPdfPageMarkers(text).replace(/\s+/g, '');
  return stripped.length >= 10;
}

// Recursively collect candidate files
function scanDirectory(dir, baseDir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return fileList;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('~$')) continue; // Skip Office temporary lock files
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
            mtime: stat.mtime,
            mtimeSec: getMtimeSec(stat.mtime)
          });
        } catch (_) {}
      }
    }
  }
  return fileList;
}

// Atomic JSON write helper
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

// Load & Save Persistent Sync Manifest (tracks known empty/failed & duplicate files)
function loadSyncManifest() {
  const emptyManifest = {
    version: 1,
    updatedAt: null,
    skippedFiles: {},
    duplicateFiles: {}
  };
  if (forceFullReindex || !fs.existsSync(MANIFEST_FILE)) {
    return emptyManifest;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      skippedFiles: parsed.skippedFiles && typeof parsed.skippedFiles === 'object' ? parsed.skippedFiles : {},
      duplicateFiles: parsed.duplicateFiles && typeof parsed.duplicateFiles === 'object' ? parsed.duplicateFiles : {}
    };
  } catch (_) {
    return emptyManifest;
  }
}

function saveSyncManifest(manifest) {
  try {
    manifest.updatedAt = new Date().toISOString();
    atomicWriteFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  } catch (_) {}
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
    buf = null;
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
  return stripPdfPageMarkers(text)
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
        duplicates: stats.duplicates || 0,
        skippedKnown: stats.skippedKnown || 0,
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

// State references for safe checkpointing without losing unvisited cached files
let isShuttingDown = false;
let currentDocuments = [];
let currentExistingDocsMap = new Map();
let currentProcessedPaths = new Set();
let currentManifest = { version: 1, updatedAt: null, skippedFiles: {}, duplicateFiles: {} };
let currentStats = {
  isRunning: true,
  total: 0,
  processed: 0,
  success: 0,
  cached: 0,
  duplicates: 0,
  skippedKnown: 0,
  newOrUpdated: 0,
  failed: 0
};

/**
 * Builds a complete document list by combining already-processed documents in this run
 * with any not-yet-visited cached documents from existingDocsMap.
 * This guarantees that mid-run checkpoints or SIGTERM stops NEVER lose previously cached docs.
 */
function buildSafeDocumentList(docs, isFinal) {
  if (isFinal) return docs;
  const merged = [...docs];
  const includedPaths = new Set(docs.map((d) => d.relativePath));
  for (const [relPath, cachedDoc] of currentExistingDocsMap.entries()) {
    if (!currentProcessedPaths.has(relPath) && !includedPaths.has(relPath)) {
      merged.push(cachedDoc);
    }
  }
  return merged;
}

function saveCheckpoint(docs, stats, isFinal = false) {
  try {
    const safeDocs = buildSafeDocumentList(docs, isFinal);
    const jsonStr = JSON.stringify(safeDocs, null, 2);
    atomicWriteFile(OUTPUT_DATA, jsonStr);
    if (isFinal) {
      atomicWriteFile(OUTPUT_LIB, jsonStr);
    }
    saveSyncManifest(currentManifest);
    writeStatusFile(stats);
  } catch (err) {
    console.error('[CHECKPOINT WARNING]:', err.message);
  }
}

function handleTerminationSignal(sig) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[INFO] Sinyal ${sig} diterima. Menyimpan seluruh cache & checkpoint secara aman...`);
  currentStats.isRunning = false;
  const safeDocs = buildSafeDocumentList(currentDocuments, false);
  const jsonStr = JSON.stringify(safeDocs, null, 2);
  atomicWriteFile(OUTPUT_DATA, jsonStr);
  atomicWriteFile(OUTPUT_LIB, jsonStr);
  saveSyncManifest(currentManifest);
  writeStatusFile(currentStats);
  console.log(`[INFO] Checkpoint berhasil disimpan (${safeDocs.length} dokumen terjaga). Proses berhenti aman.`);
  process.exit(0);
}

process.on('SIGTERM', () => handleTerminationSignal('SIGTERM'));
process.on('SIGINT', () => handleTerminationSignal('SIGINT'));

async function run() {
  const startTime = Date.now();
  console.log('Memindai direktori dokumen sesuai filter jenis...');
  const allFiles = scanDirectory(targetDir, targetDir);
  console.log(`Ditemukan ${allFiles.length} berkas kandidat di disk.`);

  const activeDiskPaths = new Set(allFiles.map((f) => f.relativePath));
  const manifest = loadSyncManifest();
  currentManifest = manifest;

  // Prune deleted files from manifest
  for (const relPath of Object.keys(manifest.skippedFiles)) {
    if (!activeDiskPaths.has(relPath)) {
      delete manifest.skippedFiles[relPath];
    }
  }
  for (const relPath of Object.keys(manifest.duplicateFiles)) {
    const entry = manifest.duplicateFiles[relPath];
    if (!activeDiskPaths.has(relPath) || !entry || !activeDiskPaths.has(entry.primaryPath)) {
      delete manifest.duplicateFiles[relPath];
    }
  }

  // Load Existing Index for Smart Incremental Caching
  const existingDocsMap = new Map();
  currentExistingDocsMap = existingDocsMap;

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
          if (d && d.relativePath) {
            existingDocsMap.set(d.relativePath, d);
          }
        }
      }
      if (!forceFullReindex) {
        console.log(
          `Memuat cache inkremental: ${existingDocsMap.size} dokumen terindeks, ${Object.keys(manifest.skippedFiles).length} berkas kosong/skip, ${Object.keys(manifest.duplicateFiles).length} berkas duplikat dikenal.`
        );
      }
    } catch (_) {}
  }

  const stats = {
    isRunning: true,
    total: allFiles.length,
    processed: 0,
    success: 0,
    cached: 0,
    duplicates: 0,
    skippedKnown: 0,
    newOrUpdated: 0,
    skippedSize: 0,
    failed: 0,
    byExt: {}
  };
  currentStats = stats;

  const documents = [];
  currentDocuments = documents;
  const processedPaths = new Set();
  currentProcessedPaths = processedPaths;

  // Track unique file hashes & content hashes to prevent re-extracting or indexing duplicate files
  const seenFileHashes = new Map(); // fileHash -> primary relativePath
  const seenContentHashes = new Map(); // contentHash -> primary relativePath

  // Preserve already-indexed documents whose extension is outside current ALLOWED_EXTS filter
  for (const [relPath, existingDoc] of existingDocsMap.entries()) {
    if (existingDoc.extension && !ALLOWED_EXTS.has(existingDoc.extension.toLowerCase())) {
      documents.push(existingDoc);
      processedPaths.add(relPath);
      if (existingDoc.fileHash) seenFileHashes.set(existingDoc.fileHash, relPath);
      if (existingDoc.contentHash) seenContentHashes.set(existingDoc.contentHash, relPath);
    }
  }

  writeStatusFile(stats, 'Memulai pemindaian...');

  let batchCapReached = false;

  for (let i = 0; i < allFiles.length; i++) {
    if (isShuttingDown) break;

    const file = allFiles[i];
    processedPaths.add(file.relativePath);
    stats.processed = i + 1;
    stats.byExt[file.ext] = (stats.byExt[file.ext] || 0) + 1;

    const isHeavyFormat =
      file.ext === '.xlsx' || file.ext === '.xls' || file.ext === '.pptx' || file.ext === '.ppt';
    const maxAllowedBytes = isHeavyFormat ? MAX_EXCEL_PPTX_SIZE : MAX_PDF_DOCX_SIZE;

    if (file.size === 0 || file.size > maxAllowedBytes) {
      stats.skippedSize++;
      continue;
    }

    const existing = existingDocsMap.get(file.relativePath);

    if (!forceFullReindex) {
      // 1. Check if this file is already known as a duplicate in manifest (0ms, no disk read)
      const knownDup = manifest.duplicateFiles[file.relativePath];
      if (
        knownDup &&
        knownDup.sizeBytes === file.size &&
        isSameMtimeSec(knownDup.mtimeSec, file.mtimeSec) &&
        activeDiskPaths.has(knownDup.primaryPath)
      ) {
        stats.duplicates++;
        stats.cached++;
        if ((i + 1) % 40 === 0 || i === allFiles.length - 1) {
          writeStatusFile(stats, file.fileName);
          await sleep(10);
        }
        continue;
      }

      // 2. Check if this file was previously scanned and found empty/scanned/unreadable (0ms, no disk read)
      const knownSkip = manifest.skippedFiles[file.relativePath];
      if (
        knownSkip &&
        knownSkip.sizeBytes === file.size &&
        isSameMtimeSec(knownSkip.mtimeSec, file.mtimeSec)
      ) {
        stats.skippedKnown++;
        stats.cached++;
        if ((i + 1) % 40 === 0 || i === allFiles.length - 1) {
          writeStatusFile(stats, file.fileName);
          await sleep(10);
        }
        continue;
      }

      // 3. Smart Cache Hit Check for already indexed document (0ms extraction)
      if (
        existing &&
        existing.sizeBytes === file.size &&
        isSameMtimeSec(getMtimeSec(existing.updatedAt), file.mtimeSec)
      ) {
        // Clean up legacy bogus scanned PDF entries (e.g. "-- 1 of 3 --") without re-parsing
        if (!isMeaningfulText(existing.content)) {
          manifest.skippedFiles[file.relativePath] = {
            sizeBytes: file.size,
            mtimeSec: file.mtimeSec,
            reason: 'empty_or_scanned',
            updatedAt: new Date().toISOString()
          };
          stats.skippedKnown++;
          stats.cached++;
          continue;
        }

        // Backfill hashes once for legacy cached items so duplicate detection works across all files
        if (!existing.fileHash) {
          try {
            existing.fileHash = computeFileHash(file.fullPath);
          } catch (_) {}
        }
        if (!existing.contentHash) {
          existing.contentHash = computeTextHash(existing.content);
        }

        // Check if this cached document is actually a duplicate of an earlier document
        const dupPrimaryByFile = existing.fileHash ? seenFileHashes.get(existing.fileHash) : null;
        const dupPrimaryByContent = existing.contentHash
          ? seenContentHashes.get(existing.contentHash)
          : null;
        const primaryPath = dupPrimaryByFile || dupPrimaryByContent;

        if (primaryPath && primaryPath !== file.relativePath) {
          manifest.duplicateFiles[file.relativePath] = {
            sizeBytes: file.size,
            mtimeSec: file.mtimeSec,
            primaryPath,
            fileHash: existing.fileHash || ''
          };
          stats.duplicates++;
          stats.cached++;
          continue;
        }

        if (existing.fileHash) seenFileHashes.set(existing.fileHash, file.relativePath);
        if (existing.contentHash) seenContentHashes.set(existing.contentHash, file.relativePath);

        documents.push(existing);
        stats.cached++;
        stats.success++;

        if ((i + 1) % 40 === 0 || i === allFiles.length - 1) {
          const pct = Math.round(((i + 1) / allFiles.length) * 100);
          console.log(
            `[PROGRES] ${i + 1}/${allFiles.length} (${pct}%) — ${stats.cached} dilewati (cache/duplikat), ${stats.newOrUpdated} diekstrak baru`
          );
          writeStatusFile(stats, file.fileName);
          await sleep(10);
        }
        continue;
      }
    }

    // 4. Before heavy extraction: Compute fast MD5 file hash to detect identical/duplicate or touched files
    let fileHash = '';
    try {
      fileHash = computeFileHash(file.fullPath);
    } catch (err) {
      stats.failed++;
      continue;
    }

    if (!forceFullReindex && fileHash) {
      // 4a. If file at the same path had its timestamp touched, but binary content is unchanged
      if (existing && existing.fileHash === fileHash && isMeaningfulText(existing.content)) {
        existing.updatedAt = file.mtime.toISOString();
        existing.sizeBytes = file.size;
        if (!existing.contentHash) existing.contentHash = computeTextHash(existing.content);
        seenFileHashes.set(fileHash, file.relativePath);
        seenContentHashes.set(existing.contentHash, file.relativePath);
        documents.push(existing);
        stats.cached++;
        stats.success++;
        continue;
      }

      // 4b. If an identical file (100% same binary hash) is already indexed in another folder/ticket
      const existingPrimaryPath = seenFileHashes.get(fileHash);
      if (existingPrimaryPath && existingPrimaryPath !== file.relativePath) {
        manifest.duplicateFiles[file.relativePath] = {
          sizeBytes: file.size,
          mtimeSec: file.mtimeSec,
          primaryPath: existingPrimaryPath,
          fileHash
        };
        stats.duplicates++;
        stats.cached++;
        console.log(
          `[SKIP DUPLIKAT] ${file.fileName} identik dengan ${path.basename(existingPrimaryPath)} (Hemat ekstraksi)`
        );
        continue;
      }
    }

    // If user configured a batch limit and we reached it, keep existing cached copy (if any) for remaining files
    if (batchLimit > 0 && stats.newOrUpdated >= batchLimit) {
      if (!batchCapReached) {
        batchCapReached = true;
        console.log(
          `[INFO] Batas batch (${batchLimit} berkas baru) tercapai. Menyimpan hasil dan mempertahankan cache sisanya...`
        );
      }
      if (existing && isMeaningfulText(existing.content)) {
        documents.push(existing);
        stats.cached++;
        stats.success++;
      }
      continue;
    }

    // 5. Truly New or Modified Unique File -> Extract text sequentially with timeout & cool-down
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
      if (!isMeaningfulText(text)) {
        // Record in manifest so midnight sync NEVER wastes CPU re-parsing this scanned/empty file again
        manifest.skippedFiles[file.relativePath] = {
          sizeBytes: file.size,
          mtimeSec: file.mtimeSec,
          fileHash,
          reason: 'empty_or_scanned',
          updatedAt: new Date().toISOString()
        };
        stats.skippedKnown++;
        console.log(
          `[SKIP KOSONG/SCAN] ${file.fileName} tidak berisi teks (dicatat di cache agar tidak diulang)`
        );
        await sleep(30);
        continue;
      }

      const contentHash = computeTextHash(text);

      // Check if extracted text content is 100% identical to an already indexed document
      if (!forceFullReindex && seenContentHashes.has(contentHash)) {
        const primaryContentPath = seenContentHashes.get(contentHash);
        if (primaryContentPath && primaryContentPath !== file.relativePath) {
          manifest.duplicateFiles[file.relativePath] = {
            sizeBytes: file.size,
            mtimeSec: file.mtimeSec,
            primaryPath: primaryContentPath,
            fileHash
          };
          stats.duplicates++;
          console.log(
            `[SKIP DUPLIKAT KONTEN] ${file.fileName} memiliki isi teks sama persis dengan ${path.basename(primaryContentPath)}`
          );
          continue;
        }
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

      const newDoc = {
        id,
        slug: `external/${id}`,
        section: 'EXTERNAL',
        category: category,
        title: title || file.fileName,
        fileName: file.fileName,
        relativePath: file.relativePath,
        extension: file.ext,
        sizeBytes: file.size,
        fileHash,
        contentHash,
        updatedAt: file.mtime.toISOString(),
        snippet: snippet,
        tags: Array.from(new Set(tags)),
        content: cappedContent
      };

      documents.push(newDoc);
      if (fileHash) seenFileHashes.set(fileHash, file.relativePath);
      seenContentHashes.set(contentHash, file.relativePath);

      // Clean up from skipped/duplicate manifest if it was previously there
      delete manifest.skippedFiles[file.relativePath];
      delete manifest.duplicateFiles[file.relativePath];

      stats.newOrUpdated++;
      stats.success++;

      const pct = Math.round(((i + 1) / allFiles.length) * 100);
      console.log(
        `[PROGRES] ${i + 1}/${allFiles.length} (${pct}%) — Diekstrak: ${file.fileName} (${stats.newOrUpdated} baru, ${stats.cached} dilewati)`
      );

      // Periodic Checkpoint & Garbage Collection
      if (stats.newOrUpdated % 5 === 0) {
        triggerGc();
        await sleep(450);
      }
      if (stats.newOrUpdated % checkpointInterval === 0) {
        saveCheckpoint(documents, stats, false);
      }

      // Cool-down delay between files so CPU & Disk never spike to 100%
      await sleep(throttleDelayMs);
    } catch (err) {
      stats.failed++;
      // Record failed/corrupted/encrypted file in manifest so we don't retry and hang on it every night
      manifest.skippedFiles[file.relativePath] = {
        sizeBytes: file.size,
        mtimeSec: file.mtimeSec,
        fileHash,
        reason: err.message || 'unreadable_or_timeout',
        updatedAt: new Date().toISOString()
      };
      console.log(
        `[SKIP] Melewati ${file.fileName}: ${err.message || 'Format tidak terbaca'} (dicatat agar tidak diulang)`
      );
      triggerGc();
      await sleep(100);
    }
  }

  stats.isRunning = false;
  triggerGc();
  console.log('\nMenyimpan berkas indeks dokumen & manifest cache final...');
  saveCheckpoint(documents, stats, true);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const jsonStr = JSON.stringify(documents, null, 2);
  const sizeMb = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);

  console.log('====================================================');
  console.log(' Selesai Pengindeksan Dokumen!');
  console.log(` Durasi                : ${durationSec} detik`);
  console.log(` Total Dokumen Unik    : ${documents.length} berkas`);
  console.log(`   - Cache (Sudah Ada) : ${stats.cached - stats.duplicates - stats.skippedKnown} berkas`);
  console.log(`   - Ekstraksi Baru    : ${stats.newOrUpdated} berkas`);
  console.log(` Berkas Dihemat/Skip   :`);
  console.log(`   - Duplikat Dilewati : ${stats.duplicates} berkas`);
  console.log(`   - Scan/Kosong/Skip  : ${stats.skippedKnown} berkas`);
  console.log(`   - Ukuran Berlebih   : ${stats.skippedSize} berkas`);
  console.log(` Ukuran Indeks JSON    : ${sizeMb} MB`);
  console.log('====================================================');
}

run().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  currentStats.isRunning = false;
  writeStatusFile(currentStats, 'Error');
  process.exit(1);
});
