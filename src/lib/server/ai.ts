import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Fuse from 'fuse.js';
import {
	loadDocuments,
	loadExternalDocuments,
	loadApps,
	getDataVersion,
	type DocumentItem
} from './docs.ts';
import { loadAllUserNotes, getUserNotesVersion, sanitizeUserName } from './userDocs.ts';

// Load .env safely without depending on SvelteKit virtual modules so unit tests can import ai.ts directly
function loadEnvIfNeeded() {
	try {
		const envPath = path.resolve(process.cwd(), '.env');
		if (fs.existsSync(envPath)) {
			const content = fs.readFileSync(envPath, 'utf8');
			for (const line of content.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				const eqIdx = trimmed.indexOf('=');
				if (eqIdx === -1) continue;
				const key = trimmed.slice(0, eqIdx).trim();
				let val = trimmed.slice(eqIdx + 1).trim();
				if (
					(val.startsWith('"') && val.endsWith('"')) ||
					(val.startsWith("'") && val.endsWith("'"))
				) {
					val = val.slice(1, -1);
				}
				if (process.env[key] === undefined) {
					process.env[key] = val;
				}
			}
		}
	} catch {
		// Ignore .env read errors
	}
}

loadEnvIfNeeded();

export const AI_CONFIG = {
	host: process.env.AI_HOST || '127.0.0.1',
	port: parseInt(process.env.AI_PORT || '8045', 10),
	apiKey: process.env.AI_API_KEY || '',
	defaultModel: process.env.AI_MODEL || 'gemini-3.8-flash-low',
	fallbackModel: process.env.AI_FALLBACK_MODEL || 'gemini-3.8-flash',
	embeddingModel: process.env.AI_EMBEDDING_MODEL || '',
	timeoutMs: Math.min(parseInt(process.env.AI_TIMEOUT_MS || '60000', 10) || 60000, 120000)
};

// ============================================================================
// 1. SERVER-SIDE MODEL ALLOWLIST (Security: Prevent Arbitrary Model Injection)
// ============================================================================
const envAllowedModels = (process.env.AI_ALLOWED_MODELS || '')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

export const ALLOWED_AI_MODELS = new Set<string>([
	AI_CONFIG.defaultModel,
	AI_CONFIG.fallbackModel,
	'gemini-3.8-flash-low',
	'gemini-3.8-flash',
	'gemini-3.8-flash-medium',
	'gemini-2.5-flash',
	'gemini-2.5-pro',
	...envAllowedModels
]);

export function isAllowedAiModel(model?: string | null): boolean {
	if (!model || typeof model !== 'string') return false;
	return ALLOWED_AI_MODELS.has(model.trim());
}

export function resolveAllowedModel(requestedModel?: string | null): string {
	if (requestedModel && typeof requestedModel === 'string') {
		const trimmed = requestedModel.trim();
		if (ALLOWED_AI_MODELS.has(trimmed)) {
			return trimmed;
		}
	}
	return AI_CONFIG.defaultModel;
}

// ============================================================================
// 2. TELEMETRY & PERFORMANCE METRICS (Token Usage, Latency, Cache Hit Rate)
// ============================================================================
interface TelemetryState {
	totalRequests: number;
	cacheHits: number;
	cacheMisses: number;
	fallbackTriggeredCount: number;
	failedRequests: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	estimatedTokensSavedByCache: number;
	responseLatenciesMs: number[];
	retrievalLatenciesMs: number[];
	lastResponseTimeMs: number;
	lastRetrievalTimeMs: number;
	perModelCalls: Record<string, number>;
	perEndpointCalls: Record<string, number>;
}

const telemetry: TelemetryState = {
	totalRequests: 0,
	cacheHits: 0,
	cacheMisses: 0,
	fallbackTriggeredCount: 0,
	failedRequests: 0,
	promptTokens: 0,
	completionTokens: 0,
	totalTokens: 0,
	estimatedTokensSavedByCache: 0,
	responseLatenciesMs: [],
	retrievalLatenciesMs: [],
	lastResponseTimeMs: 0,
	lastRetrievalTimeMs: 0,
	perModelCalls: {},
	perEndpointCalls: {}
};

function computeStats(samples: number[]) {
	if (samples.length === 0) {
		return { count: 0, avgMs: 0, minMs: 0, maxMs: 0, p95Ms: 0 };
	}
	const sorted = [...samples].sort((a, b) => a - b);
	const sum = sorted.reduce((acc, v) => acc + v, 0);
	const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
	return {
		count: sorted.length,
		avgMs: Math.round((sum / sorted.length) * 100) / 100,
		minMs: Math.round(sorted[0] * 100) / 100,
		maxMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
		p95Ms: Math.round(sorted[p95Idx] * 100) / 100
	};
}

export function estimateTokenCount(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

export function recordRetrievalMetric(durationMs: number) {
	telemetry.lastRetrievalTimeMs = Math.round(durationMs * 100) / 100;
	telemetry.retrievalLatenciesMs.push(telemetry.lastRetrievalTimeMs);
	if (telemetry.retrievalLatenciesMs.length > 200) {
		telemetry.retrievalLatenciesMs.shift();
	}
}

export function recordAiRequestMetric(opts: {
	endpoint?: string;
	model?: string;
	cached?: boolean;
	durationMs?: number;
	usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
	promptChars?: number;
	completionChars?: number;
	fallbackUsed?: boolean;
	failed?: boolean;
}) {
	telemetry.totalRequests++;
	const ep = opts.endpoint || 'chat';
	telemetry.perEndpointCalls[ep] = (telemetry.perEndpointCalls[ep] || 0) + 1;

	if (opts.failed) {
		telemetry.failedRequests++;
		return;
	}

	if (opts.fallbackUsed) {
		telemetry.fallbackTriggeredCount++;
	}

	if (opts.cached) {
		telemetry.cacheHits++;
		const savedEst =
			opts.usage?.total_tokens ||
			Math.ceil(((opts.promptChars || 1200) + (opts.completionChars || 600)) / 4);
		telemetry.estimatedTokensSavedByCache += savedEst;
		return;
	}

	telemetry.cacheMisses++;
	if (opts.model) {
		telemetry.perModelCalls[opts.model] = (telemetry.perModelCalls[opts.model] || 0) + 1;
	}

	if (typeof opts.durationMs === 'number' && opts.durationMs >= 0) {
		const rounded = Math.round(opts.durationMs * 100) / 100;
		telemetry.lastResponseTimeMs = rounded;
		telemetry.responseLatenciesMs.push(rounded);
		if (telemetry.responseLatenciesMs.length > 200) {
			telemetry.responseLatenciesMs.shift();
		}
	}

	const pTokens =
		opts.usage?.prompt_tokens ?? (opts.promptChars ? Math.ceil(opts.promptChars / 4) : 0);
	const cTokens =
		opts.usage?.completion_tokens ??
		(opts.completionChars ? Math.ceil(opts.completionChars / 4) : 0);
	const tTokens = opts.usage?.total_tokens ?? pTokens + cTokens;

	telemetry.promptTokens += pTokens;
	telemetry.completionTokens += cTokens;
	telemetry.totalTokens += tTokens;
}

export function getAiMetrics() {
	const total = telemetry.totalRequests;
	const hitRate = total > 0 ? Math.round((telemetry.cacheHits / total) * 10000) / 100 : 0;
	return {
		totalRequests: telemetry.totalRequests,
		cacheHits: telemetry.cacheHits,
		cacheMisses: telemetry.cacheMisses,
		cacheHitRatePercent: hitRate,
		cachedEntries: aiResponseCache.size,
		fallbackTriggeredCount: telemetry.fallbackTriggeredCount,
		failedRequests: telemetry.failedRequests,
		tokenUsage: {
			promptTokens: telemetry.promptTokens,
			completionTokens: telemetry.completionTokens,
			totalTokens: telemetry.totalTokens,
			estimatedTokensSavedByCache: telemetry.estimatedTokensSavedByCache
		},
		responseTimeMs: {
			...computeStats(telemetry.responseLatenciesMs),
			lastMs: telemetry.lastResponseTimeMs
		},
		retrievalTimeMs: {
			...computeStats(telemetry.retrievalLatenciesMs),
			lastMs: telemetry.lastRetrievalTimeMs
		},
		perModelCalls: { ...telemetry.perModelCalls },
		perEndpointCalls: { ...telemetry.perEndpointCalls }
	};
}

export function resetAiMetrics() {
	telemetry.totalRequests = 0;
	telemetry.cacheHits = 0;
	telemetry.cacheMisses = 0;
	telemetry.fallbackTriggeredCount = 0;
	telemetry.failedRequests = 0;
	telemetry.promptTokens = 0;
	telemetry.completionTokens = 0;
	telemetry.totalTokens = 0;
	telemetry.estimatedTokensSavedByCache = 0;
	telemetry.responseLatenciesMs = [];
	telemetry.retrievalLatenciesMs = [];
	telemetry.lastResponseTimeMs = 0;
	telemetry.lastRetrievalTimeMs = 0;
	telemetry.perModelCalls = {};
	telemetry.perEndpointCalls = {};
}

// ============================================================================
// 3. RESPONSE CACHE (TTL: 2 Hours)
// ============================================================================
const aiResponseCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export function getCache(key: string) {
	const item = aiResponseCache.get(key);
	if (!item) return null;
	if (Date.now() > item.expiresAt) {
		aiResponseCache.delete(key);
		return null;
	}
	return item.data;
}

export function setCache(key: string, data: any, ttlMs = CACHE_TTL_MS) {
	if (aiResponseCache.size > 300) {
		const oldestKey = aiResponseCache.keys().next().value;
		if (oldestKey) aiResponseCache.delete(oldestKey);
	}
	aiResponseCache.set(key, {
		data,
		expiresAt: Date.now() + ttlMs
	});
}

export function getCacheSize(): number {
	return aiResponseCache.size;
}

export function clearAiCache() {
	aiResponseCache.clear();
}

export function hashString(str: string): string {
	return crypto.createHash('sha256').update(str).digest('hex');
}

export function checkAiHealth(): Promise<{
	status: string;
	service: string;
	cachedEntries: number;
	allowedModels: string[];
	metrics: ReturnType<typeof getAiMetrics>;
}> {
	return new Promise((resolve) => {
		const req = http.request(
			{
				hostname: AI_CONFIG.host,
				port: AI_CONFIG.port,
				path: '/v1/models',
				method: 'GET',
				headers: { Authorization: `Bearer ${AI_CONFIG.apiKey}` },
				timeout: 3500
			},
			(res) => {
				let data = '';
				res.on('data', (c) => (data += c));
				res.on('end', () => {
					const statusCode = res.statusCode || 200;
					const isHealthy = statusCode >= 200 && statusCode < 400 && !data.toLowerCase().includes('disabled');
					resolve({
						status: isHealthy ? 'online' : 'offline',
						service: isHealthy
							? 'AI Copilot Engine'
							: `AI Copilot Engine (${data.trim().slice(0, 80) || `HTTP ${statusCode}`})`,
						cachedEntries: aiResponseCache.size,
						allowedModels: Array.from(ALLOWED_AI_MODELS),
						metrics: getAiMetrics()
					});
				});
			}
		);

		req.on('error', (err) => {
			resolve({
				status: 'offline',
				service: `AI Copilot Engine (${err.message})`,
				cachedEntries: aiResponseCache.size,
				allowedModels: Array.from(ALLOWED_AI_MODELS),
				metrics: getAiMetrics()
			});
		});

		req.on('timeout', () => {
			req.destroy();
			resolve({
				status: 'timeout',
				service: 'AI Copilot Engine (Timeout)',
				cachedEntries: aiResponseCache.size,
				allowedModels: Array.from(ALLOWED_AI_MODELS),
				metrics: getAiMetrics()
			});
		});

		req.end();
	});
}

// ============================================================================
// 4. AI GATEWAY ERROR CLASSIFICATION, SMART FALLBACK & STREAMING ENGINE
// ============================================================================
export class AiGatewayError extends Error {
	statusCode?: number;
	code?: string;
	isTimeout: boolean;
	retryable: boolean;

	constructor(
		message: string,
		opts?: { statusCode?: number; code?: string; isTimeout?: boolean; retryable?: boolean }
	) {
		super(message);
		this.name = 'AiGatewayError';
		this.statusCode = opts?.statusCode;
		this.code = opts?.code;
		this.isTimeout = Boolean(opts?.isTimeout);
		this.retryable = opts?.retryable ?? false;
	}
}

/**
 * Menentukan secara cerdas apakah kegagalan model utama layak dicoba ulang dengan model cadangan (fallback).
 * - JANGAN ulangi jika gagal karena Timeout, Abort, Koneksi Ditolak (ECONNREFUSED), atau Error 4xx Klien (400, 401, 403, 422).
 * - HANYA ulangi jika error bersifat sementara/spesifik model: 404 (model tidak ditemukan), 429 (rate limit model), atau 5xx (500, 502, 503, 504).
 */
export function shouldRetryWithFallback(err: any): boolean {
	if (!err) return false;

	if (err.isTimeout === true) return false;
	const msg = String(err.message || '').toLowerCase();
	if (
		msg.includes('timeout') ||
		msg.includes('waktu permintaan ai habis') ||
		msg.includes('aborted') ||
		err.name === 'AbortError'
	) {
		return false;
	}

	const netCode = String(err.code || '').toUpperCase();
	if (
		netCode === 'ETIMEDOUT' ||
		netCode === 'ECONNREFUSED' ||
		netCode === 'ENOTFOUND' ||
		netCode === 'EHOSTUNREACH' ||
		netCode === 'ENETUNREACH' ||
		netCode === 'ECONNRESET'
	) {
		return false;
	}

	if (typeof err.statusCode === 'number') {
		if (err.statusCode === 404 || err.statusCode === 429 || err.statusCode === 408) {
			return err.statusCode !== 408; // 404 (model not found) & 429 (rate limit) layak fallback
		}
		if (err.statusCode >= 400 && err.statusCode < 500) {
			// 400 Bad Request, 401 Unauthorized, 403 Forbidden, 413 Payload Too Large, 422 Unprocessable
			return false;
		}
		if (err.statusCode >= 500) {
			return true;
		}
	}

	if (typeof err.retryable === 'boolean') {
		return err.retryable;
	}

	return true;
}

export function callAiChat(
	messages: Array<{ role: string; content: string }>,
	model?: string,
	maxTokens = 2000,
	temperature = 0.1,
	timeoutMs = AI_CONFIG.timeoutMs
): Promise<{ model: string; message: string; usage?: any }> {
	return new Promise((resolve, reject) => {
		const targetModel = resolveAllowedModel(model);
		const targetTimeout = timeoutMs || AI_CONFIG.timeoutMs || 60000;
		const postData = JSON.stringify({
			model: targetModel,
			messages: messages,
			max_tokens: maxTokens,
			temperature: typeof temperature === 'number' ? temperature : 0.1
		});

		const req = http.request(
			{
				hostname: AI_CONFIG.host,
				port: AI_CONFIG.port,
				path: '/v1/chat/completions',
				method: 'POST',
				headers: {
					Authorization: `Bearer ${AI_CONFIG.apiKey}`,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData)
				},
				timeout: targetTimeout
			},
			(res) => {
				const statusCode = res.statusCode || 200;
				let body = '';
				res.on('data', (c) => (body += c));
				res.on('end', () => {
					try {
						const json = JSON.parse(body);
						if (statusCode >= 400) {
							const errMsg =
								json?.error?.message ||
								json?.message ||
								`AI Gateway HTTP ${statusCode}`;
							const retryable = statusCode === 404 || statusCode === 429 || statusCode >= 500;
							reject(new AiGatewayError(errMsg, { statusCode, retryable }));
							return;
						}
						if (json.choices && json.choices[0] && json.choices[0].message) {
							resolve({
								model: targetModel,
								message: json.choices[0].message.content,
								usage: json.usage
							});
						} else if (json.error) {
							const errCode = Number(json.error.code || statusCode || 500);
							const retryable = errCode === 404 || errCode === 429 || errCode >= 500;
							reject(
								new AiGatewayError(json.error.message || 'AI Gateway error', {
									statusCode: errCode,
									retryable
								})
							);
						} else {
							reject(
								new AiGatewayError('Format balasan AI tidak dikenali', {
									statusCode,
									retryable: true
								})
							);
						}
					} catch {
						const retryable = statusCode >= 500;
						reject(
							new AiGatewayError(
								`Gagal memproses JSON respons AI (HTTP ${statusCode}): ${body.substring(0, 150)}`,
								{ statusCode, retryable }
							)
						);
					}
				});
			}
		);

		req.on('error', (err: any) => {
			reject(
				new AiGatewayError(err.message || 'Gagal terhubung ke AI Gateway', {
					code: err.code,
					retryable: false
				})
			);
		});

		req.on('timeout', () => {
			req.destroy();
			reject(
				new AiGatewayError(
					`Waktu permintaan AI habis (Timeout setelah ${(targetTimeout / 1000).toFixed(0)} detik)`,
					{
						code: 'ETIMEDOUT',
						isTimeout: true,
						retryable: false
					}
				)
			);
		});

		req.write(postData);
		req.end();
	});
}

