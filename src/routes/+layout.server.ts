import type { LayoutServerLoad } from './$types';
import { resolveSessionUser, setPermanentUserCookies } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);

	if (userName) {
		// Permanently refresh/extend session cookie to 10 years on every visit
		setPermanentUserCookies(cookies, userName, url);
	}

	return {
		userName
	};
};
