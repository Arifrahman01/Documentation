import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	isAllowedAiModel,
	resolveAllowedModel,
	callAiChatWithFallback,
	callAiChatStreamWithFallback,
	getCache,
	setCache,
	hashString,
	retrieveRelevantKnowledge,
	filterSourcesUsedInReply,
	buildSmartActiveDocContext,
	compressAssistantHistoryMessage,
	recordAiRequestMetric,
	SYSTEM_PROMPT_BASE,
	type AiSourceLink
} from '$lib/server/ai';
import {
	isDatabaseQueryIntent,
	buildRealtimeDbContext,
	searchRelevantTicketsByKeywords
} from '$lib/server/database';
import { verifyAiSession } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyAiSession(event);
	if (!authCheck.authorized) return authCheck.response;
	const { request } = event;
	const requestStartMs = performance.now();

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
			docMeta,
			stream
		} = body;

		// Keamanan: Batasi pilihan model hanya ke daftar model yang diizinkan di server
		if (model !== undefined && model !== null && String(model).trim() !== '' && !isAllowedAiModel(model)) {
			return json(
				{
					error: `Model AI '${String(model)}' tidak diizinkan oleh server.`
				},
				{ status: 400 }
			);
		}
		const chosenModel = resolveAllowedModel(model);

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
		let matchedSources: AiSourceLink[] = [];
		let hasDbIntent = false;

		if (strictDocScope) {
			// STRICT SINGLE-DOCUMENT AI ASSISTANT SCOPE (Token-Efficient Delta Windowing on Follow-up Turns)
			const docTitle = docMeta?.title || currentRoute || 'Dokumen Aktif';
			const docSection = docMeta?.section || 'Dokumentasi';
			const docCategory = docMeta?.category || 'Umum';
			const isMyDocs = docSection.toLowerCase().includes('my docs');
			const docSlug = docMeta?.slug
				? isMyDocs
					? `/my-docs/${docMeta.slug}`
					: `/docs/${docMeta.slug}`
				: '';

			if (docSlug) {
				matchedSources = [
					{
						title: docTitle,
						url: docSlug,
						category: docCategory,
						type: isMyDocs ? 'USER_NOTE' : 'PORTAL_DOC',
						badge: isMyDocs ? 'My Docs' : 'Dokumentasi'
					}
				];
			}

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
			// 1. Retrieve Pre-Digested Cards + Targeted Chunks via Hybrid BM25 + Semantic Embedding (0ms disk read)
			const { knowledgeText, extractedKeywords, sources } = retrieveRelevantKnowledge(
				lastUserQuery,
				priorHistory,
				currentRoute,
				authCheck.userName
			);
			matchedSources = sources;

			// 2. Retrieve Realtime Helpdesk Database Context ONLY when query genuinely asks about Helpdesk/Tickets
			let liveDbKnowledge = '';
			let ticketKeywordKnowledge = '';

			const qLower = lastUserQuery.toLowerCase().trim();
			const wordCount = qLower.split(/\s+/).filter(Boolean).length;
			const prevUserMsg =
				priorHistory
					.filter((m: any) => m.role === 'user')
					.pop()?.content || '';

			hasDbIntent =
				isDatabaseQueryIntent(lastUserQuery) ||
				(wordCount <= 6 &&
					!/\b(dokumen|document|note|catatan|panduan|manual)\b/i.test(qLower) &&
					isDatabaseQueryIntent(prevUserMsg));

			const hasExplicitTroubleshooting =
				hasDbIntent ||
				/\b(error|gagal|bug|issue|tidak\s+bisa|solusi\s+tiket|kendala\s+tiket)\b/i.test(qLower);

			if (hasDbIntent) {
				try {
					liveDbKnowledge = await buildRealtimeDbContext(
						isDatabaseQueryIntent(lastUserQuery)
							? lastUserQuery
							: `${prevUserMsg} ${lastUserQuery}`
					);
				} catch (_) {}
			}

			// Hanya cari riwayat tiket jika user bertanya soal tiket/error atau jika tidak ada dokumen yang cocok
			if (
				extractedKeywords.length > 0 &&
				(hasExplicitTroubleshooting || matchedSources.length === 0)
			) {
				try {
					ticketKeywordKnowledge = await searchRelevantTicketsByKeywords(extractedKeywords);
				} catch (_) {}
			}

			const refersToCurrentPage =
				[
					'dokumen ini',
					'halaman ini',
					'catatan ini',
					'note ini',
					'artikel ini',
					'modul ini',
					'rangkum ini',
					'jelaskan ini'
				].some((phrase) => qLower.includes(phrase)) ||
				(!hasDbIntent && matchedSources.length === 0 && Boolean(docCtx && docCtx.trim()));

			contextualPrompt = SYSTEM_PROMPT_BASE;
			if (currentRoute) {
				contextualPrompt += `\nLOKASI HALAMAN AKTIF: ${currentRoute}`;
			}
			if (refersToCurrentPage && docCtx && docCtx.trim()) {
				const smartPageContext = buildSmartActiveDocContext(
					docCtx,
					lastUserQuery,
					3200,
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

		// Kompres pesan asisten yang lama (>2 giliran lalu) secara cerdas tanpa membuang Sumber Referensi atau fakta kunci di akhir
		const trimmedMessages = messageList.slice(-8).map((m: any, idx: number, arr: any[]) => {
			if (
				m.role === 'assistant' &&
				idx < arr.length - 3 &&
				typeof m.content === 'string' &&
				m.content.length > 1350
			) {
				return {
					role: 'assistant',
					content: compressAssistantHistoryMessage(m.content, 1350)
				};
			}
			return { role: m.role, content: m.content };
		});

		const fullMessages = [{ role: 'system', content: contextualPrompt }, ...trimmedMessages];
		const promptChars = fullMessages.reduce(
			(sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
			0
		);

		const cacheKey = hashString(`${authCheck.userName || 'anon'}:${chosenModel}:${JSON.stringify(fullMessages)}`);
		const cached = getCache(cacheKey);
		const wantsStream =
			Boolean(stream) || (request.headers.get('accept') || '').includes('text/event-stream');

		if (cached) {
			const cachedReply = cached.reply || cached.message || '';
			const filteredCachedSources = strictDocScope
				? cached.sources || matchedSources
				: filterSourcesUsedInReply(cached.sources || matchedSources, cachedReply, hasDbIntent);

			recordAiRequestMetric({
				endpoint: 'chat',
				model: chosenModel,
				cached: true,
				usage: cached.usage,
				promptChars,
				completionChars: cachedReply.length
			});

			if (wantsStream) {
				const encoder = new TextEncoder();
				const cachedStream = new ReadableStream({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ type: 'delta', content: cachedReply })}\n\n`
							)
						);
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'done',
									reply: cachedReply,
									sources: filteredCachedSources,
									cached: true,
									usage: cached.usage,
									responseTimeMs: Math.round((performance.now() - requestStartMs) * 100) / 100
								})}\n\n`
							)
						);
						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					}
				});

				return new Response(cachedStream, {
					headers: {
						'Content-Type': 'text/event-stream; charset=utf-8',
						'Cache-Control': 'no-cache, no-transform',
						Connection: 'keep-alive',
						'X-Accel-Buffering': 'no'
					}
				});
			}

			return json({
				...cached,
				sources: filteredCachedSources,
				cached: true
			});
		}

		// Mode Streaming (SSE) untuk UX instan tanpa menunggu seluruh jawaban selesai
		if (wantsStream) {
			const encoder = new TextEncoder();
			const readable = new ReadableStream({
				async start(controller) {
					try {
						const result = await callAiChatStreamWithFallback(fullMessages, {
							model: chosenModel,
							signal: request.signal,
							onDelta: (deltaText) => {
								try {
									controller.enqueue(
										encoder.encode(
											`data: ${JSON.stringify({ type: 'delta', content: deltaText })}\n\n`
										)
									);
								} catch {
									// Stream closed by client
								}
							}
						});

						const durationMs = performance.now() - requestStartMs;
						const finalSources = strictDocScope
							? matchedSources
							: filterSourcesUsedInReply(matchedSources, result.message, hasDbIntent);

						const responsePayload = {
							message: result.message,
							reply: result.message,
							sources: finalSources,
							usage: result.usage,
							model: result.model
						};
						setCache(cacheKey, responsePayload);

						recordAiRequestMetric({
							endpoint: 'chat',
							model: result.model,
							cached: false,
							durationMs,
							usage: result.usage,
							promptChars,
							completionChars: result.message.length,
							fallbackUsed: result.fallbackUsed
						});

						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'done',
									reply: result.message,
									sources: finalSources,
									usage: result.usage,
									model: result.model,
									responseTimeMs: Math.round(durationMs * 100) / 100
								})}\n\n`
							)
						);
						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						controller.close();
					} catch (streamErr: any) {
						recordAiRequestMetric({ endpoint: 'chat', model: chosenModel, failed: true });
						try {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({
										type: 'error',
										error: streamErr?.message || 'Gagal menghubungi server AI'
									})}\n\n`
								)
							);
							controller.close();
						} catch {
							// Ignore if already closed
						}
					}
				}
			});

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream; charset=utf-8',
					'Cache-Control': 'no-cache, no-transform',
					Connection: 'keep-alive',
					'X-Accel-Buffering': 'no'
				}
			});
		}

		// Mode JSON Standar (tetap menggunakan smart fallback yang tidak mengulang error 4xx/timeout)
		const result = await callAiChatWithFallback(fullMessages, chosenModel);
		const durationMs = performance.now() - requestStartMs;

		const finalSources = strictDocScope
			? matchedSources
			: filterSourcesUsedInReply(matchedSources, result.message, hasDbIntent);

		const responsePayload = {
			message: result.message,
			reply: result.message,
			sources: finalSources,
			usage: result.usage,
			model: result.model,
			responseTimeMs: Math.round(durationMs * 100) / 100
		};
		setCache(cacheKey, responsePayload);

		recordAiRequestMetric({
			endpoint: 'chat',
			model: result.model,
			cached: false,
			durationMs,
			usage: result.usage,
			promptChars,
			completionChars: result.message.length,
			fallbackUsed: result.fallbackUsed
		});

		return json(responsePayload);
	} catch (err: any) {
		recordAiRequestMetric({ endpoint: 'chat', failed: true });
		console.error('AI Chat Error:', err?.message);
		return json({ error: err?.message || 'Gagal menghubungi server AI' }, { status: 500 });
	}
};
