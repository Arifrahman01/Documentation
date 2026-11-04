import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkAiHealth, evaluateRetrievalBenchmark } from '$lib/server/ai';

export const GET: RequestHandler = async ({ url }) => {
	const health = await checkAiHealth();
	const includeBenchmark = url.searchParams.get('benchmark') === '1';
	return json(
		includeBenchmark ? { ...health, benchmark: evaluateRetrievalBenchmark() } : health,
		{ status: health.status === 'online' ? 200 : 503 }
	);
};
