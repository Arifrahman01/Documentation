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
// 4-PILLAR ADVANCED RAG ENGINE
// (Smart Chunking + Hybrid BM25/Fuzzy + Multi-Turn Context Locking + Catalog Map)
// ============================================================================

export interface DocChunk {
	chunkId: string;
	docId: string;
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC';
	title: string;
	fileName: string;
	category: string;
	subcategory?: string;
	pathOrLoc: string;
	ownerName?: string;
	tags: string[];
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

/**
 * Ekstrak kata kunci bermakna dari kalimat pertanyaan (menghapus kata sambung/filler).
 */
export function extractQueryKeywords(text: string): string[] {
	if (!text || typeof text !== 'string') return [];
	const cleaned = text
		.toLowerCase()
		.replace(/[^a-z0-9_/-]+/g, ' ')
		.trim();

	const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
	return Array.from(new Set(tokens));
}

/**
 * Ekstrak frasa 2 kata (bigrams) untuk pencocokan frasa spesifik.
 */
function extractQueryBigrams(keywords: string[]): string[] {
	const bigrams: string[] = [];
	for (let i = 0; i < keywords.length - 1; i++) {
		bigrams.push(`${keywords[i]} ${keywords[i + 1]}`);
	}
	return bigrams;
}

/**
 * Pilar 1: Smart Chunking — Memecah dokumen panjang menjadi bagian-bagian (chunks)
 * berukuran ~1.300 karakter dengan overlap ~220 karakter agar tidak ada halaman yang terpotong/hilang.
 */
function splitDocumentIntoChunks(
	doc: DocumentItem & { ownerName?: string },
	sourceType: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC',
	chunkSize = 1350,
	overlap = 220
): DocChunk[] {
	const rawContent = (doc.content || doc.snippet || doc.description || '').trim();
	if (!rawContent) return [];

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
	const tags = Array.isArray(doc.tags) ? doc.tags : [];

	const titleLower = `${title} ${fileName}`.toLowerCase();
	const metaLower = `${category} ${subcategory || ''} ${tags.join(' ')} ${pathOrLoc} ${doc.ownerName || ''}`.toLowerCase();

	if (rawContent.length <= chunkSize + 150) {
		return [
			{
				chunkId: `${docId}#1`,
				docId,
				sourceType,
				title,
				fileName,
				category,
				subcategory,
				pathOrLoc,
				ownerName: doc.ownerName,
				tags,
				partNumber: 1,
				totalParts: 1,
				text: rawContent,
				titleLower,
				metaLower,
				textLower: rawContent.toLowerCase()
			}
		];
	}

	const textParts: string[] = [];
	let start = 0;
	const len = rawContent.length;

	while (start < len) {
		let end = Math.min(start + chunkSize, len);
		if (end < len) {
			// Cari pemisah paragraf atau baris terdekat agar kalimat tidak terpotong di tengah kata
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

	const totalParts = textParts.length;
	return textParts.map((text, idx) => ({
		chunkId: `${docId}#${idx + 1}`,
		docId,
		sourceType,
		title,
		fileName,
		category,
		subcategory,
		pathOrLoc,
		ownerName: doc.ownerName,
		tags,
		partNumber: idx + 1,
		totalParts,
		text,
		titleLower,
		metaLower,
		textLower: text.toLowerCase()
	}));
}

let cachedIndexKey = '';
let cachedAllChunks: DocChunk[] = [];
let cachedChunkFuse: Fuse<DocChunk> | null = null;
let cachedAppFuse: Fuse<any> | null = null;
let cachedCatalogSummary = '';

function getSearchIndices() {
	const docs = loadDocuments();
	const userNotes = loadAllUserNotes();
	const extDocs = loadExternalDocuments();
	const apps = loadApps();

	const indexKey = `${getDataVersion()}_${getUserNotesVersion()}_${docs.length}_${userNotes.length}_${extDocs.length}_${apps.length}`;

	if (!cachedChunkFuse || !cachedAppFuse || cachedIndexKey !== indexKey) {
		const allChunks: DocChunk[] = [];

		// 1. User Notes (My Docs / Catatan di Program Ini)
		for (const note of userNotes) {
			allChunks.push(...splitDocumentIntoChunks(note, 'USER_NOTE'));
		}

		// 2. Portal Official Documentation (/docs)
		for (const doc of docs) {
			allChunks.push(...splitDocumentIntoChunks(doc, 'PORTAL_DOC'));
		}

		// 3. External Synced Documents (Helpdesk Synced PDF/DOCX/XLSX/PPTX/TXT)
		for (const ext of extDocs) {
			allChunks.push(...splitDocumentIntoChunks(ext, 'SYNC_DOC'));
		}

		cachedAllChunks = allChunks;

		cachedChunkFuse = new Fuse(allChunks, {
			keys: [
				{ name: 'title', weight: 0.35 },
				{ name: 'fileName', weight: 0.25 },
				{ name: 'category', weight: 0.2 },
				{ name: 'tags', weight: 0.15 },
				{ name: 'text', weight: 0.2 }
			],
			threshold: 0.42,
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

		// Pilar 4: Bangun Katalog Peta Pengetahuan Global (Global Knowledge Map)
		const noteTitles = userNotes.map(
			(n) => `"${n.title}" (Kategori: ${n.category}${n.subcategory ? '/' + n.subcategory : ''}, Pemilik: ${n.ownerName || 'User'})`
		);
		const portalTitles = docs.map((d) => `"${d.title}" [${d.section || 'DOC'} - ${d.category}]`);

		const extCategoryCounts = new Map<string, number>();
		for (const e of extDocs) {
			const cat = e.category || 'Umum';
			extCategoryCounts.set(cat, (extCategoryCounts.get(cat) || 0) + 1);
		}
		const extCatSummary = Array.from(extCategoryCounts.entries())
			.slice(0, 15)
			.map(([c, count]) => `${c} (${count} berkas)`)
			.join(', ');
		const sampleExtTitles = extDocs
			.slice(0, 35)
			.map((e) => e.fileName || e.title)
			.join(', ');

		cachedCatalogSummary = [
			`[PETA KATALOG PENGETAHUAN PROGRAM INI]:`,
			`1. Catatan / Note di Program Ini (Menu My Docs - Total ${userNotes.length} catatan):`,
			noteTitles.length > 0 ? `   - ${noteTitles.join('\n   - ')}` : `   - Belum ada catatan`,
			`2. Dokumentasi Modul Portal (Menu Documentation - Total ${docs.length} dokumen):`,
			portalTitles.length > 0 ? `   - ${portalTitles.slice(0, 30).join(', ')}` : `   - Belum ada dokumen`,
			`3. Dokumen Hasil Sinkronisasi Eksternal Helpdesk (Total ${extDocs.length} berkas terindeks dalam ${allChunks.filter((c) => c.sourceType === 'SYNC_DOC').length} bagian/chunks):`,
			`   - Kategori Folder: ${extCatSummary || '-'}`,
			`   - Contoh Berkas Terindeks: ${sampleExtTitles || '-'}`
		].join('\n');

		cachedIndexKey = indexKey;
	}

	return {
		allChunks: cachedAllChunks,
		chunkFuse: cachedChunkFuse!,
		appFuse: cachedAppFuse!,
		catalogSummary: cachedCatalogSummary
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
 * Pilar 2 & 3: Pencarian Hibrida BM25 + Fuzzy + Multi-Turn Context Locking
 * Mengambil bagian bab/paragraf (chunks) yang paling relevan dari seluruh dokumen sinkronisasi & note
 * tanpa harus membaca seluruh ratusan dokumen secara mentah.
 */
export function retrieveRelevantKnowledge(
	query: string,
	history?: Array<{ role: string; content: string }>
): { knowledgeText: string; hasMatches: boolean; extractedKeywords: string[] } {
	const { allChunks, chunkFuse, appFuse, catalogSummary } = getSearchIndices();

	const cleanQuery = (query || '').trim();
	const primaryKeywords = extractQueryKeywords(cleanQuery);

	// Pilar 3: Multi-Turn Conversational Context Locking
	// Ambil kata kunci dari 2 giliran percakapan sebelumnya jika pertanyaan saat ini merupakan pertanyaan lanjutan
	const historyKeywords: string[] = [];
	if (Array.isArray(history) && history.length > 0) {
		const recentMessages = history.slice(-4);
		for (const msg of recentMessages) {
			if (msg && typeof msg.content === 'string') {
				const kws = extractQueryKeywords(msg.content);
				historyKeywords.push(...kws.slice(0, 8));
			}
		}
	}

	const uniqueHistoryKeywords = Array.from(new Set(historyKeywords)).filter(
		(k) => !primaryKeywords.includes(k)
	);
	const allActiveKeywords = [...primaryKeywords, ...uniqueHistoryKeywords.slice(0, 6)];
	const bigrams = extractQueryBigrams(primaryKeywords);

	// Jika user bertanya tentang daftar seluruh note / dokumen yang ada
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

	// Skor setiap chunk menggunakan BM25-style keyword + phrase + metadata scoring
	const chunkScores = new Map<string, { chunk: DocChunk; score: number }>();

	for (const chunk of allChunks) {
		let score = 0;
		let matchedPrimaryCount = 0;

		// 1. Pencocokan Frasa 2 Kata (Bigrams)
		for (const bg of bigrams) {
			if (chunk.titleLower.includes(bg)) score += 22;
			if (chunk.metaLower.includes(bg)) score += 14;
			if (chunk.textLower.includes(bg)) score += 15;
		}

		// 2. Pencocokan Kata Kunci Utama (Primary Query Keywords)
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
				// Saturasi frekuensi kata (BM25 style)
				score += Math.min(textHits, 5) * 3.5;
				kwMatched = true;
			}
			if (kwMatched) matchedPrimaryCount++;
		}

		// Bonus cakupan multi-kata kunci (Coverage Bonus)
		if (matchedPrimaryCount >= 2) {
			score += matchedPrimaryCount * 7;
		}

		// 3. Pencocokan Konteks Percakapan Sebelumnya (Multi-Turn Context Locking)
		for (const hkw of uniqueHistoryKeywords.slice(0, 6)) {
			if (chunk.titleLower.includes(hkw)) score += 4.5;
			if (chunk.metaLower.includes(hkw)) score += 2.5;
			if (chunk.textLower.includes(hkw)) score += 1.5;
		}

		// 4. Prioritas Note jika user menyebut kata "note" atau "catatan"
		if ((qLower.includes('note') || qLower.includes('catatan') || qLower.includes('my docs')) && chunk.sourceType === 'USER_NOTE') {
			score += 12;
		}

		if (score > 0) {
			chunkScores.set(chunk.chunkId, { chunk, score });
		}
	}

	// 5. Tambahkan Fuzzy Search (Fuse.js) untuk menangani typo ejaan
	const fuseQuery = primaryKeywords.length > 0 ? primaryKeywords.join(' ') : cleanQuery;
	if (fuseQuery.length >= 2) {
		const fuseHits = chunkFuse.search(fuseQuery).slice(0, 10);
		for (let i = 0; i < fuseHits.length; i++) {
			const item = fuseHits[i].item;
			const fuseBonus = Math.max(2, 12 - i);
			const existing = chunkScores.get(item.chunkId);
			if (existing) {
				existing.score += fuseBonus;
			} else {
				chunkScores.set(item.chunkId, { chunk: item, score: fuseBonus });
			}
		}
	}

	// Urutkan berdasarkan skor tertinggi
	const rankedChunks = Array.from(chunkScores.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, 8);

	// Cari juga di direktori aplikasi jika relevan
	const matchedApps =
		fuseQuery.length >= 2
			? appFuse
					.search(fuseQuery)
					.slice(0, 2)
					.map((r) => r.item)
			: [];

	const sections: string[] = [catalogSummary];

	// Kelompokkan hasil chunk berdasarkan tipe sumber
	const noteChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'USER_NOTE');
	const syncChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'SYNC_DOC');
	const portalChunks = rankedChunks.filter((r) => r.chunk.sourceType === 'PORTAL_DOC');

	// Jika user secara eksplisit menanyakan tentang note/catatan atau daftar isi, sertakan semua note pengguna
	if (isCatalogQuestion && noteChunks.length === 0) {
		const allUserNoteChunks = allChunks.filter((c) => c.sourceType === 'USER_NOTE').slice(0, 5);
		for (const nc of allUserNoteChunks) {
			noteChunks.push({ chunk: nc, score: 5 });
		}
	}

	if (noteChunks.length > 0) {
		const lines = [`\n[SUMBER CATATAN / NOTE DI PROGRAM INI (MY DOCS)]:`];
		for (const { chunk } of noteChunks) {
			lines.push(
				`--- Note: "${chunk.title}" (Kategori: ${chunk.category}${chunk.subcategory ? ' / ' + chunk.subcategory : ''}, Pemilik: ${chunk.ownerName || 'User'}, Bagian ${chunk.partNumber}/${chunk.totalParts}, Path: ${chunk.pathOrLoc}) ---\n${chunk.text}\n`
			);
		}
		sections.push(lines.join('\n'));
	}

	if (syncChunks.length > 0) {
		const lines = [`\n[SUMBER DOKUMEN HASIL SINKRONISASI EKSTERNAL (HELPDESK STORAGE)]:`];
		for (const { chunk } of syncChunks) {
			lines.push(
				`--- Dokumen Sinkronisasi: "${chunk.title}" (Nama File: ${chunk.fileName}, Lokasi Folder: ${chunk.pathOrLoc}, Bagian ${chunk.partNumber}/${chunk.totalParts}) ---\n${chunk.text}\n`
			);
		}
		sections.push(lines.join('\n'));
	}

	if (portalChunks.length > 0) {
		const lines = [`\n[SUMBER DOKUMENTASI MODUL DI PROGRAM INI (/docs)]:`];
		for (const { chunk } of portalChunks) {
			lines.push(
				`--- Dokumentasi Portal: "${chunk.title}" (Kategori: ${chunk.category}, Bagian ${chunk.partNumber}/${chunk.totalParts}, Path: ${chunk.pathOrLoc}) ---\n${chunk.text}\n`
			);
		}
		sections.push(lines.join('\n'));
	}

	if (matchedApps.length > 0) {
		const lines = [`\n[DIREKTORI APLIKASI DI PROGRAM INI (/apps)]:`];
		for (const app of matchedApps) {
			lines.push(
				`- Aplikasi: ${app.title} (${app.subtitle || ''}) | URL: ${app.url} | Deskripsi: ${app.description}`
			);
		}
		sections.push(lines.join('\n'));
	}

	const hasMatches = rankedChunks.length > 0 || matchedApps.length > 0 || isCatalogQuestion;

	return {
		knowledgeText: sections.join('\n\n').trim(),
		hasMatches,
		extractedKeywords: allActiveKeywords
	};
}

export const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten cerdas resmi yang dikhususkan untuk menjawab pertanyaan berdasarkan 3 Sumber Pengetahuan Internal sistem ini:
1. **Dokumen Hasil Sinkronisasi Eksternal** (berkas PDF, Word, Excel, PPTX, dan Teks dari penyimpanan Helpdesk).
2. **Isi Note / Catatan (My Docs) & Dokumentasi Modul** yang tersimpan di dalam program ini.
3. **Database Helpdesk** (data tiket, solusi penanganan kendala, modul, perusahaan/unit, PIC, dan statistik Helpdesk).

==================================================
ATURAN KETAT BATASAN SUMBER PENGETAHUAN (STRICT SCOPE):
==================================================
1. HANYA MENJAWAB DARI 3 SUMBER INTERNAL DI ATAS:
   - Anda **HANYA BOLEH** menjawab pertanyaan berdasarkan data yang tercantum di dalam:
     a) \`[SUMBER DOKUMEN HASIL SINKRONISASI EKSTERNAL]\`
     b) \`[SUMBER CATATAN / NOTE DI PROGRAM INI (MY DOCS)]\` & \`[SUMBER DOKUMENTASI MODUL DI PROGRAM INI]\` & \`[PETA KATALOG PENGETAHUAN PROGRAM INI]\`
     c) \`[DATA REALTIME DATABASE HELPDESK]\` & \`[DATA HISTORI TIKET & SOLUSI TERKAIT DARI DATABASE HELPDESK]\`
   - Anda diperbolehkan membalas sapaan sopan (seperti "Halo", "Selamat pagi", "Terima kasih") atau menjelaskan daftar dokumen/note yang tersedia di katalog.

2. TOLAK PERTANYAAN DI LUAR KONTEKS DOKUMEN, NOTE & DATABASE HELPDESK:
   - Apabila pengguna menanyakan hal di luar isi dokumen sinkronisasi, isi note/dokumentasi program ini, atau database Helpdesk (contoh: resep masakan, politik, cuaca, film, hiburan, pengetahuan umum luar, atau pembuatan kode/topik yang sama sekali tidak ada di dalam ketiga sumber tersebut), **DILARANG KERAS menjawab menggunakan pengetahuan umum di luar sistem**.
   - Jawablah dengan sopan:
     "Maaf, saya hanya dapat menjawab pertanyaan berdasarkan **Dokumen Hasil Sinkronisasi**, **Isi Note & Dokumentasi di program ini**, serta **Database Helpdesk**. Informasi mengenai hal tersebut tidak ditemukan di dalam sumber data kami."

3. SEBUTKAN SUMBER RUJUKAN SECARA SPESIFIK:
   - Setiap kali Anda memberikan jawaban, sebutkan dengan jelas dari mana informasi tersebut berasal:
     * Jika dari dokumen sinkronisasi: sebutkan **Nama File / Judul Dokumennya** (misal: *Berdasarkan Dokumen Sinkronisasi: \`Nama_File.pdf\`...*).
     * Jika dari Note / My Docs: sebutkan **Judul Catatannya** (misal: *Berdasarkan Note: \`Judul Catatan\`...*).
     * Jika dari Database Helpdesk: sebutkan **Nomor Tiket atau Statistik Dashboard-nya** (misal: *Berdasarkan Database Helpdesk Tiket #3190...*).

4. LARANGAN KERAS MENAMPILKAN QUERY SQL KE PENGGUNA:
   - **JANGAN PERNAH** menampilkan kode query SQL (\`SELECT ... FROM ...\`) atau perintah \`php artisan tinker\` kepada pengguna. Sajikan langsung hasil datanya (angka, tabel, atau rincian tiket) secara rapi.

5. MENJAGA KONTEKS OBROLAN & KERAHASIAAN MODEL:
   - Pahami pertanyaan lanjutan pengguna dalam konteks percakapan sebelumnya.
   - Jangan pernah menyebutkan nama model teknis di balik layar (seperti Gemini, GPT, Claude, dll.).
   - Gunakan Bahasa Indonesia yang rapi, terstruktur, jelas, dan mudah dipahami.`;
