const express = require('express');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const url = require('url');
const Fuse = require('fuse.js');

const app = express();
const PORT = process.env.PORT || 8088;
const FRONTEND_STATIC = path.join(__dirname, 'static');

// Load .env if present
try {
  const envPath = path.join(__dirname, '.env');
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
} catch (_) {}

// Local AI Endpoint Configuration (supports env variables)
const AI_CONFIG = {
  host: process.env.AI_HOST || '127.0.0.1',
  port: parseInt(process.env.AI_PORT, 10) || 8045,
  apiKey: process.env.AI_API_KEY || '',
  defaultModel: process.env.AI_MODEL || 'gemini-3.8-flash-medium',
  fallbackModel: 'gemini-3.8-flash'
};

// In-Memory Response Cache for high performance (TTL: 2 hours)
const aiResponseCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function getCache(key) {
  const item = aiResponseCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    aiResponseCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  // Simple LRU trim if cache exceeds 300 entries
  if (aiResponseCache.size > 300) {
    const oldestKey = aiResponseCache.keys().next().value;
    aiResponseCache.delete(oldestKey);
  }
  aiResponseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

app.use(express.json({ limit: '10mb' }));

// Restricted CORS & Security Headers
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8088,http://127.0.0.1:8088')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Explicit Favicon handling
app.get('/favicon.ico', (req, res) => {
  const favPath = path.join(FRONTEND_STATIC, 'favicon.ico');
  if (fs.existsSync(favPath)) {
    return res.sendFile(favPath);
  }
  res.status(204).end();
});


// ==========================================
// AI COPILOT & ASSISTANT APIS
// ==========================================

// 1. Health & Status Check
app.get('/api/ai/status', (req, res) => {
  const reqCheck = http.request({
    hostname: AI_CONFIG.host,
    port: AI_CONFIG.port,
    path: '/v1/models',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${AI_CONFIG.apiKey}` },
    timeout: 3500
  }, (upstreamRes) => {
    let d = '';
    upstreamRes.on('data', c => d += c);
    upstreamRes.on('end', () => {
      try {
        const json = JSON.parse(d);
        const models = (json.data || []).map(m => m.id);
        res.json({
          status: 'online',
          service: 'AI Copilot Engine',
          cachedEntries: aiResponseCache.size
        });
      } catch (e) {
        res.json({ status: 'online', service: 'AI Copilot Engine', cachedEntries: aiResponseCache.size });
      }
    });
  });

  reqCheck.on('error', (err) => {
    res.status(503).json({ status: 'offline', error: err.message });
  });

  reqCheck.on('timeout', () => {
    reqCheck.destroy();
    res.status(504).json({ status: 'timeout' });
  });

  reqCheck.end();
});

// Helper for AI Chat completion with fallback (Default Low Temperature for Strict Factual Grounding)
function callAiChat(messages, model, maxTokens = 1500, temperature = 0.1) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: model || AI_CONFIG.defaultModel,
      messages: messages,
      max_tokens: maxTokens,
      temperature: typeof temperature === 'number' ? temperature : 0.1
    });

    const request = http.request({
      hostname: AI_CONFIG.host,
      port: AI_CONFIG.port,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    }, (response) => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve({
              model: model,
              message: json.choices[0].message.content,
              usage: json.usage
            });
          } else if (json.error) {
            reject(new Error(json.error.message || 'AI Gateway error'));
          } else {
            reject(new Error('Format balasan AI tidak dikenali'));
          }
        } catch (e) {
          reject(new Error('Gagal memproses JSON respons AI: ' + body.substring(0, 150)));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Waktu permintaan AI habis (Timeout)'));
    });

    request.write(postData);
    request.end();
  });
}

// ==========================================
// DOCUMENTATION REPOSITORY & KNOWLEDGE RETRIEVAL (RAG)
// ==========================================

const DATA_DIR = path.join(__dirname, 'data');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const FRONTEND_DOCS_FILE = path.join(__dirname, 'src', 'lib', 'data', 'documents.json');
const EXTERNAL_DOCS_FILE = path.join(DATA_DIR, 'external-documents.json');
const FRONTEND_EXTERNAL_DOCS_FILE = path.join(__dirname, 'src', 'lib', 'data', 'external-documents.json');
const APPS_FILE = path.join(__dirname, 'src', 'lib', 'data', 'apps.json');

function loadDocuments() {
  try {
    if (fs.existsSync(DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
    }
    if (fs.existsSync(FRONTEND_DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(FRONTEND_DOCS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading documents database:', e.message);
  }
  return [];
}

function loadExternalDocuments() {
  try {
    if (fs.existsSync(EXTERNAL_DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(EXTERNAL_DOCS_FILE, 'utf8'));
    }
    if (fs.existsSync(FRONTEND_EXTERNAL_DOCS_FILE)) {
      return JSON.parse(fs.readFileSync(FRONTEND_EXTERNAL_DOCS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading external documents database:', e.message);
  }
  return [];
}

function inferSection(doc) {
  if (doc && doc.section && ['SAP', 'SAC', 'WEB'].includes(doc.section.toUpperCase())) {
    return doc.section.toUpperCase();
  }
  const slug = ((doc && (doc.slug || doc.id)) || '').toLowerCase();
  const title = ((doc && doc.title) || '').toLowerCase();
  const category = ((doc && doc.category) || '').toLowerCase();
  const combined = `${slug} ${title} ${category}`;
  if (combined.startsWith('sac/') || combined.includes('sac') || combined.includes('analytic') || combined.includes('story') || combined.includes('stories')) {
    return 'SAC';
  }
  if (combined.startsWith('sap/') || combined.includes('sap') || combined.includes('abap') || combined.includes('bapi') || combined.includes('odata') || combined.includes('fiori')) {
    return 'SAP';
  }
  return 'WEB';
}

function saveDocuments(docs) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2), 'utf8');
  if (fs.existsSync(path.dirname(FRONTEND_DOCS_FILE))) {
    fs.writeFileSync(FRONTEND_DOCS_FILE, JSON.stringify(docs, null, 2), 'utf8');
  }
}

// Semantic & keyword-based knowledge retriever to ground AI answers
function retrieveRelevantKnowledge(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) return '';

  const cleanQuery = query.trim();
  const docs = loadDocuments();
  let apps = [];
  try {
    if (fs.existsSync(APPS_FILE)) {
      const appsData = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
      apps = appsData.programs || [];
    }
  } catch (e) {}

  const docFuse = new Fuse(docs, {
    keys: [
      { name: 'title', weight: 0.35 },
      { name: 'section', weight: 0.25 },
      { name: 'category', weight: 0.2 },
      { name: 'tags', weight: 0.2 },
      { name: 'snippet', weight: 0.15 },
      { name: 'content', weight: 0.1 }
    ],
    threshold: 0.45,
    ignoreLocation: true
  });

  const appFuse = new Fuse(apps, {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'subtitle', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'tags', weight: 0.1 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  });

  const matchedDocs = docFuse.search(cleanQuery).slice(0, 2).map(r => r.item);
  const matchedApps = appFuse.search(cleanQuery).slice(0, 2).map(r => r.item);

  const extDocs = loadExternalDocuments();
  let matchedExtDocs = [];
  if (extDocs.length > 0) {
    const extFuse = new Fuse(extDocs, {
      keys: [
        { name: 'title', weight: 0.35 },
        { name: 'category', weight: 0.25 },
        { name: 'tags', weight: 0.2 },
        { name: 'fileName', weight: 0.2 },
        { name: 'snippet', weight: 0.15 },
        { name: 'content', weight: 0.1 }
      ],
      threshold: 0.45,
      ignoreLocation: true
    });
    matchedExtDocs = extFuse.search(cleanQuery).slice(0, 2).map(r => r.item);
  }

  let knowledge = '';

  if (matchedApps.length > 0) {
    knowledge += `\n[DATA APLIKASI ENTERPRISE TERVERIFIKASI]:\n`;
    for (const app of matchedApps) {
      knowledge += `- Sistem: ${app.title} (${app.subtitle || ''})\n  URL Resmi: ${app.url}\n  Deskripsi: ${app.description}\n  Kategori: ${app.categoryName || app.category}\n  Tags: ${(app.tags || []).join(', ')}\n\n`;
    }
  }

  if (matchedDocs.length > 0) {
    knowledge += `\n[SUMBER DOKUMEN RESMI PORTAL]:\n`;
    for (const doc of matchedDocs) {
      knowledge += `--- Dokumen Resmi: "${doc.title}" (Kategori: ${doc.category}, Path: /docs/${doc.slug}) ---\n${doc.content.slice(0, 1600)}\n\n`;
    }
  }

  if (matchedExtDocs.length > 0) {
    knowledge += `\n[SUMBER ARSIP DOKUMEN INTERNAL / HELPDESK]:\n`;
    for (const doc of matchedExtDocs) {
      knowledge += `--- Berkas Internal: "${doc.title}" (File: ${doc.fileName || doc.title}, Lokasi: ${doc.relativePath || doc.category}) ---\n${doc.content.slice(0, 1600)}\n\n`;
    }
  }

  return knowledge.trim();
}

const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten teknis dan konsultan cerdas resmi untuk Sistem Helpdesk Enterprise (khususnya Bagian Knowledge Base & Dokumentasi Modul Terpadu).

==================================================
PRINSIP UTAMA: INTEGRASI SATU APLIKASI DENGAN HELPDESK
==================================================
1. SATU KESATUAN DENGAN SISTEM HELPDESK (SHARED SESSION):
   - Portal dokumentasi ini dan Sistem Helpdesk berbagi sesi login (*shared session / single authentication*).
   - Bagi pengguna, portal dokumentasi ini BUKAN aplikasi terpisah, melainkan SATU KESATUAN APLIKASI HELPDESK (Modul Dokumentasi, Knowledge Base, Panduan Solusi Tiket, dan SOP Modul).
   - Setiap pertanyaan pengguna harus otomatis dipahami dalam konteks ekosistem Helpdesk dan kebutuhan penyelesaian kendala teknis.
   - Semua dokumen, artikel teknis, dan catatan di portal ini berfungsi sebagai basis pengetahuan (*Knowledge Base*) resmi untuk menjawab komplain, membimbing user, dan menyelesaikan tiket Helpdesk.

2. PENANGANAN PERTANYAAN OTOMATIS MENGACU KE HELPDESK:
   - Apabila pengguna menanyakan masalah teknis, kendala sistem, atau tata cara pemakaian fitur:
     a) Posisikan jawaban Anda sebagai Technical Support & Konsultan Ahli Helpdesk yang ramah, taktis, dan solutif.
     b) Kaitkan dengan panduan modul dokumen terkait yang ada di portal ini.
     c) Jika pertanyaan berkaitan dengan status tiket, PIC, atau penanganan issue (dan data database Helpdesk terlampir), sajikan rincian tiket tersebut secara jelas dan transparan.
     d) Berikan rekomendasi langkah penanganan (Actionable Step-by-Step Troubleshooting) yang bisa langsung dijalankan oleh user atau teknisi Helpdesk.

3. CAKUPAN KEAHLIAN LUAS (SAP, SAC, WEB & IT ENTERPRISE):
   - Anda memiliki keahlian teknis mendalam untuk menuntaskan tiket/kendala di bidang:
     a) **SAP Enterprise**: SAP ERP, S/4HANA, ABAP, RFC, BAPI, CDS Views, OData/Gateway, SAP Basis & Performance Tuning (SM50, SM66, ST22, ST05, SAT, ST02, DB02, HANA Studio), modul fungsional (FI, CO, MM, SD, PM, PP), dan troubleshooting issue SAP di Helpdesk.
     b) **SAP Analytics Cloud (SAC)**: Story Dashboard, Digital Boardroom, Live Data Connection, Calculated & Restricted Measures, Exception Aggregation, Corporate Planning, dan optimalisasi Story SAC.
     c) **Web & Software Engineering**: Sistem Helpdesk (Laravel / PHP Stack), SvelteKit, TypeScript, JavaScript, Tailwind CSS, REST API, Database MySQL/PostgreSQL, Keamanan Aplikasi, dan arsitektur sistem.
     d) **7 Aplikasi Operasional Enterprise** terintegrasi: Fuel Management System (FMS), SAC, Enterprise Marketing, KPI Safety (SHE), PPPN, File Manager, dan Helpdesk.

4. FLEKSIBEL & TIDAK KAKU PADA DOKUMENTASI (ZERO REJECTION UNTUK PERTANYAAN TEKNIS):
   - Gunakan data resmi dari [SUMBER DOKUMEN RESMI PORTAL], [DATA APLIKASI ENTERPRISE TERVERIFIKASI], atau [SUMBER ARSIP DOKUMEN INTERNAL / HELPDESK] sebagai rujukan utama.
   - **PENTING**: Jika pertanyaan teknis belum tertulis di dokumen portal, **ANDA WAJIB TETAP MENJAWABNYA SECARA LENGKAP, SOLUTIF, DAN MENDALAM** menggunakan keahlian Anda. Jangan pernah menolak dengan jawaban kaku seperti "informasi tidak ada di database".
   - Hanya tolak dengan sopan jika pertanyaan benar-benar di luar konteks pekerjaan/teknologi/perusahaan.

5. IDENTITAS & KERAHASIAAN MODEL:
   - Jangan menyebutkan nama model AI teknis di balik layar (seperti Gemini, GPT, Claude, dll.).
   - Jika ditanya siapa Anda, jawab: "Saya adalah AI Copilot resmi Helpdesk & Dokumentasi Modul Enterprise."

Ekosistem Aplikasi Resmi Terdaftar:
1. 7 Aplikasi Enterprise:
   - Helpdesk Enterprise (http://helpdesk2.test / https://demo2.jhonlingroup.id) - Pusat pelaporan tiket, penanganan insiden, dan Knowledge Base terpadu.
   - Fuel Management System (FMS) (http://jgfuel.id) - Pemantauan konsumsi BBM armada & telemetry.
   - SAP Analytics Cloud (SAC) Dev & Prod - Pelaporan analitik bisnis eksekutif & live CDS views.
   - Enterprise Marketing System (http://marketing.jhonlingroup.id) - Persetujuan kontrak komersial & CRM.
   - KPI Safety (SHE) (http://she.jhonlingroup.id/login) - K3 & keselamatan kerja, investigasi insiden.
   - PPPN (http://38.47.92.151:5000) - Notifikasi penagihan vendor & operasional pabrik.
   - File Manager (http://file.jhonlingroup.id/login) - Penyimpanan berkas enterprise terpusat.
2. Arsitektur Portal Dokumentasi:
   - SvelteKit, Tailwind CSS, Shadcn UI.

Pedoman Format:
- Gunakan Bahasa Indonesia yang profesional, hangat, solutif, dan terstruktur (gunakan bullet points, langkah bernomor, atau blok kode bila diperlukan).`;

// Database Query Helper for AI Realtime Query (Metode 2)
let dbPool = null;
function getDbPool() {
  if (!dbPool) {
    try {
      const mysql = require('mysql2/promise');
      dbPool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_DATABASE || 'helpdesk',
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'root',
        connectionLimit: 4
      });
    } catch (_) {}
  }
  return dbPool;
}

function detectDbQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.toLowerCase();
  const isDb = ['tiket', 'ticket', 'helpdesk', 'status tiket', 'berapa tiket', 'jumlah tiket', 'total tiket', 'antrian tiket'].some(k => q.includes(k));
  if (!isDb) return null;

  if ((q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('status')) && !q.includes('terakhir') && !q.includes('terbaru')) {
    if (q.includes('severity') || q.includes('prioritas') || q.includes('kritis') || q.includes('critical')) {
      return `SELECT severity, COUNT(*) as total FROM tickets GROUP BY severity ORDER BY total DESC`;
    }
    if (q.includes('kategori') || q.includes('category')) {
      return `SELECT category, COUNT(*) as total FROM tickets WHERE category IS NOT NULL GROUP BY category ORDER BY total DESC LIMIT 10`;
    }
    return `SELECT status, COUNT(*) as total FROM tickets GROUP BY status ORDER BY total DESC`;
  }
  if (q.includes('tiket open') || q.includes('tiket yang open') || q.includes('masih open')) {
    return `SELECT id, ticket_number, title, created_by, severity, category, created_at FROM tickets WHERE status = 'Open' ORDER BY id DESC LIMIT 15`;
  }
  if (q.includes('in development') || q.includes('sedang dikembangkan')) {
    return `SELECT id, ticket_number, title, created_by, dev_assigned_to, severity, created_at FROM tickets WHERE status = 'In Development' ORDER BY id DESC LIMIT 15`;
  }
  if (q.includes('terbaru') || q.includes('terakhir') || q.includes('daftar tiket')) {
    return `SELECT id, ticket_number, title, status, severity, category, created_by, created_at FROM tickets ORDER BY id DESC LIMIT 10`;
  }
  return `SELECT status, COUNT(*) as total FROM tickets GROUP BY status ORDER BY total DESC`;
}

async function executeSafeSql(sql) {
  if (!sql || !/^(SELECT|WITH|EXPLAIN)\s+/i.test(sql.trim())) return null;
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  if (cleaned.includes(';')) return null;
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|GRANT|REVOKE)\b/i.test(cleaned)) return null;
  const finalSql = /\bLIMIT\b/i.test(cleaned) ? cleaned : `${cleaned} LIMIT 50`;
  try {
    const pool = getDbPool();
    if (!pool) return null;
    const [rows] = await pool.query(finalSql);
    return { sql: finalSql, rows: Array.isArray(rows) ? rows : [] };
  } catch (e) {
    return null;
  }
}

