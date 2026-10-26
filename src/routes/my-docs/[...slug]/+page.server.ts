import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getUserDoc,
	getUserDocStorage,
	buildUserDocTree,
	sanitizeUserName
} from '$lib/server/userDocs';
import { resolveSessionUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	if (!userName) {
		throw error(401, 'Sesi pengguna tidak ditemukan. Silakan login melalui portal utama terlebih dahulu.');
	}

	const storage = getUserDocStorage(userName);
	const userSlug = sanitizeUserName(userName);
	const requestedSlug = params.slug || `${userSlug}/catatan-harian/selamat-datang`;

	let doc = getUserDoc(userName, requestedSlug);

	if (!doc && storage.documents.length > 0) {
		doc = storage.documents[0];
	}

	if (!doc) {
		throw error(404, `Dokumen '${requestedSlug}' tidak ditemukan`);
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
