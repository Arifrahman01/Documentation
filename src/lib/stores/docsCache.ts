import docsData from '$lib/data/docsIndex.json';
import localDocs from '$lib/data/documents.json';
import { browser } from '$app/environment';

export interface TreeDataPayload {
	treeData: any[];
	sectionTree: any[];
	sectionStats: Record<string, number>;
	sections: string[];
}

// In-memory document content cache (key: slug or id)
const docCache = new Map<string, any>();

// In-memory tree navigation cache
let cachedTree: TreeDataPayload | null = null;
let isFetchingTree = false;

/**
 * Returns tree data immediately from memory cache or bundled fallback.
 * Triggers non-blocking background refresh in browser if needed.
 */
export function getCachedTree(): TreeDataPayload {
	if (!cachedTree) {
		cachedTree = {
			treeData: (docsData as any).treeData || [],
			sectionTree: (docsData as any).sectionTree || [],
			sectionStats: (docsData as any).sectionStats || { SAP: 0, SAC: 0, WEB: 0 },
			sections: (docsData as any).sections || ['SAP', 'SAC', 'WEB']
		};

		if (browser && !isFetchingTree) {
			refreshTreeInBackground();
		}
	}
	return cachedTree;
}

/**
 * Refreshes tree data in the background without blocking navigation.
 */
export async function refreshTreeInBackground(): Promise<TreeDataPayload | null> {
	if (isFetchingTree || !browser) return cachedTree;
	isFetchingTree = true;
	try {
		const res = await fetch('/api/docs');
		if (res.ok) {
			const d = await res.json();
			if (d && d.treeData) {
				updateTreeCache(d.treeData, d.sectionTree, d.sectionStats, d.sections);
			}
		}
	} catch (_) {
		// Keep existing cache on network failure
	} finally {
		isFetchingTree = false;
	}
	return cachedTree;
}

/**
 * Updates memory tree cache when user reorders, renames, creates or deletes folders.
 */
export function updateTreeCache(
	treeData: any[],
	sectionTree?: any[],
	sectionStats?: Record<string, number>,
	sections?: string[]
) {
	if (!cachedTree) {
		cachedTree = {
			treeData: treeData || [],
			sectionTree: sectionTree || [],
			sectionStats: sectionStats || { SAP: 0, SAC: 0, WEB: 0 },
			sections: sections || ['SAP', 'SAC', 'WEB']
		};
	} else {
		if (treeData) cachedTree.treeData = treeData;
		if (sectionTree) cachedTree.sectionTree = sectionTree;
		if (sectionStats) cachedTree.sectionStats = sectionStats;
		if (sections) cachedTree.sections = sections;
	}
}

/**
 * Retrieves a document from in-memory cache if available.
 */
export function getCachedDoc(slug: string): any | null {
	if (!slug) return null;
	return docCache.get(slug) || null;
}

/**
 * Retrieves a document from the bundled offline database.
 */
export function getLocalFallbackDoc(slug: string): any | null {
	if (!slug) return null;
	return (localDocs as any[]).find((d: any) => d.slug === slug || d.id === slug) || null;
}

/**
 * Updates in-memory document cache when created or modified.
 */
export function updateDocCache(doc: any) {
	if (doc && (doc.slug || doc.id)) {
		if (doc.slug) docCache.set(doc.slug, doc);
		if (doc.id) docCache.set(doc.id, doc);
	}
}

/**
 * Invalidates cache for a specific slug or clears all cache.
 */
export function invalidateDocCache(slug?: string) {
	if (slug) {
		docCache.delete(slug);
	} else {
		docCache.clear();
		cachedTree = null;
	}
}
