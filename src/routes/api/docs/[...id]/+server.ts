import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	loadDocuments,
	loadExternalDocuments,
	saveDocuments,
	inferSection,
	buildDocTree
} from '$lib/server/docs';
import { verifyWriteAccess } from '$lib/server/auth';

function formatExternalDocMarkdown(extDoc: any): string {
	const raw = String(extDoc.content || extDoc.snippet || '').trim();
	const fileName = extDoc.fileName || extDoc.title || 'Berkas Eksternal';
	const relPath = extDoc.relativePath || extDoc.category || '-';
	const downloadUrl = `/api/docs/external-file?id=${encodeURIComponent(extDoc.id)}`;

	// Convert [Slide X] or [Sheet: Y] markers into clean Markdown H2 headings for easy reading & outline navigation
	const formattedBody = raw
		.replace(/\[Slide\s+(\d+)\]/gi, '\n\n## Slide $1\n\n')
		.replace(/\[Sheet:\s*([^\]]+)\]/gi, '\n\n## Sheet: $1\n\n')
		.replace(/\{[0-9A-F-]{36}\}/gi, '\n')
		.trim();

	return [
		`> [!NOTE] **Dokumen Arsip Terindeks**: Berkas ini berasal dari penyimpanan eksternal (\`${relPath}\`).`,
		`> Anda dapat membaca isi teks hasil ekstraksi di bawah ini atau **[📥 Buka / Unduh Berkas Asli (${fileName})](${downloadUrl})**.`,
		'',
		formattedBody
	].join('\n');
}

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	const docs = loadDocuments();
	const doc = docs.find((d) => d.id === id || d.slug === id);

	if (doc) {
		doc.section = inferSection(doc);
		return json(doc);
	}

	// Fallback: Check External Synced Documents (`external/ext_...` or `ext_...`)
	const extDocs = loadExternalDocuments();
	const extDoc = extDocs.find(
		(d) => d.id === id || d.slug === id || `external/${d.id}` === id
	);

	if (extDoc) {
		return json({
			...extDoc,
			slug: extDoc.slug || `external/${extDoc.id}`,
			section: inferSection(extDoc),
			isExternalDoc: true,
			content: formatExternalDocMarkdown(extDoc)
		});
	}

	return json({ error: 'Dokumentasi tidak ditemukan' }, { status: 404 });
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
		const tree = buildDocTree(docs);
		return json({ success: true, document: doc, treeData: tree.treeData });
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
