import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AI_CONFIG, callAiChat } from '$lib/server/ai';
import { inferSection } from '$lib/server/docs';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, prompt, currentDoc, section } = body;

		if (!action) {
			return json({ error: 'Parameter action diperlukan' }, { status: 400 });
		}

		const targetSection = (section || (currentDoc ? inferSection(currentDoc) : 'SAP')).toUpperCase();
		let sectionContext = '';
		if (targetSection === 'SAP') {
			sectionContext =
				'Fokuskan panduan pada ekosistem SAP (ERP, S/4HANA, modul FI/CO/MM/SD/PM, ABAP, RFC, BAPI, SAP Gateway, CDS Views).';
		} else if (targetSection === 'SAC') {
			sectionContext =
				'Fokuskan panduan pada SAP Analytics Cloud (Stories, Responsive/Canvas Pages, Charts, Live Data Connections, Cloud Connector, Data Access Control DAC, Planning).';
		} else if (targetSection === 'MY DOCS' || targetSection === 'MY-DOCS' || targetSection === 'PRIBADI') {
			sectionContext =
				'Fokuskan pada penulisan catatan teknis pribadi yang padat, rapi, terstruktur dengan format Markdown, checklist tindakan, dan penjelasan praktis.';
		} else {
			sectionContext =
				'Fokuskan panduan pada Modern Web Stack (SvelteKit, Tailwind CSS, REST APIs, Microservices, Security, Node.js Express).';
		}

		let messages: Array<{ role: string; content: string }> = [];

		if (action === 'generate') {
			messages = [
				{
					role: 'system',
					content: `Anda adalah Enterprise Technical Writer & Solutions Architect AI spesialis bidang ${targetSection}.
${sectionContext}
Tugas Anda adalah membuat dokumentasi teknis baru yang sangat terstruktur, rapi, dan komprehensif dalam Bahasa Indonesia.
Balas HANYA dalam format JSON valid (tanpa markdown fences di luar JSON) dengan struktur persis berikut:
{
  "section": "${targetSection}",
  "title": "Judul Dokumentasi yang Jelas dan Informatif",
  "category": "Kategori Sub-Topik (misal untuk SAP: Core Architecture / Integration / Gateway; untuk SAC: Stories & Visuals / Data Modeling / BI; untuk WEB: Web Stack / Security / API)",
  "description": "Ringkasan eksekutif 1-2 kalimat tentang dokumen ini",
  "tags": ["${targetSection}", "Tag2", "Tag3"],
  "content": "Isi lengkap dokumentasi terstruktur rapi dalam Markdown kaya. Gunakan Heading H2 (##) dan H3 (###), poin-poin penjelasan, tabel jika relevan, peringatan [!NOTE] atau [!TIP], serta blok kode implementasi konkret dengan penjelasannya."
}`
				},
				{
					role: 'user',
					content: `Buatkan dokumentasi teknis baru bagian [${targetSection}] untuk topik berikut:\n"${prompt || `Panduan Praktis Implementasi & Arsitektur ${targetSection}`}"`
				}
			];
		} else if (action === 'improve' || action === 'custom') {
			messages = [
				{
					role: 'system',
					content: `Anda adalah Enterprise Technical Assistant & Editor AI (${targetSection}).
Tugas Anda adalah memperbarui, memodifikasi, menyusun, atau menulis konten catatan Markdown pengguna secara langsung berdasarkan instruksi manual yang diberikan pengguna.
1. Ikuti instruksi manual pengguna dengan cermat.
2. Pertahankan fakta asli dan detail teknis yang relevan kecuali jika pengguna meminta untuk mengubah atau merombaknya.
3. Gunakan format Markdown yang bersih dan terstruktur (Heading, list, tabel, atau code block jika relevan).
4. Balas HANYA teks isi dokumen Markdown yang sudah diproses, tanpa kalimat basa-basi atau kata pengantar (tanpa "Berikut adalah...").`
				},
				{
					role: 'user',
					content: `Instruksi Pengguna: ${prompt || 'Tingkatkan kualitas, struktur, dan keterbacaan teknis'}\n\nKonten Catatan Saat Ini:\n${currentDoc?.content || '(Catatan masih kosong)'}`
				}
			];
		} else if (action === 'code') {
			messages = [
				{
					role: 'system',
					content: `Anda adalah Lead Software Engineer & Enterprise Architect spesialis ${targetSection}. Buatkan contoh kode implementasi nyata dan best practices (dengan komentar penjelasan) untuk memperkaya dokumentasi ini.
Balas HANYA dalam format blok kode Markdown dengan sedikit penjelasan.`
				},
				{
					role: 'user',
					content: `Kebutuhan Kode: ${prompt || `Contoh implementasi teknis lengkap ${targetSection}`}\n\nKonteks Dokumen: ${currentDoc?.title || ''}\n${(currentDoc?.content || '').slice(0, 1200)}`
				}
			];
		} else if (action === 'summarize') {
			messages = [
				{
					role: 'system',
					content:
						'Anda adalah Asisten Perangkum Teknis Enterprise. Buat ringkasan eksekutif 3-4 butir poin kunci yang padat, aplikatif, dan jelas dalam Bahasa Indonesia.'
				},
				{
					role: 'user',
					content: `Judul: ${currentDoc?.title || ''}\n\nIsi Dokumen:\n${(currentDoc?.content || '').slice(0, 4500)}`
				}
			];
		} else if (action === 'format') {
			messages = [
				{
					role: 'system',
					content: `Anda adalah Formatter Dokumentasi Teknis Enterprise (${targetSection}).
Tugas Anda adalah merapikan catatan mentah/kasar pengguna menjadi format Markdown yang sangat rapi, bersih, dan terstruktur:
1. PERTAHANKAN 100% FAKTA ASLI: Jangan menghapus detail teknis, nama tabel, rumus, ukuran, T-Code, atau langkah yang ditulis pengguna, dan jangan mengarang fakta baru di luar catatan pengguna.
2. Gunakan Heading H2 (##) dan H3 (###) secara proporsional.
3. Ubah daftar parameter, perbandingan, atau ukuran menjadi Tabel Markdown (| Kolom |) jika cocok.
4. Bungkus rumus, query, atau kode ke dalam blok kode (\`\`\`) dan sorot informasi penting dengan Callout (> [!NOTE] atau > [!TIP]).
5. Balas HANYA teks Markdown yang sudah dirapikan tanpa kata pengantar.`
				},
				{
					role: 'user',
					content: `Judul Dokumen: ${currentDoc?.title || prompt || 'Catatan Dokumentasi'}\n\nCatatan Mentah yang Perlu Dirapikan:\n${currentDoc?.content || prompt || ''}`
				}
			];
		} else {
			return json({ error: `Aksi '${action}' tidak dikenali` }, { status: 400 });
		}

		const aiRes = await callAiChat(messages, AI_CONFIG.defaultModel, 1800);
		const output = aiRes.message;

		if (action === 'generate') {
			try {
				const cleaned = output
					.replace(/^```json\s*/i, '')
					.replace(/\s*```$/i, '')
					.trim();
				const parsed = JSON.parse(cleaned);
				return json({ success: true, result: parsed });
			} catch (err) {
				return json({
					success: true,
					result: {
						title: prompt || 'Dokumentasi Baru',
						category: 'Architecture',
						description: 'Dokumentasi teknis dibuat otomatis oleh AI Copilot',
						tags: ['AI Generated'],
						content: output
					}
				});
			}
		}

		return json({ success: true, result: output });
	} catch (err: any) {
		console.error('AI Doc Assist Error:', err?.message);
		return json({ error: err?.message || 'Gagal menjalankan bantuan AI' }, { status: 500 });
	}
};
