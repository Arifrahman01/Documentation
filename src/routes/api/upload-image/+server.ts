import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { filename, data } = body;

		if (!data) {
			return json({ error: 'Data gambar tidak ditemukan' }, { status: 400 });
		}

		// Parse base64
		const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
		let buffer: Buffer;
		let ext = '.png';

		if (matches && matches.length === 3) {
			const mime = matches[1].toLowerCase();
			if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
			else if (mime.includes('gif')) ext = '.gif';
			else if (mime.includes('webp')) ext = '.webp';
			else if (mime.includes('svg')) ext = '.svg';
			buffer = Buffer.from(matches[2], 'base64');
		} else {
			buffer = Buffer.from(data, 'base64');
		}

		const uploadDir = path.resolve(process.cwd(), 'static/img/uploads');
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}

		const safeBase = (filename || 'image')
			.replace(/\.[^/.]+$/, '')
			.replace(/[^a-zA-Z0-9_-]/g, '_')
			.slice(0, 30);
		const uniqueName = `${safeBase || 'gambar'}-${Date.now()}${ext}`;
		const targetPath = path.join(uploadDir, uniqueName);

		fs.writeFileSync(targetPath, buffer);

		const relativeUrl = `/img/uploads/${uniqueName}`;
		return json({ success: true, url: relativeUrl, filename: uniqueName });
	} catch (err: any) {
		console.error('Upload Image Error:', err);
		return json({ error: err?.message || 'Gagal mengunggah gambar' }, { status: 500 });
	}
};