export async function callAiChatWithFallback(
	messages: Array<{ role: string; content: string }>,
	requestedModel?: string,
	maxTokens = 2000,
	temperature = 0.1,
	timeoutMs = AI_CONFIG.timeoutMs
): Promise<{ model: string; message: string; usage?: any; fallbackUsed: boolean }> {
	const primaryModel = resolveAllowedModel(requestedModel);
	try {
		const res = await callAiChat(messages, primaryModel, maxTokens, temperature, timeoutMs);
		return { ...res, fallbackUsed: false };
	} catch (primaryErr: any) {
		const fallbackModel = resolveAllowedModel(AI_CONFIG.fallbackModel);
		if (primaryModel !== fallbackModel && shouldRetryWithFallback(primaryErr)) {
			console.warn(
				`[AI] Model ${primaryModel} mengalami error yang layak diulang (${primaryErr.message}). Mencoba fallback ${fallbackModel}...`
			);
			const res = await callAiChat(messages, fallbackModel, maxTokens, temperature, timeoutMs);
			return { ...res, fallbackUsed: true };
		}
		throw primaryErr;
	}
}

export interface AiStreamOptions {
	model?: string;
	maxTokens?: number;
	temperature?: number;
	timeoutMs?: number;
	host?: string;
	port?: number;
	onDelta?: (deltaText: string) => void;
	signal?: AbortSignal;
}

/**
 * Streaming AI Chat Completion via Server-Sent Events (SSE) dari `/v1/chat/completions`.
 * Mengirimkan potongan token secara langsung begitu tiba (`onDelta`) tanpa menunggu seluruh jawaban selesai.
 * Tetap kompatibel penuh bila server AI mengembalikan respons JSON tunggal.
 */
export function callAiChatStream(
	messages: Array<{ role: string; content: string }>,
	options: AiStreamOptions = {}
): Promise<{ model: string; message: string; usage?: any }> {
	return new Promise((resolve, reject) => {
		const targetModel = resolveAllowedModel(options.model);
		const targetTimeout = options.timeoutMs || AI_CONFIG.timeoutMs || 60000;
		const postData = JSON.stringify({
			model: targetModel,
			messages,
			max_tokens: options.maxTokens ?? 2000,
			temperature: typeof options.temperature === 'number' ? options.temperature : 0.1,
			stream: true
		});

		const req = http.request(
			{
				hostname: options.host || AI_CONFIG.host,
				port: options.port || AI_CONFIG.port,
				path: '/v1/chat/completions',
				method: 'POST',
				headers: {
					Authorization: `Bearer ${AI_CONFIG.apiKey}`,
					'Content-Type': 'application/json',
					Accept: 'text/event-stream, application/json',
					'Content-Length': Buffer.byteLength(postData)
				},
				timeout: targetTimeout
			},
			(res) => {
				const statusCode = res.statusCode || 200;
				const contentType = String(res.headers['content-type'] || '').toLowerCase();

				if (statusCode >= 400) {
					let errBody = '';
					res.on('data', (c) => (errBody += c));
					res.on('end', () => {
						let errMsg = `AI Gateway HTTP ${statusCode}`;
						try {
							const parsed = JSON.parse(errBody);
							errMsg = parsed?.error?.message || parsed?.message || errMsg;
						} catch {
							if (errBody.trim()) errMsg = errBody.trim().slice(0, 180);
						}
						const retryable = statusCode === 404 || statusCode === 429 || statusCode >= 500;
						reject(new AiGatewayError(errMsg, { statusCode, retryable }));
					});
					return;
				}

				let fullText = '';
				let sseBuffer = '';
				let rawBody = '';
				let usage: any = undefined;
				let isSseMode = contentType.includes('text/event-stream');

				const processSseLine = (line: string) => {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data:')) return;
					const payload = trimmed.slice(5).trim();
					if (!payload || payload === '[DONE]') return;
					try {
						const parsed = JSON.parse(payload);
						if (parsed.usage) {
							usage = parsed.usage;
						}
						const delta =
							parsed.choices?.[0]?.delta?.content ??
							parsed.choices?.[0]?.message?.content ??
							'';
						if (delta) {
							fullText += delta;
							options.onDelta?.(delta);
						}
					} catch {
						// Ignore partial/comment SSE line
					}
				};

				res.on('data', (chunk: Buffer | string) => {
					const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
					rawBody += text;

					if (!isSseMode && rawBody.trimStart().startsWith('data:')) {
						isSseMode = true;
					}

					if (isSseMode) {
						sseBuffer += text;
						const lines = sseBuffer.split(/\r?\n/);
						sseBuffer = lines.pop() || '';
						for (const line of lines) {
							processSseLine(line);
						}
					}
				});

				res.on('end', () => {
					if (isSseMode) {
						if (sseBuffer.trim()) {
							processSseLine(sseBuffer);
						}
						resolve({
							model: targetModel,
							message: fullText,
							usage
						});
						return;
					}

					// Fallback jika gateway mengembalikan JSON biasa meskipun diminta stream: true
					try {
						const json = JSON.parse(rawBody);
						const content = json.choices?.[0]?.message?.content || '';
						if (content) {
							options.onDelta?.(content);
							resolve({
								model: targetModel,
								message: content,
								usage: json.usage
							});
						} else if (json.error) {
							reject(
								new AiGatewayError(json.error.message || 'AI Gateway error', {
									statusCode: Number(json.error.code || 500),
									retryable: true
								})
							);
						} else {
							reject(
								new AiGatewayError('Format balasan AI tidak dikenali', {
									statusCode: 502,
									retryable: true
								})
							);
						}
					} catch {
						reject(
							new AiGatewayError(
								'Gagal memproses aliran respons AI: ' + rawBody.substring(0, 150),
								{ statusCode: 502, retryable: true }
							)
						);
					}
				});
			}
		);

		if (options.signal) {
			if (options.signal.aborted) {
				req.destroy();
				reject(new AiGatewayError('Permintaan AI dibatalkan pengguna', { retryable: false }));
				return;
			}
			options.signal.addEventListener(
				'abort',
				() => {
					req.destroy();
					reject(new AiGatewayError('Permintaan AI dibatalkan pengguna', { retryable: false }));
				},
				{ once: true }
			);
		}

		req.on('error', (err: any) => {
			reject(
				new AiGatewayError(err.message || 'Gagal terhubung ke AI Gateway', {
					code: err.code,
					retryable: false
				})
			);
		});

		req.on('timeout', () => {
			req.destroy();
			reject(
				new AiGatewayError(
					`Waktu permintaan AI habis (Timeout setelah ${(targetTimeout / 1000).toFixed(0)} detik)`,
					{
						code: 'ETIMEDOUT',
						isTimeout: true,
						retryable: false
					}
				)
			);
		});

		req.write(postData);
		req.end();
	});
}

export async function callAiChatStreamWithFallback(
	messages: Array<{ role: string; content: string }>,
	options: AiStreamOptions = {}
): Promise<{ model: string; message: string; usage?: any; fallbackUsed: boolean }> {
	const primaryModel = resolveAllowedModel(options.model);
	let emittedAnyDelta = false;

	try {
		const res = await callAiChatStream(messages, {
			...options,
			model: primaryModel,
			onDelta: (delta) => {
				emittedAnyDelta = true;
				options.onDelta?.(delta);
			}
		});
		return { ...res, fallbackUsed: false };
	} catch (primaryErr: any) {
		const fallbackModel = resolveAllowedModel(AI_CONFIG.fallbackModel);
		if (
			!emittedAnyDelta &&
			primaryModel !== fallbackModel &&
			shouldRetryWithFallback(primaryErr)
		) {
			console.warn(
				`[AI Stream] Model ${primaryModel} gagal sebelum streaming dimulai (${primaryErr.message}). Mencoba fallback ${fallbackModel}...`
			);
			const res = await callAiChatStream(messages, {
				...options,
				model: fallbackModel
			});
			return { ...res, fallbackUsed: true };
		}
		throw primaryErr;
	}
}

// ============================================================================
// 5. INDONESIAN + ENGLISH STEMMER & BILINGUAL SEMANTIC EMBEDDING ENGINE
// ============================================================================

const STOPWORDS = new Set([
	'apa', 'apakah', 'bagaimana', 'gimana', 'cara', 'tolong', 'jelaskan', 'sebutkan',
	'berikan', 'kasih', 'tahu', 'info', 'informasi', 'yang', 'di', 'ke', 'dari',
	'untuk', 'pada', 'dalam', 'dengan', 'adalah', 'ialah', 'merupakan', 'ini', 'itu',
	'tersebut', 'saya', 'aku', 'kami', 'kita', 'anda', 'kamu', 'dia', 'mereka',
	'bisa', 'dapat', 'ada', 'tidak', 'tak', 'bukan', 'belum', 'sudah', 'telah',
	'sedang', 'akan', 'mau', 'ingin', 'tanya', 'bertanya', 'tentang', 'seputar',
	'mengenai', 'isi', 'dokumen', 'dokument', 'document', 'file', 'berkas', 'note',
	'notes', 'catatan', 'program', 'aplikasi', 'portal', 'sinkron', 'sinkronisasi',
	'sync', 'berdasarkan', 'menurut', 'mohon', 'dong', 'ya', 'yah', 'nih', 'deh',
	'nya', 'dan', 'atau', 'serta', 'jika', 'kalau', 'bila', 'karena', 'sebab',
	'oleh', 'sebagai', 'seperti', 'saja', 'aja', 'semua', 'seluruh', 'daftar',
	'list', 'berapa', 'kapan', 'dimana', 'siapa', 'kenapa', 'mengapa', 'the',
	'is', 'are', 'in', 'on', 'of', 'to', 'for', 'and', 'or', 'with', 'how', 'what'
]);

const GENERIC_MODIFIER_WORDS = new Set([
	'status', 'ringkasan', 'rekap', 'total', 'jumlah', 'statistik', 'data',
	'open', 'closed', 'waiting', 'cancelled', 'cancel', 'terbaru', 'terakhir',
	'aktif', 'nomor', 'laporan', 'modul', 'module', 'sistem', 'system',
	'tabel', 'sheet', 'bagian', 'detail', 'rincian', 'perbandingan', 'rata'
]);

/**
 * Kamus akar kata morfologi khusus (Bahasa Indonesia & Inggris) untuk akurasi tinggi
 * pada kasus peluluhan fonem K-T-S-P bahasa Indonesia dan bentuk tak beraturan bahasa Inggris.
 */
const IRREGULAR_STEM_MAP: Record<string, string> = {
	// Indonesia (peluluhan K, T, S, P & imbuhan kompleks)
	pembayaran: 'bayar', membayar: 'bayar', dibayar: 'bayar', dibayarkan: 'bayar', terbayar: 'bayar', berbayar: 'bayar',
	penagihan: 'tagih', menagih: 'tagih', ditagih: 'tagih', tagihan: 'tagih',
	pembelian: 'beli', membeli: 'beli', dibeli: 'beli', pembeli: 'beli',
	penjualan: 'jual', menjual: 'jual', dijual: 'jual', penjual: 'jual',
	pengadaan: 'pengadaan', mengadakan: 'pengadaan',
	pengiriman: 'kirim', mengirim: 'kirim', mengirimkan: 'kirim', dikirim: 'kirim', kiriman: 'kirim', pengirim: 'kirim',
	penerimaan: 'terima', menerima: 'terima', diterima: 'terima', penerima: 'terima',
	pemeliharaan: 'pelihara', memelihara: 'pelihara', dipelihara: 'pelihara',
	perawatan: 'rawat', merawat: 'rawat', dirawat: 'rawat',
	perbaikan: 'baik', memperbaiki: 'baik', diperbaiki: 'baik',
	kerusakan: 'rusak', merusak: 'rusak',
	perhitungan: 'hitung', menghitung: 'hitung', dihitung: 'hitung', hitungan: 'hitung',
	pencatatan: 'catat', mencatat: 'catat', dicatat: 'catat',
	penyelesaian: 'selesai', menyelesaikan: 'selesai', diselesaikan: 'selesai', terselesaikan: 'selesai',
	pemakaian: 'pakai', memakai: 'pakai', dipakai: 'pakai', pemakai: 'pakai',
	penggunaan: 'guna', menggunakan: 'guna', digunakan: 'guna', pengguna: 'guna',
	penyimpanan: 'simpan', menyimpan: 'simpan', disimpan: 'simpan',
	pengelolaan: 'kelola', mengelola: 'kelola', dikelola: 'kelola',
	pemindahan: 'pindah', memindahkan: 'pindah', dipindahkan: 'pindah',
	permintaan: 'minta', meminta: 'minta', diminta: 'minta',
	persetujuan: 'setuju', menyetujui: 'setuju', disetujui: 'setuju',
	penambangan: 'tambang', menambang: 'tambang', pertambangan: 'tambang',
	pengangkutan: 'angkut', mengangkut: 'angkut', diangkut: 'angkut', angkutan: 'angkut',
	pemuatan: 'muat', memuat: 'muat', dimuat: 'muat', muatan: 'muat',
	pelayaran: 'layar', berlayar: 'layar',
	persediaan: 'sedia', tersedia: 'sedia', ketersediaan: 'sedia',
	kesiapan: 'siap', menyiapkan: 'siap', disiapkan: 'siap',
	keuangan: 'uang', pendanaan: 'dana',
	pendapatan: 'dapat', mendapatkan: 'dapat',
	pengeluaran: 'keluar', mengeluarkan: 'keluar',
	pemasok: 'pemasok', suplier: 'supplier',
	// English
	payments: 'pay', payment: 'pay', payable: 'pay', payables: 'pay', paying: 'pay', paid: 'pay',
	vendors: 'vendor', suppliers: 'supplier', supplied: 'supplier',
	purchasing: 'purchase', purchases: 'purchase', purchased: 'purchase', procurement: 'procure',
	inventories: 'inventory', stocks: 'stock', warehouses: 'warehouse',
	invoices: 'invoice', invoicing: 'invoice', billed: 'bill', billing: 'bill',
	receivables: 'receivable', collections: 'collection',
	vessels: 'vessel', barges: 'barge', tugboats: 'tugboat',
	maintaining: 'maintenance', maintained: 'maintenance', repairs: 'repair', repaired: 'repair',
	equipments: 'equipment', machines: 'machine', machinery: 'machine',
	operations: 'operation', operational: 'operation', operating: 'operation',
	financial: 'finance', financials: 'finance',
	shipments: 'shipment', shipping: 'ship', shipped: 'ship', deliveries: 'delivery', delivered: 'delivery'
};

