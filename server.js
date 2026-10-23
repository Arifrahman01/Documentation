const express = require('express');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8088;
const WEBAPP_DIR = path.join(__dirname, 'webapp');

// Local AI Endpoint Configuration (supports env variables or defaults)
const AI_CONFIG = {
  host: process.env.AI_HOST || '127.0.0.1',
  port: parseInt(process.env.AI_PORT, 10) || 8045,
  apiKey: process.env.AI_API_KEY || 'sk-33246260e7334a429cde6487acca5479',
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

// Enable CORS for all assets
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Explicit Favicon handling
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(WEBAPP_DIR, 'favicon.ico'));
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(WEBAPP_DIR, 'index.html'));
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
          model: AI_CONFIG.defaultModel,
          cachedEntries: aiResponseCache.size,
          availableModels: models.slice(0, 10)
        });
      } catch (e) {
        res.json({ status: 'online', model: AI_CONFIG.defaultModel, cachedEntries: aiResponseCache.size });
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

// Helper for AI Chat completion with fallback
function callAiChat(messages, model, maxTokens = 1500) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: model || AI_CONFIG.defaultModel,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.6
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

const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten kecerdasan buatan resmi untuk Documentation Portal & Program Navigator Enterprise.
Karakter & Kemampuan Anda:
1. Menguasai seluruh ekosistem aplikasi enterprise & operasional:
   - Fuel Management System (FMS) (http://jgfuel.id) - Pemantauan & analisis konsumsi bahan bakar alat berat & armada, sensor telemetry, rekonsiliasi fuel.
   - SAP Analytics Cloud (SAC) Dev & SAC Prod - Pelaporan analitik bisnis eksekutif, integrasi live CDS views, story building, role & permission.
   - Enterprise Marketing System (http://marketing.jhonlingroup.id) - Persetujuan kontrak komersial, sales pipeline, meeting notes, customer relationship management.
   - KPI Safety (SHE) (http://she.jhonlingroup.id/login) - K3 (Keselamatan & Kesehatan Kerja), kepatuhan lingkungan hidup, pelaporan & investigasi insiden, safety audit.
   - PPPN (http://38.47.92.151:5000) - Payment Plant Payment Notification, otomasi validasi penagihan vendor & operasional pabrik.
   - File Manager (http://file.jhonlingroup.id/login) - Penyimpanan berkas enterprise terpusat & cloud internal.
2. Menguasai arsitektur pengembangan perangkat lunak modern:
   - SAPUI5 / OpenUI5, SAP Horizon Evening Dark Design, XML Views, Controllers, Data Binding, Component Lifecycle.
   - SAP CDS Views, ABAP RESTful Application Programming (RAP), OData v2/v4.
   - REST API, Express.js, Nginx reverse proxy, CORS, dan SSL/TLS hardening.
3. Selalu siap memberikan kode implementasi, panduan pemecahan masalah (troubleshooting), dan arahan link sistem.

Pedoman Format:
- Gunakan Bahasa Indonesia yang profesional, ramah, dan teknis namun mudah dipahami.
- Gunakan formatting Markdown kaya (bullet points, bold, inline code, dan code block dengan bahasa seperti \`\`\`xml, \`\`\`javascript, \`\`\`abap).
- Jika menyebutkan aplikasi, sertakan tautan URL-nya jika relevan.`;

// 2. Chat API (with intelligent caching & fallback)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, documentContext, model, currentRoute } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array diperlukan' });
    }

    let contextualPrompt = SYSTEM_PROMPT_BASE;
    if (currentRoute) {
      contextualPrompt += `\nLOKASI PENGGUNA SAAT INI DI PORTAL: ${currentRoute}`;
    }
    if (documentContext && documentContext.trim()) {
      contextualPrompt += `\n\nKONTEKS DOKUMEN AKTIF SAAT INI:\n"""\n${documentContext.substring(0, 3500)}\n"""\nGunakan isi dokumen aktif ini untuk menjawab pertanyaan dengan presisi tinggi jika pertanyaan berkaitan.`;
    }

    const fullMessages = [
      { role: 'system', content: contextualPrompt },
      ...messages
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
    res.json(result);
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

    const cacheKey = `summary_${hashString(title + content.slice(0, 500))}`;
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
    res.json(result);
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
// STATIC FILES & SPA FALLBACK
// ==========================================

// Serve static resources from webapp directory
app.use(express.static(WEBAPP_DIR));

// Fallback for SPA routing - only for HTML route navigations (no file extension)
app.use((req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(WEBAPP_DIR, 'index.html'));
});

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