// 2. Chat API (with intelligent caching & fallback)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, documentContext, model, currentRoute, query, context, history, strictDocScope, docMeta } = req.body;

    let messageList = messages;
    if (!messageList && (query || history)) {
      messageList = [
        ...(Array.isArray(history) ? history : []),
        ...(query ? [{ role: 'user', content: query }] : [])
      ];
    }

    if (!messageList || !Array.isArray(messageList) || messageList.length === 0) {
      return res.status(400).json({ error: 'Messages array atau parameter query diperlukan' });
    }

    const docCtx = documentContext || context || '';
    let contextualPrompt = '';

    if (strictDocScope) {
      const docTitle = docMeta?.title || currentRoute || 'Dokumen Aktif';
      const docSection = docMeta?.section || 'Dokumentasi';
      const docCategory = docMeta?.category || 'Umum';
      const docSlug = docMeta?.slug ? `/docs/${docMeta.slug}` : '';

      contextualPrompt = `Anda adalah "AI Assistant Dokumen", asisten analisis khusus yang HANYA bertugas menjelaskan, merangkum, dan menjawab pertanyaan berdasarkan SATU dokumen yang sedang dibuka pengguna.

==================================================
ATURAN LINGKUP DOKUMEN TUNGGAL (STRICT DOCUMENT SCOPE):
==================================================
1. LINGKUP TERKUNCI:
   - Anda HANYA boleh menggunakan informasi yang tertulis di dalam [ISI LENGKAP DOKUMEN AKTIF] di bawah ini.
   - DILARANG mengambil, mencampur, atau mengarang informasi di luar isi dokumen "${docTitle}" ini.
2. JIKA TIDAK ADA DI DOKUMEN INI:
   - Apabila pengguna menanyakan topik yang tidak dibahas di dalam dokumen "${docTitle}", jawab dengan sopan:
     "Topik tersebut tidak dibahas di dalam dokumen **${docTitle}** ini. Silakan gunakan **Chat AI Copilot (Global)** di pojok kanan atas jika ingin mencari informasi lintas seluruh dokumen portal."
3. GAYA JAWABAN:
   - Gunakan Bahasa Indonesia yang terstruktur, jelas, dan mudah dipahami.
   - Gunakan format Markdown (poin-poin, tabel, bold, atau blok kode sesuai isi dokumen).
   - Jangan pernah menyebutkan nama model AI teknis di balik layar.

[METADATA DOKUMEN AKTIF]:
- Judul: ${docTitle}
- Bagian: ${docSection}
- Kategori: ${docCategory}
${docSlug ? `- Path: ${docSlug}` : ''}

[ISI LENGKAP DOKUMEN AKTIF]:
"""
${docCtx.substring(0, 12000)}
"""`;
    } else {
      const lastUserQuery = query || (messageList.filter(m => m.role === 'user').pop()?.content || '');
      const relevantKnowledge = retrieveRelevantKnowledge(lastUserQuery);

      // Realtime Database Query Integration (Metode 2)
      let liveDbKnowledge = '';
      const autoSql = detectDbQuery(lastUserQuery);
      if (autoSql) {
        try {
          const dbRes = await executeSafeSql(autoSql);
          if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
            liveDbKnowledge = `\n\n[DATA REALTIME DATABASE HELPDESK MYSQL (Query: ${dbRes.sql})]:\n${JSON.stringify(dbRes.rows, null, 2).slice(0, 3000)}\n\nInstruksi Penting: Gunakan data realtime database di atas untuk menjawab statistik atau status tiket pengguna secara akurat, faktual, dan ramah.`;
          }
        } catch (_) {}
      }

      contextualPrompt = SYSTEM_PROMPT_BASE;
      if (currentRoute) {
        contextualPrompt += `\nLOKASI PENGGUNA SAAT INI DI PORTAL: ${currentRoute}`;
      }
      if (docCtx && docCtx.trim()) {
        contextualPrompt += `\n\n[KONTEKS DOKUMEN AKTIF SAAT INI]:\n"""\n${docCtx.substring(0, 3500)}\n"""`;
      }
      if (liveDbKnowledge) {
        contextualPrompt += liveDbKnowledge;
      }
      if (relevantKnowledge) {
        contextualPrompt += `\n\n${relevantKnowledge}\n\nIngat: Jawab HANYA berdasarkan fakta di atas. Dilarang mengarang fakta di luar dokumen!`;
      }
    }

    const fullMessages = [
      { role: 'system', content: contextualPrompt },
      ...messageList
    ];

    // Check cache for identical message thread
    const cacheKey = hashString(JSON.stringify(fullMessages));
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    let result;
    const chosenModel = model || AI_CONFIG.defaultModel;

    try {
      result = await callAiChat(fullMessages, chosenModel);
    } catch (primaryErr) {
      console.warn(`Model ${chosenModel} error: ${primaryErr.message}. Mencoba fallback ${AI_CONFIG.fallbackModel}...`);
      result = await callAiChat(fullMessages, AI_CONFIG.fallbackModel);
    }

    setCache(cacheKey, result);
    res.json({
      message: result.message,
      reply: result.message,
      usage: result.usage
    });
  } catch (err) {
    console.error('AI Chat Error:', err.message);
    res.status(500).json({ error: err.message || 'Gagal menghubungi server AI' });
  }
});

