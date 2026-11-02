import fs from 'node:fs';
import path from 'node:path';
import { startExternalDocsScheduler } from '$lib/server/scheduler';

// Inisialisasi scheduler otomatis jam 12 malam saat server SvelteKit menyala
startExternalDocsScheduler();

export const init = async () => {
	startExternalDocsScheduler();
};

const UPLOAD_DIR = path.resolve(process.cwd(), 'static/uploads');
const MIME_MAP: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

export const handle = async ({
	event,
	resolve
}: {
	event: any;
	resolve: (event: any) => Promise<Response>;
}) => {
	// Serve dynamically uploaded images (/uploads/*) in both Dev and Production (build/index.js)
	const pathname: string = event.url?.pathname || '';
	if (pathname.startsWith('/uploads/') && event.request.method === 'GET') {
		const rawName = path.basename(pathname);
		const safePath = path.join(UPLOAD_DIR, rawName);
		if (safePath.startsWith(UPLOAD_DIR) && fs.existsSync(safePath)) {
			try {
				const ext = path.extname(rawName).toLowerCase();
				const contentType = MIME_MAP[ext] || 'application/octet-stream';
				const buf = fs.readFileSync(safePath);
				return new Response(buf, {
					status: 200,
					headers: {
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=31536000, immutable',
						'X-Content-Type-Options': 'nosniff'
					}
				});
			} catch (_) {}
		}
	}

	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
