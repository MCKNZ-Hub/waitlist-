import { useState, useEffect, useRef, useCallback } from 'react';

const WS = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'bypass-tunnel-reminder': 'true',
};

function makeHeaders(token) {
  const h = { ...BASE_HEADERS };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// Module-level callback so apiFetch can signal session expiry without prop drilling
let _onExpired = null;

async function apiFetch(url, options = {}, token = null) {
  const res = await fetch(url, {
    ...options,
    headers: { ...makeHeaders(token), ...options.headers },
  });
  if (res.status === 401) {
    _onExpired?.();
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function useRestaurantState(token = null, onExpired = null) {
  // Keep the module-level callback in sync with the latest prop
  useEffect(() => {
    _onExpired = onExpired;
    return () => { _onExpired = null; };
  }, [onExpired]);
  const [restaurantState, setRestaurantState] = useState({ tables: [], waitlist: [], settings: {} });
  const [notification, setNotification]       = useState(null);
  const [connected, setConnected]             = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let destroyed = false;
    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(WS);
      wsRef.current = ws;
      ws.onopen  = () => !destroyed && setConnected(true);
      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        setTimeout(connect, 2500);
      };
      ws.onerror   = () => ws.close();
      ws.onmessage = (e) => {
        if (destroyed) return;
        const msg = JSON.parse(e.data);
        if (msg.type === 'state')        setRestaurantState(msg.data);
        if (msg.type === 'notification') setNotification({ guestId: msg.guestId, guestName: msg.guestName, at: Date.now() });
      };
    }
    connect();
    return () => { destroyed = true; wsRef.current?.close(); };
  }, []);

  const api = {
    // ── Public ────────────────────────────────────────────────────────────────
    joinWaitlist: useCallback((name, partySize, phone) =>
      apiFetch('/api/waitlist', { method: 'POST', body: JSON.stringify({ name, partySize, phone }) }), []),

    // ── Staff ─────────────────────────────────────────────────────────────────
    logout: useCallback(() =>
      apiFetch('/api/staff/logout', { method: 'POST' }, token), [token]),

    updateTableStatus: useCallback((tableId, status) =>
      apiFetch(`/api/tables/${tableId}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token), [token]),

    notifyGuest: useCallback((guestId) =>
      apiFetch(`/api/notify/${guestId}`, { method: 'POST' }, token), [token]),

    seatGuest: useCallback((waitlistId, tableId, waiterId = null) =>
      apiFetch('/api/seat', { method: 'POST', body: JSON.stringify({ waitlistId, tableId, waiterId }) }, token), [token]),

    removeGuest: useCallback((id) =>
      apiFetch(`/api/waitlist/${id}`, { method: 'DELETE' }, token), [token]),

    combineTables: useCallback((tableIds) =>
      apiFetch('/api/tables/combine', { method: 'POST', body: JSON.stringify({ tableIds }) }, token), [token]),

    splitTable: useCallback((tableId) =>
      apiFetch(`/api/tables/${tableId}/split`, { method: 'POST' }, token), [token]),

    updateSettings: useCallback((settings) =>
      apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) }, token), [token]),

    // ── Table management ──────────────────────────────────────────────────────
    createTable: useCallback((number, capacity, section) =>
      apiFetch('/api/tables', { method: 'POST', body: JSON.stringify({ number, capacity, section }) }, token), [token]),

    reassignWaiter: useCallback((tableId, waiterId) =>
      apiFetch(`/api/tables/${tableId}/waiter`, { method: 'PATCH', body: JSON.stringify({ waiterId }) }, token), [token]),

    updateTableConfig: useCallback((tableId, { number, capacity, section }) =>
      apiFetch(`/api/tables/${tableId}/config`, { method: 'PATCH', body: JSON.stringify({ number, capacity, section }) }, token), [token]),

    deleteTable: useCallback((tableId) =>
      apiFetch(`/api/tables/${tableId}`, { method: 'DELETE' }, token), [token]),

    // ── Waiters ───────────────────────────────────────────────────────────────
    addWaiter: useCallback((name, color) =>
      apiFetch('/api/waiters', { method: 'POST', body: JSON.stringify({ name, color }) }, token), [token]),

    updateWaiter: useCallback((id, changes) =>
      apiFetch(`/api/waiters/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }, token), [token]),

    deleteWaiter: useCallback((id) =>
      apiFetch(`/api/waiters/${id}`, { method: 'DELETE' }, token), [token]),

    // ── Guest tags ────────────────────────────────────────────────────────────
    updateGuestTags: useCallback((guestId, tags) =>
      apiFetch(`/api/waitlist/${guestId}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }, token), [token]),

    // ── Guest history ─────────────────────────────────────────────────────────
    getGuestHistory: useCallback((phone) =>
      apiFetch(`/api/history/${encodeURIComponent(phone)}`, {}, token), [token]),

    updateHistoryNotes: useCallback((phone, notes) =>
      apiFetch(`/api/history/${encodeURIComponent(phone)}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }, token), [token]),

    // ── Shift ─────────────────────────────────────────────────────────────────
    closeShift: useCallback(() =>
      apiFetch('/api/shift/close', { method: 'POST' }, token), [token]),

    getShiftLogs: useCallback(() =>
      apiFetch('/api/shift/logs', {}, token), [token]),

    // ── Reports ───────────────────────────────────────────────────────────────
    getReports: useCallback((date) => {
      const url = date ? `/api/reports/today?date=${date}` : '/api/reports/today';
      return apiFetch(url, {}, token);
    }, [token]),
  };

  return { restaurantState, notification, setNotification, connected, api };
}
