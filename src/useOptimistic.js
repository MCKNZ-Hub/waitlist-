import { useState, useEffect, useMemo } from 'react';

/**
 * Merges WebSocket server state with local optimistic overrides so every
 * button tap feels instant. Overrides are cleared automatically once the
 * incoming WS state confirms (or contradicts) them.
 *
 * Usage:
 *   const { tables, waitlist, patchTable, patchGuest, hideGuest, revert } =
 *     useOptimistic(restaurantState);
 */
export function useOptimistic(wsState) {
  const [tablePatches, setTablePatches]   = useState({});   // id → partial table
  const [guestPatches, setGuestPatches]   = useState({});   // id → partial guest
  const [hiddenGuests, setHiddenGuests]   = useState(new Set()); // ids hidden optimistically

  // Auto-clear overrides when WS state catches up
  useEffect(() => {
    setTablePatches((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, patch] of Object.entries(next)) {
        const live = wsState.tables.find((t) => t.id === id);
        // Clear if WS agrees with our patch (confirmed) or patch is stale (>3 s)
        if (!live || live.status === patch.status || Date.now() > patch._exp) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setGuestPatches((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, patch] of Object.entries(next)) {
        const live = wsState.waitlist.find((g) => g.id === id);
        if (!live || live.status === patch.status || Date.now() > patch._exp) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setHiddenGuests((prev) => {
      const confirmed = new Set(prev);
      for (const id of prev) {
        if (!wsState.waitlist.find((g) => g.id === id)) confirmed.delete(id);
      }
      return confirmed.size !== prev.size ? confirmed : prev;
    });
  }, [wsState]);

  // Derived state: WS truth + optimistic overlay
  const tables = useMemo(
    () => wsState.tables.map((t) => ({ ...t, ...(tablePatches[t.id] || {}) })),
    [wsState.tables, tablePatches]
  );

  const waitlist = useMemo(
    () =>
      wsState.waitlist
        .filter((g) => !hiddenGuests.has(g.id))
        .map((g) => ({ ...g, ...(guestPatches[g.id] || {}) })),
    [wsState.waitlist, guestPatches, hiddenGuests]
  );

  function patchTable(id, patch) {
    setTablePatches((p) => ({ ...p, [id]: { ...patch, _exp: Date.now() + 4000 } }));
  }

  function patchGuest(id, patch) {
    setGuestPatches((p) => ({ ...p, [id]: { ...patch, _exp: Date.now() + 4000 } }));
  }

  function hideGuest(id) {
    setHiddenGuests((p) => new Set([...p, id]));
  }

  // Revert a single entity on API error
  function revertTable(id) {
    setTablePatches((p) => { const n = { ...p }; delete n[id]; return n; });
  }
  function revertGuest(id) {
    setGuestPatches((p) => { const n = { ...p }; delete n[id]; return n; });
    setHiddenGuests((p) => { const n = new Set(p); n.delete(id); return n; });
  }

  return { tables, waitlist, patchTable, patchGuest, hideGuest, revertTable, revertGuest };
}
