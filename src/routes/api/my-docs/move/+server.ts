import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	moveUserDoc,
	getUserDocStorage,
	buildUserDocTree
} from '$lib/server/userDocs';

function resolveUserName(cookies: any): string {
	const raw = cookies.get('user_name');
	if (raw) {
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	return 'Arif Rahman';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userName = resolveUserName(cookies);
	try {
		const body = await request.json();
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
