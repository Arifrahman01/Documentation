import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadDocuments, saveDocuments, inferSection } from '$lib/server/docs';
import { verifyWriteAccess } from '$lib/server/auth';

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

export const PUT: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { params, request } = event;
	const id = params.id;
	const docs = loadDocuments();
	const index = docs.findIndex((d) => d.id === id || d.slug === id);

	if (index === -1) {
		return json({ error: 'Dokumen tidak ditemukan untuk diubah' }, { status: 404 });
	}

	try {
		const body = await request.json();
		const { title, category, subcategory, content, builderContent, description, tags, section, sacUrl } = body;
		const doc = docs[index];

		if (section && ['SAP', 'SAC', 'WEB'].includes(section.toUpperCase())) {
			doc.section = section.toUpperCase();
		}
		if (title) doc.title = title.trim();
		if (category) doc.category = category.trim();
		if (subcategory !== undefined) {
			doc.subcategory = subcategory ? String(subcategory).trim() : undefined;
		}
		if (content !== undefined) {
			doc.content = String(content).trim();
		}
		if (builderContent !== undefined) {
			doc.builderContent = String(builderContent).trim() || undefined;
		}
		if (sacUrl !== undefined) doc.sacUrl = sacUrl ? sacUrl.trim() : undefined;
		if (description) {
			doc.description = description.trim();
			doc.snippet = description.trim();
		} else if (doc.content) {
			doc.description = doc.content
				.slice(0, 160)
				.replace(/[#*`\n>-]/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			doc.snippet = doc.description;
		}
		if (tags && Array.isArray(tags)) {
			doc.tags = tags;
		} else if (!doc.tags || doc.tags.length === 0) {
			doc.tags = [doc.section || 'SAP', doc.category, ...(doc.subcategory ? [doc.subcategory] : [])];
		}
		doc.updatedAt = new Date().toISOString();

		saveDocuments(docs);
		return json({ success: true, document: doc });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal mengubah dokumen' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const id = event.params.id;
	let docs = loadDocuments();
	const initialLen = docs.length;
	docs = docs.filter((d) => d.id !== id && d.slug !== id);

	if (docs.length === initialLen) {
		return json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
	}

	saveDocuments(docs);
	return json({ success: true, message: 'Dokumen berhasil dihapus' });
};
