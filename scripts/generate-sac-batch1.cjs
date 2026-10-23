const fs = require('fs');
const path = require('path');
const {
	sacCanvas,
	widgetFrame,
	kpiTile,
	comboChartWidget,
	horizontalBarWidget,
	multiLineWidget,
	tableWidget,
	donutWidget,
	waterfallWidget,
	saveSvg,
	esc
} = require('./sac-svg-lib.cjs');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

// ============================================================================
// 1. GENERATE ALL SAC STORY & WIDGET SVG ILLUSTRATIONS
// ============================================================================

// --- 1. sac/overview ---
saveSvg(
	'sac-overview-architecture.svg',
	sacCanvas({
		height: 520,
		storyTitle: 'SAP Analytics Cloud (SAC) — Enterprise BI & Live CDS Architecture',
		sheetTitle: '3 Pillars & S/4HANA Live Tunnel',
		connection: 'LIVE TUNNEL: SAP S/4HANA <-> SAC',
		filters: ['Landscape: Production (PRD)', 'Auth: SAML 2.0 SSO', 'Hierarchy: FSV J000'],
		body: `
      ${kpiTile({ x: 24, y: 116, w: 370, h: 110, id: 'PILAR 1', title: 'Business Intelligence (BI)', value: '24 Stories', unit: 'Interactive', delta: '▲ Real-time Drill-down & Cross-filter', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 414, y: 116, w: 370, h: 110, id: 'PILAR 2', title: 'Enterprise Planning', value: 'AOP & Rolling', unit: 'Forecast', delta: '▲ Versioning Budget vs Actual', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 804, y: 116, w: 372, h: 110, id: 'PILAR 3', title: 'Augmented Analytics', value: 'Smart Insights', unit: 'AI Driven', delta: '▲ Automated Variance Root-Cause', positive: true, accent: '#7c3aed' })}
      ${tableWidget({
				x: 24,
				y: 244,
				w: 1152,
				h: 252,
				id: 'ARCH',
				title: 'Live Connection Data Pipeline (Zero Data Replication)',
				subtitle: 'Aliran data langsung dari tabel universal journal S/4HANA ke widget visualisasi SAC',
				rightBadge: 'INA / CORS Live',
				columns: ['Layer Arsitektur', 'Komponen Teknis', 'Objek / T-Code / View', 'Fungsi & Keunggulan'],
				rows: [
					{ cells: ['1. ERP Core Database', 'SAP S/4HANA HANA DB', 'ACDOCA, MATDOC, MSEG, AUFK', 'Single Source of Truth transaksi real-time'] },
					{ cells: ['2. Semantic Layer', 'ABAP CDS Views', 'Z_CDS_FI_PERF, JG_M_FFIIM_HBA', 'Kalkulasi on-the-fly & hierarki FSV J000'] },
					{ cells: ['3. Analytic Engine', 'SAP BW / InA Service', '/sap/bw/ina/GetResponse', 'Query pushdown tanpa duplikasi data ke Cloud'] },
					{ cells: ['4. Presentation Layer', 'SAP Analytics Cloud Story', 'Responsive Grid, Input Control', 'Numeric Point, Combo Chart, Running Sum Table'], bold: true }
				]
			})}
    `
	})
);

