import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';
import { loadExternalDocuments } from '$lib/server/docs';
import { ensureEnvLoaded, resolveSessionUser } from '$lib/server/auth';

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

export const GET: RequestHandler = async ({ url, cookies }) => {
	ensureEnvLoaded();

	if (!resolveSessionUser(cookies, url)) {
		throw error(401, 'Sesi login diperlukan untuk mengunduh dokumen');
	}

	const id = (url.searchParams.get('id') || '').trim();
	if (!id) {
		throw error(400, 'Parameter id dokumen diperlukan');
	}

	const extDocs = loadExternalDocuments();
	const doc = extDocs.find((d) => d.id === id || d.slug === id || `external/${d.id}` === id);
	if (!doc || !doc.relativePath) {
		throw error(404, 'Dokumen eksternal tidak ditemukan dalam indeks');
	}

	// Same variable as scripts/index-external-docs.cjs (EXTERNAL_DOCS_ROOT kept as legacy alias)
	const configuredRoot = (process.env.EXTERNAL_DOCS_DIR || process.env.EXTERNAL_DOCS_ROOT || '').trim();
	if (!configuredRoot) {
		throw error(503, 'EXTERNAL_DOCS_DIR belum dikonfigurasi di server');
	}
	const rootDir = path.resolve(configuredRoot);
	const resolvedFile = path.resolve(rootDir, doc.relativePath);

	// Prevent path traversal outside rootDir (compare against root + separator, not a bare prefix)
	const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
	const cmpFile = process.platform === 'win32' ? resolvedFile.toLowerCase() : resolvedFile;
	const cmpRoot = process.platform === 'win32' ? rootWithSep.toLowerCase() : rootWithSep;
	if (!cmpFile.startsWith(cmpRoot)) {
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
