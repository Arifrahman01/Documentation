import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadDocuments, saveDocuments, inferSection } from '$lib/server/docs';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	const docs = loadDocuments();
	const doc = docs.find((d) => d.id === id || d.slug === id);

	if (!doc) {
		return json({ error: 'Dokumentasi tidak ditemukan' }, { status: 404 });
	}

	doc.section = inferSection(doc);
	return json(doc);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = params.id;
	const docs = loadDocuments();
	const index = docs.findIndex((d) => d.id === id || d.slug === id);

	if (index === -1) {
		return json({ error: 'Dokumen tidak ditemukan untuk diubah' }, { status: 404 });
	}

	try {
		const body = await request.json();
		const { title, category, content, description, tags, section, sacUrl } = body;
		const doc = docs[index];

		if (section && ['SAP', 'SAC', 'WEB'].includes(section.toUpperCase())) {
			doc.section = section.toUpperCase();
		}
		if (title) doc.title = title.trim();
		if (category) doc.category = category.trim();
		if (content) doc.content = content.trim();
		if (sacUrl !== undefined) doc.sacUrl = sacUrl ? sacUrl.trim() : undefined;
		if (description) {
			doc.description = description.trim();
			doc.snippet = description.trim();
		} else if (content) {
			doc.description = content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim();
			doc.snippet = doc.description;
		}
		if (tags && Array.isArray(tags)) doc.tags = tags;
		doc.updatedAt = new Date().toISOString();

		saveDocuments(docs);
		return json({ success: true, document: doc });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal mengubah dokumen' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = params.id;
	let docs = loadDocuments();
	const initialLen = docs.length;
	docs = docs.filter((d) => d.id !== id && d.slug !== id);

	if (docs.length === initialLen) {
		return json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
	}

	saveDocuments(docs);
	return json({ success: true, message: 'Dokumen berhasil dihapus' });
};
