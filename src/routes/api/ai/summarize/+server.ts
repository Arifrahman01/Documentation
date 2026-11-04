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

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyAiSession(event);
	if (!authCheck.authorized) return authCheck.response;
	const { request } = event;
	const startMs = performance.now();

	try {
		const body = await request.json();
		const { title, content } = body;
		if (!content) {
			return json({ error: 'Content diperlukan untuk diringkas' }, { status: 400 });
		}

		const cacheKey = `summary_${hashString(`${title || ''}::${content}`)}`;
		const cached = getCache(cacheKey);
		if (cached) {
			recordAiRequestMetric({
				endpoint: 'summarize',
				model: AI_CONFIG.defaultModel,
				cached: true,
				usage: cached.usage,
				completionChars: (cached.message || '').length
			});
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

		const result = await callAiChatWithFallback(messages, AI_CONFIG.defaultModel, 600);
		recordAiRequestMetric({
			endpoint: 'summarize',
			model: result.model,
			cached: false,
			durationMs: performance.now() - startMs,
			usage: result.usage,
			completionChars: result.message.length,
			fallbackUsed: result.fallbackUsed
		});
		setCache(cacheKey, result);
		return json({
			message: result.message,
			reply: result.message,
			usage: result.usage
		});
	} catch (err: any) {
		recordAiRequestMetric({ endpoint: 'summarize', failed: true });
		console.error('AI Summarize Error:', err?.message);
		return json({ error: err?.message }, { status: 500 });
	}
};
