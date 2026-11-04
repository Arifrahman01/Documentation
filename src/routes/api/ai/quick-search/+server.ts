import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	AI_CONFIG,
	callAiChatWithFallback,
	getCache,
	setCache,
	hashString,
	recordAiRequestMetric
} from '$lib/server/ai';
import { verifyAiSession } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const authCheck = verifyAiSession(event);
	if (!authCheck.authorized) return authCheck.response;
	const { url } = event;
	const startMs = performance.now();

	const query = (url.searchParams.get('q') || '').trim();
	if (!query || query.length < 2) {
		return json({ error: 'Parameter query q diperlukan' }, { status: 400 });
	}

	const cacheKey = `search_${hashString(query.toLowerCase())}`;
	const cached = getCache(cacheKey);
	if (cached) {
		recordAiRequestMetric({
			endpoint: 'quick-search',
			model: AI_CONFIG.defaultModel,
			cached: true,
			usage: cached.usage
		});
		return json(cached);
	}

	const messages = [
		{
			role: 'system',
			content:
				'Anda adalah navigator pintar untuk Documentation Portal. Berikan rekomendasi singkat 1-2 kalimat kepada pengguna untuk query mereka, sebutkan aplikasi atau topik dokumentasi yang relevan.'
		},
		{
			role: 'user',
			content: `Pencarian pengguna: "${query}"`
		}
	];

	try {
		const result = await callAiChatWithFallback(messages, AI_CONFIG.defaultModel, 250);
		recordAiRequestMetric({
			endpoint: 'quick-search',
			model: result.model,
			cached: false,
			durationMs: performance.now() - startMs,
			usage: result.usage,
			completionChars: result.message.length,
			fallbackUsed: result.fallbackUsed
		});
		setCache(cacheKey, result, 60 * 60 * 1000);
		return json(result);
	} catch (err: any) {
		recordAiRequestMetric({ endpoint: 'quick-search', failed: true });
		return json({ error: err?.message }, { status: 500 });
	}
};
