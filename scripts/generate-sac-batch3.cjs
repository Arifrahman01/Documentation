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

// --- 18. sac/operation-mining-overview ---
saveSvg(
	'operation-mining-overview.svg',
	sacCanvas({
		height: 560,
		storyTitle: 'OPERATION MINING — Overview & Arsitektur Solusi (Pit-to-Port)',
		sheetTitle: '4-Sheet Architecture & S/4HANA Live Data Flow',
		connection: 'SAP PP / PM / MM / CO -> SAC LIVE',
		filters: ['Entities: PT Jhonlin Baratama (JB) & PT DSP', 'Scope: Pit-to-Port Value Chain'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 100, id: 'SHEET 1', title: 'Operational Overview (JB)', value: 'OB & Coal', unit: 'BCM / MT', delta: 'Fuel Ratio, Strip Ratio & Pit Trend', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 100, id: 'SHEET 2', title: 'Equipment Status (JB)', value: 'PA / MA / UA', unit: 'Availability', delta: 'Fleet Readiness & Pareto Breakdown', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 100, id: 'SHEET 3', title: 'Production & Logistics (DSP)', value: 'Haul & Barge', unit: 'Cycle & TPH', delta: 'Port Stockpile Aging & Jetty Rate', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 100, id: 'SHEET 4', title: 'Cost & Asset Util. (DSP)', value: 'IDR / MT', unit: 'BOR % & Conv.', delta: 'Handling Cost & Berth Occupancy', positive: true, accent: '#7c3aed' })}
      ${tableWidget({
				x: 24,
				y: 230,
				w: 1152,
				h: 306,
				id: 'DATAFLOW',
				title: 'Arsitektur Integrasi Data S/4HANA ke SAC Story Operation Mining',
				subtitle: 'Pemetaan modul SAP ERP, tabel sumber, dan parameter variabel link lintas 4 Sheet utama',
				rightBadge: 'Pit-to-Port CDS',
				columns: ['Sheet Name', 'Entitas Fokus', 'Modul SAP S/4HANA', 'Key Metrics / Widgets', 'Global Filter Link'],
				rows: [
					{ cells: ['Sheet 1: Operational Overview', 'Jhonlin Baratama (JB)', 'SAP PP / Production', 'OB Removal (BCM), Coal Getting (MT), Strip Ratio, Fuel Ratio', 'Company Code + Date + Pit'], bold: true },
					{ cells: ['Sheet 2: Equipment Status', 'Jhonlin Baratama (JB)', 'SAP PM (Plant Maint.)', 'PA %, MA %, UA %, Fleet Status Stacked Bar, Pareto Downtime', 'Company Code + Eq. Class'] },
					{ cells: ['Sheet 3: Production & Logistics', 'Dua Samudera Perkasa', 'SAP MM / SD / TM', 'Hauling Cycle Time, Stockpile Aging (<14d, 15-30d), Barging TPH', 'Plant DSP + Jetty ID'] },
					{ cells: ['Sheet 4: Cost & Asset Utilization', 'Dua Samudera Perkasa', 'SAP CO / FI / PM', 'Unit Handling Cost (IDR/MT), Conveyor Util %, Berth Occupancy (BOR)', 'Cost Center + Period'] }
				]
			})}
    `
	})
);

// --- 19. sac/op-mining-operational-overview ---
saveSvg(
	'op-mining-operational-overview.svg',
	sacCanvas({
		height: 700,
		storyTitle: 'OPERATION MINING — Sheet 1: Operational Overview (Jhonlin Baratama)',
		sheetTitle: 'OB Removal, Coal Getting, Strip Ratio & Pit Distribution',
		filters: ['Company Code: JB01', 'Pit: Pit Utara, Selatan, Timur', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 98, id: 'KPI-A', title: 'OB Removal Actual vs Target', value: '91.22M', unit: 'BCM', delta: '▲ 101.4% Achievement (Plan: 90.0M)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 98, id: 'KPI-B', title: 'Coal Getting Production', value: '14.22M', unit: 'MT', delta: '▲ +11.2% YoY (Plan: 13.85M MT)', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 98, id: 'KPI-C1', title: 'Actual Strip Ratio (SR)', value: '6.42', unit: 'BCM / MT', delta: '▲ Dibawah Batas SR Plan (6.50)', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 98, id: 'KPI-C2', title: 'Fuel Ratio OB & Coal', value: '1.18', unit: 'L / BCM', delta: 'Coal Fuel Ratio: 3.42 L/MT (Optimal)', positive: true, accent: '#f59e0b' })}
      ${comboChartWidget({
				x: 24,
				y: 226,
				w: 630,
				h: 235,
				id: 'TREND',
				title: 'Monthly OB Removal (BCM) & Coal Getting (MT) vs Strip Ratio',
				subtitle: 'Tren pengupasan tanah penutup (OB) dan penambangan batubara bulanan',
				categories: MONTHS,
				bars1: [8.8, 8.9, 9.1, 9.0, 9.2, 9.3, 9.1, 9.3, 9.2, 9.32],
				bars2: [1.36, 1.38, 1.42, 1.4, 1.44, 1.45, 1.42, 1.46, 1.44, 1.45],
				lineVals: [6.47, 6.45, 6.41, 6.43, 6.39, 6.41, 6.41, 6.37, 6.39, 6.42],
				bar1Label: 'OB Removal (M BCM)',
				bar2Label: 'Coal Getting (M MT)',
				lineLabel: 'Strip Ratio (x)',
				unitLeft: 'M Vol',
				unitRight: 'x'
			})}
      ${horizontalBarWidget({
				x: 668,
				y: 226,
				w: 508,
				h: 235,
				id: 'BY-PIT',
				title: 'OB Removal & Coal Production by Pit Location',
				subtitle: 'Realisasi produksi kumulatif per lokasi tambang (Pit)',
				unit: 'M MT / BCM',
				items: [
					{ label: 'Pit Utara (Block A)', val: 5.42, display: '5.42M MT Coal | 30.89M BCM OB', color: '#0070f2' },
					{ label: 'Pit Selatan (Block B)', val: 4.89, display: '4.89M MT Coal | 31.78M BCM OB', color: '#0d9488' },
					{ label: 'Pit Timur (Block C)', val: 3.91, display: '3.91M MT Coal | 28.54M BCM OB', color: '#7c3aed' }
				]
			})}
      ${tableWidget({
				x: 24,
				y: 475,
				w: 1152,
				h: 202,
				id: 'YTD-TBL',
				title: 'YTD Operational Performance Summary Table (with In-Cell Sparkline & Variance)',
				subtitle: 'Rekapitulasi target vs aktual produksi tambang PT Jhonlin Baratama',
				rightBadge: 'JB Mining KPI',
				columns: ['Operational Metric', 'UoM', 'YTD Target', 'YTD Actual', 'Achievement %', 'Monthly Sparkline Trend'],
				rows: [
					{ cells: ['Overburden (OB) Removal', 'BCM', '90,000,000', '91,222,000', '▲ 101.4%', '▃▄▅▄▆▇▆▇▇█ Consistent Growth'], bold: true },
					{ cells: ['Coal Getting (ROM Production)', 'MT', '13,850,000', '14,220,000', '▲ 102.7%', '▃▄▅▅▆▆▅▇▇█ Above Plan'], bold: true },
					{ cells: ['Strip Ratio (SR = OB / Coal)', 'BCM/MT', '6.50x', '6.42x', '▲ +1.2% Favorable', '▇▆▅▆▄▅▅▃▄▅ Controlled SR'] },
					{ cells: ['Fuel Ratio Overburden', 'Liter/BCM', '1.22 L/BCM', '1.18 L/BCM', '▲ +3.3% Fuel Saving', '▇▆▆▅▅▄▅▄▄▃ High Efficiency'] }
				]
			})}
    `
	})
);

