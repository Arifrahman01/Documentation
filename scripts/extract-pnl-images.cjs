const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const pnlFile = 'D:/Jhonlin/SAP/SAC/Old/Modul/Profit and Lost/121225 Jhonlin_FSD_SACBI_R04_Profit_and_Loss v4.docx';
const pnlMarineFile = 'D:/Jhonlin/SAP/SAC/Final/Jhonlin_FSD_SACBI_R08_Profit_and_Loss_Marine_FSD_Latest.docx';
const targetDir = path.join(__dirname, '..', 'static', 'img', 'sac', 'fsd');

if (fs.existsSync(pnlFile)) {
	const tempDir = path.join(__dirname, '..', '.temp_fsd', 'pnl');
	fs.mkdirSync(tempDir, { recursive: true });
	cp.execSync(`tar -xf "${pnlFile}" -C "${tempDir}" word/media word/document.xml word/_rels/document.xml.rels`);

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
					const outFileName = `pnl-${imgIndex}${ext}`;
					const outPath = path.join(targetDir, outFileName);
					fs.copyFileSync(srcPath, outPath);
					console.log(`[PnL ${imgIndex}] ${outFileName} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) <- "${lastH}"`);
					imgIndex++;
				}
			}
		}
	}
}

if (fs.existsSync(pnlMarineFile)) {
	const tempDir = path.join(__dirname, '..', '.temp_fsd', 'pnl-marine');
	fs.mkdirSync(tempDir, { recursive: true });
	cp.execSync(`tar -xf "${pnlMarineFile}" -C "${tempDir}" word/media word/document.xml word/_rels/document.xml.rels`);

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
					const outFileName = `pnl-marine-${imgIndex}${ext}`;
					const outPath = path.join(targetDir, outFileName);
					fs.copyFileSync(srcPath, outPath);
					console.log(`[PnL Marine ${imgIndex}] ${outFileName} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) <- "${lastH}"`);
					imgIndex++;
				}
			}
		}
	}
}
