const {
	sacCanvas,
	kpiTile,
	comboChartWidget,
	horizontalBarWidget,
	multiLineWidget,
	tableWidget,
	donutWidget,
	saveSvg
} = require('./sac-svg-lib.cjs');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

// --- Financial Performance Sub-widgets ---
saveSvg(
	'finance-fp-w11-combo.svg',
	sacCanvas({
		height: 420,
		storyTitle: 'Financial Performance — Detail Widget 11: Monthly Performance Combo Chart',
		sheetTitle: 'Combination Column & Line Chart (Revenue, Profit & EBITDA %)',
		body: comboChartWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 284,
			id: 'WIDGET 11',
			title: 'Monthly Performance — Revenue, Gross Profit, Operating Profit, Net Profit & EBITDA Margin %',
			subtitle: 'Sumbu Kiri (Bar): Nilai Nominal (IDR Bn)  |  Sumbu Kanan (Garis): Persentase Margin EBITDA (%)',
			categories: MONTHS,
			bars1: [1320, 1380, 1450, 1410, 1490, 1520, 1480, 1550, 1600, 1620],
			bars2: [380, 410, 440, 420, 460, 480, 450, 490, 520, 540],
			lineVals: [27.2, 27.8, 28.4, 27.9, 28.8, 29.1, 28.5, 29.4, 29.8, 30.2],
			bar1Label: 'Revenue (IDR Bn)',
			bar2Label: 'EBITDA (IDR Bn)',
			lineLabel: 'EBITDA Margin %',
			unitLeft: 'IDR Bn',
			unitRight: '%'
		})
	})
);

saveSvg(
	'finance-fp-w12-table.svg',
	sacCanvas({
		height: 450,
		storyTitle: 'Financial Performance — Detail Widget 12: Income Statement Table (FSV J000)',
		sheetTitle: 'Hierarchical P&L Table with YoY & MoM Variance',
		body: tableWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 314,
			id: 'WIDGET 12',
			title: 'Income Statement — Laporan Laba Rugi Hierarki G/L Account (J000)',
			subtitle: 'Mendukung ekspansi node hierarki (+/-) dari level grup akun hingga nomor G/L Account SAP S/4HANA',
			rightBadge: 'Hierarchy: J000',
			columns: ['G/L Account Hierarchy (J000)', 'Current Year (YTD)', 'Previous Year (YTD)', 'YoY Variance', 'YoY %', 'MoM %'],
			rows: [
				{ cells: ['▼ REVENUE (Pendapatan Usaha)', '14,820.4 Bn', '12,977.5 Bn', '+1,842.9 Bn', '▲ +14.2%', '▲ +1.3%'], bold: true },
				{ cells: ['  ├─ 41001000 Penjualan Batubara Ekspor', '10,410.2 Bn', '9,020.1 Bn', '+1,390.1 Bn', '▲ +15.4%', '▲ +1.8%'] },
				{ cells: ['  ├─ 41002000 Penjualan Batubara Domestik', '3,120.0 Bn', '2,810.4 Bn', '+309.6 Bn', '▲ +11.0%', '▲ +0.6%'] },
				{ cells: ['  └─ 42001000 Jasa Kepelabuhanan & Pelayaran', '1,290.2 Bn', '1,147.0 Bn', '+143.2 Bn', '▲ +12.5%', '▲ +0.9%'] },
				{ cells: ['▼ COST OF GOODS SOLD (Beban Pokok)', '(10,210.1 Bn)', '(8,854.2 Bn)', '-1,355.9 Bn', '▼ +15.3%', '▼ +1.1%'] },
				{ cells: ['GROSS PROFIT (Laba Kotor)', '4,610.3 Bn', '4,123.3 Bn', '+487.0 Bn', '▲ +11.8%', '▲ +1.7%'], bold: true },
				{ cells: ['OPERATING PROFIT (EBIT)', '3,490.3 Bn', '3,024.2 Bn', '+466.1 Bn', '▲ +15.4%', '▲ +2.1%'], bold: true },
				{ cells: ['EBITDA (Laba Sebelum Bunga, Pajak & Depr)', '4,295.0 Bn', '3,740.0 Bn', '+555.0 Bn', '▲ +14.8%', '▲ +2.0%'], bold: true },
				{ cells: ['NET PROFIT (Laba Bersih / EAT)', '2,680.5 Bn', '2,308.4 Bn', '+372.1 Bn', '▲ +16.1%', '▲ +2.4%'], bold: true }
			]
		})
	})
);