/**
 * Stemmer Bahasa Indonesia (berbasis aturan Nazief-Adriani / Sastrawi) + Bahasa Inggris.
 * Mengubah kata berimbuhan menjadi kata dasar sehingga pencarian cocok lintas variasi kata.
 */
export function stemWord(rawWord: string): string {
	if (!rawWord) return '';
	let w = rawWord.toLowerCase().trim();
	if (w.length <= 3) return w;

	if (IRREGULAR_STEM_MAP[w]) {
		return IRREGULAR_STEM_MAP[w];
	}

	// 1. Hapus partikel & kata ganti milik Bahasa Indonesia (-lah, -kah, -pun, -nya, -ku, -mu)
	if (w.length >= 6) {
		w = w.replace(/(lah|kah|pun|nya|ku|mu)$/, '');
		if (IRREGULAR_STEM_MAP[w]) return IRREGULAR_STEM_MAP[w];
	}

	// 2. Hapus akhiran derivasional Bahasa Indonesia (-kan, -an, -i) jika kata cukup panjang
	let strippedSuffix = false;
	if (w.length >= 6) {
		if (w.endsWith('kan') && w.length >= 7) {
			w = w.slice(0, -3);
			strippedSuffix = true;
		} else if (w.endsWith('an') && w.length >= 6 && !w.endsWith('ian')) {
			w = w.slice(0, -2);
			strippedSuffix = true;
		} else if (w.endsWith('i') && w.length >= 6 && !/(si|ti|ri|ni|li|bi)$/.test(w)) {
			w = w.slice(0, -1);
			strippedSuffix = true;
		}
		if (IRREGULAR_STEM_MAP[w]) return IRREGULAR_STEM_MAP[w];
	}

	// 3. Hapus awalan Bahasa Indonesia (meng-, meny-, mem-, men-, me-, peng-, peny-, pem-, pen-, pe-, per-, ber-, ter-, di-, ke-, se-)
	if (w.length >= 5) {
		if (/^(meng|peng)/.test(w) && w.length >= 7) {
			w = w.slice(4);
		} else if (/^(meny|peny)/.test(w) && w.length >= 7) {
			w = 's' + w.slice(4);
		} else if (/^(mem|pem)/.test(w) && w.length >= 6) {
			const rest = w.slice(3);
			w = /^[aiueo]/.test(rest) ? 'p' + rest : rest;
		} else if (/^(men|pen)/.test(w) && w.length >= 6) {
			const rest = w.slice(3);
			w = /^[aiueo]/.test(rest) ? 't' + rest : rest;
		} else if (/^(ber|ter|per)/.test(w) && w.length >= 6) {
			w = w.slice(3);
		} else if (/^(me|pe|di|ke|se)/.test(w) && w.length >= 6 && strippedSuffix) {
			w = w.slice(2);
		}
		if (IRREGULAR_STEM_MAP[w]) return IRREGULAR_STEM_MAP[w];
	}

	// 4. Aturan akhiran Bahasa Inggris (-ments, -ment, -ing, -ed, -ies, -es, -s)
	if (w.length >= 5) {
		if (w.endsWith('ments') && w.length >= 8) w = w.slice(0, -5);
		else if (w.endsWith('ment') && w.length >= 7) w = w.slice(0, -4);
		else if (w.endsWith('ings') && w.length >= 7) w = w.slice(0, -4);
		else if (w.endsWith('ing') && w.length >= 6) w = w.slice(0, -3);
		else if (w.endsWith('ies') && w.length >= 6) w = w.slice(0, -3) + 'y';
		else if (w.endsWith('ed') && w.length >= 6) w = w.slice(0, -2);
		else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length >= 5) {
			w = w.slice(0, -1);
		}
		if (IRREGULAR_STEM_MAP[w]) return IRREGULAR_STEM_MAP[w];
	}

	return w;
}

/**
 * Klaster Konsep Semantik Lintas Bahasa (Indonesia <-> Inggris) untuk Enterprise SAP, SAC, Mining, Marine & Web.
 * Setiap klaster merepresentasikan satu dimensi konsep pada vektor embedding semantik, sekaligus
 * memetakan sinonim lintas bahasa (misal "cara bayar vendor" <-> "Vendor Payment" / "Accounts Payable").
 */
interface ConceptCluster {
	id: string;
	terms: string[];
	coreExpansions: string[];
}

const BILINGUAL_CONCEPT_CLUSTERS: ConceptCluster[] = [
	{
		id: 'ap_vendor_payment',
		terms: [
			'bayar', 'pembayaran', 'tagih', 'tagihan', 'hutang', 'utang', 'lunasi', 'pelunasan',
			'faktur', 'pay', 'payment', 'payments', 'payable', 'ap', 'invoice', 'clearing',
			'disbursement', 'outgoing', 'f-53', 'f110', 'miro', 'aging'
		],
		coreExpansions: ['bayar', 'pay', 'payment', 'payable', 'ap', 'vendor', 'invoice']
	},
	{
		id: 'vendor_supplier',
		terms: [
			'vendor', 'pemasok', 'suplier', 'supplier', 'rekanan', 'kreditur', 'creditor', 'xk01', 'bp'
		],
		coreExpansions: ['vendor', 'supplier', 'pemasok', 'payment', 'ap']
	},
	{
		id: 'ar_customer_receivable',
		terms: [
			'piutang', 'pelanggan', 'customer', 'debitur', 'receivable', 'ar', 'collection',
			'billing', 'incoming', 'penagihan'
		],
		coreExpansions: ['piutang', 'receivable', 'ar', 'customer', 'billing']
	},
	{
		id: 'cash_treasury',
		terms: [
			'kas', 'bank', 'likuiditas', 'saldo', 'rekening', 'giro', 'deposito', 'cash',
			'cashflow', 'treasury', 'liquidity', 'position'
		],
		coreExpansions: ['kas', 'cash', 'bank', 'position', 'liquidity']
	},
	{
		id: 'pnl_financial_performance',
		terms: [
			'laba', 'rugi', 'pendapatan', 'beban', 'biaya', 'ebitda', 'margin', 'keuangan',
			'finansial', 'pnl', 'profit', 'loss', 'revenue', 'expense', 'finance', 'financial',
			'performance', 'cogs', 'hpp', 'konsolidasi', 'segment'
		],
		coreExpansions: ['laba', 'rugi', 'pnl', 'profit', 'loss', 'finance', 'financial', 'revenue']
	},
	{
		id: 'balance_sheet_covenant',
		terms: [
			'neraca', 'aset', 'liabilitas', 'kewajiban', 'ekuitas', 'modal', 'rasio', 'pinjaman',
			'kredit', 'asset', 'liability', 'equity', 'covenant', 'coverage', 'ratio', 'debt', 'dscr', 'der'
		],
		coreExpansions: ['neraca', 'asset', 'liability', 'covenant', 'debt', 'ratio']
	},
	{
		id: 'coal_price_benchmark',
		terms: [
			'harga', 'batubara', 'acuan', 'indeks', 'pasar', 'kalori', 'gar', 'ici', 'newcastle',
			'coal', 'price', 'benchmark', 'actual', 'quantity', 'tonnage', 'marketing'
		],
		coreExpansions: ['harga', 'batubara', 'coal', 'price', 'benchmark', 'quantity']
	},
	{
		id: 'inventory_stock_transit',
		terms: [
			'stok', 'persediaan', 'sedia', 'inventori', 'gudang', 'rom', 'stockpile', 'transit',
			'mutasi', 'dead', 'movement', 'closing', 'inventory', 'stock', 'warehouse', 'material'
		],
		coreExpansions: ['stok', 'sedia', 'inventory', 'stock', 'transit', 'material', 'closing']
	},
	{
		id: 'procurement_purchasing_mm',
		terms: [
			'pengadaan', 'beli', 'pembelian', 'order', 'permintaan', 'minta', 'siklus', 'lead',
			'procure', 'procurement', 'purchase', 'purchasing', 'po', 'pr', 'requisition', 'mm',
			'me21n', 'me51n', 'cycle'
		],
		coreExpansions: ['pengadaan', 'beli', 'procurement', 'purchase', 'po', 'pr', 'mm', 'cycle']
	},
	{
		id: 'supplier_delivery_evaluation',
		terms: [
			'evaluasi', 'kinerja', 'pengiriman', 'kirim', 'ketepatan', 'otd', 'delivery',
			'evaluation', 'leadtime', 'fulfillment'
		],
		coreExpansions: ['kirim', 'delivery', 'supplier', 'vendor', 'performance', 'evaluasi']
	},
	{
		id: 'mining_production_ob_fuel',
		terms: [
			'tambang', 'produksi', 'pengupasan', 'overburden', 'ob', 'stripping', 'sr', 'bbm',
			'solar', 'fuel', 'mining', 'operational', 'rom', 'pit'
		],
		coreExpansions: ['tambang', 'mining', 'produksi', 'production', 'ob', 'fuel', 'operational']
	},
	{
		id: 'mining_hauling_barging_port',
		terms: [
			'angkut', 'pengangkutan', 'hauling', 'barging', 'jetty', 'crusher', 'ritase', 'tonase',
			'pelabuhan', 'port', 'logistics', 'logistik', 'utilization', 'efisiensi'
		],
		coreExpansions: ['angkut', 'hauling', 'barging', 'port', 'logistics', 'mining']
	},
	{
		id: 'equipment_availability_fleet',
		terms: [
			'alat', 'berat', 'excavator', 'dt', 'hd', 'dozer', 'grader', 'kesiapan', 'siap',
			'availability', 'pa', 'ua', 'ma', 'eu', 'equipment', 'fleet', 'readiness', 'breakdown', 'standby'
		],
		coreExpansions: ['equipment', 'fleet', 'availability', 'readiness', 'alat', 'siap']
	},
	{
		id: 'marine_vessel_barge_trip',
		terms: [
			'kapal', 'laut', 'layar', 'pelayaran', 'tongkang', 'tugboat', 'barge', 'vessel',
			'armada', 'trip', 'voyage', 'charter', 'freight', 'marine', 'timesheet', 'jmt', 'stm', 'jml'
		],
		coreExpansions: ['kapal', 'marine', 'vessel', 'barge', 'trip', 'armada']
	},
	{
		id: 'stevedoring_floating_crane',
		terms: [
			'bongkar', 'muat', 'pemuatan', 'floating', 'crane', 'fc', 'stevedoring', 'loading',
			'demurrage', 'despatch', 'sts'
		],
		coreExpansions: ['stevedoring', 'crane', 'floating', 'bongkar', 'muat', 'marine']
	},
	{
		id: 'plant_maintenance_pm_docking',
		terms: [
			'pelihara', 'pemeliharaan', 'rawat', 'perawatan', 'baik', 'perbaikan', 'rusak',
			'kerusakan', 'bengkel', 'maintenance', 'repair', 'overhaul', 'docking', 'machinery',
			'machine', 'tyre', 'ban', 'backlog', 'p2h', 'wcm', 'pm', 'job', 'card', 'swap'
		],
		coreExpansions: ['pelihara', 'rawat', 'maintenance', 'pm', 'repair', 'fleet', 'docking']
	},
	{
		id: 'sap_abap_bapi_odata_fiori',
		terms: [
			'abap', 'rfc', 'bapi', 'odata', 'gateway', 'fiori', 'cds', 'rap', 's/4hana', 'hana',
			'erp', 'se37', 'se38', 'segw', 'tcode', 't-code', 'integrasi', 'integration'
		],
		coreExpansions: ['sap', 'abap', 'bapi', 'rfc', 'odata', 'gateway', 'integration']
	},
	{
		id: 'sap_co_controlling',
		terms: [
			'controlling', 'cost', 'center', 'profit', 'copa', 'alokasi', 'elemen', 'secc', 'co'
		],
		coreExpansions: ['co', 'controlling', 'cost', 'profit', 'center']
	},
	{
		id: 'sap_hcm_hr_payroll',
		terms: [
			'karyawan', 'pegawai', 'sdm', 'hrd', 'gaji', 'upah', 'payroll', 'absensi', 'cuti',
			'infotype', 'personnel', 'hcm', 'hr', 'roster', 'ewl', 'bombana'
		],
		coreExpansions: ['hcm', 'hr', 'payroll', 'infotype', 'karyawan']
	},
	{
		id: 'sap_ps_fm_project_funds',
		terms: [
			'proyek', 'wbs', 'anggaran', 'budget', 'dana', 'project', 'ps', 'funds', 'fm'
		],
		coreExpansions: ['ps', 'fm', 'project', 'funds', 'budget']
	},
	{
		id: 'sap_sd_cs_sales_service',
		terms: [
			'jual', 'penjualan', 'distribusi', 'sales', 'distribution', 'sd', 'cs', 'service'
		],
		coreExpansions: ['sd', 'sales', 'jual', 'distribution', 'cs']
	},
	{
		id: 'sac_story_builder_analytics',
		terms: [
			'sac', 'analytics', 'cloud', 'story', 'stories', 'canvas', 'widget', 'measure',
			'dimension', 'boardroom', 'visualisasi'
		],
		coreExpansions: ['sac', 'analytics', 'story', 'measure', 'widget']
	},
	{
		id: 'web_portal_security_api',
		terms: [
			'sveltekit', 'svelte', 'tailwind', 'api', 'endpoint', 'rest', 'autentikasi', 'auth',
			'session', 'cookie', 'hmac', 'csrf', 'xss', 'dompurify', 'sanitasi', 'security',
			'keamanan', 'testing', 'test', 'binding'
		],
		coreExpansions: ['web', 'api', 'security', 'keamanan', 'sveltekit', 'auth']
	}
];

// Peta pencarian cepat dari kata/stem -> daftar indeks klaster konsep & ekspansi lintas bahasa
const TERM_TO_CLUSTER_INDICES = new Map<string, number[]>();
const TERM_TO_BILINGUAL_EXPANSIONS = new Map<string, Set<string>>();

