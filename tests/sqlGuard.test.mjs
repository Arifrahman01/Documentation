import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	validateSafeQuery,
	generateSmartQueryForQuestion,
	isDatabaseQueryIntent
} from '../src/lib/server/database.ts';

const ATTACKS = {
	'mysql.user password hashes': 'SELECT user, authentication_string FROM mysql.user',
	'backticked mysql schema': 'SELECT host FROM `mysql`.`user`',
	'sys schema': 'SELECT * FROM sys.processlist',
	'information_schema': 'SELECT table_name FROM information_schema.tables',
	'LOAD_FILE read server file': "SELECT LOAD_FILE('/etc/passwd')",
	'LOAD_FILE spaced': "SELECT load_file ('/etc/passwd')",
	'SLEEP DoS': 'SELECT SLEEP(30)',
	'BENCHMARK DoS': "SELECT BENCHMARK(100000000, MD5('a'))",
	'GET_LOCK': "SELECT GET_LOCK('x', 100)",
	'INTO OUTFILE': "SELECT 1 INTO OUTFILE '/tmp/x'",
	'INTO variable': 'SELECT id INTO @x FROM tickets',
	'system variable': 'SELECT @@secure_file_priv',
	'variable assignment': 'SELECT @a := 1',
	'current user recon': 'SELECT CURRENT_USER()',
	'version recon': 'SELECT VERSION()',
	'FOR UPDATE lock': 'SELECT id FROM tickets FOR UPDATE',
	'LOCK IN SHARE MODE': 'SELECT id FROM tickets LOCK IN SHARE MODE',
	'block comment obfuscation': 'SELECT id FROM tickets /* x */',
	'executable comment': 'SELECT /*!50000 SLEEP(5) */',
	'line comment': 'SELECT id FROM tickets -- x',
	'hash comment': 'SELECT id FROM tickets # x',
	'stacked query': 'SELECT 1; DROP TABLE tickets',
	'EXPLAIN no longer allowed': 'EXPLAIN SELECT * FROM tickets',
	'users password column': 'SELECT name, password FROM users',
	'SELECT * from users': 'SELECT * FROM users',
	'unauthorized table outside allowlist': 'SELECT id, secret FROM admin_credentials',
	'unauthorized cross-database table': 'SELECT id FROM other_db.tickets',
	'tableless query': 'SELECT 12345',
	'non-select': 'DELETE FROM tickets'
};

for (const [name, sql] of Object.entries(ATTACKS)) {
	test(`blocks: ${name}`, () => {
		const res = validateSafeQuery(sql);
		assert.equal(res.valid, false, `should reject: ${sql}`);
	});
}

test('allows a plain read query and enforces LIMIT', () => {
	const res = validateSafeQuery('SELECT status, COUNT(*) as total FROM tickets GROUP BY status');
	assert.equal(res.valid, true);
	assert.match(res.safeSql, /LIMIT 50$/);
});

test('caps oversized LIMIT to 50', () => {
	const res = validateSafeQuery('SELECT id FROM tickets LIMIT 1000');
	assert.equal(res.valid, true);
	assert.match(res.safeSql, /LIMIT 50$/);
});

const QUESTIONS = [
	'tiket #3190',
	'tiket 90000017',
	'daftar tiket open',
	'tiket waiting for confirmation',
	'tiket in development',
	'tiket ready for testing',
	'jumlah tiket per severity',
	'jumlah tiket per kategori',
	'tiket per pembuat',
	'status tiket',
	'tiket terbaru',
	'tiket critical',
	'task dev queue',
	'tiket modul FI',
	'berapa tiket open modul MM'
];

for (const q of QUESTIONS) {
	test(`server-generated query passes guard: "${q}"`, () => {
		const sql = generateSmartQueryForQuestion(q);
		if (!sql) return; // no template for this phrasing
		const res = validateSafeQuery(sql);
		assert.equal(res.valid, true, `generated SQL rejected (${res.reason}): ${sql}`);
	});
}

const DOC_ONLY_QUESTIONS = [
	'Ringkasan laporan keuangan di SAC',
	'Bagaimana cara open periode posting di modul FI?',
	'Masalah pada unit alat berat tambang',
	'Jelaskan arsitektur modul MM dan PM di SAP',
	'Apa isi dokumen laporan produksi batubara?',
	'Cara bayar vendor dan piutang pelanggan'
];

for (const dq of DOC_ONLY_QUESTIONS) {
	test(`isDatabaseQueryIntent ignores normal document question: "${dq}"`, () => {
		assert.equal(isDatabaseQueryIntent(dq), false, `should NOT trigger DB intent: ${dq}`);
	});
}

const REAL_DB_QUESTIONS = [
	'Berapa jumlah tiket open di Helpdesk?',
	'Ringkasan status tiket di database Helpdesk',
	'Cek tiket #3190',
	'Tiket 90000017 statusnya apa?',
	'Daftar tiket waiting for confirmation',
	'Antrean tiket modul MM yang belum selesai'
];

for (const rq of REAL_DB_QUESTIONS) {
	test(`isDatabaseQueryIntent detects real Helpdesk DB question: "${rq}"`, () => {
		assert.equal(isDatabaseQueryIntent(rq), true, `should trigger DB intent: ${rq}`);
	});
}