// --- 20. sac/op-mining-equipment-status ---
saveSvg(
	'op-mining-equipment-status.svg',
	sacCanvas({
		height: 670,
		storyTitle: 'OPERATION MINING — Sheet 2: Equipment Status & Availability (JB)',
		sheetTitle: 'PA / MA / UA Gauges, Fleet Readiness & Breakdown Pareto',
		filters: ['Company Code: JB01', 'Fleet Type: Excavator, HD, Dozer, Grader', 'Shift: Day & Night'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 100, id: 'PA %', title: 'Physical Availability (PA)', value: '92.4%', unit: '(Target >= 90%)', delta: '▲ Formula: (W + S) / Total Hours', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 100, id: 'MA %', title: 'Mechanical Availability (MA)', value: '88.6%', unit: '(Target >= 85%)', delta: '▲ Formula: W / (W + R) Hours', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 100, id: 'UA %', title: 'Use of Availability (UA)', value: '84.2%', unit: '(Target >= 82%)', delta: '▲ Formula: W / (W + S) Effective Util.', positive: true, accent: '#7c3aed' })}
      ${comboChartWidget({
				x: 24,
				y: 228,
				w: 580,
				h: 418,
				id: 'FLEET-BAR',
				title: 'Breakdown Status by Equipment Type (Stacked Bar Chart)',
				subtitle: 'Perbandingan unit Operating, Standby, Scheduled Maintenance & Unscheduled Breakdown',
				categories: ['PC2000', 'PC1250', 'HD785-7', 'CAT 777E', 'D375 Dozer', 'Grader GD825'],
				bars1: [24, 32, 185, 96, 64, 34],
				bars2: [2, 3, 14, 8, 5, 2],
				lineVals: [92.3, 91.4, 93.0, 92.3, 92.8, 94.4],
				bar1Label: 'Operating / Ready',
				bar2Label: 'Down / Repair',
				lineLabel: 'PA % per Type',
				unitLeft: 'Units',
				unitRight: '%'
			})}
      ${horizontalBarWidget({
				x: 618,
				y: 228,
				w: 558,
				h: 418,
				id: 'PARETO',
				title: 'Top Breakdown Reasons — Pareto Analysis (Downtime Hours)',
				subtitle: '80/20 Root-cause jam kerusakan alat berat untuk prioritas mitigasi mekanik',
				unit: 'Downtime Hrs',
				items: [
					{ label: '1. Hydraulic Hose & Seal Leak', val: 420, display: '420 Jam (28.4% Kumulatif)', color: '#ef4444' },
					{ label: '2. Tyre Cut / Rim Damage (HD)', val: 310, display: '310 Jam (49.3% Kumulatif)', color: '#f59e0b' },
					{ label: '3. Engine Fuel Injection / Sensor', val: 245, display: '245 Jam (65.9% Kumulatif)', color: '#0070f2' },
					{ label: '4. Undercarriage Track Roller', val: 190, display: '190 Jam (78.7% Kumulatif)', color: '#0d9488' },
					{ label: '5. Electrical & Alternator', val: 165, display: '165 Jam (89.9% Kumulatif)', color: '#6366f1' },
					{ label: '6. Air Conditioner & Cabin', val: 150, display: '150 Jam (100% Total)', color: '#64748b' }
				]
			})}
    `
	})
);

// --- 21. sac/op-mining-production-logistics ---
saveSvg(
	'op-mining-production-logistics.svg',
	sacCanvas({
		height: 680,
		storyTitle: 'OPERATION MINING — Sheet 3: Production & Logistics Performance (DSP)',
		sheetTitle: 'Hauling Cycle Time, Port Stockpile Aging & Barging TPH Rate',
		filters: ['Company Code: DSP1', 'Hauling Road: KM 0 - KM 58', 'Jetty: Batulicin & Bunati'],
		body: `
      ${multiLineWidget({
				x: 24,
				y: 114,
				w: 565,
				h: 260,
				id: 'HAULING',
				title: 'Hauling Volume (kMT) & Average Cycle Time (Minutes)',
				subtitle: 'Kecepatan rotasi truk hauling dari ROM Pit ke Crushing Plant DSP',
				categories: MONTHS,
				unit: 'Minutes',
				series: [
					{ name: 'Hauling Cycle Time (Menit / Rit)', color: '#0070f2', data: [118, 116, 114, 115, 112, 110, 111, 109, 108, 107] },
					{ name: 'Target Maksimal Cycle Time (115m)', color: '#ef4444', data: [115, 115, 115, 115, 115, 115, 115, 115, 115, 115] }
				]
			})}
      ${comboChartWidget({
				x: 605,
				y: 114,
				w: 571,
				h: 260,
				id: 'BARGING',
				title: 'Barging Volume vs Target & Jetty Loading Rate (TPH)',
				subtitle: 'Realisasi pemuatan tongkang (kMT) dan produktivitas conveyor (Ton Per Hour)',
				categories: MONTHS,
				bars1: [1520, 1580, 1640, 1610, 1690, 1740, 1710, 1780, 1800, 1820],
				lineVals: [1420, 1450, 1490, 1480, 1520, 1550, 1540, 1580, 1610, 1625],
				bar1Label: 'Barging Vol (kMT)',
				lineLabel: 'Jetty Rate (TPH)',
				unitLeft: 'kMT',
				unitRight: ' TPH'
			})}
      ${tableWidget({
				x: 24,
				y: 388,
				w: 1152,
				h: 268,
				id: 'AGING-HEAT',
				title: 'Port Stockpile Capacity & Coal Aging Heatmap Table (FIFO Spontaneous Combustion Control)',
				subtitle: 'Pemantauan umur tumpukan batubara (<14 Hari, 15-30 Hari, >30 Hari) untuk mencegah swabakar (spontaneous heating)',
				rightBadge: 'FIFO Stockpile',
				columns: ['Stockpile Yard ID', 'Max Capacity', 'Current Stock', 'Fresh (< 14 Days)', 'Moderate (15-30d)', 'Critical (> 30d)', 'FIFO Status'],
				rows: [
					{ cells: ['Stockpile DS02 - DS05 (Crushed)', '350,000 MT', '295,000 MT (84%)', '268,000 MT', '27,000 MT', '0 MT', '▲ PASS (Optimal FIFO)'], bold: true },
					{ cells: ['Stockpile DS06 - DS09 (Crushed)', '280,000 MT', '214,320 MT (77%)', '192,320 MT', '22,000 MT', '0 MT', '▲ PASS (Optimal FIFO)'] },
					{ cells: ['ROM Raw Yard DSP (Uncrushed)', '500,000 MT', '412,850 MT (83%)', '360,850 MT', '48,000 MT', '4,000 MT', '▼ PRIORITY CRUSHING'] },
					{ cells: ['Bunati & Sarangga Terminal Yard', '250,000 MT', '175,000 MT (70%)', '165,000 MT', '10,000 MT', '0 MT', '▲ PASS (Fast Turnaround)'] },
					{ cells: ['TOTAL PORT STOCKPILE DSP', '1,380,000 MT', '1,097,170 MT (80%)', '986,170 MT (90%)', '107,000 MT (9.7%)', '4,000 MT (0.3%)', '▲ SAFE (<1% Over 30d)'], bold: true }
				]
			})}
    `
	})
);

// --- 22. sac/op-mining-cost-asset-utilization ---
saveSvg(
	'op-mining-cost-asset-utilization.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'OPERATION MINING — Sheet 4: Cost Control & Asset Utilization (DSP)',
		sheetTitle: 'Handling Cost IDR/MT, Fuel Index, Conveyor Util % & Berth Occupancy (BOR)',
		filters: ['Company Code: DSP1', 'Cost Center: Port & Crushing', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 98, id: 'COST-1', title: 'Port Handling Cost / Ton', value: '88,420', unit: 'IDR / MT', delta: '▲ -4.1% Dibawah Budget (Rp 92,200)', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 98, id: 'FUEL-2', title: 'Port Equipment Fuel Index', value: '0.64', unit: 'Liter / MT', delta: '▲ Efisiensi Wheel Loader & Genset', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 98, id: 'CONV-3', title: 'Overland Conveyor Util.', value: '86.4%', unit: 'Effective Hrs', delta: '▲ Throughput 1,625 Ton / Jam', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 98, id: 'BOR-4', title: 'Berth Occupancy Rate (BOR)', value: '68.5%', unit: '(Standard <=70%)', delta: '▲ Zero Barge Queue Bottleneck', positive: true, accent: '#7c3aed' })}
      ${comboChartWidget({
				x: 24,
				y: 226,
				w: 580,
				h: 410,
				id: 'COST-TREND',
				title: 'Monthly Handling Cost per Ton (IDR/MT) vs Fuel Index (L/MT)',
				subtitle: 'Pengendalian biaya operasional pelabuhan per ton throughput batubara',
				categories: MONTHS,
				bars1: [92.1, 91.4, 89.8, 90.2, 88.9, 87.8, 88.2, 86.9, 85.8, 86.1],
				lineVals: [0.68, 0.67, 0.66, 0.66, 0.65, 0.64, 0.64, 0.63, 0.63, 0.62],
				bar1Label: 'Handling Cost (kIDR/MT)',
				lineLabel: 'Fuel Index (L/MT)',
				unitLeft: 'kIDR',
				unitRight: ' L'
			})}
      ${horizontalBarWidget({
				x: 618,
				y: 226,
				w: 558,
				h: 410,
				id: 'ASSET-UTIL',
				title: 'Port Infrastructure Asset Utilization & Berth Occupancy (%)',
				subtitle: 'Tingkat pemanfaatan kapasitas terpasang fasilitas Crushing, Conveyor, dan Dermaga Jetty',
				unit: '% Util',
				items: [
					{ label: 'Barge Loader Conveyor #1', val: 89.2, display: '89.2% Effective Utilization', color: '#059669' },
					{ label: 'Barge Loader Conveyor #2', val: 83.6, display: '83.6% Effective Utilization', color: '#0070f2' },
					{ label: 'Crushing Plant Line 1-2', val: 85.0, display: '85.0% Capacity Utilization', color: '#0d9488' },
					{ label: 'Jetty Batulicin Berth #1-2', val: 69.4, display: '69.4% Berth Occupancy (Optimal)', color: '#7c3aed' },
					{ label: 'Bunati Jetty Berth #1', val: 66.8, display: '66.8% Berth Occupancy (Optimal)', color: '#f59e0b' }
				]
			})}
    `
	})
);