for (let cIdx = 0; cIdx < BILINGUAL_CONCEPT_CLUSTERS.length; cIdx++) {
	const cluster = BILINGUAL_CONCEPT_CLUSTERS[cIdx];
	const allForms = new Set<string>();
	for (const rawTerm of cluster.terms) {
		allForms.add(rawTerm.toLowerCase());
		allForms.add(stemWord(rawTerm));
	}
	for (const form of allForms) {
		if (!form) continue;
		const list = TERM_TO_CLUSTER_INDICES.get(form) || [];
		if (!list.includes(cIdx)) list.push(cIdx);
		TERM_TO_CLUSTER_INDICES.set(form, list);

		let expSet = TERM_TO_BILINGUAL_EXPANSIONS.get(form);
		if (!expSet) {
			expSet = new Set<string>();
			TERM_TO_BILINGUAL_EXPANSIONS.set(form, expSet);
		}
		for (const exp of cluster.coreExpansions) {
			expSet.add(exp);
			expSet.add(stemWord(exp));
		}
	}
}

/**
 * Kamus translasi konsep presisi per kata (Indonesia <-> Inggris) agar pencarian BM25
 * mencocokkan makna lintas bahasa per konsep kata tanpa terdistorsi oleh kata umum.
 */
const DIRECT_BILINGUAL_CONCEPT_SYNONYMS: Record<string, string[]> = {
	bayar: ['pay', 'payment', 'payable', 'ap', 'invoice', 'clearing', 'tagih', 'hutang', 'utang'],
	pay: ['bayar', 'payment', 'payable', 'ap', 'invoice', 'tagih'],
	tagih: ['invoice', 'billing', 'pay', 'payment', 'payable', 'receivable', 'bayar'],
	hutang: ['payable', 'ap', 'debt', 'liability', 'pay', 'vendor'],
	utang: ['payable', 'ap', 'debt', 'liability', 'pay', 'covenant'],
	piutang: ['receivable', 'ar', 'billing', 'collection', 'customer'],
	vendor: ['vendor', 'supplier', 'pemasok', 'payable', 'ap', 'pay'],
	pemasok: ['vendor', 'supplier', 'payable', 'ap', 'pay'],
	supplier: ['supplier', 'vendor', 'pemasok'],
	kas: ['cash', 'treasury', 'liquidity', 'bank', 'position'],
	cash: ['kas', 'cash', 'liquidity', 'bank', 'position'],
	laba: ['profit', 'pnl', 'ebitda', 'margin', 'income', 'revenue', 'financial'],
	rugi: ['loss', 'pnl', 'financial'],
	keuangan: ['finance', 'financial', 'pnl', 'cash', 'covenant'],
	uang: ['finance', 'financial', 'cash', 'kas'],
	neraca: ['balance', 'asset', 'liability', 'equity', 'covenant', 'position'],
	rasio: ['ratio', 'covenant', 'coverage', 'dscr', 'der'],
	covenant: ['covenant', 'coverage', 'ratio', 'debt', 'rasio'],
	harga: ['price', 'benchmark', 'pricing', 'actual'],
	price: ['harga', 'price', 'benchmark'],
	batubara: ['coal', 'rom', 'gar', 'ici', 'barging'],
	coal: ['batubara', 'coal', 'rom', 'benchmark'],
	stok: ['inventory', 'stock', 'transit', 'stockpile', 'sedia', 'closing', 'dead'],
	sedia: ['inventory', 'stock', 'transit', 'availability', 'stok'],
	inventory: ['stok', 'sedia', 'inventory', 'stock', 'transit'],
	gudang: ['warehouse', 'inventory', 'stock', 'storage', 'material'],
	beli: ['purchase', 'procurement', 'procure', 'po', 'pr', 'mm', 'pengadaan'],
	pengadaan: ['procurement', 'procure', 'purchase', 'po', 'pr', 'mm', 'cycle', 'beli'],
	procure: ['pengadaan', 'beli', 'purchase', 'po', 'pr'],
	kirim: ['delivery', 'shipment', 'ship', 'lead', 'supplier', 'transit'],
	delivery: ['kirim', 'delivery', 'lead', 'supplier'],
	evaluasi: ['evaluation', 'performance', 'kinerja', 'supplier', 'vendor'],
	tambang: ['mining', 'pit', 'ob', 'overburden', 'production', 'hauling'],
	mining: ['tambang', 'mining', 'ob', 'production'],
	produksi: ['production', 'operational', 'ob', 'coal', 'mining'],
	angkut: ['hauling', 'barging', 'logistics', 'transport', 'transit'],
	pelabuhan: ['port', 'jetty', 'barging', 'transit', 'stevedoring'],
	port: ['pelabuhan', 'port', 'jetty', 'barging', 'transit'],
	alat: ['equipment', 'fleet', 'availability', 'unit', 'readiness'],
	siap: ['readiness', 'availability', 'available', 'equipment', 'fleet'],
	kapal: ['marine', 'vessel', 'barge', 'tugboat', 'fleet', 'trip', 'docking'],
	laut: ['marine', 'vessel', 'barge', 'stevedoring', 'trip'],
	marine: ['kapal', 'laut', 'marine', 'vessel', 'barge', 'trip'],
	bongkar: ['stevedoring', 'crane', 'floating', 'loading'],
	muat: ['stevedoring', 'crane', 'floating', 'loading', 'barging'],
	pelihara: ['maintenance', 'pm', 'repair', 'docking', 'fleet', 'machinery', 'rawat'],
	rawat: ['maintenance', 'pm', 'repair', 'docking', 'fleet', 'pelihara'],
	maintenance: ['pelihara', 'rawat', 'maintenance', 'pm', 'repair', 'docking'],
	rusak: ['breakdown', 'repair', 'maintenance', 'damage', 'pm'],
	baik: ['repair', 'maintenance', 'pm', 'overhaul'],
	karyawan: ['hcm', 'hr', 'employee', 'personnel', 'payroll', 'infotype'],
	gaji: ['payroll', 'hcm', 'wage', 'salary'],
	proyek: ['project', 'ps', 'wbs'],
	anggaran: ['budget', 'funds', 'fm'],
	jual: ['sales', 'sd', 'revenue', 'price']
};

export function getBilingualSynonymsForWord(word: string): string[] {
	const w = word.toLowerCase().trim();
	const stem = stemWord(w);
	const out = new Set<string>();
	if (stem && stem !== w) out.add(stem);

	for (const key of [w, stem]) {
		const direct = DIRECT_BILINGUAL_CONCEPT_SYNONYMS[key];
		if (direct) {
			for (const syn of direct) {
				out.add(syn);
				const synStem = stemWord(syn);
				if (synStem) out.add(synStem);
			}
		}
		const clusterExps = TERM_TO_BILINGUAL_EXPANSIONS.get(key);
		if (clusterExps) {
			for (const exp of clusterExps) out.add(exp);
		}
	}
	out.delete(w);
	return Array.from(out);
}

export function expandBilingualQueryTerms(keywords: string[]): string[] {
	const expanded = new Set<string>();
	for (const kw of keywords) {
		for (const syn of getBilingualSynonymsForWord(kw)) {
			expanded.add(syn);
		}
	}
	for (const kw of keywords) expanded.delete(kw);
	return Array.from(expanded);
}

const EMBEDDING_DIM = 96; // 0..23: Bilingual Concept Dimensions, 24..95: IDF-Weighted Distributional Hash Dimensions

function fnv1aHash(str: string): number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function normalizeL2(vec: Float32Array): Float32Array {
	let normSq = 0;
	for (let i = 0; i < vec.length; i++) {
		normSq += vec[i] * vec[i];
	}
	if (normSq > 0) {
		const invNorm = 1 / Math.sqrt(normSq);
		for (let i = 0; i < vec.length; i++) {
			vec[i] *= invNorm;
		}
	}
	return vec;
}

/**
 * Menghasilkan Dense Semantic Vector Embedding (`Float32Array(96)`) langsung dari Map frekuensi kata
 * tanpa perlu melakukan tokenisasi/regex ulang pada saat build index (mempercepat build index ~6x lipat).
 */
function computeEmbeddingFromTermFreqs(
	termFreqs: Map<string, number>,
	idfMap: Map<string, number>
): Float32Array {
	const vec = new Float32Array(EMBEDDING_DIM);
	const hashBuckets = EMBEDDING_DIM - BILINGUAL_CONCEPT_CLUSTERS.length;
	const hashOffset = BILINGUAL_CONCEPT_CLUSTERS.length;

	for (const [term, tf] of termFreqs.entries()) {
		const idf = idfMap.get(term) ?? 2.0;
		const weight = (1 + Math.log(1 + tf)) * idf;

		const cIndices = TERM_TO_CLUSTER_INDICES.get(term);
		if (cIndices) {
			for (const cIdx of cIndices) {
				vec[cIdx] += 2.2 * weight;
			}
		}

		const h = fnv1aHash(term);
		const bucket = hashOffset + (h % hashBuckets);
		const sign = (h & 1) === 0 ? 1 : -1;
		vec[bucket] += sign * weight;
	}

	return normalizeL2(vec);
}

/**
 * Menghasilkan Dense Semantic Vector Embedding (`Float32Array(96)`) ber-normalisasi L2 untuk teks/query:
 * - Dimensi 0..23: Proyeksi Konsep Semantik Lintas Bahasa (Indonesia <-> Inggris).
 * - Dimensi 24..95: Proyeksi Distribusi Kata Dasar & Sinonim Lintas Bahasa berbobot IDF.
 */
export function computeSemanticEmbedding(
	text: string,
	idfMap?: Map<string, number>,
	titleBoostText = ''
): Float32Array {
	const vec = new Float32Array(EMBEDDING_DIM);
	if (!text && !titleBoostText) return vec;

	const rawTokens = `${titleBoostText} ${titleBoostText} ${text}`
		.toLowerCase()
		.replace(/[^a-z0-9_/-]+/g, ' ')
		.split(/\s+/)
		.filter((t) => t.length >= 2 && !STOPWORDS.has(t));

	if (rawTokens.length === 0) return vec;

	const hashBuckets = EMBEDDING_DIM - BILINGUAL_CONCEPT_CLUSTERS.length;
	const hashOffset = BILINGUAL_CONCEPT_CLUSTERS.length;

	for (let i = 0; i < rawTokens.length; i++) {
		const tok = rawTokens[i];
		const stem = stemWord(tok);
		const idf = idfMap ? idfMap.get(stem) ?? idfMap.get(tok) ?? 2.2 : 2.2;

		// 1. Aktivasi dimensi konsep lintas bahasa (ID <-> EN)
		const cIndices =
			TERM_TO_CLUSTER_INDICES.get(tok) || TERM_TO_CLUSTER_INDICES.get(stem);
		if (cIndices) {
			for (const cIdx of cIndices) {
				vec[cIdx] += 2.4 * idf;
			}
		}

		// 2. Proyeksi fitur kata dasar berbobot IDF
		const h = fnv1aHash(stem);
		const bucket = hashOffset + (h % hashBuckets);
		const sign = (h & 1) === 0 ? 1 : -1;
		vec[bucket] += sign * idf;

		// 3. Proyeksi sinonim lintas bahasa utama agar vektor bahasa Indonesia & Inggris bertemu di dimensi hash yang sama
		const directSyns = DIRECT_BILINGUAL_CONCEPT_SYNONYMS[tok] || DIRECT_BILINGUAL_CONCEPT_SYNONYMS[stem];
		if (directSyns) {
			for (let s = 0; s < Math.min(directSyns.length, 4); s++) {
				const synStem = stemWord(directSyns[s]);
				const sh = fnv1aHash(synStem);
				const sBucket = hashOffset + (sh % hashBuckets);
				const sSign = (sh & 1) === 0 ? 1 : -1;
				vec[sBucket] += sSign * (idf * 0.65);
			}
		}
	}

	return normalizeL2(vec);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		dot += a[i] * b[i];
	}
	return dot;
}

// ============================================================================
// 6. PERSISTENT DOCUMENT SUMMARIES (LLM + Multi-Section Executive Digest)
// ============================================================================

const DOC_SUMMARIES_FILE = path.resolve(process.cwd(), 'data/doc-summaries.json');
const SRC_DOC_SUMMARIES_FILE = path.resolve(process.cwd(), 'src/lib/data/doc-summaries.json');

interface PersistedDocSummary {
	summary: string;
	contentHash: string;
	updatedAt: string;
	source: 'llm' | 'structured';
}

let persistedSummariesCache: Record<string, PersistedDocSummary> | null = null;

function loadPersistedDocSummaries(): Record<string, PersistedDocSummary> {
	if (persistedSummariesCache) return persistedSummariesCache;
	try {
		const target = fs.existsSync(DOC_SUMMARIES_FILE)
			? DOC_SUMMARIES_FILE
			: fs.existsSync(SRC_DOC_SUMMARIES_FILE)
				? SRC_DOC_SUMMARIES_FILE
				: null;
		if (target) {
			persistedSummariesCache = JSON.parse(fs.readFileSync(target, 'utf8'));
			return persistedSummariesCache || {};
		}
	} catch {
		// Ignore read error
	}
	persistedSummariesCache = {};
	return persistedSummariesCache;
}

function savePersistedDocSummaries(store: Record<string, PersistedDocSummary>) {
	persistedSummariesCache = store;
	const serialized = JSON.stringify(store, null, 2);
	for (const file of [DOC_SUMMARIES_FILE, SRC_DOC_SUMMARIES_FILE]) {
		try {
			const dir = path.dirname(file);
			if (fs.existsSync(dir)) {
				fs.writeFileSync(file, serialized, 'utf8');
			}
		} catch {
			// Ignore write error in read-only environments
		}
	}
}

/**
 * Menyusun ringkasan multi-bagian yang sesungguhnya dari seluruh isi dokumen
 * (mencakup deskripsi inti, poin-poin penting dari bagian awal, tengah, dan akhir dokumen,
 * serta metrik/T-Code/istilah kunci), BUKAN sekadar memotong 280 karakter pertama!
 */
