import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadDocuments,
	saveDocuments,
	loadFolders,
	saveFolders,
	inferSection,
	buildDocTree
} from '$lib/server/docs';
import { verifyWriteAccess } from '$lib/server/auth';

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

		// 1. Handle Create Folder / Sub-Folder (File Explorer style)
		if (body.type === 'folder') {
			const sec =
				body.section && ['SAP', 'SAC', 'WEB'].includes(String(body.section).toUpperCase())
					? String(body.section).toUpperCase()
					: 'SAP';
			const cat = String(body.category || '').trim();
			const subcat = body.subcategory ? String(body.subcategory).trim() : undefined;

			if (!cat) {
				return json({ error: 'Nama folder wajib diisi' }, { status: 400 });
			}

			const folders = loadFolders();
			const exists = folders.some(
				(f) =>
					(f.section || 'SAP').toUpperCase() === sec &&
					f.category.toLowerCase() === cat.toLowerCase() &&
					(f.subcategory || '').toLowerCase() === (subcat || '').toLowerCase()
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

		// 2. Handle Delete Empty Folder / Sub-Folder
		if (body.type === 'delete-folder') {
			const sec = String(body.section || 'SAP').toUpperCase();
			const cat = String(body.category || '').trim();
			const subcat = body.subcategory ? String(body.subcategory).trim() : undefined;

			let folders = loadFolders();
			folders = folders.filter((f) => {
				const sameSec = (f.section || 'SAP').toUpperCase() === sec;
				const sameCat = f.category.toLowerCase() === cat.toLowerCase();
				if (subcat) {
					return !(sameSec && sameCat && (f.subcategory || '').toLowerCase() === subcat.toLowerCase());
				}
				return !(sameSec && sameCat);
			});
			saveFolders(folders);

			const docs = loadDocuments();
			const tree = buildDocTree(docs);
			return json({ success: true, treeData: tree.treeData });
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
		const subcat = subcategory ? String(subcategory).trim() : undefined;
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
