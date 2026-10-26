import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	moveUserDoc,
	getUserDocStorage,
	buildUserDocTree
} from '$lib/server/userDocs';
import { verifyWriteAccess } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;
	const { userName } = authCheck;

	try {
		const body = await event.request.json();
		const { id, category, subcategory } = body;

		if (!id || !category) {
			return json({ error: 'ID dokumen dan kategori tujuan harus diisi' }, { status: 400 });
		}

		const result = moveUserDoc(userName, id, category, subcategory);
		if (!result.success || !result.doc) {
			return json({ error: result.error || 'Gagal memindahkan dokumen' }, { status: 404 });
		}

		const storage = getUserDocStorage(userName);
		const treeData = buildUserDocTree(storage.documents, storage.folders);

		return json({
			success: true,
			doc: result.doc,
			treeData
		});
	} catch (e: any) {
		return json({ error: e?.message || 'Gagal memindahkan dokumen' }, { status: 500 });
	}
};