export function synthesizeMultiSectionDocSummary(
	title: string,
	description: string | undefined,
	outlineSummary: string,
	rawContent: string
): string {
	const lines = rawContent
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !/^!\[.*\]\(.*\)$/.test(l) && !/^[-=|:\s]+$/.test(l));

	const nonHeadingLines = lines.filter(
		(l) => !/^#{1,6}\s+/.test(l) && !/^\[(Sheet|Slide)/i.test(l) && l.toLowerCase() !== title.toLowerCase()
	);

	const cleanText = (s: string) =>
		s
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/`([^`]+)`/g, '$1')
			.replace(/^>\s*\[![A-Z]+\]\s*/i, '')
			.replace(/^[-*•]\s+/, '')
			.replace(/\s+/g, ' ')
			.trim();

	const summaryPoints: string[] = [];

	// 1. Tujuan / Deskripsi Utama Dokumen
	const cleanDesc = description ? cleanText(description) : '';
	if (cleanDesc && cleanDesc.length >= 25) {
		summaryPoints.push(cleanDesc.slice(0, 180));
	} else if (nonHeadingLines.length > 0) {
		summaryPoints.push(cleanText(nonHeadingLines[0]).slice(0, 180));
	}

	// 2. Ekstrak butir fakta kunci / rumus / spesifikasi dari bagian tengah & akhir dokumen
	const informativeBullets = nonHeadingLines.filter(
		(l, idx) =>
			idx > 0 &&
			l.length >= 30 &&
			(/^[-*•]|\d+\.\s|\*\*|[A-Z]{2,5}\b|:/.test(l)) &&
			!summaryPoints.some((sp) => l.includes(sp.slice(0, 25)))
	);

	if (informativeBullets.length > 0) {
		const midIdx = Math.floor(informativeBullets.length / 2);
		const lastIdx = informativeBullets.length - 1;
		const picks = Array.from(new Set([0, midIdx, lastIdx])).slice(0, 3);
		for (const pIdx of picks) {
			const cleaned = cleanText(informativeBullets[pIdx]).slice(0, 150);
			if (cleaned && !summaryPoints.some((sp) => sp.slice(0, 30) === cleaned.slice(0, 30))) {
				summaryPoints.push(cleaned);
			}
		}
	} else if (nonHeadingLines.length > 2) {
		const midLine = cleanText(nonHeadingLines[Math.floor(nonHeadingLines.length / 2)]).slice(0, 150);
		if (midLine) summaryPoints.push(midLine);
	}

	// 3. Jika ada struktur bab/sheet, rangkum cakupan topik utamanya
	if (outlineSummary && summaryPoints.join(' ').length < 320) {
		const topTopics = outlineSummary
			.split('|')
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 6)
			.join(', ');
		if (topTopics) {
			summaryPoints.push(`Cakupan pembahasan: ${topTopics}`);
		}
	}

	return summaryPoints.join(' — ').slice(0, 460);
}

/**
 * Membangkitkan ringkasan eksekutif dokumen menggunakan LLM sekali di awal dan menyimpannya ke disk
 * (`data/doc-summaries.json`) agar tidak perlu dibuat ulang pada setiap chat.
 */
export async function generateAndPersistLlmDocSummary(
	doc: DocumentItem
): Promise<string> {
	const docId = doc.id || doc.slug || doc.title;
	const rawContent = `${doc.content || doc.snippet || doc.description || ''}\n${doc.builderContent || ''}`.trim();
	const contentHash = hashString(rawContent).slice(0, 16);
	const store = loadPersistedDocSummaries();

	if (store[docId] && store[docId].contentHash === contentHash && store[docId].source === 'llm') {
		return store[docId].summary;
	}

	const outline = extractDocumentOutline(rawContent);
	const sampleText = [
		rawContent.slice(0, 1800),
		rawContent.length > 3600
			? rawContent.slice(Math.floor(rawContent.length / 2) - 700, Math.floor(rawContent.length / 2) + 700)
			: '',
		rawContent.length > 2200 ? rawContent.slice(-1000) : ''
	]
		.filter(Boolean)
		.join('\n...\n');

	const messages = [
		{
			role: 'system',
			content:
				'Buat ringkasan eksekutif 2-3 kalimat yang padat (maksimal 400 karakter) dalam Bahasa Indonesia yang merangkum tujuan dokumen, modul/proses utama (sertakan istilah Inggris/Indonesia & T-Code jika ada), dan cakupan isinya. Balas langsung teks ringkasannya tanpa kata pengantar.'
		},
		{
			role: 'user',
			content: `Judul: ${doc.title}\nKategori: ${doc.category}\nStruktur Bab: ${outline}\nIsi:\n${sampleText}`
		}
	];

	const res = await callAiChat(messages, AI_CONFIG.defaultModel, 220, 0.1, 15000);
	const cleanSummary = res.message.replace(/\s+/g, ' ').trim().slice(0, 460);
	if (cleanSummary.length >= 30) {
		store[docId] = {
			summary: cleanSummary,
			contentHash,
			updatedAt: new Date().toISOString(),
			source: 'llm'
		};
		savePersistedDocSummaries(store);
		cachedIndexKey = ''; // Trigger index refresh with new LLM summary
	}
	return cleanSummary;
}

// ============================================================================
// 7. ASSISTANT HISTORY MESSAGE COMPRESSION (Preserves Sources & Key Facts)
// ============================================================================

/**
 * Mengompresi pesan balasan AI yang lama (>2 giliran lalu) tanpa memotong mentah di tengah kalimat
 * dan WAJIB mempertahankan daftar Sumber Referensi, tautan dokumen `(/docs/...)`, nomor tiket,
 * serta kesimpulan/fakta utama di bagian akhir jawaban.
 */
export function compressAssistantHistoryMessage(content: string, maxChars = 1350): string {
	if (!content || typeof content !== 'string') return '';
	const trimmed = content.trim();
	if (trimmed.length <= maxChars) return trimmed;

	// 1. Pisahkan bagian Sumber Referensi / tautan di akhir pesan agar 100% utuh
	let mainBody = trimmed;
	let preservedFooter = '';

	const refSectionMatch = trimmed.match(
		/(\n+(?:#{1,4}\s*)?(?:\*\*)?(?:📄\s*)?(?:Sumber\s+Referensi|Sumber\s+Dokumen|Referensi|Sources?)\b[\s\S]*)$/i
	);
	if (refSectionMatch && refSectionMatch.index !== undefined) {
		mainBody = trimmed.slice(0, refSectionMatch.index).trim();
		preservedFooter = refSectionMatch[1].trim();
	}

	// Kumpulkan semua tautan dokumen internal & nomor tiket yang muncul di mana saja dalam jawaban
	const docLinks = Array.from(
		new Set(trimmed.match(/\[[^\]]+\]\(\/(?:docs|my-docs)\/[^)]+\)/g) || [])
	);
	const ticketRefs = Array.from(
		new Set(trimmed.match(/Tiket\s*#\d+/gi) || [])
	);

	if (!preservedFooter && (docLinks.length > 0 || ticketRefs.length > 0)) {
		const footerParts: string[] = [];
		if (docLinks.length > 0) footerParts.push(`Sumber Referensi: ${docLinks.join(', ')}`);
		if (ticketRefs.length > 0) footerParts.push(`Tiket Terkait: ${ticketRefs.join(', ')}`);
		preservedFooter = footerParts.join(' | ');
	}

	const footerBudget = preservedFooter ? preservedFooter.length + 20 : 0;
	const bodyBudget = Math.max(400, maxChars - footerBudget - 60);

	const paragraphs = mainBody.split(/\n{2,}/);
	const introParts: string[] = [];
	let currentLen = 0;

	// 2. Ambil paragraf pembuka secara utuh (maks ~55% dari bodyBudget)
	const introLimit = Math.floor(bodyBudget * 0.55);
	let pIdx = 0;
	while (pIdx < paragraphs.length && currentLen < introLimit) {
		const p = paragraphs[pIdx].trim();
		if (currentLen + p.length <= introLimit) {
			introParts.push(p);
			currentLen += p.length + 2;
			pIdx++;
		} else {
			if (introParts.length === 0) {
				// Potong di batas kalimat atau spasi terdekat, bukan di tengah kata
				const slice = p.slice(0, introLimit);
				const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
				introParts.push(sentenceEnd > 120 ? slice.slice(0, sentenceEnd + 1) : slice);
				currentLen += introParts[0].length;
				pIdx++;
			}
			break;
		}
	}

	// 3. Dari sisa paragraf (tengah s/d akhir), pilih baris fakta penting (angka, poin bold, heading, tiket, kesimpulan)
	const remainingLines = paragraphs
		.slice(pIdx)
		.join('\n')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	const keyFactLines: string[] = [];
	const tailBudget = bodyBudget - currentLen;

	// Prioritaskan baris yang memuat angka/statistik, cetak tebal, heading, atau paragraf penutup terakhir
	const scoredLines = remainingLines.map((line, idx) => {
		let priority = 0;
		if (/^#{1,4}\s+/.test(line)) priority += 4;
		if (/\*\*[^*]+\*\*/.test(line)) priority += 3;
		if (/\b\d+(?:[.,]\d+)?%?|\bTiket\s*#\d+/i.test(line)) priority += 4;
		if (/\[[^\]]+\]\([^)]+\)/.test(line)) priority += 5;
		if (idx >= remainingLines.length - 3) priority += 3; // Baris kesimpulan akhir
		return { line, idx, priority };
	});

	scoredLines.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
	const selectedLineIndices = new Set<number>();
	let usedTailChars = 0;
	for (const item of scoredLines) {
		if (usedTailChars + item.line.length + 1 > tailBudget) continue;
		selectedLineIndices.add(item.idx);
		usedTailChars += item.line.length + 1;
	}

	for (let i = 0; i < remainingLines.length; i++) {
		if (selectedLineIndices.has(i)) {
			keyFactLines.push(remainingLines[i]);
		}
	}

	const sections: string[] = [introParts.join('\n\n')];
	if (keyFactLines.length > 0) {
		sections.push(`...[poin fakta & kesimpulan utama dipertahankan]...\n${keyFactLines.join('\n')}`);
	}
	if (preservedFooter) {
		sections.push(preservedFooter);
	}

	return sections.filter(Boolean).join('\n\n');
}

// ============================================================================
// 8. HYBRID BM25 + SEMANTIC VECTOR RETRIEVAL & CONTEXT MEMORY ENGINE
// ============================================================================

export interface AiSourceLink {
	title: string;
	url: string;
	category: string;
	type: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC';
	badge: string;
	fileUrl?: string;
}

export interface DocDigest {
	docId: string;
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC';
	title: string;
	fileName: string;
	category: string;
	subcategory?: string;
	pathOrLoc: string;
	docUrl: string;
	ownerName?: string;
	tags: string[];
	outlineSummary: string;
	executiveSummary: string;
	digestCard: string;
	totalParts: number;
	embedding: Float32Array;
}

export interface DocChunk {
	chunkId: string;
	globalIndex: number; // Disimpan langsung (O(1)) agar tidak pernah memanggil allChunks.indexOf() di dalam loop
	docId: string;
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC';
	title: string;
	fileName: string;
	category: string;
	subcategory?: string;
	pathOrLoc: string;
	docUrl: string;
	ownerName?: string;
	tags: string[];
	outlineSummary: string;
	partNumber: number;
	totalParts: number;
	text: string;
	titleLower: string;
	metaLower: string;
	textLower: string;
	termFreqs: Map<string, number>;
	docLen: number;
	embedding: Float32Array;
}

export function extractQueryKeywords(text: string): string[] {
	if (!text || typeof text !== 'string') return [];
	const cleaned = text
		.toLowerCase()
		.replace(/[^a-z0-9_/-]+/g, ' ')
		.trim();

	const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
	return Array.from(new Set(tokens));
}

function extractQueryBigrams(keywords: string[]): string[] {
	const bigrams: string[] = [];
	for (let i = 0; i < keywords.length - 1; i++) {
		bigrams.push(`${keywords[i]} ${keywords[i + 1]}`);
	}
	return bigrams;
}

export function extractDocumentOutline(rawText: string): string {
	if (!rawText) return '';
	const headings: string[] = [];
	const lines = rawText.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (/^#{1,4}\s+.+/.test(trimmed)) {
			headings.push(trimmed.replace(/^#+\s*/, '').trim());
		} else if (/^\[(Sheet|Slide)[^\]]+\]/i.test(trimmed)) {
			const match = trimmed.match(/^\[([^\]]+)\]/);
			if (match) headings.push(match[1]);
		}
		if (headings.length >= 18) break;
	}
	return headings.length > 0 ? headings.join(' | ') : '';
}

function buildPrecomputedDigestCard(
	title: string,
	category: string,
	pathOrLoc: string,
	docUrl: string,
	outlineSummary: string,
	executiveSummary: string,
	totalParts: number
): string {
	const parts: string[] = [
		`• Judul: "${title}" | Kategori: ${category} | Link Dokumen: ${docUrl} | Lokasi: ${pathOrLoc} (${totalParts} bagian)`
	];
	if (outlineSummary) {
		parts.push(`• Peta Bab/Sheet: ${outlineSummary}`);
	}
	if (executiveSummary) {
		parts.push(`• Ringkasan Intisari: ${executiveSummary}`);
	}
	return parts.join('\n');
}

export function buildSmartActiveDocContext(
	rawDocText: string,
	query: string,
	maxChars = 10000,
	isFollowUpTurn = false
): string {
	const clean = (rawDocText || '').trim();
	if (!clean) return '';

	const outline = extractDocumentOutline(clean);
	const outlineHeader = outline ? `[PETA STRUKTUR BAB / SHEET DOKUMEN INI]: ${outline}\n` : '';
	const execSummary = synthesizeMultiSectionDocSummary('Dokumen Aktif', undefined, outline, clean);

	const effectiveBudget = isFollowUpTurn ? Math.min(maxChars, 3200) : maxChars;

	if (clean.length <= effectiveBudget) {
		return `${outlineHeader}\n${clean}`.trim();
	}

	const keywords = extractQueryKeywords(query);
	const expandedKeywords = expandBilingualQueryTerms(keywords);
	const queryEmbedding = computeSemanticEmbedding(query);
	const segSize = 1400;
	const segments: Array<{ index: number; text: string; score: number }> = [];

	for (let pos = 0, idx = 0; pos < clean.length; pos += segSize - 200, idx++) {
		const segText = clean.slice(pos, pos + segSize);
		const segLower = segText.toLowerCase();
		let score = 0;
		for (const kw of keywords) {
			const stem = stemWord(kw);
			if (segLower.includes(kw)) {
				score += 6 + Math.min(countOccurrences(segLower, kw), 4) * 2.5;
			} else if (stem.length >= 3 && segLower.includes(stem)) {
				score += 4.5;
			}
		}
		for (const syn of expandedKeywords) {
			if (syn.length >= 3 && segLower.includes(syn)) {
				score += 3.5;
			}
		}
		const segVec = computeSemanticEmbedding(segText);
		score += Math.max(0, cosineSimilarity(queryEmbedding, segVec)) * 10;

		if (idx === 0 && score === 0) score = 1;
		segments.push({ index: idx, text: segText, score });
	}

	segments.sort((a, b) => b.score - a.score || a.index - b.index);
	const maxSegments = Math.max(1, Math.floor(effectiveBudget / segSize));
	const chosenSegments = segments
		.slice(0, maxSegments)
		.sort((a, b) => a.index - b.index);

	const hasFirstSegment = chosenSegments.some((s) => s.index === 0);

	return [
		outlineHeader.trim(),
		!hasFirstSegment ? `[RINGKASAN INTISARI DOKUMEN]:\n${execSummary}` : '',
		...chosenSegments.map(
			(seg) => `--- [KUTIPAN BAB RELEVAN (Segmen #${seg.index + 1})] ---\n${seg.text.trim()}`
		)
	]
		.filter(Boolean)
		.join('\n\n');
}

function buildBaseTermFreqs(
	titleLower: string,
	metaLower: string
): { baseMap: Map<string, number>; baseLen: number } {
	const baseMap = new Map<string, number>();
	let baseLen = 0;

	const addTokens = (source: string, weight: number) => {
		const words = source.replace(/[^a-z0-9_/-]+/g, ' ').split(/\s+/);
		for (const w of words) {
			if (w.length < 2 || STOPWORDS.has(w)) continue;
			baseLen += weight;
			baseMap.set(w, (baseMap.get(w) || 0) + weight);
			const stem = stemWord(w);
			if (stem && stem !== w && stem.length >= 2) {
				baseMap.set(stem, (baseMap.get(stem) || 0) + weight * 0.9);
			}
		}
	};

	addTokens(titleLower, 3.0);
	addTokens(metaLower, 2.0);
	return { baseMap, baseLen };
}

