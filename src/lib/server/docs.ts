import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'src/lib/data');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');
const INDEX_FILE = path.join(DATA_DIR, 'docsIndex.json');

// Root fallback (if running from root or syncing)
const ROOT_DOCS_FILE = path.resolve(process.cwd(), 'data/documents.json');
const ROOT_FOLDERS_FILE = path.resolve(process.cwd(), 'data/folders.json');
const ROOT_APPS_FILE = path.resolve(process.cwd(), 'data/apps.json');

export interface FolderItem {
	section: string;
	category: string;
	subcategory?: string;
}

export interface DocumentItem {
	id: string;
	slug: string;
	section?: string;
	category: string;
	subcategory?: string;
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
		if (fs.existsSync(ROOT_APPS_FILE)) {
			const data = JSON.parse(fs.readFileSync(ROOT_APPS_FILE, 'utf8'));
			return data.programs || [];
		}
	} catch (e: any) {
		console.error('Error reading apps file:', e?.message);
	}
	return [];
}

export function saveApps(programs: any[]) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	const stats = {
		total: programs.length,
		production: programs.filter((p) => p.status === 'Production').length,
		development: programs.filter((p) => p.status === 'Development').length,
		active: programs.filter((p) => p.status === 'Active' || p.status === 'Production').length
	};
	const payload = { stats, programs };
	fs.writeFileSync(APPS_FILE, JSON.stringify(payload, null, 2), 'utf8');

	if (fs.existsSync(path.dirname(ROOT_APPS_FILE))) {
		try {
			fs.writeFileSync(ROOT_APPS_FILE, JSON.stringify(payload, null, 2), 'utf8');
		} catch (_) {}
	}
	return payload;
}

export function loadFolders(): FolderItem[] {
	try {
		if (fs.existsSync(FOLDERS_FILE)) {
			return JSON.parse(fs.readFileSync(FOLDERS_FILE, 'utf8'));
		}
		if (fs.existsSync(ROOT_FOLDERS_FILE)) {
			return JSON.parse(fs.readFileSync(ROOT_FOLDERS_FILE, 'utf8'));
		}
	} catch (e: any) {
		console.error('Error reading folders database:', e?.message);
	}
	return [];
}

export function saveFolders(folders: FolderItem[]) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	fs.writeFileSync(FOLDERS_FILE, JSON.stringify(folders, null, 2), 'utf8');

	if (fs.existsSync(path.dirname(ROOT_FOLDERS_FILE))) {
		try {
			fs.writeFileSync(ROOT_FOLDERS_FILE, JSON.stringify(folders, null, 2), 'utf8');
		} catch (_) {}
	}

	try {
		const docs = loadDocuments();
		const tree = buildDocTree(docs);
		fs.writeFileSync(INDEX_FILE, JSON.stringify(tree, null, 2), 'utf8');
	} catch (_) {}
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
	// Keyed by `${sec}::${cat}` so folders in different sections stay cleanly separated
	const folderMetaMap = new Map<
		string,
		{ title: string; section: string; nodes: any[]; subfolders: Set<string> }
	>();

	const ensureFolder = (sec: string, cat: string, subcat?: string) => {
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
			folderMetaMap.get(key)!.subfolders.add(subcat.trim());
		}
		if (!sectionMap[normalizedSec]) sectionMap[normalizedSec] = new Map();
		if (!sectionMap[normalizedSec].has(cleanCat)) {
			sectionMap[normalizedSec].set(cleanCat, []);
		}
		return folderMetaMap.get(key)!;
	};

	// 1. Register explicitly created folders (including empty folders/sub-folders)
	const explicitFolders = loadFolders();
	for (const f of explicitFolders) {
		ensureFolder(f.section || 'SAP', f.category, f.subcategory);
	}

	// 2. Register documents into folders
	for (const doc of docs) {
		const sec = inferSection(doc);
		doc.section = sec;
		let cat = doc.category || 'General';
		let subcat = (doc.subcategory || '').trim();

		// Support "Kategori / Sub-Kategori" notation automatically
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
		sectionMap[sec].get(cat)!.push(node);
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

	return {
		documents: docs,
		sections,
		sectionStats,
		sectionTree,
		treeData,
		total: docs.length
	};
}
