const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, '..', 'data', 'documents.json');
const LIB_DOCS_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'documents.json');
const INDEX_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'docsIndex.json');

const MAIN_IMAGES = {
	'sac/overview': {
		img: '/img/sac/sac-overview-architecture.svg',
		alt: 'Arsitektur SAP Analytics Cloud (SAC) — 3 Pilar & Integrasi Live CDS S/4HANA'
	},
	'sac/finance-financial-performance': {
		img: '/img/sac/finance-financial-performance.svg',
		alt: 'Dashboard SAC Finance — Sheet 1: Financial Performance (Widget 1 s/d 12)',
		sub: [
			{
				heading: '### 3.1 Ringkasan Kartu Metrik (Numeric Point Widgets)',
				img: '/img/sac/finance-fp-kpi-cards.svg',
				alt: 'Detail Widget 1 s/d 10 — Kartu Metrik Numeric Point (Revenue, Gross Profit, Operating Profit, Net Profit & EBITDA)'
			},
			{
				heading: '### 3.2 Monthly Performance (Combination Column & Line Chart)',
				img: '/img/sac/finance-fp-w11-combo.svg',
				alt: 'Detail Widget 11 — Monthly Performance Combination Column & Line Chart'
			},
			{
				heading: '### 3.3 Income Statement (Laporan Laba Rugi Komparatif)',
				img: '/img/sac/finance-fp-w12-table.svg',
				alt: 'Detail Widget 12 — Tabel Hierarki Income Statement (FSV J000)'
			}
		]
	},
	'sac/finance-position-covenant': {
		img: '/img/sac/finance-position-covenant.svg',
		alt: 'Dashboard SAC Finance — Sheet 2: Financial Position & Coverage Ratios (Widget 1 s/d 5)',
		sub: [
			{
				heading: '### 3.1 Asset - Stacked Bar/Column Chart',
				img: '/img/sac/finance-pos-w1-asset.svg',
				alt: 'Detail Widget 1 — Asset Stacked Column Chart (Current vs Non-Current Asset)'
			},
			{
				heading: '### 3.2 Liabilities & Equity - Stacked Bar/Column Chart',
				img: '/img/sac/finance-pos-w2-liab.svg',
				alt: 'Detail Widget 2 — Liabilities & Equity Stacked Column Chart'
			},
			{
				heading: '### 3.3 Covenant Ratio - Table',
				img: '/img/sac/finance-pos-w3-covenant.svg',
				alt: 'Detail Widget 3 — Tabel Rasio Kepatuhan Kredit (Covenant Ratio)'
			},
			{
				heading: '### 3.4 Loan - Pie Chart',
				img: '/img/sac/finance-pos-w4-w5-debt.svg',
				alt: 'Detail Widget 4 & 5 — Loan Pie Chart & Debt Numeric Point Trellis'
			}
		]
	},
	'sac/finance-ap-ar-highlight': {
		img: '/img/sac/finance-ap-ar-highlight.svg',
		alt: 'Dashboard SAC Finance — Sheet 3: AP & AR Highlight (Tabel Aging Hutang & Piutang Usaha)',
		sub: [
			{
				heading: '### 3.1 Accounts Payable - Table',
				img: '/img/sac/finance-ap-w1-table.svg',
				alt: 'Detail Widget 1 — Accounts Payable (AP) Aging Schedule Table'
			},
			{
				heading: '### 3.2 Accounts Receivable - Table',
				img: '/img/sac/finance-ar-w2-table.svg',
				alt: 'Detail Widget 2 — Accounts Receivable (AR) Aging Schedule Table'
			}
		]
	},
	'sac/finance-cash-position': {
		img: '/img/sac/finance-cash-position.svg',
		alt: 'Dashboard SAC Finance — Sheet 4: Cash Position (Numeric Point, Running Sum Table, Cash In/Out & Kurs)'
	},
	'sac/finance-coal-price-benchmark': {
		img: '/img/sac/finance-coal-price-benchmark.svg',
		alt: 'Dashboard SAC Finance — Sheet 5: Coal Price & Actual Benchmark (Actual Price, HBA & ICI 1-5 Line Charts)'
	},
	'sac/marketing-price-quantity-benchmark': {
		img: '/img/sac/marketing-price-quantity-benchmark.svg',
		alt: 'Dashboard SAC Marketing — Sheet 1: Price & Quantity Benchmark (Widget 1 s/d 13)',
		sub: [
			{
				heading: '### 3.2 Monthly Sales Quantity & Price vs Benchmark (HPB & ICI)',
				img: '/img/sac/marketing-pq-w7-combo.svg',
				alt: 'Detail Widget 7 — Monthly Sales Quantity & Price vs Benchmark (HPB & ICI)'
			}
		]
	},
	'sac/marketing-inventory-stock': {
		img: '/img/sac/marketing-inventory-stock.svg',
		alt: 'Dashboard SAC Marketing — Sheet 2: Inventory Stock & In-Transit Position (DSP Stockpile & Movement 309)',
		sub: [
			{
				heading: '### 3.4 Monitoring Persediaan Transit (In-Transit by Port of Loading)',
				img: '/img/sac/marketing-inv-w5-w6-transit.svg',
				alt: 'Detail Widget 5 & 6 — Tabel In-Transit Quantity & Persentase per Port of Loading (Movement 309)'
			}
		]
	},
	'sac/pnl-segment-jg': {
		img: '/img/sac/pnl-segment-jg.svg',
		alt: 'Dashboard SAC PnL Segment — Jhonlin Group (JG) Konsolidasi & Eliminasi Intercompany'
	},
	'sac/pnl-segment-jb': {
		img: '/img/sac/pnl-segment-jb.svg',
		alt: 'Dashboard SAC PnL Segment — Jhonlin Baratama (JB) Unit Margin Waterfall, Cost Structure & Pit Margin'
	},
	'sac/pnl-segment-dsp': {
		img: '/img/sac/pnl-segment-dsp.svg',
		alt: 'Dashboard SAC PnL Segment — Dua Samudera Perkasa (DSP) Port Revenue, Throughput & Cost Structure'
	},
	'sac/pnl-segment-jml': {
		img: '/img/sac/pnl-segment-jml.svg',
		alt: 'Dashboard SAC PnL Segment — Jhonlin Marine Lines (JML) Freight Revenue, Bunker Correlation & Route Ranking'
	},
	'sac/pm-mining-fleet': {
		img: '/img/sac/pm-mining-fleet.svg',
		alt: 'Dashboard SAC PM Mining — Armada Gabungan (Physical Availability, Work Order Ratio & MTBF/MTTR)'
	},
	'sac/pm-mining-jml-page1': {
		img: '/img/sac/pm-mining-jml-page1.svg',
		alt: 'Dashboard SAC PM Mining — Detail Unit Equipment HM, Component Life Wear & Sparepart Backlog'
	},
	'sac/pm-marine-fleet': {
		img: '/img/sac/pm-marine-fleet.svg',
		alt: 'Dashboard SAC PM Marine — Dry Docking Schedule, Main Engine Running Hours & Survey Certificates'
	},
	'sac/pnl-trip-jmt': {
		img: '/img/sac/pnl-trip-jmt.svg',
		alt: 'Dashboard SAC PnL by Trip — Jhonlin Marine Trans (JMT) Voyage P&L Matrix & Bunker Variance'
	},
	'sac/pnl-trip-stm': {
		img: '/img/sac/pnl-trip-stm.svg',
		alt: 'Dashboard SAC PnL by Trip — Samudera Tiga Mandiri (STM) Voyage Waterfall, Fuel Index & Laytime Settlement'
	},
	'sac/operation-mining-overview': {
		img: '/img/sac/operation-mining-overview.svg',
		alt: 'Arsitektur SAC Operation Mining — 4-Sheet Pit-to-Port Solution & S/4HANA Data Flow'
	},
	'sac/op-mining-operational-overview': {
		img: '/img/sac/op-mining-operational-overview.svg',
		alt: 'Dashboard SAC Operation Mining — Sheet 1: Operational Overview (OB Removal, Coal Getting, Strip Ratio & Pit)'
	},
	'sac/op-mining-equipment-status': {
		img: '/img/sac/op-mining-equipment-status.svg',
		alt: 'Dashboard SAC Operation Mining — Sheet 2: Equipment Status (PA/MA/UA Gauges, Fleet Bar & Pareto Breakdown)'
	},
	'sac/op-mining-production-logistics': {
		img: '/img/sac/op-mining-production-logistics.svg',
		alt: 'Dashboard SAC Operation Mining — Sheet 3: Production & Logistics (Hauling Cycle, Barging TPH & Stockpile Aging)'
	},
	'sac/op-mining-cost-asset-utilization': {
		img: '/img/sac/op-mining-cost-asset-utilization.svg',
		alt: 'Dashboard SAC Operation Mining — Sheet 4: Cost Control & Asset Utilization (Handling Cost, Conveyor & BOR %)'
	},
	'sac/operation-marine-overview': {
		img: '/img/sac/operation-marine-overview.svg',
		alt: 'Arsitektur SAC Operation Marine — Klasifikasi Armada Laut & Struktur 4 Sheet Pelayaran'
	},
	'sac/op-marine-activity-available-unit': {
		img: '/img/sac/op-marine-activity-available-unit.svg',
		alt: 'Dashboard SAC Operation Marine — Sheet 1: Activity & Available Unit (Kesiapan Kapal, Timesheet & Siklus Trip)'
	},
	'sac/op-marine-cost-sales-period': {
		img: '/img/sac/op-marine-cost-sales-period.svg',
		alt: 'Dashboard SAC Operation Marine — Sheet 2: Cost & Sales Period (Pendapatan vs Biaya Bulanan & Komposisi Biaya)'
	},
	'sac/op-marine-cost-sales-date': {
		img: '/img/sac/op-marine-cost-sales-date.svg',
		alt: 'Dashboard SAC Operation Marine — Sheet 3: Cost & Sales Date (Filter Tanggal & Tabel Transaksi Harian Kapal)'
	},
	'sac/op-marine-stevedoring-activity': {
		img: '/img/sac/op-marine-stevedoring-activity.svg',
		alt: 'Dashboard SAC Operation Marine — Sheet 4: Stevedoring Activity (Floating Crane, Export/Dom & Geared/Gearless)'
	}
};

