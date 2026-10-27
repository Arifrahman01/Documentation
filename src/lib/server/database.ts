import mysql from 'mysql2/promise';

export interface DbConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	password?: string;
}

function getDbConfig(): DbConfig {
	return {
		host: process.env.DB_HOST || '127.0.0.1',
		port: parseInt(process.env.DB_PORT || '3306', 10),
		database: process.env.DB_DATABASE || 'helpdesk',
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || 'root'
	};
}

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
	if (!pool) {
		const cfg = getDbConfig();
		pool = mysql.createPool({
			host: cfg.host,
			port: cfg.port,
			database: cfg.database,
			user: cfg.user,
			password: cfg.password,
			waitForConnections: true,
			connectionLimit: 6,
			maxIdle: 3,
			idleTimeout: 60000,
			connectTimeout: 5000,
			enableKeepAlive: true,
			keepAliveInitialDelay: 10000
		});
	}
	return pool;
}

export async function checkDbHealth(): Promise<{
	status: 'connected' | 'disconnected';
	database: string;
	host: string;
	error?: string;
}> {
	const cfg = getDbConfig();
	try {
		const p = getDbPool();
		const conn = await p.getConnection();
		await conn.ping();
		conn.release();
		return {
			status: 'connected',
			database: cfg.database,
			host: `${cfg.host}:${cfg.port}`
		};
	} catch (err: any) {
		return {
			status: 'disconnected',
			database: cfg.database,
			host: `${cfg.host}:${cfg.port}`,
			error: err?.message || 'Gagal tersambung ke MySQL'
		};
	}
}

/**
 * Validasi ketat keamanan query SQL (Strict Read-Only).
 * Hanya mengizinkan SELECT dan menolak semua query destruktif (INSERT, UPDATE, DELETE, DROP, dll).
 */
export function validateSafeQuery(sql: string): { valid: boolean; reason?: string; safeSql?: string } {
	if (!sql || typeof sql !== 'string') {
		return { valid: false, reason: 'Query SQL kosong' };
	}

	const trimmed = sql.trim();

	// Hapus trailing semicolon jika ada
	const cleaned = trimmed.replace(/;+\s*$/, '').trim();

	// Cek apakah ada multiple statements (adanya titik koma di tengah)
	if (cleaned.includes(';')) {
		return { valid: false, reason: 'Multiple statements (titik koma) tidak diizinkan demi keamanan' };
	}

	// Wajib diawali dengan SELECT atau WITH (CTE SELECT) atau EXPLAIN
	if (!/^(SELECT|WITH|EXPLAIN)\s+/i.test(cleaned)) {
		return { valid: false, reason: 'Hanya query pembacaan data (SELECT) yang diizinkan' };
	}

	// Blacklist kata kunci berbahaya
	const forbiddenPattern = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|GRANT|REVOKE|SHUTDOWN|LOCK|UNLOCK|FLUSH|KILL|EXEC|EXECUTE|OUTFILE|DUMPFILE)\b/i;
	if (forbiddenPattern.test(cleaned)) {
		return { valid: false, reason: 'Query mengandung kata kunci modifikasi/destruktif yang dilarang' };
	}

	// Pastikan memiliki LIMIT maksimal 50 agar tidak membebani memori
	let finalSql = cleaned;
	const limitMatch = cleaned.match(/\bLIMIT\s+(\d+)(\s*,\s*(\d+))?$/i);
	if (limitMatch) {
		const requestedLimit = parseInt(limitMatch[3] || limitMatch[1], 10);
		if (requestedLimit > 50) {
			finalSql = cleaned.replace(/\bLIMIT\s+.*$/i, 'LIMIT 50');
		}
	} else {
		finalSql = `${cleaned} LIMIT 50`;
	}

	return { valid: true, safeSql: finalSql };
}

/**
 * Eksekusi query aman dan kembalikan baris data
 */
