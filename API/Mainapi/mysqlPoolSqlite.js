/**
 * Drop-in replacement for mysqlPool.js, backed by sql.js (pure JS/WASM
 * SQLite -- no native compilation, guaranteed to run under nodejs-mobile's
 * embedded ARM Node build on Android, unlike better-sqlite3 which ships no
 * Android prebuilds and would require cross-compiling against nodejs-mobile's
 * custom Node/V8 ABI -- see report for the full reasoning).
 *
 * Exposes the same surface as mysqlPool.js: initPool(), getPool(), and a
 * pool object with .execute(sql, params) / .query(sql, params) returning
 * [rows, fields] tuples like mysql2/promise, plus .end() and a trivial
 * withMysqlAdvisoryLock() (single-process on a phone -- no real locking
 * needed).
 *
 * Also does light SQL-dialect translation (see translateQuery below) so
 * that the 24 route files -- and the handful of MySQL-only CREATE TABLE /
 * NOW() / ON DUPLICATE KEY statements scattered across them -- can run
 * completely unmodified against SQLite. This keeps the desktop MySQL code
 * path (mysqlPool.js) 100% untouched and avoids editing 9+ route files.
 */

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const writeFileAtomic = require('write-file-atomic');

const SCHEMA_BOOTSTRAP_LOCK_NAME = 'mainapi:schema-bootstrap:v1';

const DB_FILE_PATH =
  process.env.SQLITE_DB_PATH || path.join(__dirname, 'data', 'movix.sqlite');
const SCHEMA_FILE_PATH = path.join(
  __dirname,
  'exportscripts',
  'schema_sqlite_init.sql',
);

let SQL = null; // sql.js engine (loaded once, holds the WASM module)
let db = null; // the live SQL.Database instance (in-memory, mirrored to disk)
let pool = null;
let poolInitPromise = null;

let dirty = false;
let persistTimer = null;
const PERSIST_DEBOUNCE_MS = 1500;

// ---------------------------------------------------------------------------
// Persistence: sql.js has no built-in file-backed storage -- the whole DB
// lives in memory and must be explicitly exported+written. We debounce so a
// burst of writes doesn't serialize the whole DB on every single INSERT.
// ---------------------------------------------------------------------------
async function persistNow() {
  if (!db) return;
  dirty = false;
  const data = db.export();
  await fsp.mkdir(path.dirname(DB_FILE_PATH), { recursive: true });
  await writeFileAtomic(DB_FILE_PATH, Buffer.from(data));
}

function schedulePersist() {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (dirty) persistNow().catch((e) => console.error('[sqlite] persist error:', e.message));
  }, PERSIST_DEBOUNCE_MS);
  if (persistTimer.unref) persistTimer.unref();
}

// ---------------------------------------------------------------------------
// SQL dialect translation: MySQL -> SQLite for the small, enumerable set of
// constructs actually used in this codebase (verified via grep across every
// file that imports mysqlPool). See CLAUDE_MOBILE_PORT notes in the task
// report for the full list of source files/lines this covers.
// ---------------------------------------------------------------------------

// Per-table conflict target columns for `ON DUPLICATE KEY UPDATE` ->
// `ON CONFLICT(...) DO UPDATE SET` translation (SQLite requires an explicit
// conflict target; MySQL infers it from whichever unique/primary key
// collided). Matches the UNIQUE/PRIMARY KEY defined for each table in
// exportscripts/schema_sqlite_init.sql.
const CONFLICT_TARGETS = {
  user_notification_preferences: ['user_id', 'user_type'],
  help_feedback: ['slug', 'ip_hash'],
  clone_links: [
    'provider',
    'media_type',
    'tmdb_id',
    'season_number',
    'episode_number',
    'source_file_code',
  ],
};

