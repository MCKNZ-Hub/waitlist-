import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  loadState, saveTable, saveGuest, markGuestRemoved, saveSettings,
  createTableRow, updateTableConfig, deleteTableRow, getReportsToday,
  saveWaiter, deleteWaiterRow,
  getGuestHistoryByPhone, upsertGuestHistory, updateGuestHistoryNotes,
  closeShift, getShiftLogs,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────────

const {
  TEXTBELT_API_KEY,
  RESTAURANT_NAME = 'Cibolo Creek Eatery & Venue',
  STAFF_PIN       = '1234',
  ALLOWED_ORIGIN,
  NODE_ENV        = 'development',
} = process.env;

const isProd = NODE_ENV === 'production';

// ── SMS helpers ────────────────────────────────────────────────────────────────

const smsEnabled = Boolean(TEXTBELT_API_KEY && !TEXTBELT_API_KEY.includes('your_'));

if (smsEnabled) console.log('✓ Textbelt SMS enabled');
else            console.warn('⚠  TEXTBELT_API_KEY not set — SMS will be skipped.');

function toE164(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10)                  return `+1${d}`;
  if (d.length === 11 && d[0] === '1')  return `+${d}`;
  return raw.startsWith('+') ? raw : `+${d}`;
}

async function textbelt(phone, message) {
  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: toE164(phone), message, key: TEXTBELT_API_KEY }),
  });
  return res.json();
}

async function sendSmsBackground(guest) {
  if (!smsEnabled) {
    guest.smsResult = 'skipped';
    saveGuest(guest);
    broadcastState();
    return;
  }
  try {
    const data = await textbelt(
      guest.phone,
      `Hi ${guest.name}! Your table is ready. Please head to the host stand 🍽️ - ${RESTAURANT_NAME}.`
    );
    guest.smsResult = data.success ? 'sent' : 'error';
    if (data.success) console.log(`SMS sent → ${guest.phone}`);
    else              console.error(`SMS failed:`, data.error);
  } catch (err) {
    console.error(`SMS error:`, err.message);
    guest.smsResult = 'error';
  }
  saveGuest(guest);
  broadcastState();
}

async function sendReminderSmsBackground(guest) {
  if (!smsEnabled) return;
  try {
    const data = await textbelt(
      guest.phone,
      `Hi ${guest.name}, just a reminder your table is ready! Please head to the host stand.`
    );
    if (data.success) console.log(`Reminder SMS sent → ${guest.phone}`);
    else              console.error(`Reminder SMS failed:`, data.error);
  } catch (err) {
    console.error(`Reminder SMS error:`, err.message);
  }
}

// ── Session auth ───────────────────────────────────────────────────────────────

const sessions = new Map();             // token → { expiresAt }
const SESSION_TTL = 12 * 60 * 60_000;  // 12 hours

function createSession() {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL });
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return false; }
  return true;
}

