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
	generateSmartQueryForQuestion,
	executeSafeQuery
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
			messageList = [
				...(Array.isArray(history) ? history : []),
				...(query ? [{ role: 'user', content: query }] : [])
			];
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

			contextualPrompt = `Anda adalah "AI Assistant Dokumen", asisten analisis khusus yang HANYA bertugas menjelaskan, merangkum, dan menjawab pertanyaan berdasarkan SATU dokumen yang sedang dibuka pengguna.

==================================================
ATURAN LINGKUP DOKUMEN TUNGGAL (STRICT DOCUMENT SCOPE):
==================================================
1. LINGKUP TERKUNCI:
   - Anda HANYA boleh menggunakan informasi yang tertulis di dalam [ISI LENGKAP DOKUMEN AKTIF] di bawah ini.
   - DILARANG mengambil, mencampur, atau mengarang informasi di luar isi dokumen "${docTitle}" ini.
2. JIKA TIDAK ADA DI DOKUMEN INI:
   - Apabila pengguna menanyakan topik yang tidak dibahas di dalam dokumen "${docTitle}", jawab dengan sopan:
     "Topik tersebut tidak dibahas di dalam dokumen **${docTitle}** ini. Silakan gunakan **Chat AI Copilot (Global)** di pojok kanan atas jika ingin mencari informasi lintas seluruh dokumen portal."
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
${docCtx.substring(0, 12000)}
"""`;
		} else {
			// GLOBAL PORTAL CHAT AI COPILOT SCOPE
			const lastUserQuery =
				query || messageList.filter((m: any) => m.role === 'user').pop()?.content || '';
			const relevantKnowledge = retrieveRelevantKnowledge(lastUserQuery);

			// Realtime Database Query Integration (Metode 2)
			let liveDbKnowledge = '';
			if (isDatabaseQueryIntent(lastUserQuery)) {
				const autoSql = generateSmartQueryForQuestion(lastUserQuery);
				if (autoSql) {
					try {
						const dbRes = await executeSafeQuery(autoSql);
						if (dbRes.success && dbRes.rows.length > 0) {
							liveDbKnowledge = `\n\n[DATA REALTIME DATABASE HELPDESK MYSQL (Query: ${dbRes.sql})]:\n${JSON.stringify(dbRes.rows, null, 2).slice(0, 3000)}\n\nInstruksi Penting: Gunakan data realtime database di atas untuk menjawab statistik atau status tiket pengguna secara akurat, faktual, dan ramah.`;
						}
					} catch (_) {}
				}
			}

			contextualPrompt = SYSTEM_PROMPT_BASE;
			if (currentRoute) {
				contextualPrompt += `\nLOKASI PENGGUNA SAAT INI DI PORTAL: ${currentRoute}`;
			}
			if (docCtx && docCtx.trim()) {
				contextualPrompt += `\n\n[KONTEKS DOKUMEN AKTIF SAAT INI]:\n"""\n${docCtx.substring(0, 3500)}\n"""`;
			}
			if (liveDbKnowledge) {
				contextualPrompt += liveDbKnowledge;
			}
			if (relevantKnowledge) {
				contextualPrompt += `\n\n[REFERENSI DOKUMENTASI & PANDUAN MODUL KNOWLEDGE BASE HELPDESK]:\n${relevantKnowledge}\n\nInstruksi Integrasi Helpdesk: Pengguna memandang portal dokumentasi ini sebagai satu kesatuan resmi dari sistem Helpdesk. Rujuk panduan modul dan solusi di atas untuk membantu menjawab kendala atau tiket pengguna.`;
			} else if (!liveDbKnowledge) {
				contextualPrompt += `\n\nInstruksi Integrasi Helpdesk: Posisikan jawaban Anda sebagai Technical Support Helpdesk ahli. Jawab pertanyaan pengguna seputar kendala sistem, tiket, panduan modul SAP/SAC/Web, maupun arsitektur sistem secara solutif, aplikatif, dan terstruktur.`;
			}
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
