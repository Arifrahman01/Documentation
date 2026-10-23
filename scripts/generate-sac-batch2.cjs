const {
	sacCanvas,
	kpiTile,
	comboChartWidget,
	horizontalBarWidget,
	multiLineWidget,
	tableWidget,
	donutWidget,
	waterfallWidget,
	saveSvg
} = require('./sac-svg-lib.cjs');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

// --- 7. sac/marketing-price-quantity-benchmark ---
saveSvg(
	'marketing-price-quantity-benchmark.svg',
	sacCanvas({
		height: 760,
		storyTitle: 'MARKETING — Sheet 1: Price & Quantity Benchmark',
		sheetTitle: 'Price & Quantity Benchmark',
		filters: ['Company Code: JB & DSP', 'Sales Channel: Export & Domestic', 'Period: Jan - Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 88, id: 'W1-W2', title: 'Total Sales Quantity (Current vs PY)', value: '18.42M', unit: 'MT', delta: '▲ +12.8% vs PY (16.33M MT)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 88, id: 'W3-W4', title: 'Total Invoice Value (Current vs PY)', value: '1,548.2', unit: 'USD Mn', delta: '▲ +15.1% vs PY (1,345.0 Mn)', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 88, id: 'W5-W6', title: 'Average Contract Price (ASP)', value: '84.05', unit: 'USD/MT', delta: '▲ +2.1% vs Benchmark ICI-3 (82.30)', positive: true, accent: '#7c3aed' })}
      ${comboChartWidget({
				x: 24,
				y: 216,
				w: 690,
				h: 265,
				id: 'W7',
				title: 'Monthly Sales Quantity & Contract Price vs HPB & ICI Benchmark',
				subtitle: 'Stacked Column (Export vs Domestic MT) + Line (Actual Price vs HPB/ICI USD/MT)',
				categories: MONTHS,
				bars1: [1650, 1710, 1800, 1760, 1850, 1910, 1880, 1940, 1960, 1960],
				bars2: [1100, 1150, 1220, 1180, 1260, 1300, 1280, 1330, 1350, 1360],
				lineVals: [80.2, 81.0, 82.5, 81.8, 83.4, 84.6, 84.1, 85.2, 86.0, 86.8],
				bar1Label: 'Total Sales (kMT)',
				bar2Label: 'Export Vol (kMT)',
				lineLabel: 'Actual ASP ($/MT)',
				unitLeft: 'kMT',
				unitRight: '$'
			})}
      ${multiLineWidget({
				x: 728,
				y: 216,
				w: 448,
				h: 265,
				id: 'W10-W11',
				title: 'HPB & ICI Market Index Time-Series',
				subtitle: 'Harga Patokan Batubara (HPB) & ICI Benchmark',
				categories: MONTHS,
				unit: 'USD/MT',
				series: [
					{ name: 'HPB Reference', color: '#0070f2', data: [82, 83, 85, 84, 86, 87, 86, 88, 89, 90] },
					{ name: 'ICI-3 (5000 GAR)', color: '#f59e0b', data: [76, 77, 79, 78, 80, 81, 80, 82, 83, 84] },
					{ name: 'ICI-4 (4200 GAR)', color: '#10b981', data: [56, 57, 58, 57, 59, 60, 59, 61, 62, 63] }
				]
			})}
      ${horizontalBarWidget({
				x: 24,
				y: 495,
				w: 372,
				h: 242,
				id: 'W8-W9',
				title: 'Sales Qty by Country of Destination',
				subtitle: 'Distribusi negara tujuan ekspor & DMO (M MT)',
				unit: 'M MT',
				items: [
					{ label: 'Indonesia (DMO)', val: 5.8, display: '5.80M MT (31%)', color: '#0070f2' },
					{ label: 'China', val: 4.9, display: '4.92M MT (27%)', color: '#0d9488' },
					{ label: 'India', val: 3.6, display: '3.64M MT (20%)', color: '#f59e0b' },
					{ label: 'Philippines', val: 2.2, display: '2.21M MT (12%)', color: '#6366f1' },
					{ label: 'Vietnam & Japan', val: 1.85, display: '1.85M MT (10%)', color: '#64748b' }
				]
			})}
      ${horizontalBarWidget({
				x: 414,
				y: 495,
				w: 372,
				h: 242,
				id: 'W12',
				title: 'Quantity by Port of Loading (POL)',
				subtitle: 'Volume pengapalan per Jetty / Anchorage',
				unit: 'M MT',
				items: [
					{ label: 'Jetty DSP Batulicin', val: 7.4, display: '7.42M MT', color: '#0284c7' },
					{ label: 'Taboneo Anchorage', val: 4.8, display: '4.80M MT', color: '#0d9488' },
					{ label: 'Bunati Port', val: 3.5, display: '3.50M MT', color: '#2563eb' },
					{ label: 'Tanah Merah Jetty', val: 2.7, display: '2.70M MT', color: '#7c3aed' }
				]
			})}
      ${horizontalBarWidget({
				x: 804,
				y: 495,
				w: 372,
				h: 242,
				id: 'W13',
				title: 'Domestic Port of Discharge (POD)',
				subtitle: 'Tujuan bongkar PLTU domestik (DMO)',
				unit: 'M MT',
				items: [
					{ label: 'PLTU Suralaya', val: 2.1, display: '2.10M MT', color: '#059669' },
					{ label: 'PLTU Paiton', val: 1.5, display: '1.52M MT', color: '#0d9488' },
					{ label: 'PLTU Tanjung Jati', val: 1.2, display: '1.24M MT', color: '#0070f2' },
					{ label: 'PLTU Cilacap', val: 0.94, display: '0.94M MT', color: '#6366f1' }
				]
			})}
    `
	})
);

// --- 8. sac/marketing-inventory-stock ---
saveSvg(
	'marketing-inventory-stock.svg',
	sacCanvas({
		height: 700,
		storyTitle: 'MARKETING — Sheet 2: Inventory Stock & Transit Position',
		sheetTitle: 'Inventory Stock (DSP & Transit)',
		filters: ['Plant: DSP Port Facility', 'Stock Type: Raw, Crushed & In-Transit', 'Cut-off: Real-time MATDOC'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 110, id: 'W1', title: 'Total Raw Coal DSP', value: '412,850', unit: 'MT', delta: '▲ Buffer Stock Aman (14 Hari)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 110, id: 'W2', title: 'Total Crushed Coal DSP', value: '684,320', unit: 'MT', delta: '▲ Ready for Barging / Loading', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 110, id: 'TRANSIT', title: 'Total In-Transit Stock (309)', value: '148,500', unit: 'MT', delta: '19 Tongkang Dalam Pelayaran', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 110, id: 'TOTAL', title: 'Grand Total Coal Inventory', value: '1,245,670', unit: 'MT', delta: '▲ Rekonsiliasi MB52 / MATDOC Match', positive: true, accent: '#7c3aed' })}
      ${horizontalBarWidget({
				x: 24,
				y: 238,
				w: 574,
				h: 215,
				id: 'W3',
				title: 'Raw Coal by Location Stockpile (ROM Stockpile)',
				subtitle: 'Distribusi stok batubara mentah belum tergiling per area lokasi (MT)',
				unit: 'MT',
				items: [
					{ label: 'Stockpile DS02 - DS05', val: 168000, display: '168,000 MT', color: '#0070f2' },
					{ label: 'Stockpile DS06 - DS09', val: 112400, display: '112,400 MT', color: '#0284c7' },
					{ label: 'Sarangga & Bunati', val: 78450, display: '78,450 MT', color: '#0d9488' },
					{ label: 'Grogot & Batu Ampar', val: 54000, display: '54,000 MT', color: '#6366f1' }
				]
			})}
      ${horizontalBarWidget({
				x: 612,
				y: 238,
				w: 564,
				h: 215,
				id: 'W4',
				title: 'Crushed Coal by Location Stockpile (Product Stockpile)',
				subtitle: 'Distribusi batubara siap muat hasil Crushing Plant DSP (MT)',
				unit: 'MT',
				items: [
					{ label: 'Product Stockpile DS02-05', val: 295000, display: '295,000 MT', color: '#059669' },
					{ label: 'Product Stockpile DS06-09', val: 214320, display: '214,320 MT', color: '#0d9488' },
					{ label: 'Bunati Crushed Yard', val: 110000, display: '110,000 MT', color: '#0070f2' },
					{ label: 'Sarangga Jetty Hopper', val: 65000, display: '65,000 MT', color: '#f59e0b' }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 467,
				w: 1152,
				h: 210,
				id: 'W5-W6',
				title: 'In-Transit by Port of Loading (Quantity & % Completion In-Cell Chart Table)',
				subtitle: 'Formula: Remaining Qty = Loading Tongkang (Mvt 309) - Delivered Mother Vessel (GI)',
				formula: 'Remaining_Qty = [Loading_Tongkang] - [Delivered_Vessel]  |  Transit_% = [Remaining_Qty] / [Loading_Tongkang]',
				rightBadge: 'Mvt Type: 309',
				columns: ['Port of Loading (POL)', 'Loading Tongkang (MT)', 'Delivered Vessel (MT)', 'Remaining In-Transit (MT)', 'In-Transit % (W6)'],
				rows: [
					{ cells: ['Jetty DSP Batulicin', '320,000 MT', '248,000 MT', '72,000 MT', '██████░░░░ 22.5%'] },
					{ cells: ['Bunati Anchorage Transfer', '210,000 MT', '168,500 MT', '41,500 MT', '█████░░░░░ 19.8%'] },
					{ cells: ['Sarangga Barge Terminal', '145,000 MT', '121,000 MT', '24,000 MT', '████░░░░░░ 16.6%'] },
					{ cells: ['Grogot / Batu Ampar Jetty', '85,000 MT', '74,000 MT', '11,000 MT', '███░░░░░░░ 12.9%'] },
					{ cells: ['TOTAL IN-TRANSIT COAL', '760,000 MT', '611,500 MT', '148,500 MT', '█████░░░░░ 19.5%'], bold: true }
				]
			})}
    `
	})
);