// --- 23. sac/operation-marine-overview ---
saveSvg(
	'operation-marine-overview.svg',
	sacCanvas({
		height: 560,
		storyTitle: 'OPERATION MARINE — Overview & Arsitektur Solusi Pelayaran',
		sheetTitle: 'Marine Fleet Classification & 4-Sheet SAC Story Architecture',
		connection: 'SAP TM / PM / FI-CO -> SAC LIVE',
		filters: ['Entities: JML, JMT & STM', 'Fleet: Tug/Barge, SPOB & Floating Crane'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 280, h: 100, id: 'SHEET 1', title: 'Activity & Available Unit', value: 'Fleet PA %', unit: '& Timesheet', delta: 'Available vs Breakdown & Cycle Days', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 318, y: 114, w: 280, h: 100, id: 'SHEET 2', title: 'Cost & Sales Period', value: 'Monthly P&L', unit: 'Rev vs Cost', delta: 'Bunker, Clearance, PBBKB, Assist', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 612, y: 114, w: 275, h: 100, id: 'SHEET 3', title: 'Cost & Sales Date', value: 'Daily Log', unit: 'Date Filter', delta: 'Granular Daily Vessel Ledger', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 901, y: 114, w: 275, h: 100, id: 'SHEET 4', title: 'Stevedoring Activity (JML)', value: 'Transhipment', unit: 'Floating Crane', delta: 'Export/Dom, Geared vs Gearless', positive: true, accent: '#7c3aed' })}
      ${tableWidget({
				x: 24,
				y: 230,
				w: 1152,
				h: 306,
				id: 'MARINE-ARCH',
				title: 'Klasifikasi Armada Laut & Struktur Navigasi 4 Sheet Operation Marine',
				subtitle: 'Integrasi data operasional kapal tunda, tongkang, SPOB, dan Floating Crane lintas entitas maritim',
				rightBadge: 'Marine CDS Live',
				columns: ['Sheet Name', 'Fokus Analitik', 'Armada Tercakup', 'Komponen Visualisasi Utama'],
				rows: [
					{ cells: ['Sheet 1: Activity & Available Unit', 'Kesiapan & Siklus Waktu Kapal', 'Tugboat (TB), Barge (BG), SPOB', 'Available/Breakdown KPI, Timesheet Donut, Voyage Cycle Bar'], bold: true },
					{ cells: ['Sheet 2: Cost & Sales Period', 'Profitabilitas Bulanan / Tahunan', 'Seluruh Armada JML, JMT, STM', 'Monthly Rev vs Cost Combo Chart, Cost Breakdown Donut'], bold: true },
					{ cells: ['Sheet 3: Cost & Sales Date', 'Audit Transaksi Harian (Tanggal)', 'Per Unit Kapal & Rute Harian', 'Date Range Input Control, Granular Daily Vessel P&L Table'] },
					{ cells: ['Sheet 4: Stevedoring Activity', 'Bongkar Muat Lepas Pantai (JML)', 'Floating Crane (FC) & Mother Vessel', 'FC Readiness KPI, Export vs Domestic, Geared vs Gearless Chart'] }
				]
			})}
    `
	})
);

// --- 24. sac/op-marine-activity-available-unit ---
saveSvg(
	'op-marine-activity-available-unit.svg',
	sacCanvas({
		height: 670,
		storyTitle: 'OPERATION MARINE — Sheet 1: Activity & Available Unit',
		sheetTitle: 'Vessel Availability, Timesheet Distribution & Voyage Cycle Duration',
		filters: ['Entities: JML, JMT, STM', 'Vessel Type: Tug & Barge, SPOB', 'Period: Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 95, id: 'AVAIL', title: 'Available Vessel Units (Active)', value: '68', unit: 'Vessels (91.9%)', delta: '▲ Siap Berlayar / Operasi Normal', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 95, id: 'DOWN', title: 'Breakdown / Docking Units', value: '6', unit: 'Vessels (8.1%)', delta: '4 Scheduled Docking, 2 Unscheduled', positive: true, accent: '#f59e0b' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 95, id: 'CYCLE', title: 'Avg Turnaround Cycle Time', value: '6.8', unit: 'Days / Trip', delta: '▲ -0.6 Hari Lebih Cepat vs Target', positive: true, accent: '#0070f2' })}
      ${comboChartWidget({
				x: 24,
				y: 223,
				w: 580,
				h: 220,
				id: 'FLEET-GRP',
				title: 'Fleet Availability by Vessel Category (Active vs Docking)',
				subtitle: 'Status kesiapan unit per kategori armada laut',
				categories: ['Tugboat (TB)', 'Barge 300ft', 'Barge 330ft', 'SPOB Tanker', 'Floating Crane'],
				bars1: [28, 18, 12, 6, 4],
				bars2: [2, 2, 1, 1, 0],
				bar1Label: 'Available (Unit)',
				bar2Label: 'Docking / Repair',
				unitLeft: 'Vessels'
			})}
      ${donutWidget({
				x: 618,
				y: 223,
				w: 558,
				h: 220,
				id: 'TIMESHEET',
				title: 'Vessel Timesheet Activity Distribution (%)',
				subtitle: 'Proporsi alokasi jam operasional kapal dalam 1 siklus pelayaran',
				centerTitle: 'Cycle Hours',
				centerVal: '100% Time',
				slices: [
					{ label: 'Steaming Laden / Ballast', val: '52% Hours', pct: 52, color: '#0070f2' },
					{ label: 'Loading & Discharging', val: '28% Hours', pct: 28, color: '#059669' },
					{ label: 'Waiting Tide / Anchorage', val: '12% Hours', pct: 12, color: '#f59e0b' },
					{ label: 'Bunkering & Maintenance', val: '8% Hours', pct: 8, color: '#6366f1' }
				]
			})}
      ${horizontalBarWidget({
				x: 24,
				y: 457,
				w: 1152,
				h: 190,
				id: 'CYCLE-BAR',
				title: 'Average Voyage Cycle Duration by Shipping Corridor (Days per Round-Trip)',
				subtitle: 'Perbandingan durasi putaran penuh kapal (Loading -> Sailing -> Discharging -> Ballast Return)',
				unit: 'Days',
				items: [
					{ label: 'DSP Batulicin <-> Taboneo', val: 3.4, display: '3.4 Days Round-Trip (Target: 3.5 Days)', color: '#059669' },
					{ label: 'Bunati <-> Taboneo Anchorage', val: 2.8, display: '2.8 Days Round-Trip (Target: 3.0 Days)', color: '#0d9488' },
					{ label: 'Bunati <-> PLTU Paiton', val: 8.6, display: '8.6 Days Round-Trip (Target: 9.0 Days)', color: '#0070f2' },
					{ label: 'DSP Batulicin <-> PLTU Suralaya', val: 12.4, display: '12.4 Days Round-Trip (Target: 12.5 Days)', color: '#6366f1' }
				]
			})}
    `
	})
);

