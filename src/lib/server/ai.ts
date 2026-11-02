import http from 'node:http';
import crypto from 'node:crypto';
import Fuse from 'fuse.js';
import { loadDocuments, loadExternalDocuments, loadApps, getDataVersion, type DocumentItem } from './docs';
import { loadAllUserNotes, getUserNotesVersion } from './userDocs';
import { ensureEnvLoaded } from './auth';

ensureEnvLoaded();

export const AI_CONFIG = {
	host: process.env.AI_HOST || '127.0.0.1',
	port: parseInt(process.env.AI_PORT || '8045', 10),
	apiKey: process.env.AI_API_KEY || '',
	defaultModel: process.env.AI_MODEL || 'gemini-3.8-flash-low',
	fallbackModel: process.env.AI_FALLBACK_MODEL || 'gemini-3.8-flash',
	timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '300000', 10)
};

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

export function checkAiHealth(): Promise<{ status: string; service: string; cachedEntries: number }> {
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
					resolve({
						status: 'online',
						service: 'AI Copilot Engine',
						cachedEntries: aiResponseCache.size
					});
				});
			}
		);

		req.on('error', (err) => {
			resolve({
				status: 'offline',
				service: `AI Copilot Engine (${err.message})`,
				cachedEntries: aiResponseCache.size
			});
		});

		req.on('timeout', () => {
			req.destroy();
			resolve({
				status: 'timeout',
				service: 'AI Copilot Engine (Timeout)',
				cachedEntries: aiResponseCache.size
			});
		});

		req.end();
	});
}

export function callAiChat(
	messages: Array<{ role: string; content: string }>,
	model?: string,
	maxTokens = 2000,
	temperature = 0.1,
	timeoutMs = AI_CONFIG.timeoutMs
): Promise<{ model?: string; message: string; usage?: any }> {
	return new Promise((resolve, reject) => {
		const targetModel = model || AI_CONFIG.defaultModel;
		const targetTimeout = timeoutMs || AI_CONFIG.timeoutMs || 300000;
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
				let body = '';
				res.on('data', (c) => (body += c));
				res.on('end', () => {
					try {
						const json = JSON.parse(body);
						if (json.choices && json.choices[0] && json.choices[0].message) {
							resolve({
								model: targetModel,
								message: json.choices[0].message.content,
								usage: json.usage
							});
						} else if (json.error) {
							reject(new Error(json.error.message || 'AI Gateway error'));
						} else {
							reject(new Error('Format balasan AI tidak dikenali'));
						}
					} catch (e) {
						reject(new Error('Gagal memproses JSON respons AI: ' + body.substring(0, 150)));
					}
				});
			}
		);

		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error(`Waktu permintaan AI habis (Timeout setelah ${(targetTimeout / 1000).toFixed(0)} detik)`));
		});

		req.write(postData);
		req.end();
	});
}

// ============================================================================
// TOKEN-EFFICIENT, PRE-DIGESTED RAG & CONTEXT MEMORY ENGINE
// - Pre-Computed Document Digest Cards (Built Once in RAM, Never Re-read per Query)
// - Inverted Keyword Index for O(1) Candidate Lookup (No Full-Scan Lag)
// - Conditional Catalog Injection (Saves ~800 Tokens per Normal Chat)
// - Multi-Turn Delta Retrieval (Sends Digest + Only New Relevant Paragraphs on Follow-ups)
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
	outlineSummary: string;
	digestCard: string; // Compact ~120-token summary card of the entire document
	totalParts: number;
}

export interface DocChunk {
	chunkId: string;
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
}

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

/**
 * Buat Kartu Intisari Dokumen (Pre-Computed Digest Card) berukuran hemat (~80-150 token)
 * sehingga AI langsung memahami konteks utuh dokumen tanpa harus membaca ribuan kata berulang kali.
 */
