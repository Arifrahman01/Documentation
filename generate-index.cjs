const fs = require('fs');
const path = require('path');

const DOCS_FILE = path.join(__dirname, 'data', 'documents.json');
const OUTPUT_LIB = path.join(__dirname, 'src', 'lib', 'data', 'docsIndex.json');
const OUTPUT_DOCS = path.join(__dirname, 'src', 'lib', 'data', 'documents.json');

function inferSection(doc) {
  if (doc.section && ['SAP', 'SAC', 'WEB'].includes(doc.section.toUpperCase())) {
    return doc.section.toUpperCase();
  }
  const slug = (doc.slug || doc.id || '').toLowerCase();
  if (slug.startsWith('sap/') || slug.includes('sap') || slug.includes('abap') || slug.includes('bapi') || slug.includes('odata')) {
    return 'SAP';
  }
  if (slug.startsWith('sac/') || slug.includes('sac') || slug.includes('analytic') || slug.includes('story') || slug.includes('stories')) {
    return 'SAC';
  }
  return 'WEB';
}

function generateDocsIndex() {
  if (!fs.existsSync(DOCS_FILE)) {
    console.error(`Documents database not found: ${DOCS_FILE}`);
    return;
  }

  const raw = fs.readFileSync(DOCS_FILE, 'utf8');
  const articles = JSON.parse(raw);

  // Normalise sections on articles
  for (const doc of articles) {
    doc.section = inferSection(doc);
  }

  const sections = ['SAP', 'SAC', 'WEB'];
  const sectionStats = { SAP: 0, SAC: 0, WEB: 0, all: articles.length };
  const stats = { all: articles.length };

  // Flat category map (for backward compatibility)
  const categoryMap = new Map();
  // Section-first tree: Section -> Categories -> Nodes
  const sectionMap = {
    SAP: new Map(),
    SAC: new Map(),
    WEB: new Map()
  };

  for (const doc of articles) {
    const sec = doc.section;
    const cat = doc.category || 'General';

    sectionStats[sec] = (sectionStats[sec] || 0) + 1;
    stats[cat] = (stats[cat] || 0) + 1;

    const node = {
      id: doc.id,
      title: doc.title,
      path: doc.slug || doc.id,
      slug: doc.slug || doc.id,
      section: sec,
      category: cat,
      icon: 'FileText'
    };

    // Flat map
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat).push(node);

    // Section map
    if (!sectionMap[sec]) sectionMap[sec] = new Map();
    if (!sectionMap[sec].has(cat)) {
      sectionMap[sec].set(cat, []);
    }
    sectionMap[sec].get(cat).push(node);
  }

  // Flat treeData
  const treeData = Array.from(categoryMap.entries()).map(([title, nodes]) => ({
    title,
    icon: 'Folder',
    section: nodes[0]?.section || 'WEB',
    nodes
  }));

  // Structured sectionTree
  const sectionTree = sections.map((sec) => {
    const catEntries = Array.from((sectionMap[sec] || new Map()).entries());
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

  const output = {
    sections,
    sectionStats,
    stats,
    sectionTree,
    treeData,
    articles: articles.map(a => ({
      id: a.id,
      title: a.title,
      path: a.slug || a.id,
      slug: a.slug || a.id,
      section: a.section,
      category: a.category,
      snippet: a.description || a.snippet || ''
    }))
  };

  fs.writeFileSync(OUTPUT_LIB, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_DOCS, JSON.stringify(articles, null, 2), 'utf8');
  console.log(`[generate-index] Successfully indexed ${articles.length} articles across sections: SAP (${sectionStats.SAP}), SAC (${sectionStats.SAC}), WEB (${sectionStats.WEB}).`);
}

generateDocsIndex();
