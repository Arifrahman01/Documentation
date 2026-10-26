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
 * Metadata skema tabel untuk panduan AI merumuskan Text-to-SQL
 */
export const HELPDESK_SCHEMA_INFO = `[SKEMA DATABASE REALTIME HELPDESK (MySQL)]:
Nama Database: helpdesk

1. TABEL: tickets
   - id: bigint(20) unsigned (Primary Key)
   - ticket_number: bigint(20) (Nomor tiket resmi)
   - ticket_type: varchar(50)
   - created_by: varchar(100) (Nama pembuat tiket)
   - title: varchar(100) (Judul kendala/tiket)
   - description: text (Deskripsi lengkap permasalahan)
   - category: varchar(50) (Kategori tiket)
   - severity: enum('Low', 'Medium', 'High', 'Critical')
   - complexity: enum('low', 'medium', 'hard')
   - status: enum('Open', 'Waiting for Confirmation', 'Escalated to Dev', 'In Development', 'Ready for Testing', 'Rejected by Dev', 'Closed', 'Cancelled')
   - pic_helpdesk: varchar(100) (Teknisi/PIC Helpdesk)
   - dev_assigned_to: varchar(100) (Programmer/Developer yang ditugaskan)
   - dev_notes: text (Catatan teknis developer)
   - solutions: text (Solusi penyelesaian masalah)
   - created_at: timestamp (Waktu tiket dibuat)
   - closed_at: timestamp (Waktu tiket diselesaikan/ditutup)

2. TABEL: categories (id, name, color)
3. TABEL: modules (id, code, name)
4. TABEL: companies (id, code, name)
5. TABEL: users (id, name, email, role ['Admin','Functional','Basis','Document','Programmer','Administrator'], department, jabatan, nik)`;

/**
 * Deteksi pola pertanyaan pengguna seputar database atau tiket helpdesk
 */
export function isDatabaseQueryIntent(query: string): boolean {
	if (!query || typeof query !== 'string') return false;
	const lower = query.toLowerCase();

	const dbKeywords = [
		'tiket',
		'ticket',
		'helpdesk',
		'open',
		'closed',
		'status tiket',
		'in development',
		'ready for testing',
		'severity',
		'critical',
		'programmer',
		'pic',
		'jumlah tiket',
		'berapa tiket',
		'total tiket',
		'database',
		'tabel tiket',
		'antrian tiket',
		'antrean tiket',
		'daftar tiket',
		'kendala',
		'masalah',
		'laporan',
		'antrean',
		'komplain',
		'eskalasi',
		'progress tiket',
		'developer tiket'
	];

	return dbKeywords.some((k) => lower.includes(k));
}

/**
 * Query generator cerdas untuk pola pertanyaan umum database helpdesk
 */
export function generateSmartQueryForQuestion(query: string): string | null {
	const q = query.toLowerCase();

	// 1. Ringkasan status semua tiket
	if (
		(q.includes('berapa') || q.includes('jumlah') || q.includes('total') || q.includes('status')) &&
		(q.includes('tiket') || q.includes('ticket')) &&
		!q.includes('terakhir') &&
		!q.includes('terbaru') &&
		!q.includes('daftar')
	) {
		if (q.includes('severity') || q.includes('prioritas') || q.includes('kritis') || q.includes('critical')) {
			return `SELECT severity, COUNT(*) as total FROM tickets GROUP BY severity ORDER BY total DESC`;
		}
		if (q.includes('kategori') || q.includes('category')) {
			return `SELECT category, COUNT(*) as total FROM tickets WHERE category IS NOT NULL GROUP BY category ORDER BY total DESC LIMIT 10`;
		}
		if (q.includes('pembuat') || q.includes('user') || q.includes('pengguna')) {
			return `SELECT created_by, COUNT(*) as total FROM tickets GROUP BY created_by ORDER BY total DESC LIMIT 10`;
		}
		return `SELECT status, COUNT(*) as total FROM tickets GROUP BY status ORDER BY total DESC`;
	}

	// 2. Tiket yang sedang Open atau butuh penanganan
	if (q.includes('tiket open') || q.includes('tiket yang open') || q.includes('tiket terbuka') || q.includes('masih open')) {
		return `SELECT id, ticket_number, title, created_by, severity, category, created_at FROM tickets WHERE status = 'Open' ORDER BY id DESC LIMIT 15`;
	}

	// 3. Tiket yang sedang In Development
	if (q.includes('in development') || q.includes('sedang dikembangkan') || q.includes('dikerjakan developer')) {
		return `SELECT id, ticket_number, title, created_by, dev_assigned_to, severity, created_at FROM tickets WHERE status = 'In Development' ORDER BY id DESC LIMIT 15`;
	}

	// 4. Tiket yang Ready for Testing
	if (q.includes('ready for testing') || q.includes('siap testing') || q.includes('siap ditest')) {
		return `SELECT id, ticket_number, title, created_by, dev_assigned_to, updated_at FROM tickets WHERE status = 'Ready for Testing' ORDER BY id DESC LIMIT 15`;
	}

	// 5. Tiket terbaru / terakhir
	if (q.includes('terbaru') || q.includes('terakhir') || q.includes('daftar tiket') || q.includes('list tiket')) {
		return `SELECT id, ticket_number, title, status, severity, category, created_by, created_at FROM tickets ORDER BY id DESC LIMIT 10`;
	}

	// 6. Tiket dengan severity Critical atau High
	if (q.includes('critical') || q.includes('kritis') || q.includes('high') || q.includes('mendesak')) {
		return `SELECT id, ticket_number, title, status, created_by, created_at FROM tickets WHERE severity = 'Critical' OR severity = 'High' ORDER BY id DESC LIMIT 15`;
	}

	return null;
}
