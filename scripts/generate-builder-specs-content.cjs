const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DOCS_PATH = path.join(__dirname, '..', 'data', 'documents.json');
const LIB_DOCS_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'documents.json');
const INDEX_PATH = path.join(__dirname, '..', 'src', 'lib', 'data', 'docsIndex.json');
const MANIFEST_PATH = path.join(__dirname, 'builder-images-manifest.json');

const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';

let manifest = {};
if (fs.existsSync(MANIFEST_PATH)) {
	manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// Helper to extract clean headers & rows with their original row indexes
function extractSheetRows(filePath, sheetName) {
	if (!fs.existsSync(filePath)) {
		console.warn(`File not found: ${filePath}`);
		return { headers: [], rows: [] };
	}
	const wb = XLSX.readFile(filePath);
	const ws = wb.Sheets[sheetName];
	if (!ws) {
		console.warn(`Sheet ${sheetName} not found in ${filePath}`);
		return { headers: [], rows: [] };
	}
	const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

	let headerIdx = -1;
	for (let i = 0; i < Math.min(10, data.length); i++) {
		const row = data[i] || [];
		if (
			row.some(
				(cell) =>
					typeof cell === 'string' &&
					(cell.toLowerCase().includes('widget') ||
						cell.toLowerCase().includes('measure') ||
						cell.toLowerCase() === 'no')
			)
		) {
			headerIdx = i;
			break;
		}
	}
	if (headerIdx === -1) return { headers: [], rows: [] };

	const headers = (data[headerIdx] || []).map((h) => String(h || '').trim());
	const rows = [];
	for (let i = headerIdx + 1; i < data.length; i++) {
		const r = data[i];
		if (r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== '')) {
			rows.push({
				data: r,
				rowIndex: i
			});
		}
	}

	return { headers, rows };
}

function formatRowToMarkdown(rowObj, headers, index, sheetImgs) {
	const row = rowObj.data;
	const rowIndex = rowObj.rowIndex;

	const getVal = (pattern) => {
		const idx = headers.findIndex((h) => h.toLowerCase().includes(pattern.toLowerCase()));
		if (idx === -1 || row[idx] === undefined || row[idx] === null) return '';
		return String(row[idx]).trim();
	};

	const widgetNo = getVal('no') || index + 1;
	const widgetName = getVal('widget') || `Widget ${widgetNo}`;
	const cds = getVal('cds') || getVal('widget on page') || '';
	const measure = getVal('measure') || '';
	const dimension = getVal('dimension') || '';
	const sourceData = getVal('source data') || '';
	const tcode = getVal('t-code') || getVal('tcode') || '-';
	const variant = getVal('variant') || '-';

	let md = `## Widget ${widgetNo}: ${widgetName}\n\n`;

	// Find matching image for this row in sheetImgs
	const matchedImg = (sheetImgs || []).find((img) => img.row === rowIndex);
	if (matchedImg && matchedImg.savedImage) {
		md += `![Tangkapan Layar ${widgetName.replace(/["\[\]]/g, '')}](${matchedImg.savedImage})\n\n`;
	}

	md += `| Atribut Konfigurasi | Detail Spesifikasi Teknis |\n`;
	md += `|---|---|\n`;
	md += `| **Nomor & Nama Widget** | \`[W${widgetNo}]\` **${widgetName.replace(/\|/g, '\\|')}** |\n`;
	if (cds) md += `| **Model & CDS View** | \`${cds.replace(/\r?\n/g, ' ')}\` |\n`;
	if (dimension) md += `| **Dimensi & Filter** | ${dimension.replace(/\r?\n/g, '<br/>').replace(/\|/g, '\\|')} |\n`;
	if (tcode && tcode !== '-') md += `| **T-Code Rekonsiliasi SAP** | \`${tcode}\` |\n`;
	if (variant && variant !== '-') md += `| **Variant / Parameter** | \`${variant}\` |\n`;
	md += `\n`;

	if (measure) {
		md += `### Formula & Aturan Kalkulasi (Measures)\n`;
		md += `\`\`\`text\n${measure}\n\`\`\`\n\n`;
	}

	if (sourceData) {
		md += `### Logika Sumber Data Backend (CDS SQL / Query Logic)\n`;
		md += `\`\`\`sql\n${sourceData}\n\`\`\`\n\n`;
	}

	return md;
}

