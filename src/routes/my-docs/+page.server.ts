import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserDocStorage, sanitizeUserName } from '$lib/server/userDocs';
import { resolveSessionUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	if (!userName) {
		return {
			authenticated: false,
			userName: null
		};
	}

	const storage = getUserDocStorage(userName);
	const firstDoc = storage.documents[0];

	if (firstDoc && firstDoc.slug) {
		throw redirect(302, `/my-docs/${firstDoc.slug}`);
	}

	const userSlug = sanitizeUserName(userName);
	throw redirect(302, `/my-docs/${userSlug}/catatan-harian/selamat-datang`);
};
