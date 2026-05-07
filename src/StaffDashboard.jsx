import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRestaurantState } from './useRestaurantState.js';
import { useOptimistic } from './useOptimistic.js';

/* ── Brand mark ── */
function CiboloCreekMark() {
  return (
    <svg width="40" height="27" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="22" cy="15" rx="21" ry="14" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
      <text x="22" y="11" textAnchor="middle" fill="#F9F2EA" fontSize="5.5" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif" letterSpacing="0.5">CIBOLO</text>
      <text x="22" y="17" textAnchor="middle" fill="#F9F2EA" fontSize="3.8" fontWeight="500" fontFamily="'Inter', sans-serif" letterSpacing="1.2">CREEK</text>
      <text x="22" y="23" textAnchor="middle" fill="rgba(249,242,234,.45)" fontSize="3" fontFamily="'Inter', sans-serif" letterSpacing="0.8">BULVERDE, TX</text>
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTIONS = {
  main:    { label: 'Main Dining',   icon: '🍽️', order: 0 },
  bar:     { label: 'Bar & Lounge',  icon: '🍸', order: 1 },
  patio:   { label: 'Outdoor Patio', icon: '🌿', order: 2 },
  private: { label: 'Private Room',  icon: '🔒', order: 3 },
};

const STATUS = {
  ready:    { label: 'Ready',    color: '#16a34a', bg: '#dcfce7', icon: '✓' },
  occupied: { label: 'Occupied', color: '#dc2626', bg: '#fee2e2', icon: '●' },
  dirty:    { label: 'Dirty',    color: '#c2410c', bg: '#ffedd5', icon: '✕' },
  cleaning: { label: 'Cleaning', color: '#b45309', bg: '#fef9c3', icon: '↺' },
};

const SECTION_OPTIONS = ['main', 'bar', 'patio', 'private'];
const STATUS_CYCLE    = ['ready', 'occupied', 'dirty', 'cleaning'];

const WAITER_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

function elapsed(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'Just now';
  if (m === 1) return '1 min';
  return `${m} min`;
}

function formatTableTime(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1)   return '< 1m';
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function useMinuteTick() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TableCard({ table, seatMode, combineMode, manageMode, isSelected, onPress, onSeatSelect, onCombineToggle, onSplit, onEdit, onDelete, now, waiterColor, waiterName, onReassignWaiter }) {
  const meta       = STATUS[table.status] || STATUS.ready;
  const isCombined = Boolean(table.combinedWith?.length);

  const selectable = seatMode    && table.status === 'ready';
  const combinable = combineMode && table.status === 'ready' && !isCombined;
  const dim        = (seatMode    && table.status !== 'ready') ||
                     (combineMode && !combinable && !isSelected);

  const tableLabel = isCombined
    ? `T${table.number}+${table.combinedWith.map(c => c.number).join('+')}`
    : `T${table.number}`;

  const occupiedMs = table.status === 'occupied' && table.occupiedAt
    ? now - table.occupiedAt : null;

  function handleClick() {
    if (manageMode) return;
    if (combineMode) {
      if (combinable || isSelected) onCombineToggle(table);
      return;
    }
    if (selectable) { onSeatSelect(table); return; }
    if (!seatMode)  onPress(table);
  }

  return (
    <button
      className={[
        'table-card',
        selectable ? 'table-card--selectable' : '',
        combinable ? 'table-card--combinable' : '',
        isSelected ? 'table-card--selected'   : '',
        dim        ? 'table-card--dim'        : '',
        isCombined ? 'table-card--combined'   : '',
        manageMode ? 'table-card--manage'     : '',
        waiterColor && table.status === 'occupied' ? 'table-card--waiter' : '',
      ].filter(Boolean).join(' ')}
      style={{
        '--sc': meta.color,
        '--sb': meta.bg,
        '--wc': waiterColor || 'transparent',
      }}
      onClick={handleClick}
      aria-label={`Table ${table.number} ${meta.label}`}
    >
      {waiterColor && table.status === 'occupied' && (
        <div className="tc-waiter-stripe" style={{ background: waiterColor }} />
      )}
      <div className="tc-header">
        <span className="tc-num">{tableLabel}</span>
        <span className="tc-cap">👥{table.capacity}</span>
      </div>
      <div className="tc-status">
        <span className="tc-icon">{isSelected ? '✓' : meta.icon}</span>
        <span>{isSelected ? 'Selected' : meta.label}</span>
      </div>
      {table.guestName  && <div className="tc-guest">{table.guestName}</div>}
      {waiterName && table.status === 'occupied' && (
        <div
          className={`tc-waiter-badge ${onReassignWaiter ? 'tc-waiter-badge--clickable' : ''}`}
          style={{ background: waiterColor }}
          onClick={onReassignWaiter ? (e) => { e.stopPropagation(); onReassignWaiter(table); } : undefined}
          title={onReassignWaiter ? 'Change waiter' : undefined}
        >
          {waiterName}
          {onReassignWaiter && <span className="tc-waiter-badge__edit">✎</span>}
        </div>
      )}
      {!waiterName && table.status === 'occupied' && onReassignWaiter && !seatMode && !combineMode && !manageMode && (
        <div
          className="tc-waiter-badge tc-waiter-badge--unassigned tc-waiter-badge--clickable"
          onClick={(e) => { e.stopPropagation(); onReassignWaiter(table); }}
          title="Assign waiter"
        >
          + Assign waiter
        </div>
      )}
      {occupiedMs !== null && <div className="tc-timer">⏱ {formatTableTime(occupiedMs)}</div>}
      {selectable && <div className="tc-seat-hint">Tap to seat</div>}
      {isCombined && !combineMode && !seatMode && !manageMode && (
        <button className="tc-split-btn" onClick={e => { e.stopPropagation(); onSplit(table.id); }}>
          ⛓ Split
        </button>
      )}
      {manageMode && (
        <div className="tc-manage-btns" onClick={e => e.stopPropagation()}>
          <button className="tc-edit-btn"   onClick={() => onEdit(table)}   title="Edit">✏️</button>
          <button className="tc-delete-btn" onClick={() => onDelete(table)} title="Delete"
            disabled={table.status === 'occupied' || Boolean(table.primaryTableId)}>🗑</button>
        </div>
      )}
    </button>
  );
}

function StatusSheet({ table, onSelect, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <p className="sheet-title">Table {table.number} · {table.capacity} seats</p>
        <div className="sheet-grid">
          {STATUS_CYCLE.map(s => {
            const m = STATUS[s];
            return (
              <button
                key={s}
                className={`sheet-opt ${table.status === s ? 'sheet-opt--active' : ''}`}
                style={{ '--sc': m.color, '--sb': m.bg }}
                onClick={() => onSelect(s)}
              >
                <span className="sheet-opt-icon">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
        <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function GuestCard({ guest, position, onNotify, onSeat, onCancel, onTag }) {
  const statusMeta = {
    waiting:  { label: 'Waiting',  cls: 'badge--waiting'  },
    notified: { label: 'Notified', cls: 'badge--notified' },
    seated:   { label: 'Seated',   cls: 'badge--seated'   },
  }[guest.status] ?? { label: guest.status, cls: '' };

  const smsLabel = {
    sending: '📱 Sending…',
    sent:    '📱 SMS ✓',
    skipped: '📱 (no credentials)',
    error:   '📱 SMS failed',
  }[guest.smsResult] ?? '';

  const isReturn = (guest.visitCount || 1) > 1;

  return (
    <div className={`gc ${guest.status === 'notified' ? 'gc--notified' : ''}`}>
      <div className="gc-left">
        <div className="gc-pos">#{position}</div>
        <div className="gc-body">
          <div className="gc-name-row">
            <span className="gc-name">{guest.name}</span>
            {isReturn && (
              <span className="gc-return-badge" title={`Visit #${guest.visitCount}`}>
                ★ #{guest.visitCount}
              </span>
            )}
          </div>
          <div className="gc-meta">
            {guest.partySize} guests · {elapsed(guest.joinedAt)} ago
            <span className="gc-phone"> · {guest.phone}</span>
          </div>
          {smsLabel && <div className="gc-sms">{smsLabel}</div>}
          {guest.reminderSent && <div className="gc-sms">📱 Reminder sent</div>}
          <GuestTagPills tags={guest.tags} />
        </div>
      </div>
      <div className="gc-actions">
        <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
        {(guest.status === 'waiting' || guest.status === 'notified') && (
          <>
            {guest.status === 'waiting' && (
              <button className="act act--notify" onClick={() => onNotify(guest.id)}>
                📱 SMS
              </button>
            )}
            <button className="act act--seat"   onClick={() => onSeat(guest)}>🪑 Seat</button>
            <button className="act act--tag"    onClick={() => onTag(guest)}  title="Add tags">🏷</button>
            <button className="act act--cancel" onClick={() => onCancel(guest.id)} aria-label="Remove">✕</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Table editor modal ────────────────────────────────────────────────────────

function TableModal({ table, onSave, onClose }) {
  const isNew = !table?.id;
  const [form, setForm] = useState({
    number:   table?.number   ?? '',
    capacity: table?.capacity ?? '',
    section:  table?.section  ?? 'main',
  });
  const [error, setError] = useState('');

  function handleSave() {
    const n = parseInt(form.number, 10);
    const c = parseInt(form.capacity, 10);
    if (!n || n < 1)  return setError('Enter a valid table number.');
    if (!c || c < 1)  return setError('Enter a valid capacity.');
    if (!form.section) return setError('Select a section.');
    onSave({ number: n, capacity: c, section: form.section });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <p className="sheet-title">{isNew ? 'Add Table' : `Edit Table ${table.number}`}</p>

        <div className="modal-field">
          <label className="modal-label">Table #</label>
          <input
            className="field__input"
            type="number" min="1"
            value={form.number}
            onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
            placeholder="e.g. 29"
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Capacity (seats)</label>
          <input
            className="field__input"
            type="number" min="1"
            value={form.capacity}
            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
            placeholder="e.g. 4"
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Section</label>
          <select
            className="field__input"
            value={form.section}
            onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
          >
            {SECTION_OPTIONS.map(s => (
              <option key={s} value={s}>{SECTIONS[s]?.label ?? s}</option>
            ))}
          </select>
        </div>

        {error && <p className="field__error">{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>
            {isNew ? '+ Add Table' : 'Save Changes'}
          </button>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Waiter Picker Sheet ───────────────────────────────────────────────────────

function WaiterPickerSheet({ guest, table, waiters, waiterWorkload, onConfirm, onClose, mode = 'seat' }) {
  const isReassign = mode === 'reassign';

  // Suggest waiter with fewest active tables (ties broken alphabetically)
  const suggested = waiters.length > 0
    ? waiters.reduce((best, w) => {
        const wt = waiterWorkload[w.id] || 0;
        const bt = waiterWorkload[best.id] || 0;
        return wt < bt || (wt === bt && w.name < best.name) ? w : best;
      })
    : null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <p className="sheet-title">
          {isReassign
            ? `Change waiter — Table ${table.number}`
            : `Seat ${guest.name} ×${guest.partySize} at Table ${table.number}`}
        </p>
        <p className="waiter-picker-sub">
          {isReassign ? 'Select a new waiter for this table' : 'Assign a waiter'}
        </p>

        <div className="waiter-picker-list">
          {waiters.map(w => {
            const cnt        = waiterWorkload[w.id] || 0;
            const isSuggested = w.id === suggested?.id;
            return (
              <button
                key={w.id}
                className={`waiter-pick-row ${isSuggested ? 'waiter-pick-row--suggested' : ''}`}
                onClick={() => onConfirm(w.id)}
              >
                <span className="waiter-dot" style={{ background: w.color }} />
                <span className="waiter-pick-name">{w.name}</span>
                <span className="waiter-pick-tables">{cnt} table{cnt !== 1 ? 's' : ''}</span>
                {isSuggested && <span className="waiter-pick-suggest">★ Suggested</span>}
              </button>
            );
          })}
          <button className="waiter-pick-row waiter-pick-row--none" onClick={() => onConfirm(null)}>
            <span className="waiter-dot" style={{ background: '#d1d5db' }} />
            <span className="waiter-pick-name">No Waiter</span>
            <span className="waiter-pick-tables">—</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Waiter Management Panel ───────────────────────────────────────────────────

function WaiterManagementPanel({ api, waiters, waiterWorkload, waitlist, onShowToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ name: '', color: '' });
  const [adding,  setAdding]  = useState(false);

  // Today's covers per waiter from in-memory waitlist
  const waiterCoversToday = useMemo(() => {
    const m = {};
    for (const g of waitlist) {
      if (g.status === 'seated' && g.waiterId) {
        m[g.waiterId] = (m[g.waiterId] || 0) + g.partySize;
      }
    }
    return m;
  }, [waitlist]);

  const usedColors  = waiters.map(w => w.color);
  const nextColor   = WAITER_COLORS.find(c => !usedColors.includes(c))
                      ?? WAITER_COLORS[waiters.length % WAITER_COLORS.length];
  const pickedColor = form.color || nextColor;

  async function handleAdd() {
    if (!form.name.trim()) return;
    setAdding(true);
    try {
      await api.addWaiter(form.name.trim(), pickedColor);
      setForm({ name: '', color: '' });
      setShowAdd(false);
      onShowToast(`${form.name.trim()} added to shift ✓`);
    } catch (err) {
      onShowToast(err.message || 'Could not add waiter.', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(w) {
    try { await api.updateWaiter(w.id, { active: !w.active }); }
    catch { onShowToast('Could not update waiter.', 'error'); }
  }

  async function handleDelete(w) {
    if (!window.confirm(`Remove ${w.name} from the roster? Their active tables will be unassigned.`)) return;
    try {
      await api.deleteWaiter(w.id);
      onShowToast(`${w.name} removed`);
    } catch { onShowToast('Could not remove waiter.', 'error'); }
  }

  const active   = waiters.filter(w => w.active);
  const inactive = waiters.filter(w => !w.active);

  return (
    <div className="waiters-panel">
      <div className="panel-header" style={{ marginBottom: 16 }}>
        <h2 className="panel-title">Waiters on Shift</h2>
        <button
          className={`btn-ghost btn-ghost--sm add-guest-btn ${showAdd ? 'btn-ghost--active' : ''}`}
          onClick={() => setShowAdd(s => !s)}
        >
          {showAdd ? '✕ Cancel' : '+ Add Waiter'}
        </button>
      </div>

      {showAdd && (
        <div className="waiter-add-form">
          <input
            className="field__input"
            type="text"
            placeholder="Waiter name (e.g. Maria)"
            value={form.name}
            autoFocus
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="waiter-color-picker">
            <span className="waiter-color-picker__label">Color</span>
            <div className="color-swatches">
              {WAITER_COLORS.map(c => (
                <button
                  key={c}
                  className={`color-swatch ${pickedColor === c ? 'color-swatch--selected' : ''} ${usedColors.includes(c) && pickedColor !== c ? 'color-swatch--used' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  title={usedColors.includes(c) ? 'Already in use' : c}
                />
              ))}
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={handleAdd}
            disabled={!form.name.trim() || adding}
          >
            {adding ? 'Adding…' : '+ Add to Shift'}
          </button>
        </div>
      )}

      {active.length === 0 && !showAdd && (
        <div className="empty-state">
          <span className="empty-state__icon">👥</span>
          <p>No waiters on shift. Tap <strong>+ Add Waiter</strong> to get started.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="waiter-list">
          {active
            .slice()
            .sort((a, b) => (waiterWorkload[b.id] || 0) - (waiterWorkload[a.id] || 0))
            .map(w => {
              const activeTables = waiterWorkload[w.id] || 0;
              const coversToday  = waiterCoversToday[w.id] || 0;
              return (
                <div key={w.id} className="waiter-row">
                  <div className="waiter-row__stripe" style={{ background: w.color }} />
                  <div className="waiter-row__info">
                    <div className="waiter-row__top">
                      <span className="waiter-dot" style={{ background: w.color }} />
                      <span className="waiter-row__name">{w.name}</span>
                    </div>
                    <div className="waiter-row__stats">
                      <span className="waiter-stat">
                        <span className="waiter-stat__dot" style={{ background: w.color }} />
                        {activeTables} active table{activeTables !== 1 ? 's' : ''}
                      </span>
                      <span className="waiter-stat waiter-stat--covers">
                        {coversToday} covers today
                      </span>
                    </div>
                    <div className="waiter-workload-bar">
                      <div
                        className="waiter-workload-bar__fill"
                        style={{
                          background: w.color,
                          width: `${Math.min(100, activeTables * 20)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="waiter-row__actions">
                    <button
                      className="btn-ghost btn-ghost--sm"
                      onClick={() => handleToggleActive(w)}
                      title="Mark off shift"
                    >
                      Off Shift
                    </button>
                    <button
                      className="btn-ghost btn-ghost--sm"
                      style={{ color: '#dc2626', borderColor: '#fecaca' }}
                      onClick={() => handleDelete(w)}
                      title="Remove waiter"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {inactive.length > 0 && (
        <details className="waiter-inactive-section">
          <summary className="waiter-inactive-summary">Off shift ({inactive.length})</summary>
          <div className="waiter-list waiter-list--inactive">
            {inactive.map(w => (
              <div key={w.id} className="waiter-row waiter-row--inactive">
                <div className="waiter-row__stripe" style={{ background: w.color, opacity: 0.4 }} />
                <div className="waiter-row__info">
                  <div className="waiter-row__top">
                    <span className="waiter-dot" style={{ background: w.color, opacity: 0.5 }} />
                    <span className="waiter-row__name" style={{ opacity: 0.6 }}>{w.name}</span>
                  </div>
                </div>
                <div className="waiter-row__actions">
                  <button className="btn-ghost btn-ghost--sm" onClick={() => handleToggleActive(w)}>
                    Back on Shift
                  </button>
                  <button
                    className="btn-ghost btn-ghost--sm"
                    style={{ color: '#dc2626', borderColor: '#fecaca' }}
                    onClick={() => handleDelete(w)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Guest tags ────────────────────────────────────────────────────────────────

const GUEST_TAGS = [
  { id: 'birthday',      label: '🎂 Birthday',     color: '#f9a8d4' },
  { id: 'allergy',       label: '🥜 Allergy',       color: '#fcd34d' },
  { id: 'vip',           label: '⭐ VIP',            color: '#818cf8' },
  { id: 'highchair',     label: '👶 High Chair',    color: '#6ee7b7' },
  { id: 'celebration',   label: '🎉 Celebration',   color: '#fb923c' },
  { id: 'accessibility', label: '♿ Accessibility',  color: '#94a3b8' },
  { id: 'anniversary',   label: '💑 Anniversary',   color: '#f472b6' },
];

const TAG_MAP = Object.fromEntries(GUEST_TAGS.map(t => [t.id, t]));

function GuestTagPills({ tags = [] }) {
  if (!tags.length) return null;
  return (
    <div className="guest-tag-pills">
      {tags.map(id => {
        const t = TAG_MAP[id];
        if (!t) return null;
        return (
          <span key={id} className="guest-tag-pill" style={{ background: t.color }}>
            {t.label}
          </span>
        );
      })}
    </div>
  );
}

function TagEditorSheet({ guest, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(guest.tags || []));

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <p className="sheet-title">Tags — {guest.name}</p>
        <p className="waiter-picker-sub">Select all that apply</p>
        <div className="tag-editor-grid">
          {GUEST_TAGS.map(t => (
            <button
              key={t.id}
              className={`tag-editor-btn ${selected.has(t.id) ? 'tag-editor-btn--on' : ''}`}
              style={selected.has(t.id) ? { background: t.color, borderColor: t.color } : {}}
              onClick={() => toggle(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => onSave([...selected])}>
            Save
          </button>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QR Code modal ─────────────────────────────────────────────────────────────

function QRModal({ onClose }) {
  const url = `${window.location.protocol}//${window.location.host}/`;
  return (
    <div className="sheet-overlay sheet-overlay--center" onClick={onClose}>
      <div className="sheet qr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <p className="sheet-title">Guest Self Check-in</p>
        <p className="waiter-picker-sub">Guests scan this QR to join the waitlist from their phone</p>
        <div className="qr-wrapper">
          <QRCodeSVG
            value={url}
            size={220}
            bgColor="#F9F2EA"
            fgColor="#1F450D"
            level="M"
          />
        </div>
        <p className="qr-url">{url}</p>
        <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// ── Shift Close confirmation ───────────────────────────────────────────────────

function ShiftCloseModal({ onConfirm, onClose, loading }) {
  return (
    <div className="sheet-overlay sheet-overlay--center" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <p className="sheet-title">Close Shift?</p>
        <p className="waiter-picker-sub" style={{ marginBottom: 16 }}>
          This will:
        </p>
        <ul className="shift-close-list">
          <li>📋 Archive today's report</li>
          <li>✅ Reset all occupied &amp; dirty tables to ready</li>
          <li>🚪 Remove pending guests from waitlist</li>
          <li>👤 Mark all waiters off-shift</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            className="btn-primary"
            style={{ flex: 1, background: '#dc2626' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Closing…' : '🔒 Close Shift'}
          </button>
          <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Guest modal ───────────────────────────────────────────────────────────

function AddGuestModal({ onAdd, onClose }) {
  const [form,    setForm]    = useState({ name: '', partySize: '', phone: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const name      = form.name.trim();
    const partySize = parseInt(form.partySize, 10);
    const phone     = form.phone.trim();

    if (!name)              return setError('Name is required.');
    if (!partySize || partySize < 1 || partySize > 50)
                            return setError('Enter a valid party size (1–50).');
    if (!phone)             return setError('Phone number is required.');

    setLoading(true);
    setError('');
    try {
      await onAdd(name, partySize, phone);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not add guest. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <p className="sheet-title">Add Guest to Waitlist</p>

        <div className="modal-field">
          <label className="modal-label">Guest Name</label>
          <input
            className="field__input"
            type="text"
            value={form.name}
            autoFocus
            placeholder="e.g. Maria Garcia"
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Party Size</label>
          <input
            className="field__input"
            type="number" min="1" max="50"
            value={form.partySize}
            placeholder="e.g. 4"
            onChange={e => setForm(f => ({ ...f, partySize: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Phone Number</label>
          <input
            className="field__input"
            type="tel"
            value={form.phone}
            placeholder="e.g. (726) 246-3705"
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <p className="field__error">{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Adding…' : '+ Add to Waitlist'}
          </button>
          <button
            className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reports panel ─────────────────────────────────────────────────────────────

function ReportsPanel({ api, waiters }) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getReports()
      .then(data => { setReport(data); setError(''); })
      .catch(err => {
        const msg = err?.message || '';
        if (msg === 'Unauthorized') {
          setError('Session expired — please log in again.');
        } else {
          setError('Could not load reports. ' + (msg || 'Check your connection.'));
        }
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  function formatHour(h) {
    if (h === null || h === undefined) return '—';
    const ampm = h >= 12 ? 'pm' : 'am';
    const hr   = h % 12 || 12;
    return `${hr}:00 ${ampm}`;
  }

  // Build waiter lookup from current waiters list
  const waiterMap = useMemo(() => {
    const m = {};
    for (const w of (waiters || [])) m[w.id] = w;
    return m;
  }, [waiters]);

  if (loading && !report) return <div className="empty-state"><span className="empty-state__icon">⏳</span><p>Loading reports…</p></div>;
  if (error) return (
    <div className="empty-state">
      <span className="empty-state__icon">⚠️</span>
      <p>{error}</p>
      <button className="btn-ghost btn-ghost--sm" onClick={load}>Retry</button>
    </div>
  );
  if (!report) return null;

  return (
    <div className="reports-panel">
      {/* Summary stats */}
      <div className="report-stats-grid">
        <div className="report-stat">
          <span className="report-stat__num">{report.totalSeated}</span>
          <span className="report-stat__label">Parties seated</span>
        </div>
        <div className="report-stat">
          <span className="report-stat__num">{report.totalGuests}</span>
          <span className="report-stat__label">Total guests</span>
        </div>
        <div className="report-stat">
          <span className="report-stat__num">{report.avgWaitMinutes}m</span>
          <span className="report-stat__label">Avg wait</span>
        </div>
        <div className="report-stat">
          <span className="report-stat__num">{formatHour(report.peakHour)}</span>
          <span className="report-stat__label">Peak hour</span>
        </div>
      </div>

      {/* Waiter performance */}
      {report.waiterStats?.length > 0 && (
        <div className="report-section">
          <h3 className="report-section__title">Waiter Performance Today</h3>
          <div className="waiter-report-list">
            {report.waiterStats
              .sort((a, b) => b.covers - a.covers)
              .map(ws => {
                const w = waiterMap[ws.waiterId];
                const color = w?.color || '#94a3b8';
                const name  = w?.name  || 'Unknown';
                const maxCovers = Math.max(...report.waiterStats.map(s => s.covers), 1);
                return (
                  <div key={ws.waiterId} className="waiter-report-row">
                    <span className="waiter-dot" style={{ background: color, flexShrink: 0 }} />
                    <span className="waiter-report-name">{name}</span>
                    <div className="waiter-report-bar-wrap">
                      <div
                        className="waiter-report-bar"
                        style={{
                          background: color,
                          width: `${(ws.covers / maxCovers) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="waiter-report-covers">{ws.tables} tables · {ws.covers} covers</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Seated log */}
      {report.seatedList.length > 0 && (
        <div className="report-section">
          <h3 className="report-section__title">Seated Today ({report.totalSeated})</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Party</th>
                <th>Waiter</th>
                <th>Waited</th>
              </tr>
            </thead>
            <tbody>
              {report.seatedList.map(g => {
                const w = g.waiterId ? waiterMap[g.waiterId] : null;
                return (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.partySize}</td>
                    <td>
                      {w ? (
                        <span className="waiter-report-tag" style={{ background: w.color }}>
                          {w.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{g.waitMinutes}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Removed log */}
      {report.removedList.length > 0 && (
        <div className="report-section">
          <h3 className="report-section__title">Left / Removed ({report.totalRemoved})</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Party</th>
                <th>Waited</th>
              </tr>
            </thead>
            <tbody>
              {report.removedList.map(g => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.partySize}</td>
                  <td>{g.waitMinutes}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.totalSeated === 0 && report.totalRemoved === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon">📋</span>
          <p>No activity recorded today yet.</p>
        </div>
      )}

      <button className="btn-ghost btn-ghost--sm" style={{ marginTop: 12 }} onClick={load}>
        ↻ Refresh
      </button>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function StaffDashboard({ token, onLogout }) {
  const { restaurantState, connected, api } = useRestaurantState(token, onLogout);
  const { tables, waitlist, patchTable, patchGuest, hideGuest, revertTable, revertGuest } =
    useOptimistic(restaurantState);

  const now      = useMinuteTick();
  const settings = restaurantState.settings || { estimatedWait: 20 };

  const [activeTab,          setActiveTab]          = useState(
    () => window.innerWidth >= 768 ? 'tables' : 'waitlist'
  );

  // On desktop the Waitlist is always pinned left — keep a right-panel tab active
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768 && activeTab === 'waitlist') {
        setActiveTab('tables');
      }
    }
    window.addEventListener('resize', onResize);
    onResize(); // run once on mount
    return () => window.removeEventListener('resize', onResize);
  }, [activeTab]);
  const [sheetTable,         setSheetTable]         = useState(null);
  const [seatGuest,          setSeatGuest]          = useState(null);
  const [toast,              setToast]              = useState(null);
  const [combineMode,        setCombineMode]        = useState(false);
  const [manageMode,         setManageMode]         = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState(new Set());
  const [editingWait,        setEditingWait]        = useState(false);
  const [waitInput,          setWaitInput]          = useState('');
  const [tableModal,         setTableModal]         = useState(null); // null | 'new' | tableObj
  const [showAddGuest,       setShowAddGuest]       = useState(false);
  const [pendingSeatTable,   setPendingSeatTable]   = useState(null); // waiter picker (seating)
  const [reassignTable,      setReassignTable]      = useState(null); // waiter picker (reassign)
  const [tagGuest,           setTagGuest]           = useState(null); // tag editor
  const [showQR,             setShowQR]             = useState(false);
  const [showShiftClose,     setShowShiftClose]     = useState(false);
  const [shiftClosing,       setShiftClosing]       = useState(false);
  const [logoutPending,      setLogoutPending]      = useState(false);

  // ── Derived counts ──────────────────────────────────────────────────────────

  const activeWaitlist = useMemo(
    () => waitlist.filter(g => g.status === 'waiting' || g.status === 'notified')
                  .sort((a, b) => a.joinedAt - b.joinedAt),
    [waitlist]
  );
  const seatedToday = useMemo(() => waitlist.filter(g => g.status === 'seated').length, [waitlist]);
  const readyCount  = useMemo(() => tables.filter(t => t.status === 'ready' && !t.primaryTableId).length, [tables]);

  const tablesBySection = useMemo(() => {
    const map = {};
    for (const tbl of tables) {
      if (tbl.status === 'combined') continue;
      const s = tbl.section || 'main';
      (map[s] = map[s] || []).push(tbl);
    }
    for (const s of Object.keys(map)) map[s].sort((a, b) => a.number - b.number);
    return map;
  }, [tables]);

  const sectionOrder = useMemo(
    () => Object.keys(tablesBySection).sort((a, b) => (SECTIONS[a]?.order ?? 9) - (SECTIONS[b]?.order ?? 9)),
    [tablesBySection]
  );

  const visibleTableCount = useMemo(() => tables.filter(t => t.status !== 'combined').length, [tables]);

  const combineCapacity = useMemo(
    () => tables.filter(t => selectedForCombine.has(t.id)).reduce((s, t) => s + t.capacity, 0),
    [tables, selectedForCombine]
  );

  // ── Waiter derived state ─────────────────────────────────────────────────────

  const waiterMap = useMemo(() => {
    const m = {};
    for (const w of (restaurantState.waiters || [])) m[w.id] = w;
    return m;
  }, [restaurantState.waiters]);

  const activeWaiters = useMemo(
    () => (restaurantState.waiters || []).filter(w => w.active),
    [restaurantState.waiters]
  );

  // Count of currently occupied tables per waiter
  const waiterWorkload = useMemo(() => {
    const counts = {};
    for (const t of tables) {
      if (t.status === 'occupied' && t.waiterId) {
        counts[t.waiterId] = (counts[t.waiterId] || 0) + 1;
      }
    }
    return counts;
  }, [tables]);

  // ── Toast ────────────────────────────────────────────────────────────────────

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Table status change ──────────────────────────────────────────────────────

  async function handleTableStatusSelect(status) {
    const tbl = sheetTable;
    setSheetTable(null);
    if (tbl.status === status) return;
    patchTable(tbl.id, {
      status,
      guestId:   status !== 'occupied' ? null : tbl.guestId,
      guestName: status !== 'occupied' ? null : tbl.guestName,
    });
    try {
      await api.updateTableStatus(tbl.id, status);
    } catch {
      revertTable(tbl.id);
      showToast('Could not update table status.', 'error');
    }
  }

  // ── Waitlist actions ─────────────────────────────────────────────────────────

  async function handleNotify(guestId) {
    const guest = activeWaitlist.find(g => g.id === guestId);
    if (!guest) return;
    patchGuest(guestId, { status: 'notified', notifiedAt: Date.now(), smsResult: 'sending' });
    try {
      await api.notifyGuest(guestId);
      showToast(`SMS sent to ${guest.name} 📱`);
    } catch {
      revertGuest(guestId);
      showToast('Could not send notification.', 'error');
    }
  }

  function handleStartSeat(guest) {
    setCombineMode(false);
    setManageMode(false);
    setSelectedForCombine(new Set());
    setPendingSeatTable(null);
    setSeatGuest(guest);
    setActiveTab('tables');
    showToast(`Select a table for ${guest.name} (party of ${guest.partySize})`, 'info');
  }

  function handleSeatAtTable(tbl) {
    if (!seatGuest) return;
    if (tbl.capacity < seatGuest.partySize) {
      showToast(`Table ${tbl.number} seats ${tbl.capacity} — party of ${seatGuest.partySize} won't fit.`, 'error');
      return;
    }
    // If there are active waiters on shift, open the waiter picker first
    if (activeWaiters.length > 0) {
      setPendingSeatTable(tbl);
    } else {
      // No waiters configured — seat directly
      doSeat(seatGuest, tbl, null);
    }
  }

  async function doSeat(guest, tbl, waiterId) {
    setSeatGuest(null);
    setPendingSeatTable(null);
    const waiter = waiterId ? waiterMap[waiterId] : null;
    patchGuest(guest.id, { status: 'seated', seatedAt: Date.now(), tableId: tbl.id, waiterId: waiterId || null });
    patchTable(tbl.id, { status: 'occupied', guestName: `${guest.name} x${guest.partySize}`, waiterId: waiterId || null });
    try {
      await api.seatGuest(guest.id, tbl.id, waiterId || null);
      const waiterSuffix = waiter ? ` — ${waiter.name}` : '';
      showToast(`${guest.name} seated at Table ${tbl.number}${waiterSuffix} ✓`);
    } catch {
      revertGuest(guest.id);
      revertTable(tbl.id);
      showToast('Could not seat guest — table may no longer be available.', 'error');
    }
  }

  function handleWaiterPick(waiterId) {
    if (!pendingSeatTable || !seatGuest) return;
    doSeat(seatGuest, pendingSeatTable, waiterId);
  }

  async function handleReassignWaiterPick(waiterId) {
    if (!reassignTable) return;
    const tbl    = reassignTable;
    const waiter = waiterId ? waiterMap[waiterId] : null;
    setReassignTable(null);
    patchTable(tbl.id, { waiterId: waiterId || null });
    try {
      await api.reassignWaiter(tbl.id, waiterId || null);
      const msg = waiter ? `Table ${tbl.number} → ${waiter.name} ✓` : `Table ${tbl.number} waiter removed`;
      showToast(msg);
    } catch {
      revertTable(tbl.id);
      showToast('Could not reassign waiter.', 'error');
    }
  }

  async function handleSaveTags(tags) {
    if (!tagGuest) return;
    const guest = tagGuest;
    setTagGuest(null);
    patchGuest(guest.id, { tags });
    try {
      await api.updateGuestTags(guest.id, tags);
    } catch {
      revertGuest(guest.id);
      showToast('Could not save tags.', 'error');
    }
  }

  async function handleCloseShift() {
    setShiftClosing(true);
    try {
      await api.closeShift();
      setShowShiftClose(false);
      showToast('Shift closed. Good work! 👏');
    } catch {
      showToast('Could not close shift.', 'error');
    } finally {
      setShiftClosing(false);
    }
  }

  async function handleCancel(guestId) {
    const guest = waitlist.find(g => g.id === guestId);
    hideGuest(guestId);
    try {
      await api.removeGuest(guestId);
    } catch {
      revertGuest(guestId);
      showToast(`Could not remove ${guest?.name ?? 'guest'}.`, 'error');
    }
  }

  async function handleAddGuest(name, partySize, phone) {
    const entry = await api.joinWaitlist(name, partySize, phone);
    showToast(`${name} added to waitlist ✓`);
    return entry;
  }

  // ── Combine ──────────────────────────────────────────────────────────────────

  function handleToggleCombineMode() {
    setCombineMode(m => !m);
    setManageMode(false);
    setSelectedForCombine(new Set());
  }

  function handleCombineToggle(tbl) {
    setSelectedForCombine(prev => {
      const next = new Set(prev);
      next.has(tbl.id) ? next.delete(tbl.id) : next.add(tbl.id);
      return next;
    });
  }

  async function handleCombine() {
    const ids    = [...selectedForCombine];
    const toMerge = tables.filter(t => ids.includes(t.id)).sort((a, b) => a.number - b.number);
    const [primary, ...secondaries] = toMerge;
    const totalCap = toMerge.reduce((s, t) => s + t.capacity, 0);

    setCombineMode(false);
    setSelectedForCombine(new Set());

    patchTable(primary.id, {
      capacity: totalCap, originalCapacity: primary.capacity,
      combinedWith: secondaries.map(t => ({ id: t.id, number: t.number, capacity: t.capacity })),
    });
    secondaries.forEach(t => patchTable(t.id, { status: 'combined', primaryTableId: primary.id }));

    try {
      await api.combineTables(ids);
      showToast(`Tables ${toMerge.map(t => t.number).join('+')} combined ✓`);
    } catch {
      ids.forEach(id => revertTable(id));
      showToast('Could not combine tables.', 'error');
    }
  }

  async function handleSplit(tableId) {
    const tbl = tables.find(t => t.id === tableId);
    if (!tbl?.combinedWith?.length) return;
    const secondaryIds = tbl.combinedWith.map(c => c.id);
    patchTable(tableId, { capacity: tbl.originalCapacity, combinedWith: null, originalCapacity: null });
    secondaryIds.forEach(id => patchTable(id, { status: 'ready', primaryTableId: null }));
    try {
      await api.splitTable(tableId);
      showToast('Tables split ✓');
    } catch {
      revertTable(tableId);
      secondaryIds.forEach(id => revertTable(id));
      showToast('Could not split tables.', 'error');
    }
  }

  // ── Wait time ────────────────────────────────────────────────────────────────

  function startEditWait() {
    setWaitInput(String(settings.estimatedWait));
    setEditingWait(true);
  }

  function saveWait() {
    const val = parseInt(waitInput, 10);
    setEditingWait(false);
    if (isNaN(val) || val < 0 || val === settings.estimatedWait) return;
    api.updateSettings({ estimatedWait: val })
      .then(() => showToast(`Wait time set to ~${val} min`))
      .catch(() => showToast('Could not update wait time.', 'error'));
  }

  function waitPosition(guest) {
    return activeWaitlist.filter(g => g.joinedAt < guest.joinedAt).length + 1;
  }

  // ── Manage-mode table actions ─────────────────────────────────────────────

  function handleToggleManageMode() {
    setManageMode(m => !m);
    setCombineMode(false);
    setSelectedForCombine(new Set());
    setSeatGuest(null);
  }

  function handleEditTable(tbl) {
    setTableModal(tbl);
  }

  async function handleDeleteTable(tbl) {
    if (!window.confirm(`Delete Table ${tbl.number}? This cannot be undone.`)) return;
    try {
      await api.deleteTable(tbl.id);
      showToast(`Table ${tbl.number} deleted`);
    } catch (err) {
      showToast(err.message || 'Could not delete table.', 'error');
    }
  }

  async function handleSaveTableModal({ number, capacity, section }) {
    const isNew = tableModal === 'new' || !tableModal?.id;
    setTableModal(null);
    try {
      if (isNew) {
        await api.createTable(number, capacity, section);
        showToast(`Table ${number} added ✓`);
      } else {
        await api.updateTableConfig(tableModal.id, { number, capacity, section });
        showToast(`Table ${number} updated ✓`);
      }
    } catch (err) {
      showToast(err.message || 'Could not save table.', 'error');
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async function handleLogout() {
    setLogoutPending(true);
    try { await api.logout(); } catch { /* best effort */ }
    setLogoutPending(false);
    onLogout();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="staff-page">
      {toast && <div key={toast.id} className={`toast toast--${toast.type}`}>{toast.msg}</div>}

      {sheetTable && (
        <StatusSheet
          table={sheetTable}
          onSelect={handleTableStatusSelect}
          onClose={() => setSheetTable(null)}
        />
      )}

      {tableModal && (
        <TableModal
          table={tableModal === 'new' ? null : tableModal}
          onSave={handleSaveTableModal}
          onClose={() => setTableModal(null)}
        />
      )}

      {showAddGuest && (
        <AddGuestModal
          onAdd={handleAddGuest}
          onClose={() => setShowAddGuest(false)}
        />
      )}

      {pendingSeatTable && seatGuest && (
        <WaiterPickerSheet
          guest={seatGuest}
          table={pendingSeatTable}
          waiters={activeWaiters}
          waiterWorkload={waiterWorkload}
          onConfirm={handleWaiterPick}
          onClose={() => setPendingSeatTable(null)}
        />
      )}

      {reassignTable && (
        <WaiterPickerSheet
          guest={null}
          table={reassignTable}
          waiters={activeWaiters}
          waiterWorkload={waiterWorkload}
          onConfirm={handleReassignWaiterPick}
          onClose={() => setReassignTable(null)}
          mode="reassign"
        />
      )}

      {tagGuest && (
        <TagEditorSheet
          guest={tagGuest}
          onSave={handleSaveTags}
          onClose={() => setTagGuest(null)}
        />
      )}

      {showQR && <QRModal onClose={() => setShowQR(false)} />}

      {showShiftClose && (
        <ShiftCloseModal
          onConfirm={handleCloseShift}
          onClose={() => setShowShiftClose(false)}
          loading={shiftClosing}
        />
      )}

      <header className="staff-header">
        <div className="staff-header__brand">
          <CiboloCreekMark />
          <div>
            <span className="logo-text" style={{ color: '#fff', fontSize: '1rem', display: 'block', lineHeight: 1.1 }}>Cibolo Creek</span>
            <span style={{ fontSize: '.45rem', fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(249,242,234,.6)', display: 'block', marginTop: 1 }}>Eatery &amp; Venue</span>
          </div>
          <span className="staff-badge">Staff</span>
        </div>
        <div className="staff-header__stats">
          <div className="hstat"><span className="hstat__num">{activeWaitlist.length}</span><span className="hstat__label">Waiting</span></div>
          <div className="hstat"><span className="hstat__num">{readyCount}</span><span className="hstat__label">Available</span></div>
          <div className="hstat"><span className="hstat__num">{seatedToday}</span><span className="hstat__label">Seated</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`conn-dot ${connected ? 'conn-dot--on' : 'conn-dot--off'}`} title={connected ? 'Live' : 'Reconnecting…'} />
          <button
            className="btn-ghost btn-ghost--sm"
            onClick={() => setShowQR(true)}
            title="Guest QR code"
          >
            QR
          </button>
          <button
            className="btn-ghost btn-ghost--sm header-shift-btn"
            style={{ borderColor: '#fca5a5', color: '#fca5a5' }}
            onClick={() => setShowShiftClose(true)}
            title="Close shift"
          >
            🔒 Close
          </button>
          <button
            className="btn-ghost btn-ghost--sm header-logout-btn"
            onClick={handleLogout}
            disabled={logoutPending}
            title="Log out"
          >
            {logoutPending ? '…' : '⎋ Logout'}
          </button>
        </div>
      </header>

      {seatGuest && (
        <div className="seat-mode-banner">
          <span>Select a table for <strong>{seatGuest.name}</strong> (party of {seatGuest.partySize})</span>
          <button onClick={() => setSeatGuest(null)}>✕ Cancel</button>
        </div>
      )}

      <div className="staff-tabs">
        {[
          { key: 'waitlist', label: 'Waitlist', badge: activeWaitlist.length || null },
          { key: 'tables',   label: 'Tables',   badge: seatGuest ? '!' : combineMode ? '⛓' : null },
          { key: 'waiters',  label: 'Waiters',  badge: activeWaiters.length || null },
          { key: 'reports',  label: 'Reports',  badge: null },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            className={`staff-tab ${activeTab === key ? 'staff-tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {badge && (
              <span className={`tab-badge ${key === 'tables' && seatGuest ? 'tab-badge--pulse' : ''} ${key === 'tables' && combineMode ? 'tab-badge--combine' : ''}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="staff-body">

        {/* ── Waitlist panel ── */}
        <section className={`staff-panel waitlist-panel ${activeTab === 'waitlist' ? 'staff-panel--active' : ''}`}>
          <div className="panel-header">
            <h2 className="panel-title">Waitlist</h2>
            <div className="panel-header-right">
              <div className="wait-setter">
                {editingWait ? (
                  <>
                    <span className="wait-setter__label">⏱</span>
                    <input
                      className="wait-setter__input"
                      type="number" min="0" max="180"
                      value={waitInput}
                      autoFocus
                      onChange={e => setWaitInput(e.target.value)}
                      onBlur={saveWait}
                      onKeyDown={e => { if (e.key === 'Enter') saveWait(); if (e.key === 'Escape') setEditingWait(false); }}
                    />
                    <span className="wait-setter__unit">min</span>
                  </>
                ) : (
                  <button className="wait-setter__btn btn-ghost btn-ghost--sm" onClick={startEditWait}
                    title="Tap to set estimated wait time">
                    ⏱ ~{settings.estimatedWait}m
                  </button>
                )}
              </div>
              <button
                className="btn-ghost btn-ghost--sm add-guest-btn"
                onClick={() => setShowAddGuest(true)}
              >
                + Add Guest
              </button>
              <a href="/" target="_blank" className="btn-ghost btn-ghost--sm">+ Self check-in ↗</a>
            </div>
          </div>

          {activeWaitlist.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon">🎉</span>
              <p>No guests waiting right now!</p>
            </div>
          ) : (
            <div className="waitlist-list">
              {activeWaitlist.map(g => (
                <GuestCard
                  key={g.id}
                  guest={g}
                  position={waitPosition(g)}
                  onNotify={handleNotify}
                  onSeat={handleStartSeat}
                  onCancel={handleCancel}
                  onTag={setTagGuest}
                />
              ))}
            </div>
          )}

          {seatedToday > 0 && (
            <details className="seated-history">
              <summary>Seated today ({seatedToday})</summary>
              {waitlist
                .filter(g => g.status === 'seated')
                .sort((a, b) => b.seatedAt - a.seatedAt)
                .map(g => (
                  <div key={g.id} className="history-row">
                    <span>{g.name} ×{g.partySize}</span>
                    <span className="history-time">{elapsed(g.seatedAt)} ago</span>
                  </div>
                ))}
            </details>
          )}
        </section>

        {/* ── Tables panel ── */}
        <section className={`staff-panel tables-panel ${activeTab === 'tables' ? 'staff-panel--active' : ''}`}>
          <div className="panel-header">
            <h2 className="panel-title">
              {visibleTableCount} Tables
              <span className="panel-title-sub">{readyCount} available</span>
            </h2>
            <div className="panel-header-right">
              {!manageMode && (
                <button
                  className={`btn-ghost btn-ghost--sm ${combineMode ? 'btn-ghost--active' : ''}`}
                  onClick={handleToggleCombineMode}
                >
                  {combineMode ? '✕ Cancel' : '⛓ Combine'}
                </button>
              )}
              <button
                className={`btn-ghost btn-ghost--sm ${manageMode ? 'btn-ghost--active' : ''}`}
                onClick={handleToggleManageMode}
              >
                {manageMode ? '✕ Done' : '⚙ Manage'}
              </button>
              {!combineMode && !manageMode && (
                <div className="legend">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <span key={k} className="legend-item" style={{ color: v.color }}>
                      {v.icon} {v.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Waiter workload chips */}
          {activeWaiters.length > 0 && !seatGuest && !combineMode && !manageMode && (
            <div className="waiter-chips">
              {activeWaiters
                .slice()
                .sort((a, b) => (waiterWorkload[b.id] || 0) - (waiterWorkload[a.id] || 0))
                .map(w => {
                  const cnt = waiterWorkload[w.id] || 0;
                  return (
                    <span
                      key={w.id}
                      className="waiter-chip"
                      style={{ borderColor: w.color, color: w.color }}
                    >
                      <span className="waiter-chip__dot" style={{ background: w.color }} />
                      {w.name}
                      <span className="waiter-chip__count">{cnt}</span>
                    </span>
                  );
                })}
            </div>
          )}

          {sectionOrder.map(sectionKey => {
            const meta          = SECTIONS[sectionKey] || { label: sectionKey, icon: '📍' };
            const sectionTables = tablesBySection[sectionKey];
            const sectionReady  = sectionTables.filter(t => t.status === 'ready').length;
            return (
              <div key={sectionKey} className="section-block">
                <div className="section-header">
                  <span className="section-icon">{meta.icon}</span>
                  <span className="section-label">{meta.label}</span>
                  <span className="section-count">{sectionReady}/{sectionTables.length} available</span>
                </div>
                <div className="tables-grid">
                  {sectionTables.map(tbl => (
                    <TableCard
                      key={tbl.id}
                      table={tbl}
                      seatMode={!!seatGuest}
                      combineMode={combineMode}
                      manageMode={manageMode}
                      isSelected={selectedForCombine.has(tbl.id)}
                      onPress={setSheetTable}
                      onSeatSelect={handleSeatAtTable}
                      onCombineToggle={handleCombineToggle}
                      onSplit={handleSplit}
                      onEdit={handleEditTable}
                      onDelete={handleDeleteTable}
                      now={now}
                      waiterColor={tbl.waiterId ? waiterMap[tbl.waiterId]?.color : null}
                      waiterName={tbl.waiterId ? waiterMap[tbl.waiterId]?.name : null}
                      onReassignWaiter={!seatGuest && !combineMode ? setReassignTable : null}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {manageMode && (
            <div style={{ padding: '12px 0' }}>
              <button
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={() => setTableModal('new')}
              >
                + Add Table
              </button>
            </div>
          )}

          {combineMode && selectedForCombine.size >= 2 && (
            <div className="combine-bar">
              <div className="combine-bar__info">
                <span className="combine-bar__count">{selectedForCombine.size} tables selected</span>
                <span className="combine-bar__cap">👥 {combineCapacity} seats total</span>
              </div>
              <button className="combine-bar__btn" onClick={handleCombine}>⛓ Combine Tables</button>
            </div>
          )}

          {combineMode && selectedForCombine.size < 2 && (
            <p className="tables-hint">Tap 2 or more ready tables to combine them</p>
          )}
          {!combineMode && !seatGuest && !manageMode && (
            <p className="tables-hint">Tap any table to change its status</p>
          )}
          {manageMode && (
            <p className="tables-hint">Tap ✏️ to edit or 🗑 to delete a table</p>
          )}
        </section>

        {/* ── Waiters panel ── */}
        <section className={`staff-panel waiters-wrapper ${activeTab === 'waiters' ? 'staff-panel--active' : ''}`}>
          {activeTab === 'waiters' && (
            <WaiterManagementPanel
              api={api}
              waiters={restaurantState.waiters || []}
              waiterWorkload={waiterWorkload}
              waitlist={restaurantState.waitlist || []}
              onShowToast={showToast}
            />
          )}
        </section>

        {/* ── Reports panel ── */}
        <section className={`staff-panel reports-wrapper ${activeTab === 'reports' ? 'staff-panel--active' : ''}`}>
          <div className="panel-header">
            <h2 className="panel-title">Today's Report</h2>
          </div>
          {activeTab === 'reports' && (
            <ReportsPanel
              api={api}
              waiters={restaurantState.waiters || []}
            />
          )}
        </section>

      </div>

      {/* ── Mobile-only fixed bottom bar: End Shift + Logout ── */}
      <div className="mobile-action-bar">
        <button
          className="mobile-action-bar__btn mobile-action-bar__btn--danger"
          onClick={() => setShowShiftClose(true)}
          disabled={shiftClosing}
        >
          🔒 End Shift
        </button>
        <button
          className="mobile-action-bar__btn"
          onClick={handleLogout}
          disabled={logoutPending}
        >
          {logoutPending ? '…' : '⎋ Logout'}
        </button>
      </div>

    </div>
  );
}
