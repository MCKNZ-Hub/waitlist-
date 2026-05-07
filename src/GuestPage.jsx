import { useState, useEffect } from 'react';
import { useRestaurantState } from './useRestaurantState.js';
import { TalaveraBand, TalaveraDivider } from './Talavera.jsx';

/* ── Cibolo Creek oval logo mark ── */
function CiboloCreekOval() {
  return (
    <svg width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="22" cy="15" rx="21" ry="14" fill="#1F450D" stroke="#3a6b28" strokeWidth="1"/>
      <text x="22" y="11" textAnchor="middle" fill="#F9F2EA" fontSize="5.5" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif" letterSpacing="0.5">CIBOLO</text>
      <text x="22" y="17" textAnchor="middle" fill="#F9F2EA" fontSize="3.8" fontWeight="500" fontFamily="'Inter', sans-serif" letterSpacing="1.2">CREEK</text>
      <text x="22" y="23" textAnchor="middle" fill="rgba(249,242,234,.65)" fontSize="3" fontFamily="'Inter', sans-serif" letterSpacing="0.8">BULVERDE, TX</text>
    </svg>
  );
}

function elapsed(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m === 1) return '1 min ago';
  return `${m} min ago`;
}

export default function GuestPage() {
  const { restaurantState, notification, setNotification, connected, api } = useRestaurantState();

  const [step, setStep] = useState('form'); // form | confirmed
  const [myEntry, setMyEntry] = useState(null);
  const [form, setForm] = useState({ name: '', partySize: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Keep myEntry in sync with live waitlist state
  useEffect(() => {
    if (!myEntry) return;
    const updated = restaurantState.waitlist.find((g) => g.id === myEntry.id);
    if (updated) setMyEntry(updated);
  }, [restaurantState.waitlist, myEntry?.id]);

  const liveEntry = myEntry
    ? restaurantState.waitlist.find((g) => g.id === myEntry.id)
    : null;

  const isNotified =
    notification?.guestId === myEntry?.id || liveEntry?.status === 'notified';

  const waitingAhead = liveEntry
    ? restaurantState.waitlist.filter(
        (g) => g.status === 'waiting' && g.joinedAt < liveEntry.joinedAt
      ).length
    : 0;

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Please enter your name.';
    const size = parseInt(form.partySize, 10);
    if (!size || size < 1 || size > 20) e.partySize = 'Select a party size.';
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required — we use it to send you an SMS when your table is ready.';
    } else if (form.phone.replace(/\D/g, '').length < 10) {
      e.phone = 'Enter a valid phone number (at least 10 digits).';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) return setErrors(e2);

    setLoading(true);
    setErrors({});
    try {
      const entry = await api.joinWaitlist(form.name, form.partySize, form.phone);
      if (entry.error) throw new Error(entry.error);
      setMyEntry(entry);
      setStep('confirmed');
    } catch {
      setErrors({ submit: 'Could not join the waitlist. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('form');
    setMyEntry(null);
    setNotification(null);
    setForm({ name: '', partySize: '', phone: '' });
    setErrors({});
  }

  return (
    <div className="guest-page">
      <header className="guest-header">
        <div className="guest-logo">
          <CiboloCreekOval />
          <div>
            <span className="logo-text">Cibolo Creek</span>
            <span className="logo-sub">Eatery &amp; Venue</span>
          </div>
        </div>
        <div
          className={`conn-dot ${connected ? 'conn-dot--on' : 'conn-dot--off'}`}
          title={connected ? 'Live' : 'Reconnecting…'}
        />
      </header>

      <main className="guest-main">

        {step === 'form' ? (
          <div className="guest-card">
            <div className="guest-card__hero">
              <div className="guest-card__talavera">
                <TalaveraBand />
              </div>
              <h1 className="guest-card__title">Join the Waitlist</h1>
              <p className="guest-card__sub">
                We'll text you the moment your table is ready.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="guest-form">
              {/* Name */}
              <div className="field">
                <label className="field__label" htmlFor="name">Your Name</label>
                <input
                  id="name"
                  className={`field__input ${errors.name ? 'field__input--error' : ''}`}
                  type="text"
                  placeholder="e.g. Maria Garcia"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  maxLength={60}
                />
                {errors.name && <p className="field__error">{errors.name}</p>}
              </div>

              {/* Party size */}
              <div className="field">
                <label className="field__label">Party Size</label>
                <div className="party-size-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`party-btn ${form.partySize == n ? 'party-btn--active' : ''}`}
                      onClick={() => setForm({ ...form, partySize: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  className={`field__input ${errors.partySize ? 'field__input--error' : ''}`}
                  type="number"
                  placeholder="Or enter a number (9+)"
                  min="9"
                  max="20"
                  value={[1,2,3,4,5,6,7,8].includes(Number(form.partySize)) ? '' : form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: e.target.value })}
                  style={{ marginTop: '8px' }}
                />
                {errors.partySize && <p className="field__error">{errors.partySize}</p>}
              </div>

              {/* Phone — required */}
              <div className="field">
                <label className="field__label" htmlFor="phone">
                  Mobile Number <span className="field__required">required</span>
                </label>
                <div className="phone-input-wrap">
                  <span className="phone-prefix">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                      <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                  </span>
                  <input
                    id="phone"
                    className={`field__input field__input--phone ${errors.phone ? 'field__input--error' : ''}`}
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </div>
                {errors.phone
                  ? <p className="field__error">{errors.phone}</p>
                  : <p className="field__hint">We'll send one SMS when your table is ready — no spam.</p>
                }
              </div>

              {errors.submit && <p className="field__error">{errors.submit}</p>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Adding you…' : 'Join Waitlist'}
              </button>
            </form>
          </div>
        ) : (
          /* ── Confirmed state ── */
          <div className="guest-card confirmed-card">
            {isNotified && (
              <div className="notify-banner" onClick={() => setNotification(null)}>
                <span className="notify-banner__emoji">🎉</span>
                <div>
                  <p className="notify-banner__title">Your table is ready!</p>
                  <p className="notify-banner__sub">
                    Please head to the host stand — we'll seat you right away.
                  </p>
                </div>
              </div>
            )}
            <div style={{ fontSize: '2.5rem', marginTop: 8 }}>👋</div>
            <h2 className="confirmed-title">You're on the list!</h2>
            <p className="confirmed-name">{liveEntry?.name ?? myEntry?.name}</p>

            <div className="confirmed-stats">
              <div className="stat-box">
                <span className="stat-box__num">{liveEntry?.partySize ?? myEntry?.partySize}</span>
                <span className="stat-box__label">Guests</span>
              </div>
              <div className="stat-box">
                <span className="stat-box__num">{waitingAhead + 1}</span>
                <span className="stat-box__label">Position</span>
              </div>
              <div className="stat-box">
                <span className="stat-box__num">{waitingAhead * 15 + 5}m</span>
                <span className="stat-box__label">Est. wait</span>
              </div>
            </div>

            <div style={{ margin: '8px auto 4px', width: '100%', maxWidth: 260 }}>
              <TalaveraDivider width={260} />
            </div>

            {/* Status pill */}
            {liveEntry?.status === 'waiting' && (
              <div className="status-pill status-pill--waiting">
                <span className="pulse-dot" /> Waiting for a table
              </div>
            )}
            {(liveEntry?.status === 'notified' || isNotified) && (
              <div className="status-pill status-pill--ready">
                🎉 Your table is ready — please head to the host stand!
              </div>
            )}
            {liveEntry?.status === 'seated' && (
              <div className="status-pill status-pill--seated">
                ✅ Seated — enjoy your meal!
              </div>
            )}

            {/* SMS confirmation */}
            <div className="sms-badge">
              <span>📱</span>
              <span>
                We'll text <strong>{liveEntry?.phone ?? myEntry?.phone}</strong> when your table is ready.
              </span>
            </div>

            <p className="confirmed-hint">
              You can close this page — the SMS will reach you regardless.
            </p>

            <button className="btn-ghost" onClick={reset}>← Start over</button>
          </div>
        )}

        {step === 'form' && (
          <div className="wait-info">
            <span>⏱</span>
            <span>
              {restaurantState.waitlist.filter((g) => g.status === 'waiting').length} parties waiting ·{' '}
              {restaurantState.tables.filter((t) => t.status === 'ready').length} tables available
              {restaurantState.settings?.estimatedWait > 0 && (
                <> · <strong>~{restaurantState.settings.estimatedWait} min wait</strong></>
              )}
            </span>
          </div>
        )}
      </main>

    </div>
  );
}
