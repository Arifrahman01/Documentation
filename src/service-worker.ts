/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `docs-pwa-cache-v2-${version}`;

const toUrl = (p: string) => (p.startsWith('/') ? p : `/${p}`);

// ONLY precache the bare minimum offline app shell (~5 files).
// NEVER precache all immutable JS chunks or /img/ upfront during install!
// Pre-caching 80+ files at once floods the reverse proxy (Nginx) and triggers HTTP 503 Rate Limiting.
const PRECACHE_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/favicon.svg',
	'/favicon-32x32.png',
	'/logo.png'
];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then(async (cache) => {
				await Promise.allSettled(
					PRECACHE_ASSETS.map((url) =>
						cache.add(url).catch((err) => console.warn(`[SW] Precache skipped for ${url}:`, err))
					)
				);
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

			// 1. Cache-First for hashed immutable JS/CSS chunks & images (never re-download once cached)
			const isImmutable = url.pathname.startsWith('/_app/immutable/') || url.pathname.startsWith('/img/');
			if (isImmutable) {
				const cachedResponse = await cache.match(req);
				if (cachedResponse) return cachedResponse;
			}

			// 2. Network-first strategy with cache fallback for everything else
			try {
				const response = await fetch(req);
				if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
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
