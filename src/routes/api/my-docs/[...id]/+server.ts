import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserDoc,
	saveUserDoc,
	deleteUserDoc,
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

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userName = resolveUserName(cookies);
	const doc = getUserDoc(userName, params.id);

	if (!doc) {
		return json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
	}

	return json(doc);
};

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	const userName = resolveUserName(cookies);
	try {
		const body = await request.json();
		const updatedDoc = saveUserDoc(userName, {
			...body,
			id: params.id,
			slug: body.slug || params.id
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

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userName = resolveUserName(cookies);
	const success = deleteUserDoc(userName, params.id);

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