function buildChunkTermFreqs(
	baseMap: Map<string, number>,
	baseLen: number,
	textLower: string
): { termFreqs: Map<string, number>; docLen: number } {
	const termFreqs = new Map<string, number>(baseMap);
	let docLen = baseLen;

	const words = textLower.replace(/[^a-z0-9_/-]+/g, ' ').split(/\s+/);
	for (const w of words) {
		if (w.length < 2 || STOPWORDS.has(w)) continue;
		docLen += 1.0;
		termFreqs.set(w, (termFreqs.get(w) || 0) + 1.0);
		const stem = stemWord(w);
		if (stem && stem !== w && stem.length >= 2) {
			termFreqs.set(stem, (termFreqs.get(stem) || 0) + 0.9);
		}
	}

	return { termFreqs, docLen: Math.max(10, docLen) };
}

function splitDocumentIntoChunks(
	doc: DocumentItem & { ownerName?: string },
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC',
	persistedSummaries: Record<string, PersistedDocSummary>,
	chunkSize = 1150,
	overlap = 180
): { chunks: DocChunk[]; digest: DocDigest } | null {
	const mainText = (doc.content || doc.snippet || doc.description || '').trim();
	const builderText = doc.builderContent
		? `\n\n[SPESIFIKASI STORY BUILDER SAC]:\n${doc.builderContent.trim()}`
		: '';
	const rawContent = `${mainText}${builderText}`.trim();
	if (!rawContent) return null;

	const docId = doc.id || doc.slug || doc.title;
	const title = (doc.title || doc.fileName || 'Dokumen Tanpa Judul').trim();
	const fileName = (doc.fileName || doc.title || '').trim();
	const category = (doc.category || 'Umum').trim();
	const subcategory = doc.subcategory ? doc.subcategory.trim() : undefined;
	const pathOrLoc =
		sourceType === 'SYNC_DOC'
			? doc.relativePath || doc.category || fileName
			: sourceType === 'USER_NOTE'
				? `/my-docs/${doc.slug || doc.id}`
				: `/docs/${doc.slug || doc.id}`;
	const docUrl =
		sourceType === 'SYNC_DOC'
			? `/docs/${doc.slug || `external/${doc.id}`}`
			: sourceType === 'USER_NOTE'
				? `/my-docs/${doc.slug || doc.id}`
				: `/docs/${doc.slug || doc.id}`;
	const tags = Array.isArray(doc.tags) ? doc.tags : [];
	const outlineSummary = extractDocumentOutline(rawContent);

	// Ambil ringkasan LLM dari disk jika tersedia, atau sintesis ringkasan multi-bagian seluruh dokumen
	const persisted = persistedSummaries[docId]?.summary;
	const executiveSummary =
		persisted ||
		synthesizeMultiSectionDocSummary(title, doc.description, outlineSummary, rawContent);

	const titleLower = `${title} ${fileName}`.toLowerCase();
	const metaLower = `${category} ${subcategory || ''} ${tags.join(' ')} ${pathOrLoc} ${doc.ownerName || ''} ${outlineSummary} ${executiveSummary}`.toLowerCase();

	const textParts: string[] = [];
	if (rawContent.length <= chunkSize + 200) {
		textParts.push(rawContent);
	} else {
		let start = 0;
		const len = rawContent.length;
		while (start < len) {
			let end = Math.min(start + chunkSize, len);
			if (end < len) {
				const paragraphBreak = rawContent.lastIndexOf('\n\n', end);
				const lineBreak = rawContent.lastIndexOf('\n', end);
				const spaceBreak = rawContent.lastIndexOf(' ', end);

				if (paragraphBreak > start + chunkSize * 0.55) {
					end = paragraphBreak;
				} else if (lineBreak > start + chunkSize * 0.65) {
					end = lineBreak;
				} else if (spaceBreak > start + chunkSize * 0.75) {
					end = spaceBreak;
				}
			}

			const slice = rawContent.slice(start, end).trim();
			if (slice.length > 0) {
				textParts.push(slice);
			}
			if (end >= len) break;
			start = Math.max(start + 1, end - overlap);
		}
	}

	const totalParts = textParts.length;
	const digest: DocDigest = {
		docId,
		sourceType,
		title,
		fileName,
		category,
		subcategory,
		pathOrLoc,
		docUrl,
		ownerName: doc.ownerName,
		tags,
		outlineSummary,
		executiveSummary,
		digestCard: buildPrecomputedDigestCard(
			title,
			category,
			pathOrLoc,
			docUrl,
			outlineSummary,
			executiveSummary,
			totalParts
		),
		totalParts,
		embedding: new Float32Array(EMBEDDING_DIM)
	};

	const { baseMap, baseLen } = buildBaseTermFreqs(titleLower, metaLower);

	const chunks: DocChunk[] = textParts.map((text, idx) => {
		const textLower = text.toLowerCase();
		const { termFreqs, docLen } = buildChunkTermFreqs(baseMap, baseLen, textLower);
		return {
			chunkId: `${docId}#${idx + 1}`,
			globalIndex: -1, // Diisi saat registrasi ke allChunks
			docId,
			sourceType,
			title,
			fileName,
			category,
			subcategory,
			pathOrLoc,
			docUrl,
			ownerName: doc.ownerName,
			tags,
			outlineSummary,
			partNumber: idx + 1,
			totalParts,
			text,
			titleLower,
			metaLower,
			textLower,
			termFreqs,
			docLen,
			embedding: new Float32Array(EMBEDDING_DIM)
		};
	});

	return { chunks, digest };
}

// Pre-computed singleton memory store (Only built once when data changes, 0ms per chat request)
let cachedIndexKey = '';
let cachedAllChunks: DocChunk[] = [];
let cachedChunksByDocId = new Map<string, DocChunk[]>();
let cachedDigestsByDocId = new Map<string, DocDigest>();
let cachedInvertedIndex = new Map<string, Set<number>>(); // token/stem -> chunk globalIndices (O(1))
let cachedPrefixIndex = new Map<string, Set<number>>(); // 4 & 5 char prefix -> chunk globalIndices (O(1), tanpa scan invertedIndex!)
let cachedIdfMap = new Map<string, number>(); // token/stem -> BM25 IDF weight
let cachedAvgChunkLen = 250;
let cachedDocFuse: Fuse<DocDigest> | null = null;
let cachedAppFuse: Fuse<any> | null = null;
let cachedPortalCount = 0;
let cachedExtCount = 0;
let cachedPortalCatalogLine = '';
let cachedExtCatalogLine = '';

function isNoteOwnedByUser(ownerName?: string, currentUserName?: string | null): boolean {
	if (!currentUserName) return false;
	if (!ownerName) return false;
	return sanitizeUserName(ownerName) === sanitizeUserName(currentUserName);
}

let lastIndexStatCheckMs = 0;

export function getSearchIndices() {
	const now = Date.now();
	const fastVersionKey = `${getDataVersion()}_${getUserNotesVersion()}`;
	if (
		cachedDocFuse &&
		cachedAppFuse &&
		cachedIndexKey.startsWith(fastVersionKey + '_') &&
		now - lastIndexStatCheckMs < 5000
	) {
		return {
			allChunks: cachedAllChunks,
			chunksByDocId: cachedChunksByDocId,
			digestsByDocId: cachedDigestsByDocId,
			invertedIndex: cachedInvertedIndex,
			prefixIndex: cachedPrefixIndex,
			idfMap: cachedIdfMap,
			avgChunkLen: cachedAvgChunkLen,
			docFuse: cachedDocFuse,
			appFuse: cachedAppFuse,
			portalCount: cachedPortalCount,
			extCount: cachedExtCount,
			portalCatalogLine: cachedPortalCatalogLine,
			extCatalogLine: cachedExtCatalogLine
		};
	}
	lastIndexStatCheckMs = now;

	const docs = loadDocuments();
	const userNotes = loadAllUserNotes();
	const extDocs = loadExternalDocuments();
	const apps = loadApps();
	const persistedSummaries = loadPersistedDocSummaries();

	const indexKey = `${getDataVersion()}_${getUserNotesVersion()}_${docs.length}_${userNotes.length}_${extDocs.length}_${apps.length}`;

	if (!cachedDocFuse || !cachedAppFuse || cachedIndexKey !== indexKey) {
		const allChunks: DocChunk[] = [];
		const byDocId = new Map<string, DocChunk[]>();
		const digestsByDocId = new Map<string, DocDigest>();
		const invertedIdx = new Map<string, Set<number>>();
		const prefixIdx = new Map<string, Set<number>>();
		const docFreqMap = new Map<string, number>();

		const addWordToIndices = (word: string, chunkArrayIdx: number) => {
			if (word.length < 2 || STOPWORDS.has(word)) return;
			let bucket = invertedIdx.get(word);
			if (!bucket) {
				bucket = new Set<number>();
				invertedIdx.set(word, bucket);
			}
			bucket.add(chunkArrayIdx);

			// Index 4-char & 5-char prefixes once at build time so query-time prefix matching is O(1)
			if (word.length >= 4 && !GENERIC_MODIFIER_WORDS.has(word)) {
				const p4 = word.slice(0, 4);
				let p4Set = prefixIdx.get(p4);
				if (!p4Set) {
					p4Set = new Set<number>();
					prefixIdx.set(p4, p4Set);
				}
				if (p4Set.size < 350) p4Set.add(chunkArrayIdx);

				if (word.length >= 5) {
					const p5 = word.slice(0, 5);
					let p5Set = prefixIdx.get(p5);
					if (!p5Set) {
						p5Set = new Set<number>();
						prefixIdx.set(p5, p5Set);
					}
					if (p5Set.size < 350) p5Set.add(chunkArrayIdx);
				}
			}
		};

		const registerDoc = (
			doc: DocumentItem & { ownerName?: string },
			sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC'
		) => {
			const res = splitDocumentIntoChunks(doc, sourceType, persistedSummaries);
			if (!res) return;
			digestsByDocId.set(res.digest.docId, res.digest);
			byDocId.set(res.digest.docId, res.chunks);

			for (const c of res.chunks) {
				const chunkArrayIdx = allChunks.length;
				c.globalIndex = chunkArrayIdx;
				allChunks.push(c);

				for (const term of c.termFreqs.keys()) {
					addWordToIndices(term, chunkArrayIdx);
					docFreqMap.set(term, (docFreqMap.get(term) || 0) + 1);
				}
			}
		};

		for (const note of userNotes) registerDoc(note, 'USER_NOTE');
		for (const doc of docs) registerDoc(doc, 'PORTAL_DOC');
		for (const ext of extDocs) registerDoc(ext, 'SYNC_DOC');

		// Hitung BM25 IDF = ln(1 + (N - df + 0.5) / (df + 0.5)) dan rata-rata panjang chunk (avgdl)
		const totalChunks = Math.max(1, allChunks.length);
		const idfMap = new Map<string, number>();
		for (const [term, df] of docFreqMap.entries()) {
			const idf = Math.log(1 + (totalChunks - df + 0.5) / (df + 0.5));
			idfMap.set(term, Math.max(0.15, idf));
		}

		let totalLen = 0;
		for (const c of allChunks) {
			totalLen += c.docLen;
			c.embedding = computeEmbeddingFromTermFreqs(c.termFreqs, idfMap);
		}
		for (const d of digestsByDocId.values()) {
			const firstChunk = byDocId.get(d.docId)?.[0];
			d.embedding = firstChunk
				? firstChunk.embedding
				: computeSemanticEmbedding(
						`${d.category} ${d.tags.join(' ')} ${d.outlineSummary} ${d.executiveSummary}`,
						idfMap,
						`${d.title} ${d.fileName}`
					);
		}

		cachedAllChunks = allChunks;
		cachedChunksByDocId = byDocId;
		cachedDigestsByDocId = digestsByDocId;
		cachedInvertedIndex = invertedIdx;
		cachedPrefixIndex = prefixIdx;
		cachedIdfMap = idfMap;
		cachedAvgChunkLen = totalChunks > 0 ? totalLen / totalChunks : 250;

		cachedDocFuse = new Fuse(Array.from(digestsByDocId.values()), {
			keys: [
				{ name: 'title', weight: 0.4 },
				{ name: 'fileName', weight: 0.25 },
				{ name: 'executiveSummary', weight: 0.2 },
				{ name: 'category', weight: 0.1 },
				{ name: 'tags', weight: 0.05 }
			],
			threshold: 0.38,
			ignoreLocation: true
		});

		cachedAppFuse = new Fuse(apps, {
			keys: [
				{ name: 'title', weight: 0.4 },
				{ name: 'subtitle', weight: 0.3 },
				{ name: 'description', weight: 0.2 },
				{ name: 'tags', weight: 0.1 }
			],
			threshold: 0.4,
			ignoreLocation: true
		});

		cachedPortalCount = docs.length;
		cachedExtCount = extDocs.length;

		const portalTitles = docs.map((d) => `"${d.title}" [${d.section || 'DOC'}]`);
		const extCategoryCounts = new Map<string, number>();
		for (const e of extDocs) {
			const cat = e.category || 'Umum';
			extCategoryCounts.set(cat, (extCategoryCounts.get(cat) || 0) + 1);
		}
		const extCatSummary = Array.from(extCategoryCounts.entries())
			.slice(0, 15)
			.map(([c, count]) => `${c} (${count})`)
			.join(', ');
		const sampleExtTitles = extDocs
			.slice(0, 25)
			.map((e) => e.fileName || e.title)
			.join(', ');

		cachedPortalCatalogLine = `2. Dokumentasi Portal (${docs.length} dokumen): ${portalTitles.slice(0, 25).join(', ')}`;
		cachedExtCatalogLine = `3. Dokumen Sinkronisasi Eksternal (${extDocs.length} berkas): Kategori [${extCatSummary}] | Contoh: ${sampleExtTitles}`;

		cachedIndexKey = indexKey;
	}

	return {
		allChunks: cachedAllChunks,
		chunksByDocId: cachedChunksByDocId,
		digestsByDocId: cachedDigestsByDocId,
		invertedIndex: cachedInvertedIndex,
		prefixIndex: cachedPrefixIndex,
		idfMap: cachedIdfMap,
		avgChunkLen: cachedAvgChunkLen,
		docFuse: cachedDocFuse!,
		appFuse: cachedAppFuse!,
		portalCount: cachedPortalCount,
		extCount: cachedExtCount,
		portalCatalogLine: cachedPortalCatalogLine,
		extCatalogLine: cachedExtCatalogLine
	};
}

function countOccurrences(haystack: string, needle: string): number {
	if (!needle || !haystack) return 0;
	let count = 0;
	let pos = 0;
	while ((pos = haystack.indexOf(needle, pos)) !== -1) {
		count++;
		pos += needle.length;
	}
	return count;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

function computeBm25TermScore(
	tf: number,
	idf: number,
	docLen: number,
	avgDocLen: number
): number {
	if (tf <= 0) return 0;
	const normLen = 1 - BM25_B + BM25_B * (docLen / Math.max(1, avgDocLen));
	return idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * normLen));
}

