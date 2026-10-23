# API Reference Overview

Dokumentasi lengkap REST API, endpoint AI Copilot, layanan pencarian semantik, dan arsitektur integrasi sistem.

---

## 1. REST API Endpoints

Portal dokumentasi menyediakan backend REST API berbasis Express.js yang mendukung fitur pencarian, AI Copilot, dan perangkuman otomatis dokumen:

| Endpoint | Method | Deskripsi | Status |
|---|---|---|---|
| `/api/ai/chat` | `POST` | Tanya jawab cerdas berbasis AI Copilot | `Active` |
| `/api/ai/summarize` | `POST` | Pembuatan ringkasan eksekutif dokumen | `Active` |
| `/api/ai/quick-search` | `GET` | Panduan pencarian semantik & rekomendasi topik | `Active` |
| `/api/ai/status` | `GET` | Status kesehatan gateway AI dan model aktif | `Active` |

---

## 2. AI Copilot Chat API (`/api/ai/chat`)

Digunakan oleh floating assistant dan dialog AI untuk menjawab pertanyaan seputar sistem enterprise, arsitektur kode, dan dokumentasi aktif.

### Request Format
```json
POST /api/ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Bagaimana cara konfigurasi routing manifest di SAPUI5?" }
  ],
  "documentContext": "Konteks opsional dokumen aktif markdown",
  "currentRoute": "documentation / developing-apps",
  "model": "gemini-3.8-flash-medium"
}
```

### Response Format
```json
{
  "model": "gemini-3.8-flash-medium",
  "message": "Konfigurasi routing pada SAPUI5 didefinisikan di dalam `manifest.json` pada bagian `sap.ui5/routing`...",
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 340,
    "total_tokens": 460
  }
}
```

---

## 3. Summarize API (`/api/ai/summarize`)

Menganalisis isi dokumen teknis dan menghasilkan 3–4 poin ringkasan eksekutif secara instan dengan caching in-memory 2 jam.

### Request Format
```json
POST /api/ai/summarize
Content-Type: application/json

{
  "title": "Initialization Process",
  "content": "# Markdown content string..."
}
```

---

## 4. UI5 Core Architecture & Components

Aplikasi dibangun di atas standar arsitektur OpenUI5:
- **Component:** `doc.portal.Component` (`Component.js`)
- **Root Controller:** `doc.portal.controller.App`
- **Design System:** SAP Horizon (`sap_horizon` dan `sap_horizon_dark`)
- **Routing Engine:** Hash-based single page application (`sap.m.routing.Router`)
