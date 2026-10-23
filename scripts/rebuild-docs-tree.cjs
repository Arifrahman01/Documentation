const fs = require('fs');
const path = require('path');

const DOCS_FILE = path.resolve(__dirname, '../src/lib/data/documents.json');
const ROOT_DOCS_FILE = path.resolve(__dirname, '../data/documents.json');
const INDEX_FILE = path.resolve(__dirname, '../src/lib/data/docsIndex.json');
const FOLDERS_FILE = path.resolve(__dirname, '../src/lib/data/folders.json');

const docs = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));

function inferSection(doc) {
  if (doc && doc.section && ['SAP', 'SAC', 'WEB'].includes(doc.section.toUpperCase())) {
    return doc.section.toUpperCase();
  }
  const slug = ((doc && (doc.slug || doc.id)) || '').toLowerCase();
  const title = ((doc && doc.title) || '').toLowerCase();
  const category = ((doc && doc.category) || '').toLowerCase();
  const combined = `${slug} ${title} ${category}`;
  if (
    combined.startsWith('sac/') ||
    combined.includes('sac') ||
    combined.includes('analytic') ||
    combined.includes('story') ||
    combined.includes('stories')
  ) {
    return 'SAC';
  }
  if (
    combined.startsWith('sap/') ||
    combined.includes('sap') ||
    combined.includes('abap') ||
    combined.includes('bapi') ||
    combined.includes('odata') ||
    combined.includes('fiori')
  ) {
    return 'SAP';
  }
  return 'WEB';
}

const sections = ['SAP', 'SAC', 'WEB'];
const sectionStats = { SAP: 0, SAC: 0, WEB: 0, all: docs.length };
const sectionMap = {
  SAP: new Map(),
  SAC: new Map(),
  WEB: new Map()
};
const folderMetaMap = new Map();

function ensureFolder(sec, cat, subcat) {
  const normalizedSec = ['SAP', 'SAC', 'WEB'].includes(sec.toUpperCase())
    ? sec.toUpperCase()
    : 'SAP';
  const cleanCat = (cat || 'General').trim();
  const key = `${normalizedSec}::${cleanCat}`;
  if (!folderMetaMap.has(key)) {
    folderMetaMap.set(key, {
      title: cleanCat,
      section: normalizedSec,
      nodes: [],
      subfolders: new Set()
    });
  }
  if (subcat && subcat.trim()) {
    folderMetaMap.get(key).subfolders.add(subcat.trim());
  }
  if (!sectionMap[normalizedSec]) sectionMap[normalizedSec] = new Map();
  if (!sectionMap[normalizedSec].has(cleanCat)) {
    sectionMap[normalizedSec].set(cleanCat, []);
  }
  return folderMetaMap.get(key);
}

for (const doc of docs) {
  const sec = inferSection(doc);
  doc.section = sec;
  let cat = doc.category || 'General';
  let subcat = (doc.subcategory || '').trim();

  if (!subcat && cat.includes('/')) {
    const parts = cat.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      cat = parts[0];
      subcat = parts.slice(1).join(' / ');
    }
  }

  sectionStats[sec] = (sectionStats[sec] || 0) + 1;

  const node = {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    path: doc.slug,
    section: sec,
    category: cat,
    subcategory: subcat || undefined,
    icon: 'FileText'
  };

  const folderEntry = ensureFolder(sec, cat, subcat);
  folderEntry.nodes.push(node);
  sectionMap[sec].get(cat).push(node);
}

const treeData = Array.from(folderMetaMap.values())
  .sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.title.localeCompare(b.title, undefined, { numeric: true });
  })
  .map((entry) => ({
    title: entry.title,
    section: entry.section,
    icon: 'Folder',
    subfolders: Array.from(entry.subfolders),
    nodes: entry.nodes
  }));

const sectionTree = sections.map((sec) => {
  const catEntries = Array.from((sectionMap[sec] || new Map()).entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  return {
    section: sec,
    title: sec,
    total: sectionStats[sec] || 0,
    categories: catEntries.map(([catTitle, nodes]) => ({
      title: catTitle,
      icon: 'Folder',
      nodes
    }))
  };
});

const indexPayload = {
  documents: docs,
  sections,
  sectionStats,
  sectionTree,
  treeData,
  total: docs.length
};

fs.writeFileSync(INDEX_FILE, JSON.stringify(indexPayload, null, 2), 'utf8');
console.log('Successfully rebuilt docsIndex.json with numeric-sorted categories.');
console.log('SAC Categories found:');
treeData.filter(t => t.section === 'SAC').forEach(t => {
  console.log(`  - ${t.title} (${t.nodes.length} docs)`);
});