// --- 25. sac/op-marine-cost-sales-period ---
saveSvg(
	'op-marine-cost-sales-period.svg',
	sacCanvas({
		height: 660,
		storyTitle: 'OPERATION MARINE — Sheet 2: Cost & Sales Period (Monthly / Yearly)',
		sheetTitle: 'Marine Revenue vs Operating Cost & Cost Structure Breakdown',
		filters: ['Entities: JML, JMT, STM', 'Fiscal Year: 2026', 'Period: Jan - Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 95, id: 'REV', title: 'Total Marine Freight Revenue', value: '2,901.2', unit: 'IDR Bn', delta: '▲ +14.6% YoY (JML + JMT + STM)', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 95, id: 'COST', title: 'Total Marine Operating Cost', value: '1,984.4', unit: 'IDR Bn', delta: '▲ Cost-to-Income Ratio 68.4%', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 95, id: 'MARGIN', title: 'Gross Voyage Profit Margin', value: '31.6%', unit: '(916.8 Bn)', delta: '▲ +140 bps YoY Margin Expansion', positive: true, accent: '#059669' })}
      ${comboChartWidget({
				x: 24,
				y: 223,
				w: 650,
				h: 414,
				id: 'REV-COST',
				title: 'Monthly Marine Revenue vs Operating Cost & Margin %',
				subtitle: 'Perbandingan pendapatan pelayaran bulanan terhadap biaya operasional kapal (IDR Bn)',
				categories: MONTHS,
				bars1: [268, 275, 286, 280, 292, 298, 290, 302, 304, 306.2],
				bars2: [186, 190, 196, 193, 199, 202, 198, 205, 207, 208.4],
				lineVals: [30.6, 30.9, 31.5, 31.1, 31.8, 32.2, 31.7, 32.1, 31.9, 31.9],
				bar1Label: 'Marine Revenue (Bn)',
				bar2Label: 'Operating Cost (Bn)',
				lineLabel: 'Gross Margin %',
				unitLeft: 'IDR Bn',
				unitRight: '%'
			})}
      ${donutWidget({
				x: 688,
				y: 223,
				w: 488,
				h: 414,
				id: 'COST-DONUT',
				title: 'Marine Operating Cost Structure Breakdown',
				subtitle: 'Komposisi elemen biaya pelayaran (Bunker, Clearance, PBBKB, Assist)',
				centerTitle: 'Total Cost',
				centerVal: '1,984 Bn',
				slices: [
					{ label: 'Bunker Fuel (MGO)', val: '1,151 Bn', pct: 58, color: '#0070f2' },
					{ label: 'Port Clearance & Alur', val: '337 Bn', pct: 17, color: '#0d9488' },
					{ label: 'Assist Tug & Pandu', val: '258 Bn', pct: 13, color: '#f59e0b' },
					{ label: 'PBBKB Tax & Crew/Ins', val: '238 Bn', pct: 12, color: '#6366f1' }
				]
			})}
    `
	})
);

// --- 26. sac/op-marine-cost-sales-date ---
saveSvg(
	'op-marine-cost-sales-date.svg',
	sacCanvas({
		height: 640,
		storyTitle: 'OPERATION MARINE — Sheet 3: Cost & Sales Date (Daily Granular Tracking)',
		sheetTitle: 'Daily Vessel Revenue, Bunker Consumption & Daily Margin Ledger',
		filters: ['Date Range: 01 Oct 2026 - 23 Oct 2026', 'Vessel: All Active Fleet', 'Route: All Routes'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 90, id: 'DATE-FLT', title: 'Selected Date Window Revenue', value: '228.4', unit: 'IDR Bn (23 Days)', delta: '▲ Avg Daily Revenue: Rp 9.93 Bn/Hari', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 90, id: 'DAILY-FUEL', title: 'Daily Bunker Consumption', value: '142,800', unit: 'Liters / Day', delta: '▲ Sesuai Standar Jam Putar ME', positive: true, accent: '#0d9488' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 90, id: 'DAILY-NET', title: 'Selected Window Net Margin', value: '72.8', unit: 'IDR Bn (31.9%)', delta: '▲ Zero Unbilled Completed Trips', positive: true, accent: '#059669' })}
      ${tableWidget({
				x: 24,
				y: 218,
				w: 1152,
				h: 398,
				id: 'DAILY-TBL',
				title: 'Granular Daily Vessel Cost & Sales Transaction Table (Filtered by Exact Date)',
				subtitle: 'Tabel rincian transaksi harian per kapal untuk rekonsiliasi BAST muatan, ROB BBM, dan penagihan uang tambang',
				rightBadge: 'Daily Date Filter',
				columns: ['Posting Date', 'Vessel / Tug-Barge', 'Route Corridor', 'Cargo (MT)', 'Bunker (L)', 'Daily Cost', 'Daily Revenue', 'Net Margin'],
				rows: [
					{ cells: ['2026-10-23', 'TB. Jhonlin 02 / BG.301', 'DSP -> Taboneo', '8,120 MT', '21,800 L', 'Rp 940.0 Mn', 'Rp 1,542.8 Mn', '▲ +Rp 602.8 Mn (39.1%)'], bold: true },
					{ cells: ['2026-10-23', 'TB. Mandiri 04 / BG.302', 'Bunati -> Taboneo', '7,950 MT', '19,400 L', 'Rp 865.0 Mn', 'Rp 1,431.0 Mn', '▲ +Rp 566.0 Mn (39.6%)'] },
					{ cells: ['2026-10-22', 'TB. Jhonlin 05 / BG.304', 'DSP -> Suralaya', '7,890 MT', '63,100 L', 'Rp 1,650.0 Mn', 'Rp 2,480.0 Mn', '▲ +Rp 830.0 Mn (33.5%)'] },
					{ cells: ['2026-10-22', 'SPOB. Jhonlin Bunker 01', 'Taboneo Supply', '1,200 kL', '4,200 L', 'Rp 185.0 Mn', 'Rp 290.0 Mn', '▲ +Rp 105.0 Mn (36.2%)'] },
					{ cells: ['2026-10-21', 'TB. Jhonlin 08 / BG.308', 'Bunati -> Paiton', '7,650 MT', '52,400 L', 'Rp 1,310.0 Mn', 'Rp 1,920.0 Mn', '▲ +Rp 610.0 Mn (31.8%)'] },
					{ cells: ['2026-10-21', 'TB. Mandiri 11 / BG.309', 'DSP -> Tanjung Jati', '7,720 MT', '58,900 L', 'Rp 1,490.0 Mn', 'Rp 2,084.4 Mn', '▲ +Rp 594.4 Mn (28.5%)'] },
					{ cells: ['2026-10-20', 'TB. Jhonlin 11 / BG.310', 'DSP -> Taboneo', '8,040 MT', '22,000 L', 'Rp 995.0 Mn', 'Rp 1,527.6 Mn', '▲ +Rp 532.6 Mn (34.9%)'] },
					{ cells: ['TOTAL WINDOW (01 - 23 OCT)', '68 Active Vessels', 'All Corridors', '1,184,500 MT', '3,284,400 L', 'Rp 155,600 Mn', 'Rp 228,400 Mn', '▲ +Rp 72,800 Mn (31.9%)'], bold: true }
				]
			})}
    `
	})
);

// --- 27. sac/op-marine-stevedoring-activity ---
saveSvg(
	'op-marine-stevedoring-activity.svg',
	sacCanvas({
		height: 700,
		storyTitle: 'OPERATION MARINE — Sheet 4: Stevedoring Activity (JML Transhipment)',
		sheetTitle: 'Floating Crane Readiness, Export vs Domestic & Geared vs Gearless Vessel',
		filters: ['Company Code: JML1', 'Anchorage: Taboneo & Bunati', 'Period: YTD Oct 2026'],
		body: `
      ${kpiTile({ x: 24, y: 114, w: 372, h: 92, id: 'FC-AVAIL', title: 'Available Floating Cranes (FC)', value: '4', unit: 'Units (100% Ready)', delta: '▲ Zero Unscheduled Crane Breakdown', positive: true, accent: '#059669' })}
      ${kpiTile({ x: 414, y: 114, w: 372, h: 92, id: 'STEV-VOL', title: 'Total Transhipment Cargo', value: '12.62M', unit: 'MT (YTD Oct)', delta: '▲ +15.8% YoY Mother Vessel Loaded', positive: true, accent: '#0070f2' })}
      ${kpiTile({ x: 804, y: 114, w: 372, h: 92, id: 'LOAD-RATE', title: 'Avg Floating Crane Loading Rate', value: '18,450', unit: 'MT / Day', delta: '▲ Despatch Earned pada 78% Mother Vessel', positive: true, accent: '#7c3aed' })}
      ${multiLineWidget({
				x: 24,
				y: 220,
				w: 565,
				h: 225,
				id: 'SHIPPER-LINE',
				title: 'Monthly Stevedoring Cargo by Shipper (kMT)',
				subtitle: 'Tren volume pemuatan kapal induk per pemilik kargo (Jhonlin Group vs Third Party)',
				categories: MONTHS,
				unit: 'kMT',
				series: [
					{ name: 'Jhonlin Baratama (Internal)', color: '#0070f2', data: [920, 950, 990, 970, 1020, 1050, 1030, 1080, 1100, 1120] },
					{ name: 'Third-Party Coal Shippers', color: '#0d9488', data: [210, 220, 230, 225, 240, 250, 245, 260, 265, 245] }
				]
			})}
      ${comboChartWidget({
				x: 605,
				y: 220,
				w: 571,
				h: 225,
				id: 'DEST-STACK',
				title: 'Stevedoring Quantity by Destination (Export vs Domestic)',
				subtitle: 'Komposisi muatan kapal tujuan Ekspor vs PLTU Domestik (kMT)',
				categories: MONTHS,
				bars1: [780, 810, 850, 830, 880, 910, 890, 940, 960, 965],
				bars2: [350, 360, 370, 365, 380, 390, 385, 400, 405, 400],
				bar1Label: 'Export Mother Vessel',
				bar2Label: 'Domestic Vessel',
				unitLeft: 'kMT'
			})}
      ${comboChartWidget({
				x: 24,
				y: 459,
				w: 565,
				h: 218,
				id: 'GEARED',
				title: 'Geared vs Gearless Mother Vessel Cargo & Vessel Count',
				subtitle: 'Volume kargo berdasarkan tipe kapal induk (Geared Crane vs Gearless Panamax)',
				categories: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Oct 2026'],
				bars1: [2150, 2380, 2520, 890],
				bars2: [1320, 1410, 1490, 475],
				lineVals: [48, 52, 56, 19],
				bar1Label: 'Gearless Vessel (kMT)',
				bar2Label: 'Geared Vessel (kMT)',
				lineLabel: 'Vessel Calls',
				unitLeft: 'kMT',
				unitRight: ' MV'
			})}
      ${horizontalBarWidget({
				x: 605,
				y: 459,
				w: 571,
				h: 218,
				id: 'POL-BAR',
				title: 'Stevedoring Volume by Anchorage / Port of Loading',
				subtitle: 'Distribusi titik alih-muat (Transhipment Anchorage)',
				unit: 'M MT',
				items: [
					{ label: 'Taboneo Anchorage', val: 6.42, display: '6.42M MT (84 Mother Vessels)', color: '#0070f2' },
					{ label: 'Bunati Anchorage', val: 3.85, display: '3.85M MT (51 Mother Vessels)', color: '#0d9488' },
					{ label: 'Tanah Merah Offshore', val: 2.35, display: '2.35M MT (32 Mother Vessels)', color: '#7c3aed' }
				]
			})}
    `
	})
);

console.log('Batch 3 (Operation Mining 5 docs + Operation Marine 5 docs) generated.');
