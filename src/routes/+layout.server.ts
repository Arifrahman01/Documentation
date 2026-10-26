import type { LayoutServerLoad } from './$types';
import { resolveSessionUser } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const userName = resolveSessionUser(cookies, url);

	return {
		userName
	};
};
