import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
	isAllowedAiModel,
	resolveAllowedModel,
	AI_CONFIG,
	AiGatewayError,
	shouldRetryWithFallback,
	stemWord,
	computeSemanticEmbedding,
	cosineSimilarity,
	compressAssistantHistoryMessage,
	synthesizeMultiSectionDocSummary,
	retrieveRelevantKnowledge,
	evaluateRetrievalBenchmark,
	getSearchIndices,
	recordAiRequestMetric,
	getAiMetrics,
	resetAiMetrics,
	callAiChatStream
} from '../src/lib/server/ai.ts';

test('Security #2: Server-side model allowlist blocks arbitrary browser models', () => {
	assert.equal(isAllowedAiModel(AI_CONFIG.defaultModel), true);
	assert.equal(isAllowedAiModel('gemini-3.8-flash'), true);
	assert.equal(isAllowedAiModel('gpt-4-uncensored-arbitrary'), false);
	assert.equal(isAllowedAiModel('../../etc/passwd'), false);
	assert.equal(resolveAllowedModel('evil-model'), AI_CONFIG.defaultModel);
	assert.equal(resolveAllowedModel('gemini-3.8-flash'), 'gemini-3.8-flash');
});

test('Quality #3a: Indonesian & English stemmer normalizes morphological variants', () => {
	assert.equal(stemWord('pembayaran'), 'bayar');
	assert.equal(stemWord('membayar'), 'bayar');
	assert.equal(stemWord('dibayarkan'), 'bayar');
	assert.equal(stemWord('pemeliharaan'), 'pelihara');
	assert.equal(stemWord('pengiriman'), 'kirim');
	assert.equal(stemWord('penjualan'), 'jual');
	assert.equal(stemWord('pembelian'), 'beli');
	assert.equal(stemWord('perhitungan'), 'hitung');
	assert.equal(stemWord('payments'), 'pay');
	assert.equal(stemWord('payable'), 'pay');
	assert.equal(stemWord('suppliers'), 'supplier');
});

test('Quality #3b: Cross-lingual semantic embedding bridges Indonesian & English ("cara bayar vendor" <-> "Vendor Payment")', () => {
	const idVec = computeSemanticEmbedding('cara bayar vendor dan tagihan pemasok');
	const enMatchVec = computeSemanticEmbedding('Vendor Payment & Accounts Payable Invoice Clearing');
	const unrelatedVec = computeSemanticEmbedding('Fleet Docking & Marine Tugboat Machinery Maintenance');

	const simMatch = cosineSimilarity(idVec, enMatchVec);
	const simUnrelated = cosineSimilarity(idVec, unrelatedVec);

	assert.ok(
		simMatch > 0.55,
		`Expected high cross-lingual cosine similarity (>0.55), got ${simMatch.toFixed(3)}`
	);
	assert.ok(
		simMatch > simUnrelated + 0.4,
		`Expected matching concept similarity (${simMatch.toFixed(3)}) >> unrelated (${simUnrelated.toFixed(3)})`
	);
});

test('Quality #3c: Hybrid BM25 + Embedding retrieval finds English "AP & AR Highlight / Vendor Payment" for "cara bayar vendor"', () => {
	const res = retrieveRelevantKnowledge('cara bayar vendor', [], '', 'Arif Rahman');
	assert.equal(res.hasMatches, true);
	assert.ok(res.sources.length > 0, 'Should return relevant document sources');
	const topUrls = res.sources.map((s) => s.url);
	assert.ok(
		topUrls.some(
			(u) =>
				u.includes('finance-ap-ar-highlight') ||
				u.includes('ext_88fa63a42bfc') ||
				u.includes('ext_87c7be60b7c4')
		),
		`Expected AP/Vendor Payment document in top sources, got: ${topUrls.join(', ')}`
	);
});

test('Quality #5: Document digest summary synthesizes multi-section executive summary instead of raw 280-char slice', () => {
	const rawDoc = [
		'# Panduan Pembayaran Vendor',
		'Paragraf pengantar awal yang menjelaskan latar belakang modul keuangan.',
		'## Bagian 2: Spesifikasi T-Code',
		'- Gunakan T-Code F110 untuk Automatic Payment Program dan F-53 untuk Post Outgoing Payment.',
		'## Bagian 3: Rumus KPI & Rekonsiliasi',
		'- Rumus Aging AP = Tanggal Jatuh Tempo dikurangi Tanggal Faktur MIRO.'
	].join('\n\n');

	const summary = synthesizeMultiSectionDocSummary(
		'Panduan Pembayaran Vendor',
		'Dokumentasi proses pembayaran tagihan vendor di SAP FI.',
		'Bagian 2: Spesifikasi T-Code | Bagian 3: Rumus KPI & Rekonsiliasi',
		rawDoc
	);

	assert.ok(summary.includes('F110'), 'Summary should include mid-document T-Code F110');
	assert.ok(summary.includes('Aging AP'), 'Summary should include end-of-document KPI formula');
});

