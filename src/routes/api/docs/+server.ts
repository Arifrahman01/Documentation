import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadDocuments, saveDocuments, inferSection, buildDocTree } from '$lib/server/docs';

export const GET: RequestHandler = async () => {
	const docs = loadDocuments();
	const tree = buildDocTree(docs);
	return json(tree);
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { title, category, content, description, tags, slug, section, sacUrl } = body;

		if (!title || !content) {
			return json({ error: 'Judul dan konten dokumentasi wajib diisi' }, { status: 400 });
		}

		const docs = loadDocuments();
		const sec =
			section && ['SAP', 'SAC', 'WEB'].includes(section.toUpperCase())
				? section.toUpperCase()
				: inferSection({ title, category, slug });

		const cat = (category || 'General').trim();
		const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const finalSlug = slug || `${sec.toLowerCase()}/${titleSlug}`;
		const cleanDesc = description || content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim();

		const newDoc = {
			id: finalSlug,
			slug: finalSlug,
			section: sec,
			title: title.trim(),
			category: cat,
			description: cleanDesc,
			snippet: cleanDesc,
			content: content.trim(),
			tags: Array.isArray(tags) && tags.length > 0 ? tags : [sec, cat, 'Dokumentasi'],
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
		return json({ success: true, document: newDoc });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menyimpan dokumen' }, { status: 500 });
	}
};