const BUILDER_MAPPINGS = {
	'sac/finance-financial-performance': {
		file: '1. Finance/Story Builder Spec - Finance.xlsx',
		sheet: 'Financial Performance',
		title: 'Financial Performance'
	},
	'sac/finance-position-covenant': {
		file: '1. Finance/Story Builder Spec - Finance.xlsx',
		sheet: 'Financial Position and Cov Rat.',
		title: 'Financial Position & Coverage Ratios'
	},
	'sac/finance-ap-ar-highlight': {
		file: '1. Finance/Story Builder Spec - Finance.xlsx',
		sheet: 'AP & AR Highlight',
		title: 'Accounts Payable & Receivable Highlight'
	},
	'sac/finance-cash-position': {
		file: '1. Finance/Story Builder Spec - Finance.xlsx',
		sheet: 'Cash Position',
		title: 'Cash Position & Treasury Management'
	},
	'sac/finance-coal-price-benchmark': {
		file: '1. Finance/Story Builder Spec - Finance.xlsx',
		sheet: 'Coal Price & Actual Benchmark',
		title: 'Coal Price Actual & Market Benchmarks'
	},
	'sac/marketing-price-quantity-benchmark': {
		file: '2. Marketing/Story Builder Spec - Marketing.xlsx',
		sheet: 'Price&Quantity Benchmark',
		title: 'Price & Quantity Benchmark'
	},
	'sac/marketing-inventory-stock': {
		file: '2. Marketing/Story Builder Spec - Marketing.xlsx',
		sheet: 'Inventory Stock',
		title: 'Inventory Stock & Transit Position'
	},
	'sac/op-mining-operational-overview': {
		file: '3. Operation Mining/Story Builder Spec - Operation Mining.xlsx',
		sheet: 'OP_Overview_JB',
		title: 'Sheet 1: Operational Overview JB'
	},
	'sac/op-mining-equipment-status': {
		file: '3. Operation Mining/Story Builder Spec - Operation Mining.xlsx',
		sheet: 'Equipment_Stat_JB',
		title: 'Sheet 2: Equipment Status & Availability JB'
	},
	'sac/op-mining-production-logistics': {
		file: '3. Operation Mining/Story Builder Spec - Operation Mining.xlsx',
		sheet: 'Prod&Log_Perf_DSP',
		title: 'Sheet 3: Production & Logistics Performance DSP'
	},
	'sac/op-mining-cost-asset-utilization': {
		file: '3. Operation Mining/Story Builder Spec - Operation Mining.xlsx',
		sheet: 'Cost&Asset_Utl_DSP',
		title: 'Sheet 4: Cost Control & Asset Utilization DSP'
	},
	'sac/op-marine-activity-available-unit': {
		file: '4. Operation Marine/Story Builder Spec - Operation Marine.xlsx',
		sheet: 'Activity & Avail. Unit',
		title: 'Sheet 1: Activity & Available Unit'
	},
	'sac/op-marine-cost-sales-period': {
		file: '4. Operation Marine/Story Builder Spec - Operation Marine.xlsx',
		sheet: 'Cost & Sales Period',
		title: 'Sheet 2: Cost & Sales Period'
	},
	'sac/op-marine-cost-sales-date': {
		file: '4. Operation Marine/Story Builder Spec - Operation Marine.xlsx',
		sheet: 'Cost & Sales Date',
		title: 'Sheet 3: Cost & Sales Date'
	},
	'sac/op-marine-stevedoring-activity': {
		file: '4. Operation Marine/Story Builder Spec - Operation Marine JML.xlsx',
		sheet: 'Stevedoring Act.',
		title: 'Sheet 4: Stevedoring Activity JML'
	},
	'sac/supply-chain-procurement-cycle': {
		file: '5. Supply Chain/Story Builder Spec - Supply Chain.xlsx',
		sheet: 'Procurement Cycle',
		title: 'Sheet 1: Procurement Cycle'
	},
	'sac/supply-chain-supplier-performance': {
		file: '5. Supply Chain/Story Builder Spec - Supply Chain.xlsx',
		sheet: 'Supplier Performance',
		title: 'Sheet 2: Supplier Performance'
	},
	'sac/supply-chain-closing-value-dead-stock': {
		file: '5. Supply Chain/Story Builder Spec - Supply Chain.xlsx',
		sheet: 'Closing Value All Unit',
		title: 'Sheet 3: Closing Value All Unit & Dead Stock'
	},
	'sac/pnl-segment-jg': {
		file: '6. PnL Mining/Story Builder Spec - PnL_JG.xlsx',
		sheet: 'Profit And Loss Table',
		title: 'PnL Konsolidasi Jhonlin Group (JG)'
	},
	'sac/pnl-segment-jb': {
		file: '6. PnL Mining/Story Builder Spec - PnL_JG.xlsx',
		sheet: 'Profit And Loss Table (RPMT)',
		title: 'PnL Mining Jhonlin Baratama (JB)'
	},
	'sac/pnl-segment-dsp': {
		file: '6. PnL Mining/Story Builder Spec - PnL_JML.xlsx',
		sheet: 'Cost Structure Table',
		title: 'PnL Port Dua Samudera Perkasa (DSP)'
	},
	'sac/pnl-segment-jml': {
		file: '6. PnL Mining/Story Builder Spec - PnL_JML.xlsx',
		sheet: 'Cost Structure Table (RPMT)',
		title: 'PnL Marine Lines (JML)'
	},
	'sac/pnl-trip-jmt': {
		file: '7. Pnl Marine/Story Builder Spec - PnL_STM_Unfinished.xlsx',
		sheet: 'Cost Structure',
		title: 'PnL Voyage Jhonlin Marine Trans (JMT)'
	},
	'sac/pnl-trip-stm': {
		file: '7. Pnl Marine/Story Builder Spec - PnL_STM_Unfinished.xlsx',
		sheet: 'Cost Structure Table',
		title: 'PnL Voyage Samudera Tiga Mandiri (STM)'
	},
	'sac/pm-mining-fleet': {
		file: '8. PM Mining/Story Builder Spec - Plant Maintenance Mining.xlsx',
		sheet: 'Equipment Status',
		title: 'Plant Maintenance Heavy Equipment Fleet'
	},
	'sac/pm-mining-jml-page1': {
		file: '8. PM Mining/Story Builder Spec - Plant Maintenance JML.xlsx',
		sheet: 'Equipment Status',
		title: 'JML Individual Equipment Health & HM'
	},
	'sac/pm-marine-fleet': {
		file: '9. PM Marine/Story Builder Spec - Plant Maintenance Marine.xlsx',
		sheet: 'Equipment Status',
		title: 'Plant Maintenance Marine Fleet'
	}
};