// 3. Summarize Article API (with instant caching)
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content diperlukan untuk diringkas' });
    }

    const cacheKey = `summary_${hashString((title || '') + content)}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const messages = [
      {
        role: 'system',
        content: 'Anda adalah asisten perangkum teknis untuk Documentation Portal. Buatlah ringkasan eksekutif dokumen teknis ini dalam 3-4 butir poin kunci yang padat, terstruktur rapi, dan aplikatif dalam Bahasa Indonesia. Format tiap butir dengan judul bold diawali tanda strip.'
      },
      {
        role: 'user',
        content: `Judul Dokumen: ${title || 'Dokumen Teknis'}\n\nIsi Dokumen:\n${content.substring(0, 4500)}`
      }
    ];

    const result = await callAiChat(messages, AI_CONFIG.defaultModel, 600);
    setCache(cacheKey, result);
    res.json({
      message: result.message,
      reply: result.message,
      usage: result.usage
    });
  } catch (err) {
    console.error('AI Summarize Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Quick Semantic Search Guidance API
app.get('/api/ai/quick-search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Parameter query q diperlukan' });
  }

  const cacheKey = `search_${hashString(query.toLowerCase())}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const messages = [
    {
      role: 'system',
      content: 'Anda adalah navigator pintar untuk Documentation Portal. Berikan rekomendasi singkat 1-2 kalimat kepada pengguna untuk query mereka, sebutkan aplikasi atau topik dokumentasi yang relevan.'
    },
    {
      role: 'user',
      content: `Pencarian pengguna: "${query}"`
    }
  ];

  try {
    const result = await callAiChat(messages, AI_CONFIG.defaultModel, 250);
    setCache(cacheKey, result, 60 * 60 * 1000);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DOCUMENTATION MANAGEMENT & CRUD APIS (NO .MD REQUIRED)
// ==========================================

// 5. Get All Documents, Sections & Categories
app.get('/api/docs', (req, res) => {
  const docs = loadDocuments();
  const sections = ['SAP', 'SAC', 'WEB'];
  const sectionStats = { SAP: 0, SAC: 0, WEB: 0, all: docs.length };

  // Section-first grouping
  const sectionMap = {
    SAP: new Map(),
    SAC: new Map(),
    WEB: new Map()
  };

  // Flat category map (for backward compatibility)
  const categoryMap = new Map();

  for (const doc of docs) {
    const sec = inferSection(doc);
    doc.section = sec;
    const cat = doc.category || 'General';

    sectionStats[sec] = (sectionStats[sec] || 0) + 1;

    const node = {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      path: doc.slug,
      section: sec,
      category: cat,
      subcategory: doc.subcategory ? String(doc.subcategory).trim() : undefined,
      icon: 'FileText'
    };

    // Flat categories
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat).push(node);

    // Section grouping
    if (!sectionMap[sec]) sectionMap[sec] = new Map();
    if (!sectionMap[sec].has(cat)) {
      sectionMap[sec].set(cat, []);
    }
    sectionMap[sec].get(cat).push(node);
  }

  const treeData = Array.from(categoryMap.entries()).map(([title, nodes]) => ({
    title,
    section: nodes[0]?.section || 'WEB',
    icon: 'Folder',
    nodes
  }));

  const sectionTree = sections.map((sec) => {
    const catEntries = Array.from((sectionMap[sec] || new Map()).entries());
    return {
      section: sec,
      title: sec,
      total: sectionStats[sec] || 0,
      categories: catEntries.map(([catTitle, nodes]) => ({
        title: catTitle,
        icon: 'Folder',
        nodes
      }))
    };
  });

  const docSummaries = docs.map((d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    section: d.section || inferSection(d),
    category: d.category,
    subcategory: d.subcategory,
    snippet: d.snippet || d.description,
    description: d.description || d.snippet,
    tags: d.tags,
    sacUrl: d.sacUrl,
    updatedAt: d.updatedAt
  }));

  res.json({
    documents: docSummaries,
    sections,
    sectionStats,
    sectionTree,
    treeData,
    total: docs.length
  });
});

