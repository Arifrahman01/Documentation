import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserDocStorage, sanitizeUserName } from '$lib/server/userDocs';

export const load: PageServerLoad = async ({ cookies }) => {
	const raw = cookies.get('user_name');
	let userName = 'Arif Rahman';
	if (raw) {
		try {
			userName = decodeURIComponent(raw);
		} catch {
			userName = raw;
		}
	}

	const storage = getUserDocStorage(userName);
	const firstDoc = storage.documents[0];

	if (firstDoc && firstDoc.slug) {
		throw redirect(302, `/my-docs/${firstDoc.slug}`);
	}

	const userSlug = sanitizeUserName(userName);
	throw redirect(302, `/my-docs/${userSlug}/catatan-harian/selamat-datang`);
};
