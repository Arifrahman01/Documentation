import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadApps, saveApps } from '$lib/server/docs';

const CATEGORY_LABELS: Record<string, string> = {
	operations: 'Operations & Logistics',
	analytics: 'Analytics & BI',
	commercial: 'Marketing & CRM',
	safety: 'Safety & SHE',
	finance: 'Finance & Plant',
	storage: 'Storage & Infra'
};

export const GET: RequestHandler = async () => {
	const programs = loadApps();
	return json({
		programs,
		total: programs.length
	});
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { title, subtitle, description, url, category, status, tags, docSlug } = body;

		if (!title || !url) {
			return json({ error: 'Nama program dan URL wajib diisi' }, { status: 400 });
		}

		const programs = loadApps();
		const id =
			body.id ||
			title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');

		const cat = category || 'operations';
		const newProgram = {
			id,
			title: title.trim(),
			subtitle: (subtitle || CATEGORY_LABELS[cat] || 'Enterprise Application').trim(),
			description: (description || `Sistem aplikasi operasional ${title.trim()}.`).trim(),
			url: url.trim(),
			category: cat,
			categoryName: CATEGORY_LABELS[cat] || cat,
			status: status || 'Production',
			statusState: status === 'Development' ? 'Warning' : 'Success',
			icon: 'sap-icon://business-objects-experience',
			iconColor: 'sdkIconBlue',
			tags: Array.isArray(tags) && tags.length > 0 ? tags : [title.trim(), 'Enterprise'],
			docSlug: docSlug ? String(docSlug).trim() : undefined
		};

		const existingIdx = programs.findIndex((p: any) => p.id === id);
		if (existingIdx >= 0) {
			programs[existingIdx] = { ...programs[existingIdx], ...newProgram };
		} else {
			programs.push(newProgram);
		}

		const saved = saveApps(programs);
		return json({ success: true, program: newProgram, programs: saved.programs });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menyimpan program' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { id, title, subtitle, description, url, category, status, tags, docSlug } = body;

		if (!id) {
			return json({ error: 'ID program diperlukan' }, { status: 400 });
		}

		const programs = loadApps();
		const idx = programs.findIndex((p: any) => p.id === id);
		if (idx === -1) {
			return json({ error: 'Program tidak ditemukan' }, { status: 404 });
		}

		const current = programs[idx];
		const cat = category || current.category || 'operations';
		const updated = {
			...current,
			title: title ? title.trim() : current.title,
			subtitle: subtitle !== undefined ? subtitle.trim() : current.subtitle,
			description: description !== undefined ? description.trim() : current.description,
			url: url ? url.trim() : current.url,
			category: cat,
			categoryName: CATEGORY_LABELS[cat] || current.categoryName || cat,
			status: status || current.status || 'Production',
			statusState: (status || current.status) === 'Development' ? 'Warning' : 'Success',
			tags: Array.isArray(tags) ? tags : current.tags,
			docSlug: docSlug !== undefined ? (docSlug ? String(docSlug).trim() : undefined) : current.docSlug
		};

		programs[idx] = updated;
		const saved = saveApps(programs);
		return json({ success: true, program: updated, programs: saved.programs });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal memperbarui program' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'ID program diperlukan' }, { status: 400 });
		}

		let programs = loadApps();
		programs = programs.filter((p: any) => p.id !== id);
		const saved = saveApps(programs);
		return json({ success: true, programs: saved.programs });
	} catch (err: any) {
		return json({ error: err?.message || 'Gagal menghapus program' }, { status: 500 });
	}
};