// 6. Get Single Document by ID / Slug
app.get('/api/docs/:id(*)', (req, res) => {
  const docs = loadDocuments();
  const id = req.params.id;
  const doc = docs.find(d => d.id === id || d.slug === id);
  if (!doc) {
    return res.status(404).json({ error: 'Dokumentasi tidak ditemukan' });
  }
  doc.section = inferSection(doc);
  res.json(doc);
});

// 7. Create New Document
app.post('/api/docs', (req, res) => {
  const { title, category, subcategory, content, builderContent, description, tags, slug, section, sacUrl } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Judul dan konten dokumentasi wajib diisi' });
  }
  const docs = loadDocuments();
  const sec = section && ['SAP', 'SAC', 'WEB'].includes(section.toUpperCase()) 
    ? section.toUpperCase() 
    : inferSection({ title, category, slug });

  const cat = (category || 'General').trim();
  const subcat = subcategory ? String(subcategory).trim() : undefined;
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const finalSlug = slug || `${sec.toLowerCase()}/${titleSlug}`;

  const cleanDesc = description || content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim();

  const newDoc = {
    id: finalSlug,
    slug: finalSlug,
    section: sec,
    title: title.trim(),
    category: cat,
    subcategory: subcat || undefined,
    description: cleanDesc,
    snippet: cleanDesc,
    content: content.trim(),
    builderContent: typeof builderContent === 'string' && builderContent.trim() ? builderContent.trim() : undefined,
    tags: Array.isArray(tags) && tags.length > 0 ? tags : [sec, cat, ...(subcat ? [subcat] : []), 'Dokumentasi'],
    updatedAt: new Date().toISOString()
  };

  if (sacUrl) newDoc.sacUrl = sacUrl.trim();

  const existingIndex = docs.findIndex(d => d.id === finalSlug || d.slug === finalSlug);
  if (existingIndex >= 0) {
    docs[existingIndex] = newDoc;
  } else {
    docs.push(newDoc);
  }

  saveDocuments(docs);
  res.json({ success: true, document: newDoc });
});

