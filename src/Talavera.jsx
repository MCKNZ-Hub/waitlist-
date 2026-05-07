/* Talavera Poblana — decorative SVG components
   All motifs in brand blue #2B5672 on cream #F9F2EA
   Inspired by traditional Talavera ceramics from Puebla, MX
*/

export function TalaveraCornerLeft({ opacity = 1 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 140 100"
      fill="none"
      style={{ display: 'block', opacity }}
      aria-hidden="true"
    >
      {/* Main curved stem */}
      <path d="M6 92 C 28 68 58 48 118 14" stroke="#2B5672" strokeWidth="1.6" strokeLinecap="round" fill="none"/>

      {/* Leaf 1 — lower left */}
      <path d="M32 70 C 18 55 14 40 24 30 C 30 42 34 57 32 70 Z" fill="#2B5672"/>
      <path d="M32 70 C 46 55 46 38 24 30" stroke="#2B5672" strokeWidth="0.7" fill="none" strokeLinecap="round"/>

      {/* Leaf 2 — mid */}
      <path d="M62 48 C 48 34 46 20 58 12 C 62 24 66 37 62 48 Z" fill="#2B5672"/>
      <path d="M62 48 C 76 34 76 18 58 12" stroke="#2B5672" strokeWidth="0.7" fill="none" strokeLinecap="round"/>

      {/* Small side sprig lower */}
      <path d="M18 80 C 8 68 6 56 12 46" stroke="#2B5672" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M12 46 C 6 38 14 30 20 38 C 18 40 12 44 12 46 Z" fill="#2B5672"/>

      {/* Small side sprig upper */}
      <path d="M88 30 C 82 20 86 10 94 14" stroke="#2B5672" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M94 14 C 100 8 108 14 102 22 C 98 18 94 16 94 14 Z" fill="#2B5672"/>

      {/* Flower at tip */}
      <circle cx="118" cy="14" r="5" fill="#2B5672"/>
      <circle cx="111" cy="8"  r="3" fill="#2B5672"/>
      <circle cx="125" cy="8"  r="3" fill="#2B5672"/>
      <circle cx="125" cy="20" r="3" fill="#2B5672"/>
      <circle cx="111" cy="20" r="3" fill="#2B5672"/>
      <circle cx="118" cy="14" r="2" fill="#F9F2EA"/>

      {/* Curly tendrils */}
      <path d="M46 58 C 54 46 55 34 48 26" stroke="#2B5672" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
      <path d="M78 36 C 86 26 87 15 80 9"  stroke="#2B5672" strokeWidth="0.9" strokeLinecap="round" fill="none"/>

      {/* Small berries */}
      <circle cx="50" cy="24" r="2"  fill="#2B5672"/>
      <circle cx="44" cy="20" r="1.5" fill="#2B5672"/>
      <circle cx="56" cy="21" r="1.5" fill="#2B5672"/>
    </svg>
  );
}

export function TalaveraCornerRight({ opacity = 1 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 140 100"
      fill="none"
      style={{ display: 'block', opacity, transform: 'scaleX(-1)' }}
      aria-hidden="true"
    >
      <path d="M6 92 C 28 68 58 48 118 14" stroke="#2B5672" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M32 70 C 18 55 14 40 24 30 C 30 42 34 57 32 70 Z" fill="#2B5672"/>
      <path d="M32 70 C 46 55 46 38 24 30" stroke="#2B5672" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
      <path d="M62 48 C 48 34 46 20 58 12 C 62 24 66 37 62 48 Z" fill="#2B5672"/>
      <path d="M62 48 C 76 34 76 18 58 12" stroke="#2B5672" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
      <path d="M18 80 C 8 68 6 56 12 46" stroke="#2B5672" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M12 46 C 6 38 14 30 20 38 C 18 40 12 44 12 46 Z" fill="#2B5672"/>
      <path d="M88 30 C 82 20 86 10 94 14" stroke="#2B5672" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M94 14 C 100 8 108 14 102 22 C 98 18 94 16 94 14 Z" fill="#2B5672"/>
      <circle cx="118" cy="14" r="5" fill="#2B5672"/>
      <circle cx="111" cy="8"  r="3" fill="#2B5672"/>
      <circle cx="125" cy="8"  r="3" fill="#2B5672"/>
      <circle cx="125" cy="20" r="3" fill="#2B5672"/>
      <circle cx="111" cy="20" r="3" fill="#2B5672"/>
      <circle cx="118" cy="14" r="2" fill="#F9F2EA"/>
      <path d="M46 58 C 54 46 55 34 48 26" stroke="#2B5672" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
      <path d="M78 36 C 86 26 87 15 80 9"  stroke="#2B5672" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
      <circle cx="50" cy="24" r="2"   fill="#2B5672"/>
      <circle cx="44" cy="20" r="1.5" fill="#2B5672"/>
      <circle cx="56" cy="21" r="1.5" fill="#2B5672"/>
    </svg>
  );
}

