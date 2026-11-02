import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';
import { loadExternalDocuments } from '$lib/server/docs';
import { ensureEnvLoaded } from '$lib/server/auth';

const MIME_MAP: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.doc': 'application/msword',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.xls': 'application/vnd.ms-excel',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.csv': 'text/csv; charset=utf-8'
};

export const GET: RequestHandler = async ({ url }) => {
	ensureEnvLoaded();
	const id = (url.searchParams.get('id') || '').trim();
	if (!id) {
		throw error(400, 'Parameter id dokumen diperlukan');
	}

	const extDocs = loadExternalDocuments();
	const doc = extDocs.find((d) => d.id === id || d.slug === id || `external/${d.id}` === id);
	if (!doc || !doc.relativePath) {
		throw error(404, 'Dokumen eksternal tidak ditemukan dalam indeks');
	}

	const rootDir = path.resolve(
		process.env.EXTERNAL_DOCS_ROOT || 'D:\\Share All Doc Before Go Live\\10 Helpdesk'
	);
	const resolvedFile = path.resolve(rootDir, doc.relativePath);

	// Prevent path traversal outside rootDir
	if (!resolvedFile.toLowerCase().startsWith(rootDir.toLowerCase())) {
		throw error(403, 'Akses path dokumen ditolak');
	}

	if (!fs.existsSync(resolvedFile)) {
		throw error(404, `Berkas fisik "${doc.fileName || doc.title}" tidak ditemukan di penyimpanan lokal`);
	}

	const ext = path.extname(resolvedFile).toLowerCase();
	const contentType = MIME_MAP[ext] || 'application/octet-stream';
	const fileName = doc.fileName || path.basename(resolvedFile);
	const dispositionType = ext === '.pdf' || ext === '.txt' || ext === '.md' ? 'inline' : 'attachment';
	const fileBuffer = fs.readFileSync(resolvedFile);

	return new Response(fileBuffer, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(fileName)}"`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