// 8. Update Existing Document
app.put('/api/docs/:id(*)', (req, res) => {
  const id = req.params.id;
  const docs = loadDocuments();
  const index = docs.findIndex(d => d.id === id || d.slug === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan untuk diubah' });
  }

  const { title, category, subcategory, content, builderContent, description, tags, section, sacUrl } = req.body;
  const doc = docs[index];

  if (section && ['SAP', 'SAC', 'WEB'].includes(section.toUpperCase())) {
    doc.section = section.toUpperCase();
  }
  if (title) doc.title = title.trim();
  if (category) doc.category = category.trim();
  if (subcategory !== undefined) doc.subcategory = subcategory ? String(subcategory).trim() : undefined;
  if (content) doc.content = content.trim();
  if (builderContent !== undefined) doc.builderContent = builderContent ? String(builderContent).trim() : undefined;
  if (sacUrl !== undefined) doc.sacUrl = sacUrl ? sacUrl.trim() : undefined;
  if (description) {
    doc.description = description.trim();
    doc.snippet = description.trim();
  } else if (content) {
    doc.description = content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim();
    doc.snippet = doc.description;
  }
  if (tags && Array.isArray(tags)) doc.tags = tags;
  doc.updatedAt = new Date().toISOString();

  saveDocuments(docs);
  res.json({ success: true, document: doc });
});