// --- 9. sac/pnl-segment-jg ---
saveSvg(
	'pnl-segment-jg.svg',
	sacCanvas({
		height: 680,
		storyTitle: 'PnL BY SEGMENT — Story 1: Jhonlin Group (JG) Konsolidasi',
		sheetTitle: 'Group Consolidated P&L & Elimination',
		filters: ['Consolidation Scope: Jhonlin Group', 'Intercompany Elim: Active', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 95, id: 'P1-KPI', title: 'Consolidated Revenue (Clean)', value: '14,820.4', unit: 'IDR Bn', delta: '▲ Setelah Eliminasi IC (-2,410 Bn)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 95, id: 'P1-KPI2', title: 'Consolidated EBITDA', value: '4,295.0', unit: 'IDR Bn', delta: '▲ EBITDA Margin 28.9%', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 95, id: 'P1-KPI3', title: 'Intercompany Eliminated', value: '(2,410.8)', unit: 'IDR Bn', delta: 'Barging JML & Port DSP ke JB', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 95, id: 'P1-KPI4', title: 'Consolidated Net Profit', value: '2,680.5', unit: 'IDR Bn', delta: '▲ +16.1% YoY Clean Margin', positive: true, accent: '#059669' })}
      ${donutWidget({
				x: 24,
				y: 223,
				w: 440,
				h: 220,
				id: 'PAGE 2',
				title: 'Segment Contribution Matrix (EBITDA Share)',
				subtitle: 'Kontribusi laba operasi per pilar bisnis utama',
				centerTitle: 'Group EBITDA',
				centerVal: '4,295 Bn',
				slices: [
					{ label: 'Mining (JB)', val: '2,663 Bn', pct: 62, color: '#0070f2' },
					{ label: 'Port & Crush (DSP)', val: '902 Bn', pct: 21, color: '#0d9488' },
					{ label: 'Marine (JML/JMT)', val: '730 Bn', pct: 17, color: '#f59e0b' }
				]
			})}
      ${comboChartWidget({
				x: 478,
				y: 223,
				w: 698,
				h: 220,
				id: 'PAGE 1',
				title: 'Consolidated Revenue vs EBITDA Trend (YTD Oct 2026)',
				subtitle: 'Performa bulanan gabungan seluruh entitas anak usaha Jhonlin Group',
				categories: MONTHS,
				bars1: [1320, 1380, 1450, 1410, 1490, 1520, 1480, 1550, 1600, 1620],
				lineVals: [27.2, 27.8, 28.4, 27.9, 28.8, 29.1, 28.5, 29.4, 29.8, 30.2],
				bar1Label: 'Clean Revenue (Bn)',
				lineLabel: 'EBITDA %',
				unitLeft: 'IDR Bn',
				unitRight: '%'
			})}
      ${tableWidget({
				x: 24,
				y: 457,
				w: 1152,
				h: 200,
				id: 'PAGE 3',
				title: 'Intercompany Eliminations & Clean Margin Reconciliation Matrix',
				subtitle: 'Eliminasi pendapatan & beban timbal-balik antar entitas afiliasi (JB, DSP, JML, JMT, STM)',
				rightBadge: 'IC Elimination',
				columns: ['Business Segment / Entity', 'Gross Revenue', 'IC Revenue Elim', 'External Revenue', 'Segment EBITDA', 'EBITDA %'],
				rows: [
					{ cells: ['Mining — PT Jhonlin Baratama (JB)', '11,850.0 Bn', '(320.0 Bn)', '11,530.0 Bn', '2,663.0 Bn', '▲ 23.1%'] },
					{ cells: ['Port & Handling — PT Dua Samudera Perkasa (DSP)', '2,480.0 Bn', '(1,120.4 Bn)', '1,359.6 Bn', '902.0 Bn', '▲ 36.4%'] },
					{ cells: ['Marine Logistics — JML / JMT / STM', '2,901.2 Bn', '(970.4 Bn)', '1,930.8 Bn', '730.0 Bn', '▲ 25.2%'] },
					{ cells: ['CONSOLIDATED JHONLIN GROUP (CLEAN)', '17,231.2 Bn', '(2,410.8 Bn)', '14,820.4 Bn', '4,295.0 Bn', '▲ 28.9%'], bold: true }
				]
			})}
    `
	})
);

// --- 10. sac/pnl-segment-jb ---
saveSvg(
	'pnl-segment-jb.svg',
	sacCanvas({
		height: 680,
		storyTitle: 'PnL BY SEGMENT — Story 2: Jhonlin Baratama (JB - Mining)',
		sheetTitle: 'Mining Profitability, Cash Cost & Pit Margin',
		filters: ['Company Code: JB01 (Jhonlin Baratama)', 'Pit Area: All Pits', 'Unit Measure: USD / Ton'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 95, id: 'JB-1', title: 'Realized Coal ASP (FOB)', value: '84.20', unit: 'USD/Ton', delta: '▲ +3.4% vs Budget ($81.40)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 95, id: 'JB-2', title: 'FOB Cash Cost per Ton', value: '54.80', unit: 'USD/Ton', delta: '▲ Efisiensi BBM -1.8% vs Target', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 95, id: 'JB-3', title: 'Actual Strip Ratio (SR)', value: '6.42', unit: 'BCM/MT', delta: 'Target Rencana Tambang: 6.50', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 95, id: 'JB-4', title: 'Net Mining Margin / Ton', value: '29.40', unit: 'USD/Ton', delta: '▲ Operating Margin 34.9%', positive: true, accent: '#7c3aed' })}
      ${waterfallWidget({
				x: 24,
				y: 223,
				w: 650,
				h: 235,
				id: 'PAGE 1',
				title: 'Unit Margin Bridge — Waterfall Chart (ASP to Net Mining Margin USD/Ton)',
				subtitle: 'Dekomposisi harga jual per ton dikurangi komponen biaya tambang langsung',
				unit: 'USD/Ton',
				steps: [
					{ label: 'Coal ASP', start: 0, end: 84.2, val: 84.2, isTotal: true },
					{ label: 'OB Removal', start: 84.2, end: 58.6, val: -25.6 },
					{ label: 'Fuel (BBM)', start: 58.6, end: 43.2, val: -15.4 },
					{ label: 'Hauling/Port', start: 43.2, end: 35.4, val: -7.8 },
					{ label: 'Royalty/OH', start: 35.4, end: 29.4, val: -6.0 },
					{ label: 'Net Margin', start: 0, end: 29.4, val: 29.4, isTotal: true }
				]
			})}
      ${donutWidget({
				x: 688,
				y: 223,
				w: 488,
				h: 235,
				id: 'PAGE 2',
				title: 'Mining Cost Structure Breakdown',
				subtitle: 'Proporsi biaya produksi langsung per ton (COGS)',
				centerTitle: 'Cash Cost',
				centerVal: '$54.80/T',
				slices: [
					{ label: 'OB & Mining Contr.', val: '$25.60', pct: 47, color: '#0070f2' },
					{ label: 'Fuel / Biosolar B35', val: '$15.40', pct: 28, color: '#f59e0b' },
					{ label: 'Hauling & Barging', val: '$7.80', pct: 14, color: '#0d9488' },
					{ label: 'Sparepart & Royalty', val: '$6.00', pct: 11, color: '#6366f1' }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 472,
				w: 1152,
				h: 186,
				id: 'PAGE 3',
				title: 'Pit-by-Pit Margin Comparison Matrix',
				subtitle: 'Perbandingan volume produksi, Strip Ratio (SR), Cash Cost, dan profitabilitas antar Pit',
				rightBadge: 'Pit Profitability',
				columns: ['Pit Location', 'Coal Prod (MT)', 'OB Removal (BCM)', 'Strip Ratio (SR)', 'Cash Cost ($/T)', 'EBITDA Margin %'],
				rows: [
					{ cells: ['Pit Utara — Block A (Low SR)', '5,420,000 MT', '30,894,000 BCM', '5.70x', '$49.20 / Ton', '▲ 41.5% (High)'], bold: true },
					{ cells: ['Pit Selatan — Block B (Medium SR)', '4,890,000 MT', '31,785,000 BCM', '6.50x', '$55.10 / Ton', '▲ 34.6% (Optimal)'] },
					{ cells: ['Pit Timur — Block C (High Caloric)', '3,910,000 MT', '28,543,000 BCM', '7.30x', '$62.20 / Ton', '▲ 28.4% (Premium Coal)'] },
					{ cells: ['TOTAL JHONLIN BARATAMA (JB)', '14,220,000 MT', '91,222,000 BCM', '6.42x', '$54.80 / Ton', '▲ 34.9%'], bold: true }
				]
			})}
    `
	})
);

// --- 11. sac/pnl-segment-dsp ---
saveSvg(
	'pnl-segment-dsp.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'PnL BY SEGMENT — Story 3: Dua Samudera Perkasa (DSP - Port & Crushing)',
		sheetTitle: 'Port Throughput, Handling Revenue & Infrastructure Cost',
		filters: ['Company Code: DSP1', 'Terminal: Jetty Batulicin & Bunati', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 95, id: 'DSP-1', title: 'Total Port Throughput', value: '16.85M', unit: 'MT', delta: '▲ +14.2% YoY Cargo Handled', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 95, id: 'DSP-2', title: 'Port & Crushing Revenue', value: '2,480.0', unit: 'IDR Bn', delta: '▲ Avg Tariff Rp 147,180 / MT', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 95, id: 'DSP-3', title: 'Unit Handling Cost', value: '88,420', unit: 'IDR/MT', delta: '▲ -4.1% Dibawah Budget Biaya', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 95, id: 'DSP-4', title: 'Terminal EBITDA Margin', value: '36.4%', unit: '(902 Bn)', delta: '▲ +180 bps YoY Expansion', positive: true, accent: '#7c3aed' })}
      ${horizontalBarWidget({
				x: 24,
				y: 223,
				w: 560,
				h: 220,
				id: 'PAGE 1',
				title: 'Revenue by Port Facility & Service Stream',
				subtitle: 'Kontribusi pendapatan berdasarkan layanan kepelabuhanan (IDR Bn)',
				unit: 'IDR Bn',
				items: [
					{ label: 'Jetty Barge Loading', val: 1040, display: '1,040.0 Bn (42%)', color: '#0070f2' },
					{ label: 'Coal Crushing Plant', val: 790, display: '790.0 Bn (32%)', color: '#0d9488' },
					{ label: 'Overland Conveyor', val: 420, display: '420.0 Bn (17%)', color: '#f59e0b' },
					{ label: 'Stockpile Storage Fee', val: 230, display: '230.0 Bn (9%)', color: '#6366f1' }
				]
			})}
      ${comboChartWidget({
				x: 598,
				y: 223,
				w: 578,
				h: 220,
				id: 'PAGE 2-3',
				title: 'Throughput Volume vs Unit Handling Cost Sensitivity',
				subtitle: 'Efek skala ekonomis (fixed cost dilution) saat volume throughput naik',
				categories: MONTHS,
				bars1: [1520, 1580, 1640, 1610, 1690, 1740, 1710, 1780, 1800, 1780],
				lineVals: [92, 91, 89, 90, 88, 87, 88, 86, 85, 86],
				bar1Label: 'Throughput (kMT)',
				lineLabel: 'Unit Cost (kIDR/T)',
				unitLeft: 'kMT',
				unitRight: 'kRp'
			})}
      ${tableWidget({
				x: 24,
				y: 457,
				w: 1152,
				h: 180,
				id: 'COST',
				title: 'Port Infrastructure Cost Structure & Tariff Realization Table',
				subtitle: 'Rincian biaya tetap (depresiasi dermaga) vs biaya variabel (listrik crusher, solar loader, perawatan)',
				rightBadge: 'DSP Cost Center',
				columns: ['Facility Cost Center', 'Throughput (MT)', 'Fixed Cost (Bn)', 'Variable Cost (Bn)', 'Total Cost (Bn)', 'Operating Margin'],
				rows: [
					{ cells: ['Jetty & Barge Loader Conveyor', '16,850,000 MT', '310.0 Bn', '340.0 Bn', '650.0 Bn', '▲ 37.5%'] },
					{ cells: ['Crushing Plant Unit 1 - 4', '14,120,000 MT', '215.0 Bn', '395.0 Bn', '610.0 Bn', '▲ 34.8%'] },
					{ cells: ['Stockpile Management & Dozer', '16,850,000 MT', '128.0 Bn', '190.0 Bn', '318.0 Bn', '▲ 36.9%'] },
					{ cells: ['TOTAL PT DUA SAMUDERA PERKASA', '16,850,000 MT', '653.0 Bn', '925.0 Bn', '1,578.0 Bn', '▲ 36.4% (EBITDA 902 Bn)'], bold: true }
				]
			})}
    `
	})
);

// --- 12. sac/pnl-segment-jml ---
saveSvg(
	'pnl-segment-jml.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'PnL BY SEGMENT — Story 4: Jhonlin Marine Lines (JML - Shipping)',
		sheetTitle: 'Shipping Revenue, Bunker Correlation & Route Profitability',
		filters: ['Company Code: JML1', 'Fleet: Tug & Barge / Mother Vessel', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 95, id: 'JML-1', title: 'Total Freight Revenue', value: '1,680.5', unit: 'IDR Bn', delta: '▲ +13.5% YoY Cargo Ton-Miles', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 95, id: 'JML-2', title: 'Vessel Operating Exp (VOE)', value: '1,142.0', unit: 'IDR Bn', delta: 'Bunker MGO 44% dari Total VOE', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 95, id: 'JML-3', title: 'Time Charter Equiv (TCE)', value: '14,850', unit: 'USD/Day', delta: '▲ +8.2% di atas Breakeven Rate', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 95, id: 'JML-4', title: 'Shipping EBITDA Margin', value: '32.0%', unit: '(538.5 Bn)', delta: '▲ Utilisasi Armada 91.4%', positive: true, accent: '#059669' })}
      ${comboChartWidget({
				x: 24,
				y: 223,
				w: 610,
				h: 220,
				id: 'PAGE 1-2',
				title: 'Freight Income vs Bunker Fuel Cost Correlation',
				subtitle: 'Pendapatan uang tambang bulanan vs realisasi biaya BBM Marine Gas Oil (MGO)',
				categories: MONTHS,
				bars1: [155, 160, 168, 162, 170, 174, 169, 175, 173, 174.5],
				bars2: [52, 54, 56, 55, 57, 58, 56, 58, 57, 57.5],
				lineVals: [31.2, 31.5, 32.1, 31.8, 32.4, 32.8, 32.0, 32.6, 32.5, 32.9],
				bar1Label: 'Freight Rev (Bn)',
				bar2Label: 'Bunker Cost (Bn)',
				lineLabel: 'Gross Margin %',
				unitLeft: 'IDR Bn',
				unitRight: '%'
			})}
      ${horizontalBarWidget({
				x: 648,
				y: 223,
				w: 528,
				h: 220,
				id: 'PAGE 3',
				title: 'Vessel Route Profitability Ranking (Margin %)',
				subtitle: 'Peringkat profitabilitas per rute pelayaran utama',
				unit: '%',
				items: [
					{ label: 'Batulicin - Taboneo', val: 38.4, display: '38.4% Margin (Rp 640 Bn)', color: '#059669' },
					{ label: 'Batulicin - Suralaya', val: 33.2, display: '33.2% Margin (Rp 480 Bn)', color: '#0070f2' },
					{ label: 'Bunati - Paiton', val: 30.8, display: '30.8% Margin (Rp 350 Bn)', color: '#0d9488' },
					{ label: 'Batulicin - Tanjung Jati', val: 27.5, display: '27.5% Margin (Rp 210 Bn)', color: '#6366f1' }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 457,
				w: 1152,
				h: 180,
				id: 'ROUTES',
				title: 'Shipping Route Performance & Bunker Consumption Matrix',
				subtitle: 'Evaluasi jumlah trip, kargo diangkut, konsumsi MGO (Liter/MT), dan laba bersih per koridor pelayaran',
				rightBadge: 'JML Route P&L',
				columns: ['Shipping Route Corridor', 'Completed Trips', 'Cargo Vol (MT)', 'Bunker Ratio (L/MT)', 'Freight Rev (Bn)', 'Net Voyage Margin'],
				rows: [
					{ cells: ['Rute 01: Jetty DSP Batulicin -> Taboneo Transhipment', '412 Trips', '3,296,000 MT', '2.85 L/MT', '640.2 Bn', '▲ 38.4% (High Yield)'], bold: true },
					{ cells: ['Rute 02: Jetty DSP Batulicin -> PLTU Suralaya (Banten)', '185 Trips', '1,480,000 MT', '8.40 L/MT', '480.0 Bn', '▲ 33.2% (Long Haul)'] },
					{ cells: ['Rute 03: Bunati Port -> PLTU Paiton (Jawa Timur)', '164 Trips', '1,312,000 MT', '6.90 L/MT', '350.3 Bn', '▲ 30.8% (Optimal)'] },
					{ cells: ['Rute 04: Jetty DSP -> PLTU Tanjung Jati (Jepara)', '98 Trips', '784,000 MT', '7.65 L/MT', '210.0 Bn', '▲ 27.5% (Standard)'] }
				]
			})}
    `
	})
);

