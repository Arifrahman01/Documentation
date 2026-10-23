const fs = require('fs');
const path = require('path');

const CATEGORY_MAP = {
  'Overview & BI': '0. Overview & Arsitektur SAC',
  'Finance': '1. Finance',
  'Marketing': '2. Marketing',
  'Operation Mining': '3. Operation Mining',
  'Operation Marine': '4. Operation Marine',
  'Supply Chain': '5. Supply Chain',
  'PnL by Segment': '6. PnL Mining',
  'PnL by Trip': '7. PnL Marine',
  'PM Mining': '8. PM Mining',
  'PM Marine': '9. PM Marine'
};

function updateFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updatedCount = 0;

  for (const doc of docs) {
    if (doc.section === 'SAC' || (doc.slug && doc.slug.startsWith('sac/'))) {
      if (CATEGORY_MAP[doc.category]) {
        doc.category = CATEGORY_MAP[doc.category];
        updatedCount++;
      }
    }
  }

  // Sort docs so SAC modules appear in strict 0 -> 9 sequence
  const getOrderScore = (d) => {
    if (d.section === 'SAP') return 100;
    if (d.section === 'SAC') {
      const match = (d.category || '').match(/^(\d+)\./);
      const num = match ? parseInt(match[1], 10) : 50;
      return 200 + num;
    }
    return 300;
  };

  docs.sort((a, b) => {
    const scoreA = getOrderScore(a);
    const scoreB = getOrderScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (a.slug || '').localeCompare(b.slug || '');
  });

  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Updated ${updatedCount} SAC documents in ${filePath}`);
}

updateFile(path.resolve(__dirname, '../data/documents.json'));
updateFile(path.resolve(__dirname, '../src/lib/data/documents.json'));

// Also rebuild index
const docsTsPath = path.resolve(__dirname, '../src/lib/server/docs.ts');
console.log('Done aligning SAC categories.');
