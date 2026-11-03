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
 * POST: Refresh the permanent cookies of the ALREADY-VERIFIED session user.
 * The identity is never taken from the request body, otherwise any client could
 * mint a (signed) session for an arbitrary user name.
 */
export const POST: RequestHandler = async ({ cookies, url }) => {
	try {
		const targetUser = resolveSessionUser(cookies, url);

		if (!targetUser) {
			return json(
				{
					authenticated: false,
					userName: null,
					error: 'Sesi login tidak ditemukan. Silakan login terlebih dahulu di Helpdesk.'
				},
				{ status: 401 }
			);
		}

		setPermanentUserCookies(cookies, targetUser, url);

		return json({
			success: true,
			authenticated: true,
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