function translateQuery(sqlText) {
  let sql = sqlText;

  // NOW() -> CURRENT_TIMESTAMP (do this before DATE_SUB so the pattern below matches)
  sql = sql.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');

  // DATE_SUB(CURRENT_TIMESTAMP, INTERVAL n UNIT) -> datetime('now', '-n units')
  sql = sql.replace(
    /DATE_SUB\(\s*CURRENT_TIMESTAMP\s*,\s*INTERVAL\s+(\d+)\s+(HOUR|DAY|MINUTE|MONTH|YEAR)S?\s*\)/gi,
    (_, n, unit) => `datetime('now', '-${n} ${unit.toLowerCase()}s')`,
  );

  // ENUM('a','b',...) column type -> TEXT (SQLite has no ENUM; app code
  // already validates allowed values before insert)
  sql = sql.replace(/ENUM\s*\([^)]*\)/gi, 'TEXT');

  // <col> INT|BIGINT [UNSIGNED] [NOT NULL] [PRIMARY KEY] AUTO_INCREMENT [PRIMARY KEY]
  // -> <col> INTEGER PRIMARY KEY AUTOINCREMENT (covers both AUTO_INCREMENT-then-PK
  // and PK-then-AUTO_INCREMENT orderings found in this codebase's CREATE TABLEs)
  const hadAutoIncrement = /AUTO_INCREMENT/i.test(sql);
  sql = sql.replace(
    /(\w+)\s+(?:BIGINT|INT)(?:\s+UNSIGNED)?\s+(?:NOT\s+NULL\s+)?(?:PRIMARY\s+KEY\s+)?AUTO_INCREMENT(?:\s+PRIMARY\s+KEY)?/gi,
    '$1 INTEGER PRIMARY KEY AUTOINCREMENT',
  );
  if (hadAutoIncrement) {
    // Drop any now-redundant separate `PRIMARY KEY (\`id\`)` table constraint
    // (SQLite errors on a table with two PRIMARY KEY definitions)
    sql = sql.replace(/,\s*PRIMARY KEY\s*\(\s*`?id`?\s*\)/gi, '');
  }

  // UNIQUE KEY `name` (col1, col2) -> CONSTRAINT name UNIQUE (col1, col2)
  sql = sql.replace(
    /UNIQUE\s+KEY\s+`?(\w+)`?\s*(\([^)]*\))/gi,
    'CONSTRAINT $1 UNIQUE $2',
  );

  // Remaining inline secondary indexes (KEY name (...) / INDEX name (...))
  // aren't supported inline by SQLite CREATE TABLE -- drop them (perf-only,
  // no correctness impact for a prototype; UNIQUE ones were already
  // converted above and are preserved).
  sql = sql.replace(/,\s*(?:KEY|INDEX)\s+`?\w+`?\s*\([^)]*\)/gi, '');

  // ON UPDATE CURRENT_TIMESTAMP has no SQLite equivalent -- drop it. Call
  // sites that need a fresh updated_at pass one explicitly in the query.
  sql = sql.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');

  // ENGINE=InnoDB DEFAULT CHARSET=... COLLATE=... trailing clause -> drop
  sql = sql.replace(
    /\s*ENGINE\s*=\s*\w+(\s+DEFAULT\s+CHARSET\s*=\s*\w+)?(\s+COLLATE\s*=\s*\S+)?/gi,
    '',
  );

  // INSERT IGNORE INTO -> INSERT OR IGNORE INTO
  sql = sql.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO');

  // ALTER TABLE ... ADD COLUMN ... AFTER <col> -- SQLite doesn't support
  // positional ADD COLUMN, always appends at the end. Drop the clause.
  sql = sql.replace(/\s+AFTER\s+\w+/gi, '');

  // SHOW TABLES LIKE ? -> presence check via sqlite_master
  if (/^\s*SHOW\s+TABLES\s+LIKE\s*\?\s*$/i.test(sql.trim())) {
    sql = `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`;
  }

  // ON DUPLICATE KEY UPDATE col = VALUES(col), ... -> ON CONFLICT(...) DO
  // UPDATE SET col = excluded.col, ... (only for tables we know the unique
  // conflict target for -- see CONFLICT_TARGETS above)
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(sql)) {
    const m = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
    const table = m && m[1];
    const cols = table && CONFLICT_TARGETS[table];
    if (cols) {
      sql = sql.replace(
        /ON\s+DUPLICATE\s+KEY\s+UPDATE/i,
        `ON CONFLICT(${cols.join(', ')}) DO UPDATE SET`,
      );
      sql = sql.replace(/VALUES\((\w+)\)/g, 'excluded.$1');
    } else {
      console.warn(
        `[sqlite] ON DUPLICATE KEY UPDATE on unrecognized table "${table}" -- no conflict target registered, query will likely fail`,
      );
    }
  }

  return sql;
}

// ---------------------------------------------------------------------------
// INFORMATION_SCHEMA.COLUMNS shim -- used only by app.js's ensureColumn()
// helper to check whether a column already exists before ALTER TABLE ADD
// COLUMN. Reinterpreted via PRAGMA table_info().
// ---------------------------------------------------------------------------
function isInformationSchemaColumnsQuery(sqlText) {
  return /FROM\s+INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText);
}

