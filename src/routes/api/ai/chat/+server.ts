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

		const docCtx = documentContext || context || '';
		let contextualPrompt = '';

		if (strictDocScope) {
			// STRICT SINGLE-DOCUMENT AI ASSISTANT SCOPE
			const docTitle = docMeta?.title || currentRoute || 'Dokumen Aktif';
			const docSection = docMeta?.section || 'Dokumentasi';
			const docCategory = docMeta?.category || 'Umum';
			const docSlug = docMeta?.slug ? `/docs/${docMeta.slug}` : '';

			contextualPrompt = `Anda adalah "AI Assistant Dokumen", asisten analisis khusus yang HANYA bertugas menjelaskan, merangkum, dan menjawab pertanyaan berdasarkan SATU dokumen/note yang sedang dibuka pengguna.

==================================================
ATURAN LINGKUP DOKUMEN TUNGGAL (STRICT DOCUMENT SCOPE):
==================================================
1. LINGKUP TERKUNCI:
   - Anda HANYA boleh menggunakan informasi yang tertulis di dalam [ISI LENGKAP DOKUMEN AKTIF] di bawah ini.
   - DILARANG mengambil, mencampur, atau mengarang informasi di luar isi dokumen "${docTitle}" ini.
2. JIKA TIDAK ADA DI DOKUMEN INI:
   - Apabila pengguna menanyakan topik yang tidak dibahas di dalam dokumen "${docTitle}", jawab dengan sopan:
     "Topik tersebut tidak dibahas di dalam dokumen **${docTitle}** ini. Silakan gunakan **AI Copilot** di pojok kanan atas jika ingin mencari informasi lintas seluruh dokumen sinkronisasi, note, dan database Helpdesk."
3. GAYA JAWABAN:
   - Gunakan Bahasa Indonesia yang terstruktur, jelas, dan mudah dipahami.
   - Gunakan format Markdown (poin-poin, tabel, bold, atau blok kode sesuai isi dokumen).
   - Jangan pernah menyebutkan nama model AI teknis di balik layar.

[METADATA DOKUMEN AKTIF]:
- Judul: ${docTitle}
- Bagian: ${docSection}
- Kategori: ${docCategory}
${docSlug ? `- Path: ${docSlug}` : ''}

[ISI LENGKAP DOKUMEN AKTIF]:
"""
${docCtx.substring(0, 18000)}
"""`;
		} else {
			// GLOBAL PORTAL CHAT AI COPILOT SCOPE (Restricted to Synced Docs, Notes/Docs in this App, & Helpdesk DB)
			const lastUserQuery =
				query || messageList.filter((m: any) => m.role === 'user').pop()?.content || '';
			const priorHistory = messageList.slice(0, -1);

			// 1. Retrieve chunks from Synced Documents, User Notes (My Docs), and Portal Docs with Multi-Turn Context
			const { knowledgeText, extractedKeywords } = retrieveRelevantKnowledge(
				lastUserQuery,
				priorHistory
			);

			// 2. Retrieve Realtime Helpdesk Database Context (KPIs + Ticket Search by Keywords)
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

			contextualPrompt = SYSTEM_PROMPT_BASE;
			if (currentRoute) {
				contextualPrompt += `\nLOKASI HALAMAN PENGGUNA SAAT INI: ${currentRoute}`;
			}
			if (docCtx && docCtx.trim()) {
				contextualPrompt += `\n\n[KONTEKS HALAMAN / CATATAN YANG SEDANG DIBUKA PENGGUNA]:\n"""\n${docCtx.substring(0, 4500)}\n"""`;
			}
			if (liveDbKnowledge) {
				contextualPrompt += `\n\n[SUMBER DATABASE HELPDESK REALTIME (STATISTIK & TIKET)]:\n${liveDbKnowledge}`;
			}
			if (ticketKeywordKnowledge) {
				contextualPrompt += `\n\n${ticketKeywordKnowledge}`;
			}
			if (knowledgeText) {
				contextualPrompt += `\n\n${knowledgeText}`;
			}

			contextualPrompt += `\n\n==================================================
INSTRUKSI WAJIB SEBELUM MENJAWAB:
1. Jawablah pertanyaan pengguna HANYA berdasarkan data dari:
   - Dokumen Hasil Sinkronisasi Eksternal
   - Isi Note (My Docs) & Dokumentasi di program ini
   - Database Helpdesk (Tiket, Solusi, Modul, & Statistik)
2. Sebutkan sumber rujukan secara jelas (Nama File Dokumen Sinkronisasi, Judul Note, atau Nomor Tiket Helpdesk).
3. Apabila pertanyaan pengguna berada di luar isi dokumen sinkronisasi, isi note program ini, dan database Helpdesk, TOLAK dengan sopan dan jangan mengarang jawaban di luar sumber tersebut.
==================================================`;
		}

		// Keep recent conversation history (up to last 10 messages) so context stays sharp
		const trimmedMessages = messageList.slice(-10);
		const fullMessages = [{ role: 'system', content: contextualPrompt }, ...trimmedMessages];

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
