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
		} else if (action === 'improve') {
			messages = [
				{
					role: 'system',
					content: `Anda adalah Senior Technical Editor spesialis sistem ${targetSection}. Perbaiki, rapikan, dan sempurnakan konten dokumentasi berikut agar memiliki alur logis yang jelas, tata bahasa profesional Bahasa Indonesia, format heading konsisten, dan alert ([!NOTE], [!TIP]) yang tepat.
Balas HANYA teks konten hasil perbaikan.`
				},
				{
					role: 'user',
					content: `Instruksi Khusus: ${prompt || 'Tingkatkan kualitas, struktur, dan keterbacaan teknis'}\n\nKonten Saat Ini:\n${currentDoc?.content || ''}`
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