export async function executeSafeQuery(
	rawSql: string
): Promise<{ success: boolean; sql: string; rows: any[]; error?: string; rowCount: number }> {
	const validation = validateSafeQuery(rawSql);
	if (!validation.valid || !validation.safeSql) {
		return {
			success: false,
			sql: rawSql,
			rows: [],
			rowCount: 0,
			error: validation.reason || 'Query tidak valid'
		};
	}

	try {
		const p = getDbPool();
		const [rows] = await p.query(validation.safeSql);
		const rowArray = Array.isArray(rows) ? (rows as any[]) : [];
		return {
			success: true,
			sql: validation.safeSql,
			rows: rowArray,
			rowCount: rowArray.length
		};
	} catch (err: any) {
		return {
			success: false,
			sql: validation.safeSql,
			rows: [],
			rowCount: 0,
			error: err?.message || 'Error saat eksekusi query SQL'
		};
	}
}

/**
 * Metadata skema tabel untuk panduan AI merumuskan konteks database
 */
export const HELPDESK_SCHEMA_INFO = `[SKEMA DATABASE REALTIME HELPDESK (MySQL)]:
Nama Database: helpdesk

1. TABEL: tickets
   - id: bigint(20) unsigned (Primary Key)
   - ticket_number: bigint(20) (Nomor tiket resmi)
   - ticket_type: varchar(50) ('Ticket' untuk Tiket Pengguna/Dashboard, 'Task' untuk Internal Dev Task)
   - created_by: varchar(100) (Nama pembuat tiket)
   - title: varchar(255) (Judul khusus Task; untuk tiket reguler isi kendala ada di kolom description)
   - description: text (Deskripsi lengkap permasalahan)
   - category: varchar(50) (Kategori tiket)
   - severity: enum('Low', 'Medium', 'High', 'Critical')
   - complexity: enum('low', 'medium', 'hard')
   - status: enum('Open', 'Waiting for Confirmation', 'Escalated to Dev', 'In Development', 'Ready for Testing', 'Rejected by Dev', 'Closed', 'Cancelled')
   - pic_helpdesk: varchar(100) (Teknisi/PIC Helpdesk)
   - dev_assigned_to: bigint(20) unsigned (ID user programmer yang ditugaskan)
   - dev_notes: text (Catatan teknis developer)
   - solutions: text (Solusi penyelesaian masalah)
   - created_at: timestamp (Waktu tiket dibuat)
   - closed_at: timestamp (Waktu tiket diselesaikan/ditutup)
   - deleted_at: timestamp (Soft delete; tiket aktif wajib deleted_at IS NULL)

2. TABEL: modules (id, code, name) & TABEL PIVOT: module_ticket (id, module_id, ticket_id)
   - PENTING: Modul TIDAK disimpan di tabel tickets, melainkan dihubungkan melalui tabel pivot module_ticket (module_ticket.ticket_id = tickets.id dan module_ticket.module_id = modules.id).

3. TABEL: companies (id, code, name) & TABEL PIVOT: company_ticket (id, company_id, ticket_id)
   - PENTING: Perusahaan/Unit TIDAK disimpan di tabel tickets, melainkan dihubungkan melalui tabel pivot company_ticket (company_ticket.ticket_id = tickets.id dan company_ticket.company_id = companies.id).

4. TABEL: categories (id, name, color)
5. TABEL: users (id, name, email, role ['Admin','Functional','Basis','Document','Programmer','Administrator'], department, jabatan, nik) & TABEL PIVOT: ticket_user (ticket_id, user_id)`;

const KNOWN_MODULES: Array<{ code: string; name: string }> = [
	{ code: 'ALLMODULE', name: 'ALL MODULE' },
	{ code: 'BASIS', name: 'SAP Basis / Administration' },
	{ code: 'FIORI', name: 'Fiori' },
	{ code: 'HCM', name: 'Human Capital Management' },
	{ code: 'SAC', name: 'SAC' },
	{ code: 'PM', name: 'Plant Maintenance' },
	{ code: 'MM', name: 'Materials Management' },
	{ code: 'SD', name: 'Sales & Distribution' },
	{ code: 'FI', name: 'Financial Accounting' },
	{ code: 'CO', name: 'Controlling' },
	{ code: 'PS', name: 'Project System' },
	{ code: 'CS', name: 'Customer Service' },
	{ code: 'PP', name: 'Production Planning' },
	{ code: 'FE', name: 'Front-End / Fiori' },
	{ code: 'FM', name: 'Funds Management' },
	{ code: 'QM', name: 'Quality Management' }
];