const sourcePath = fs.existsSync(LIB_DOCS_PATH) ? LIB_DOCS_PATH : DOCS_PATH;
const docs = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

let matchCount = 0;
let totalEmbeddedImages = 0;

for (const doc of docs) {
	const cfg = BUILDER_MAPPINGS[doc.slug];
	if (!cfg) continue;

	const fullExcelPath = path.join(BASE_DIR, cfg.file);
	const { headers, rows } = extractSheetRows(fullExcelPath, cfg.sheet);

	if (rows.length === 0) {
		console.warn(`No rows parsed for ${doc.slug} from ${cfg.sheet}`);
		continue;
	}

	const sheetImgs = (manifest[cfg.file] && manifest[cfg.file][cfg.sheet]) || [];

	let bMd = `# Builder: ${cfg.title}\n\n`;

	bMd += `## Ringkasan Konfigurasi Teknis\n\n`;
	bMd += `| Parameter Teknis | Nilai Konfigurasi |\n`;
	bMd += `|---|---|\n`;
	bMd += `| **File Sumber** | \`${path.basename(cfg.file)}\` (Sheet: \`${cfg.sheet}\`) |\n`;
	bMd += `| **Jumlah Widget Terdaftar** | **${rows.length} Komponen Widget** |\n`;
	if (sheetImgs.length > 0) {
		bMd += `| **Tangkapan Layar Widget** | **${sheetImgs.length} Gambar dari Excel** |\n`;
	}
	if (doc.sacUrl) {
		bMd += `| **Tautan Story SAC Production** | [Buka Langsung di SAC](${doc.sacUrl}) |\n`;
	}
	bMd += `\n---\n\n`;

	rows.forEach((rObj, idx) => {
		const row = rObj.data;
		const rowIndex = rObj.rowIndex;
		const matchedImg = sheetImgs.find((img) => img.row === rowIndex);
		if (matchedImg) totalEmbeddedImages++;
		bMd += formatRowToMarkdown(rObj, headers, idx, sheetImgs);
	});

	doc.builderContent = bMd;
	matchCount++;
}

fs.writeFileSync(DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
fs.writeFileSync(LIB_DOCS_PATH, JSON.stringify(docs, null, '\t') + '\n', 'utf8');
if (fs.existsSync(INDEX_PATH)) {
	fs.writeFileSync(INDEX_PATH, JSON.stringify({ documents: docs }, null, '\t') + '\n', 'utf8');
}

console.log(`Successfully generated and attached builderContent with ${totalEmbeddedImages} embedded images to ${matchCount} SAC documents.`);