function buildPrecomputedDigestCard(
	title: string,
	category: string,
	pathOrLoc: string,
	docUrl: string,
	outlineSummary: string,
	rawContent: string,
	totalParts: number
): string {
	const cleanFirstLines = rawContent
		.replace(/^#+\s+.+$/gm, '')
		.replace(/\n+/g, ' ')
		.trim()
		.slice(0, 280);
	const parts: string[] = [
		`• Judul: "${title}" | Kategori: ${category} | Link Dokumen: ${docUrl} | Lokasi: ${pathOrLoc} (${totalParts} bagian)`
	];
	if (outlineSummary) {
		parts.push(`• Peta Bab/Sheet: ${outlineSummary}`);
	}
	if (cleanFirstLines) {
		parts.push(`• Ringkasan Awal: ${cleanFirstLines}...`);
	}
	return parts.join('\n');
}

/**
 * Token-Efficient Smart Active Document Context:
 * - Pada Pertanyaan Pertama (Turn 1): Mengirimkan Kartu Intisari + Bagian dokumen yang relevan (maks 8.000 karakter).
 * - Pada Pertanyaan Lanjutan (Turn 2+): TIDAK mengirim ulang seluruh dokumen dari awal!
 *   Hanya mengirim Kartu Intisari Dokumen (~150 token) + 2 segmen paling relevan dengan pertanyaan baru (~2.400 karakter),
 *   karena isi sebelumnya sudah ada di riwayat obrolan. Menghemat token hingga 75%!
 */
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
	const briefIntro = clean.slice(0, 600).trim();

	// Jika ini adalah pertanyaan lanjutan (Turn 2+), gunakan mode Delta Hemat Token
	const effectiveBudget = isFollowUpTurn ? Math.min(maxChars, 3200) : maxChars;

	if (clean.length <= effectiveBudget) {
		return `${outlineHeader}\n${clean}`.trim();
	}

	const keywords = extractQueryKeywords(query);
	const segSize = 1400;
	const segments: Array<{ index: number; text: string; score: number }> = [];

	for (let pos = 0, idx = 0; pos < clean.length; pos += segSize - 200, idx++) {
		const segText = clean.slice(pos, pos + segSize);
		const segLower = segText.toLowerCase();
		let score = 0;
		for (const kw of keywords) {
			if (segLower.includes(kw)) {
				score += 6 + Math.min(countOccurrences(segLower, kw), 4) * 2.5;
			}
		}
		// Sedikit bonus untuk bagian awal jika tidak ada kata kunci spesifik
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
		!hasFirstSegment ? `[RINGKASAN PEMBUKA DOKUMEN]:\n${briefIntro}...` : '',
		...chosenSegments.map(
			(seg) => `--- [KUTIPAN BAB RELEVAN (Segmen #${seg.index + 1})] ---\n${seg.text.trim()}`
		)
	]
		.filter(Boolean)
		.join('\n\n');
}

function splitDocumentIntoChunks(
	doc: DocumentItem & { ownerName?: string },
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC',
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

	const titleLower = `${title} ${fileName}`.toLowerCase();
	const metaLower = `${category} ${subcategory || ''} ${tags.join(' ')} ${pathOrLoc} ${doc.ownerName || ''} ${outlineSummary}`.toLowerCase();

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
		outlineSummary,
		digestCard: buildPrecomputedDigestCard(
			title,
			category,
			pathOrLoc,
			docUrl,
			outlineSummary,
			rawContent,
			totalParts
		),
		totalParts
	};

	const chunks: DocChunk[] = textParts.map((text, idx) => ({
		chunkId: `${docId}#${idx + 1}`,
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
		textLower: text.toLowerCase()
	}));

	return { chunks, digest };
}