/**
 * Hybrid Knowledge Retrieval (BM25 dengan IDF + Stemming Bahasa Indonesia/Inggris + Semantic Vector Embedding):
 * 1. Menggunakan Inverted Index, Prefix Index O(1), dan Pre-Computed Semantic Embeddings di RAM.
 * 2. Menggabungkan skor leksikal BM25 (berbobot IDF & normalisasi panjang dokumen) dengan
 *    Cosine Similarity dari Semantic Embedding Lintas Bahasa (Indonesia <-> Inggris).
 * 3. Menyertakan Kartu Intisari Dokumen (Executive Summary) + Kutipan Bab paling relevan.
 */
export function retrieveRelevantKnowledge(
	query: string,
	history?: Array<{ role: string; content: string }>,
	activeDocHint?: string,
	currentUserName?: string | null
): {
	knowledgeText: string;
	hasMatches: boolean;
	extractedKeywords: string[];
	sources: AiSourceLink[];
} {
	const {
		allChunks,
		chunksByDocId,
		digestsByDocId,
		invertedIndex,
		prefixIndex,
		idfMap,
		avgChunkLen,
		docFuse,
		appFuse,
		portalCount,
		extCount,
		portalCatalogLine,
		extCatalogLine
	} = getSearchIndices();
	const startHr = performance.now();

	const canAccessDigest = (d: DocDigest) =>
		d.sourceType !== 'USER_NOTE' || isNoteOwnedByUser(d.ownerName, currentUserName);
	const canAccessChunk = (c: DocChunk) =>
		c.sourceType !== 'USER_NOTE' || isNoteOwnedByUser(c.ownerName, currentUserName);

	const cleanQuery = (query || '').trim();
	const primaryKeywords = extractQueryKeywords(cleanQuery);
	const primaryStems = Array.from(
		new Set(primaryKeywords.map((k) => stemWord(k)).filter((s) => s.length >= 2))
	);
	const keywordSynonymMap = new Map<string, string[]>();
	const bilingualExpansionsSet = new Set<string>();
	for (const kw of primaryKeywords) {
		const syns = getBilingualSynonymsForWord(kw);
		keywordSynonymMap.set(kw, syns);
		for (const s of syns) bilingualExpansionsSet.add(s);
	}
	const bilingualExpansions = Array.from(bilingualExpansionsSet);
	const isFollowUpTurn = Array.isArray(history) && history.length >= 2;

	const historyKeywords: string[] = [];
	const recentHistoryTextLower: string[] = [];
	if (Array.isArray(history) && history.length > 0) {
		const recentMessages = history.slice(-4);
		for (const msg of recentMessages) {
			if (msg && typeof msg.content === 'string') {
				recentHistoryTextLower.push(msg.content.toLowerCase());
				const kws = extractQueryKeywords(msg.content);
				historyKeywords.push(...kws.slice(0, 8));
			}
		}
	}

	const combinedHistoryLower = recentHistoryTextLower.join('\n');
	const activeHintLower = (activeDocHint || '').toLowerCase().trim();
	const qLower = cleanQuery.toLowerCase();

	const refersToActivePage = [
		'dokumen ini',
		'halaman ini',
		'catatan ini',
		'note ini',
		'artikel ini',
		'modul ini',
		'rangkum ini',
		'jelaskan ini'
	].some((phrase) => qLower.includes(phrase));

	// Identifikasi dokumen yang sedang dibicarakan di pesan sebelumnya (Sticky Document IDs)
	const stickyDocIds = new Set<string>();
	if (combinedHistoryLower.length > 0 || (refersToActivePage && activeHintLower.length > 0)) {
		for (const [docId, digest] of digestsByDocId.entries()) {
			if (!canAccessDigest(digest)) continue;
			const titleL = digest.title.toLowerCase();
			const fileL = digest.fileName.toLowerCase();
			if (
				(titleL.length >= 4 && combinedHistoryLower.includes(titleL)) ||
				(fileL.length >= 4 && combinedHistoryLower.includes(fileL)) ||
				(refersToActivePage &&
					activeHintLower.length >= 4 &&
					(titleL.includes(activeHintLower) || activeHintLower.includes(titleL)))
			) {
				stickyDocIds.add(docId);
			}
		}
	}

	const uniqueHistoryKeywords = Array.from(new Set(historyKeywords)).filter(
		(k) => !primaryKeywords.includes(k)
	);
	const allActiveKeywords = [...primaryKeywords, ...uniqueHistoryKeywords.slice(0, 6)];
	const specificPrimaryKeywords = primaryKeywords.filter((k) => !GENERIC_MODIFIER_WORDS.has(k));
	const bigrams = extractQueryBigrams(primaryKeywords);

	const asksAboutDocsOrNotes =
		qLower.includes('dokumen') ||
		qLower.includes('document') ||
		qLower.includes('note') ||
		qLower.includes('catatan') ||
		qLower.includes('panduan') ||
		qLower.includes('manual') ||
		qLower.includes('sinkron');
	const isTicketDbFocused =
		!asksAboutDocsOrNotes &&
		/\b(tiket|tickets?|helpdesk|antrian\s+tiket|antrean\s+tiket|status\s+tiket|unassigned|pic\s+helpdesk)\b/i.test(
			qLower
		);

	const isCatalogQuestion =
		qLower.includes('dokumen apa saja') ||
		qLower.includes('note apa saja') ||
		qLower.includes('catatan apa saja') ||
		qLower.includes('daftar dokumen') ||
		qLower.includes('daftar note') ||
		qLower.includes('daftar catatan') ||
		qLower.includes('apa saja isi note') ||
		qLower.includes('apa saja isi dokumen') ||
		qLower.includes('berapa dokumen');

	// Hitung vektor embedding semantik untuk query pengguna
	const queryEmbedding = computeSemanticEmbedding(cleanQuery, idfMap);

	// 1. Kumpulkan kandidat chunk secara O(1) melalui Inverted Index (raw + stem + bilingual expansion) & Prefix Index
	const candidateChunkIndices = new Set<number>();
	const lookupTerms = new Set<string>([
		...allActiveKeywords,
		...primaryStems,
		...bilingualExpansions
	]);

	for (const term of lookupTerms) {
		const exactSet = invertedIndex.get(term);
		if (exactSet) {
			for (const idx of exactSet) candidateChunkIndices.add(idx);
		}
	}

	// O(1) Prefix Index Lookup (menggantikan full-scan invertedIndex.entries())
	for (const kw of primaryKeywords) {
		if (kw.length >= 4 && !GENERIC_MODIFIER_WORDS.has(kw)) {
			const prefSet =
				(kw.length >= 5 ? prefixIndex.get(kw.slice(0, 5)) : undefined) ||
				prefixIndex.get(kw.slice(0, 4));
			if (prefSet) {
				for (const idx of prefSet) candidateChunkIndices.add(idx);
			}
		}
	}

	// 2. Semantic Vector Candidate Retrieval: temukan dokumen yang relevan secara makna (Cosine Similarity)
	//    meskipun kata kuncinya berbeda bahasa (misal "cara bayar pemasok" -> "Vendor Payment" / "AP & AR Highlight")
	if (!isTicketDbFocused && cleanQuery.length >= 3) {
		const semanticDocHits: Array<{ docId: string; sim: number }> = [];
		for (const [docId, digest] of digestsByDocId.entries()) {
			if (!canAccessDigest(digest)) continue;
			const sim = cosineSimilarity(queryEmbedding, digest.embedding);
			if (sim >= 0.22) {
				semanticDocHits.push({ docId, sim });
			}
		}
		semanticDocHits.sort((a, b) => b.sim - a.sim);
		for (const hit of semanticDocHits.slice(0, 12)) {
			const docChunks = chunksByDocId.get(hit.docId) || [];
			for (const dc of docChunks) {
				if (dc.globalIndex >= 0) candidateChunkIndices.add(dc.globalIndex);
			}
		}
	}

	// 3. Sertakan semua chunk dari Sticky Docs menggunakan dc.globalIndex langsung (O(1), tanpa allChunks.indexOf!)
	if (stickyDocIds.size > 0) {
		for (const docId of stickyDocIds) {
			const docChunks = chunksByDocId.get(docId) || [];
			for (const dc of docChunks) {
				if (dc.globalIndex >= 0) candidateChunkIndices.add(dc.globalIndex);
			}
		}
	}

	// 4. Hitung Hybrid Score = BM25 (IDF + Length Norm) + Semantic Embedding Cosine Similarity + Phrase Bigram Bonus
	const chunkScores = new Map<string, { chunk: DocChunk; score: number }>();

	for (const chunkIdx of candidateChunkIndices) {
		const chunk = allChunks[chunkIdx];
		if (!chunk || !canAccessChunk(chunk)) continue;

		let bm25Score = 0;
		let matchedPrimaryCount = 0;
		let matchedSpecificCount = 0;

		if (stickyDocIds.has(chunk.docId)) {
			bm25Score += 18;
		}

		for (const bg of bigrams) {
			if (chunk.titleLower.includes(bg)) bm25Score += 18;
			if (chunk.metaLower.includes(bg)) bm25Score += 10;
			if (chunk.textLower.includes(bg)) bm25Score += 12;
		}

		// Skor BM25 Berbasis Konsep per Kata Kunci (mencocokkan kata asli, kata dasar/stem, maupun terjemahan lintas bahasa)
		for (const kw of primaryKeywords) {
			const stem = stemWord(kw);
			const tfRaw = chunk.termFreqs.get(kw) || 0;
			const tfStem = stem !== kw ? chunk.termFreqs.get(stem) || 0 : 0;
			const directTf = Math.max(tfRaw, tfStem * 0.92);

			// Cek juga padanan kata lintas bahasa (Indonesia <-> Inggris) untuk konsep kata kunci ini
			let bestSynTf = 0;
			let bestSynIdf = 2.0;
			const syns = keywordSynonymMap.get(kw) || [];
			for (const syn of syns) {
				const sTf = chunk.termFreqs.get(syn) || 0;
				if (sTf > bestSynTf) {
					bestSynTf = sTf;
					bestSynIdf = idfMap.get(syn) ?? 2.2;
				}
			}

			if (directTf > 0) {
				const idf =
					idfMap.get(kw) ?? idfMap.get(stem) ?? (GENERIC_MODIFIER_WORDS.has(kw) ? 0.6 : 2.5);
				bm25Score += computeBm25TermScore(directTf, idf, chunk.docLen, avgChunkLen) * 3.4;
				if (bestSynTf > 0) {
					// Bonus penguat jika dokumen memuat istilah dwibahasa sekaligus
					bm25Score += computeBm25TermScore(bestSynTf, bestSynIdf, chunk.docLen, avgChunkLen) * 1.1;
				}
				matchedPrimaryCount++;
				if (!GENERIC_MODIFIER_WORDS.has(kw)) {
					matchedSpecificCount++;
				}
			} else if (bestSynTf > 0) {
				// Cocok melalui translasi konsep lintas bahasa (misal "bayar" -> "payment"/"payable"/"ap")
				bm25Score += computeBm25TermScore(bestSynTf, bestSynIdf, chunk.docLen, avgChunkLen) * 2.8;
				matchedPrimaryCount++;
				if (!GENERIC_MODIFIER_WORDS.has(kw)) {
					matchedSpecificCount++;
				}
			} else if (kw.length >= 4 && !GENERIC_MODIFIER_WORDS.has(kw)) {
				// Substring match untuk istilah majemuk/kode teknis
				if (chunk.titleLower.includes(kw)) {
					bm25Score += 7;
					matchedPrimaryCount++;
					matchedSpecificCount++;
				} else if (chunk.textLower.includes(kw)) {
					bm25Score += 4;
					matchedPrimaryCount++;
					matchedSpecificCount++;
				}
			}
		}

		// Skor Kemiripan Vektor Semantik (Cosine Similarity antara vektor query dan vektor chunk + digest dokumen)
		const chunkCosine = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
		const docDigest = digestsByDocId.get(chunk.docId);
		const docCosine = docDigest
			? Math.max(0, cosineSimilarity(queryEmbedding, docDigest.embedding))
			: chunkCosine;
		const combinedSemanticSim = chunkCosine * 0.6 + docCosine * 0.4;
		const semanticScore = combinedSemanticSim >= 0.2 ? combinedSemanticSim * 24 : 0;

		// Abaikan dokumen yang HANYA cocok pada kata umum ("status", "ringkasan") tanpa kecocokan konsep spesifik maupun makna semantik
		if (
			specificPrimaryKeywords.length > 0 &&
			matchedSpecificCount === 0 &&
			combinedSemanticSim < 0.28 &&
			!stickyDocIds.has(chunk.docId)
		) {
			continue;
		}

		let totalScore = bm25Score + semanticScore;

		// Bonus cakupan multi-konsep: dokumen yang menjawab seluruh aspek pertanyaan mendapat prioritas tinggi
		if (matchedPrimaryCount >= 2) {
			totalScore += matchedPrimaryCount * 6.5;
		}

		if (!isTicketDbFocused) {
			for (const hkw of uniqueHistoryKeywords.slice(0, 6)) {
				const hTf = chunk.termFreqs.get(hkw) || chunk.termFreqs.get(stemWord(hkw)) || 0;
				if (hTf > 0) {
					const hIdf = idfMap.get(hkw) ?? 1.5;
					totalScore += computeBm25TermScore(hTf, hIdf, chunk.docLen, avgChunkLen) * 0.8;
				}
			}
		}

		if (
			(qLower.includes('note') || qLower.includes('catatan') || qLower.includes('my docs')) &&
			chunk.sourceType === 'USER_NOTE'
		) {
			totalScore += 14;
		}

		// Bonus kecil untuk dokumen resmi portal (/docs) ketika membahas panduan/arsitektur konsep yang sama
		if (chunk.sourceType === 'PORTAL_DOC' && combinedSemanticSim >= 0.3) {
			totalScore += 4;
		}

		if (totalScore > 0) {
			chunkScores.set(chunk.chunkId, { chunk, score: totalScore });
		}
	}

	// Fallback Fuzzy Search per Dokumen jika kandidat masih sedikit (< 3 hasil)
	const fuseQuery =
		specificPrimaryKeywords.length > 0 ? specificPrimaryKeywords.join(' ') : cleanQuery;
	if (!isTicketDbFocused && chunkScores.size < 3 && fuseQuery.length >= 2) {
		const fuseHits = docFuse
			.search(fuseQuery)
			.filter((r) => canAccessDigest(r.item))
			.slice(0, 6);
		for (let i = 0; i < fuseHits.length; i++) {
			const digest = fuseHits[i].item;
			const firstChunk = chunksByDocId.get(digest.docId)?.[0];
			if (!firstChunk) continue;
			const fuseBonus = Math.max(2, 10 - i);
			const existing = chunkScores.get(firstChunk.chunkId);
			if (existing) {
				existing.score += fuseBonus;
			} else {
				chunkScores.set(firstChunk.chunkId, { chunk: firstChunk, score: fuseBonus });
			}
		}
	}

	const maxTopChunks = isFollowUpTurn ? 3 : 4;
	const sortedCandidates = Array.from(chunkScores.values()).sort((a, b) => b.score - a.score);
	const topCandidates: Array<{ chunk: DocChunk; score: number }> = [];
	const perDocSelected = new Map<string, number>();

	for (const cand of sortedCandidates) {
		const countForDoc = perDocSelected.get(cand.chunk.docId) || 0;
		if (countForDoc >= 2) continue; // Batasi maks 2 chunk per dokumen agar kandidat mencakup beragam dokumen relevan
		topCandidates.push(cand);
		perDocSelected.set(cand.chunk.docId, countForDoc + 1);
		if (topCandidates.length >= maxTopChunks) break;
	}

	// Neighbor Expansion hemat token
	const expandedChunksMap = new Map<string, { chunk: DocChunk; score: number }>();
	for (let idx = 0; idx < topCandidates.length; idx++) {
		const item = topCandidates[idx];
		expandedChunksMap.set(item.chunk.chunkId, item);

		if (idx === 0 && item.chunk.totalParts > 1 && item.chunk.partNumber < item.chunk.totalParts) {
			const siblingChunks = chunksByDocId.get(item.chunk.docId) || [];
			const nextChunk = siblingChunks.find((c) => c.partNumber === item.chunk.partNumber + 1);
			if (nextChunk && !expandedChunksMap.has(nextChunk.chunkId)) {
				expandedChunksMap.set(nextChunk.chunkId, {
					chunk: nextChunk,
					score: item.score - 0.5
				});
			}
		}
	}

	const rankedChunks = Array.from(expandedChunksMap.values())
		.sort((a, b) => {
			if (a.chunk.docId === b.chunk.docId) {
				return a.chunk.partNumber - b.chunk.partNumber;
			}
			return b.score - a.score;
		})
		.slice(0, isFollowUpTurn ? 4 : 5);

	const matchedApps =
		fuseQuery.length >= 2 &&
		(qLower.includes('aplikasi') ||
			qLower.includes('app') ||
			qLower.includes('url') ||
			qLower.includes('link'))
			? appFuse
					.search(fuseQuery)
					.slice(0, 2)
					.map((r) => r.item)
			: [];

	const ownedNoteDigests = Array.from(digestsByDocId.values()).filter(
		(d) => d.sourceType === 'USER_NOTE' && canAccessDigest(d)
	);
	const ownedNoteTitles = ownedNoteDigests.map(
		(n) => `"${n.title}" (${n.category}${n.subcategory ? '/' + n.subcategory : ''})`
	);
	const compactStatsHeader = `[BASIS PENGETAHUAN TERINDEKS DI MEMORI: ${ownedNoteDigests.length} Note Pribadi (My Docs), ${portalCount} Dokumentasi Modul, ${extCount} Dokumen Sinkronisasi Eksternal]`;
	const catalogSummary = [
		`[PETA KATALOG PENGETAHUAN PROGRAM INI]:`,
		`1. Note Pribadi Anda (My Docs - ${ownedNoteDigests.length} catatan): ${ownedNoteTitles.join(', ') || 'Belum ada'}`,
		portalCatalogLine,
		extCatalogLine
	].join('\n');

	const sections: string[] = [
		isCatalogQuestion || rankedChunks.length === 0 ? catalogSummary : compactStatsHeader
	];

	const noteChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'USER_NOTE');
	const syncChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'SYNC_DOC');
	const portalChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'PORTAL_DOC');

	if (isCatalogQuestion && noteChunks.length === 0) {
		for (const nd of ownedNoteDigests.slice(0, 4)) {
			const firstNoteChunk = chunksByDocId.get(nd.docId)?.[0];
			if (firstNoteChunk) {
				noteChunks.push({ chunk: firstNoteChunk, score: 5 });
			}
		}
	}

	const formatGroupedChunks = (
		items: Array<{ chunk: DocChunk; score: number }>,
		labelPrefix: string
	) => {
		const byDoc = new Map<string, DocChunk[]>();
		for (const { chunk } of items) {
			const list = byDoc.get(chunk.docId) || [];
			list.push(chunk);
			byDoc.set(chunk.docId, list);
		}

		const blocks: string[] = [];
		for (const [docId, docChunks] of byDoc.entries()) {
			docChunks.sort((a, b) => a.partNumber - b.partNumber);
			const first = docChunks[0];
			const digest = digestsByDocId.get(docId);
			const digestHeader = digest ? `[KARTU INTISARI DOKUMEN]:\n${digest.digestCard}\n` : '';
			const combinedText = docChunks
				.map((c) =>
					first.totalParts > 1
						? `[Kutipan Bagian ${c.partNumber}/${c.totalParts}]:\n${c.text}`
						: c.text
				)
				.join('\n\n');

			blocks.push(
				`--- ${labelPrefix}: "${first.title}" (File: ${first.fileName || first.title}) ---\n${digestHeader}${combinedText}\n`
			);
		}
		return blocks.join('\n');
	};

	if (noteChunks.length > 0) {
		sections.push(
			`[SUMBER CATATAN / NOTE DI PROGRAM INI (MY DOCS)]:\n${formatGroupedChunks(noteChunks, 'Note')}`
		);
	}

	if (syncChunks.length > 0) {
		sections.push(
			`[SUMBER DOKUMEN HASIL SINKRONISASI EKSTERNAL]:\n${formatGroupedChunks(syncChunks, 'Dokumen Sinkronisasi')}`
		);
	}

	if (portalChunks.length > 0) {
		sections.push(
			`[SUMBER DOKUMENTASI MODUL (/docs)]:\n${formatGroupedChunks(portalChunks, 'Dokumentasi Portal')}`
		);
	}

	if (matchedApps.length > 0) {
		const lines = [`[DIREKTORI APLIKASI (/apps)]:`];
		for (const app of matchedApps) {
			lines.push(`- ${app.title} (${app.subtitle || ''}) | URL: ${app.url} | ${app.description}`);
		}
		sections.push(lines.join('\n'));
	}

	const hasMatches = rankedChunks.length > 0 || matchedApps.length > 0 || isCatalogQuestion;

	const seenDocIds = new Set<string>();
	const sources: AiSourceLink[] = [];
	for (const { chunk } of rankedChunks) {
		if (seenDocIds.has(chunk.docId)) continue;
		seenDocIds.add(chunk.docId);
		sources.push({
			title: chunk.fileName || chunk.title,
			url: chunk.docUrl,
			category: chunk.subcategory ? `${chunk.category} / ${chunk.subcategory}` : chunk.category,
			type: chunk.sourceType,
			badge:
				chunk.sourceType === 'USER_NOTE'
					? 'My Docs'
					: chunk.sourceType === 'SYNC_DOC'
						? 'Dokumen Sinkronisasi'
						: 'Dokumentasi',
			fileUrl:
				chunk.sourceType === 'SYNC_DOC'
					? `/api/docs/external-file?id=${encodeURIComponent(chunk.docId)}`
					: undefined
		});
		if (sources.length >= 4) break;
	}

	recordRetrievalMetric(performance.now() - startHr);

	return {
		knowledgeText: sections.join('\n\n').trim(),
		hasMatches,
		extractedKeywords: allActiveKeywords,
		sources
	};
}

