import type { PageLoad } from './$types';
import docsData from '$lib/data/docsIndex.json';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
	const slug = params.slug || 'get-started/quick-start';
	
	// Find metadata
	const article = docsData.articles.find((a: any) => a.path === slug) || docsData.articles[0];
	
	// Fetch the markdown content
	const res = await fetch(`/docs/${slug}.md`);
	if (!res.ok) {
		throw error(404, `Dokumentasi '${slug}' tidak ditemukan`);
	}
	
	const content = await res.text();
	
	// Find previous and next articles
	const currentIndex = docsData.articles.findIndex((a: any) => a.path === slug);
	const prevArticle = currentIndex > 0 ? docsData.articles[currentIndex - 1] : null;
	const nextArticle = currentIndex < docsData.articles.length - 1 ? docsData.articles[currentIndex + 1] : null;

	return {
		slug,
		article,
		content,
		prevArticle,
		nextArticle,
		treeData: docsData.treeData
	};
};
