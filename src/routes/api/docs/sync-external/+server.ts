import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	startExternalDocsSyncBackground,
	cancelExternalDocsSync,
	getSyncStatus
} from '$lib/server/scheduler';

export const GET: RequestHandler = async () => {
	const status = getSyncStatus();
	return json({
		status: 'ok',
		schedule: 'Setiap hari pukul 00:00 (12:00 AM)',
		...status
	});
};

export const POST: RequestHandler = async ({ request, url }) => {
	// Check for action=stop
	if (url.searchParams.get('action') === 'stop') {
		const abortResult = cancelExternalDocsSync();
		return json(abortResult);
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch (_) {}

	if (body?.action === 'stop') {
		const abortResult = cancelExternalDocsSync();
		return json(abortResult);
	}

	const types = Array.isArray(body?.types) && body.types.length > 0 ? body.types : ['pdf', 'docx', 'xlsx'];
	const force = Boolean(body?.force);

	const result = startExternalDocsSyncBackground({ types, force });
	return json({
		status: result.started ? 'started' : 'already_running',
		message: result.message,
		isSyncRunning: result.isSyncRunning,
		types,
		force,
		timestamp: new Date().toISOString()
	});
};

export const DELETE: RequestHandler = async () => {
	const abortResult = cancelExternalDocsSync();
	return json(abortResult);
};
