import fs from 'node:fs';
import path from 'node:path';
import type { DocumentItem } from './docs';

const DATA_USER_DIR = path.resolve(process.cwd(), 'src/lib/data/user_docs');
const ROOT_USER_DIR = path.resolve(process.cwd(), 'data/user_docs');

export interface UserFolderItem {
	category: string;
	subcategory?: string;
}

export interface UserDocFile {
	userName: string;
	folders: UserFolderItem[];
	documents: DocumentItem[];
}

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

export function sanitizeUserName(name: string): string {
	const clean = (name || 'user')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return clean || 'user';
}

function getUserFilePath(userName: string): string {
	ensureDir(DATA_USER_DIR);
	const slug = sanitizeUserName(userName);
	return path.join(DATA_USER_DIR, `${slug}.json`);
}

function getRootUserFilePath(userName: string): string {
	ensureDir(ROOT_USER_DIR);
	const slug = sanitizeUserName(userName);
	return path.join(ROOT_USER_DIR, `${slug}.json`);
}

function atomicWrite(targetPath: string, payload: unknown) {
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

function createInitialUserDocs(userName: string): UserDocFile {
	const userSlug = sanitizeUserName(userName);
	const now = new Date().toISOString();

	return {
		userName: userName.trim(),
		folders: [
			{ category: 'Catatan Harian', subcategory: 'Harian' },
			{ category: 'Dokumentasi Modul', subcategory: 'Draft' },
			{ category: 'Referensi & Panduan' }
		],
		documents: [
			{
				id: `${userSlug}/catatan-harian/selamat-datang`,
				slug: `${userSlug}/catatan-harian/selamat-datang`,
				section: 'PERSONAL',
				category: 'Catatan Harian',
				subcategory: 'Harian',
				title: `Selamat Datang di Ruang Catatan ${userName.trim()}`,
				description: `Ruang kerja dan dokumentasi pribadi untuk ${userName.trim()}`,
				snippet: `Ruang kerja dan dokumentasi pribadi untuk ${userName.trim()}`,
				content: `# Ruang Kerja & Catatan Pribadi: ${userName.trim()}\n\nSelamat datang di portal dokumentasi pribadi Anda! Halaman ini adalah area kerja khusus untuk Anda menyusun, menyimpan, dan mengelola dokumen teknis, catatan kerja, dan draft yang **hanya dapat diakses oleh Anda**.\n\n---\n\n### 🚀 Fitur yang Tersedia:\n\n1. **Kategori & Folder Mandiri**\n   - Tambahkan folder/kategori baru sesuai kebutuhan pekerjaan harian Anda.\n   - Setiap dokumen dapat dikelompokkan ke subkategori.\n\n2. **Editor Markdown Fleksibel**\n   - Tulis catatan dengan format heading, tabel, daftar checklist, dan blok kode.\n   - Mendukung mode **Split View** (tulis dan pratinjau langsung di sebelah kanan) serta **Full Edit**.\n\n3. **Dukungan Screenshot & Gambar**\n   - Tempelkan screenshot langsung dari clipboard menggunakan shortcut keyboard \`Ctrl+V\`.\n   - Atau seret gambar (*drag & drop*) langsung ke dalam editor catatan.\n\n4. **AI Copilot Terintegrasi**\n   - Gunakan tombol AI di pojok kanan atas untuk merangkum (*summarize*) atau memperbaiki format catatan Anda.\n\n---\n\n### 📝 Contoh Checklist Tugas Harian:\n- [x] Sinkronisasi session Helpdesk dengan Portal Dokumentasi\n- [ ] Menulis rangkuman analisa modul hari ini\n- [ ] Mencatat panduan pemeliharaan sistem internal\n\n*Catatan ini otomatis disimpan secara aman di storage pribadi Anda.*`,
				tags: ['Pribadi', 'Catatan', 'Welcome'],
				updatedAt: now
			}
		]
	};
}

export function getUserDocStorage(userName: string): UserDocFile {
	const userPath = getUserFilePath(userName);
	const rootPath = getRootUserFilePath(userName);

	const targetPath = fs.existsSync(userPath)
		? userPath
		: fs.existsSync(rootPath)
			? rootPath
			: null;

	if (targetPath) {
		try {
			const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as UserDocFile;
			if (parsed && Array.isArray(parsed.documents)) {
				return parsed;
			}
		} catch (err: any) {
			console.error(`Error reading user doc file for ${userName}:`, err?.message);
		}
	}

	// Initialize default user document if none exists
	const initialData = createInitialUserDocs(userName);
	saveUserDocStorage(userName, initialData);
	return initialData;
}

export function saveUserDocStorage(userName: string, data: UserDocFile) {
	const userPath = getUserFilePath(userName);
	const rootPath = getRootUserFilePath(userName);

	atomicWrite(userPath, data);
	try {
		atomicWrite(rootPath, data);
	} catch {}
}

export function buildUserDocTree(documents: DocumentItem[], folders: UserFolderItem[] = []) {
	const folderMap = new Map<string, { title: string; nodes: any[]; subfolders: Set<string> }>();

	const ensureFolder = (cat: string, subcat?: string) => {
		const cleanCat = (cat || 'Catatan Pribadi').trim();
		if (!folderMap.has(cleanCat)) {
			folderMap.set(cleanCat, {
				title: cleanCat,
				nodes: [],
				subfolders: new Set()
			});
		}
		if (subcat && subcat.trim()) {
			folderMap.get(cleanCat)!.subfolders.add(subcat.trim());
		}
	};

	// 1. Register predefined folders
	for (const f of folders) {
		ensureFolder(f.category, f.subcategory);
	}

	// 2. Register folders from existing documents
	for (const doc of documents) {
		ensureFolder(doc.category, doc.subcategory);
		const folder = folderMap.get((doc.category || 'Catatan Pribadi').trim())!;
		folder.nodes.push({
			id: doc.id,
			slug: doc.slug,
			title: doc.title,
			description: doc.description || doc.snippet,
			category: doc.category,
			subcategory: doc.subcategory,
			tags: doc.tags || [],
			updatedAt: doc.updatedAt
		});
	}

	// 3. Build tree nodes
	const tree: any[] = [];
	for (const [catName, meta] of folderMap.entries()) {
		const subcatArray = Array.from(meta.subfolders);
		const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

		if (subcatArray.length > 0) {
			const subcatNodes = subcatArray.map((subcat) => {
				const matchingDocs = meta.nodes.filter((n) => n.subcategory === subcat);
				const subcatSlug = subcat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
				return {
					id: `subfolder-${catSlug}-${subcatSlug}`,
					title: subcat,
					isFolder: true,
					isSubfolder: true,
					category: catName,
					subcategory: subcat,
					count: matchingDocs.length,
					nodes: matchingDocs
				};
			});

			const rootDocs = meta.nodes.filter((n) => !n.subcategory);

			tree.push({
				id: `folder-${catSlug}`,
				title: catName,
				isFolder: true,
				count: meta.nodes.length,
				nodes: [...subcatNodes, ...rootDocs]
			});
		} else {
			tree.push({
				id: `folder-${catSlug}`,
				title: catName,
				isFolder: true,
				count: meta.nodes.length,
				nodes: meta.nodes
			});
		}
	}

	return tree;
}

export function getUserDoc(userName: string, slugOrId: string): DocumentItem | null {
	const storage = getUserDocStorage(userName);
	const normalized = (slugOrId || '').toLowerCase().trim();

	const found = storage.documents.find((d) => {
		const docSlug = (d.slug || '').toLowerCase();
		const docId = (d.id || '').toLowerCase();
		return docSlug === normalized || docId === normalized || docSlug.endsWith(`/${normalized}`);
	});

	return found || null;
}

export function saveUserDoc(userName: string, docPayload: Partial<DocumentItem>): DocumentItem {
	const storage = getUserDocStorage(userName);
	const userSlug = sanitizeUserName(userName);
	const now = new Date().toISOString();

	const title = (docPayload.title || 'Catatan Baru').trim();
	const category = (docPayload.category || 'Catatan Harian').trim();
	const subcategory = docPayload.subcategory ? String(docPayload.subcategory).trim() : undefined;
	const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const catSlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

	const targetSlug = docPayload.slug || `${userSlug}/${catSlug}/${titleSlug}`;
	const docIndex = storage.documents.findIndex(
		(d) => d.id === docPayload.id || d.slug === docPayload.slug || d.slug === targetSlug
	);

	const cleanDesc = (docPayload.description || docPayload.snippet || title).trim();

	const updatedItem: DocumentItem = {
		id: docPayload.id || targetSlug,
		slug: targetSlug,
		section: 'PERSONAL',
		category,
		subcategory,
		title,
		description: cleanDesc,
		snippet: cleanDesc,
		content: (docPayload.content || '').trim(),
		tags: Array.isArray(docPayload.tags) && docPayload.tags.length > 0 ? docPayload.tags : ['Pribadi', category],
		updatedAt: now
	};

	if (docIndex >= 0) {
		storage.documents[docIndex] = updatedItem;
	} else {
		storage.documents.unshift(updatedItem);
	}

	// Ensure folder exists
	const hasFolder = storage.folders.some(
		(f) => f.category === category && f.subcategory === subcategory
	);
	if (!hasFolder) {
		storage.folders.push({ category, subcategory });
	}

	saveUserDocStorage(userName, storage);
	return updatedItem;
}

export function deleteUserDoc(userName: string, slugOrId: string): boolean {
	const storage = getUserDocStorage(userName);
	const normalized = (slugOrId || '').toLowerCase().trim();

	const initialLength = storage.documents.length;
	storage.documents = storage.documents.filter((d) => {
		const docSlug = (d.slug || '').toLowerCase();
		const docId = (d.id || '').toLowerCase();
		return docSlug !== normalized && docId !== normalized && !docSlug.endsWith(`/${normalized}`);
	});

	if (storage.documents.length !== initialLength) {
		saveUserDocStorage(userName, storage);
		return true;
	}
	return false;
}

export function addUserFolder(userName: string, category: string, subcategory?: string): boolean {
	const storage = getUserDocStorage(userName);
	const cleanCat = (category || '').trim();
	const cleanSub = subcategory ? subcategory.trim() : undefined;

	if (!cleanCat) return false;

	const exists = storage.folders.some(
		(f) => f.category === cleanCat && f.subcategory === cleanSub
	);

	if (!exists) {
		storage.folders.push({ category: cleanCat, subcategory: cleanSub });
		saveUserDocStorage(userName, storage);
		return true;
	}
	return false;
}

export function deleteUserFolder(userName: string, category: string, subcategory?: string): boolean {
	const storage = getUserDocStorage(userName);
	const cleanCat = (category || '').trim();
	const cleanSub = subcategory ? subcategory.trim() : undefined;

	if (!cleanCat) return false;

	storage.folders = storage.folders.filter(
		(f) => !(f.category === cleanCat && (cleanSub ? f.subcategory === cleanSub : true))
	);

	storage.documents = storage.documents.filter((d) => {
		if (d.category !== cleanCat) return true;
		if (cleanSub) return d.subcategory !== cleanSub;
		return false;
	});

	saveUserDocStorage(userName, storage);
	return true;
}

export function moveUserDoc(
	userName: string,
	slugOrId: string,
	newCategory: string,
	newSubcategory?: string
): { success: boolean; doc?: DocumentItem; error?: string } {
	const storage = getUserDocStorage(userName);
	const normalized = (slugOrId || '').toLowerCase().trim();

	const doc = storage.documents.find((d) => {
		const docSlug = (d.slug || '').toLowerCase();
		const docId = (d.id || '').toLowerCase();
		return docSlug === normalized || docId === normalized || docSlug.endsWith(`/${normalized}`);
	});

	if (!doc) {
		return { success: false, error: 'Dokumen tidak ditemukan' };
	}

	const cleanCat = (newCategory || 'Catatan Pribadi').trim();
	const cleanSub = newSubcategory && newSubcategory.trim() ? newSubcategory.trim() : undefined;

	doc.category = cleanCat;
	doc.subcategory = cleanSub;
	doc.updatedAt = new Date().toISOString();

	// Ensure destination folder exists in storage.folders
	const hasFolder = storage.folders.some(
		(f) => f.category === cleanCat && f.subcategory === cleanSub
	);
	if (!hasFolder) {
		storage.folders.push({ category: cleanCat, subcategory: cleanSub });
	}

	saveUserDocStorage(userName, storage);
	return { success: true, doc };
}

