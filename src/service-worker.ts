/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `docs-pwa-cache-v2-${version}`;

const toUrl = (p: string) => (p.startsWith('/') ? p : `/${p}`);

// IMPORTANT: Only precache essential app shell & core icons (~20 files).
// NEVER precache /img/ (860+ documentation screenshots) or /uploads/ all at once during install,
// as cache.addAll() on 860+ files floods the browser network tab with simultaneous requests!
// Documentation images in /img/ are cached lazily on-demand when the user views an article.
const PRECACHE_ASSETS = [
	...immutable.map((item) => toUrl(item.path)),
	...prerendered.map((item) => toUrl(item.path)),
	...assets
		.map((item) => toUrl(item.path))
		.filter(
			(path) =>
				!path.startsWith('/img/') &&
				!path.startsWith('/uploads/') &&
				!path.endsWith('.map')
		)
];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then(async (cache) => {
				// Precache sequentially in small batches to avoid network spikes
				const batchSize = 8;
				for (let i = 0; i < PRECACHE_ASSETS.length; i += batchSize) {
					const slice = PRECACHE_ASSETS.slice(i, i + batchSize);
					await Promise.allSettled(slice.map((url) => cache.add(url)));
				}
			})
			.then(() => (self as any).skipWaiting())
	);
});

self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}
			await (self as any).clients.claim();
		})
	);
});

self.addEventListener('fetch', (event: any) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Only handle same-origin requests
	if (url.origin !== location.origin) return;

	// Ignore API routes, AI endpoints, dynamic uploads, and internal Vite/SvelteKit HMR
	if (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/uploads/') ||
		url.pathname.startsWith('/__') ||
		url.pathname.includes('/_app/env') ||
		url.pathname.includes('hot-update')
	) {
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// 1. If it's a precached immutable asset or lazy-cached /img/ screenshot, serve from cache first
			if (PRECACHE_ASSETS.includes(url.pathname) || url.pathname.startsWith('/img/')) {
				const cachedResponse = await cache.match(req);
				if (cachedResponse) return cachedResponse;
			}

			// 2. Network-first strategy with cache fallback
			try {
				const response = await fetch(req);
				if (response && response.status === 200 && response.type === 'basic') {
					cache.put(req, response.clone());
				}
				return response;
			} catch (err) {
				const cachedResponse = await cache.match(req);
				if (cachedResponse) return cachedResponse;

				if (req.headers.get('accept')?.includes('text/html')) {
					const rootCached = await cache.match('/');
					if (rootCached) return rootCached;
				}

				throw err;
			}
		})()
	);
});
