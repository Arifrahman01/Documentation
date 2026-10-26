import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserDocStorage, sanitizeUserName } from '$lib/server/userDocs';
import { resolveSessionUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	if (!userName) {
		throw error(401, 'Sesi pengguna tidak ditemukan. Silakan login melalui portal utama terlebih dahulu.');
	}

	const storage = getUserDocStorage(userName);
	const firstDoc = storage.documents[0];

	if (firstDoc && firstDoc.slug) {
		throw redirect(302, `/my-docs/${firstDoc.slug}`);
	}

	const userSlug = sanitizeUserName(userName);
	throw redirect(302, `/my-docs/${userSlug}/catatan-harian/selamat-datang`);
};
