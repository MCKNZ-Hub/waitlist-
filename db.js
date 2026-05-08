import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const db = new Database(join(__dirname, 'tableflow.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tables (
    id                TEXT    PRIMARY KEY,
    number            INTEGER NOT NULL,
    capacity          INTEGER NOT NULL,
    section           TEXT    NOT NULL DEFAULT 'main',
    status            TEXT    NOT NULL DEFAULT 'ready',
    guest_id          TEXT,
    guest_name        TEXT,
    occupied_at       INTEGER,
    combined_with     TEXT,
    primary_table_id  TEXT,
    original_capacity INTEGER,
    waiter_id         TEXT
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id            TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL,
    party_size    INTEGER NOT NULL,
    phone         TEXT    NOT NULL,
    joined_at     INTEGER NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'waiting',
    notified_at   INTEGER,
    seated_at     INTEGER,
    removed_at    INTEGER,
    table_id      TEXT,
    sms_result    TEXT,
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    waiter_id     TEXT,
    tags          TEXT    NOT NULL DEFAULT '[]',
    visit_count   INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waiters (
    id     TEXT    PRIMARY KEY,
    name   TEXT    NOT NULL,
    color  TEXT    NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS guest_history (
    phone       TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    visits      INTEGER NOT NULL DEFAULT 0,
    last_visit  INTEGER,
    notes       TEXT    NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shift_logs (
    id         TEXT    PRIMARY KEY,
    closed_at  INTEGER NOT NULL,
    date       TEXT    NOT NULL,
    summary    TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT    PRIMARY KEY,
    role       TEXT    NOT NULL DEFAULT 'host',
    expires_at INTEGER NOT NULL
  );
`);

// Migrations — no-op if column already exists
const migrations = [
  'ALTER TABLE tables   ADD COLUMN waiter_id TEXT',
  'ALTER TABLE waitlist ADD COLUMN waiter_id TEXT',
  "ALTER TABLE waitlist ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
  'ALTER TABLE waitlist ADD COLUMN visit_count INTEGER NOT NULL DEFAULT 1',
];
for (const sql of migrations) { try { db.exec(sql); } catch {} }

// Indexes for fast lookups under load
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
  CREATE INDEX IF NOT EXISTS idx_waitlist_joined  ON waitlist(joined_at);
  CREATE INDEX IF NOT EXISTS idx_waitlist_phone   ON waitlist(phone);
  CREATE INDEX IF NOT EXISTS idx_tables_status    ON tables(status);
  CREATE INDEX IF NOT EXISTS idx_history_phone    ON guest_history(phone);
`);

// ── Seed 28 tables on first run ────────────────────────────────────────────

const SEED = [
  { id:'t1',  n:1,  cap:2,  sec:'main'    },
  { id:'t2',  n:2,  cap:2,  sec:'main'    },
  { id:'t3',  n:3,  cap:4,  sec:'main'    },
  { id:'t4',  n:4,  cap:4,  sec:'main'    },
  { id:'t5',  n:5,  cap:4,  sec:'main'    },
  { id:'t6',  n:6,  cap:4,  sec:'main'    },
  { id:'t7',  n:7,  cap:4,  sec:'main'    },
  { id:'t8',  n:8,  cap:4,  sec:'main'    },
  { id:'t9',  n:9,  cap:6,  sec:'main'    },
  { id:'t10', n:10, cap:6,  sec:'main'    },
  { id:'t11', n:11, cap:6,  sec:'main'    },
  { id:'t12', n:12, cap:6,  sec:'main'    },
  { id:'t13', n:13, cap:2,  sec:'bar'     },
  { id:'t14', n:14, cap:2,  sec:'bar'     },
  { id:'t15', n:15, cap:2,  sec:'bar'     },
  { id:'t16', n:16, cap:2,  sec:'bar'     },
  { id:'t17', n:17, cap:2,  sec:'bar'     },
  { id:'t18', n:18, cap:2,  sec:'bar'     },
  { id:'t19', n:19, cap:4,  sec:'patio'   },
  { id:'t20', n:20, cap:4,  sec:'patio'   },
  { id:'t21', n:21, cap:4,  sec:'patio'   },
  { id:'t22', n:22, cap:4,  sec:'patio'   },
  { id:'t23', n:23, cap:4,  sec:'patio'   },
  { id:'t24', n:24, cap:6,  sec:'patio'   },
  { id:'t25', n:25, cap:8,  sec:'private' },
  { id:'t26', n:26, cap:8,  sec:'private' },
  { id:'t27', n:27, cap:10, sec:'private' },
  { id:'t28', n:28, cap:12, sec:'private' },
];

if (db.prepare('SELECT COUNT(*) AS c FROM tables').get().c === 0) {
  const ins = db.prepare(
    'INSERT INTO tables (id, number, capacity, section) VALUES (@id, @n, @cap, @sec)'
  );
  db.transaction(() => SEED.forEach(r => ins.run(r)))();
}

// ── Row → JS object converters ──────────────────────────────────────────────

function toTable(r) {
  return {
    id:               r.id,
    number:           r.number,
    capacity:         r.capacity,
    section:          r.section,
    status:           r.status,
    guestId:          r.guest_id,
    guestName:        r.guest_name,
    occupiedAt:       r.occupied_at,
    combinedWith:     r.combined_with ? JSON.parse(r.combined_with) : null,
    primaryTableId:   r.primary_table_id,
    originalCapacity: r.original_capacity,
    waiterId:         r.waiter_id ?? null,
  };
}

function toGuest(r) {
  return {
    id:           r.id,
    name:         r.name,
    partySize:    r.party_size,
    phone:        r.phone,
    joinedAt:     r.joined_at,
    status:       r.status,
    notifiedAt:   r.notified_at,
    seatedAt:     r.seated_at,
    removedAt:    r.removed_at,
    tableId:      r.table_id,
    smsResult:    r.sms_result,
    reminderSent: Boolean(r.reminder_sent),
    waiterId:     r.waiter_id ?? null,
    tags:         r.tags ? JSON.parse(r.tags) : [],
    visitCount:   r.visit_count ?? 1,
  };
}

function toWaiter(r) {
  return { id: r.id, name: r.name, color: r.color, active: Boolean(r.active) };
}

function toHistory(r) {
  return { phone: r.phone, name: r.name, visits: r.visits, lastVisit: r.last_visit, notes: r.notes };
}

// ── Load state on server start ─────────────────────────────────────────────

export function loadState() {
  const tables = db.prepare('SELECT * FROM tables ORDER BY number').all().map(toTable);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const waitlist = db.prepare(
    "SELECT * FROM waitlist WHERE joined_at >= ? AND status != 'removed' ORDER BY joined_at"
  ).all(todayStart.getTime()).map(toGuest);

  const settings = { estimatedWait: 20 };
  for (const { key, value } of db.prepare('SELECT key, value FROM settings').all()) {
    settings[key] = JSON.parse(value);
  }

  const waiters = db.prepare('SELECT * FROM waiters ORDER BY name').all().map(toWaiter);

  return { tables, waitlist, settings, waiters };
}

// ── Persist helpers ────────────────────────────────────────────────────────

const _upsertTable = db.prepare(`
  INSERT OR REPLACE INTO tables
    (id, number, capacity, section, status, guest_id, guest_name,
     occupied_at, combined_with, primary_table_id, original_capacity, waiter_id)
  VALUES
    (@id, @number, @capacity, @section, @status, @guestId, @guestName,
     @occupiedAt, @combinedWith, @primaryTableId, @originalCapacity, @waiterId)
`);

const _upsertGuest = db.prepare(`
  INSERT OR REPLACE INTO waitlist
    (id, name, party_size, phone, joined_at, status, notified_at,
     seated_at, removed_at, table_id, sms_result, reminder_sent,
     waiter_id, tags, visit_count)
  VALUES
    (@id, @name, @partySize, @phone, @joinedAt, @status, @notifiedAt,
     @seatedAt, @removedAt, @tableId, @smsResult, @reminderSent,
     @waiterId, @tags, @visitCount)
`);

export function saveTable(t) {
  _upsertTable.run({
    ...t,
    combinedWith: t.combinedWith ? JSON.stringify(t.combinedWith) : null,
    waiterId: t.waiterId ?? null,
  });
}

export function saveGuest(g) {
  _upsertGuest.run({
    ...g,
    reminderSent: g.reminderSent ? 1 : 0,
    waiterId:     g.waiterId ?? null,
    tags:         JSON.stringify(g.tags || []),
    visitCount:   g.visitCount ?? 1,
  });
}

export function markGuestRemoved(id) {
  db.prepare("UPDATE waitlist SET status = 'removed', removed_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function saveSettings(settings) {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const [k, v] of Object.entries(settings)) upsert.run(k, JSON.stringify(v));
  })();
}

// ── Table CRUD ─────────────────────────────────────────────────────────────

export function createTableRow({ id, number, capacity, section }) {
  db.prepare('INSERT INTO tables (id, number, capacity, section) VALUES (?, ?, ?, ?)')
    .run(id, number, capacity, section);
}

export function updateTableConfig(id, { number, capacity, section }) {
  db.prepare('UPDATE tables SET number = ?, capacity = ?, section = ? WHERE id = ?')
    .run(number, capacity, section, id);
}

export function deleteTableRow(id) {
  db.prepare('DELETE FROM tables WHERE id = ?').run(id);
}

// ── Waiter CRUD ────────────────────────────────────────────────────────────

const _upsertWaiter = db.prepare(`
  INSERT OR REPLACE INTO waiters (id, name, color, active)
  VALUES (@id, @name, @color, @active)
`);

export function saveWaiter(w) {
  _upsertWaiter.run({ ...w, active: w.active ? 1 : 0 });
}

export function deleteWaiterRow(id) {
  db.prepare('DELETE FROM waiters WHERE id = ?').run(id);
}

// ── Guest history CRUD ─────────────────────────────────────────────────────

export function getGuestHistoryByPhone(phone) {
  const row = db.prepare('SELECT * FROM guest_history WHERE phone = ?').get(phone);
  return row ? toHistory(row) : null;
}

export function upsertGuestHistory(phone, name) {
  db.prepare(`
    INSERT INTO guest_history (phone, name, visits, last_visit)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name       = excluded.name,
      visits     = visits + 1,
      last_visit = excluded.last_visit
  `).run(phone, name, Date.now());
}

export function updateGuestHistoryNotes(phone, notes) {
  db.prepare('UPDATE guest_history SET notes = ? WHERE phone = ?').run(notes, phone);
}

// ── Shift close ────────────────────────────────────────────────────────────

export function closeShift(id, summary) {
  const now   = Date.now();
  const date  = new Date(now).toISOString().split('T')[0];
  db.prepare(
    'INSERT INTO shift_logs (id, closed_at, date, summary) VALUES (?, ?, ?, ?)'
  ).run(id, now, date, JSON.stringify(summary));
}

export function getShiftLogs(limit = 30) {
  return db.prepare('SELECT * FROM shift_logs ORDER BY closed_at DESC LIMIT ?')
    .all(limit)
    .map(r => ({ ...r, summary: JSON.parse(r.summary) }));
}

// ── Sessions (persistent across restarts) ─────────────────────────────────

export function createDbSession(token, role, expiresAt) {
  db.prepare('INSERT OR REPLACE INTO sessions (token, role, expires_at) VALUES (?, ?, ?)')
    .run(token, role, expiresAt);
}

export function getDbSession(token) {
  return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) ?? null;
}

export function deleteDbSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function pruneExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

// ── Database backup ───────────────────────────────────────────────────────

export async function backupDb(destPath) {
  await db.backup(destPath);
}

// ── Reports ────────────────────────────────────────────────────────────────

export function getReportsToday(since) {
  const start = since ?? (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  })();

  const rows = db.prepare(
    "SELECT * FROM waitlist WHERE joined_at >= ? AND status IN ('seated','removed') ORDER BY joined_at"
  ).all(start);

  const seated  = rows.filter(r => r.status === 'seated');
  const removed = rows.filter(r => r.status === 'removed');

  const avgWait = seated.length
    ? Math.round(seated.reduce((s, r) => s + ((r.seated_at || Date.now()) - r.joined_at), 0) / seated.length / 60000)
    : 0;

  const byHour = {};
  for (const r of seated) {
    const h = new Date(r.seated_at || r.joined_at).getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  const peakEntry = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];

  const waiterStatsMap = {};
  for (const r of seated) {
    if (!r.waiter_id) continue;
    if (!waiterStatsMap[r.waiter_id])
      waiterStatsMap[r.waiter_id] = { waiterId: r.waiter_id, tables: 0, covers: 0 };
    waiterStatsMap[r.waiter_id].tables++;
    waiterStatsMap[r.waiter_id].covers += r.party_size;
  }

  return {
    totalSeated:    seated.length,
    totalRemoved:   removed.length,
    totalGuests:    seated.reduce((s, r) => s + r.party_size, 0),
    avgWaitMinutes: avgWait,
    peakHour:       peakEntry ? parseInt(peakEntry[0]) : null,
    waiterStats:    Object.values(waiterStatsMap),
    seatedList: seated.map(r => ({
      id: r.id, name: r.name, partySize: r.party_size,
      joinedAt: r.joined_at, seatedAt: r.seated_at,
      tableId: r.table_id, waiterId: r.waiter_id,
      tags: r.tags ? JSON.parse(r.tags) : [],
      waitMinutes: Math.round(((r.seated_at || Date.now()) - r.joined_at) / 60000),
    })),
    removedList: removed.map(r => ({
      id: r.id, name: r.name, partySize: r.party_size,
      joinedAt: r.joined_at, removedAt: r.removed_at,
      waitMinutes: Math.round(((r.removed_at || Date.now()) - r.joined_at) / 60000),
    })),
  };
}
