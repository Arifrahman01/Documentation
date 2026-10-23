import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import docsData from '$lib/data/docsIndex.json';
import localDocs from '$lib/data/documents.json';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
	const slug = params.slug || 'sap/overview';

	let doc: any = null;

	// 1. In browser, try fetching latest version from backend API
	if (browser) {
		try {
			const res = await fetch(`/api/docs/${slug}`);
			if (res.ok) {
				doc = await res.json();
			}
		} catch (e) {
			// fallback
		}
	}

	// 2. Bundled JSON database (used for SSR or API fallback)
	if (!doc) {
		doc = (localDocs as any[]).find((d: any) => d.slug === slug || d.id === slug);
	}

	if (!doc) {
		doc = localDocs[0];
	}

	if (!doc) {
		throw error(404, `Dokumentasi '${slug}' tidak ditemukan`);
	}

	// 3. Sections & Tree data
	let treeData = (docsData as any).treeData || [];
	let sectionTree = (docsData as any).sectionTree || [];
	let sectionStats = (docsData as any).sectionStats || { SAP: 0, SAC: 0, WEB: 0 };
	let sections = (docsData as any).sections || ['SAP', 'SAC', 'WEB'];

	if (browser) {
		try {
			const treeRes = await fetch('/api/docs');
			if (treeRes.ok) {
				const treeJson = await treeRes.json();
				if (treeJson.treeData) treeData = treeJson.treeData;
				if (treeJson.sectionTree) sectionTree = treeJson.sectionTree;
				if (treeJson.sectionStats) sectionStats = treeJson.sectionStats;
				if (treeJson.sections) sections = treeJson.sections;
			}
		} catch (e) {
			// fallback to local treeData
		}
	}

	// 4. Previous & Next articles navigation (within current section)
	const allDocs = localDocs as any[];
	const currentSection = doc.section || 'SAP';
	const sectionDocs = allDocs.filter((d: any) => (d.section || 'SAP') === currentSection);
	const currentIndex = sectionDocs.findIndex((d: any) => d.slug === slug || d.id === slug);
	const prevArticle = currentIndex > 0 ? sectionDocs[currentIndex - 1] : null;
	const nextArticle = currentIndex < sectionDocs.length - 1 && currentIndex >= 0 ? sectionDocs[currentIndex + 1] : null;

	return {
		slug: doc.slug,
		doc,
		article: {
			title: doc.title,
			section: doc.section || 'SAP',
			category: doc.category,
			subcategory: doc.subcategory,
			snippet: doc.snippet || doc.description,
			tags: doc.tags || [],
			updatedAt: doc.updatedAt
		},
		content: doc.content,
		prevArticle: prevArticle ? { title: prevArticle.title, path: prevArticle.slug } : null,
		nextArticle: nextArticle ? { title: nextArticle.title, path: nextArticle.slug } : null,
		treeData,
		sectionTree,
		sectionStats,
		sections
	};
};
