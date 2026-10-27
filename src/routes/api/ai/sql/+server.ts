import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	checkDbHealth,
	executeSafeQuery,
	generateSmartQueryForQuestion,
	HELPDESK_SCHEMA_INFO
} from '$lib/server/database';

export const GET: RequestHandler = async () => {
	const health = await checkDbHealth();
	if (health.status !== 'connected') {
		return json(
			{
				status: 'error',
				message: 'Database tidak tersambung',
				database: health.database,
				host: health.host,
				error: health.error
			},
			{ status: 503 }
		);
	}

	// Ambil ringkasan status tiket realtime sesuai Dashboard (`ticket_type = 'Ticket'` dan `deleted_at IS NULL`)
	const summaryQuery = await executeSafeQuery(
		`SELECT status, COUNT(*) as total FROM tickets WHERE deleted_at IS NULL AND ticket_type = 'Ticket' GROUP BY status ORDER BY total DESC`
	);

	return json({
		status: 'online',
		database: health.database,
		host: health.host,
		ticketStatusSummary: summaryQuery.rows,
		schema: HELPDESK_SCHEMA_INFO
	});
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { sql, question } = body;

		let targetSql = sql;
		if (!targetSql && question) {
			targetSql = generateSmartQueryForQuestion(question);
		}

		if (!targetSql) {
			return json(
				{
					error: 'Parameter `sql` atau `question` diperlukan untuk query database'
				},
				{ status: 400 }
			);
		}

		const result = await executeSafeQuery(targetSql);

		if (!result.success) {
			return json(
				{
					error: result.error || 'Eksekusi query gagal',
					sql: result.sql
				},
				{ status: 400 }
			);
		}

		return json({
			status: 'success',
			sql: result.sql,
			rowCount: result.rowCount,
			data: result.rows
		});
	} catch (err: any) {
		return json(
			{
				error: err?.message || 'Internal server error saat menjalankan query SQL'
			},
			{ status: 500 }
		);
	}
};
