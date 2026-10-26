import { json, type Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let envLoaded = false;

export function ensureEnvLoaded() {
	if (envLoaded) return;
	envLoaded = true;
	try {
		const envPath = path.resolve(process.cwd(), '.env');
		if (fs.existsSync(envPath)) {
			const content = fs.readFileSync(envPath, 'utf8');
			for (const line of content.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				const eqIdx = trimmed.indexOf('=');
				if (eqIdx === -1) continue;
				const key = trimmed.slice(0, eqIdx).trim();
				let val = trimmed.slice(eqIdx + 1).trim();
				if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
					val = val.slice(1, -1);
				}
				if (process.env[key] === undefined) {
					process.env[key] = val;
				}
			}
		}
	} catch {
		// Ignore .env read errors
	}
}

export function isLocalDev(url?: URL): boolean {
	if (dev) return true;
	if (!url) return false;
	return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function signUserCookie(userName: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(userName).digest('hex');
}

function verifySignature(userName: string, signature: string | undefined, secret: string): boolean {
	if (!signature) return false;
	const expected = signUserCookie(userName, secret);
	try {
		const a = Buffer.from(signature, 'hex');
		const b = Buffer.from(expected, 'hex');
		if (a.length !== b.length) return false;
		return crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

/**
 * Resolves the authenticated session user from cookies.
 * - Cleans control characters and HTML tags.
 * - Verifies HMAC signature if SESSION_SECRET is configured.
 * - Falls back to DEV_FALLBACK_USER ONLY in local development (never in production).
 */
export function resolveSessionUser(cookies: Cookies, url?: URL): string | null {
	ensureEnvLoaded();
	const raw = cookies.get('user_name');

	if (raw) {
		let decoded = raw;
		try {
			decoded = decodeURIComponent(raw);
		} catch {
			decoded = raw;
		}

		const cleanName = decoded
			.replace(/[<>"'`&\x00-\x1f\x7f]/g, '')
			.trim()
			.slice(0, 80);

		if (cleanName) {
			const secret = (process.env.SESSION_SECRET || '').trim();
			if (secret && !isLocalDev(url)) {
				const sig = cookies.get('user_sig');
				if (!verifySignature(cleanName, sig, secret)) {
					return null;
				}
			}
			return cleanName;
		}
	}

	if (isLocalDev(url)) {
		return (process.env.DEV_FALLBACK_USER || 'Arif Rahman').trim();
	}

	return null;
}

/**
 * Validates Origin/CSRF and active session for mutating API endpoints (POST, PUT, DELETE).
 */
export function verifyWriteAccess(event: {
	request: Request;
	cookies: Cookies;
	url: URL;
}): { authorized: true; userName: string } | { authorized: false; response: Response } {
	ensureEnvLoaded();

	// 1. Check Origin header against host / ORIGIN / ALLOWED_ORIGINS to prevent CSRF
	const origin = event.request.headers.get('origin');
	if (origin && !isLocalDev(event.url)) {
		const allowedRaw = process.env.ALLOWED_ORIGINS || 'https://demo2.jhonlingroup.id,http://demo2.jhonlingroup.id';
		const allowedList = allowedRaw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (process.env.ORIGIN) {
			allowedList.push(process.env.ORIGIN.trim());
		}
		const sameOrigin = origin === event.url.origin;
		const inAllowedList = allowedList.includes(origin);

		if (!sameOrigin && !inAllowedList) {
			return {
				authorized: false,
				response: json({ error: 'Akses ditolak: Origin tidak diizinkan (CSRF Protection).' }, { status: 403 })
			};
		}
	}

	// 2. Verify active session user
	const userName = resolveSessionUser(event.cookies, event.url);
	if (!userName) {
		return {
			authorized: false,
			response: json(
				{ error: 'Akses ditolak: Sesi login diperlukan untuk mengubah atau menghapus data.' },
				{ status: 401 }
			)
		};
	}

	return { authorized: true, userName };
}