// --- 13. sac/pm-mining-fleet ---
saveSvg(
	'pm-mining-fleet.svg',
	sacCanvas({
		height: 670,
		storyTitle: 'PM MINING — Story 1: Plant Maintenance Armada Gabungan (JB, DSP & JML)',
		sheetTitle: 'Fleet Physical Availability, Work Orders & MTBF/MTTR',
		filters: ['Plant: JB01, DSP1, JML1', 'Equipment Class: Heavy Fleet', 'Period: Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 95, id: 'PM-1', title: 'Fleet Physical Availability (PA)', value: '91.8%', unit: '(Target 90%)', delta: '▲ +1.8% di atas Target SLA', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 95, id: 'PM-2', title: 'Total Active Units Ready', value: '642', unit: 'Units', delta: 'Dari 699 Total Populasi Alat', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 95, id: 'PM-3', title: 'Preventive Maint. Ratio', value: '82.4%', unit: 'PM vs CM', delta: '▲ Unscheduled Breakdown < 18%', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 95, id: 'PM-4', title: 'Mean Time Between Failure', value: '148.5', unit: 'Hours (MTBF)', delta: '▲ MTTR Turun ke 4.2 Jam', positive: true, accent: '#7c3aed' })}
      ${comboChartWidget({
				x: 24,
				y: 223,
				w: 610,
				h: 230,
				id: 'PAGE 1',
				title: 'Heavy Equipment Status by Fleet Category (Active vs Breakdown)',
				subtitle: 'Distribusi kesiapan populasi unit alat berat lintas entitas (Unit)',
				categories: ['Excavator PC2000', 'Dump Truck HD785', 'Dozer D375', 'Motor Grader', 'Wheel Loader', 'Crusher/Loader'],
				bars1: [48, 285, 92, 44, 68, 105],
				bars2: [4, 24, 8, 3, 5, 13],
				bar1Label: 'Active Ready (Unit)',
				bar2Label: 'Workshop / BD (Unit)',
				unitLeft: 'Units'
			})}
      ${donutWidget({
				x: 648,
				y: 223,
				w: 528,
				h: 230,
				id: 'PAGE 2',
				title: 'Maintenance Work Order Distribution (SAP PM Order Type)',
				subtitle: 'Rasio Preventive (PM01) vs Corrective/Breakdown (PM02/PM03)',
				centerTitle: 'Total WO',
				centerVal: '1,420 WO',
				slices: [
					{ label: 'PM01 Scheduled Service', val: '895 WO', pct: 63, color: '#059669' },
					{ label: 'PM04 Condition Overhaul', val: '275 WO', pct: 19, color: '#0070f2' },
					{ label: 'PM02 Corrective Repair', val: '170 WO', pct: 12, color: '#f59e0b' },
					{ label: 'PM03 Emergency Breakdown', val: '80 WO', pct: 6, color: '#ef4444' }
				]
			})}
      ${multiLineWidget({
				x: 24,
				y: 467,
				w: 1152,
				h: 180,
				id: 'PAGE 3',
				title: 'Reliability Metrics Trend — MTBF (Hours) & MTTR (Hours)',
				subtitle: 'Peningkatan keandalan alat berat (Mean Time Between Failures naik, waktu perbaikan turun)',
				categories: MONTHS,
				unit: 'Hours',
				series: [
					{ name: 'MTBF — Mean Time Between Failures (Jam)', color: '#0070f2', data: [128, 131, 134, 136, 139, 141, 143, 145, 147, 148.5] },
					{ name: 'PA % — Physical Availability (%)', color: '#059669', data: [89.2, 89.5, 90.1, 90.4, 90.8, 91.0, 91.2, 91.5, 91.6, 91.8] }
				]
			})}
    `
	})
);

// --- 14. sac/pm-mining-jml-page1 ---
saveSvg(
	'pm-mining-jml-page1.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'PM MINING — Story 2: JML Detail Unit Breakdown & Component Wear',
		sheetTitle: 'Individual Equipment HM, Component Life & PR/PO Backlog',
		filters: ['Company Code: JML1', 'Workshop: Batulicin Heavy Bay', 'Status: All Equipment'],
		body: `
      ${tableWidget({
				x: 24,
				y: 114,
				w: 1152,
				h: 255,
				id: 'PAGE 1',
				title: 'Individual Equipment Health, Hour Meter (HM) & Next Service Tracking',
				subtitle: 'Daftar inventaris peralatan (EQUNR), akumulasi jam kerja mesin, dan sisa jam menuju servis berkala',
				rightBadge: 'SAP Table: EQUI / IMPTT',
				columns: ['Equipment ID', 'Model / Description', 'Current HM', 'Next PM Target', 'Remaining HM', 'Component Wear', 'Workshop Status'],
				rows: [
					{ cells: ['EQ-JML-EX014', 'Komatsu PC2000-8 Backhoe', '18,420 HM', '18,500 HM (PM1000)', '80 HM', 'Engine 78% | Hyd 64%', '▲ ACTIVE OPERATIONAL'], bold: true },
					{ cells: ['EQ-JML-DT108', 'Komatsu HD785-7 Dump Truck', '24,910 HM', '25,000 HM (Ovhl)', '90 HM', 'Transm 92% (Alert)', '▼ SCHEDULED OVERHAUL'] },
					{ cells: ['EQ-JML-DZ042', 'Komatsu D375A-6R Dozer', '14,210 HM', '14,500 HM (PM500)', '290 HM', 'Undercarriage 52%', '▲ ACTIVE OPERATIONAL'] },
					{ cells: ['EQ-JML-WL019', 'CAT 988K Wheel Loader', '11,880 HM', '12,000 HM (PM2000)', '120 HM', 'Final Drive 88%', '▼ WAITING PART (WOP)'] },
					{ cells: ['EQ-JML-CR005', 'Liebherr Crane HS 895 HD', '9,450 HM', '9,500 HM (PM500)', '50 HM', 'Slewing Bearing 41%', '▲ ACTIVE OPERATIONAL'] }
				]
			})}
      ${horizontalBarWidget({
				x: 24,
				y: 383,
				w: 560,
				h: 252,
				id: 'PAGE 2',
				title: 'Critical Component Life Usage (% Toward PCR Target)',
				subtitle: 'Persentase umur pakai komponen utama terhadap batas penggantian (PCR)',
				unit: '% Life',
				items: [
					{ label: 'Transmission HD785 #108', val: 92, display: '92% (18,400 / 20,000 HM)', color: '#ef4444' },
					{ label: 'Final Drive CAT988 #019', val: 88, display: '88% (15,840 / 18,000 HM)', color: '#f59e0b' },
					{ label: 'Engine Assy PC2000 #014', val: 78, display: '78% (19,500 / 25,000 HM)', color: '#0070f2' },
					{ label: 'Hydraulic Pump PC2000', val: 64, display: '64% (9,600 / 15,000 HM)', color: '#0d9488' },
					{ label: 'Undercarriage D375 #042', val: 52, display: '52% (6,240 / 12,000 HM)', color: '#059669' }
				]
			})}
      ${tableWidget({
				x: 598,
				y: 383,
				w: 578,
				h: 252,
				id: 'PAGE 3',
				title: 'Sparepart Backlog & Workshop Requisition (Waiting for Parts)',
				subtitle: 'Integrasi Work Order (PM) dengan Purchase Requisition / PO (SAP MM)',
				rightBadge: 'MM-PM Link',
				columns: ['Work Order', 'Equipment', 'Required Sparepart', 'PR / PO Status', 'ETA Site'],
				rows: [
					{ cells: ['WO-4009182', 'EQ-JML-WL019', 'Planetary Final Drive Seal Kit', 'PO #4500192841', '25 Oct 2026'], bold: true },
					{ cells: ['WO-4009204', 'EQ-JML-DT108', 'Overhaul Transmission Master Kit', 'In Transit (Balikpapan)', '26 Oct 2026'] },
					{ cells: ['WO-4009219', 'EQ-JML-EX014', 'High Pressure Hose Boom Cyl.', 'Available in Warehouse', 'Ready (GI)'] },
					{ cells: ['WO-4009235', 'EQ-JML-DZ042', 'Track Link Assembly D375', 'PR Released (Appr L2)', '02 Nov 2026'] }
				]
			})}
    `
	})
);

// --- 15. sac/pm-marine-fleet ---
saveSvg(
	'pm-marine-fleet.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'PM MARINE — Fleet Docking & Machinery Maintenance (JMT, STM & JML)',
		sheetTitle: 'Dry Docking Timeline, Main Engine Hours & Class Survey Certificates',
		filters: ['Fleet Entity: JMT, STM, JML', 'Classification: BKI / LR', 'Year: 2026 - 2027'],
		body: `
      ${tableWidget({
				x: 24,
				y: 114,
				w: 1152,
				h: 240,
				id: 'PAGE 1',
				title: 'Dry Docking Schedule & Class Survey Milestones (Intermediate & Special Survey)',
				subtitle: 'Jadwal pengedokan kapal tunda (Tugboat), tongkang (Barge), dan Floating Crane beserta estimasi anggaran',
				rightBadge: 'Docking Gantt',
				columns: ['Vessel Name / Hull ID', 'Entity', 'Survey Type', 'Shipyard Location', 'Timeline Window', 'Budget Capex', 'Status'],
				rows: [
					{ cells: ['TB. Jhonlin Power 08', 'JMT', 'Special Survey (5-Yr)', 'Dok Perkapalan Surabaya', '05 Nov - 28 Nov 2026', 'Rp 4.20 Bn', '▲ READY FOR DOCK'], bold: true },
					{ cells: ['BG. Samudera Perkasa 302 (300ft)', 'STM', 'Intermediate Survey', 'Galangan Batulicin', '12 Nov - 24 Nov 2026', 'Rp 1.85 Bn', '▲ SPARES ON SITE'] },
					{ cells: ['FC. Jhonlin Floating Crane 02', 'JML', 'Annual Class & Grab Ovhl', 'Anchorage In-Water', '01 Dec - 10 Dec 2026', 'Rp 2.60 Bn', '▲ SCHEDULED'] },
					{ cells: ['TB. Mandiri Samudera 14', 'STM', 'Propeller & Tailshaft Survey', 'Dok Banjarmasin', 'Completed Oct 2026', 'Rp 1.40 Bn', '▲ PASS / SAILING'] }
				]
			})}
      ${horizontalBarWidget({
				x: 24,
				y: 368,
				w: 560,
				h: 268,
				id: 'PAGE 2',
				title: 'Main Engine (ME) & Aux Gen Running Hours to Overhaul',
				subtitle: 'Akumulasi jam putar mesin induk kapal terhadap ambang Top Overhaul (8,000 Jam)',
				unit: 'Hours',
				items: [
					{ label: 'TB. Jhonlin 08 — ME Port', val: 7820, display: '7,820 / 8,000 Jam (98%)', color: '#ef4444' },
					{ label: 'TB. Jhonlin 08 — ME Stbd', val: 7790, display: '7,790 / 8,000 Jam (97%)', color: '#f59e0b' },
					{ label: 'TB. Mandiri 14 — ME Port', val: 5420, display: '5,420 / 8,000 Jam (68%)', color: '#0070f2' },
					{ label: 'FC. Crane 02 — Aux Gen #1', val: 6150, display: '6,150 / 8,000 Jam (77%)', color: '#0d9488' },
					{ label: 'BG. Samudera 302 — Winch', val: 3200, display: '3,200 / 8,000 Jam (40%)', color: '#059669' }
				]
			})}
      ${tableWidget({
				x: 598,
				y: 368,
				w: 578,
				h: 268,
				id: 'PAGE 3',
				title: 'Statutory & Class Survey Certificate Validity Tracker',
				subtitle: 'Peringatan dini masa berlaku dokumen kelaiklautan kapal (BKI / Syahbandar)',
				rightBadge: 'Marine Compliance',
				columns: ['Vessel Name', 'Certificate Type', 'Expiry Date', 'Days Left', 'Status'],
				rows: [
					{ cells: ['TB. Jhonlin Power 08', 'Sertifikat Keselamatan Konstruksi', '18 Nov 2026', '26 Days', '▼ RENEWAL IN PROGRESS'], bold: true },
					{ cells: ['BG. Samudera Perkasa 302', 'Sertifikat Garis Muat (Load Line)', '30 Nov 2026', '38 Days', '▲ SURVEY SCHEDULED'] },
					{ cells: ['FC. Floating Crane 02', 'IOPP Pollution Prevention Cert.', '15 Apr 2027', '174 Days', '▲ ACTIVE / VALID'] },
					{ cells: ['TB. Mandiri Samudera 14', 'BKI Hull & Machinery Class Cert.', '22 Sep 2028', '700 Days', '▲ ACTIVE / VALID'] }
				]
			})}
    `
	})
);

// --- 16. sac/pnl-trip-jmt ---
saveSvg(
	'pnl-trip-jmt.svg',
	sacCanvas({
		height: 670,
		storyTitle: 'PnL BY TRIP — Story 1: Jhonlin Marine Trans (JMT)',
		sheetTitle: 'Voyage P&L Matrix, Bunker Variance & Port Demurrage',
		filters: ['Company Code: JMT1', 'Voyage Status: Completed Trips', 'Period: Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 92, id: 'JMT-1', title: 'Completed Trips (MTD)', value: '142', unit: 'Voyages', delta: '▲ +11 Trips vs Sep 2026', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 92, id: 'JMT-2', title: 'Avg Revenue per Trip', value: '1,485', unit: 'IDR Mn', delta: '▲ Avg Cargo 7,850 MT / Barge', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 92, id: 'JMT-3', title: 'Bunker Variance vs Std', value: '-1.4%', unit: '(Saving)', delta: '▲ Hemat 18,400 Liter MGO MTD', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 92, id: 'JMT-4', title: 'Net Voyage Margin (JMT)', value: '34.2%', unit: '(508 Mn/Trip)', delta: '▲ Demurrage Ratio < 2.1%', positive: true, accent: '#7c3aed' })}
      ${tableWidget({
				x: 24,
				y: 220,
				w: 690,
				h: 225,
				id: 'PAGE 1',
				title: 'Voyage Margin & Net Profit per Trip Matrix (JMT)',
				subtitle: 'Laporan laba rugi tingkat perjalanan tunggal (Voyage Number) per pasangan Tug & Barge',
				rightBadge: 'Voyage P&L',
				columns: ['Voyage ID', 'Tug / Barge Pair', 'Route', 'Cargo (MT)', 'Freight Rev', 'Trip Cost', 'Net Margin %'],
				rows: [
					{ cells: ['VOY-JMT-261041', 'TB. Jhonlin 02 / BG.301', 'DSP -> Taboneo', '8,120 MT', '1,542 Mn', '940 Mn', '▲ 39.0% (+602 Mn)'], bold: true },
					{ cells: ['VOY-JMT-261042', 'TB. Jhonlin 05 / BG.304', 'DSP -> Suralaya', '7,890 MT', '2,480 Mn', '1,650 Mn', '▲ 33.5% (+830 Mn)'] },
					{ cells: ['VOY-JMT-261043', 'TB. Jhonlin 08 / BG.308', 'Bunati -> Paiton', '7,650 MT', '1,920 Mn', '1,310 Mn', '▲ 31.8% (+610 Mn)'] },
					{ cells: ['VOY-JMT-261044', 'TB. Jhonlin 11 / BG.310', 'DSP -> Taboneo', '8,040 MT', '1,527 Mn', '995 Mn', '▲ 34.8% (+532 Mn)'] }
				]
			})}
      ${comboChartWidget({
				x: 728,
				y: 220,
				w: 448,
				h: 225,
				id: 'PAGE 2',
				title: 'Trip Bunker Fuel Variance (Standard vs Actual)',
				subtitle: 'Alokasi standar MGO (kL) vs pemakaian riil Flowmeter',
				categories: ['V-1041', 'V-1042', 'V-1043', 'V-1044', 'V-1045'],
				bars1: [22.5, 64.0, 51.0, 22.5, 64.0],
				bars2: [21.8, 63.1, 52.4, 22.0, 61.8],
				bar1Label: 'Standard Quota (kL)',
				bar2Label: 'Actual Flowmeter (kL)',
				unitLeft: 'kL'
			})}
      ${horizontalBarWidget({
				x: 24,
				y: 459,
				w: 1152,
				h: 188,
				id: 'PAGE 3',
				title: 'Port Dues, Agency Clearance, Assist Tug & Demurrage Summary (IDR Mn)',
				subtitle: 'Komposisi biaya kepelabuhanan, keagenan kapal, pandu tunda, dan denda keterlambatan sandar (Demurrage)',
				unit: 'IDR Mn',
				items: [
					{ label: 'Bunker Fuel MGO (61%)', val: 89400, display: 'Rp 89,400 Mn (61.2% dari Total Trip Cost)', color: '#0070f2' },
					{ label: 'Port Dues & Channel Fee', val: 24800, display: 'Rp 24,800 Mn (17.0% — Alur & Labuh)', color: '#0d9488' },
					{ label: 'Assist Tug & Pilotage', val: 18200, display: 'Rp 18,200 Mn (12.5% — Pandu Tunda)', color: '#6366f1' },
					{ label: 'Agency, Clearance & Demurrage', val: 13600, display: 'Rp 13,600 Mn (9.3% — Syahbandar & Demurrage)', color: '#f59e0b' }
				]
			})}
    `
	})
);

// --- 17. sac/pnl-trip-stm ---
saveSvg(
	'pnl-trip-stm.svg',
	sacCanvas({
		height: 670,
		storyTitle: 'PnL BY TRIP — Story 2: Samudera Tiga Mandiri (STM)',
		sheetTitle: 'Voyage Waterfall P&L, Route Fuel Efficiency & Port Turnaround',
		filters: ['Company Code: STM1', 'Fleet: STM Tug & Barge', 'Period: Oct 2026'],
		body: `
      ${waterfallWidget({
				x: 24,
				y: 114,
				w: 620,
				h: 260,
				id: 'PAGE 1',
				title: 'STM Voyage Net Income Waterfall (Per Trip Average — IDR Mn)',
				subtitle: 'Dekomposisi Freight Revenue dikurangi Bunker, Port Clearance, Crew & Overhead ke Net Profit',
				unit: 'IDR Mn',
				steps: [
					{ label: 'Freight Rev', start: 0, end: 1620, val: 1620, isTotal: true },
					{ label: 'Bunker MGO', start: 1620, end: 980, val: -640 },
					{ label: 'Port & Assist', start: 980, end: 760, val: -220 },
					{ label: 'Crew & Vict.', start: 760, end: 630, val: -130 },
					{ label: 'Ins & Depr', start: 630, end: 525, val: -105 },
					{ label: 'Net Profit', start: 0, end: 525, val: 525, isTotal: true }
				]
			})}
      ${multiLineWidget({
				x: 658,
				y: 114,
				w: 518,
				h: 260,
				id: 'PAGE 2',
				title: 'Route Efficiency & Specific Fuel Rate (L / MT / NM)',
				subtitle: 'Indeks keekonomian bahan bakar per mil laut lintas kondisi cuaca',
				categories: MONTHS,
				unit: 'L/kMT-NM',
				series: [
					{ name: 'Laden Trip (Bermuatan)', color: '#0070f2', data: [14.2, 14.0, 13.8, 13.9, 13.6, 13.5, 13.7, 13.4, 13.3, 13.2] },
					{ name: 'Ballast Trip (Kosong)', color: '#0d9488', data: [9.8, 9.7, 9.5, 9.6, 9.4, 9.3, 9.4, 9.2, 9.1, 9.0] }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 388,
				w: 1152,
				h: 258,
				id: 'PAGE 3',
				title: 'Port Turnaround Time, Laytime Allowed vs Actual & Demurrage / Despatch Settlement',
				subtitle: 'Rekonsiliasi waktu tunggu muat/bongkar (Laytime) terhadap klaim Demurrage atau bonus Despatch',
				rightBadge: 'Laytime Settlement',
				columns: ['STM Voyage ID', 'Vessel Pair', 'Laytime Allowed', 'Actual Turnaround', 'Time Saved / Exceeded', 'Settlement Impact', 'Net Trip Profit'],
				rows: [
					{ cells: ['VOY-STM-26088', 'TB. Mandiri 04 / BG.302', '72.0 Hours', '58.5 Hours', '-13.5 Hours (Fast)', '▲ +Rp 42.0 Mn (Despatch)', 'Rp 567.0 Mn (35.0%)'], bold: true },
					{ cells: ['VOY-STM-26089', 'TB. Mandiri 07 / BG.305', '72.0 Hours', '68.0 Hours', '-4.0 Hours (On-Time)', '▲ Rp 0 (Within Laytime)', 'Rp 518.4 Mn (32.0%)'] },
					{ cells: ['VOY-STM-26090', 'TB. Mandiri 11 / BG.309', '96.0 Hours', '110.5 Hours', '+14.5 Hours (Swell)', '▼ -Rp 54.0 Mn (Demurrage)', 'Rp 442.0 Mn (27.3%)'] },
					{ cells: ['VOY-STM-26091', 'TB. Mandiri 14 / BG.312', '72.0 Hours', '61.0 Hours', '-11.0 Hours (Fast)', '▲ +Rp 34.5 Mn (Despatch)', 'Rp 559.5 Mn (34.5%)'] }
				]
			})}
    `
	})
);

console.log('Batch 2 (Marketing, PnL Segment, PM Mining/Marine, PnL Trip) generated.');