test('Quality #6: compressAssistantHistoryMessage preserves trailing source links and ticket references', () => {
	const longMiddle = Array.from(
		{ length: 25 },
		(_, i) =>
			`Paragraf penjelasan panjang bagian ke-${i + 1} yang menjabarkan detail konfigurasi standar pada sistem.`
	).join('\n\n');

	const fullReply = [
		'Berikut adalah analisis lengkap mengenai proses pembayaran vendor dan penanganan tiket terkait:',
		longMiddle,
		'- **Kesimpulan Utama**: Pastikan dokumen MIRO telah berstatus Released sebelum menjalankan F110 (lihat Tiket #3190).',
		'**Sumber Referensi:**\n- 📄 [AP & AR Highlight](/docs/sac/finance-ap-ar-highlight)\n- 📄 [Catatan SAP](/my-docs/arif-rahman/sap)'
	].join('\n\n');

	assert.ok(fullReply.length > 1800, 'Input reply should exceed compression threshold');
	const compressed = compressAssistantHistoryMessage(fullReply, 1100);

	assert.ok(compressed.length <= 1200, `Compressed length (${compressed.length}) should stay compact`);
	assert.ok(
		compressed.includes('/docs/sac/finance-ap-ar-highlight'),
		'Compressed history message MUST preserve /docs/... link at the end'
	);
	assert.ok(
		compressed.includes('/my-docs/arif-rahman/sap'),
		'Compressed history message MUST preserve /my-docs/... link at the end'
	);
	assert.ok(
		compressed.includes('Tiket #3190'),
		'Compressed history message MUST preserve ticket numbers'
	);
});

test('Performance #7: callAiChatStream streams SSE token deltas in real time', async () => {
	const server = http.createServer((req, res) => {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		});
		const chunks = ['Halo', ', ini ', 'jawaban ', 'streaming!'];
		for (const token of chunks) {
			res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`);
		}
		res.write(
			`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } })}\n\n`
		);
		res.write('data: [DONE]\n\n');
		res.end();
	});

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const addr = server.address();
	const port = typeof addr === 'object' && addr ? addr.port : 0;

	try {
		const deltas = [];
		const result = await callAiChatStream([{ role: 'user', content: 'Tes stream' }], {
			host: '127.0.0.1',
			port,
			onDelta: (d) => deltas.push(d)
		});

		assert.deepEqual(deltas, ['Halo', ', ini ', 'jawaban ', 'streaming!']);
		assert.equal(result.message, 'Halo, ini jawaban streaming!');
		assert.equal(result.usage?.total_tokens, 28);
	} finally {
		server.close();
	}
});

test('Performance #8: shouldRetryWithFallback rejects timeouts, connection errors, and 4xx client errors', () => {
	// Should NOT retry
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Timeout', { isTimeout: true })),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new Error('Waktu permintaan AI habis (Timeout setelah 60 detik)')),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Conn refused', { code: 'ECONNREFUSED' })),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Bad Request', { statusCode: 400 })),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Unauthorized', { statusCode: 401 })),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Forbidden', { statusCode: 403 })),
		false
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Unprocessable', { statusCode: 422 })),
		false
	);

	// SHOULD retry on fallback model
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Model not found', { statusCode: 404 })),
		true
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Rate limit', { statusCode: 429 })),
		true
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Bad Gateway', { statusCode: 502 })),
		true
	);
	assert.equal(
		shouldRetryWithFallback(new AiGatewayError('Service Unavailable', { statusCode: 503 })),
		true
	);
});

test('Performance #9: Search indices store direct globalIndex on chunks and O(1) prefixIndex', () => {
	const indices = getSearchIndices();
	assert.ok(indices.allChunks.length > 0, 'Chunks should be indexed');
	for (let i = 0; i < indices.allChunks.length; i++) {
		assert.equal(
			indices.allChunks[i].globalIndex,
			i,
			'Each chunk must store its exact array globalIndex for O(1) lookup'
		);
	}
	assert.ok(indices.prefixIndex.size > 0, 'Prefix index must be precomputed in RAM');
	assert.ok(indices.idfMap.size > 0, 'BM25 IDF weights must be precomputed in RAM');
});

test('Measurement #10: Evaluation benchmark & telemetry metrics measure recall, MRR, latency, and cache hit rate', () => {
	resetAiMetrics();
	recordAiRequestMetric({
		endpoint: 'chat',
		model: 'gemini-3.8-flash-low',
		cached: false,
		durationMs: 420,
		usage: { prompt_tokens: 300, completion_tokens: 120, total_tokens: 420 }
	});
	recordAiRequestMetric({
		endpoint: 'chat',
		model: 'gemini-3.8-flash-low',
		cached: true,
		usage: { prompt_tokens: 300, completion_tokens: 120, total_tokens: 420 }
	});

	const metrics = getAiMetrics();
	assert.equal(metrics.totalRequests, 2);
	assert.equal(metrics.cacheHits, 1);
	assert.equal(metrics.cacheMisses, 1);
	assert.equal(metrics.cacheHitRatePercent, 50);
	assert.equal(metrics.tokenUsage.totalTokens, 420);
	assert.equal(metrics.tokenUsage.estimatedTokensSavedByCache, 420);
	assert.equal(metrics.responseTimeMs.lastMs, 420);

	const benchmark = evaluateRetrievalBenchmark();
	assert.ok(
		benchmark.recallAt4Percent >= 90,
		`Expected benchmark Recall@4 >= 90%, got ${benchmark.recallAt4Percent}%`
	);
	assert.ok(
		benchmark.meanReciprocalRank >= 0.85,
		`Expected benchmark MRR >= 0.85, got ${benchmark.meanReciprocalRank}`
	);
});
