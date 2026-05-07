import { useState } from 'react';
import { TalaveraCornerLeft, TalaveraCornerRight } from './Talavera.jsx';

function CiboloCreekOvalWhite() {
  return (
    <svg width="52" height="35" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="22" cy="15" rx="21" ry="14" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
      <text x="22" y="11" textAnchor="middle" fill="#F9F2EA" fontSize="5.5" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif" letterSpacing="0.5">CIBOLO</text>
      <text x="22" y="17" textAnchor="middle" fill="#F9F2EA" fontSize="3.8" fontWeight="500" fontFamily="'Inter', sans-serif" letterSpacing="1.2">CREEK</text>
      <text x="22" y="23" textAnchor="middle" fill="rgba(249,242,234,.5)" fontSize="3" fontFamily="'Inter', sans-serif" letterSpacing="0.8">BULVERDE, TX</text>
    </svg>
  );
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function StaffLogin({ onSuccess }) {
  const [pin,     setPin]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function press(key) {
    if (loading) return;
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) submit(next);
  }

  async function submit(p) {
    setLoading(true);
    try {
      const res  = await fetch('/api/staff/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin: p }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('staffToken', data.token);
        onSuccess(data.token);
      } else {
        setError('Incorrect PIN — try again');
        setPin('');
      }
    } catch {
      setError('Connection error — please try again');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pin-page">
      {/* Talavera corner decorations */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: 160, pointerEvents: 'none', opacity: .55 }}>
        <TalaveraCornerLeft />
      </div>
      <div style={{ position: 'fixed', top: 0, right: 0, width: 160, pointerEvents: 'none', opacity: .55 }}>
        <TalaveraCornerRight />
      </div>

      <div className="pin-card">
        <div className="pin-logo">
          <CiboloCreekOvalWhite />
          <div>
            <span className="logo-text" style={{ color: '#fff', fontSize: '1.1rem' }}>Cibolo Creek</span>
            <span className="logo-sub" style={{ color: 'rgba(249,242,234,.65)', display: 'block', fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 1 }}>Eatery &amp; Venue</span>
          </div>
        </div>

        <h2 className="pin-title">Staff Access</h2>
        <p className="pin-sub">Enter your 4-digit PIN to continue</p>

        <div className="pin-dots">
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={[
                'pin-dot',
                i < pin.length ? 'pin-dot--filled'   : '',
                loading        ? 'pin-dot--loading'  : '',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>

        {error && <p className="pin-error">{error}</p>}

        <div className={`pin-pad ${loading ? 'pin-pad--disabled' : ''}`}>
          {KEYS.map((k, i) =>
            k === '' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                className={`pin-key ${k === '⌫' ? 'pin-key--back' : ''}`}
                onClick={() => press(k)}
                disabled={loading}
                aria-label={k === '⌫' ? 'Backspace' : k}
              >
                {k}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