// --- Financial Position & Covenant Sub-widgets ---
saveSvg(
	'finance-pos-w1-asset.svg',
	sacCanvas({
		height: 390,
		storyTitle: 'Financial Position — Detail Widget 1: Asset Stacked Column Chart',
		sheetTitle: 'Current Asset vs Non-Current Asset (FSV J000)',
		body: comboChartWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 254,
			id: 'WIDGET 1',
			title: 'Asset — Stacked Bar/Column Chart (Current Asset vs Non-Current Asset)',
			subtitle: 'Komposisi likuiditas aset lancar terhadap aset tetap jangka panjang per bulan (IDR Bn)',
			categories: MONTHS,
			bars1: [8200, 8350, 8490, 8600, 8720, 8890, 9010, 9150, 9320, 9480],
			bars2: [12400, 12450, 12520, 12600, 12680, 12750, 12810, 12900, 12980, 13100],
			bar1Label: 'Current Asset (Lancar)',
			bar2Label: 'Non-Current Asset (Tetap)',
			unitLeft: 'IDR Bn'
		})
	})
);

saveSvg(
	'finance-pos-w2-liab.svg',
	sacCanvas({
		height: 390,
		storyTitle: 'Financial Position — Detail Widget 2: Liabilities & Equity Stacked Chart',
		sheetTitle: 'Short-Term, Long-Term Liabilities & Equity (FSV J000)',
		body: comboChartWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 254,
			id: 'WIDGET 2',
			title: 'Liabilities & Equity — Stacked Bar/Column Chart',
			subtitle: 'Struktur permodalan hutang jangka pendek/panjang terhadap pertumbuhan ekuitas (IDR Bn)',
			categories: MONTHS,
			bars1: [7800, 7750, 7700, 7620, 7550, 7480, 7400, 7320, 7250, 7180],
			bars2: [12800, 13050, 13310, 13580, 13850, 14160, 14420, 14730, 15050, 15400],
			bar1Label: 'Total Liabilities (Hutang)',
			bar2Label: 'Total Equity (Modal)',
			unitLeft: 'IDR Bn'
		})
	})
);

saveSvg(
	'finance-pos-w3-covenant.svg',
	sacCanvas({
		height: 390,
		storyTitle: 'Financial Position — Detail Widget 3: Covenant Ratio Table',
		sheetTitle: 'Bank Covenant Compliance Metrics',
		body: tableWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 254,
			id: 'WIDGET 3',
			title: 'Covenant Ratio — Tabel Kepatuhan Rasio Keuangan Perbankan',
			subtitle: 'Pemantauan otomatis Current Ratio, Debt to EBITDA, DSCR, dan Debt to Equity Ratio (DER)',
			rightBadge: 'Covenant Status',
			columns: ['Covenant Metric', 'Formula Kalkulasi', 'Actual Oct 2026', 'Bank Threshold', 'Compliance Status'],
			rows: [
				{ cells: ['Current Asset', 'Hierarchy FSV J000 (Aset Lancar)', 'Rp 9,480.0 Bn', ' Baseline', 'ACTIVE'] },
				{ cells: ['Current Ratio (%)', '(Current Asset / Current Liabilities) * 100%', '241.8%', '>= 120.0%', '▲ PASS (Healthy Liquidity)'], bold: true },
				{ cells: ['Debt to EBITDA (x)', 'Total Interest-Bearing Debt / Annualized EBITDA', '1.48x', '<= 3.00x', '▲ PASS (Low Leverage)'], bold: true },
				{ cells: ['Debt Service Coverage (DSCR)', 'EBITDA / (Principal + Interest Payment)', '2.84x', '>= 1.25x', '▲ PASS (Strong Coverage)'], bold: true },
				{ cells: ['Debt to Equity Ratio (DER)', '(Total Liabilities / Total Equity) * 100%', '46.6%', '<= 200.0%', '▲ PASS (Conservative)'], bold: true }
			]
		})
	})
);

