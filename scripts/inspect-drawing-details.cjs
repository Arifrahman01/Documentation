const fs = require('fs');

const xml = fs.readFileSync('temp-excel-inspect/xl/drawings/drawing1.xml', 'utf8');
const rels = fs.readFileSync('temp-excel-inspect/xl/drawings/_rels/drawing1.xml.rels', 'utf8');

const relMap = {};
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relMap[m[1]] = m[2];
}

console.log('Images in drawing1 (Financial Performance):');
for (const m of xml.matchAll(/<xdr:twoCellAnchor[^>]*>([\s\S]*?)<\/xdr:twoCellAnchor>/g)) {
  const block = m[1];
  const colMatch = block.match(/<xdr:col>(\d+)<\/xdr:col>/);
  const rowMatch = block.match(/<xdr:row>(\d+)<\/xdr:row>/);
  const rIdMatch = block.match(/r:embed="([^"]+)"/);
  const nameMatch = block.match(/name="([^"]+)"/);
  console.log({
    col: colMatch ? colMatch[1] : null,
    row: rowMatch ? rowMatch[1] : null,
    rId: rIdMatch ? rIdMatch[1] : null,
    target: rIdMatch ? relMap[rIdMatch[1]] : null,
    name: nameMatch ? nameMatch[1] : null
  });
}