// Pre-computed singleton memory store (Only built once when data changes, 0ms per chat request)
let cachedIndexKey = '';
let cachedAllChunks: DocChunk[] = [];
let cachedChunksByDocId = new Map<string, DocChunk[]>();
let cachedDigestsByDocId = new Map<string, DocDigest>();
let cachedInvertedIndex = new Map<string, Set<number>>(); // token -> chunk indices for O(1) lookup
let cachedChunkFuse: Fuse<DocChunk> | null = null;
let cachedAppFuse: Fuse<any> | null = null;
let cachedCatalogSummary = '';
let cachedCompactStatsHeader = '';

function getSearchIndices() {
	const docs = loadDocuments();
	const userNotes = loadAllUserNotes();
	const extDocs = loadExternalDocuments();
	const apps = loadApps();

	const indexKey = `${getDataVersion()}_${getUserNotesVersion()}_${docs.length}_${userNotes.length}_${extDocs.length}_${apps.length}`;

	if (!cachedChunkFuse || !cachedAppFuse || cachedIndexKey !== indexKey) {
		const allChunks: DocChunk[] = [];
		const byDocId = new Map<string, DocChunk[]>();
		const digestsByDocId = new Map<string, DocDigest>();
		const invertedIdx = new Map<string, Set<number>>();

		const registerDoc = (
			doc: DocumentItem & { ownerName?: string },
			sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC'
		) => {
			const res = splitDocumentIntoChunks(doc, sourceType);
			if (!res) return;
			digestsByDocId.set(res.digest.docId, res.digest);
			byDocId.set(res.digest.docId, res.chunks);

			for (const c of res.chunks) {
				const chunkArrayIdx = allChunks.length;
				allChunks.push(c);

				// Index unique words (length >= 3) into Inverted Index so queries don't scan irrelevant chunks
				const combinedWords = `${c.titleLower} ${c.metaLower} ${c.textLower}`
					.replace(/[^a-z0-9_/-]+/g, ' ')
					.split(/\s+/);
				for (const w of combinedWords) {
					if (w.length >= 3 && !STOPWORDS.has(w)) {
						let bucket = invertedIdx.get(w);
						if (!bucket) {
							bucket = new Set<number>();
							invertedIdx.set(w, bucket);
						}
						bucket.add(chunkArrayIdx);
					}
				}
			}
		};

		for (const note of userNotes) registerDoc(note, 'USER_NOTE');
		for (const doc of docs) registerDoc(doc, 'PORTAL_DOC');
		for (const ext of extDocs) registerDoc(ext, 'SYNC_DOC');

		cachedAllChunks = allChunks;
		cachedChunksByDocId = byDocId;
		cachedDigestsByDocId = digestsByDocId;
		cachedInvertedIndex = invertedIdx;

		cachedChunkFuse = new Fuse(allChunks, {
			keys: [
				{ name: 'title', weight: 0.4 },
				{ name: 'fileName', weight: 0.3 },
				{ name: 'category', weight: 0.2 },
				{ name: 'tags', weight: 0.1 }
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

		// Compact stats line (~25 tokens) vs Full Catalog (~800 tokens, only injected when user asks for catalog)
		cachedCompactStatsHeader = `[BASIS PENGETAHUAN TERINDEKS DI MEMORI: ${userNotes.length} Note (My Docs), ${docs.length} Dokumentasi Modul, ${extDocs.length} Dokumen Sinkronisasi Eksternal]`;

		const noteTitles = userNotes.map(
			(n) => `"${n.title}" (${n.category}${n.subcategory ? '/' + n.subcategory : ''})`
		);
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

		cachedCatalogSummary = [
			`[PETA KATALOG PENGETAHUAN PROGRAM INI]:`,
			`1. Note (My Docs - ${userNotes.length} catatan): ${noteTitles.join(', ') || 'Belum ada'}`,
			`2. Dokumentasi Portal (${docs.length} dokumen): ${portalTitles.slice(0, 25).join(', ')}`,
			`3. Dokumen Sinkronisasi Eksternal (${extDocs.length} berkas): Kategori [${extCatSummary}] | Contoh: ${sampleExtTitles}`
		].join('\n');

		cachedIndexKey = indexKey;
	}

	return {
		allChunks: cachedAllChunks,
		chunksByDocId: cachedChunksByDocId,
		digestsByDocId: cachedDigestsByDocId,
		invertedIndex: cachedInvertedIndex,
		chunkFuse: cachedChunkFuse!,
		appFuse: cachedAppFuse!,
		catalogSummary: cachedCatalogSummary,
		compactStatsHeader: cachedCompactStatsHeader
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

/**
 * Token-Efficient & Zero Re-Reading Knowledge Retrieval:
 * 1. Menggunakan Inverted Index & Pre-Computed Digest di RAM (0ms, tidak pernah baca ulang file dari disk).
 * 2. Hanya menyertakan Katalog Penuh jika user bertanya soal daftar dokumen/note (hemat ~750 token/chat).
 * 3. Menyertakan Kartu Intisari Dokumen (Digest Card) + 3-4 Kutipan Bab paling relevan (bukan seluruh dokumen mentah).
 */
export function retrieveRelevantKnowledge(
	query: string,
	history?: Array<{ role: string; content: string }>,
	activeDocHint?: string
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
		chunkFuse,
		appFuse,
		catalogSummary,
		compactStatsHeader
	} = getSearchIndices();

	const cleanQuery = (query || '').trim();
	const primaryKeywords = extractQueryKeywords(cleanQuery);
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

	// Identifikasi dokumen yang sedang dibicarakan di pesan sebelumnya (Sticky Document IDs)
	const stickyDocIds = new Set<string>();
	if (combinedHistoryLower.length > 0 || activeHintLower.length > 0) {
		for (const [docId, digest] of digestsByDocId.entries()) {
			const titleL = digest.title.toLowerCase();
			const fileL = digest.fileName.toLowerCase();
			if (
				(titleL.length >= 4 && combinedHistoryLower.includes(titleL)) ||
				(fileL.length >= 4 && combinedHistoryLower.includes(fileL)) ||
				(activeHintLower.length >= 4 &&
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
	const bigrams = extractQueryBigrams(primaryKeywords);

	const qLower = cleanQuery.toLowerCase();
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

	// Kumpulkan kandidat chunk secara instan melalui Inverted Index + Sticky Docs (tanpa scan buta ribuan chunk)
	const candidateChunkIndices = new Set<number>();
	for (const kw of allActiveKeywords) {
		const exactSet = invertedIndex.get(kw);
		if (exactSet) {
			for (const idx of exactSet) candidateChunkIndices.add(idx);
		}
		// Partial prefix match untuk kata >= 4 huruf
		if (kw.length >= 4) {
			for (const [indexedWord, idxSet] of invertedIndex.entries()) {
				if (indexedWord.includes(kw) || kw.includes(indexedWord)) {
					for (const idx of idxSet) candidateChunkIndices.add(idx);
				}
			}
		}
	}

	// Sertakan juga semua chunk dari dokumen yang sedang dikunci (Sticky Docs)
	if (stickyDocIds.size > 0) {
		for (let i = 0; i < allChunks.length; i++) {
			if (stickyDocIds.has(allChunks[i].docId)) {
				candidateChunkIndices.add(i);
			}
		}
	}

	const chunkScores = new Map<string, { chunk: DocChunk; score: number }>();

	for (const chunkIdx of candidateChunkIndices) {
		const chunk = allChunks[chunkIdx];
		if (!chunk) continue;

		let score = 0;
		let matchedPrimaryCount = 0;

		if (stickyDocIds.has(chunk.docId)) {
			score += 24;
		}

		for (const bg of bigrams) {
			if (chunk.titleLower.includes(bg)) score += 22;
			if (chunk.metaLower.includes(bg)) score += 14;
			if (chunk.textLower.includes(bg)) score += 15;
		}

		for (const kw of primaryKeywords) {
			let kwMatched = false;
			if (chunk.titleLower.includes(kw)) {
				score += 10;
				kwMatched = true;
			}
			if (chunk.metaLower.includes(kw)) {
				score += 6;
				kwMatched = true;
			}
			const textHits = countOccurrences(chunk.textLower, kw);
			if (textHits > 0) {
				score += Math.min(textHits, 5) * 3.5;
				kwMatched = true;
			}
			if (kwMatched) matchedPrimaryCount++;
		}

		if (matchedPrimaryCount >= 2) {
			score += matchedPrimaryCount * 7;
		}

		for (const hkw of uniqueHistoryKeywords.slice(0, 6)) {
			if (chunk.titleLower.includes(hkw)) score += 4.5;
			if (chunk.metaLower.includes(hkw)) score += 2.5;
			if (chunk.textLower.includes(hkw)) score += 1.5;
		}

		if (
			(qLower.includes('note') || qLower.includes('catatan') || qLower.includes('my docs')) &&
			chunk.sourceType === 'USER_NOTE'
		) {
			score += 14;
		}

		if (score > 0) {
			chunkScores.set(chunk.chunkId, { chunk, score });
		}
	}

	// Fallback Fuzzy Search hanya jika kandidat kata kunci sedikit (< 3 hasil)
	const fuseQuery = primaryKeywords.length > 0 ? primaryKeywords.join(' ') : cleanQuery;
	if (chunkScores.size < 3 && fuseQuery.length >= 2) {
		const fuseHits = chunkFuse.search(fuseQuery).slice(0, 6);
		for (let i = 0; i < fuseHits.length; i++) {
			const item = fuseHits[i].item;
			const fuseBonus = Math.max(2, 10 - i);
			const existing = chunkScores.get(item.chunkId);
			if (existing) {
				existing.score += fuseBonus;
			} else {
				chunkScores.set(item.chunkId, { chunk: item, score: fuseBonus });
			}
		}
	}

	// Token Budget: Pada giliran pertama ambil maks 4 chunk terbaik; pada giliran lanjutan (follow-up) cukup ambil 3 chunk delta paling presisi
	const maxTopChunks = isFollowUpTurn ? 3 : 4;
	const topCandidates = Array.from(chunkScores.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, maxTopChunks);

	// Neighbor Expansion hemat token: Hanya tambahkan 1 chunk kelanjutannya (#part+1) untuk dokumen peringkat #1 jika skornya sangat tinggi
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
		fuseQuery.length >= 2 && (qLower.includes('aplikasi') || qLower.includes('app') || qLower.includes('url') || qLower.includes('link'))
			? appFuse
					.search(fuseQuery)
					.slice(0, 2)
					.map((r) => r.item)
			: [];

	// HANYA kirimkan Katalog Lengkap jika user memang bertanya soal daftar dokumen/note, atau jika tidak ada chunk yang cocok!
	const sections: string[] = [
		isCatalogQuestion || rankedChunks.length === 0 ? catalogSummary : compactStatsHeader
	];

	const noteChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'USER_NOTE');
	const syncChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'SYNC_DOC');
	const portalChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'PORTAL_DOC');

	if (isCatalogQuestion && noteChunks.length === 0) {
		const allUserNoteChunks = allChunks.filter((c) => c.sourceType === 'USER_NOTE').slice(0, 4);
		for (const nc of allUserNoteChunks) {
			noteChunks.push({ chunk: nc, score: 5 });
		}
	}

	// Format setiap dokumen dengan menyertakan KARTU INTISARI (Pre-computed Digest Card) + Kutipan Bab Spesifik
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

	// Build deduplicated clickable source links for the UI & AI citations
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

	return {
		knowledgeText: sections.join('\n\n').trim(),
		hasMatches,
		extractedKeywords: allActiveKeywords,
		sources
	};
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
