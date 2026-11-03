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

let userNotesVersion = 1;

export function getUserNotesVersion(): number {
	return userNotesVersion;
}

export function saveUserDocStorage(userName: string, data: UserDocFile) {
	const userPath = getUserFilePath(userName);
	const rootPath = getRootUserFilePath(userName);

	atomicWrite(userPath, data);
	try {
		atomicWrite(rootPath, data);
	} catch {}
	userNotesVersion++;
}

export function loadAllUserNotes(): Array<DocumentItem & { ownerName?: string }> {
	const result: Array<DocumentItem & { ownerName?: string }> = [];
	const seenIds = new Set<string>();
	const dirs = [DATA_USER_DIR, ROOT_USER_DIR];

	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		try {
			const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
			for (const file of files) {
				try {
					const fullPath = path.join(dir, file);
					const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as UserDocFile;
					if (parsed && Array.isArray(parsed.documents)) {
						for (const doc of parsed.documents) {
							const key = doc.id || doc.slug;
							if (!key || seenIds.has(key)) continue;
							seenIds.add(key);
							result.push({
								...doc,
								section: 'NOTE',
								ownerName: parsed.userName || 'Pengguna'
							});
						}
					}
				} catch {}
			}
		} catch {}
	}

	return result;
}

export function normalizeSubcategoryPath(sub?: string): string | undefined {
	if (!sub) return undefined;
	const parts = String(sub)
		.split('/')
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts.join('/') : undefined;
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
		const normalizedSub = normalizeSubcategoryPath(subcat);
		if (normalizedSub) {
			const parts = normalizedSub.split('/');
			let acc = '';
			for (const part of parts) {
				acc = acc ? `${acc}/${part}` : part;
				folderMap.get(cleanCat)!.subfolders.add(acc);
			}
		}
	};

	// 1. Register predefined folders
	for (const f of folders) {
		ensureFolder(f.category, f.subcategory);
	}

	// 2. Register folders from existing documents
	for (const doc of documents) {
		const normSub = normalizeSubcategoryPath(doc.subcategory);
		ensureFolder(doc.category, normSub);
		const folder = folderMap.get((doc.category || 'Catatan Pribadi').trim())!;
		folder.nodes.push({
			id: doc.id,
			slug: doc.slug,
			title: doc.title,
			description: doc.description || doc.snippet,
			category: doc.category,
			subcategory: normSub,
			tags: doc.tags || [],
			updatedAt: doc.updatedAt
		});
	}

	// 3. Build multi-level recursive tree nodes (supports SAP -> Mining -> CS -> ...)
	const tree: any[] = [];
	for (const [catName, meta] of folderMap.entries()) {
		const subcatArray = Array.from(meta.subfolders).sort((a, b) => {
			const depthDiff = a.split('/').length - b.split('/').length;
			if (depthDiff !== 0) return depthDiff;
			return a.localeCompare(b, undefined, { numeric: true });
		});
		const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

		if (subcatArray.length > 0) {
			const subNodeMap = new Map<string, any>();
			const rootSubfolderNodes: any[] = [];

			for (const subPath of subcatArray) {
				const parts = subPath.split('/');
				const leafTitle = parts[parts.length - 1];
				const parentPath = parts.slice(0, -1).join('/');
				const matchingDocs = meta.nodes.filter(
					(n) => normalizeSubcategoryPath(n.subcategory) === subPath
				);
				const subcatSlug = subPath.toLowerCase().replace(/[^a-z0-9]+/g, '-');

				const nodeObj = {
					id: `subfolder-${catSlug}-${subcatSlug}`,
					title: leafTitle,
					isFolder: true,
					isSubfolder: true,
					category: catName,
					subcategory: subPath,
					parentSubcategory: parentPath || undefined,
					depth: parts.length,
					count: matchingDocs.length,
					_childFolders: [] as any[],
					_directDocs: matchingDocs,
					nodes: [] as any[]
				};

				subNodeMap.set(subPath, nodeObj);

				if (parentPath && subNodeMap.has(parentPath)) {
					subNodeMap.get(parentPath)!._childFolders.push(nodeObj);
				} else {
					rootSubfolderNodes.push(nodeObj);
				}
			}

			// Finalize nodes & counts from deepest level up to top level
			const reversed = [...subcatArray].reverse();
			for (const subPath of reversed) {
				const nodeObj = subNodeMap.get(subPath)!;
				nodeObj.nodes = [...nodeObj._childFolders, ...nodeObj._directDocs];
				nodeObj.count =
					nodeObj._directDocs.length +
					nodeObj._childFolders.reduce((sum: number, cf: any) => sum + (cf.count || 0), 0);
				delete nodeObj._childFolders;
				delete nodeObj._directDocs;
			}

			const rootDocs = meta.nodes.filter((n) => !normalizeSubcategoryPath(n.subcategory));

			tree.push({
				id: `folder-${catSlug}`,
				title: catName,
				isFolder: true,
				count: meta.nodes.length,
				nodes: [...rootSubfolderNodes, ...rootDocs]
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

function registerFolderHierarchy(storage: UserDocFile, category: string, subcategory?: string) {
	const cleanCat = (category || '').trim();
	if (!cleanCat) return;
	const normSub = normalizeSubcategoryPath(subcategory);
	if (!storage.folders.some((f) => f.category === cleanCat && !f.subcategory)) {
		storage.folders.push({ category: cleanCat });
	}
	if (normSub) {
		const parts = normSub.split('/');
		let acc = '';
		for (const part of parts) {
			acc = acc ? `${acc}/${part}` : part;
			const exists = storage.folders.some(
				(f) => f.category === cleanCat && normalizeSubcategoryPath(f.subcategory) === acc
			);
			if (!exists) {
				storage.folders.push({ category: cleanCat, subcategory: acc });
			}
		}
	}
}

export function saveUserDoc(userName: string, docPayload: Partial<DocumentItem>): DocumentItem {
	const storage = getUserDocStorage(userName);
	const userSlug = sanitizeUserName(userName);
	const now = new Date().toISOString();

	const title = (docPayload.title || 'Catatan Baru').trim();
	const category = (docPayload.category || 'Catatan Harian').trim();
	const subcategory = normalizeSubcategoryPath(docPayload.subcategory);
	const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const catSlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const subSlug = subcategory ? subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';

	const defaultSlug = subSlug
		? `${userSlug}/${catSlug}/${subSlug}/${titleSlug}`
		: `${userSlug}/${catSlug}/${titleSlug}`;
	const targetSlug = docPayload.slug || defaultSlug;
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

	// Ensure folder and all parent subfolders exist
	registerFolderHierarchy(storage, category, subcategory);

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
	const cleanSub = normalizeSubcategoryPath(subcategory);

	if (!cleanCat) return false;

	const initialCount = storage.folders.length;
	registerFolderHierarchy(storage, cleanCat, cleanSub);

	if (storage.folders.length !== initialCount) {
		saveUserDocStorage(userName, storage);
		return true;
	}
	return false;
}

export function deleteUserFolder(userName: string, category: string, subcategory?: string): boolean {
	const storage = getUserDocStorage(userName);
	const cleanCat = (category || '').trim();
	const cleanSub = normalizeSubcategoryPath(subcategory);

	if (!cleanCat) return false;

	storage.folders = storage.folders.filter((f) => {
		if (f.category !== cleanCat) return true;
		if (!cleanSub) return false;
		const fSub = normalizeSubcategoryPath(f.subcategory);
		if (!fSub) return true;
		return !(fSub === cleanSub || fSub.startsWith(`${cleanSub}/`));
	});

	storage.documents = storage.documents.filter((d) => {
		if (d.category !== cleanCat) return true;
		if (!cleanSub) return false;
		const dSub = normalizeSubcategoryPath(d.subcategory);
		if (!dSub) return true;
		return !(dSub === cleanSub || dSub.startsWith(`${cleanSub}/`));
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
	const cleanSub = normalizeSubcategoryPath(newSubcategory);

	doc.category = cleanCat;
	doc.subcategory = cleanSub;
	doc.updatedAt = new Date().toISOString();

	// Ensure destination folder and all parent subfolders exist
	registerFolderHierarchy(storage, cleanCat, cleanSub);

	saveUserDocStorage(userName, storage);
	return { success: true, doc };
}

function deduplicateFolders(storage: UserDocFile) {
	const seen = new Set<string>();
	storage.folders = storage.folders.filter((f) => {
		const cat = (f.category || '').trim();
		if (!cat) return false;
		const sub = normalizeSubcategoryPath(f.subcategory);
		const key = `${cat}::${sub || ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		f.category = cat;
		if (sub) f.subcategory = sub;
		else delete f.subcategory;
		return true;
	});
}

export function renameUserFolder(
	userName: string,
	category: string,
	oldSubcategory: string | undefined,
	newName: string
): { success: boolean; category?: string; subcategory?: string; error?: string } {
	const storage = getUserDocStorage(userName);
	const cleanCat = (category || '').trim();
	const cleanOldSub = normalizeSubcategoryPath(oldSubcategory);
	const cleanNewName = (newName || '').trim().replace(/^\/+|\/+$/g, '');

	if (!cleanCat || !cleanNewName) {
		return { success: false, error: 'Nama folder tidak boleh kosong' };
	}

	if (!cleanOldSub) {
		// Renaming a root category folder (e.g. "SAP" -> "SAP ERP")
		for (const f of storage.folders) {
			if (f.category === cleanCat) {
				f.category = cleanNewName;
			}
		}
		for (const d of storage.documents) {
			if (d.category === cleanCat) {
				d.category = cleanNewName;
				d.updatedAt = new Date().toISOString();
			}
		}
		registerFolderHierarchy(storage, cleanNewName);
		deduplicateFolders(storage);
		saveUserDocStorage(userName, storage);
		return { success: true, category: cleanNewName };
	}

	// Renaming a subfolder at any depth (e.g. "Mining/CS" -> "Mining/Customer Service")
	const parentParts = cleanOldSub.split('/').slice(0, -1);
	const newFullSub = cleanNewName.includes('/')
		? normalizeSubcategoryPath(cleanNewName)!
		: normalizeSubcategoryPath([...parentParts, cleanNewName].join('/'))!;

	for (const f of storage.folders) {
		if (f.category !== cleanCat) continue;
		const fSub = normalizeSubcategoryPath(f.subcategory);
		if (!fSub) continue;
		if (fSub === cleanOldSub) {
			f.subcategory = newFullSub;
		} else if (fSub.startsWith(`${cleanOldSub}/`)) {
			f.subcategory = `${newFullSub}/${fSub.slice(cleanOldSub.length + 1)}`;
		}
	}

	for (const d of storage.documents) {
		if (d.category !== cleanCat) continue;
		const dSub = normalizeSubcategoryPath(d.subcategory);
		if (!dSub) continue;
		if (dSub === cleanOldSub) {
			d.subcategory = newFullSub;
			d.updatedAt = new Date().toISOString();
		} else if (dSub.startsWith(`${cleanOldSub}/`)) {
			d.subcategory = `${newFullSub}/${dSub.slice(cleanOldSub.length + 1)}`;
			d.updatedAt = new Date().toISOString();
		}
	}

	registerFolderHierarchy(storage, cleanCat, newFullSub);
	deduplicateFolders(storage);
	saveUserDocStorage(userName, storage);
	return { success: true, category: cleanCat, subcategory: newFullSub };
}

export function moveUserFolder(
	userName: string,
	sourceCategory: string,
	sourceSubcategory: string | undefined,
	targetCategory: string,
	targetSubcategory?: string
): { success: boolean; error?: string } {
	const storage = getUserDocStorage(userName);
	const srcCat = (sourceCategory || '').trim();
	const srcSub = normalizeSubcategoryPath(sourceSubcategory);
	const dstCat = (targetCategory || '').trim();
	const dstSub = normalizeSubcategoryPath(targetSubcategory);

	if (!srcCat || !dstCat) {
		return { success: false, error: 'Folder asal dan tujuan wajib diisi' };
	}

	// Prevent moving a folder into itself or its own descendant
	if (srcCat === dstCat) {
		if (!srcSub) {
			return { success: false, error: 'Tidak dapat memindahkan folder induk ke dalam dirinya sendiri' };
		}
		if (dstSub && (dstSub === srcSub || dstSub.startsWith(`${srcSub}/`))) {
			return { success: false, error: 'Tidak dapat memindahkan folder ke dalam sub-foldernya sendiri' };
		}
	}

	const folderLeafName = srcSub ? srcSub.split('/').pop()! : srcCat;
	const newSubPrefix = dstSub ? `${dstSub}/${folderLeafName}` : folderLeafName;

	if (!srcSub) {
		// Moving an entire root folder (e.g. "Mining") into another folder (e.g. "SAP" -> "SAP/Mining")
		for (const f of storage.folders) {
			if (f.category === srcCat) {
				const fSub = normalizeSubcategoryPath(f.subcategory);
				f.category = dstCat;
				f.subcategory = fSub ? `${newSubPrefix}/${fSub}` : newSubPrefix;
			}
		}
		for (const d of storage.documents) {
			if (d.category === srcCat) {
				const dSub = normalizeSubcategoryPath(d.subcategory);
				d.category = dstCat;
				d.subcategory = dSub ? `${newSubPrefix}/${dSub}` : newSubPrefix;
				d.updatedAt = new Date().toISOString();
			}
		}
	} else {
		// Moving a subfolder (e.g. "SAP/CS") into another folder/subfolder (e.g. "SAP/Mining" -> "SAP/Mining/CS")
		for (const f of storage.folders) {
			if (f.category !== srcCat) continue;
			const fSub = normalizeSubcategoryPath(f.subcategory);
			if (!fSub) continue;
			if (fSub === srcSub) {
				f.category = dstCat;
				f.subcategory = newSubPrefix;
			} else if (fSub.startsWith(`${srcSub}/`)) {
				f.category = dstCat;
				f.subcategory = `${newSubPrefix}/${fSub.slice(srcSub.length + 1)}`;
			}
		}
		for (const d of storage.documents) {
			if (d.category !== srcCat) continue;
			const dSub = normalizeSubcategoryPath(d.subcategory);
			if (!dSub) continue;
			if (dSub === srcSub) {
				d.category = dstCat;
				d.subcategory = newSubPrefix;
				d.updatedAt = new Date().toISOString();
			} else if (dSub.startsWith(`${srcSub}/`)) {
				d.category = dstCat;
				d.subcategory = `${newSubPrefix}/${dSub.slice(srcSub.length + 1)}`;
				d.updatedAt = new Date().toISOString();
			}
		}
	}

	registerFolderHierarchy(storage, dstCat, newSubPrefix);
	deduplicateFolders(storage);
	saveUserDocStorage(userName, storage);
	return { success: true };
}

export function renameUserDoc(
	userName: string,
	slugOrId: string,
	newTitle: string
): { success: boolean; doc?: DocumentItem; error?: string } {
	const storage = getUserDocStorage(userName);
	const normalized = (slugOrId || '').toLowerCase().trim();
	const cleanTitle = (newTitle || '').trim();

	if (!cleanTitle) {
		return { success: false, error: 'Judul catatan tidak boleh kosong' };
	}

	const doc = storage.documents.find((d) => {
		const docSlug = (d.slug || '').toLowerCase();
		const docId = (d.id || '').toLowerCase();
		return docSlug === normalized || docId === normalized || docSlug.endsWith(`/${normalized}`);
	});

	if (!doc) {
		return { success: false, error: 'Catatan tidak ditemukan' };
	}

	doc.title = cleanTitle;
	if (doc.content && /^#\s+.+/m.test(doc.content)) {
		doc.content = doc.content.replace(/^#\s+.+/m, `# ${cleanTitle}`);
	}
	doc.updatedAt = new Date().toISOString();

	saveUserDocStorage(userName, storage);
	return { success: true, doc };
}


