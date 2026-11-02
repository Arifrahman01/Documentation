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

export const PERMANENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years in seconds (315,360,000s)

/**
 * Sets permanent authentication cookies (10 years) for seamless single sign-on.
 * Shared with Helpdesk and persists across browser restarts.
 */
export function setPermanentUserCookies(cookies: Cookies, userName: string, url?: URL) {
	ensureEnvLoaded();
	const cleanName = (userName || '').trim().replace(/[<>"'`&\x00-\x1f\x7f]/g, '').slice(0, 80);
	if (!cleanName) return;

	const isHttps = url ? url.protocol === 'https:' : process.env.NODE_ENV === 'production';

	// 1. Permanent user_name cookie (readable by frontend & shared across portal/helpdesk)
	cookies.set('user_name', encodeURIComponent(cleanName), {
		path: '/',
		maxAge: PERMANENT_COOKIE_MAX_AGE,
		httpOnly: false,
		sameSite: 'lax',
		secure: isHttps
	});

	// 2. Permanent HMAC signature cookie (if SESSION_SECRET configured)
	const secret = (process.env.SESSION_SECRET || '').trim();
	if (secret) {
		const sig = signUserCookie(cleanName, secret);
		cookies.set('user_sig', sig, {
			path: '/',
			maxAge: PERMANENT_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax',
			secure: isHttps
		});
	}
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
 * Resolves the authenticated session user from cookies (set by Helpdesk / SSO).
 * - Cleans control characters and HTML tags.
 * - Verifies HMAC signature if SESSION_SECRET is configured.
 * - Returns null when no valid session cookie exists.
 */
export function resolveSessionUser(cookies: Cookies, url?: URL): string | null {
	ensureEnvLoaded();
	const raw = cookies.get('user_name') || url?.searchParams.get('user_name') || undefined;

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

	return null;
}

export const AI_SESSION_REQUIRED_MESSAGE =
	'Sesi login tidak ditemukan. Silakan login terlebih dahulu di aplikasi Helpdesk untuk menggunakan fitur AI.';

/**
 * Validates that the user has an active Helpdesk session before using any AI endpoint.
 */
export function verifyAiSession(event: {
	cookies: Cookies;
	url: URL;
}): { authorized: true; userName: string } | { authorized: false; response: Response } {
	const userName = resolveSessionUser(event.cookies, event.url);
	if (!userName) {
		return {
			authorized: false,
			response: json(
				{
					error: AI_SESSION_REQUIRED_MESSAGE,
					message: AI_SESSION_REQUIRED_MESSAGE,
					reply: `🔒 **Akses AI Memerlukan Sesi Login**\n\n${AI_SESSION_REQUIRED_MESSAGE}`,
					requiresLogin: true
				},
				{ status: 401 }
			)
		};
	}

	return { authorized: true, userName };
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
