import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import docsData from '$lib/data/docsIndex.json';
import localDocs from '$lib/data/documents.json';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
	const slug = params.slug || 'get-started/quick-start';

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

	// 3. Categories / Tree data
	let treeData = docsData.treeData;
	if (browser) {
		try {
			const treeRes = await fetch('/api/docs');
			if (treeRes.ok) {
				const treeJson = await treeRes.json();
				if (treeJson.treeData) treeData = treeJson.treeData;
			}
		} catch (e) {
			// fallback to local treeData
		}
	}

	// 4. Previous & Next articles navigation
	const allDocs = localDocs as any[];
	const currentIndex = allDocs.findIndex((d: any) => d.slug === slug || d.id === slug);
	const prevArticle = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
	const nextArticle = currentIndex < allDocs.length - 1 && currentIndex >= 0 ? allDocs[currentIndex + 1] : null;

	return {
		slug: doc.slug,
		doc,
		article: {
			title: doc.title,
			category: doc.category,
			snippet: doc.snippet || doc.description,
			tags: doc.tags || [],
			updatedAt: doc.updatedAt
		},
		content: doc.content,
		prevArticle: prevArticle ? { title: prevArticle.title, path: prevArticle.slug } : null,
		nextArticle: nextArticle ? { title: nextArticle.title, path: nextArticle.slug } : null,
		treeData
	};
};