// 9. Delete Document
app.delete('/api/docs/:id(*)', (req, res) => {
  const id = req.params.id;
  let docs = loadDocuments();
  const initialLen = docs.length;
  docs = docs.filter(d => d.id !== id && d.slug !== id);
  if (docs.length === initialLen) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  }
  saveDocuments(docs);
  res.json({ success: true, message: 'Dokumen berhasil dihapus' });
});

// 9b. Image Upload Endpoint (Base64 payload from clipboard paste, drag-and-drop, or file input)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
app.post(['/api/upload-image', '/api/upload'], (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Data gambar tidak ditemukan' });
    }

    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = '.png';

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('svg')) {
        return res.status(400).json({ error: 'Format SVG tidak diizinkan demi keamanan. Gunakan PNG, JPG, GIF, atau WEBP.' });
      }
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('gif')) ext = '.gif';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('png')) ext = '.png';
      else {
        return res.status(400).json({ error: 'Format gambar tidak didukung. Gunakan PNG, JPG, GIF, atau WEBP.' });
      }
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }

    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Ukuran gambar melebihi batas maksimum 5 MB' });
    }

    const uploadDir = path.join(FRONTEND_STATIC, 'img', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeBase = (filename || 'gambar')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueName = `${safeBase || 'gambar'}-${Date.now()}${ext}`;
    const targetPath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(targetPath, buffer);

    const relativeUrl = `/img/uploads/${uniqueName}`;
    res.json({ success: true, url: relativeUrl, filename: uniqueName });
  } catch (err) {
    console.error('Image Upload Error:', err);
    res.status(500).json({ error: 'Gagal mengunggah gambar: ' + err.message });
  }
});

