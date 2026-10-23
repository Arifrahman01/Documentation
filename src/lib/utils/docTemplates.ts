export interface DocTemplate {
	id: string;
	name: string;
	badge: string;
	section: 'SAP' | 'SAC' | 'WEB';
	category: string;
	defaultTitle: string;
	description: string;
	tags: string[];
	content: string;
}

export const DOC_TEMPLATES: DocTemplate[] = [
	{
		id: 'sac-story',
		name: 'Template SAC Story',
		badge: 'SAC',
		section: 'SAC',
		category: 'Overview & BI',
		defaultTitle: 'Dokumentasi Story SAC — [Nama Modul]',
		description: 'Dokumentasi teknis Story SAP Analytics Cloud mencakup struktur halaman, data model, dimensi, dan rumus measure.',
		tags: ['SAC', 'Story', 'Dashboard', 'CDS View', 'Measure'],
		content: `## 1. Ringkasan Eksekutif & Tujuan Dashboard
Tuliskan tujuan utama dari Story SAC ini, siapa pengguna utamanya (Executive / Operation / Finance), dan indikator bisnis (KPI) apa yang dipantau.

> [!NOTE]
> **Informasi Story & Data Model**
> - **Nama Story SAC:** \`[Nama Story di SAC]\`
> - **Data Model / CDS View:** \`[Nama Model / ZCDS_...]\`
> - **Koneksi Data:** Live Data Connection / Import Data

---

## 2. Struktur Halaman (Pages & Visualisasi)

| Nama Page | Fokus Analitik | Komponen Visualisasi Utama | Filter / Input Control |
| :--- | :--- | :--- | :--- |
| **Page 1: Summary** | Ringkasan KPI Utama | KPI Numeric Point, Bar Chart Plan vs Actual | Periode ( Tahun / Bulan ), Plant |
| **Page 2: Detail** | Rincian Operasional | Tabel Hierarki, Trend Line Bulanan | Lokasi, Kategori Unit |

---

## 3. Spesifikasi Rumus (Calculated & Restricted Measures)

### A. Restricted Measures
| Nama Measure | Base Measure | Dimensi Pembatas (Restriction) | Keterangan |
| :--- | :--- | :--- | :--- |
| **Actual YtD** | \`Quantity / Amount\` | \`Version = Actual\`, \`Date = YTD\` | Realisasi tahun berjalan |
| **Budget / Plan** | \`Quantity / Amount\` | \`Version = Plan\` | Target anggaran |

### B. Calculated Measures
\`\`\`sql
-- Contoh Rumus Achievement (%)
[Achievement %] = ([Actual YtD] / [Budget / Plan]) * 100
\`\`\`

---

## 4. Dimensi Utama & Catatan Pemeliharaan
- **Dimensi Utama:** \`Date (Time)\`, \`Plant / Site\`, \`Cost Center\`, \`Material / Equipment\`.
- **Catatan Validasi Data:** Pastikan angka pada halaman Summary selalu sinkron dengan transaksi SAP S/4HANA pada akhir periode.`
	},
	{
		id: 'sap-abap',
		name: 'Template SAP / ABAP',
		badge: 'SAP',
		section: 'SAP',
		category: 'Integration & Development',
		defaultTitle: 'Spesifikasi Teknis SAP — [T-Code / Program]',
		description: 'Dokumentasi spesifikasi teknis program SAP ABAP, Function Module (RFC/BAPI), CDS View, dan tabel terkait.',
		tags: ['SAP', 'ABAP', 'S/4HANA', 'RFC', 'BAPI', 'Technical Spec'],
		content: `## 1. Identitas Objek & Ringkasan Fungsi

| Parameter | Nilai / Keterangan |
| :--- | :--- |
| **T-Code / Nama Program** | \`Z...\` |
| **Modul SAP** | \`FI / CO / MM / SD / PM\` |
| **Tipe Objek** | Report / RFC Function Module / CDS View / OData Service |
| **Transport Request (TR)** | \`DEVK9...\` |

> [!IMPORTANT]
> Jelaskan secara singkat proses bisnis yang diotomatisasi oleh program atau integrasi ini.

---

## 2. Arsitektur & Tabel SAP Terkait
- **Tabel Standar:** \`BKPF\`, \`BSEG\`, \`MARA\`, \`MSEG\`, \`EKKO\`, \`EKPO\`
- **Tabel Custom (Z-Table):** \`ZTB_...\`
- **BAPI / Function Module:** \`BAPI_...\`

---

## 3. Parameter Input & Output

| Nama Parameter | Tipe (Import/Export/Table) | Data Element / Struktur | Wajib? | Deskripsi |
| :--- | :--- | :--- | :---: | :--- |
| \`IV_BUKRS\` | Import | \`BUKRS\` | Ya | Company Code |
| \`IV_GJAHR\` | Import | \`GJAHR\` | Ya | Tahun Fiskal |
| \`ET_DATA\` | Table / Export | \`ZTT_DATA\` | - | Hasil ekstraksi data |

---

## 4. Implementasi Kode / Logika Utama

\`\`\`abap
" Contoh pemanggilan logika utama / CDS / BAPI
SELECT bukrs, belnr, gjahr, budat
  FROM bkpf
  INTO TABLE @DATA(lt_bkpf)
  WHERE bukrs = @iv_bukrs
    AND gjahr = @iv_gjahr.

IF sy-subrc = 0.
  " Proses validasi & mapping data
ENDIF.
\`\`\`

---

## 5. Skenario Pengujian & Penanganan Error
- [ ] Uji dengan parameter Company Code valid di sistem Development.
- [ ] Pastikan otorisasi objek (\`AUTHORITY-CHECK\`) berjalan sesuai role pengguna.`
	},
	{
		id: 'web-api',
		name: 'Template Web & API',
		badge: 'WEB',
		section: 'WEB',
		category: 'API & Backend',
		defaultTitle: 'Dokumentasi Fitur / API — [Nama Modul]',
		description: 'Dokumentasi teknis arsitektur aplikasi web, spesifikasi REST API endpoint, payload, dan konfigurasi.',
		tags: ['WEB', 'API', 'Architecture', 'Backend', 'Frontend'],
		content: `## 1. Gambaran Umum (Overview)
Jelaskan fungsi modul, alur kerja pengguna, atau layanan backend yang didokumentasikan pada halaman ini.

> [!TIP]
> **Endpoint / Route Utama:** \`POST /api/v1/resource\`

---

## 2. Spesifikasi Request & Payload

| Field / Parameter | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| \`id\` | \`string\` | Ya | Identitas unik transaksi |
| \`status\` | \`string\` | Tidak | Status pemrosesan (\`ACTIVE\` / \`PENDING\`) |

### Contoh Request JSON
\`\`\`json
{
  "id": "TRX-2026-001",
  "status": "ACTIVE",
  "payload": {
    "plant": "JHL-01"
  }
}
\`\`\`

### Contoh Response Sukses (\`200 OK\`)
\`\`\`json
{
  "success": true,
  "message": "Data berhasil disimpan",
  "timestamp": "2026-10-23T10:00:00Z"
}
\`\`\`

---

## 3. Langkah Konfigurasi & Pengujian
- [ ] Pastikan variabel environment (\`.env\`) telah terkonfigurasi.
- [ ] Jalankan pengujian endpoint dan periksa log respons.`
	},
	{
		id: 'sop-runbook',
		name: 'Template SOP / Troubleshooting',
		badge: 'SOP',
		section: 'SAP',
		category: 'Customizing & Configuration',
		defaultTitle: 'Panduan Troubleshooting & SOP — [Nama Kasus]',
		description: 'Catatan langkah penyelesaian masalah teknis (Runbook), analisis penyebab utama (Root Cause), dan prosedur operasional standar.',
		tags: ['SOP', 'Troubleshooting', 'Runbook', 'Operasional'],
		content: `## 1. Gejala Masalah / Pesan Error
Tuliskan gejala kendala yang dialami pengguna atau pesan error yang muncul di layar/log sistem.

> [!WARNING]
> **Pesan Error / Gejala:**
> \`[Tuliskan kode error atau gejala di sini]\`

---

## 2. Penyebab Utama (Root Cause)
- Jelaskan mengapa masalah ini terjadi (misal: periode posting belum dibuka, koneksi RFC terputus, atau master data belum lengkap).

---

## 3. Langkah Penyelesaian (Step-by-Step)
1. **Langkah Pertama:** Buka T-Code / menu terkait dan periksa status konfigurasi.
2. **Langkah Kedua:** Lakukan penyesuaian parameter sesuai tabel di bawah ini:

| Parameter | Nilai Sebelumnya | Nilai Seharusnya |
| :--- | :--- | :--- |
| \`Status Koneksi\` | \`Inactive\` | \`Active\` |

3. **Langkah Ketiga:** Simpan perubahan dan lakukan uji ulang (*re-test*).

---

## 4. Checklist Verifikasi & Pencegahan
- [ ] Masalah sudah teratasi dan dikonfirmasi oleh user terkait.
- [ ] Dokumentasi perubahan telah dicatat.`
	}
];

export const MARKDOWN_TABLE_SNIPPET = `\n| Kolom 1 | Kolom 2 | Kolom 3 |\n| :--- | :--- | :--- |\n| Isi 1 | Isi 2 | Isi 3 |\n| Isi 4 | Isi 5 | Isi 6 |\n`;

export const MARKDOWN_CHECKLIST_SNIPPET = `\n- [ ] Langkah pekerjaan pertama\n- [ ] Langkah pekerjaan kedua\n- [x] Langkah yang sudah selesai\n`;
