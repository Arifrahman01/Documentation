const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const FSD_DOCS = [
	{
		module: 'finance',
		path: 'D:/Jhonlin/SAP/SAC/Document/1. Finance/Jhonlin_FSD_SACBI_R01_Finance_Latest.docm'
	},
	{
		module: 'marketing',
		path: 'D:/Jhonlin/SAP/SAC/Document/2. Marketing/Jhonlin_FSD_SACBI_R02_Marketing_Document_FSD_Latest.docx'
	},
	{
		module: 'op-mining',
		path: 'D:/Jhonlin/SAP/SAC/Document/3. Operation Mining/Jhonlin_FSD_SACBI_R05_Operation Mining_FSD_Latest.docx'
	},
	{
		module: 'op-marine',
		path: 'D:/Jhonlin/SAP/SAC/Document/4. Operation Marine/Jhonlin_FSD_SACBI_R06_Operation Marine_FSD_Latest.docx'
	}
];

const TARGET_DIR = path.join(__dirname, '..', 'static', 'img', 'sac', 'fsd');
fs.mkdirSync(TARGET_DIR, { recursive: true });

for (const doc of FSD_DOCS) {
	const tempDir = path.join(__dirname, '..', '.temp_fsd', doc.module);
	fs.mkdirSync(tempDir, { recursive: true });

	console.log(`\n=== Processing ${doc.module} from ${doc.path} ===`);
	cp.execSync(`tar -xf "${doc.path}" -C "${tempDir}" word/media word/document.xml word/_rels/document.xml.rels`);

	const relsXml = fs.readFileSync(path.join(tempDir, 'word', '_rels', 'document.xml.rels'), 'utf8');
	const docXml = fs.readFileSync(path.join(tempDir, 'word', 'document.xml'), 'utf8');

	const rIdToTarget = {};
	const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
	let m;
	while ((m = relRegex.exec(relsXml)) !== null) {
		rIdToTarget[m[1]] = m[2];
	}

	const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
	let pMatch;
	let lastH = 'Top';
	let imgIndex = 1;

	while ((pMatch = pRegex.exec(docXml)) !== null) {
		const p = pMatch[1];
		const text = p.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
		if (text.length > 2 && text.length < 90) {
			lastH = text;
		}

		const blipMatches = [...p.matchAll(/r:(?:embed|id)="([^"]+)"/g)];
		for (const bm of blipMatches) {
			const target = rIdToTarget[bm[1]];
			if (target && target.includes('media/')) {
				const srcPath = path.join(tempDir, 'word', target);
				if (fs.existsSync(srcPath)) {
					const ext = path.extname(target);
					const outFileName = `${doc.module}-${imgIndex}${ext}`;
					const outPath = path.join(TARGET_DIR, outFileName);
					fs.copyFileSync(srcPath, outPath);
					console.log(`[${imgIndex}] ${outFileName} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) <- "${lastH}"`);
					imgIndex++;
				}
			}
		}
	}
}

console.log('\nAll FSD images extracted to static/img/sac/fsd/');