// 10. AI Document Assistant (Generate, Improve, Code, Summarize)
app.post('/api/ai/doc-assist', async (req, res) => {
  try {
    const { action, prompt, currentDoc, section } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Parameter action diperlukan' });
    }

    const targetSection = (section || (currentDoc ? inferSection(currentDoc) : 'SAP')).toUpperCase();
    let sectionContext = '';
    if (targetSection === 'SAP') {
      sectionContext = 'Fokuskan panduan pada ekosistem SAP (ERP, S/4HANA, modul FI/CO/MM/SD/PM, ABAP, RFC, BAPI, SAP Gateway, CDS Views).';
    } else if (targetSection === 'SAC') {
      sectionContext = 'Fokuskan panduan pada SAP Analytics Cloud (Stories, Responsive/Canvas Pages, Charts, Live Data Connections, Cloud Connector, Data Access Control DAC, Planning).';
    } else {
      sectionContext = 'Fokuskan panduan pada Modern Web Stack (SvelteKit, Tailwind CSS, REST APIs, Microservices, Security, Node.js Express).';
    }

    let messages = [];

    if (action === 'generate') {
      messages = [
        {
          role: 'system',
          content: `Anda adalah Enterprise Technical Writer & Solutions Architect AI spesialis bidang ${targetSection}.
${sectionContext}
Tugas Anda adalah membuat dokumentasi teknis baru yang sangat terstruktur, rapi, dan komprehensif dalam Bahasa Indonesia.
Balas HANYA dalam format JSON valid (tanpa markdown fences di luar JSON) dengan struktur persis berikut:
{
  "section": "${targetSection}",
  "title": "Judul Dokumentasi yang Jelas dan Informatif",
  "category": "Kategori Sub-Topik (misal untuk SAP: Core Architecture / Integration / Gateway; untuk SAC: Stories & Visuals / Data Modeling / BI; untuk WEB: Web Stack / Security / API)",
  "description": "Ringkasan eksekutif 1-2 kalimat tentang dokumen ini",
  "tags": ["${targetSection}", "Tag2", "Tag3"],
  "content": "Isi lengkap dokumentasi terstruktur rapi dalam Markdown kaya. Gunakan Heading H2 (##) dan H3 (###), poin-poin penjelasan, tabel jika relevan, peringatan [!NOTE] atau [!TIP], serta blok kode implementasi konkret dengan penjelasannya."
}`
        },
        {
          role: 'user',
          content: `Buatkan dokumentasi teknis baru bagian [${targetSection}] untuk topik berikut:\n"${prompt || `Panduan Praktis Implementasi & Arsitektur ${targetSection}`}"`
        }
      ];
    } else if (action === 'improve') {
      messages = [
        {
          role: 'system',
          content: `Anda adalah Senior Technical Editor spesialis sistem ${targetSection}. Perbaiki, rapikan, dan sempurnakan konten dokumentasi berikut agar memiliki alur logis yang jelas, tata bahasa profesional Bahasa Indonesia, format heading konsisten, dan alert ([!NOTE], [!TIP]) yang tepat.
Balas HANYA teks konten hasil perbaikan.`
        },
        {
          role: 'user',
          content: `Instruksi Khusus: ${prompt || 'Tingkatkan kualitas, struktur, dan keterbacaan teknis'}\n\nKonten Saat Ini:\n${currentDoc?.content || ''}`
        }
      ];
    } else if (action === 'code') {
      messages = [
        {
          role: 'system',
          content: `Anda adalah Lead Software Engineer & Enterprise Architect spesialis ${targetSection}. Buatkan contoh kode implementasi nyata dan best practices (dengan komentar penjelasan) untuk memperkaya dokumentasi ini.
Balas HANYA dalam format blok kode Markdown dengan sedikit penjelasan.`
        },
        {
          role: 'user',
          content: `Kebutuhan Kode: ${prompt || `Contoh implementasi teknis lengkap ${targetSection}`}\n\nKonteks Dokumen: ${currentDoc?.title || ''}\n${(currentDoc?.content || '').slice(0, 1200)}`
        }
      ];
    } else if (action === 'summarize') {
      messages = [
        {
          role: 'system',
          content: `Anda adalah Asisten Perangkum Teknis Enterprise. Buat ringkasan eksekutif 3-4 butir poin kunci yang padat, aplikatif, dan jelas dalam Bahasa Indonesia.`
        },
        {
          role: 'user',
          content: `Judul: ${currentDoc?.title || ''}\n\nIsi Dokumen:\n${(currentDoc?.content || '').slice(0, 4500)}`
        }
      ];
    } else if (action === 'format') {
      messages = [
        {
          role: 'system',
          content: `Anda adalah Formatter Dokumentasi Teknis Enterprise (${targetSection}).
Tugas Anda adalah merapikan catatan mentah/kasar pengguna menjadi format Markdown yang sangat rapi, bersih, dan terstruktur:
1. PERTAHANKAN 100% FAKTA ASLI: Jangan menghapus detail teknis, nama tabel, rumus, ukuran, T-Code, atau langkah yang ditulis pengguna, dan jangan mengarang fakta baru di luar catatan pengguna.
2. Gunakan Heading H2 (##) dan H3 (###) secara proporsional.
3. Ubah daftar parameter, perbandingan, atau ukuran menjadi Tabel Markdown (| Kolom |) jika cocok.
4. Bungkus rumus, query, atau kode ke dalam blok kode (\`\`\`) dan sorot informasi penting dengan Callout (> [!NOTE] atau > [!TIP]).
5. Balas HANYA teks Markdown yang sudah dirapikan tanpa kata pengantar.`
        },
        {
          role: 'user',
          content: `Judul Dokumen: ${currentDoc?.title || prompt || 'Catatan Dokumentasi'}\n\nCatatan Mentah yang Perlu Dirapikan:\n${currentDoc?.content || prompt || ''}`
        }
      ];
    } else {
      return res.status(400).json({ error: `Aksi '${action}' tidak dikenali` });
    }

    const aiRes = await callAiChat(messages, AI_CONFIG.defaultModel, 1800);
    let output = aiRes.message;

    if (action === 'generate') {
      try {
        const cleaned = output.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ success: true, result: parsed });
      } catch (err) {
        return res.json({
          success: true,
          result: {
            title: prompt || 'Dokumentasi Baru',
            category: 'Architecture',
            description: 'Dokumentasi teknis dibuat otomatis oleh AI Copilot',
            tags: ['AI Generated'],
            content: output
          }
        });
      }
    }

    res.json({ success: true, result: output });
  } catch (err) {
    console.error('AI Doc Assist Error:', err.message);
    res.status(500).json({ error: err.message || 'Gagal menjalankan bantuan AI' });
  }
});

