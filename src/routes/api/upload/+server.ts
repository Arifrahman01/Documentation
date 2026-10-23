import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'static/uploads');

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { image, filename } = body;

		if (!image || typeof image !== 'string') {
			return json({ error: 'Data gambar tidak valid' }, { status: 400 });
		}

		const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
		if (!matches) {
			return json({ error: 'Format gambar harus berupa base64 data URI' }, { status: 400 });
		}

		const extRaw = matches[1].toLowerCase();
		const ext = extRaw === 'jpeg' ? 'jpg' : extRaw === 'svg+xml' ? 'svg' : extRaw;
		const base64Data = matches[2];

		if (!fs.existsSync(UPLOAD_DIR)) {
			fs.mkdirSync(UPLOAD_DIR, { recursive: true });
		}

		const safeName = (filename || 'screenshot')
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40);
		const finalFilename = `${safeName || 'img'}-${Date.now()}.${ext}`;
		const filePath = path.join(UPLOAD_DIR, finalFilename);

		fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

		return json({
			success: true,
			url: `/uploads/${finalFilename}`
		});
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menyimpan gambar' }, { status: 500 });
	}
};
