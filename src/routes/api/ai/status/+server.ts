import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkAiHealth } from '$lib/server/ai';

export const GET: RequestHandler = async () => {
	const health = await checkAiHealth();
	return json(health, { status: health.status === 'online' ? 200 : 503 });
};
