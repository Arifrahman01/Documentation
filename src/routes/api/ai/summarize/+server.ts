import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AI_CONFIG, callAiChat, getCache, setCache, hashString } from '$lib/server/ai';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { title, content } = body;
		if (!content) {
			return json({ error: 'Content diperlukan untuk diringkas' }, { status: 400 });
		}

		const cacheKey = `summary_${hashString(title + content.slice(0, 500))}`;
		const cached = getCache(cacheKey);
		if (cached) {
			return json({ ...cached, cached: true });
		}

		const messages = [
			{
				role: 'system',
				content:
					'Anda adalah asisten perangkum teknis untuk Documentation Portal. Buatlah ringkasan eksekutif dokumen teknis ini dalam 3-4 butir poin kunci yang padat, terstruktur rapi, dan aplikatif dalam Bahasa Indonesia. Format tiap butir dengan judul bold diawali tanda strip.'
			},
			{
				role: 'user',
				content: `Judul Dokumen: ${title || 'Dokumen Teknis'}\n\nIsi Dokumen:\n${content.substring(0, 4500)}`
			}
		];

		const result = await callAiChat(messages, AI_CONFIG.defaultModel, 600);
		setCache(cacheKey, result);
		return json({
			message: result.message,
			reply: result.message,
			usage: result.usage
		});
	} catch (err: any) {
		console.error('AI Summarize Error:', err?.message);
		return json({ error: err?.message }, { status: 500 });
	}
};
