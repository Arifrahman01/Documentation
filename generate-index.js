const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'webapp', 'docs');
const OUTPUT_FILE = path.join(DOCS_DIR, 'docs-index.json');

const CATEGORY_ICONS = {
  'get-started': 'sap-icon://begin',
  'essentials': 'sap-icon://course-book',
  'developing-apps': 'sap-icon://developer-settings',
  'testing': 'sap-icon://lab',
  'sac': 'sap-icon://pie-chart',
  'sap': 'sap-icon://database',
  'apps': 'sap-icon://grid'
};

function formatTitle(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function cleanSnippet(content) {
  return content
    .replace(/^---[\s\S]*?---/, '')
    .replace(/#+\s+/g, '')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function parseMarkdownFile(filePath, categoryId) {
  const content = fs.readFileSync(filePath, 'utf8');
  let title = formatTitle(path.basename(filePath, '.md'));
  let category = formatTitle(categoryId);

  // Frontmatter check
  const fmMatch = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (fmMatch) {
    const lines = fmMatch[1].split('\n');
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim().replace(/^['"](.*)['"]$/, '$1');
        if (key === 'title') title = val;
        if (key === 'category') category = val;
      }
    });
  } else {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  const fileName = path.basename(filePath, '.md');
  const routePath = `${categoryId}/${fileName}`;

  return {
    id: routePath,
    title,
    path: routePath,
    category,
    snippet: cleanSnippet(content)
  };
}

function generateDocsIndex() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    return;
  }

  const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true });
  const treeData = [];
  const articles = [];
  const stats = { all: 0 };

  entries
    .filter(e => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(catDir => {
      const catPath = path.join(DOCS_DIR, catDir.name);
      const files = fs.readdirSync(catPath).filter(f => f.endsWith('.md'));

      if (files.length === 0) return;

      const catTitle = formatTitle(catDir.name);
      const catIcon = CATEGORY_ICONS[catDir.name] || 'sap-icon://folder';
      const nodes = [];

      files.sort().forEach(file => {
        const filePath = path.join(catPath, file);
        const meta = parseMarkdownFile(filePath, catDir.name);
        nodes.push({
          title: meta.title,
          path: meta.path,
          icon: 'sap-icon://document-text'
        });
        articles.push(meta);
      });

      stats[catDir.name] = nodes.length;
      stats.all += nodes.length;

      treeData.push({
        title: catTitle,
        icon: catIcon,
        nodes
      });
    });

  // Preserve existing virtual articles (such as Developing Apps & Testing placeholders) if not on disk yet
  const existingArticles = [
    {
      id: "developing-apps/component-configuration",
      title: "Component Configuration",
      path: "developing-apps/component-configuration",
      category: "Developing Apps",
      snippet: "Guide on manifest.json configuration, routing targets, models, and dependencies in SAPUI5."
    },
    {
      id: "developing-apps/security-concepts",
      title: "Security Concepts",
      path: "developing-apps/security-concepts",
      category: "Developing Apps",
      snippet: "Enterprise security guidelines: XSS protection, CSRF token handling, and secure data binding."
    },
    {
      id: "testing/unit-testing",
      title: "Unit Testing with QUnit",
      path: "testing/unit-testing",
      category: "Testing",
      snippet: "Setting up automated unit tests and integration tests using QUnit and OPA5 in SAPUI5."
    }
  ];

  // Merge virtual categories to tree if not present
  const hasDevApps = treeData.some(c => c.title.toLowerCase().includes("developing"));
  if (!hasDevApps) {
    treeData.push({
      title: "Developing Apps",
      icon: "sap-icon://developer-settings",
      nodes: [
        { title: "Component Configuration", path: "developing-apps/component-configuration", icon: "sap-icon://document-text" },
        { title: "Security Concepts", path: "developing-apps/security-concepts", icon: "sap-icon://document-text" }
      ]
    });
    existingArticles.slice(0, 2).forEach(a => {
      if (!articles.some(item => item.id === a.id)) articles.push(a);
    });
  }

  const hasTesting = treeData.some(c => c.title.toLowerCase().includes("testing"));
  if (!hasTesting) {
    treeData.push({
      title: "Testing",
      icon: "sap-icon://lab",
      nodes: [
        { title: "Unit Testing with QUnit", path: "testing/unit-testing", icon: "sap-icon://document-text" }
      ]
    });
    if (!articles.some(item => item.id === existingArticles[2].id)) {
      articles.push(existingArticles[2]);
    }
  }

  stats.all = articles.length;

  const output = {
    stats,
    treeData,
    articles
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[generate-index] Successfully indexed ${articles.length} articles across ${treeData.length} categories.`);
}

generateDocsIndex();