export function filterSourcesUsedInReply(
	sources: AiSourceLink[],
	replyText: string,
	hasDbIntent = false
): AiSourceLink[] {
	if (!Array.isArray(sources) || sources.length === 0 || !replyText) return [];

	const replyLower = replyText.toLowerCase();

	if (
		replyLower.includes('tidak ditemukan di dalam sumber') ||
		replyLower.includes('tidak dibahas di dalam dokumen')
	) {
		return [];
	}

	const citesDatabaseHelpdesk =
		replyLower.includes('database helpdesk') ||
		replyLower.includes('ticket_type') ||
		/tiket\s*#\d+/i.test(replyText);

	const explicitlyCited = sources.filter((src) => {
		const urlLower = (src.url || '').toLowerCase().trim();
		const cleanTitle = (src.title || '')
			.toLowerCase()
			.replace(/\.[a-z0-9]{2,5}$/i, '')
			.trim();

		if (urlLower && replyLower.includes(urlLower)) return true;
		if (cleanTitle.length >= 4 && replyLower.includes(cleanTitle)) return true;
		return false;
	});

	if (explicitlyCited.length > 0) {
		return explicitlyCited;
	}

	if (hasDbIntent || citesDatabaseHelpdesk) {
		return [];
	}

	return sources;
}

export const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten cerdas resmi yang dikhususkan untuk menjawab pertanyaan berdasarkan Sumber Pengetahuan Internal sistem ini:
1. **Dokumen Hasil Sinkronisasi Eksternal** (PDF, Word, Excel, PPTX, Teks dari penyimpanan Helpdesk).
2. **Isi Note / Catatan (My Docs) & Dokumentasi Modul** di dalam program ini.
3. **Database Helpdesk** (data tiket, solusi penanganan kendala, modul, unit, PIC, dan statistik Helpdesk).

ATURAN KETAT (STRICT SCOPE & DIRECT SOURCE LINKS):
1. HANYA MENJAWAB DARI SUMBER INTERNAL DI ATAS:
   - Gunakan informasi dari \`[KARTU INTISARI DOKUMEN]\`, \`[SUMBER DOKUMEN HASIL SINKRONISASI EKSTERNAL]\`, \`[SUMBER CATATAN / NOTE]\`, \`[SUMBER DOKUMENTASI MODUL]\`, serta \`[SUMBER DATABASE HELPDESK]\`.
   - Anda boleh membalas sapaan sopan atau menjelaskan daftar dokumen/note yang tersedia.
2. TOLAK PERTANYAAN DI LUAR KONTEKS:
   - Jika pertanyaan berada di luar sumber tersebut, jawab dengan sopan bahwa informasi tersebut tidak ditemukan di dalam sumber dokumentasi kami.
3. WAJIB CANTUMKAN SUMBER DENGAN LINK LANGSUNG KE DOKUMEN:
   - Di akhir setiap jawaban yang mengacu pada dokumen atau note, **WAJIB** tambahkan bagian **Sumber Referensi:** yang berisi tautan Markdown langsung menggunakan \`Link Dokumen\` yang tertera pada \`[KARTU INTISARI DOKUMEN]\`, contoh:
     - 📄 [Judul Dokumen atau Nama File](/docs/...) atau [Judul Note](/my-docs/...)
   - Jika mengacu pada tiket Helpdesk, sebutkan **Nomor Tiket Helpdesk** terkait.
4. DILARANG MENAMPILKAN QUERY SQL:
   - Jangan pernah menampilkan kode SQL (\`SELECT ...\`) kepada pengguna; sajikan langsung hasil datanya.
5. KONTINUITAS OBROLAN:
   - Untuk pertanyaan lanjutan, gabungkan konteks dari riwayat obrolan sebelumnya dengan \`[KARTU INTISARI DOKUMEN]\` dan kutipan bab terbaru tanpa kehilangan benang merah dokumen. Jangan menyebutkan nama model AI di balik layar.`;

// ============================================================================
// 9. OBJECTIVE EVALUATION DATASET & RETRIEVAL BENCHMARK SUITE
// ============================================================================
export interface BenchmarkQuestionItem {
	id: string;
	question: string;
	category: 'cross-lingual' | 'stemming-id' | 'technical-sap-sac' | 'web-security';
	expectedUrlSubstrings: string[];
}

export const AI_EVALUATION_QUESTIONS: BenchmarkQuestionItem[] = [
	{
		id: 'q1_vendor_payment',
		question: 'cara bayar vendor dan piutang',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['finance-ap-ar-highlight', 'ext_87c7be60b7c4', 'ext_55ae2d8e921e']
	},
	{
		id: 'q2_pembayaran_pemasok',
		question: 'evaluasi pengiriman dan kinerja pemasok',
		category: 'stemming-id',
		expectedUrlSubstrings: ['supply-chain-supplier-performance']
	},
	{
		id: 'q3_posisi_kas',
		question: 'bagaimana laporan posisi kas dan likuiditas bank',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['finance-cash-position']
	},
	{
		id: 'q4_rasio_utang_covenant',
		question: 'perhitungan rasio utang neraca dan covenant',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['finance-position-covenant']
	},
	{
		id: 'q5_harga_batubara',
		question: 'perbandingan harga batubara aktual dan acuan pasar',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['finance-coal-price-benchmark', 'marketing-price-quantity-benchmark']
	},
	{
		id: 'q6_persediaan_stok_transit',
		question: 'persediaan stok batubara dan posisi transit',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['marketing-inventory-stock', 'supply-chain-closing-value-dead-stock']
	},
	{
		id: 'q7_siklus_pengadaan',
		question: 'siklus pengadaan pembelian PO dan PR',
		category: 'stemming-id',
		expectedUrlSubstrings: ['supply-chain-procurement-cycle']
	},
	{
		id: 'q8_pemeliharaan_kapal',
		question: 'pemeliharaan kapal docking dan mesin armada laut',
		category: 'stemming-id',
		expectedUrlSubstrings: ['pm-marine-fleet']
	},
	{
		id: 'q9_bongkar_muat_crane',
		question: 'aktivitas bongkar muat floating crane di laut',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['op-marine-stevedoring-activity']
	},
	{
		id: 'q10_integrasi_abap_bapi',
		question: 'panduan integrasi ABAP RFC dan BAPI di SAP',
		category: 'technical-sap-sac',
		expectedUrlSubstrings: ['sap/abap-integration']
	},
	{
		id: 'q11_keamanan_web',
		question: 'keamanan autentikasi session dan proteksi XSS',
		category: 'web-security',
		expectedUrlSubstrings: ['web/security']
	},
	{
		id: 'q12_kesiapan_alat_berat',
		question: 'kesiapan alat berat tambang dan physical availability',
		category: 'cross-lingual',
		expectedUrlSubstrings: ['op-mining-equipment-status', 'pm-mining-fleet']
	}
];

export function evaluateRetrievalBenchmark(): {
	totalQuestions: number;
	passedCount: number;
	recallAt4Percent: number;
	meanReciprocalRank: number;
	avgLatencyMs: number;
	details: Array<{
		id: string;
		question: string;
		passed: boolean;
		rank: number | null;
		latencyMs: number;
		matchedUrls: string[];
	}>;
} {
	// Warm up index
	getSearchIndices();

	let passedCount = 0;
	let rrkSum = 0;
	let totalLatencyMs = 0;
	const details: Array<{
		id: string;
		question: string;
		passed: boolean;
		rank: number | null;
		latencyMs: number;
		matchedUrls: string[];
	}> = [];

	for (const item of AI_EVALUATION_QUESTIONS) {
		const t0 = performance.now();
		const res = retrieveRelevantKnowledge(item.question, [], '', 'Arif Rahman');
		const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
		totalLatencyMs += latencyMs;

		const matchedUrls = res.sources.map((s) => s.url);
		let foundRank: number | null = null;
		for (let i = 0; i < matchedUrls.length; i++) {
			const url = matchedUrls[i];
			if (item.expectedUrlSubstrings.some((sub) => url.includes(sub))) {
				foundRank = i + 1;
				break;
			}
		}

		const passed = foundRank !== null;
		if (passed && foundRank !== null) {
			passedCount++;
			rrkSum += 1 / foundRank;
		}

		details.push({
			id: item.id,
			question: item.question,
			passed,
			rank: foundRank,
			latencyMs,
			matchedUrls
		});
	}

	const total = AI_EVALUATION_QUESTIONS.length;
	return {
		totalQuestions: total,
		passedCount,
		recallAt4Percent: Math.round((passedCount / total) * 10000) / 100,
		meanReciprocalRank: Math.round((rrkSum / total) * 1000) / 1000,
		avgLatencyMs: Math.round((totalLatencyMs / total) * 100) / 100,
		details
	};
}