saveSvg(
	'finance-pos-w4-w5-debt.svg',
	sacCanvas({
		height: 390,
		storyTitle: 'Financial Position — Detail Widget 4 & 5: Loan Pie Chart & Debt Numeric Points',
		sheetTitle: 'Loan Facility Breakdown & Debt Maturities',
		body: `
      ${donutWidget({
				x: 24,
				y: 114,
				w: 610,
				h: 254,
				id: 'WIDGET 4',
				title: 'Loan — Pie / Donut Chart (Komposisi Pinjaman Bank)',
				subtitle: 'Proporsi baki debet pinjaman berdasarkan kreditur / sindikasi bank',
				centerTitle: 'Total Debt',
				centerVal: '6,350 Bn',
				slices: [
					{ label: 'Bank Mandiri Corporate', val: '2,858 Bn', pct: 45, color: '#0070f2' },
					{ label: 'BNI Sindikasi Tambang', val: '1,905 Bn', pct: 30, color: '#0d9488' },
					{ label: 'BRI Armada & Port', val: '1,016 Bn', pct: 16, color: '#f59e0b' },
					{ label: 'Leasing Alat Berat', val: '571 Bn', pct: 9, color: '#6366f1' }
				]
			})}
      ${kpiTile({ x: 650, y: 114, w: 526, h: 120, id: 'WIDGET 5A', title: 'Current Maturities of Long-Term Debt', value: '1,420.5', unit: 'IDR Bn', delta: 'Porsi Pinjaman Jatuh Tempo <= 12 Bulan (FSV J000)', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 650, y: 248, w: 526, h: 120, id: 'WIDGET 5B', title: 'Total Interest-Bearing Debt (Long-Term + Short-Term)', value: '6,350.0', unit: 'IDR Bn', delta: '▼ Turun -6.4% YoY Seiring Pelunasan Terjadwal', positive: true, accent: '#0070f2' })}
    `
	})
);

console.log('Additional subwidgets generated.');

// --- AP & AR Sub-widgets ---
saveSvg(
	'finance-ap-w1-table.svg',
	sacCanvas({
		height: 360,
		storyTitle: 'AP & AR Highlight — Detail Widget 1: Accounts Payable Aging Table',
		sheetTitle: 'Accounts Payable (AP) Aging Schedule (Pihak Ketiga vs Afiliasi)',
		body: tableWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 224,
			id: 'WIDGET 1',
			title: 'Accounts Payable (AP) — Matriks Umur Hutang Usaha & Non-Usaha',
			subtitle: 'Klasifikasi jatuh tempo kewajiban vendor (Not Due, 1-30, 31-60, 61-90, >90 Days)',
			rightBadge: 'AP Aging (IDR Bn)',
			columns: ['Vendor / Category', 'Not Due', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days', 'Total AP'],
			rows: [
				{ cells: ['▼ Pihak Ketiga (Third Party)', '1,180.4', '420.2', '115.0', '38.4', '14.2', '1,768.2'], bold: true },
				{ cells: ['  ├─ AP Trade (BBM, Sparepart, Kontraktor)', '980.2', '350.0', '92.0', '28.0', '9.8', '1,460.0'] },
				{ cells: ['  └─ AP Non-Trade (Capex & Jasa Umum)', '200.2', '70.2', '23.0', '10.4', '4.4', '308.2'] },
				{ cells: ['▼ Pihak Berelasi (Afiliasi Jhonlin Group)', '340.0', '85.0', '12.0', '0.0', '0.0', '437.0'], bold: true },
				{ cells: ['TOTAL ACCOUNTS PAYABLE (AP)', '1,520.4', '505.2', '127.0', '38.4', '14.2', '2,205.2'], bold: true }
			]
		})
	})
);

saveSvg(
	'finance-ar-w2-table.svg',
	sacCanvas({
		height: 360,
		storyTitle: 'AP & AR Highlight — Detail Widget 2: Accounts Receivable Aging Table',
		sheetTitle: 'Accounts Receivable (AR) Aging Schedule (Export, PLN & Afiliasi)',
		body: tableWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 224,
			id: 'WIDGET 2',
			title: 'Accounts Receivable (AR) — Matriks Umur Piutang Pelanggan',
			subtitle: 'Monitoring kolektibilitas piutang penjualan batubara ekspor (L/C), PLN DMO, dan intercompany',
			rightBadge: 'AR Aging (IDR Bn)',
			columns: ['Customer / Category', 'Not Due', '1-30 Days', '31-60 Days', '61-90 Days', '> 90 Days', 'Total AR'],
			rows: [
				{ cells: ['▼ Pihak Ketiga (Export & Domestic Buyers)', '1,890.5', '610.8', '142.0', '24.5', '8.2', '2,676.0'], bold: true },
				{ cells: ['  ├─ AR Trade — PLN & IPP Domestik', '920.0', '340.5', '88.0', '14.5', '4.2', '1,367.2'] },
				{ cells: ['  └─ AR Trade — Export Coal Shippers (L/C)', '970.5', '270.3', '54.0', '10.0', '4.0', '1,308.8'] },
				{ cells: ['▼ Pihak Berelasi (Intercompany Afiliasi)', '410.0', '95.0', '18.0', '0.0', '0.0', '523.0'], bold: true },
				{ cells: ['TOTAL ACCOUNTS RECEIVABLE (AR)', '2,300.5', '705.8', '160.0', '24.5', '8.2', '3,199.0'], bold: true }
			]
		})
	})
);

