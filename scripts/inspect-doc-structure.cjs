const fs = require('fs');

const relsXml = fs.readFileSync('C:/Users/rif/AppData/Local/Temp/word/_rels/document.xml.rels', 'utf8');
const docXml = fs.readFileSync('C:/Users/rif/AppData/Local/Temp/word/document.xml', 'utf8');

const rIdToTarget = {};
const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
let m;
while ((m = relRegex.exec(relsXml)) !== null) {
	rIdToTarget[m[1]] = m[2];
}

// Find all paragraphs with text and any drawing inside
const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
let pMatch;
let lastHeading = 'Top';

while ((pMatch = pRegex.exec(docXml)) !== null) {
	const p = pMatch[1];
	const text = p.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
	if (text.length > 2 && text.length < 80) {
		lastHeading = text;
	}

	const blipMatches = [...p.matchAll(/r:(?:embed|id)="([^"]+)"/g)];
	for (const bm of blipMatches) {
		const target = rIdToTarget[bm[1]];
		if (target && target.includes('media/')) {
			console.log(`[${target}] under heading: "${lastHeading}"`);
		}
	}
}
