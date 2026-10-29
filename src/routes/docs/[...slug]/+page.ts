import type { PageLoad } from './$types';
import localDocs from '$lib/data/documents.json';
import { error } from '@sveltejs/kit';
import {
	getCachedTree,
	getCachedDoc,
	updateDocCache,
	getLocalFallbackDoc
} from '$lib/stores/docsCache';

export const load: PageLoad = async ({ params, fetch }) => {
	const slug = params.slug || 'sap/overview';

	// 1. Resolve Tree Data (Instant synchronous lookup from memory cache, 0ms)
	const treeInfo = getCachedTree();
	const treeData = treeInfo.treeData;
	const sectionTree = treeInfo.sectionTree;
	const sectionStats = treeInfo.sectionStats;
	const sections = treeInfo.sections;

	// 2. Resolve Document Content (Cache first, then single-doc network fetch)
	let doc: any = getCachedDoc(slug);

	if (!doc) {
		try {
			const res = await fetch(`/api/docs/${slug}`);
			if (res.ok) {
				doc = await res.json();
				updateDocCache(doc);
			}
		} catch (e) {
			// fallback to local bundled database
		}
	}

	if (!doc) {
		doc = getLocalFallbackDoc(slug);
		if (doc) updateDocCache(doc);
	}

	if (!doc && (!params.slug || slug === 'sap/overview')) {
		doc = (localDocs as any[])[0];
		if (doc) updateDocCache(doc);
	}

	if (!doc) {
		throw error(404, `Dokumentasi '${slug}' tidak ditemukan`);
	}

	// 3. Previous & Next articles navigation (within current section)
	const nodesFromTree: any[] = [];
	for (const group of treeData) {
		if (Array.isArray(group.nodes)) {
			nodesFromTree.push(...group.nodes);
		}
	}
	const allDocs = nodesFromTree.length > 0 ? nodesFromTree : (localDocs as any[]);
	const currentSection = doc.section || 'SAP';
	const sectionDocs = allDocs.filter((d: any) => (d.section || 'SAP') === currentSection);
	const currentIndex = sectionDocs.findIndex((d: any) => d.slug === slug || d.id === slug);
	const prevArticle = currentIndex > 0 ? sectionDocs[currentIndex - 1] : null;
	const nextArticle =
		currentIndex < sectionDocs.length - 1 && currentIndex >= 0 ? sectionDocs[currentIndex + 1] : null;

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
			content: doc.content || '',
			builderContent: doc.builderContent || '',
			sacUrl: doc.sacUrl || '',
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