export function TalaveraDivider({ width = 280 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} 28`}
      fill="none"
      style={{ display: 'block', width: '100%', maxWidth: width }}
      aria-hidden="true"
    >
      {/* Lines */}
      <line x1="0"           y1="14" x2={width/2 - 22} y2="14" stroke="#2B5672" strokeWidth="0.8" strokeOpacity="0.45"/>
      <line x1={width/2 + 22} y1="14" x2={width}        y2="14" stroke="#2B5672" strokeWidth="0.8" strokeOpacity="0.45"/>

      {/* Center flower */}
      <circle cx={width/2}     cy="14" r="5"   fill="#2B5672"/>
      <circle cx={width/2 - 8} cy="7"  r="3"   fill="#2B5672"/>
      <circle cx={width/2 + 8} cy="7"  r="3"   fill="#2B5672"/>
      <circle cx={width/2 + 8} cy="21" r="3"   fill="#2B5672"/>
      <circle cx={width/2 - 8} cy="21" r="3"   fill="#2B5672"/>
      <circle cx={width/2}     cy="14" r="2.2" fill="#F9F2EA"/>

      {/* Left leaves */}
      <ellipse cx={width/2 - 22} cy="13" rx="8"  ry="3.2" fill="#2B5672" transform={`rotate(-18 ${width/2-22} 13)`}/>
      <ellipse cx={width/2 - 36} cy="11" rx="6.5" ry="2.8" fill="#2B5672" transform={`rotate(-12 ${width/2-36} 11)`}/>

      {/* Right leaves (mirrored) */}
      <ellipse cx={width/2 + 22} cy="13" rx="8"  ry="3.2" fill="#2B5672" transform={`rotate(18 ${width/2+22} 13)`}/>
      <ellipse cx={width/2 + 36} cy="11" rx="6.5" ry="2.8" fill="#2B5672" transform={`rotate(12 ${width/2+36} 11)`}/>
    </svg>
  );
}

/* Full-width botanical header band — used at top of guest page hero */
export function TalaveraBand() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 56"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      style={{ display: 'block', width: '100%' }}
      aria-hidden="true"
    >
      {/* ── Left spray ── */}
      <path d="M4 50 C 20 36 42 24 72 10" stroke="#2B5672" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M26 38 C 15 26 12 14 22 8 C 26 18 28 29 26 38 Z" fill="#2B5672"/>
      <path d="M26 38 C 38 26 38 12 22 8" stroke="#2B5672" strokeWidth="0.6" fill="none"/>
      <path d="M52 22 C 42 12 42 2 52 -2 C 54 8 55 16 52 22 Z" fill="#2B5672"/>
      <path d="M52 22 C 62 12 62 0 52 -2" stroke="#2B5672" strokeWidth="0.6" fill="none"/>
      <circle cx="72" cy="10" r="4"   fill="#2B5672"/>
      <circle cx="66" cy="5"  r="2.4" fill="#2B5672"/>
      <circle cx="78" cy="5"  r="2.4" fill="#2B5672"/>
      <circle cx="78" cy="15" r="2.4" fill="#2B5672"/>
      <circle cx="66" cy="15" r="2.4" fill="#2B5672"/>
      <circle cx="72" cy="10" r="1.6" fill="#F9F2EA"/>
      <path d="M36 28 C 42 20 44 10 38 4"  stroke="#2B5672" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      <circle cx="38"  cy="4"  r="1.8" fill="#2B5672"/>
      <circle cx="34"  cy="2"  r="1.2" fill="#2B5672"/>
      <circle cx="42"  cy="2"  r="1.2" fill="#2B5672"/>

      {/* ── Right spray (mirrored) ── */}
      <path d="M356 50 C 340 36 318 24 288 10" stroke="#2B5672" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M334 38 C 345 26 348 14 338 8 C 334 18 332 29 334 38 Z" fill="#2B5672"/>
      <path d="M334 38 C 322 26 322 12 338 8" stroke="#2B5672" strokeWidth="0.6" fill="none"/>
      <path d="M308 22 C 318 12 318 2 308 -2 C 306 8 305 16 308 22 Z" fill="#2B5672"/>
      <path d="M308 22 C 298 12 298 0 308 -2" stroke="#2B5672" strokeWidth="0.6" fill="none"/>
      <circle cx="288" cy="10" r="4"   fill="#2B5672"/>
      <circle cx="294" cy="5"  r="2.4" fill="#2B5672"/>
      <circle cx="282" cy="5"  r="2.4" fill="#2B5672"/>
      <circle cx="282" cy="15" r="2.4" fill="#2B5672"/>
      <circle cx="294" cy="15" r="2.4" fill="#2B5672"/>
      <circle cx="288" cy="10" r="1.6" fill="#F9F2EA"/>
      <path d="M324 28 C 318 20 316 10 322 4"  stroke="#2B5672" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      <circle cx="322" cy="4"  r="1.8" fill="#2B5672"/>
      <circle cx="326" cy="2"  r="1.2" fill="#2B5672"/>
      <circle cx="318" cy="2"  r="1.2" fill="#2B5672"/>

      {/* ── Center motif ── */}
      <circle cx="180" cy="8"  r="5.5" fill="#2B5672"/>
      <circle cx="171" cy="2"  r="3.2" fill="#2B5672"/>
      <circle cx="189" cy="2"  r="3.2" fill="#2B5672"/>
      <circle cx="189" cy="14" r="3.2" fill="#2B5672"/>
      <circle cx="171" cy="14" r="3.2" fill="#2B5672"/>
      <circle cx="180" cy="8"  r="2.2" fill="#F9F2EA"/>
      <ellipse cx="162" cy="8"  rx="9" ry="3.5" fill="#2B5672" transform="rotate(-10 162 8)"/>
      <ellipse cx="198" cy="8"  rx="9" ry="3.5" fill="#2B5672" transform="rotate(10 198 8)"/>
      <ellipse cx="148" cy="6"  rx="7" ry="3"   fill="#2B5672" transform="rotate(-6 148 6)"/>
      <ellipse cx="212" cy="6"  rx="7" ry="3"   fill="#2B5672" transform="rotate(6 212 6)"/>
    </svg>
  );
}
