const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, '..', 'data', 'documents.json');
const LIB_DOCS_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'documents.json');
const INDEX_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'docsIndex.json');

const FSD_MAPPINGS = {
	'sac/overview': {
		img: '/img/sac/fsd/operation-mining-1.png',
		alt: 'Arsitektur Integrasi SAP S/4HANA ke SAP Analytics Cloud (SAC) — FSD Reference'
	},
	'sac/finance-financial-performance': {
		img: '/img/sac/fsd/finance-2.png',
		alt: 'Tangkapan Layar Asli SAC Finance — Sheet 1: Financial Performance (Layout FSD)',
		sub: [
			{
				heading: '### 3.1 Ringkasan Kartu Metrik (Numeric Point Widgets)',
				img: '/img/sac/fsd/finance-3.png',
				alt: 'Tangkapan Layar Asli Widget 1 s/d 10 — Numeric Point KPIs'
			},
			{
				heading: '### 3.2 Monthly Performance (Combination Column & Line Chart)',
				img: '/img/sac/fsd/finance-8.png',
				alt: 'Tangkapan Layar Asli Widget 11 — Monthly Performance Combo Chart'
			},
			{
				heading: '### 3.3 Income Statement (Laporan Laba Rugi Komparatif)',
				img: '/img/sac/fsd/finance-9.png',
				alt: 'Tangkapan Layar Asli Widget 12 — Income Statement Hierarchical Table'
			}
		]
	},
	'sac/finance-position-covenant': {
		img: '/img/sac/fsd/finance-10.png',
		alt: 'Tangkapan Layar Asli SAC Finance — Sheet 2: Financial Position & Covenant Ratio (Layout FSD)',
		sub: [
			{
				heading: '### 3.1 Asset - Stacked Bar/Column Chart',
				img: '/img/sac/fsd/finance-11.png',
				alt: 'Tangkapan Layar Asli Widget 1 — Asset Stacked Bar/Column Chart'
			},
			{
				heading: '### 3.2 Liabilities & Equity - Stacked Bar/Column Chart',
				img: '/img/sac/fsd/finance-12.png',
				alt: 'Tangkapan Layar Asli Widget 2 — Liabilities & Equity Stacked Bar/Column Chart'
			},
			{
				heading: '### 3.3 Covenant Ratio - Table',
				img: '/img/sac/fsd/finance-13.png',
				alt: 'Tangkapan Layar Asli Widget 3 — Covenant Ratio Table'
			},
			{
				heading: '### 3.4 Loan - Pie Chart',
				img: '/img/sac/fsd/finance-14.png',
				alt: 'Tangkapan Layar Asli Widget 4 — Long Term Loan and Lease Pie Chart'
			},
			{
				heading: '### 3.5 Debt - Numeric Point Charts',
				img: '/img/sac/fsd/finance-15.png',
				alt: 'Tangkapan Layar Asli Widget 5 — Debt Numeric Point Charts'
			}
		]
	},
	'sac/finance-ap-ar-highlight': {
		img: '/img/sac/fsd/finance-16.png',
		alt: 'Tangkapan Layar Asli SAC Finance — Sheet 3: AP & AR Highlight (Layout FSD)',
		sub: [
			{
				heading: '### 3.1 Accounts Payable - Table',
				img: '/img/sac/fsd/finance-17.png',
				alt: 'Tangkapan Layar Asli Widget 1 — Accounts Payable Table'
			},
			{
				heading: '### 3.2 Accounts Receivable - Table',
				img: '/img/sac/fsd/finance-18.png',
				alt: 'Tangkapan Layar Asli Widget 2 — Accounts Receivable Table'
			}
		]
	},
	'sac/finance-cash-position': {
		img: '/img/sac/fsd/finance-19.png',
		alt: 'Tangkapan Layar Asli SAC Finance — Sheet 4: Cash Position (Layout FSD)',
		sub: [
			{
				heading: '### 3.1 Cash / Bank Position - Numeric Point',
				img: '/img/sac/fsd/finance-20.png',
				alt: 'Tangkapan Layar Asli Widget 1 — Cash in Bank Numeric Point'
			},
			{
				heading: '### 3.2 Cash Position per Month - Table (Running Sum)',
				img: '/img/sac/fsd/finance-21.png',
				alt: 'Tangkapan Layar Asli Widget 2 — Cash Position by Month'
			},
			{
				heading: '### 3.3 Cash In, Cash Out per Month - Bar/Column Chart',
				img: '/img/sac/fsd/finance-22.png',
				alt: 'Tangkapan Layar Asli Widget 3 — Cash in Cash out by Month'
			},
			{
				heading: '### 3.4 Cash Out by Bank - Bar/Column Chart',
				img: '/img/sac/fsd/finance-23.png',
				alt: 'Tangkapan Layar Asli Widget 4 — Cash out by Bank'
			},
			{
				heading: '### 3.5 Exchange Rate to IDR - Table',
				img: '/img/sac/fsd/finance-24.png',
				alt: 'Tangkapan Layar Asli Widget 5 — Exchange Rate to IDR Table'
			}
		]
	},
	'sac/finance-coal-price-benchmark': {
		img: '/img/sac/fsd/finance-25.png',
		alt: 'Tangkapan Layar Asli SAC Finance — Sheet 5: Coal Price Actual & Benchmark (Layout FSD)',
		sub: [
			{
				heading: '### 3.1 Actual Price - Line Chart',
				img: '/img/sac/fsd/finance-26.png',
				alt: 'Tangkapan Layar Asli Widget 1 — Actual Price Line Chart'
			},
			{
				heading: '### 3.2 Harga Batubara Acuan (HBA) - Line Chart',
				img: '/img/sac/fsd/finance-27.png',
				alt: 'Tangkapan Layar Asli Widget 2 — Harga Batubara Acuan (HBA) Line Chart'
			},
			{
				heading: '### 3.3 Indonesia Coal Index (ICI) - Line Chart',
				img: '/img/sac/fsd/finance-28.png',
				alt: 'Tangkapan Layar Asli Widget 3 — Indonesia Coal Index (ICI) Line Chart'
			}
		]
	},
	'sac/marketing-price-quantity-benchmark': {
		img: '/img/sac/fsd/marketing-3.png',
		alt: 'Tangkapan Layar Asli SAC Marketing — Sheet 1: Price & Quantity Benchmark (Layout FSD)'
	},
	'sac/marketing-inventory-stock': {
		img: '/img/sac/fsd/marketing-14.png',
		alt: 'Tangkapan Layar Asli SAC Marketing — Sheet 2: Inventory Stock & Transit Position (Layout FSD)'
	},
	'sac/pnl-segment-jg': {
		img: '/img/sac/fsd/pnl-mining-3.png',
		alt: 'Tangkapan Layar Asli SAC PnL Segment — Jhonlin Group (JG) Konsolidasi (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Group Consolidated P&L Overview',
				img: '/img/sac/fsd/pnl-mining-3.png',
				alt: 'Tangkapan Layar Asli PnL Segment JG — Halaman 1 Overview'
			},
			{
				heading: '### Halaman 2: Segment Contribution Matrix (Mining vs Marine vs Port)',
				img: '/img/sac/fsd/pnl-mining-22.png',
				alt: 'Tangkapan Layar Asli PnL Segment JG — Halaman 2 Segment Contribution Matrix'
			},
			{
				heading: '### Halaman 3: Intercompany Eliminations & Clean Margin',
				img: '/img/sac/fsd/pnl-mining-24.png',
				alt: 'Tangkapan Layar Asli PnL Segment JG — Halaman 3 Intercompany Eliminations'
			}
		]
	},
	'sac/pnl-segment-jb': {
		img: '/img/sac/fsd/pnl-mining-26.png',
		alt: 'Tangkapan Layar Asli SAC PnL Segment — Jhonlin Baratama (JB) Mining Profitability (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Mining Profitability & Unit Cost per Ton',
				img: '/img/sac/fsd/pnl-mining-26.png',
				alt: 'Tangkapan Layar Asli PnL JB — Halaman 1 Mining Profitability & Unit Cost'
			},
			{
				heading: '### Halaman 2: Cost Breakdown Analysis (BBM, Sparepart & Kontraktor)',
				img: '/img/sac/fsd/pnl-mining-29.png',
				alt: 'Tangkapan Layar Asli PnL JB — Halaman 2 Cost Breakdown Analysis'
			},
			{
				heading: '### Halaman 3: Pit-by-Pit Margin Comparison',
				img: '/img/sac/fsd/pnl-mining-30.png',
				alt: 'Tangkapan Layar Asli PnL JB — Halaman 3 Pit-by-Pit Margin'
			}
		]
	},
	'sac/pnl-segment-dsp': {
		img: '/img/sac/fsd/pnl-mining-39.png',
		alt: 'Tangkapan Layar Asli SAC PnL Segment — Dua Samudera Perkasa (DSP) Port Revenue & Throughput (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Port Revenue & Terminal Operating Margin',
				img: '/img/sac/fsd/pnl-mining-39.png',
				alt: 'Tangkapan Layar Asli PnL DSP — Halaman 1 Port Revenue & Operating Margin'
			},
			{
				heading: '### Halaman 2: Port Infrastructure Cost Structure',
				img: '/img/sac/fsd/pnl-mining-42.png',
				alt: 'Tangkapan Layar Asli PnL DSP — Halaman 2 Infrastructure Cost Structure'
			},
			{
				heading: '### Halaman 3: Tariff Realization & Volume Sensitivity',
				img: '/img/sac/fsd/pnl-mining-43.png',
				alt: 'Tangkapan Layar Asli PnL DSP — Halaman 3 Tariff Realization'
			}
		]
	},
	'sac/pnl-segment-jml': {
		img: '/img/sac/fsd/pnl-mining-52.png',
		alt: 'Tangkapan Layar Asli SAC PnL Segment — Jhonlin Marine Lines (JML) Shipping Revenue (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Shipping Revenue & Operating Profit',
				img: '/img/sac/fsd/pnl-mining-52.png',
				alt: 'Tangkapan Layar Asli PnL JML — Halaman 1 Shipping Revenue & Operating Profit'
			},
			{
				heading: '### Halaman 2: Bunker Fuel Cost vs Freight Income',
				img: '/img/sac/fsd/pnl-mining-53.png',
				alt: 'Tangkapan Layar Asli PnL JML — Halaman 2 Bunker vs Freight'
			},
			{
				heading: '### Halaman 3: Vessel Route Profitability Ranking',
				img: '/img/sac/fsd/pnl-mining-54.png',
				alt: 'Tangkapan Layar Asli PnL JML — Halaman 3 Vessel Route Ranking'
			}
		]
	},
	'sac/pnl-trip-jmt': {
		img: '/img/sac/fsd/pnl-marine-6.png',
		alt: 'Tangkapan Layar Asli SAC PnL by Trip — Jhonlin Marine Trans (JMT) Voyage P&L Matrix (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Voyage Margin & Net Profit per Trip',
				img: '/img/sac/fsd/pnl-marine-6.png',
				alt: 'Tangkapan Layar Asli PnL Trip JMT — Halaman 1 Voyage Margin'
			},
			{
				heading: '### Halaman 2: Trip Bunker Fuel Variance Analysis',
				img: '/img/sac/fsd/pnl-marine-16.png',
				alt: 'Tangkapan Layar Asli PnL Trip JMT — Halaman 2 Bunker Variance'
			},
			{
				heading: '### Halaman 3: Port Dues, Agency & Demurrage Summary',
				img: '/img/sac/fsd/pnl-marine-19.png',
				alt: 'Tangkapan Layar Asli PnL Trip JMT — Halaman 3 Port Dues & Demurrage'
			}
		]
	},
	'sac/pnl-trip-stm': {
		img: '/img/sac/fsd/pnl-marine-22.png',
		alt: 'Tangkapan Layar Asli SAC PnL by Trip — Samudera Tiga Mandiri (STM) Voyage P&L (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Voyage Net Income & Cost Contribution STM',
				img: '/img/sac/fsd/pnl-marine-22.png',
				alt: 'Tangkapan Layar Asli PnL Trip STM — Halaman 1 Voyage Net Income'
			},
			{
				heading: '### Halaman 2: Route Efficiency & Fuel Index per Voyage',
				img: '/img/sac/fsd/pnl-marine-33.png',
				alt: 'Tangkapan Layar Asli PnL Trip STM — Halaman 2 Fuel Index'
			},
			{
				heading: '### Halaman 3: Port Turnaround & Demurrage Settlement',
				img: '/img/sac/fsd/pnl-marine-36.png',
				alt: 'Tangkapan Layar Asli PnL Trip STM — Halaman 3 Port Turnaround'
			}
		]
	},
	'sac/pm-mining-fleet': {
		img: '/img/sac/fsd/pm-mining-3.png',
		alt: 'Tangkapan Layar Asli SAC PM Mining — Plant Maintenance Armada Gabungan (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Heavy Equipment Physical Availability & Health Index',
				img: '/img/sac/fsd/pm-mining-3.png',
				alt: 'Tangkapan Layar Asli PM Mining — Halaman 1 Physical Availability & Health Index'
			},
			{
				heading: '### Halaman 2: Maintenance Work Order & Preventive Ratio',
				img: '/img/sac/fsd/pm-mining-12.png',
				alt: 'Tangkapan Layar Asli PM Mining — Halaman 2 Work Order & Preventive Ratio'
			},
			{
				heading: '### Halaman 3: Reliability Metrics (MTBF & MTTR Trend)',
				img: '/img/sac/fsd/pm-mining-21.png',
				alt: 'Tangkapan Layar Asli PM Mining — Halaman 3 MTBF & MTTR Trend'
			}
		]
	},
	'sac/pm-mining-jml-page1': {
		img: '/img/sac/fsd/pm-mining-37.png',
		alt: 'Tangkapan Layar Asli SAC PM Mining — Detail Unit Equipment HM, Wear & Backlog (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Individual Equipment Health & Hour Meter (HM) Tracking',
				img: '/img/sac/fsd/pm-mining-37.png',
				alt: 'Tangkapan Layar Asli PM Mining JML — Halaman 1 Equipment HM Tracking'
			},
			{
				heading: '### Halaman 2: Component Life & Wear Monitoring',
				img: '/img/sac/fsd/pm-mining-39.png',
				alt: 'Tangkapan Layar Asli PM Mining JML — Halaman 2 Component Wear'
			},
			{
				heading: '### Halaman 3: Sparepart Backlog & Workshop Requisition',
				img: '/img/sac/fsd/pm-mining-40.png',
				alt: 'Tangkapan Layar Asli PM Mining JML — Halaman 3 Sparepart Backlog'
			}
		]
	},
	'sac/pm-marine-fleet': {
		img: '/img/sac/fsd/pm-marine-5.png',
		alt: 'Tangkapan Layar Asli SAC PM Marine — Dry Docking & Machinery Maintenance (Layout FSD)',
		sub: [
			{
				heading: '### Halaman 1: Dry Docking Schedule & Class Survey Milestones',
				img: '/img/sac/fsd/pm-marine-5.png',
				alt: 'Tangkapan Layar Asli PM Marine — Halaman 1 Dry Docking Schedule'
			},
			{
				heading: '### Halaman 2: Main Engine & Auxiliary Machinery Running Hours',
				img: '/img/sac/fsd/pm-marine-11.png',
				alt: 'Tangkapan Layar Asli PM Marine — Halaman 2 Main Engine Running Hours'
			},
			{
				heading: '### Halaman 3: Critical Marine Spares & Survey Certificate Validity',
				img: '/img/sac/fsd/pm-marine-18.png',
				alt: 'Tangkapan Layar Asli PM Marine — Halaman 3 Survey Certificates'
			}
		]
	},
	'sac/operation-mining-overview': {
		img: '/img/sac/fsd/operation-mining-1.png',
		alt: 'Arsitektur Data Flow S/4HANA ke SAC Operation Mining — FSD Reference'
	},
	'sac/op-mining-operational-overview': {
		img: '/img/sac/fsd/operation-mining-3.png',
		alt: 'Tangkapan Layar Asli SAC Operation Mining — Sheet 1: Operational Overview JB (Layout FSD)',
		sub: [
			{
				heading: '### A. Overburden (OB) Removal Performance',
				img: '/img/sac/fsd/operation-mining-4.png',
				alt: 'Tangkapan Layar Asli Overburden (OB) Removal Component'
			},
			{
				heading: '### B. Coal Mining Production Performance',
				img: '/img/sac/fsd/operation-mining-5.png',
				alt: 'Tangkapan Layar Asli Coal Mining Production Component'
			},
			{
				heading: '### C. Fuel Ratio & Strip Ratio (SR)',
				img: '/img/sac/fsd/operation-mining-7.png',
				alt: 'Tangkapan Layar Asli Strip Ratio and Cost Component'
			},
			{
				heading: '## 3. Visualisasi Tren & Distribusi per Pit',
				img: '/img/sac/fsd/operation-mining-8.png',
				alt: 'Tangkapan Layar Asli YTD Production Chart per Pit'
			}
		]
	},
	'sac/op-mining-equipment-status': {
		img: '/img/sac/fsd/operation-mining-16.png',
		alt: 'Tangkapan Layar Asli SAC Operation Mining — Sheet 2: Equipment Status & Availability JB (Layout FSD)',
		sub: [
			{
				heading: '## 2. Metrik Standar Ketersediaan Alat (Availability Metrics)',
				img: '/img/sac/fsd/operation-mining-17.png',
				alt: 'Tangkapan Layar Asli Availability Metrics Component'
			},
			{
				heading: '## 3. Komponen Visualisasi',
				img: '/img/sac/fsd/operation-mining-23.png',
				alt: 'Tangkapan Layar Asli Fleet Breakdown & Pareto Downtime Component'
			}
		]
	},
	'sac/op-mining-production-logistics': {
		img: '/img/sac/fsd/operation-mining-29.png',
		alt: 'Tangkapan Layar Asli SAC Operation Mining — Sheet 3: Production & Logistics Performance DSP (Layout FSD)',
		sub: [
			{
				heading: '## 2. Struktur Widget & Tabel Analisis',
				img: '/img/sac/fsd/operation-mining-30.png',
				alt: 'Tangkapan Layar Asli Hauling Cycle Time & Stockpile Aging Component'
			}
		]
	},
	'sac/op-mining-cost-asset-utilization': {
		img: '/img/sac/fsd/operation-mining-39.png',
		alt: 'Tangkapan Layar Asli SAC Operation Mining — Sheet 4: Cost Control & Asset Utilization DSP (Layout FSD)',
		sub: [
			{
				heading: '## 2. Metrik & Analisis Utama',
				img: '/img/sac/fsd/operation-mining-40.png',
				alt: 'Tangkapan Layar Asli Handling Cost & Asset Utilization Component'
			}
		]
	},
	'sac/operation-marine-overview': {
		img: '/img/sac/fsd/operation-marine-1.png',
		alt: 'Arsitektur Data Flow S/4HANA ke SAC Operation Marine — FSD Reference'
	},
	'sac/op-marine-activity-available-unit': {
		img: '/img/sac/fsd/operation-marine-3.png',
		alt: 'Tangkapan Layar Asli SAC Operation Marine — Sheet 1: Activity & Available Unit (Layout FSD)',
		sub: [
			{
				heading: '## 2. Struktur Widget & Metrik Kunci',
				img: '/img/sac/fsd/operation-marine-4.png',
				alt: 'Tangkapan Layar Asli Activity & Available Unit Components'
			}
		]
	},
	'sac/op-marine-cost-sales-period': {
		img: '/img/sac/fsd/operation-marine-8.png',
		alt: 'Tangkapan Layar Asli SAC Operation Marine — Sheet 2: Cost & Sales Period (Layout FSD)',
		sub: [
			{
				heading: '## 2. Struktur Widget Utama',
				img: '/img/sac/fsd/operation-marine-9.png',
				alt: 'Tangkapan Layar Asli Monthly Revenue vs Cost & Breakdown Components'
			}
		]
	},
	'sac/op-marine-cost-sales-date': {
		img: '/img/sac/fsd/operation-marine-12.png',
		alt: 'Tangkapan Layar Asli SAC Operation Marine — Sheet 3: Cost & Sales Date (Layout FSD)',
		sub: [
			{
				heading: '## 2. Komponen Filter & Tabel',
				img: '/img/sac/fsd/operation-marine-13.png',
				alt: 'Tangkapan Layar Asli Granular Daily Vessel Table Component'
			}
		]
	},
	'sac/op-marine-stevedoring-activity': {
		img: '/img/sac/fsd/operation-marine-16.png',
		alt: 'Tangkapan Layar Asli SAC Operation Marine — Sheet 4: Stevedoring Activity JML (Layout FSD)',
		sub: [
			{
				heading: '## 2. Struktur Widget & Metrik Kunci',
				img: '/img/sac/fsd/operation-marine-17.png',
				alt: 'Tangkapan Layar Asli Floating Crane Readiness & Stevedoring Volumes'
			}
		]
	}
};

const sourcePath = fs.existsSync(LIB_DOCS_PATH) ? LIB_DOCS_PATH : DOCS_PATH;
const docs = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
let updatedCount = 0;

for (const doc of docs) {
	const cfg = FSD_MAPPINGS[doc.slug];
	if (!cfg) continue;

	// Strip out any previous images so we cleanly insert authentic FSD screenshots
	let content = doc.content.replace(/\n*!\[[^\]]*\]\(\/img\/sac\/[^)]+\)\n*/g, '\n\n');

	// Insert main authentic FSD layout screenshot
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

	// Insert sub-widget authentic screenshots right under each matching heading
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

console.log(`Successfully embedded authentic FSD images and widgets into ${updatedCount} SAC documents.`);
