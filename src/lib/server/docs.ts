import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'src/lib/data');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');
const INDEX_FILE = path.join(DATA_DIR, 'docsIndex.json');

// Root fallback (if running from root or syncing)
const ROOT_DOCS_FILE = path.resolve(process.cwd(), 'data/documents.json');

export interface DocumentItem {
	id: string;
	slug: string;
	section?: string;
	category: string;
	title: string;
	description?: string;
	snippet?: string;
	content: string;
	tags?: string[];
	sacUrl?: string;
	updatedAt?: string;
}

export function loadDocuments(): DocumentItem[] {
	try {
		if (fs.existsSync(DOCS_FILE)) {
			return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
		}
		if (fs.existsSync(ROOT_DOCS_FILE)) {
			return JSON.parse(fs.readFileSync(ROOT_DOCS_FILE, 'utf8'));
		}
	} catch (e: any) {
		console.error('Error reading documents database:', e?.message);
	}
	return [];
}

export function inferSection(doc: Partial<DocumentItem>): string {
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

export function loadApps(): any[] {
	try {
		if (fs.existsSync(APPS_FILE)) {
			const data = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
			return data.programs || [];
		}
	} catch (e: any) {
		console.error('Error reading apps file:', e?.message);
	}
	return [];
}

export function saveDocuments(docs: DocumentItem[]) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2), 'utf8');

	// Also sync to root data folder if it exists
	if (fs.existsSync(path.dirname(ROOT_DOCS_FILE))) {
		try {
			fs.writeFileSync(ROOT_DOCS_FILE, JSON.stringify(docs, null, 2), 'utf8');
		} catch (e) {}
	}

	// Update docsIndex.json
	try {
		const tree = buildDocTree(docs);
		fs.writeFileSync(INDEX_FILE, JSON.stringify(tree, null, 2), 'utf8');
	} catch (e: any) {
		console.error('Error updating index file:', e?.message);
	}
}

export function buildDocTree(docs: DocumentItem[]) {
	const sections = ['SAP', 'SAC', 'WEB'];
	const sectionStats: Record<string, number> = { SAP: 0, SAC: 0, WEB: 0, all: docs.length };

	const sectionMap: Record<string, Map<string, any[]>> = {
		SAP: new Map(),
		SAC: new Map(),
		WEB: new Map()
	};
	const categoryMap = new Map<string, any[]>();

	for (const doc of docs) {
		const sec = inferSection(doc);
		doc.section = sec;
		const cat = doc.category || 'General';

		sectionStats[sec] = (sectionStats[sec] || 0) + 1;

		const node = {
			id: doc.id,
			slug: doc.slug,
			title: doc.title,
			path: doc.slug,
			section: sec,
			category: cat,
			icon: 'FileText'
		};

		if (!categoryMap.has(cat)) {
			categoryMap.set(cat, []);
		}
		categoryMap.get(cat)!.push(node);

		if (!sectionMap[sec]) sectionMap[sec] = new Map();
		if (!sectionMap[sec].has(cat)) {
			sectionMap[sec].set(cat, []);
		}
		sectionMap[sec].get(cat)!.push(node);
	}

	const treeData = Array.from(categoryMap.entries()).map(([title, nodes]) => ({
		title,
		section: nodes[0]?.section || 'WEB',
		icon: 'Folder',
		nodes
	}));

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

	return {
		documents: docs,
		sections,
		sectionStats,
		sectionTree,
		treeData,
		total: docs.length
	};
}
