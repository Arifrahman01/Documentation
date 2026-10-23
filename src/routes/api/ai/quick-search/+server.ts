import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AI_CONFIG, callAiChat, getCache, setCache, hashString } from '$lib/server/ai';

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') || '').trim();
	if (!query || query.length < 2) {
		return json({ error: 'Parameter query q diperlukan' }, { status: 400 });
	}

	const cacheKey = `search_${hashString(query.toLowerCase())}`;
	const cached = getCache(cacheKey);
	if (cached) {
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
		const result = await callAiChat(messages, AI_CONFIG.defaultModel, 250);
		setCache(cacheKey, result, 60 * 60 * 1000);
		return json(result);
	} catch (err: any) {
		return json({ error: err?.message }, { status: 500 });
	}
};