export function detectModuleInQuery(query: string): { code: string; name: string } | null {
	if (!query || typeof query !== 'string') return null;
	const qLower = query.toLowerCase();

	for (const mod of KNOWN_MODULES) {
		if (mod.name.length >= 5 && qLower.includes(mod.name.toLowerCase())) {
			return mod;
		}
		const escaped = mod.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`\\b${escaped}\\b`, 'i');
		if (regex.test(query)) {
			return mod;
		}
	}

	if (/\bmodul(?:e)?\s+all\b/i.test(query)) {
		return { code: 'ALL', name: 'ALL' };
	}

	return null;
}

/**
 * Deteksi pola pertanyaan pengguna seputar database atau tiket helpdesk
 */
export function isDatabaseQueryIntent(query: string): boolean {
	if (!query || typeof query !== 'string') return false;
	const lower = query.toLowerCase();

	const dbKeywords = [
		'tiket',
		'ticket',
		'task',
		'dashboard',
		'helpdesk',
		'open',
		'closed',
		'waiting',
		'status tiket',
		'in development',
		'ready for testing',
		'rejected by dev',
		'escalated',
		'severity',
		'critical',
		'programmer',
		'developer',
		'pic',
		'jumlah tiket',
		'berapa tiket',
		'total tiket',
		'statistik',
		'rekap',
		'ringkasan',
		'database',
		'tabel tiket',
		'antrian tiket',
		'antrean tiket',
		'daftar tiket',
		'list tiket',
		'tiket terbaru',
		'tiket terakhir',
		'kendala',
		'masalah',
		'laporan',
		'antrean',
		'komplain',
		'eskalasi',
		'progress tiket',
		'developer tiket',
		'modul',
		'module',
		'company',
		'perusahaan',
		'unit'
	];

	if (dbKeywords.some((k) => lower.includes(k))) {
		return true;
	}

	if (/(?:#|\btiket\s+|\bticket\s+|\bnomor\s+|\bno\.?\s*)(\d{2,10})\b/i.test(query)) {
		return true;
	}

	if (detectModuleInQuery(query) !== null) {
		return true;
	}

	return false;
}

/**
 * Query generator cerdas untuk pola pertanyaan umum database helpdesk.
 * Menangani relasi many-to-many module_ticket & modules, serta memfilter deleted_at IS NULL & ticket_type = 'Ticket'
 * agar 100% konsisten dengan Dashboard Helpdesk.
 */
export function generateSmartQueryForQuestion(query: string): string | null {
	const q = query.toLowerCase();
	const isTaskQuery = q.includes('task') || q.includes('dev queue');
	const typeFilter = isTaskQuery ? `t.ticket_type = 'Task'` : `t.ticket_type = 'Ticket'`;
	const matchedModule = detectModuleInQuery(query);

	const whereClauses: string[] = [`t.deleted_at IS NULL`, typeFilter];
	if (matchedModule) {
		const safeCode = matchedModule.code.replace(/'/g, "''");
		whereClauses.push(
			`EXISTS (SELECT 1 FROM module_ticket mt_f INNER JOIN modules m_f ON mt_f.module_id = m_f.id WHERE mt_f.ticket_id = t.id AND m_f.code = '${safeCode}')`
		);
	}
	const baseWhere = whereClauses.join(' AND ');

	const selectTicketCols = `SELECT t.id, t.ticket_number, t.status, t.severity, t.category, t.created_by, COALESCE(NULLIF(t.pic_helpdesk, ''), '-') as pic_helpdesk, COALESCE(GROUP_CONCAT(DISTINCT m.code SEPARATOR ', '), '-') as modules, COALESCE(GROUP_CONCAT(DISTINCT c.code SEPARATOR ', '), '-') as companies, LEFT(COALESCE(NULLIF(t.title, ''), t.description), 160) as description, t.created_at FROM tickets t LEFT JOIN module_ticket mt ON t.id = mt.ticket_id LEFT JOIN modules m ON mt.module_id = m.id LEFT JOIN company_ticket ct ON t.id = ct.ticket_id LEFT JOIN companies c ON ct.company_id = c.id`;
	const groupByTicket = `GROUP BY t.id, t.ticket_number, t.status, t.severity, t.category, t.created_by, t.pic_helpdesk, t.title, t.description, t.created_at`;

	// 1. Tiket yang sedang Open (sesuai Kartu/Tab Open di Dashboard: Open + Escalated to Dev + In Development + Ready for Testing)
	if (q.includes('open') || q.includes('terbuka') || q.includes('aktif') || q.includes('belum selesai')) {
		return `${selectTicketCols} WHERE ${baseWhere} AND t.status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing') ${groupByTicket} ORDER BY t.id DESC LIMIT 25`;
	}

	// 2. Tiket yang sedang Waiting for Confirmation
	if (q.includes('waiting') || q.includes('konfirmasi')) {
		return `${selectTicketCols} WHERE ${baseWhere} AND t.status = 'Waiting for Confirmation' ${groupByTicket} ORDER BY t.id DESC LIMIT 25`;
	}

	// 3. Tiket yang sedang In Development
	if (q.includes('in development') || q.includes('sedang dikembangkan') || q.includes('dikerjakan developer')) {
		return `SELECT t.id, t.ticket_number, t.ticket_type, COALESCE(NULLIF(t.title, ''), LEFT(t.description, 140)) as description, t.created_by, t.severity, t.created_at FROM tickets t WHERE t.deleted_at IS NULL AND t.status = 'In Development' ORDER BY t.id DESC LIMIT 15`;
	}

	// 4. Tiket yang Ready for Testing
	if (q.includes('ready for testing') || q.includes('siap testing') || q.includes('siap ditest')) {
		return `SELECT t.id, t.ticket_number, t.ticket_type, COALESCE(NULLIF(t.title, ''), LEFT(t.description, 140)) as description, t.created_by, t.updated_at FROM tickets t WHERE t.deleted_at IS NULL AND t.status = 'Ready for Testing' ORDER BY t.id DESC LIMIT 15`;
	}

	// 5. Ringkasan status / jumlah tiket
	if (
		(q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('status') || q.includes('statistik') || q.includes('rekap') || q.includes('ringkasan') || q.includes('dashboard')) &&
		(q.includes('tiket') || q.includes('ticket') || q.includes('task') || q.includes('dashboard') || matchedModule !== null) &&
		!q.includes('terakhir') &&
		!q.includes('terbaru') &&
		!q.includes('daftar')
	) {
		if (q.includes('severity') || q.includes('prioritas') || q.includes('kritis') || q.includes('critical')) {
			return `SELECT COALESCE(t.severity, 'Unset') as severity, COUNT(*) as total FROM tickets t WHERE ${baseWhere} GROUP BY t.severity ORDER BY total DESC`;
		}
		if (q.includes('kategori') || q.includes('category')) {
			return `SELECT t.category, COUNT(*) as total FROM tickets t WHERE ${baseWhere} AND t.category IS NOT NULL GROUP BY t.category ORDER BY total DESC LIMIT 10`;
		}
		if (q.includes('pembuat') || q.includes('user') || q.includes('pengguna')) {
			return `SELECT t.created_by, COUNT(*) as total FROM tickets t WHERE ${baseWhere} GROUP BY t.created_by ORDER BY total DESC LIMIT 10`;
		}
		return `SELECT t.status, COUNT(*) as total FROM tickets t WHERE ${baseWhere} GROUP BY t.status ORDER BY total DESC`;
	}

	// 6. Tiket terbaru / terakhir
	if (q.includes('terbaru') || q.includes('terakhir') || q.includes('daftar tiket') || q.includes('list tiket') || matchedModule !== null) {
		return `${selectTicketCols} WHERE ${baseWhere} ${groupByTicket} ORDER BY t.id DESC LIMIT 12`;
	}

	// 7. Tiket dengan severity Critical atau High
	if (q.includes('critical') || q.includes('kritis') || q.includes('high') || q.includes('mendesak')) {
		return `${selectTicketCols} WHERE ${baseWhere} AND (t.severity = 'Critical' OR t.severity = 'High') ${groupByTicket} ORDER BY t.id DESC LIMIT 15`;
	}

	return null;
}

/**
 * Bangun konteks lengkap statistik KPI Dashboard + Cross-Tab Modul (module_ticket) + Daftar Tiket Realtime.
 */
export async function buildRealtimeDbContext(query: string): Promise<string> {
	const blocks: string[] = [];
	const q = (query || '').toLowerCase();
	const matchedModule = detectModuleInQuery(query);

	try {
		const p = getDbPool();

		// 1. Jika ada filter Modul spesifik (misal PM, MM, HCM, dll.), hitung KPI spesifik modul tersebut via module_ticket
		if (matchedModule) {
			const [modStatsRows]: any = await p.query(
				`SELECT 
					COUNT(t.id) as total,
					COALESCE(SUM(t.status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing')), 0) as open_dashboard,
					COALESCE(SUM(t.status = 'Open'), 0) as open_pure,
					COALESCE(SUM(t.status = 'Escalated to Dev'), 0) as escalated,
					COALESCE(SUM(t.status = 'In Development'), 0) as in_dev,
					COALESCE(SUM(t.status = 'Ready for Testing'), 0) as ready_testing,
					COALESCE(SUM(t.status = 'Waiting for Confirmation'), 0) as waiting,
					COALESCE(SUM(t.status = 'Closed'), 0) as closed,
					COALESCE(SUM(t.status = 'Cancelled'), 0) as cancelled,
					COALESCE(SUM(t.status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing') AND (t.pic_helpdesk IS NULL OR t.pic_helpdesk = '')), 0) as unassigned_open
				FROM tickets t
				INNER JOIN module_ticket mt ON t.id = mt.ticket_id
				INNER JOIN modules m ON mt.module_id = m.id
				WHERE t.deleted_at IS NULL AND t.ticket_type = 'Ticket' AND m.code = ?`,
				[matchedModule.code]
			);

			const ms = modStatsRows?.[0] || {};
			const modLines: string[] = [
				`[STATISTIK SPESIFIK MODUL ${matchedModule.code} (${matchedModule.name}) - SESUAI DASHBOARD (\`ticket_type = 'Ticket'\`)]:`,
				`- Total Tiket Modul ${matchedModule.code}: ${ms.total || 0} tiket`,
				`- Jumlah Tiket OPEN Modul ${matchedModule.code} (Kartu/Tab Open Dashboard): ${ms.open_dashboard || 0} tiket (Rincian: Open Murni = ${ms.open_pure || 0}, Escalated to Dev = ${ms.escalated || 0}, In Development = ${ms.in_dev || 0}, Ready for Testing = ${ms.ready_testing || 0})`,
				`- Jumlah Tiket WAITING Modul ${matchedModule.code} (Waiting for Confirmation): ${ms.waiting || 0} tiket`,
				`- Jumlah Tiket CLOSED Modul ${matchedModule.code}: ${ms.closed || 0} tiket`,
				`- Jumlah Tiket CANCELLED Modul ${matchedModule.code}: ${ms.cancelled || 0} tiket`,
				`- Tiket Open Modul ${matchedModule.code} Belum Ada PIC (Unassigned): ${ms.unassigned_open || 0} tiket`
			];

			const [activeModTickets]: any = await p.query(
				`SELECT t.id, t.ticket_number, t.status, COALESCE(t.severity, 'Unset') as severity, COALESCE(t.category, '-') as category,
				        t.created_by, COALESCE(NULLIF(t.pic_helpdesk, ''), 'Belum ada PIC (Unassigned)') as pic_helpdesk,
				        COALESCE(GROUP_CONCAT(DISTINCT c.code SEPARATOR ', '), '-') as companies,
				        LEFT(COALESCE(NULLIF(t.title, ''), t.description), 150) as description,
				        DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i') as created_at
				FROM tickets t
				INNER JOIN module_ticket mt ON t.id = mt.ticket_id
				INNER JOIN modules m ON mt.module_id = m.id
				LEFT JOIN company_ticket ct ON t.id = ct.ticket_id
				LEFT JOIN companies c ON ct.company_id = c.id
				WHERE t.deleted_at IS NULL AND t.ticket_type = 'Ticket' AND m.code = ?
				  AND t.status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing', 'Waiting for Confirmation')
				GROUP BY t.id, t.ticket_number, t.status, t.severity, t.category, t.created_by, t.pic_helpdesk, t.title, t.description, t.created_at
				ORDER BY t.id DESC LIMIT 15`,
				[matchedModule.code]
			);

			if (Array.isArray(activeModTickets) && activeModTickets.length > 0) {
				modLines.push(`- Daftar Tiket Aktif (Open / Waiting) pada Modul ${matchedModule.code}:`);
				for (const t of activeModTickets) {
					modLines.push(
						`  * Tiket #${t.ticket_number} | Status: ${t.status} | Severity: ${t.severity} | Kategori: ${t.category} | Unit: ${t.companies} | Pembuat: ${t.created_by} | PIC: ${t.pic_helpdesk} | Tgl: ${t.created_at} | Deskripsi: ${t.description}`
					);
				}
			} else {
				modLines.push(`- Daftar Tiket Aktif (Open / Waiting) pada Modul ${matchedModule.code}: Tidak ada tiket Open/Waiting saat ini (0 tiket).`);
			}

			blocks.push(modLines.join('\n'));
		}

		// 2. Statistik KPI Global Dashboard Utama (`ticket_type = 'Ticket'`)
		const [globalRows]: any = await p.query(
			`SELECT 
				COUNT(*) as total,
				COALESCE(SUM(status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing')), 0) as open_dashboard,
				COALESCE(SUM(status = 'Open'), 0) as open_pure,
				COALESCE(SUM(status = 'Escalated to Dev'), 0) as escalated,
				COALESCE(SUM(status = 'In Development'), 0) as in_dev,
				COALESCE(SUM(status = 'Ready for Testing'), 0) as ready_testing,
				COALESCE(SUM(status = 'Waiting for Confirmation'), 0) as waiting,
				COALESCE(SUM(status = 'Closed'), 0) as closed,
				COALESCE(SUM(status = 'Cancelled'), 0) as cancelled,
				COALESCE(SUM(status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing') AND (pic_helpdesk IS NULL OR pic_helpdesk = '')), 0) as unassigned_open
			FROM tickets
			WHERE deleted_at IS NULL AND ticket_type = 'Ticket'`
		);

		const gs = globalRows?.[0] || {};
		const total = Number(gs.total || 0);
		const closed = Number(gs.closed || 0);
		const cancelled = Number(gs.cancelled || 0);
		const resRate = total > 0 ? (((closed + cancelled) / total) * 100).toFixed(1) : '0';

		blocks.push(
			[
				`[ANGKA KARTU KPI DASHBOARD UTAMA GLOBAL (\`ticket_type = 'Ticket'\`)]:`,
				`- Total Tiket (Dashboard): ${total} tiket`,
				`- Kartu OPEN (Dashboard & Tab Open): ${gs.open_dashboard || 0} tiket (Gabungan dari: Open Murni = ${gs.open_pure || 0}, Escalated to Dev = ${gs.escalated || 0}, In Development = ${gs.in_dev || 0}, Ready for Testing = ${gs.ready_testing || 0})`,
				`- Kartu WAITING (Waiting for Confirmation): ${gs.waiting || 0} tiket`,
				`- Kartu CLOSED: ${closed} tiket`,
				`- Kartu CANCELLED: ${cancelled} tiket`,
				`- Resolution Ratio (Dashboard): ${resRate}%`,
				`- Tiket Open Belum Ada PIC (Unassigned): ${gs.unassigned_open || 0} tiket`
			].join('\n')
		);

		// 3. Cross-Tab Distribusi Tiket per Modul x Status (melalui tabel pivot module_ticket)
		const [modDistRows]: any = await p.query(
			`SELECT 
				m.code,
				m.name,
				COUNT(t.id) as total,
				COALESCE(SUM(t.status IN ('Open', 'Escalated to Dev', 'In Development', 'Ready for Testing')), 0) as open_dashboard,
				COALESCE(SUM(t.status = 'Open'), 0) as open_pure,
				COALESCE(SUM(t.status = 'Ready for Testing'), 0) as ready_testing,
				COALESCE(SUM(t.status = 'Waiting for Confirmation'), 0) as waiting,
				COALESCE(SUM(t.status = 'Closed'), 0) as closed,
				COALESCE(SUM(t.status = 'Cancelled'), 0) as cancelled
			FROM modules m
			LEFT JOIN module_ticket mt ON m.id = mt.module_id
			LEFT JOIN tickets t ON mt.ticket_id = t.id AND t.deleted_at IS NULL AND t.ticket_type = 'Ticket'
			GROUP BY m.id, m.code, m.name
			ORDER BY total DESC`
		);

		if (Array.isArray(modDistRows) && modDistRows.length > 0) {
			const distLines = [`[TABEL CROSS-TAB DISTRIBUSI TIKET PER MODUL X STATUS (TABEL PIVOT \`module_ticket\` & \`modules\`, \`ticket_type = 'Ticket'\`)]:`];
			for (const r of modDistRows) {
				distLines.push(
					`- Modul ${r.code} (${r.name}): Total = ${r.total} tiket | OPEN (Dashboard) = ${r.open_dashboard} tiket (Open Murni: ${r.open_pure}, Ready for Testing: ${r.ready_testing}) | Waiting = ${r.waiting} | Closed = ${r.closed} | Cancelled = ${r.cancelled}`
				);
			}
			blocks.push(distLines.join('\n'));
		}

		// 4. Smart SQL Query baris tiket
		const autoSql = generateSmartQueryForQuestion(query);
		if (autoSql) {
			const dbRes = await executeSafeQuery(autoSql);
			if (dbRes.success && dbRes.rows.length > 0) {
				blocks.push(
					`[DATA BARIS TIKET REALTIME DARI DATABASE HELPDESK]:\n${JSON.stringify(dbRes.rows, null, 2).slice(0, 3500)}`
				);
			}
		}
	} catch (err) {
		// ignore db context error
	}

	if (blocks.length === 0) return '';

	return (
		`\n\n` +
		blocks.join('\n\n') +
		`\n\nInstruksi Penting Konsistensi Dashboard & Larangan SQL:
1. Gunakan angka pada blok di atas sebagai fakta mutlak yang 100% sama dengan halaman Dashboard & Daftar Tiket (\`ticket_type = 'Ticket'\`).
2. Jika pengguna menanyakan tiket pada modul tertentu (misalnya Modul PM, MM, HCM, FI, SD, dll.) atau status tertentu (seperti Open), langsung sebutkan angkanya secara pasti beserta rincian nomor tiketnya dari data di atas.
3. DILARANG KERAS menulis atau menyarankan kode query SQL (\`SELECT ... FROM ...\`) atau perintah \`tinker\` di dalam jawaban Anda kepada pengguna.`
	);
}
