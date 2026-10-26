import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';
import { verifyWriteAccess } from '$lib/server/auth';

const UPLOAD_DIR = path.resolve(process.cwd(), 'static/uploads');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_EXT: Record<string, string> = {
	png: 'png',
	jpeg: 'jpg',
	jpg: 'jpg',
	gif: 'gif',
	webp: 'webp'
};

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { request } = event;
	try {
		const body = await request.json();
		const rawImage = body.image || body.data;
		const { filename } = body;

		if (!rawImage || typeof rawImage !== 'string') {
			return json({ error: 'Data gambar tidak valid' }, { status: 400 });
		}

		const matches = rawImage.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
		if (!matches) {
			return json({ error: 'Format gambar harus berupa base64 data URI (PNG, JPG, GIF, atau WebP)' }, { status: 400 });
		}

		const extRaw = matches[1].toLowerCase();
		const ext = ALLOWED_MIME_EXT[extRaw];
		if (!ext) {
			return json(
				{ error: `Tipe gambar '${extRaw}' tidak didukung. Gunakan PNG, JPG, GIF, atau WebP.` },
				{ status: 400 }
			);
		}

		const buffer = Buffer.from(matches[2], 'base64');
		if (buffer.byteLength > MAX_UPLOAD_BYTES) {
			return json({ error: 'Ukuran gambar melebihi batas maksimum 5 MB' }, { status: 413 });
		}

		if (!fs.existsSync(UPLOAD_DIR)) {
			fs.mkdirSync(UPLOAD_DIR, { recursive: true });
		}

		const safeName = (filename || 'screenshot')
			.replace(/\.[^/.]+$/, '')
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40);
		const finalFilename = `${safeName || 'img'}-${Date.now()}.${ext}`;
		const filePath = path.join(UPLOAD_DIR, finalFilename);

		fs.writeFileSync(filePath, buffer);

		return json({
			success: true,
			url: `/uploads/${finalFilename}`,
			filename: finalFilename
		});
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menyimpan gambar' }, { status: 500 });
	}
};
