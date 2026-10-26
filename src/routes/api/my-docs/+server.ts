import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUserDocStorage,
	saveUserDoc,
	addUserFolder,
	deleteUserFolder,
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
	// Fallback lokal default ke 'Arif Rahman'
	return 'Arif Rahman';
}

export const GET: RequestHandler = async ({ cookies }) => {
	const userName = resolveUserName(cookies);
	const storage = getUserDocStorage(userName);
	const treeData = buildUserDocTree(storage.documents, storage.folders);

	return json({
		userName,
		documents: storage.documents,
		folders: storage.folders,
		treeData,
		stats: {
			total: storage.documents.length,
			categories: storage.folders.length
		}
	});
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const userName = resolveUserName(cookies);
	try {
		const body = await request.json();

		// Action: Add new category/folder
		if (body.action === 'add-folder') {
			const { category, subcategory } = body;
			if (!category) {
				return json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
			}
			const success = addUserFolder(userName, category, subcategory);
			const storage = getUserDocStorage(userName);
			const treeData = buildUserDocTree(storage.documents, storage.folders);
			return json({ success, treeData });
		}

		// Action: Delete category/folder
		if (body.action === 'delete-folder') {
			const { category, subcategory } = body;
			if (!category) {
				return json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
			}
			const success = deleteUserFolder(userName, category, subcategory);
			const storage = getUserDocStorage(userName);
			const treeData = buildUserDocTree(storage.documents, storage.folders);
			return json({ success, treeData });
		}

		// Action: Create new document
		const { title, category, subcategory, content, description, tags } = body;
		if (!title) {
			return json({ error: 'Judul dokumen wajib diisi' }, { status: 400 });
		}

		const newDoc = saveUserDoc(userName, {
			title,
			category: category || 'Catatan Harian',
			subcategory,
			content: content || `# ${title}\n\n`,
			description,
			tags: Array.isArray(tags) ? tags : ['Pribadi']
		});

		const storage = getUserDocStorage(userName);
		const treeData = buildUserDocTree(storage.documents, storage.folders);

		return json({
			success: true,
			doc: newDoc,
			treeData
		}, { status: 201 });
	} catch (e: any) {
		return json({ error: e?.message || 'Gagal menyimpan dokumen' }, { status: 500 });
	}
};
