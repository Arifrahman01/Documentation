const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'frontend', 'static', 'docs');
const categories = fs.readdirSync(docsDir).filter(f => fs.statSync(path.join(docsDir, f)).isDirectory());

const documents = [];

for (const cat of categories) {
  const catPath = path.join(docsDir, cat);
  const files = fs.readdirSync(catPath).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(catPath, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const slug = cat + '/' + file.replace('.md', '');
    
    let title = file.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let category = cat.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let content = raw;

    // Check frontmatter
    const fm = raw.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (fm) {
      content = raw.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '');
      fm[1].split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts[0].trim().toLowerCase() === 'title') title = parts.slice(1).join(':').trim().replace(/^['"](.*)['"]$/, '$1');
        if (parts[0].trim().toLowerCase() === 'category') category = parts.slice(1).join(':').trim().replace(/^['"](.*)['"]$/, '$1');
      });
    }

    const firstH1 = content.match(/^#\s+(.+)$/m);
    if (firstH1 && (!fm || title === file.replace('.md', ''))) {
      title = firstH1[1].trim();
    }

    const snippet = content
      .replace(/#+\s+/g, '')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 180);

    documents.push({
      id: slug,
      slug: slug,
      title: title,
      category: category,
      description: snippet,
      snippet: snippet,
      content: content.trim(),
      tags: [category, 'Guide'],
      updatedAt: new Date().toISOString()
    });
  }
}

const dataDir = path.join(__dirname, '..', 'data');
const libDataDir = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'data');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(libDataDir)) fs.mkdirSync(libDataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'documents.json'), JSON.stringify(documents, null, 2), 'utf8');
fs.writeFileSync(path.join(libDataDir, 'documents.json'), JSON.stringify(documents, null, 2), 'utf8');
console.log(`Successfully migrated ${documents.length} documentation articles to JSON database.`);
