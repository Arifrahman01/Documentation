import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runExternalDocsSync, getSyncStatus } from '$lib/server/scheduler';

export const GET: RequestHandler = async () => {
	const status = getSyncStatus();
	return json({
		status: 'ok',
		schedule: 'Setiap hari pukul 00:00 (12:00 AM)',
		...status
	});
};

export const POST: RequestHandler = async () => {
	const result = await runExternalDocsSync();
	if (result.success) {
		return json({
			status: 'success',
			message: result.message,
			timestamp: new Date().toISOString()
		});
	} else {
		return json(
			{
				status: 'error',
				message: result.message
			},
			{ status: 500 }
		);
	}
};