// API Sinkronisasi Dokumen Eksternal
app.get('/api/docs/sync-external', (req, res) => {
  res.json({
    status: 'ok',
    schedule: 'Setiap hari pukul 00:00 (12:00 AM)',
    targetFolder: process.env.EXTERNAL_DOCS_DIR || 'D:\\Project\\helpdesk2\\storage\\app\\private'
  });
});

app.post('/api/docs/sync-external', (req, res) => {
  const scriptPath = path.join(__dirname, 'scripts', 'index-external-docs.cjs');
  const { spawn } = require('child_process');
  const p = spawn(process.execPath, [scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => out += d);
  p.on('close', code => {
    if (code === 0) {
      res.json({ status: 'success', message: 'Sinkronisasi berhasil dijalankan', output: out });
    } else {
      res.status(500).json({ status: 'error', message: `Gagal (exit code: ${code})`, output: out });
    }
  });
});

// Scheduler harian jam 12 malam
function startDailyDocsScheduler() {
  function getMsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  function scheduleNext() {
    const ms = getMsUntilMidnight();
    const hours = (ms / 3600000).toFixed(1);
    console.log(`[SCHEDULER] Auto-sync dokumen dijadwalkan setiap jam 00:00 (berikutnya dalam ${hours} jam).`);
    setTimeout(() => {
      console.log(`[SCHEDULER 00:00] Menjalankan sinkronisasi dokumen eksternal di latar belakang...`);
      const scriptPath = path.join(__dirname, 'scripts', 'index-external-docs.cjs');
      const { spawn } = require('child_process');
      const p = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
      p.on('close', (code) => {
        console.log(`[SCHEDULER 00:00] Sinkronisasi selesai (code: ${code}).`);
        scheduleNext();
      });
    }, ms);
  }
  scheduleNext();
}

startDailyDocsScheduler();

// ==========================================
// SVELTEKIT FRONTEND INTEGRATION (MAIN DISPLAY)
// ==========================================

const BUILD_HANDLER_PATH = path.join(__dirname, 'build', 'handler.js');

async function attachFrontendHandler() {
  if (fs.existsSync(BUILD_HANDLER_PATH)) {
    try {
      const handlerUrl = url.pathToFileURL(BUILD_HANDLER_PATH).href;
      const { handler } = await import(handlerUrl);
      app.use(handler);
      console.log(' SvelteKit Frontend: Active & Serving as Main Display');
    } catch (err) {
      console.error('Failed to load SvelteKit build handler:', err.message);
      setupDevFallback();
    }
  } else {
    setupDevFallback();
  }
}

function setupDevFallback() {
  if (fs.existsSync(FRONTEND_STATIC)) {
    app.use(express.static(FRONTEND_STATIC));
  }
  app.use((req, res) => {
    if (path.extname(req.path)) {
      return res.status(404).send('Not Found');
    }
    res.redirect(`http://localhost:5173${req.originalUrl}`);
  });
}

attachFrontendHandler();

// Graceful server startup
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Documentation & App Portal                         `);
  console.log(` URL: http://localhost:${PORT}                      `);
  console.log(` AI Copilot: Active (Proxying 127.0.0.1:${AI_CONFIG.port}) `);
  console.log(` Cache: In-Memory LRU Active (TTL 2 Hours)          `);
  console.log(`====================================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => console.log('Server stopped'));
});
