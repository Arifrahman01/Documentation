import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadDocuments,
	saveDocuments,
	loadFolders,
	saveFolders,
	inferSection,
	buildDocTree,
	normalizeSubcategoryPath
} from '$lib/server/docs';
import { verifyWriteAccess } from '$lib/server/auth';

const normSection = (value: unknown): string =>
	value && ['SAP', 'SAC', 'WEB'].includes(String(value).toUpperCase())
		? String(value).toUpperCase()
		: 'SAP';

/** True when `value` equals `base` or lives anywhere below it (a/b is within a). */
const isWithinSubPath = (value: string | undefined | null, base: string): boolean => {
	const v = normalizeSubcategoryPath(value).toLowerCase();
	const b = normalizeSubcategoryPath(base).toLowerCase();
	return !!b && (v === b || v.startsWith(`${b}/`));
};

export const GET: RequestHandler = async () => {
	const docs = loadDocuments();
	const tree = buildDocTree(docs);
	return json(tree);
};

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { request } = event;
	try {
		const body = await request.json();

		// 1. Handle Create Folder / Sub-Folder (File Explorer style, unlimited nesting: "Mining/CS")
		if (body.type === 'folder') {
			const sec = normSection(body.section);
			const cat = String(body.category || '').trim();
			const subcat = normalizeSubcategoryPath(body.subcategory) || undefined;

			if (!cat) {
				return json({ error: 'Nama folder wajib diisi' }, { status: 400 });
			}

			const folders = loadFolders();
			const exists = folders.some(
				(f) =>
					(f.section || 'SAP').toUpperCase() === sec &&
					f.category.toLowerCase() === cat.toLowerCase() &&
					normalizeSubcategoryPath(f.subcategory).toLowerCase() === (subcat || '').toLowerCase()
			);
			if (!exists) {
				folders.push({ section: sec, category: cat, subcategory: subcat });
				saveFolders(folders);
			}

			const docs = loadDocuments();
			const tree = buildDocTree(docs);
			return json({
				success: true,
				folder: { section: sec, category: cat, subcategory: subcat },
				treeData: tree.treeData
			});
		}

		// 2. Handle Delete Empty Folder / Sub-Folder (including all nested sub-folders)
		if (body.type === 'delete-folder') {
			const sec = normSection(body.section);
			const cat = String(body.category || '').trim();
			const subcat = normalizeSubcategoryPath(body.subcategory);

			const docs = loadDocuments();
			const hasDocs = docs.some((d) => {
				const docSec = (d.section || inferSection(d)).toUpperCase();
				if (docSec !== sec || (d.category || 'General').toLowerCase() !== cat.toLowerCase()) {
					return false;
				}
				return subcat ? isWithinSubPath(d.subcategory, subcat) : true;
			});

			if (hasDocs) {
				return json(
					{
						error: 'Folder tidak bisa dihapus karena masih berisi dokumen. Hapus atau pindahkan dokumen terlebih dahulu.'
					},
					{ status: 400 }
				);
			}

			let folders = loadFolders();
			folders = folders.filter((f) => {
				const sameSec = (f.section || 'SAP').toUpperCase() === sec;
				const sameCat = f.category.toLowerCase() === cat.toLowerCase();
				if (!(sameSec && sameCat)) return true;
				if (!subcat) return false;
				return !isWithinSubPath(f.subcategory, subcat);
			});
			saveFolders(folders);

			const tree = buildDocTree(docs);
			return json({ success: true, treeData: tree.treeData });
		}

		// 3. Handle Rename Folder / Sub-Folder (any depth; children follow automatically)
		if (body.type === 'rename-folder') {
			const sec = normSection(body.section);
			const oldCat = String(body.oldCategory || '').trim();
			const newCat = String(body.newCategory || '').trim();
			const oldSubcat = normalizeSubcategoryPath(body.oldSubcategory);
			const newSubLeaf = normalizeSubcategoryPath(body.newSubcategory);

			if (oldSubcat) {
				// Sub-folder rename: the last segment is replaced, parents stay the same
				if (!newSubLeaf) {
					return json({ error: 'Nama baru sub-folder wajib diisi' }, { status: 400 });
				}
				const parentParts = oldSubcat.split('/').slice(0, -1);
				const newFull = newSubLeaf.includes('/')
					? newSubLeaf
					: [...parentParts, newSubLeaf].join('/');
				const remap = (value?: string) => {
					const v = normalizeSubcategoryPath(value);
					if (v.toLowerCase() === oldSubcat.toLowerCase()) return newFull;
					return `${newFull}/${v.slice(oldSubcat.length + 1)}`;
				};

				const docs = loadDocuments();
				let changedDocs = 0;
				for (const doc of docs) {
					const docSec = (doc.section || inferSection(doc)).toUpperCase();
					if (
						docSec === sec &&
						doc.category.toLowerCase() === oldCat.toLowerCase() &&
						isWithinSubPath(doc.subcategory, oldSubcat)
					) {
						doc.subcategory = remap(doc.subcategory);
						doc.updatedAt = new Date().toISOString();
						changedDocs++;
					}
				}
				if (changedDocs > 0) saveDocuments(docs);

				const folders = loadFolders();
				let matchedFolder = false;
				for (const f of folders) {
					if (
						(f.section || 'SAP').toUpperCase() === sec &&
						f.category.toLowerCase() === oldCat.toLowerCase() &&
						isWithinSubPath(f.subcategory, oldSubcat)
					) {
						f.subcategory = remap(f.subcategory);
						matchedFolder = true;
					}
				}
				if (!matchedFolder) {
					folders.push({ section: sec, category: oldCat, subcategory: newFull });
				}
				saveFolders(folders);

				const tree = buildDocTree(docs);
				return json({
					success: true,
					treeData: tree.treeData,
					renamed: { section: sec, category: oldCat, subcategory: newFull }
				});
			} else {
				// Main folder (category) rename
				if (!newCat) {
					return json({ error: 'Nama baru folder wajib diisi' }, { status: 400 });
				}
				const docs = loadDocuments();
				let changedDocs = 0;
				for (const doc of docs) {
					const docSec = (doc.section || inferSection(doc)).toUpperCase();
					if (docSec === sec && doc.category.toLowerCase() === oldCat.toLowerCase()) {
						doc.category = newCat;
						if (Array.isArray(doc.tags)) {
							doc.tags = doc.tags.map((t) => (t.toLowerCase() === oldCat.toLowerCase() ? newCat : t));
						}
						doc.updatedAt = new Date().toISOString();
						changedDocs++;
					}
				}
				if (changedDocs > 0) saveDocuments(docs);

				const folders = loadFolders();
				let matchedFolder = false;
				for (const f of folders) {
					if (
						(f.section || 'SAP').toUpperCase() === sec &&
						f.category.toLowerCase() === oldCat.toLowerCase()
					) {
						f.category = newCat;
						matchedFolder = true;
					}
				}
				if (!matchedFolder) {
					folders.push({ section: sec, category: newCat });
				}
				saveFolders(folders);

				const tree = buildDocTree(docs);
				return json({
					success: true,
					treeData: tree.treeData,
					renamed: { section: sec, category: newCat }
				});
			}
		}

		// 3b. Handle Move Folder into another folder at any depth (drag & drop)
		if (body.type === 'move-folder') {
			const sec = normSection(body.section);
			const srcCat = String(body.category || '').trim();
			const srcSub = normalizeSubcategoryPath(body.subcategory);
			const dstCat = String(body.targetCategory || '').trim();
			const dstSub = normalizeSubcategoryPath(body.targetSubcategory);

			if (!srcCat || !dstCat) {
				return json({ error: 'Folder asal dan tujuan wajib diisi' }, { status: 400 });
			}
			const sameCat = srcCat.toLowerCase() === dstCat.toLowerCase();
			if (sameCat) {
				if (!srcSub) {
					return json({ error: 'Folder tidak bisa dipindahkan ke dalam dirinya sendiri' }, { status: 400 });
				}
				if (dstSub && isWithinSubPath(dstSub, srcSub)) {
					return json({ error: 'Folder tidak bisa dipindahkan ke dalam sub-foldernya sendiri' }, { status: 400 });
				}
			}

			const leaf = srcSub ? srcSub.split('/').pop()! : srcCat;
			const newPrefix = dstSub ? `${dstSub}/${leaf}` : leaf;
			const remap = (value?: string) => {
				const v = normalizeSubcategoryPath(value);
				if (!srcSub) return v ? `${newPrefix}/${v}` : newPrefix;
				if (v.toLowerCase() === srcSub.toLowerCase()) return newPrefix;
				return `${newPrefix}/${v.slice(srcSub.length + 1)}`;
			};
			const inSource = (cat: string, sub?: string) => {
				if (cat.toLowerCase() !== srcCat.toLowerCase()) return false;
				return srcSub ? isWithinSubPath(sub, srcSub) : true;
			};

			const docs = loadDocuments();
			let changedDocs = 0;
			for (const doc of docs) {
				const docSec = (doc.section || inferSection(doc)).toUpperCase();
				if (docSec === sec && inSource(doc.category || 'General', doc.subcategory)) {
					doc.category = dstCat;
					doc.subcategory = remap(doc.subcategory) || undefined;
					doc.updatedAt = new Date().toISOString();
					changedDocs++;
				}
			}
			if (changedDocs > 0) saveDocuments(docs);

			const folders = loadFolders();
			let touched = false;
			for (const f of folders) {
				if ((f.section || 'SAP').toUpperCase() === sec && inSource(f.category, f.subcategory)) {
					f.category = dstCat;
					f.subcategory = remap(f.subcategory) || undefined;
					touched = true;
				}
			}
			if (!touched) {
				folders.push({ section: sec, category: dstCat, subcategory: newPrefix });
			}
			saveFolders(folders);

			const tree = buildDocTree(docs);
			return json({ success: true, treeData: tree.treeData });
		}

		// 4. Handle Reorder Folders (Main Categories)
		if (body.type === 'reorder-folders') {
			const sec = String(body.section || 'SAP').toUpperCase();
			const orderedCategories = Array.isArray(body.categories) ? body.categories.map(String) : [];
			if (orderedCategories.length === 0) {
				return json({ error: 'Daftar folder kategori tidak valid' }, { status: 400 });
			}

			let folders = loadFolders();
			orderedCategories.forEach((catName: string, idx: number) => {
				const cleanCat = catName.trim();
				const existing = folders.find(
					(f) =>
						(f.section || 'SAP').toUpperCase() === sec &&
						f.category.toLowerCase() === cleanCat.toLowerCase() &&
						!f.subcategory
				);
				if (existing) {
					existing.order = idx + 1;
				} else {
					folders.push({
						section: sec,
						category: cleanCat,
						order: idx + 1
					});
				}
			});
			saveFolders(folders);

			const docs = loadDocuments();
			const tree = buildDocTree(docs);
			return json({ success: true, treeData: tree.treeData });
		}

		// 5. Handle Reorder Subfolders
		if (body.type === 'reorder-subfolders') {
			const sec = String(body.section || 'SAP').toUpperCase();
			const cat = String(body.category || '').trim();
			const orderedSubcategories = Array.isArray(body.subcategories) ? body.subcategories.map(String) : [];
			if (orderedSubcategories.length === 0) {
				return json({ error: 'Daftar sub-folder tidak valid' }, { status: 400 });
			}

			let folders = loadFolders();
			orderedSubcategories.forEach((subName: string, idx: number) => {
				// Full sub-folder paths (e.g. "Mining/CS"), ordered among their siblings
				const cleanSub = normalizeSubcategoryPath(subName);
				if (!cleanSub) return;
				const existing = folders.find(
					(f) =>
						(f.section || 'SAP').toUpperCase() === sec &&
						f.category.toLowerCase() === cat.toLowerCase() &&
						normalizeSubcategoryPath(f.subcategory).toLowerCase() === cleanSub.toLowerCase()
				);
				if (existing) {
					existing.order = idx + 1;
				} else {
					folders.push({
						section: sec,
						category: cat,
						subcategory: cleanSub,
						order: idx + 1
					});
				}
			});
			saveFolders(folders);

			const docs = loadDocuments();
			const tree = buildDocTree(docs);
			return json({ success: true, treeData: tree.treeData });
		}

		// 6. Handle Rename File / Note
		if (body.type === 'rename-file') {
			const id = body.id || body.slug;
			const newTitle = String(body.newTitle || body.title || '').trim();
			if (!id) return json({ error: 'ID file wajib diisi' }, { status: 400 });
			if (!newTitle) return json({ error: 'Nama file tidak boleh kosong' }, { status: 400 });

			const docs = loadDocuments();
			const doc = docs.find((d) => d.id === id || d.slug === id);
			if (!doc) return json({ error: 'File catatan tidak ditemukan' }, { status: 404 });

			const oldTitle = doc.title;
			doc.title = newTitle;

			// Keep first heading in content aligned if it matched oldTitle
			if (doc.content && oldTitle && doc.content.startsWith(`# ${oldTitle}`)) {
				doc.content = `# ${newTitle}` + doc.content.slice(`# ${oldTitle}`.length);
			}
			doc.updatedAt = new Date().toISOString();

			saveDocuments(docs);
			const tree = buildDocTree(docs);
			return json({ success: true, document: doc, treeData: tree.treeData });
		}

		// 7. Handle Move File to Another Folder
		if (body.type === 'move-file') {
			const id = body.id || body.slug;
			const targetCat = String(body.category || '').trim();
			const targetSubcat = normalizeSubcategoryPath(body.subcategory) || undefined;
			const targetSec = body.section ? String(body.section).toUpperCase() : undefined;

			if (!id || !targetCat) {
				return json({ error: 'ID dokumen dan kategori tujuan harus diisi' }, { status: 400 });
			}

			const docs = loadDocuments();
			const doc = docs.find((d) => d.id === id || d.slug === id);
			if (!doc) return json({ error: 'File catatan tidak ditemukan' }, { status: 404 });

			if (targetSec && ['SAP', 'SAC', 'WEB'].includes(targetSec)) {
				doc.section = targetSec;
			}
			doc.category = targetCat;
			doc.subcategory = targetSubcat;
			doc.updatedAt = new Date().toISOString();

			saveDocuments(docs);
			const tree = buildDocTree(docs);
			return json({ success: true, document: doc, treeData: tree.treeData });
		}

		// 3. Handle Create File / Note (Obsidian style: only title is required, content can be empty initially)
		const { title, category, subcategory, content, builderContent, description, tags, slug, section, sacUrl } = body;

		if (!title || !String(title).trim()) {
			return json({ error: 'Nama file / catatan wajib diisi' }, { status: 400 });
		}

		const docs = loadDocuments();
		const sec =
			section && ['SAP', 'SAC', 'WEB'].includes(String(section).toUpperCase())
				? String(section).toUpperCase()
				: inferSection({ title, category, slug });

		const defaultCat =
			sec === 'SAP' ? 'Overview & Landscape' : sec === 'SAC' ? 'Overview & BI' : 'Web Stack';
		const cat = (category || defaultCat).trim();
		const subcat = normalizeSubcategoryPath(subcategory) || undefined;
		const titleSlug = String(title)
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		let finalSlug = slug || `${sec.toLowerCase()}/${titleSlug || 'catatan-baru'}`;

		// Ensure unique slug when creating a new file
		if (!slug && docs.some((d) => d.id === finalSlug || d.slug === finalSlug)) {
			finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
		}

		const rawContent = typeof content === 'string' ? content.trim() : '';
		const cleanDesc =
			description ||
			(rawContent
				? rawContent.slice(0, 160).replace(/[#*`\n>-]/g, ' ').replace(/\s+/g, ' ').trim()
				: `Catatan dokumentasi ${sec} pada folder ${cat}${subcat ? ` / ${subcat}` : ''}.`);

		const newDoc = {
			id: finalSlug,
			slug: finalSlug,
			section: sec,
			title: String(title).trim(),
			category: cat,
			subcategory: subcat || undefined,
			description: cleanDesc,
			snippet: cleanDesc,
			content: rawContent,
			builderContent: typeof builderContent === 'string' && builderContent.trim() ? builderContent.trim() : undefined,
			tags:
				Array.isArray(tags) && tags.length > 0
					? tags
					: [sec, cat, ...(subcat ? [subcat] : [])],
			sacUrl: sacUrl ? sacUrl.trim() : undefined,
			updatedAt: new Date().toISOString()
		};

		const existingIndex = docs.findIndex((d) => d.id === finalSlug || d.slug === finalSlug);
		if (existingIndex >= 0) {
			docs[existingIndex] = newDoc;
		} else {
			docs.push(newDoc);
		}

		saveDocuments(docs);
		const tree = buildDocTree(docs);
		return json({ success: true, document: newDoc, treeData: tree.treeData });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menyimpan dokumen' }, { status: 500 });
	}
};