function requireAuth(req, res, next) {
  const auth  = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!isValidSession(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Waiter color palette ───────────────────────────────────────────────────────

const WAITER_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

// ── Express ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const origin = isProd && ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '*';
  res.header('Access-Control-Allow-Origin',  origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── State (loaded from SQLite on start) ───────────────────────────────────────

const state = loadState();
console.log(`Loaded: ${state.tables.length} tables, ${state.waitlist.length} active guests`);

// ── WebSocket ─────────────────────────────────────────────────────────────────

const wss     = new WebSocketServer({ noServer: true });
const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

function broadcastState() {
  broadcast({ type: 'state', data: state });
}

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', data: state }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// ── Public routes ─────────────────────────────────────────────────────────────

app.get('/api/state', (req, res) => res.json(state));

app.post('/api/staff/auth', (req, res) => {
  const { pin } = req.body;
  if (pin !== STAFF_PIN) return res.status(401).json({ ok: false, error: 'Incorrect PIN' });
  const token = createSession();
  res.json({ ok: true, token });
});

app.post('/api/staff/logout', requireAuth, (req, res) => {
  const token = (req.headers['authorization'] ?? '').slice(7);
  sessions.delete(token);
  res.json({ ok: true });
});

app.post('/api/waitlist', (req, res) => {
  const { name, partySize, phone } = req.body;
  if (!name?.trim())               return res.status(400).json({ error: 'name is required' });
  if (!partySize || partySize < 1) return res.status(400).json({ error: 'partySize is required' });
  if (!phone?.trim())              return res.status(400).json({ error: 'phone is required' });

  // Look up guest history by phone to get visit count
  const history    = getGuestHistoryByPhone(phone.trim());
  const visitCount = history ? history.visits + 1 : 1;

  const entry = {
    id: uuidv4(),
    name: name.trim(),
    partySize: parseInt(partySize, 10),
    phone: phone.trim(),
    joinedAt: Date.now(),
    status: 'waiting',
    notifiedAt: null, seatedAt: null, removedAt: null,
    tableId: null, smsResult: null, reminderSent: false,
    waiterId: null, tags: [], visitCount,
  };
  state.waitlist.push(entry);
  saveGuest(entry);
  broadcastState();
  res.json(entry);
});

// ── Protected routes ──────────────────────────────────────────────────────────

app.patch('/api/tables/:id', requireAuth, (req, res) => {
  const table = state.tables.find(t => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const { status } = req.body;
  if (!['ready', 'occupied', 'dirty', 'cleaning'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const wasOccupied = table.status === 'occupied';
  table.status = status;
  if (status !== 'occupied') {
    table.guestId = null; table.guestName = null; table.occupiedAt = null;
    table.waiterId = null;
  } else if (!wasOccupied) {
    table.occupiedAt = Date.now();
  }
  saveTable(table);
  broadcastState();
  res.json(table);
});

// Reassign waiter to an already-occupied table
app.patch('/api/tables/:id/waiter', requireAuth, (req, res) => {
  const table = state.tables.find(t => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status !== 'occupied') return res.status(400).json({ error: 'Table is not occupied' });

  const { waiterId } = req.body;
  const waiter = waiterId ? state.waiters.find(w => w.id === waiterId) : null;
  table.waiterId = waiter ? waiter.id : null;
  saveTable(table);
  broadcastState();
  res.json(table);
});

app.post('/api/notify/:guestId', requireAuth, (req, res) => {
  const guest = state.waitlist.find(g => g.id === req.params.guestId);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });

  guest.status     = 'notified';
  guest.notifiedAt = Date.now();
  guest.smsResult  = 'sending';

  broadcast({ type: 'notification', guestId: guest.id, guestName: guest.name });
  broadcastState();
  res.json(guest);
  sendSmsBackground(guest); // runs after response, updates smsResult
});

app.post('/api/seat', requireAuth, (req, res) => {
  const { waitlistId, tableId, waiterId } = req.body;
  const guest = state.waitlist.find(g => g.id === waitlistId);
  const table = state.tables.find(t => t.id === tableId);

  if (!guest || !table) return res.status(404).json({ error: 'Not found' });
  if (table.status !== 'ready') return res.status(400).json({ error: 'Table not ready' });

  // Validate waiterId if provided
  const waiter = waiterId ? state.waiters.find(w => w.id === waiterId) : null;

  table.status     = 'occupied';
  table.guestId    = guest.id;
  table.guestName  = `${guest.name} x${guest.partySize}`;
  table.occupiedAt = Date.now();
  table.waiterId   = waiter ? waiter.id : null;

  guest.status   = 'seated';
  guest.seatedAt = Date.now();
  guest.tableId  = tableId;
  guest.waiterId = waiter ? waiter.id : null;

  // Persist visit in guest history
  upsertGuestHistory(guest.phone, guest.name);

  saveTable(table);
  saveGuest(guest);
  broadcastState();
  res.json({ guest, table });
});

app.delete('/api/waitlist/:id', requireAuth, (req, res) => {
  const idx = state.waitlist.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = state.waitlist.splice(idx, 1);
  markGuestRemoved(removed.id);
  broadcastState();
  res.json(removed);
});

// ── Table combining ───────────────────────────────────────────────────────────

app.post('/api/tables/combine', requireAuth, (req, res) => {
  const { tableIds } = req.body;
  if (!Array.isArray(tableIds) || tableIds.length < 2)
    return res.status(400).json({ error: 'Need at least 2 table IDs' });

  const toMerge = tableIds.map(id => state.tables.find(t => t.id === id));
  if (toMerge.some(t => !t))                   return res.status(404).json({ error: 'Table not found' });
  if (toMerge.some(t => t.status !== 'ready')) return res.status(400).json({ error: 'All tables must be ready' });
  if (toMerge.some(t => t.combinedWith || t.primaryTableId))
    return res.status(400).json({ error: 'Table already combined' });

  const [primary, ...secondaries] = toMerge.sort((a, b) => a.number - b.number);
  primary.originalCapacity = primary.capacity;
  primary.capacity         = toMerge.reduce((s, t) => s + t.capacity, 0);
  primary.combinedWith     = secondaries.map(t => ({ id: t.id, number: t.number, capacity: t.capacity }));
  secondaries.forEach(t => { t.status = 'combined'; t.primaryTableId = primary.id; });

  saveTable(primary);
  secondaries.forEach(t => saveTable(t));
  broadcastState();
  res.json({ primary, secondaries });
});

app.post('/api/tables/:id/split', requireAuth, (req, res) => {
  const primary = state.tables.find(t => t.id === req.params.id);
  if (!primary)              return res.status(404).json({ error: 'Table not found' });
  if (!primary.combinedWith) return res.status(400).json({ error: 'Table is not combined' });
  if (primary.status !== 'ready') return res.status(400).json({ error: 'Mark table ready before splitting' });

  for (const c of primary.combinedWith) {
    const sec = state.tables.find(t => t.id === c.id);
    if (sec) { sec.status = 'ready'; sec.primaryTableId = null; saveTable(sec); }
  }
  primary.capacity         = primary.originalCapacity;
  primary.combinedWith     = null;
  primary.originalCapacity = null;
  saveTable(primary);

  broadcastState();
  res.json(primary);
});

// ── Settings ──────────────────────────────────────────────────────────────────

app.patch('/api/settings', requireAuth, (req, res) => {
  const { estimatedWait } = req.body;
  if (estimatedWait !== undefined) {
    const val = parseInt(estimatedWait, 10);
    if (!isNaN(val) && val >= 0) state.settings.estimatedWait = val;
  }
  saveSettings(state.settings);
  broadcastState();
  res.json(state.settings);
});

// ── Table management ──────────────────────────────────────────────────────────

app.post('/api/tables', requireAuth, (req, res) => {
  const { number, capacity, section } = req.body;
  const n = parseInt(number, 10);
  const c = parseInt(capacity, 10);
  if (!n || !c || !section) return res.status(400).json({ error: 'number, capacity, section required' });
  if (state.tables.some(t => t.number === n))
    return res.status(409).json({ error: 'Table number already exists' });

  const table = {
    id: `t${uuidv4()}`,
    number: n, capacity: c, section,
    status: 'ready',
    guestId: null, guestName: null, occupiedAt: null,
    combinedWith: null, primaryTableId: null, originalCapacity: null,
  };
  state.tables.push(table);
  state.tables.sort((a, b) => a.number - b.number);
  createTableRow(table);
  broadcastState();
  res.json(table);
});

app.patch('/api/tables/:id/config', requireAuth, (req, res) => {
  const table = state.tables.find(t => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status === 'occupied' || table.combinedWith || table.primaryTableId)
    return res.status(400).json({ error: 'Cannot edit occupied or combined table' });

  const { number, capacity, section } = req.body;
  if (number !== undefined) {
    const n = parseInt(number, 10);
    if (state.tables.some(t => t.id !== table.id && t.number === n))
      return res.status(409).json({ error: 'Table number already exists' });
    table.number = n;
  }
  if (capacity !== undefined) table.capacity = parseInt(capacity, 10);
  if (section  !== undefined) table.section  = section;

  updateTableConfig(table.id, { number: table.number, capacity: table.capacity, section: table.section });
  state.tables.sort((a, b) => a.number - b.number);
  broadcastState();
  res.json(table);
});

app.delete('/api/tables/:id', requireAuth, (req, res) => {
  const idx = state.tables.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found' });
  const table = state.tables[idx];
  if (table.status === 'occupied')   return res.status(400).json({ error: 'Cannot delete an occupied table' });
  if (table.primaryTableId)          return res.status(400).json({ error: 'Split the combined table first' });

  if (table.combinedWith) {
    for (const c of table.combinedWith) {
      const sec = state.tables.find(t => t.id === c.id);
      if (sec) { sec.status = 'ready'; sec.primaryTableId = null; saveTable(sec); }
    }
  }
  state.tables.splice(idx, 1);
  deleteTableRow(table.id);
  broadcastState();
  res.json({ ok: true });
});

// ── Waiters ───────────────────────────────────────────────────────────────────

app.get('/api/waiters', (req, res) => res.json(state.waiters));

app.post('/api/waiters', requireAuth, (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const usedColors    = state.waiters.map(w => w.color);
  const assignedColor = (color && WAITER_COLORS.includes(color))
    ? color
    : WAITER_COLORS.find(c => !usedColors.includes(c))
      ?? WAITER_COLORS[state.waiters.length % WAITER_COLORS.length];

  const waiter = { id: uuidv4(), name: name.trim(), color: assignedColor, active: true };
  state.waiters.push(waiter);
  saveWaiter(waiter);
  broadcastState();
  res.json(waiter);
});

app.patch('/api/waiters/:id', requireAuth, (req, res) => {
  const waiter = state.waiters.find(w => w.id === req.params.id);
  if (!waiter) return res.status(404).json({ error: 'Waiter not found' });

  if (req.body.name   !== undefined) waiter.name   = req.body.name.trim();
  if (req.body.color  !== undefined) waiter.color  = req.body.color;
  if (req.body.active !== undefined) waiter.active = Boolean(req.body.active);

  saveWaiter(waiter);
  broadcastState();
  res.json(waiter);
});

app.delete('/api/waiters/:id', requireAuth, (req, res) => {
  const idx = state.waiters.findIndex(w => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Waiter not found' });

  for (const t of state.tables) {
    if (t.waiterId === req.params.id) { t.waiterId = null; saveTable(t); }
  }
  state.waiters.splice(idx, 1);
  deleteWaiterRow(req.params.id);
  broadcastState();
  res.json({ ok: true });
});

// ── Guest tags ────────────────────────────────────────────────────────────────

app.patch('/api/waitlist/:id/tags', requireAuth, (req, res) => {
  const guest = state.waitlist.find(g => g.id === req.params.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });
  const { tags } = req.body;
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be array' });
  guest.tags = tags;
  saveGuest(guest);
  broadcastState();
  res.json(guest);
});

// ── Guest history ─────────────────────────────────────────────────────────────

app.get('/api/history/:phone', requireAuth, (req, res) => {
  const history = getGuestHistoryByPhone(req.params.phone);
  res.json(history || null);
});

app.patch('/api/history/:phone/notes', requireAuth, (req, res) => {
  const { notes } = req.body;
  updateGuestHistoryNotes(req.params.phone, notes || '');
  res.json({ ok: true });
});

// ── Shift close ───────────────────────────────────────────────────────────────

app.post('/api/shift/close', requireAuth, (req, res) => {
  // Snapshot current report
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const report     = getReportsToday(todayStart.getTime());

  // Mark remaining waiting/notified guests as removed
  for (const g of state.waitlist) {
    if (g.status === 'waiting' || g.status === 'notified') {
      g.status = 'removed'; g.removedAt = Date.now();
      saveGuest(g);
    }
  }

  // Reset occupied and dirty tables to ready for the next shift
  for (const t of state.tables) {
    if (t.status === 'occupied' || t.status === 'dirty') {
      t.status = 'ready'; t.guestId = null; t.guestName = null;
      t.occupiedAt = null; t.waiterId = null;
      saveTable(t);
    }
  }

  // Mark all waiters as off-shift
  for (const w of state.waiters) {
    w.active = false;
    saveWaiter(w);
  }

  // Log the shift
  const id = uuidv4();
  closeShift(id, { ...report, waiters: state.waiters.map(w => ({ id: w.id, name: w.name })) });

  broadcastState();
  res.json({ ok: true, shiftId: id, summary: report });
});

app.get('/api/shift/logs', requireAuth, (req, res) => {
  res.json(getShiftLogs(10));
});

// ── Reports ───────────────────────────────────────────────────────────────────

app.get('/api/reports/today', requireAuth, (req, res) => {
  res.json(getReportsToday());
});

// ── Auto-reminder: SMS guests still waiting 10 min after notification ─────────

setInterval(() => {
  const TEN_MIN = 10 * 60_000;
  let changed = false;
  for (const guest of state.waitlist) {
    if (guest.status === 'notified' && !guest.reminderSent &&
        guest.notifiedAt && Date.now() - guest.notifiedAt >= TEN_MIN) {
      guest.reminderSent = true;
      changed = true;
      console.log(`Auto-reminder triggered for ${guest.name}`);
      sendReminderSmsBackground(guest);
      saveGuest(guest);
    }
  }
  if (changed) broadcastState();
}, 60_000);

// ── JSON error handler (catches body-parse failures from express.json()) ────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Server error' });
});

// ── Static frontend ───────────────────────────────────────────────────────────

const distDir = join(__dirname, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // Serve the SPA shell for all non-API routes (client-side routing)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

// ── HTTP + WS ─────────────────────────────────────────────────────────────────

const server = createServer(app);
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Cibolo Creek Eatery & Venue → http://localhost:${PORT}`));
