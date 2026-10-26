import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserDoc,
	saveUserDoc,
	deleteUserDoc,
	getUserDocStorage,
	buildUserDocTree
} from '$lib/server/userDocs';
import { resolveSessionUser, verifyWriteAccess } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	if (!userName) {
		return json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
	}

	const doc = getUserDoc(userName, params.id);

	if (!doc) {
		return json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
	}

	return json(doc);
};

export const PUT: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { userName } = authCheck;

	try {
		const body = await event.request.json();
		const updatedDoc = saveUserDoc(userName, {
			...body,
			id: event.params.id,
			slug: body.slug || event.params.id
		});

		const storage = getUserDocStorage(userName);
		const treeData = buildUserDocTree(storage.documents, storage.folders);

		return json({
			success: true,
			doc: updatedDoc,
			treeData
		});
	} catch (e: any) {
		return json({ error: e?.message || 'Gagal memperbarui dokumen' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { userName } = authCheck;

	const success = deleteUserDoc(userName, event.params.id);

	if (!success) {
		return json({ error: 'Dokumen tidak ditemukan untuk dihapus' }, { status: 404 });
	}

	const storage = getUserDocStorage(userName);
	const treeData = buildUserDocTree(storage.documents, storage.folders);

	return json({
		success: true,
		treeData
	});
};
