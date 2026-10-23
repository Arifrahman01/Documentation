const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';
const TARGET_DIR = path.join(__dirname, '..', 'static', 'img', 'sac', 'fsd');
fs.mkdirSync(TARGET_DIR, { recursive: true });

const folders = fs.readdirSync(BASE_DIR).filter((f) => {
	return fs.statSync(path.join(BASE_DIR, f)).isDirectory();
});

console.log('Found folders:', folders);

const extractedSummary = {};

for (const folder of folders) {
	const folderPath = path.join(BASE_DIR, folder);
	const files = fs.readdirSync(folderPath);
	const docFile = files.find((f) => f.endsWith('.docx') || f.endsWith('.docm'));
	if (!docFile) {
		console.log(`No docx/docm found in ${folder}`);
		continue;
	}

	const fullDocPath = path.join(folderPath, docFile);
	const moduleKey = folder
		.toLowerCase()
		.replace(/^[0-9.]+\s*/, '')
		.replace(/\s+/g, '-');
	const tempDir = path.join(__dirname, '..', '.temp_fsd', moduleKey);
	fs.mkdirSync(tempDir, { recursive: true });

	console.log(`\n========================================`);
	console.log(`Processing [${folder}] -> ${docFile}`);
	console.log(`========================================`);

	try {
		cp.execSync(
			`tar -xf "${fullDocPath}" -C "${tempDir}" word/media word/document.xml word/_rels/document.xml.rels`
		);
	} catch (e) {
		console.error(`Error untarring ${fullDocPath}:`, e.message);
		continue;
	}

	const relsPath = path.join(tempDir, 'word', '_rels', 'document.xml.rels');
	const docXmlPath = path.join(tempDir, 'word', 'document.xml');

	if (!fs.existsSync(relsPath) || !fs.existsSync(docXmlPath)) {
		console.log(`Missing xml/rels in ${tempDir}`);
		continue;
	}

	const relsXml = fs.readFileSync(relsPath, 'utf8');
	const docXml = fs.readFileSync(docXmlPath, 'utf8');

	const rIdToTarget = {};
	const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
	let m;
	while ((m = relRegex.exec(relsXml)) !== null) {
		rIdToTarget[m[1]] = m[2];
	}

	const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
	let pMatch;
	let lastHeading = 'Top';
	let imgIndex = 1;
	extractedSummary[moduleKey] = [];

	while ((pMatch = pRegex.exec(docXml)) !== null) {
		const p = pMatch[1];
		const text = p
			.replace(/<[^>]+>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		if (text.length > 2 && text.length < 80) {
			lastHeading = text;
		}

		const blipMatches = [...p.matchAll(/r:(?:embed|id)="([^"]+)"/g)];
		for (const bm of blipMatches) {
			const target = rIdToTarget[bm[1]];
			if (target && target.includes('media/')) {
				const srcPath = path.join(tempDir, 'word', target);
				if (fs.existsSync(srcPath)) {
					const ext = path.extname(target);
					const outFileName = `${moduleKey}-${imgIndex}${ext}`;
					const outPath = path.join(TARGET_DIR, outFileName);
					fs.copyFileSync(srcPath, outPath);

					const item = {
						index: imgIndex,
						fileName: outFileName,
						heading: lastHeading,
						sizeKB: (fs.statSync(outPath).size / 1024).toFixed(1)
					};
					extractedSummary[moduleKey].push(item);

					if (
						lastHeading.toLowerCase().includes('layout') ||
						imgIndex <= 5 ||
						item.sizeKB > 50
					) {
						console.log(`[${imgIndex}] ${outFileName} (${item.sizeKB} KB) <- "${lastHeading}"`);
					}
					imgIndex++;
				}
			}
		}
	}
	console.log(`Total extracted for ${moduleKey}: ${imgIndex - 1} images.`);
}

fs.writeFileSync(
	path.join(__dirname, '..', '.temp_fsd', 'extracted_summary.json'),
	JSON.stringify(extractedSummary, null, 2),
	'utf8'
);
console.log('\nAll 9 modules processed successfully!');
