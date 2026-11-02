import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyWriteAccess } from '$lib/server/auth';
import {
	startExternalDocsSyncBackground,
	cancelExternalDocsSync,
	getSyncStatus
} from '$lib/server/scheduler';

export const GET: RequestHandler = async () => {
	const status = getSyncStatus();
	return json(
		{
			status: 'ok',
			schedule: 'Setiap hari pukul 00:00 (12:00 AM)',
			...status
		},
		{
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		}
	);
};

export const POST: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;

	const { request, url } = event;
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

	const types =
		Array.isArray(body?.types) && body.types.length > 0 ? body.types : ['pdf', 'docx', 'xlsx'];
	const force = Boolean(body?.force);
	const batchLimit =
		typeof body?.batchLimit === 'number' && body.batchLimit > 0 ? body.batchLimit : 0;

	const result = startExternalDocsSyncBackground({ types, force, batchLimit });
	return json({
		status: result.started ? 'started' : 'already_running',
		message: result.message,
		isSyncRunning: result.isSyncRunning,
		types,
		force,
		batchLimit,
		timestamp: new Date().toISOString()
	});
};

export const DELETE: RequestHandler = async (event) => {
	const authCheck = verifyWriteAccess(event);
	if (!authCheck.authorized) return authCheck.response;

	const abortResult = cancelExternalDocsSync();
	return json(abortResult);
};