// --- 2. sac/finance-financial-performance ---
saveSvg(
	'finance-financial-performance.svg',
	sacCanvas({
		height: 720,
		storyTitle: 'FINANCE — Sheet 1: Financial Performance',
		sheetTitle: 'Financial Performance',
		filters: ['Company Code: All (Jhonlin Group)', 'Fiscal Year: 2026', 'Month: Jan - Oct'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 220, h: 86, id: 'W1-W2', title: 'Revenue (Curr / PY)', value: '14,820', unit: 'IDR Bn', delta: '▲ +14.2% vs PY (12,977)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 256, y: 114, w: 220, h: 86, id: 'W3-W4', title: 'Gross Profit (Curr / PY)', value: '4,610', unit: 'IDR Bn', delta: '▲ +11.8% vs PY (4,123)', positive: true, accent: '#0284c7' })}
      ${kpiTile({ x: 488, y: 114, w: 220, h: 86, id: 'W5-W6', title: 'Operating Profit', value: '3,490', unit: 'IDR Bn', delta: '▲ +15.4% vs PY (3,024)', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 720, y: 114, w: 220, h: 86, id: 'W7-W8', title: 'Net Profit (EAT)', value: '2,680', unit: 'IDR Bn', delta: '▲ +16.1% vs PY (2,308)', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 952, y: 114, w: 224, h: 86, id: 'W9-W10', title: 'EBITDA (Curr / PY)', value: '4,295', unit: 'IDR Bn', delta: '▲ Margin 28.9% (PY: 3,740)', positive: true, accent: '#7c3aed' })}
      ${comboChartWidget({
				x: 24,
				y: 214,
				w: 580,
				h: 482,
				id: 'W11',
				title: 'Monthly Performance (Revenue, Gross/Net Profit & EBITDA %)',
				subtitle: 'Combination Column & Line Chart — Tren Bulanan Jan s/d Oct 2026',
				categories: MONTHS,
				bars1: [1320, 1380, 1450, 1410, 1490, 1520, 1480, 1550, 1600, 1620],
				bars2: [380, 410, 440, 420, 460, 480, 450, 490, 520, 540],
				lineVals: [27.2, 27.8, 28.4, 27.9, 28.8, 29.1, 28.5, 29.4, 29.8, 30.2],
				bar1Label: 'Revenue (IDR Bn)',
				bar2Label: 'EBITDA (IDR Bn)',
				lineLabel: 'EBITDA Margin %',
				unitLeft: 'IDR Bn',
				unitRight: '%'
			})}
      ${tableWidget({
				x: 618,
				y: 214,
				w: 558,
				h: 482,
				id: 'W12',
				title: 'Income Statement (Hierarki FSV J000)',
				subtitle: 'Laporan Laba Rugi Komparatif YoY & MoM dengan Variance %',
				rightBadge: 'FSV: J000',
				columns: ['GL Hierarchy (J000)', 'Curr Year', 'Prev Year', 'YoY Δ', 'YoY %'],
				rows: [
					{ cells: ['▼ REVENUE (Pendapatan Usaha)', '14,820.4', '12,977.5', '+1,842.9', '▲ +14.2%'], bold: true },
					{ cells: ['  ├─ Penjualan Batubara Ekspor', '10,410.2', '9,020.1', '+1,390.1', '▲ +15.4%'] },
					{ cells: ['  ├─ Penjualan Batubara Domestik', '3,120.0', '2,810.4', '+309.6', '▲ +11.0%'] },
					{ cells: ['  └─ Jasa Pelabuhan & Logistik Laut', '1,290.2', '1,147.0', '+143.2', '▲ +12.5%'] },
					{ cells: ['▼ COST OF GOODS SOLD (COGS)', '(10,210.1)', '(8,854.2)', '-1,355.9', '▼ +15.3%'] },
					{ cells: ['  ├─ Biaya Kontraktor & OB Removal', '(5,840.0)', '(5,120.0)', '-720.0', '▼ +14.1%'] },
					{ cells: ['  ├─ Pemakaian BBM Solar Industri', '(2,690.1)', '(2,280.2)', '-409.9', '▼ +18.0%'] },
					{ cells: ['  └─ Royalti, Barging & Port Handling', '(1,680.0)', '(1,454.0)', '-226.0', '▼ +15.5%'] },
					{ cells: ['GROSS PROFIT (Laba Kotor)', '4,610.3', '4,123.3', '+487.0', '▲ +11.8%'], bold: true },
					{ cells: ['▼ OPERATING EXPENSES (OPEX)', '(1,120.0)', '(1,099.1)', '-20.9', '▼ +1.9%'] },
					{ cells: ['OPERATING PROFIT (EBIT)', '3,490.3', '3,024.2', '+466.1', '▲ +15.4%'], bold: true },
					{ cells: ['EBITDA (EBIT + Depr & Amort)', '4,295.0', '3,740.0', '+555.0', '▲ +14.8%'], bold: true },
					{ cells: ['NET PROFIT (Laba Bersih / EAT)', '2,680.5', '2,308.4', '+372.1', '▲ +16.1%'], bold: true }
				]
			})}
    `
	})
);

// Focused Widget 1-10 for Financial Performance
saveSvg(
	'finance-fp-kpi-cards.svg',
	sacCanvas({
		height: 330,
		storyTitle: 'Financial Performance — Detail Widget 1 s/d 10: Numeric Point KPIs',
		sheetTitle: 'KPI Cards (Current vs Previous Year)',
		body: `
      ${kpiTile({ x: 24, y: 114, w: 220, h: 92, id: 'W1', title: 'Revenue (Current Year)', value: '14,820.4', unit: 'IDR Bn', delta: '▲ +14.2% vs PY', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 256, y: 114, w: 220, h: 92, id: 'W3', title: 'Gross Profit (Current)', value: '4,610.3', unit: 'IDR Bn', delta: '▲ Gross Margin 31.1%', positive: true, accent: '#0284c7' })}
      ${kpiTile({ x: 488, y: 114, w: 220, h: 92, id: 'W5', title: 'Operating Profit (Curr)', value: '3,490.3', unit: 'IDR Bn', delta: '▲ EBIT Margin 23.6%', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 720, y: 114, w: 220, h: 92, id: 'W7', title: 'Net Profit (Current)', value: '2,680.5', unit: 'IDR Bn', delta: '▲ Net Margin 18.1%', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 952, y: 114, w: 224, h: 92, id: 'W9', title: 'EBITDA (Current Year)', value: '4,295.0', unit: 'IDR Bn', delta: '▲ EBITDA Margin 28.9%', positive: true, accent: '#7c3aed' })}

      ${kpiTile({ x: 24, y: 218, w: 220, h: 92, id: 'W2', title: 'Revenue (Previous Year)', value: '12,977.5', unit: 'IDR Bn', subtext: 'Baseline FY 2025 (YTD Oct)', accent: '#64748b' })}
      ${kpiTile({ x: 256, y: 218, w: 220, h: 92, id: 'W4', title: 'Gross Profit (Prev Year)', value: '4,123.3', unit: 'IDR Bn', subtext: 'Baseline Gross Margin 31.8%', accent: '#64748b' })}
      ${kpiTile({ x: 488, y: 218, w: 220, h: 92, id: 'W6', title: 'Operating Profit (Prev)', value: '3,024.2', unit: 'IDR Bn', subtext: 'Baseline EBIT Margin 23.3%', accent: '#64748b' })}
      ${kpiTile({ x: 720, y: 218, w: 220, h: 92, id: 'W8', title: 'Net Profit (Prev Year)', value: '2,308.4', unit: 'IDR Bn', subtext: 'Baseline Net Margin 17.8%', accent: '#64748b' })}
      ${kpiTile({ x: 952, y: 218, w: 224, h: 92, id: 'W10', title: 'EBITDA (Previous Year)', value: '3,740.0', unit: 'IDR Bn', subtext: 'Baseline EBITDA Margin 28.8%', accent: '#64748b' })}
    `
	})
);

// --- 3. sac/finance-position-covenant ---
saveSvg(
	'finance-position-covenant.svg',
	sacCanvas({
		height: 690,
		storyTitle: 'FINANCE — Sheet 2: Financial Position & Coverage Ratios',
		sheetTitle: 'Financial Position & Covenant',
		filters: ['Company Code: All (Jhonlin Group)', 'Fiscal Year: 2026', 'Month: Oct 2026'],
		body: `
      ${comboChartWidget({
				x: 24,
				y: 114,
				w: 565,
				h: 270,
				id: 'W1',
				title: 'Asset — Stacked Column Chart (Current vs Non-Current)',
				subtitle: 'Pertumbuhan struktur aset lancar & aset tetap bulanan (IDR Bn)',
				categories: MONTHS,
				bars1: [8200, 8350, 8490, 8600, 8720, 8890, 9010, 9150, 9320, 9480],
				bars2: [12400, 12450, 12520, 12600, 12680, 12750, 12810, 12900, 12980, 13100],
				bar1Label: 'Current Asset',
				bar2Label: 'Non-Current Asset',
				unitLeft: 'IDR Bn'
			})}
      ${comboChartWidget({
				x: 605,
				y: 114,
				w: 571,
				h: 270,
				id: 'W2',
				title: 'Liabilities & Equity — Stacked Column Chart',
				subtitle: 'Komposisi Short-Term, Long-Term Liabilities & Ekuitas (IDR Bn)',
				categories: MONTHS,
				bars1: [7800, 7750, 7700, 7620, 7550, 7480, 7400, 7320, 7250, 7180],
				bars2: [12800, 13050, 13310, 13580, 13850, 14160, 14420, 14730, 15050, 15400],
				bar1Label: 'Total Liabilities',
				bar2Label: 'Total Equity',
				unitLeft: 'IDR Bn'
			})}
      ${tableWidget({
				x: 24,
				y: 398,
				w: 510,
				h: 268,
				id: 'W3',
				title: 'Covenant Ratio — Financial Health & Bank Compliance Table',
				subtitle: 'Monitoring batas kepatuhan kredit perbankan (Standard Bank Covenant)',
				rightBadge: 'Covenant Check',
				columns: ['Financial Ratio / Metric', 'Actual Oct', 'Threshold', 'Status'],
				rows: [
					{ cells: ['Current Asset (IDR Bn)', '9,480.0', '-', 'ACTIVE'] },
					{ cells: ['Current Liabilities (IDR Bn)', '3,920.0', '-', 'ACTIVE'] },
					{ cells: ['Current Ratio (%)', '241.8%', '>= 120%', '▲ PASS (Safe)'], bold: true },
					{ cells: ['Debt to EBITDA (x)', '1.48x', '<= 3.00x', '▲ PASS (Safe)'], bold: true },
					{ cells: ['Debt Service Coverage (DSCR)', '2.84x', '>= 1.25x', '▲ PASS (Safe)'], bold: true },
					{ cells: ['Debt to Equity Ratio (DER)', '46.6%', '<= 200%', '▲ PASS (Safe)'], bold: true }
				]
			})}
      ${donutWidget({
				x: 548,
				y: 398,
				w: 360,
				h: 268,
				id: 'W4',
				title: 'Loan — Pie / Donut Chart',
				subtitle: 'Proporsi baki debet pinjaman per fasilitas bank',
				centerTitle: 'Total Loan',
				centerVal: '6,350 Bn',
				slices: [
					{ label: 'Bank Mandiri', val: '2,858 Bn', pct: 45, color: '#0070f2' },
					{ label: 'BNI Corporate', val: '1,905 Bn', pct: 30, color: '#0d9488' },
					{ label: 'BRI Sindikasi', val: '1,016 Bn', pct: 16, color: '#f59e0b' },
					{ label: 'Leasing / Lainnya', val: '571 Bn', pct: 9, color: '#6366f1' }
				]
			})}
      ${kpiTile({ x: 922, y: 398, w: 254, h: 128, id: 'W5a', title: 'Current Maturities Debt', value: '1,420.5', unit: 'IDR Bn', delta: 'Jatuh Tempo <= 12 Bulan (FSV J000)', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 922, y: 538, w: 254, h: 128, id: 'W5b', title: 'Total Interest-Bearing Debt', value: '6,350.0', unit: 'IDR Bn', delta: '▼ -6.4% YoY (Pelunasan Pokok)', positive: true, accent: '#0070f2' })}
    `
	})
);

// --- 4. sac/finance-ap-ar-highlight ---
saveSvg(
	'finance-ap-ar-highlight.svg',
	sacCanvas({
		height: 640,
		storyTitle: 'FINANCE — Sheet 3: AP & AR Highlight (Working Capital Aging)',
		sheetTitle: 'AP & AR Highlight',
		filters: ['Company Code: All (Jhonlin Group)', 'Fiscal Year: 2026', 'Aging Cut-off: 31 Oct 2026'],
		body: `
      ${tableWidget({
				x: 24,
				y: 114,
				w: 1152,
				h: 245,
				id: 'W1',
				title: 'Accounts Payable (AP) — Aging Schedule & Vendor Category Table',
				subtitle: 'Matriks umur hutang usaha (Not Due, 1-30, 31-60, 61-90, >90 Days) — Pihak Ketiga vs Afiliasi',
				rightBadge: 'AP Aging (IDR Bn)',
				columns: ['Vendor / Category', 'Not Due', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days', 'Total AP'],
				rows: [
					{ cells: ['▼ Pihak Ketiga (Third Party)', '1,180.4', '420.2', '115.0', '38.4', '14.2', '1,768.2'], bold: true },
					{ cells: ['  ├─ AP Trade (BBM, Sparepart, Kontraktor)', '980.2', '350.0', '92.0', '28.0', '9.8', '1,460.0'] },
					{ cells: ['  └─ AP Non-Trade (Capex & Jasa Umum)', '200.2', '70.2', '23.0', '10.4', '4.4', '308.2'] },
					{ cells: ['▼ Pihak Berelasi (Afiliasi Jhonlin Group)', '340.0', '85.0', '12.0', '0.0', '0.0', '437.0'], bold: true },
					{ cells: ['TOTAL ACCOUNTS PAYABLE (AP)', '1,520.4', '505.2', '127.0', '38.4', '14.2', '2,205.2'], bold: true }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 375,
				w: 1152,
				h: 245,
				id: 'W2',
				title: 'Accounts Receivable (AR) — Aging Schedule & Customer Collectibility Table',
				subtitle: 'Matriks umur piutang pelanggan batubara & logistik untuk pemantauan DSO & risiko kredit',
				rightBadge: 'AR Aging (IDR Bn)',
				columns: ['Customer / Category', 'Not Due', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days', 'Total AR'],
				rows: [
					{ cells: ['▼ Pihak Ketiga (Export & Domestic Buyers)', '1,890.5', '610.8', '142.0', '24.5', '8.2', '2,676.0'], bold: true },
					{ cells: ['  ├─ AR Trade — PLN & IPP Domestik', '920.0', '340.5', '88.0', '14.5', '4.2', '1,367.2'] },
					{ cells: ['  └─ AR Trade — Export Coal Shippers (L/C)', '970.5', '270.3', '54.0', '10.0', '4.0', '1,308.8'] },
					{ cells: ['▼ Pihak Berelasi (Intercompany Afiliasi)', '410.0', '95.0', '18.0', '0.0', '0.0', '523.0'], bold: true },
					{ cells: ['TOTAL ACCOUNTS RECEIVABLE (AR)', '2,300.5', '705.8', '160.0', '24.5', '8.2', '3,199.0'], bold: true }
				]
			})}
    `
	})
);

// --- 5. sac/finance-cash-position ---
saveSvg(
	'finance-cash-position.svg',
	sacCanvas({
		height: 700,
		storyTitle: 'FINANCE — Sheet 4: Cash Position & Treasury Management',
		sheetTitle: 'Cash Position',
		filters: ['Company Code: All (Jhonlin Group)', 'Fiscal Year: 2026', 'Month: Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 320, h: 120, id: 'W1', title: 'Cash / Bank Position (Ending)', value: '4,892.6', unit: 'IDR Bn', delta: '▲ +342.1 Bn Net Cash Flow MTD', positive: true, accent: '#0070f2' })}
      ${tableWidget({
				x: 358,
				y: 114,
				w: 818,
				h: 235,
				id: 'W2',
				title: 'Cash Position per Month — Cumulative Running Sum Table',
				subtitle: 'Kalkulasi saldo kas kumulatif lintas periode menggunakan formula tabel SAC',
				formula: '=runningsum(C1, true)',
				rightBadge: 'Running Sum',
				columns: ['Account / Bank Group', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
				rows: [
					{ cells: ['Bank Mandiri (IDR & USD)', '1,820', '1,890', '1,950', '2,010', '2,080', '2,150', '2,210', '2,290', '2,380', '2,460'] },
					{ cells: ['BNI Corporate Account', '940', '960', '990', '1,020', '1,050', '1,090', '1,120', '1,160', '1,210', '1,255'] },
					{ cells: ['BRI & Bank Lainnya', '780', '810', '840', '860', '890', '920', '950', '980', '1,020', '1,065'] },
					{ cells: ['Cash on Hand & Time Deposit', '95', '98', '100', '102', '105', '106', '108', '110', '111', '112.6'] },
					{ cells: ['TOTAL CASH POSITION', '3,635', '3,758', '3,880', '3,992', '4,125', '4,266', '4,388', '4,540', '4,721', '4,892.6'], bold: true }
				]
			})}
      ${kpiTile({ x: 24, y: 248, w: 320, h: 101, id: 'TREASURY', title: 'Net Operating Cash Flow YTD', value: '+1,257.6', unit: 'IDR Bn', delta: '▲ Cash Conversion Ratio 94.2%', positive: true, accent: '#059669' })}
      ${comboChartWidget({
				x: 24,
				y: 363,
				w: 440,
				h: 312,
				id: 'W3',
				title: 'Cash In vs Cash Out per Month',
				subtitle: 'Perbandingan arus kas masuk & keluar bulanan (IDR Bn)',
				categories: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
				bars1: [1480, 1560, 1510, 1620, 1690, 1740],
				bars2: [1347, 1419, 1388, 1468, 1509, 1568],
				bar1Label: 'Cash In (Inflow)',
				bar2Label: 'Cash Out (Outflow)',
				unitLeft: 'IDR Bn'
			})}
      ${horizontalBarWidget({
				x: 478,
				y: 363,
				w: 360,
				h: 312,
				id: 'W4',
				title: 'Cash Out by Bank',
				subtitle: 'Distribusi pengeluaran kas per bank operasional',
				unit: 'IDR Bn',
				items: [
					{ label: 'Bank Mandiri', val: 820, display: '820.4 Bn', color: '#0070f2' },
					{ label: 'BNI Corporate', val: 410, display: '410.2 Bn', color: '#0d9488' },
					{ label: 'BRI Sindikasi', val: 218, display: '218.0 Bn', color: '#f59e0b' },
					{ label: 'BCA Operasional', val: 85, display: '85.1 Bn', color: '#6366f1' },
					{ label: 'Lainnya (BPD)', val: 35, display: '34.7 Bn', color: '#64748b' }
				]
			})}
      ${tableWidget({
				x: 852,
				y: 363,
				w: 324,
				h: 312,
				id: 'W5',
				title: 'Exchange Rate to IDR (TCURR)',
				subtitle: 'Kurs KMK Pajak & Kurs Tengah BI',
				rightBadge: 'FX Valuation',
				columns: ['CCY', 'KMK Rate', 'Closing BI'],
				rows: [
					{ cells: ['USD', '15,620.00', '15,685.00'], bold: true },
					{ cells: ['SGD', '11,640.00', '11,692.00'] },
					{ cells: ['EUR', '16,890.00', '16,945.00'] },
					{ cells: ['JPY', '104.25', '104.80'] },
					{ cells: ['AUD', '10,310.00', '10,355.00'] },
					{ cells: ['CNY', '2,185.00', '2,194.00'] }
				]
			})}
    `
	})
);

// --- 6. sac/finance-coal-price-benchmark ---
saveSvg(
	'finance-coal-price-benchmark.svg',
	sacCanvas({
		height: 680,
		storyTitle: 'FINANCE — Sheet 5: Coal Price & Actual Benchmark (HBA & ICI)',
		sheetTitle: 'Coal Price & Benchmark',
		connection: 'MODELS: ACTUAL + JG_M_FFIIM_HBA/ICI',
		filters: ['Fiscal Year: 2026', 'Period: Jan - Oct 2026', 'Currency: USD / Ton'],
		body: `
      ${multiLineWidget({
				x: 24,
				y: 114,
				w: 565,
				h: 265,
				id: 'W1',
				title: 'Actual Price — Time-Series Line Chart (Realisasi Harga Jual)',
				subtitle: 'Rata-rata tertimbang harga jual aktual (Weighted Average Selling Price)',
				categories: MONTHS,
				unit: 'USD/Ton',
				series: [{ name: 'Actual Realized Price (FOB)', color: '#0070f2', data: [78.4, 79.2, 81.5, 80.1, 82.8, 84.0, 83.2, 85.1, 86.4, 87.2] }]
			})}
      ${multiLineWidget({
				x: 605,
				y: 114,
				w: 571,
				h: 265,
				id: 'W2',
				title: 'Harga Batubara Acuan (HBA) — Line Chart (Model: JG_M_FFIIM_HBA)',
				subtitle: 'Tren bulanan HBA Resmi Kementerian ESDM RI (USD / Ton)',
				categories: MONTHS,
				unit: 'USD/Ton',
				series: [
					{ name: 'HBA I (6,322 kcal)', color: '#0d9488', data: [118.5, 119.8, 122.0, 120.4, 123.5, 125.1, 124.0, 126.2, 127.8, 128.5] },
					{ name: 'HBA II (5,300 kcal)', color: '#f59e0b', data: [84.2, 85.0, 86.8, 85.9, 88.1, 89.4, 88.7, 90.2, 91.5, 92.1] }
				]
			})}
      ${multiLineWidget({
				x: 24,
				y: 393,
				w: 1152,
				h: 263,
				id: 'W3',
				title: 'Indonesia Coal Index (ICI 1 - ICI 5) — Multi-Grade Line Chart (Model: JG_M_FFIIM_ICI)',
				subtitle: 'Pergerakan indeks pasar batubara Indonesia lintas spesifikasi kalori GAR (Argus / Coalindo)',
				categories: MONTHS,
				unit: 'USD/Ton',
				series: [
					{ name: 'ICI 1 (6500 GAR)', color: '#1d4ed8', data: [122, 124, 126, 125, 128, 130, 129, 131, 133, 134] },
					{ name: 'ICI 2 (5800 GAR)', color: '#0d9488', data: [94, 95, 97, 96, 98, 100, 99, 101, 102, 103] },
					{ name: 'ICI 3 (5000 GAR)', color: '#f59e0b', data: [76, 77, 79, 78, 80, 81, 80, 82, 83, 84] },
					{ name: 'ICI 4 (4200 GAR)', color: '#7c3aed', data: [56, 57, 58, 57, 59, 60, 59, 61, 62, 63] },
					{ name: 'ICI 5 (3400 GAR)', color: '#ef4444', data: [37, 38, 39, 38, 39, 40, 40, 41, 41, 42] }
				]
			})}
    `
	})
);

console.log('Batch 1 (Overview + Finance 5 sheets) generated.');
