import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	AI_CONFIG,
	callAiChat,
	getCache,
	setCache,
	hashString,
	retrieveRelevantKnowledge,
	buildSmartActiveDocContext,
	SYSTEM_PROMPT_BASE
} from '$lib/server/ai';
import {
	isDatabaseQueryIntent,
	buildRealtimeDbContext,
	searchRelevantTicketsByKeywords
} from '$lib/server/database';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			messages,
			documentContext,
			model,
			currentRoute,
			query,
			context,
			history,
			strictDocScope,
			docMeta
		} = body;

		let messageList = messages;
		if (!messageList && (query || history)) {
			const histArray = Array.isArray(history) ? history : [];
			const lastHist = histArray[histArray.length - 1];
			if (query && (!lastHist || lastHist.role !== 'user' || lastHist.content !== query)) {
				messageList = [...histArray, { role: 'user', content: query }];
			} else {
				messageList = [...histArray];
			}
		}

		if (!messageList || !Array.isArray(messageList) || messageList.length === 0) {
			return json({ error: 'Messages array atau parameter query diperlukan' }, { status: 400 });
		}

		const lastUserQuery =
			query || messageList.filter((m: any) => m.role === 'user').pop()?.content || '';
		const priorHistory = messageList.slice(0, -1);
		const isFollowUpTurn = priorHistory.length >= 2;
		const docCtx = documentContext || context || '';
		let contextualPrompt = '';

		if (strictDocScope) {
			// STRICT SINGLE-DOCUMENT AI ASSISTANT SCOPE (Token-Efficient Delta Windowing on Follow-up Turns)
			const docTitle = docMeta?.title || currentRoute || 'Dokumen Aktif';
			const docSection = docMeta?.section || 'Dokumentasi';
			const docCategory = docMeta?.category || 'Umum';
			const docSlug = docMeta?.slug ? `/docs/${docMeta.slug}` : '';

			// Turn 1: up to 14,000 chars. Turn 2+ (Follow-up): Outline + 3,200 chars of targeted delta segments!
			const smartDocBody = buildSmartActiveDocContext(
				docCtx,
				lastUserQuery,
				14000,
				isFollowUpTurn
			);

			contextualPrompt = `Anda adalah "AI Assistant Dokumen", asisten analisis khusus yang HANYA bertugas menjelaskan, merangkum, dan menjawab pertanyaan berdasarkan SATU dokumen/note yang sedang dibuka pengguna.

ATURAN LINGKUP DOKUMEN TUNGGAL (STRICT DOCUMENT SCOPE):
1. Anda HANYA boleh menggunakan informasi dari dokumen "${docTitle}" di bawah ini serta riwayat obrolan sebelumnya pada dokumen ini.
2. Apabila pengguna menanyakan topik di luar dokumen "${docTitle}", jawab dengan sopan:
   "Topik tersebut tidak dibahas di dalam dokumen **${docTitle}** ini. Silakan gunakan **AI Copilot** di pojok kanan atas jika ingin mencari informasi lintas seluruh dokumen sinkronisasi, note, dan database Helpdesk."
3. Gunakan Bahasa Indonesia dengan format Markdown yang rapi dan jangan menyebutkan nama model AI teknis di balik layar.

[METADATA DOKUMEN AKTIF]:
- Judul: ${docTitle} | Bagian: ${docSection} | Kategori: ${docCategory}${docSlug ? ` | Path: ${docSlug}` : ''}

[KONTEKS DOKUMEN AKTIF (${isFollowUpTurn ? 'Peta Struktur + Kutipan Bab Terkait Pertanyaan Lanjutan' : 'Isi Dokumen'})]:
"""
${smartDocBody}
"""`;
		} else {
			// GLOBAL PORTAL CHAT AI COPILOT SCOPE
			// 1. Retrieve Pre-Digested Cards + Targeted Chunks from In-Memory Inverted Index (0ms disk read)
			const { knowledgeText, extractedKeywords } = retrieveRelevantKnowledge(
				lastUserQuery,
				priorHistory,
				currentRoute
			);

			// 2. Retrieve Realtime Helpdesk Database Context only when relevant
			let liveDbKnowledge = '';
			let ticketKeywordKnowledge = '';

			const combinedRecentText = [
				lastUserQuery,
				...priorHistory
					.filter((m: any) => m.role === 'user')
					.slice(-2)
					.map((m: any) => m.content)
			].join(' ');

			const hasDbIntent = isDatabaseQueryIntent(combinedRecentText);
			if (hasDbIntent) {
				try {
					liveDbKnowledge = await buildRealtimeDbContext(lastUserQuery || combinedRecentText);
				} catch (_) {}
			}

			if (extractedKeywords.length > 0) {
				try {
					ticketKeywordKnowledge = await searchRelevantTicketsByKeywords(extractedKeywords);
				} catch (_) {}
			}

			// KV-Cache Friendly Ordering: Static System Prompt at the very top
			contextualPrompt = SYSTEM_PROMPT_BASE;
			if (currentRoute) {
				contextualPrompt += `\nLOKASI HALAMAN AKTIF: ${currentRoute}`;
			}
			if (docCtx && docCtx.trim()) {
				// On Turn 1: max 4,500 chars; on Turn 2+ (Follow-up): Outline + 2,000 chars targeted delta!
				const smartPageContext = buildSmartActiveDocContext(
					docCtx,
					lastUserQuery,
					4500,
					isFollowUpTurn
				);
				contextualPrompt += `\n\n[KONTEKS HALAMAN YANG SEDANG DIBUKA PENGGUNA]:\n"""\n${smartPageContext}\n"""`;
			}
			if (liveDbKnowledge) {
				contextualPrompt += `\n\n[SUMBER DATABASE HELPDESK REALTIME]:\n${liveDbKnowledge}`;
			}
			if (ticketKeywordKnowledge) {
				contextualPrompt += `\n\n${ticketKeywordKnowledge}`;
			}
			if (knowledgeText) {
				contextualPrompt += `\n\n${knowledgeText}`;
			}
		}

		// Keep recent conversation history (last 8 messages = 4 turns) with compact assistant history
		const trimmedMessages = messageList.slice(-8).map((m: any, idx: number, arr: any[]) => {
			// Compress older assistant replies (>2 turns ago) if they are very long to save tokens while preserving facts
			if (m.role === 'assistant' && idx < arr.length - 3 && typeof m.content === 'string' && m.content.length > 900) {
				return {
					role: 'assistant',
					content: m.content.slice(0, 850) + '\n...[ringkasan jawaban sebelumnya dipertahankan]...'
				};
			}
			return { role: m.role, content: m.content };
		});

		const fullMessages = [{ role: 'system', content: contextualPrompt }, ...trimmedMessages];

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
