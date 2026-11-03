import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserDocStorage, saveUserDoc } from '$lib/server/userDocs';
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
	let firstDoc = storage.documents[0];

	// Jika user menghapus semua catatan (termasuk halaman selamat datang),
	// otomatis inisialisasi catatan baru agar tidak 404
	if (!firstDoc) {
		firstDoc = saveUserDoc(userName, {
			title: 'Catatan Baru',
			content: '# Catatan Baru\n\n*Tuliskan catatan Anda di sini...*',
			category: 'Catatan Harian'
		});
	}

	throw redirect(302, `/my-docs/${firstDoc.slug}`);
};
