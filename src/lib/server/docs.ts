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
	builderContent?: string;
	tags?: string[];
	sacUrl?: string;
	updatedAt?: string;
}

let docsCache: { mtimeMs: number; data: DocumentItem[] } | null = null;
let appsCache: { mtimeMs: number; data: any[] } | null = null;
let foldersCache: { mtimeMs: number; data: FolderItem[] } | null = null;
let dataVersion = 1;

export function getDataVersion(): number {
	return dataVersion;
}

function atomicWriteJson(targetPath: string, payload: unknown) {
	const content = JSON.stringify(payload, null, 2);
	const tmpPath = `${targetPath}.tmp`;
	try {
		fs.writeFileSync(tmpPath, content, 'utf8');
		fs.renameSync(tmpPath, targetPath);
	} catch {
		fs.writeFileSync(targetPath, content, 'utf8');
		try {
			if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
		} catch {}
	}
}

export function loadDocuments(): DocumentItem[] {
	try {
		const targetFile = fs.existsSync(DOCS_FILE)
			? DOCS_FILE
			: fs.existsSync(ROOT_DOCS_FILE)
				? ROOT_DOCS_FILE
				: null;
		if (!targetFile) return [];

		const stat = fs.statSync(targetFile);
		if (docsCache && docsCache.mtimeMs === stat.mtimeMs) {
			return docsCache.data.map((d) => ({ ...d }));
		}

		const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as DocumentItem[];
		docsCache = { mtimeMs: stat.mtimeMs, data: parsed };
		dataVersion++;
		return parsed.map((d) => ({ ...d }));
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
		const targetFile = fs.existsSync(APPS_FILE)
			? APPS_FILE
			: fs.existsSync(ROOT_APPS_FILE)
				? ROOT_APPS_FILE
				: null;
		if (!targetFile) return [];

		const stat = fs.statSync(targetFile);
		if (appsCache && appsCache.mtimeMs === stat.mtimeMs) {
			return appsCache.data.map((a) => ({ ...a }));
		}

		const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
		const programs = data.programs || [];
		appsCache = { mtimeMs: stat.mtimeMs, data: programs };
		dataVersion++;
		return programs.map((a: any) => ({ ...a }));
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
	atomicWriteJson(APPS_FILE, payload);
	appsCache = null;
	dataVersion++;

	if (fs.existsSync(path.dirname(ROOT_APPS_FILE))) {
		try {
			atomicWriteJson(ROOT_APPS_FILE, payload);
		} catch (_) {}
	}
	return payload;
}

export function loadFolders(): FolderItem[] {
	try {
		const targetFile = fs.existsSync(FOLDERS_FILE)
			? FOLDERS_FILE
			: fs.existsSync(ROOT_FOLDERS_FILE)
				? ROOT_FOLDERS_FILE
				: null;
		if (!targetFile) return [];

		const stat = fs.statSync(targetFile);
		if (foldersCache && foldersCache.mtimeMs === stat.mtimeMs) {
			return foldersCache.data.map((f) => ({ ...f }));
		}

		const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as FolderItem[];
		foldersCache = { mtimeMs: stat.mtimeMs, data: parsed };
		return parsed.map((f) => ({ ...f }));
	} catch (e: any) {
		console.error('Error reading folders database:', e?.message);
	}
	return [];
}

export function saveFolders(folders: FolderItem[]) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	atomicWriteJson(FOLDERS_FILE, folders);
	foldersCache = null;
	dataVersion++;

	if (fs.existsSync(path.dirname(ROOT_FOLDERS_FILE))) {
		try {
			atomicWriteJson(ROOT_FOLDERS_FILE, folders);
		} catch (_) {}
	}

	try {
		const docs = loadDocuments();
		const tree = buildDocTree(docs);
		atomicWriteJson(INDEX_FILE, tree);
	} catch (_) {}
}

export function saveDocuments(docs: DocumentItem[]) {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	atomicWriteJson(DOCS_FILE, docs);
	docsCache = null;
	dataVersion++;

	// Also sync to root data folder if it exists
	if (fs.existsSync(path.dirname(ROOT_DOCS_FILE))) {
		try {
			atomicWriteJson(ROOT_DOCS_FILE, docs);
		} catch (e) {}
	}

	// Update docsIndex.json
	try {
		const tree = buildDocTree(docs);
		atomicWriteJson(INDEX_FILE, tree);
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