// --- Marketing Price & Quantity Sub-widgets ---
saveSvg(
	'marketing-pq-w7-combo.svg',
	sacCanvas({
		height: 400,
		storyTitle: 'Price & Quantity Benchmark — Detail Widget 7: Monthly Sales & Price vs Benchmark',
		sheetTitle: 'Combination Stacked Column & Line Chart (Sales MT + ASP vs HPB/ICI)',
		body: comboChartWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 264,
			id: 'WIDGET 7',
			title: 'Monthly Sales Quantity (Export & Domestic) & Actual Contract Price vs HPB & ICI',
			subtitle: 'Kolom Bertumpuk: Volume Ekspor & Domestik (kMT)  |  Garis: Realisasi ASP vs Benchmark Pasar (USD/MT)',
			categories: MONTHS,
			bars1: [1650, 1710, 1800, 1760, 1850, 1910, 1880, 1940, 1960, 1960],
			bars2: [1100, 1150, 1220, 1180, 1260, 1300, 1280, 1330, 1350, 1360],
			lineVals: [80.2, 81.0, 82.5, 81.8, 83.4, 84.6, 84.1, 85.2, 86.0, 86.8],
			bar1Label: 'Total Sales (kMT)',
			bar2Label: 'Export Vol (kMT)',
			lineLabel: 'Actual ASP ($/MT)',
			unitLeft: 'kMT',
			unitRight: '$'
		})
	})
);

// --- Marketing Inventory Sub-widgets ---
saveSvg(
	'marketing-inv-w5-w6-transit.svg',
	sacCanvas({
		height: 360,
		storyTitle: 'Inventory Stock — Detail Widget 5 & 6: In-Transit Stock by Port of Loading',
		sheetTitle: 'In-Transit Quantity & Percentage In-Cell Bar Table (Movement 309)',
		body: tableWidget({
			x: 24,
			y: 114,
			w: 1152,
			h: 224,
			id: 'WIDGET 5 & 6',
			title: 'In-Transit by Port of Loading — Quantity & Percentage Completion Table',
			subtitle: 'Melacak batubara di atas tongkang (Loading Tongkang dikurangi yang sudah dibongkar ke Mother Vessel)',
			formula: 'Remaining_Qty = [Loading_Tongkang] - [Delivered_Vessel]  |  Transit_% = [Remaining_Qty] / [Loading_Tongkang]',
			rightBadge: 'SAP Mvt: 309',
			columns: ['Port of Loading (POL)', 'Loading Tongkang (MT)', 'Delivered Vessel (MT)', 'Remaining In-Transit (W5)', 'In-Transit % Bar (W6)'],
			rows: [
				{ cells: ['Jetty DSP Batulicin', '320,000 MT', '248,000 MT', '72,000 MT', '██████░░░░ 22.5%'] },
				{ cells: ['Bunati Anchorage Transfer', '210,000 MT', '168,500 MT', '41,500 MT', '█████░░░░░ 19.8%'] },
				{ cells: ['Sarangga Barge Terminal', '145,000 MT', '121,000 MT', '24,000 MT', '████░░░░░░ 16.6%'] },
				{ cells: ['Grogot / Batu Ampar Jetty', '85,000 MT', '74,000 MT', '11,000 MT', '███░░░░░░░ 12.9%'] },
				{ cells: ['TOTAL IN-TRANSIT COAL', '760,000 MT', '611,500 MT', '148,500 MT', '█████░░░░░ 19.5%'], bold: true }
			]
		})
	})
);
