import http from 'node:http';
import crypto from 'node:crypto';
import Fuse from 'fuse.js';
import { loadDocuments, loadApps } from './docs';

export const AI_CONFIG = {
	host: process.env.AI_HOST || '127.0.0.1',
	port: parseInt(process.env.AI_PORT || '8045', 10),
	apiKey: process.env.AI_API_KEY || 'sk-33246260e7334a429cde6487acca5479',
	defaultModel: process.env.AI_MODEL || 'gemini-3.8-flash-medium',
	fallbackModel: 'gemini-3.8-flash'
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
	maxTokens = 1500,
	temperature = 0.1
): Promise<{ model?: string; message: string; usage?: any }> {
	return new Promise((resolve, reject) => {
		const postData = JSON.stringify({
			model: model || AI_CONFIG.defaultModel,
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
				timeout: 30000
			},
			(res) => {
				let body = '';
				res.on('data', (c) => (body += c));
				res.on('end', () => {
					try {
						const json = JSON.parse(body);
						if (json.choices && json.choices[0] && json.choices[0].message) {
							resolve({
								model: model,
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
			reject(new Error('Waktu permintaan AI habis (Timeout)'));
		});

		req.write(postData);
		req.end();
	});
}

export function retrieveRelevantKnowledge(query: string): string {
	if (!query || typeof query !== 'string' || query.trim().length < 2) return '';

	const cleanQuery = query.trim();
	const docs = loadDocuments();
	const apps = loadApps();

	const docFuse = new Fuse(docs, {
		keys: [
			{ name: 'title', weight: 0.35 },
			{ name: 'section', weight: 0.25 },
			{ name: 'category', weight: 0.2 },
			{ name: 'tags', weight: 0.2 },
			{ name: 'snippet', weight: 0.15 },
			{ name: 'content', weight: 0.1 }
		],
		threshold: 0.45,
		ignoreLocation: true
	});

	const appFuse = new Fuse(apps, {
		keys: [
			{ name: 'title', weight: 0.4 },
			{ name: 'subtitle', weight: 0.3 },
			{ name: 'description', weight: 0.2 },
			{ name: 'tags', weight: 0.1 }
		],
		threshold: 0.4,
		ignoreLocation: true
	});

	const matchedDocs = docFuse.search(cleanQuery).slice(0, 2).map((r) => r.item);
	const matchedApps = appFuse.search(cleanQuery).slice(0, 2).map((r) => r.item);

	let knowledge = '';

	if (matchedApps.length > 0) {
		knowledge += `\n[DATA APLIKASI ENTERPRISE TERVERIFIKASI]:\n`;
		for (const app of matchedApps) {
			knowledge += `- Sistem: ${app.title} (${app.subtitle || ''})\n  URL Resmi: ${app.url}\n  Deskripsi: ${app.description}\n  Kategori: ${app.categoryName || app.category}\n  Tags: ${(app.tags || []).join(', ')}\n\n`;
		}
	}

	if (matchedDocs.length > 0) {
		knowledge += `\n[SUMBER DOKUMEN RESMI PORTAL]:\n`;
		for (const doc of matchedDocs) {
			knowledge += `--- Dokumen Resmi: "${doc.title}" (Kategori: ${doc.category}, Path: /docs/${doc.slug}) ---\n${doc.content.slice(0, 1600)}\n\n`;
		}
	}

	return knowledge.trim();
}

export const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten kecerdasan buatan resmi untuk Documentation.

==================================================
PRINSIP KETAT ANTI-HALUSINASI (STRICT ZERO-HALLUCINATION):
==================================================
1. SINGLE SOURCE OF TRUTH (HANYA BERDASARKAN SUMBER RESMI):
   - Jawab pertanyaan HANYA berdasarkan fakta yang tertulis dalam [SUMBER DOKUMEN RESMI PORTAL], [DATA APLIKASI ENTERPRISE TERVERIFIKASI], dan [KONTEKS DOKUMEN AKTIF] di bawah.
2. DILARANG MENGARANG (ZERO FABRICATION):
   - JANGAN PERNAH mengarang URL fiktif, endpoint palsu, nama tabel/database rekaan, kode palsu, atau fitur yang tidak tercantum dalam sumber data resmi.
   - JANGAN membuat asumsi atau menebak konfigurasi di luar dokumentasi resmi yang disediakan.
3. KEJUJURAN KETIKA INFORMASI TIDAK DITEMUKAN:
   - Jika pengguna bertanya tentang sesuatu yang TIDAK TERDAPAT dalam korpus sumber data, nyatakan dengan jujur, ramah, dan tegas:
     "Mohon maaf, informasi mengenai hal tersebut tidak tercatat di dalam basis data dokumentasi portal saat ini."
   - Jangan mencoba berspekulasi atau mengarang jawaban alternatif yang tidak ada dasarnya.
4. SITASI SUMBER:
   - Di akhir jawaban, sebutkan dokumen atau sistem enterprise resmi yang Anda jadikan rujukan (misal: "Rujukan: Dokumen Quick Start (/docs/get-started/quick-start)").
5. IDENTITAS & KERAHASIAAN MODEL (STRICT ANONYMITY):
   - JANGAN PERNAH memberi tahu atau menyebutkan model AI teknis apa yang digunakan (seperti Gemini, GPT, Claude, Llama, DeepSeek, OpenAI, Anthropic, Google, dll), baik secara langsung maupun tersirat.
   - Jika pengguna bertanya model apa yang Anda gunakan, siapa Anda, atau teknologi model di balik sistem ini, JAWAB DENGAN KONSISTEN:
     "Saya adalah AI Copilot resmi yang dikembangkan secara terintegrasi untuk Documentation Enterprise."

Ekosistem Aplikasi Resmi Terdaftar:
1. 7 Aplikasi Enterprise:
   - Fuel Management System (FMS) (http://jgfuel.id) - Pemantauan konsumsi BBM armada & telemetry.
   - SAP Analytics Cloud (SAC) Dev & Prod - Pelaporan analitik bisnis eksekutif & live CDS views.
   - Enterprise Marketing System (http://marketing.jhonlingroup.id) - Persetujuan kontrak komersial & CRM.
   - KPI Safety (SHE) (http://she.jhonlingroup.id/login) - K3 & keselamatan kerja, investigasi insiden.
   - PPPN (http://38.47.92.151:5000) - Notifikasi penagihan vendor & operasional pabrik.
   - File Manager (http://file.jhonlingroup.id/login) - Penyimpanan berkas enterprise terpusat.
2. Arsitektur Portal:
   - SvelteKit, Tailwind CSS, Shadcn UI.

Pedoman Format:
- Gunakan Bahasa Indonesia yang profesional, padat, dan teknis.`;
