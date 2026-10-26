import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const rawName = cookies.get('user_name');
	let userName: string | null = null;

	if (rawName) {
		try {
			userName = decodeURIComponent(rawName);
		} catch {
			userName = rawName;
		}
	}

	// Fallback hardcode untuk lokal jika belum ada cookie
	if (!userName && (dev || url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
		userName = 'Arif Rahman';
	}

	return {
		userName
	};
};