function runInformationSchemaColumnsQuery(params) {
  const [tableName, columnName] = params;
  if (!/^\w+$/.test(String(tableName))) {
    throw new Error(`Unsafe table name for PRAGMA table_info: ${tableName}`);
  }
  const stmt = db.prepare(`PRAGMA table_info("${tableName}")`);
  const cols = [];
  try {
    while (stmt.step()) cols.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  const found = cols.some((c) => c.name === columnName);
  return [found ? [{ COLUMN_NAME: columnName }] : [], undefined];
}

// ---------------------------------------------------------------------------
// Core query execution
// ---------------------------------------------------------------------------
function runQuery(sqlText, params = []) {
  if (!db) {
    throw new Error('SQLite database not initialized -- call initPool() first');
  }

  if (isInformationSchemaColumnsQuery(sqlText)) {
    return runInformationSchemaColumnsQuery(params);
  }

  const translated = translateQuery(sqlText);
  const trimmed = translated.trim();
  const isReadStatement = /^(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(trimmed);

  const stmt = db.prepare(translated);
  try {
    if (params && params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());

    if (isReadStatement) {
      return [rows, undefined];
    }

    // Write/DDL statement (INSERT/UPDATE/DELETE/CREATE/ALTER/etc)
    const affectedRows = db.getRowsModified();
    let insertId = 0;
    if (/^INSERT/i.test(trimmed) && !/^INSERT\s+OR\s+IGNORE/i.test(trimmed)) {
      const idRes = db.exec('SELECT last_insert_rowid() AS id');
      insertId = idRes[0] && idRes[0].values[0] ? idRes[0].values[0][0] : 0;
    }
    schedulePersist();
    return [
      { affectedRows, changedRows: affectedRows, insertId, warningStatus: 0 },
      undefined,
    ];
  } finally {
    stmt.free();
  }
}

function buildPoolObject() {
  return {
    async execute(sqlText, params = []) {
      return runQuery(sqlText, params);
    },
    async query(sqlText, params = []) {
      return runQuery(sqlText, params);
    },
    async getConnection() {
      // No real per-connection state with sql.js (single in-process DB) --
      // return a lightweight object with the same shape for any caller
      // that expects the mysql2 connection interface.
      return {
        execute: (s, p) => runQuery(s, p),
        query: (s, p) => runQuery(s, p),
        release: () => {},
      };
    },
    async end() {
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      await persistNow();
    },
  };
}

// ---------------------------------------------------------------------------
// Public API (mirrors mysqlPool.js)
// ---------------------------------------------------------------------------
async function initPool() {
  if (pool) return pool;
  if (poolInitPromise) return poolInitPromise;

  poolInitPromise = (async () => {
    // sql.js is loaded lazily here (not at module top) so requiring this
    // file has no side effects unless a mobile/sqlite backend is actually
    // selected.
    const initSqlJsFactory = require('sql.js');
    SQL = await initSqlJsFactory();

    await fsp.mkdir(path.dirname(DB_FILE_PATH), { recursive: true });
    let fileBuffer = null;
    try {
      fileBuffer = await fsp.readFile(DB_FILE_PATH);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    db = fileBuffer && fileBuffer.length ? new SQL.Database(fileBuffer) : new SQL.Database();
    db.run('PRAGMA foreign_keys = OFF;');

    const schemaSql = await fsp.readFile(SCHEMA_FILE_PATH, 'utf8');
    db.exec(schemaSql);

    pool = buildPoolObject();
    await persistNow();
    console.log(
      `✅ SQLite (sql.js) database initialized successfully at ${DB_FILE_PATH}`,
    );
    return pool;
  })();

  try {
    return await poolInitPromise;
  } catch (error) {
    poolInitPromise = null;
    throw error;
  }
}

function getPool() {
  if (!pool) {
    console.warn(
      '⚠️ SQLite pool not initialized yet -- call/await initPool() before getPool(). Returning null.',
    );
    return null;
  }
  return pool;
}

// Single-process on a phone -- no other worker can race the schema
// bootstrap, so the "advisory lock" is a trivial passthrough.
async function withMysqlAdvisoryLock(poolInstance, lockName, task) {
  if (typeof task !== 'function') {
    throw new Error('withMysqlAdvisoryLock requires a task function');
  }
  return await task();
}

module.exports = {
  initPool,
  getPool,
  dbConfig: { backend: 'sqlite (sql.js)', file: DB_FILE_PATH },
  SCHEMA_BOOTSTRAP_LOCK_NAME,
  withMysqlAdvisoryLock,
  IS_SQLITE: true,
  // exposed for the standalone desktop validation script / tests
  _internal: { translateQuery, persistNow, DB_FILE_PATH },
};
