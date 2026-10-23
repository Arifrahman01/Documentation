import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	AI_CONFIG,
	callAiChat,
	getCache,
	setCache,
	hashString,
	retrieveRelevantKnowledge,
	SYSTEM_PROMPT_BASE
} from '$lib/server/ai';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { messages, documentContext, model, currentRoute, query, context, history } = body;

		let messageList = messages;
		if (!messageList && (query || history)) {
			messageList = [
				...(Array.isArray(history) ? history : []),
				...(query ? [{ role: 'user', content: query }] : [])
			];
		}

		if (!messageList || !Array.isArray(messageList) || messageList.length === 0) {
			return json({ error: 'Messages array atau parameter query diperlukan' }, { status: 400 });
		}

		// Extract user query for RAG semantic knowledge retrieval
		const lastUserQuery =
			query || messageList.filter((m: any) => m.role === 'user').pop()?.content || '';
		const relevantKnowledge = retrieveRelevantKnowledge(lastUserQuery);

		let contextualPrompt = SYSTEM_PROMPT_BASE;
		if (currentRoute) {
			contextualPrompt += `\nLOKASI PENGGUNA SAAT INI DI PORTAL: ${currentRoute}`;
		}
		const docCtx = documentContext || context;
		if (docCtx && docCtx.trim()) {
			contextualPrompt += `\n\n[KONTEKS DOKUMEN AKTIF SAAT INI]:\n"""\n${docCtx.substring(0, 3500)}\n"""`;
		}
		if (relevantKnowledge) {
			contextualPrompt += `\n\n${relevantKnowledge}\n\nIngat: Jawab HANYA berdasarkan fakta di atas. Dilarang mengarang fakta di luar dokumen!`;
		}

		const fullMessages = [{ role: 'system', content: contextualPrompt }, ...messageList];

		// Check cache for identical message thread
		const cacheKey = hashString(JSON.stringify(fullMessages));
		const cached = getCache(cacheKey);
		if (cached) {
			return json({ ...cached, cached: true });
		}

		let result: any;
		const chosenModel = model || AI_CONFIG.defaultModel;

		try {
			result = await callAiChat(fullMessages, chosenModel);
		} catch (primaryErr: any) {
			console.warn(
				`Model ${chosenModel} error: ${primaryErr.message}. Mencoba fallback ${AI_CONFIG.fallbackModel}...`
			);
			result = await callAiChat(fullMessages, AI_CONFIG.fallbackModel);
		}

		setCache(cacheKey, result);
		return json({
			message: result.message,
			reply: result.message,
			usage: result.usage
		});
	} catch (err: any) {
		console.error('AI Chat Error:', err?.message);
		return json({ error: err?.message || 'Gagal menghubungi server AI' }, { status: 500 });
	}
};
