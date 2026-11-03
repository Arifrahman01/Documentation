import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getUserDoc,
	getUserDocStorage,
	buildUserDocTree,
	sanitizeUserName,
	saveUserDoc
} from '$lib/server/userDocs';
import { resolveSessionUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	if (!userName) {
		throw redirect(302, '/my-docs');
	}

	const storage = getUserDocStorage(userName);
	const userSlug = sanitizeUserName(userName);
	const requestedSlug = params.slug || userSlug;

	let doc = getUserDoc(userName, requestedSlug);

	// Jika dokumen yang diminta tidak ada:
	if (!doc) {
		// 1. Jika user memiliki dokumen lain, redirect ke dokumen pertama yang ada
		if (storage.documents.length > 0) {
			throw redirect(302, `/my-docs/${storage.documents[0].slug}`);
		}

		// 2. Jika user tidak memiliki dokumen sama sekali (misal baru saja menghapus halaman selamat datang),
		// buat dokumen kosong baru secara otomatis agar workspace tidak pernah 404
		const newDoc = saveUserDoc(userName, {
			title: 'Catatan Baru',
			content: '# Catatan Baru\n\n*Tuliskan catatan Anda di sini...*',
			category: 'Catatan Harian'
		});
		throw redirect(302, `/my-docs/${newDoc.slug}?mode=edit`);
	}

	const treeData = buildUserDocTree(storage.documents, storage.folders);

	// Navigation: Previous & Next article
	const allDocs = storage.documents;
	const currentIndex = allDocs.findIndex((d) => d.slug === doc!.slug || d.id === doc!.id);
	const prevArticle = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
	const nextArticle = currentIndex < allDocs.length - 1 && currentIndex >= 0 ? allDocs[currentIndex + 1] : null;

	return {
		doc,
		treeData,
		userName,
		allDocsCount: allDocs.length,
		foldersCount: storage.folders.length,
		prevArticle: prevArticle ? { title: prevArticle.title, slug: prevArticle.slug } : null,
		nextArticle: nextArticle ? { title: nextArticle.title, slug: nextArticle.slug } : null
	};
};
