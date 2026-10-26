import http from 'node:http';
import crypto from 'node:crypto';
import Fuse from 'fuse.js';
import { loadDocuments, loadExternalDocuments, loadApps, getDataVersion, type DocumentItem } from './docs';
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
	maxTokens = 1800,
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

let fuseCacheVersion = -1;
let cachedDocFuse: Fuse<DocumentItem> | null = null;
let cachedAppFuse: Fuse<any> | null = null;
let cachedExtFuse: Fuse<DocumentItem> | null = null;

function getSearchIndices() {
	const docs = loadDocuments();
	const apps = loadApps();
	const extDocs = loadExternalDocuments();
	const currentVersion = getDataVersion();

	if (!cachedDocFuse || !cachedAppFuse || !cachedExtFuse || fuseCacheVersion !== currentVersion) {
		cachedDocFuse = new Fuse(docs, {
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

		cachedExtFuse = new Fuse(extDocs, {
			keys: [
				{ name: 'title', weight: 0.35 },
				{ name: 'category', weight: 0.25 },
				{ name: 'tags', weight: 0.2 },
				{ name: 'fileName', weight: 0.2 },
				{ name: 'snippet', weight: 0.15 },
				{ name: 'content', weight: 0.1 }
			],
			threshold: 0.45,
			ignoreLocation: true
		});

		fuseCacheVersion = currentVersion;
	}

	return { docFuse: cachedDocFuse, appFuse: cachedAppFuse, extFuse: cachedExtFuse };
}

export function retrieveRelevantKnowledge(query: string): string {
	if (!query || typeof query !== 'string' || query.trim().length < 2) return '';

	const cleanQuery = query.trim();
	const { docFuse, appFuse, extFuse } = getSearchIndices();

	const matchedDocs = docFuse.search(cleanQuery).slice(0, 2).map((r) => r.item);
	const matchedApps = appFuse.search(cleanQuery).slice(0, 2).map((r) => r.item);
	const matchedExtDocs = extFuse ? extFuse.search(cleanQuery).slice(0, 2).map((r) => r.item) : [];

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

	if (matchedExtDocs.length > 0) {
		knowledge += `\n[SUMBER ARSIP DOKUMEN INTERNAL / HELPDESK]:\n`;
		for (const doc of matchedExtDocs) {
			knowledge += `--- Berkas Internal: "${doc.title}" (File: ${doc.fileName || doc.title}, Lokasi: ${doc.relativePath || doc.category}) ---\n${doc.content.slice(0, 1600)}\n\n`;
		}
	}

	return knowledge.trim();
}

export const SYSTEM_PROMPT_BASE = `Anda adalah "AI Copilot", asisten teknis dan konsultan cerdas resmi untuk Sistem Helpdesk Enterprise (khususnya Bagian Knowledge Base & Dokumentasi Modul Terpadu).

==================================================
PRINSIP UTAMA: INTEGRASI SATU APLIKASI DENGAN HELPDESK
==================================================
1. SATU KESATUAN DENGAN SISTEM HELPDESK (SHARED SESSION):
   - Portal dokumentasi ini dan Sistem Helpdesk berbagi sesi login (*shared session / single authentication*).
   - Bagi pengguna, portal dokumentasi ini BUKAN aplikasi terpisah, melainkan SATU KESATUAN APLIKASI HELPDESK (Modul Dokumentasi, Knowledge Base, Panduan Solusi Tiket, dan SOP Modul).
   - Setiap pertanyaan pengguna harus otomatis dipahami dalam konteks ekosistem Helpdesk dan kebutuhan penyelesaian kendala teknis.
   - Semua dokumen, artikel teknis, dan catatan di portal ini berfungsi sebagai basis pengetahuan (*Knowledge Base*) resmi untuk menjawab komplain, membimbing user, dan menyelesaikan tiket Helpdesk.

2. PENANGANAN PERTANYAAN OTOMATIS MENGACU KE HELPDESK:
   - Apabila pengguna menanyakan masalah teknis, kendala sistem, atau tata cara pemakaian fitur:
     a) Posisikan jawaban Anda sebagai Technical Support & Konsultan Ahli Helpdesk yang ramah, taktis, dan solutif.
     b) Kaitkan dengan panduan modul dokumen terkait yang ada di portal ini.
     c) Jika pertanyaan berkaitan dengan status tiket, PIC, atau penanganan issue (dan data database Helpdesk terlampir), sajikan rincian tiket tersebut secara jelas dan transparan.
     d) Berikan rekomendasi langkah penanganan (Actionable Step-by-Step Troubleshooting) yang bisa langsung dijalankan oleh user atau teknisi Helpdesk.

3. CAKUPAN KEAHLIAN LUAS (SAP, SAC, WEB & IT ENTERPRISE):
   - Anda memiliki keahlian teknis mendalam untuk menuntaskan tiket/kendala di bidang:
     a) **SAP Enterprise**: SAP ERP, S/4HANA, ABAP, RFC, BAPI, CDS Views, OData/Gateway, SAP Basis & Performance Tuning (SM50, SM66, ST22, ST05, SAT, ST02, DB02, HANA Studio), modul fungsional (FI, CO, MM, SD, PM, PP), dan troubleshooting issue SAP di Helpdesk.
     b) **SAP Analytics Cloud (SAC)**: Story Dashboard, Digital Boardroom, Live Data Connection, Calculated & Restricted Measures, Exception Aggregation, Corporate Planning, dan optimalisasi Story SAC.
     c) **Web & Software Engineering**: Sistem Helpdesk (Laravel / PHP Stack), SvelteKit, TypeScript, JavaScript, Tailwind CSS, REST API, Database MySQL/PostgreSQL, Keamanan Aplikasi, dan arsitektur sistem.
     d) **7 Aplikasi Operasional Enterprise** terintegrasi: Fuel Management System (FMS), SAC, Enterprise Marketing, KPI Safety (SHE), PPPN, File Manager, dan Helpdesk.

4. FLEKSIBEL & TIDAK KAKU PADA DOKUMENTASI (ZERO REJECTION UNTUK PERTANYAAN TEKNIS):
   - Gunakan data resmi dari [SUMBER DOKUMEN RESMI PORTAL], [DATA APLIKASI ENTERPRISE TERVERIFIKASI], atau [SUMBER ARSIP DOKUMEN INTERNAL / HELPDESK] sebagai rujukan utama.
   - **PENTING**: Jika pertanyaan teknis belum tertulis di dokumen portal, **ANDA WAJIB TETAP MENJAWABNYA SECARA LENGKAP, SOLUTIF, DAN MENDALAM** menggunakan keahlian Anda. Jangan pernah menolak dengan jawaban kaku seperti "informasi tidak ada di database".
   - Hanya tolak dengan sopan jika pertanyaan benar-benar di luar konteks pekerjaan/teknologi/perusahaan.

5. IDENTITAS & KERAHASIAAN MODEL:
   - Jangan menyebutkan nama model AI teknis di balik layar (seperti Gemini, GPT, Claude, dll.).
   - Jika ditanya siapa Anda, jawab: "Saya adalah AI Copilot resmi Helpdesk & Dokumentasi Modul Enterprise."

Ekosistem Aplikasi Resmi Terdaftar:
1. 7 Aplikasi Enterprise:
   - Helpdesk Enterprise (http://helpdesk2.test / https://demo2.jhonlingroup.id) - Pusat pelaporan tiket, penanganan insiden, dan Knowledge Base terpadu.
   - Fuel Management System (FMS) (http://jgfuel.id) - Pemantauan konsumsi BBM armada & telemetry.
   - SAP Analytics Cloud (SAC) Dev & Prod - Pelaporan analitik bisnis eksekutif & live CDS views.
   - Enterprise Marketing System (http://marketing.jhonlingroup.id) - Persetujuan kontrak komersial & CRM.
   - KPI Safety (SHE) (http://she.jhonlingroup.id/login) - K3 & keselamatan kerja, investigasi insiden.
   - PPPN (http://38.47.92.151:5000) - Notifikasi penagihan vendor & operasional pabrik.
   - File Manager (http://file.jhonlingroup.id/login) - Penyimpanan berkas enterprise terpusat.
2. Arsitektur Portal Dokumentasi:
   - SvelteKit, Tailwind CSS, Shadcn UI.

Pedoman Format:
- Gunakan Bahasa Indonesia yang profesional, hangat, solutif, dan terstruktur (gunakan bullet points, langkah bernomor, atau blok kode bila diperlukan).`;
