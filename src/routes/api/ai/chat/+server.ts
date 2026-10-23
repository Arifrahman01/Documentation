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

			contextualPrompt = SYSTEM_PROMPT_BASE;
			if (currentRoute) {
				contextualPrompt += `\nLOKASI PENGGUNA SAAT INI DI PORTAL: ${currentRoute}`;
			}
			if (docCtx && docCtx.trim()) {
				contextualPrompt += `\n\n[KONTEKS DOKUMEN AKTIF SAAT INI]:\n"""\n${docCtx.substring(0, 3500)}\n"""`;
			}
			if (relevantKnowledge) {
				contextualPrompt += `\n\n[REFERENSI DOKUMENTASI & APLIKASI INTERNAL PORTAL]:\n${relevantKnowledge}\n\nCatatan Panduan: Gunakan referensi internal di atas jika relevan dengan pertanyaan pengguna. Namun jika pertanyaan pengguna lebih luas (misalnya troubleshooting SAP/SAC/Web, T-Code, arsitektur, rumus, atau kode teknis yang belum tertulis di referensi di atas), tetap jawab secara lengkap, solutif, dan mendalam sesuai keahlian teknis SAP, SAC, dan Web Anda.`;
			} else {
				contextualPrompt += `\n\nCatatan Panduan: Jawab pertanyaan pengguna seputar SAP, SAC, Web, dan sistem enterprise secara lengkap, praktis, dan solutif menggunakan keahlian teknis Anda.`;
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