const sourcePath = fs.existsSync(LIB_DOCS_PATH) ? LIB_DOCS_PATH : DOCS_PATH;
const docs = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
let updatedCount = 0;

for (const doc of docs) {
	const cfg = MAIN_IMAGES[doc.slug];
	if (!cfg) continue;

	// Clean any previously injected SAC images for idempotency
	let content = doc.content.replace(/\n*!\[[^\]]*\]\(\/img\/sac\/[^)]+\)\n*/g, '\n\n');

	// Insert main SAC Story overview image right before the second `## ` heading (or at end of intro)
	const h2Matches = [...content.matchAll(/^## .+$/gm)];
	const mainMd = `\n\n![${cfg.alt}](${cfg.img})\n\n`;

	if (h2Matches.length >= 2) {
		const insertIdx = h2Matches[1].index;
		content = content.slice(0, insertIdx).trimEnd() + mainMd + content.slice(insertIdx);
	} else if (h2Matches.length === 1) {
		const firstLineEnd = content.indexOf('\n', h2Matches[0].index);
		content = content.slice(0, firstLineEnd) + mainMd + content.slice(firstLineEnd + 1);
	} else {
		content = mainMd + content;
	}

	// Insert sub-widget images right after their matching ### heading
	if (cfg.sub) {
		for (const s of cfg.sub) {
			const idx = content.indexOf(s.heading);
			if (idx !== -1) {
				const lineEnd = content.indexOf('\n', idx);
				const subMd = `\n\n![${s.alt}](${s.img})\n`;
				content = content.slice(0, lineEnd) + subMd + content.slice(lineEnd);
			}
		}
	}

	doc.content = content;
	updatedCount++;
}

fs.writeFileSync(DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
fs.writeFileSync(LIB_DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
if (fs.existsSync(INDEX_PATH)) {
	fs.writeFileSync(INDEX_PATH, JSON.stringify({ documents: docs }, null, '\t') + '\n', 'utf8');
}

console.log(`Successfully embedded SAC widget images into ${updatedCount} SAC documents in both data/ and src/lib/data/.`);
