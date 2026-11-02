import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveSessionUser, setPermanentUserCookies } from '$lib/server/auth';

/**
 * GET: Retrieve active permanent session info
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);
	return json({
		authenticated: Boolean(userName),
		userName: userName || null,
		permanent: true
	});
};

/**
 * POST: Persist or sync permanent user session
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const requestedUser = typeof body?.userName === 'string' ? body.userName.trim() : '';
		const targetUser = requestedUser || resolveSessionUser(cookies, url) || 'Arif Rahman';

		setPermanentUserCookies(cookies, targetUser, url);

		return json({
			success: true,
			userName: targetUser,
			message: 'Session permanen berhasil disimpan'
		});
	} catch (err: any) {
		return json(
			{
				error: err?.message || 'Gagal menyimpan session permanen'
			},
			{ status: 400 }
		);
	}
};
