const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, '..', 'data', 'documents.json');
const LIB_DOCS_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'documents.json');
const INDEX_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'docsIndex.json');

const SAC_SC_URL =
	'https://sacprod-jhonlin.ap11.analytics.cloud.sap/sap/fpa/ui/tenants/6c653/bo/story/4A107806C1698E44B17C181D613BBA5F';

const newDocs = [
	{
		id: 'sac/supply-chain-procurement-cycle',
		slug: 'sac/supply-chain-procurement-cycle',
		section: 'SAC',
		category: 'Supply Chain',
		title: 'Sheet 1: Procurement Cycle — Lead Time & Status Dokumen PO/PR',
		description:
			'Dokumentasi SAC Supply Chain Sheet 1: Monitoring lead time siklus pengadaan (PR Release to PO Received), rasio PO Release vs Outstanding, dan perbandingan volume serta nilai PR terhadap PO.',
		snippet:
			'Monitoring lead time siklus pengadaan (PR to PO Received), rasio PO Outstanding, dan analisis PR vs PO.',
		tags: ['SAC', 'Supply Chain', 'Procurement', 'Purchase Order', 'Lead Time'],
		updatedAt: '2026-10-24T00:50:00.000Z',
		sacUrl: SAC_SC_URL,
		content: `# Sheet 1: Procurement Cycle — Lead Time & Status Dokumen PO/PR

Dokumentasi fungsional dan teknis **SAP Analytics Cloud (SAC)** untuk modul **Supply Chain — Sheet 1: Procurement Cycle** berdasarkan dokumen spesifikasi *FSD Jhonlin_FSD_SACBI_R03_Supply Chain*.

---

![Tangkapan Layar Asli SAC Supply Chain — Sheet 1: Procurement Cycle (Layout FSD)](/img/sac/fsd/supply-chain-3.png)

---

## 1. Ringkasan & Ruang Lingkup Analitik

Sheet **Procurement Cycle** dirancang untuk memberikan visibilitas end-to-end terhadap efisiensi rantai pengadaan barang dan jasa di seluruh unit usaha Jhonlin Group. Fokus analitik mencakup:
1. **Durasi Siklus Pengadaan (Procurement Cycle Time):** Mengukur kecepatan konversi dari *Purchase Requisition (PR)* hingga barang/jasa diterima (*PO Received / Goods Receipt*).
2. **Status Penerbitan & Eksekusi PO:** Memantau jumlah dokumen PO yang sudah dirilis, PO yang masih berstatus outstanding (terbuka), dan status penerimaan invoice (*Invoice Receipt / MIRO*).
3. **Komparasi Kuantitas & Nilai Nominal (PR vs PO):** Membandingkan kesesuaian antara rencana pengadaan (PR) dengan realisasi komitmen kontrak pembelian (PO).

---

## 2. Filter Global & Parameter Halaman

Parameter filter terintegrasi langsung dengan CDS View backend SAP S/4HANA:

| Nama Filter Input Control | Parameter / Dimensi Teknis | Sumber CDS View | Keterangan |
|---|---|---|---|
| **Period / Date Range** | \`PRCreatedDate\` (Start Date – End Date) | \`ZVBMMXX002_C\` | Rentang tanggal pembuatan PR |
| **Company Code** | \`CompanyCode\` (BUKRS) | \`ZVBMMXX002_C\` | Entitas anak usaha (JB, DSP, JML, STM, dll.) |
| **Purchasing Organization** | \`PurchasingOrganization\` (EKORG) | \`ZVBMMXX002_C\` | Organisasi pengadaan operasional |
| **Plant** | \`Plant\` (WERKS) | \`ZVBMMXX002_C\` | Lokasi site tambang / pelabuhan / galangan |
| **Material Group** | \`MaterialGroup\` (MATKL) | \`ZVBMMXX002_C\` | Kategori barang (Sparepart, Fuel, Consumable, Jasa) |
| **Procurement Category** | \`ProcurementCategory\` | \`ZVBMMXX002_C\` | Klasifikasi pengadaan strategis / rutin |

---

## 3. Spesifikasi Rinci Komponen Widget

### 3.1 Kartu Metrik Siklus Pengadaan (Procurement Cycle Time KPIs)
- **Average PR Release to PO Received (Days):** Rata-rata durasi waktu dari saat PR disetujui hingga barang diterima di site.
- **Dekomposisi Tahapan (Stacked Bar Chart):**
  - Tahap 1: *PR Created to PR Release (Days)* — Waktu persetujuan internal pemohon.
  - Tahap 2: *PR Release to PO Release (Days)* — Waktu tender, negosiasi vendor, dan penerbitan PO.
  - Tahap 3: *PO Release to PO Received (Days)* — Waktu fabrikasi dan pengiriman logistik oleh vendor.

### 3.2 Status Penerimaan Dokumen & Faktur (PO Received & Invoice Receipt)
- **Total Document PO Received:** Akumulasi PO yang telah berhasil diterima (*Goods Receipt / MIGO*).
- **Total Document Invoiced Receipt:** Dokumen yang sudah selesai verifikasi tagihan invoice (*MIRO*).
- **Stacked Bar Rasio Penagihan:** Proporsi persentase *No Invoice* vs *Invoice Posted* vs *Invoice Not Posted*.

### 3.3 Status Kesiapan PO (PO Release vs PO Outstanding)
- **Total Document PO Release:** Total PO aktif yang telah disetujui manajemen.
- **Total Document PO Outstanding:** Dokumen PO yang belum diselesaikan pengirimannya oleh vendor.
- **Stacked Bar Persentase:** Memantau rasio pemenuhan PO terhadap sisa komitmen pengadaan.

### 3.4 Volume & Nilai Komitmen (PR vs PO Comparison)
- **Bar Chart PR vs PO Quantity:** Menampilkan perbandingan jumlah baris item barang (*Line Items*).
- **Bar Chart PR vs PO Value (IDR):** Memantau total nilai anggaran PR dibandingkan realisasi nilai kontrak PO.
- **Line Chart Time-Series:** Tren bulanan pergerakan kuantitas dan nilai *PO Release vs Outstanding vs Received*.

---

## 4. Arsitektur Model SAC & Query CDS View

- **Model SAC:** \`JG_M_S4HLV_SC_PROCUREMENT\`
- **CDS View Sumber:** \`ZVBMMXX002_C\` (Universal Procurement Tracking CDS View)
- **Integrasi Live:** Menghubungkan tabel inti pengadaan SAP S/4HANA (\`EBAN\`, \`EBKN\`, \`EKKO\`, \`EKPO\`, \`EKBE\`) tanpa replikasi data ke cloud.`
	},
	{
		id: 'sac/supply-chain-supplier-performance',
		slug: 'sac/supply-chain-supplier-performance',
		section: 'SAC',
		category: 'Supply Chain',
		title: 'Sheet 2: Supplier Performance — Evaluasi Vendor & Lead Time Pengiriman',
		description:
			'Dokumentasi SAC Supply Chain Sheet 2: Evaluasi kinerja pemasok, On-Time In-Full (OTIF) delivery, lead time pengiriman vendor, analisis Pareto transaksi, dan peringkat PO per vendor.',
		snippet:
			'Evaluasi kinerja pemasok, OTIF delivery, lead time pengiriman vendor, dan Pareto nilai transaksi PO.',
		tags: ['SAC', 'Supply Chain', 'Vendor Evaluation', 'Supplier Performance', 'OTIF'],
		updatedAt: '2026-10-24T00:50:00.000Z',
		sacUrl: SAC_SC_URL,
		content: `# Sheet 2: Supplier Performance — Evaluasi Vendor & Lead Time Pengiriman

Dokumentasi fungsional dan teknis **SAP Analytics Cloud (SAC)** untuk modul **Supply Chain — Sheet 2: Supplier Performance** berdasarkan dokumen spesifikasi *FSD Jhonlin_FSD_SACBI_R03_Supply Chain*.

---

![Tangkapan Layar Asli SAC Supply Chain — Sheet 2: Supplier Performance (Layout FSD)](/img/sac/fsd/supply-chain-7.png)

---

## 1. Ringkasan & Ruang Lingkup Analitik

Sheet **Supplier Performance** didedikasikan untuk mengukur kualitas layanan, kepatuhan jadwal pengiriman, dan konsentrasi pengeluaran (*spend analysis*) terhadap seluruh mitra vendor pengadaan. Indikator utama meliputi:
1. **Aktivitas Vendor & Volume Transaksi:** Memetakan jumlah vendor aktif dalam 3 bulan terakhir, jumlah kontrak pengadaan, dan total baris item pesanan.
2. **Evaluasi Kecepatan Pengiriman (Lead Time Delivery):** Menghitung rata-rata hari pengiriman dari rilis PO hingga tiba di gudang, termasuk identifikasi pengiriman tercepat (*fastest*) dan terlambat (*slowest*).
3. **Analisis Pareto Transaksi:** Mengidentifikasi 20% vendor strategis yang memegang 80% nilai belanja perusahaan (*Spend Concentration*).

---

## 2. Struktur Widget & Metrik Evaluasi Vendor

### 2.1 Kartu Metrik Kinerja Vendor (Top KPI Cards)
- **Total Supplier Active in 3 Months:** Jumlah vendor unik yang memiliki transaksi aktif dalam kuartal berjalan.
- **Total Purchased Documents & Line Items:** Akumulasi volume PO yang diterbitkan.
- **Total Purchase Order Value (IDR):** Total nilai transaksi komitmen belanja.
- **Total PO Received Value vs Outstanding Value:** Realisasi nilai barang yang sudah masuk vs sisa pesanan tertunda.

### 2.2 Durasi Pengiriman Vendor (Delivery Duration KPIs)
- **Average Duration from PO Release until Delivered (Days):** Tolok ukur kecepatan pemenuhan vendor.
- **Fastest Delivered Item (Days):** Catatan pengiriman tersingkat untuk barang mendesak (*emergency order*).
- **Slowest Delivered Item (Days):** Peringatan dini keterlambatan barang kritis (*critical sparepart backlog*).

### 2.3 Visualisasi Distribusi & Kinerja Vendor
- **Pareto Total Transaction by Supplier (Combination Column & Line Chart):**
  - Bar: Nilai PO per vendor (IDR).
  - Garis: Persentase kumulatif kontribusi pengeluaran terhadap total belanja.
- **Top Supplier Performance Table:** Matriks rincian vendor memuat:
  - Total Belanja (Nilai PO IDR)
  - Jumlah Kuantitas Barang
  - Skor Kinerja Pengiriman (*Goods Receipt Performance %*)
  - Rata-rata Hari Pengiriman (*Average Delivery Days*)
- **PO Outstanding Qty & Value by Supplier:** Peringkat vendor dengan sisa pesanan tertunda tertinggi untuk tindak lanjut tim pengadaan (*expediting*).
- **Top PO Value & Quantity by Material:** Identifikasi komponen suku cadang atau komoditas dengan konsumsi biaya terbesar.`
	},
	{
		id: 'sac/supply-chain-closing-value-dead-stock',
		slug: 'sac/supply-chain-closing-value-dead-stock',
		section: 'SAC',
		category: 'Supply Chain',
		title: 'Sheet 3: Material Closing Value & Dead Stock Movement',
		description:
			'Dokumentasi SAC Supply Chain Sheet 3: Valuasi akhir persediaan material gudang per unit usaha dan plant, perbandingan harga satuan antar vendor, dan analisis Dead Stock persediaan mati (>90 hari).',
		snippet:
			'Valuasi persediaan material gudang, komparasi harga satuan vendor, dan monitoring Dead Stock (>90 hari).',
		tags: ['SAC', 'Supply Chain', 'Inventory Value', 'Dead Stock', 'Material Management'],
		updatedAt: '2026-10-24T00:50:00.000Z',
		sacUrl: SAC_SC_URL,
		content: `# Sheet 3: Material Closing Value & Dead Stock Movement

Dokumentasi fungsional dan teknis **SAP Analytics Cloud (SAC)** untuk modul **Supply Chain — Sheet 3: Closing Value All Unit & Dead Stock Movement** berdasarkan dokumen spesifikasi *FSD Jhonlin_FSD_SACBI_R03_Supply Chain*.

---

![Tangkapan Layar Asli SAC Supply Chain — Sheet 3: Closing Value & Dead Stock (Layout FSD)](/img/sac/fsd/supply-chain-17.png)

---

## 1. Ringkasan & Ruang Lingkup Analitik

Sheet **Closing Value All Unit & Dead Stock Movement** berfokus pada pengendalian nilai aset persediaan material di seluruh gudang (*Warehouse Storage Locations*) dan mitigasi risiko persediaan usang/mati (*Dead Stock*):
1. **Valuasi Saldo Akhir Persediaan (Closing Value Inventory):** Menghitung nilai buku persediaan material di gudang per akhir periode pembukuan untuk seluruh entitas anak usaha.
2. **Tren Komparasi Harga Satuan (Price Comparison by Vendor):** Membandingkan harga beli material sejenis antar vendor guna menjamin efisiensi biaya pengadaan (*best purchase price*).
3. **Pengawasan Persediaan Mati (Dead Stock Movement):** Mengidentifikasi material yang tidak mengalami mutasi pengeluaran (*no goods issue*) lebih dari 90 s/d 180 hari untuk mencegah depresiasi nilai dan penumpukan modal kerja.

---

## 2. Struktur Widget & Tabel Analisis Persediaan

### 2.1 Kartu Metrik Valuasi Persediaan (Total Inventory Value)
- **All Unit Usaha Inventory Value (IDR):** Total nilai persediaan konsolidasi seluruh unit bisnis.
- **Previous Year Comparison (YoY):** Variansi nominal dan persentase perubahan nilai persediaan terhadap tahun lalu.
- **Selected Unit Usaha Value:** Nilai persediaan spesifik unit usaha yang dipilih pada filter interaktif.

### 2.2 Visualisasi Distribusi Nilai Stok
- **Closing Value Inventory of Each Unit Usaha (Stacked Bar Chart):** Tren bulanan saldo persediaan per entitas (JB, DSP, JML, STM, dll.).
- **Closing Value by Plant & Storage Location:** Distribusi persediaan per fasilitas gudang site tambang dan dermaga.
- **Closing Value by Material Type (ROH, HIBE, ERSA):** Komposisi nilai stok bahan baku, barang pembantu, dan suku cadang (*Spareparts*).

### 2.3 Pengendalian Harga Satuan Material (Price Comparison)
- **Bar Chart Perbandingan Harga per Vendor:** Analisis variansi harga satuan (*Unit Price Variance*) untuk material identik yang dipasok oleh beberapa vendor berbeda.

### 2.4 Tabel Pengawasan Persediaan Mati (Inventory Dead Stock Table)
- **Struktur Kolom Tabel:**
  - Kode & Deskripsi Material (\`Material Number\` & \`Description\`)
  - Lokasi Gudang Penyimpanan (\`Storage Location / LGORT\`)
  - Hari Tanpa Mutasi (\`Aging Days No Movement\` — >90d, >180d, >360d)
  - Jumlah Stok Fisik (\`Dead Stock Quantity\`)
  - Total Nilai Buku Mengendap (\`Dead Stock Value IDR\`)
- **Tujuan Operasional:** Memicu aksi utilisasi transfer antar unit (*intercompany transfer*) atau proses pelelangan (*disposal/write-off*).`
	}
];

const sourcePath = fs.existsSync(LIB_DOCS_PATH) ? LIB_DOCS_PATH : DOCS_PATH;
let docs = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

// Remove if already exists for idempotency
const newSlugs = newDocs.map((d) => d.slug);
docs = docs.filter((d) => !newSlugs.includes(d.slug));

// Insert Supply Chain documents right after Marketing
const mktIdx = docs.findIndex((d) => d.slug && d.slug.startsWith('sac/marketing-'));
let insertAt = docs.length;
if (mktIdx !== -1) {
	// Find last marketing index
	let lastMkt = mktIdx;
	for (let i = mktIdx; i < docs.length; i++) {
		if (docs[i].slug && docs[i].slug.startsWith('sac/marketing-')) lastMkt = i;
	}
	insertAt = lastMkt + 1;
}

docs.splice(insertAt, 0, ...newDocs);

fs.writeFileSync(DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
fs.writeFileSync(LIB_DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
if (fs.existsSync(INDEX_PATH)) {
	fs.writeFileSync(INDEX_PATH, JSON.stringify({ documents: docs }, null, '\t') + '\n', 'utf8');
}

console.log(`Successfully added 3 Supply Chain documents at index ${insertAt}. Total docs: ${docs.length}`);
