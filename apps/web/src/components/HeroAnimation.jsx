/**
 * HeroAnimation — animated delivery scene for the PublicQuotePage hero fallback.
 *
 * Pure CSS keyframe animations. Zero external dependencies.
 * Renders at 45% opacity so the left-side marketing copy stays dominant.
 *
 * Brand tokens used:
 *   #F97316  — dropit-accent (orange)
 *   #0a0a1a  — dropit-950 (dark bg)
 *   #ffffff  — white accents
 */
export default function HeroAnimation() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ opacity: 0.45 }}
      aria-hidden="true"
    >
      <style>{`
        /* ── Truck drives right-to-left across the lower-right quadrant ── */
        @keyframes truck-drive {
          0%   { transform: translateX(120%); }
          100% { transform: translateX(-30%); }
        }
        /* ── Wheels spin clockwise ── */
        @keyframes wheel-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* ── Packages bob up and down with a gentle tilt ── */
        @keyframes pkg-float-a {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50%       { transform: translateY(-14px) rotate(4deg); }
        }
        @keyframes pkg-float-b {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50%       { transform: translateY(-10px) rotate(-6deg); }
        }
        @keyframes pkg-float-c {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-18px) rotate(2deg); }
        }
        /* ── Location pins pulse (scale + opacity) ── */
        @keyframes pin-pulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.25); opacity: 0.7; }
        }
        /* ── Dashed route line scrolls left to give motion sense ── */
        @keyframes route-scroll {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -60; }
        }
        /* ── Speed lines fade in and out ── */
        @keyframes speed-fade {
          0%, 100% { opacity: 0;   transform: scaleX(0.4); }
          40%, 60% { opacity: 0.8; transform: scaleX(1); }
        }
        /* ── Subtle glow pulse under the truck ── */
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.25; transform: scaleX(0.9); }
          50%       { opacity: 0.55; transform: scaleX(1.1); }
        }
        /* ── Grid dot pattern drifts leftward for parallax ── */
        @keyframes grid-drift {
          from { background-position: 0 0; }
          to   { background-position: -40px 0; }
        }

        .ha-truck     { will-change: transform; animation: truck-drive 7s linear infinite; }
        .ha-wheel     { will-change: transform; transform-origin: center; animation: wheel-spin 1.1s linear infinite; }
        .ha-pkg-a     { will-change: transform; animation: pkg-float-a 2.8s ease-in-out infinite; }
        .ha-pkg-b     { will-change: transform; animation: pkg-float-b 3.4s ease-in-out infinite 0.6s; }
        .ha-pkg-c     { will-change: transform; animation: pkg-float-c 3.1s ease-in-out infinite 1.1s; }
        .ha-pin-1     { will-change: transform; animation: pin-pulse 2s ease-in-out infinite; }
        .ha-pin-2     { will-change: transform; animation: pin-pulse 2s ease-in-out infinite 0.7s; }
        .ha-pin-3     { will-change: transform; animation: pin-pulse 2s ease-in-out infinite 1.4s; }
        .ha-route     { animation: route-scroll 1.8s linear infinite; }
        .ha-speed-1   { will-change: opacity, transform; transform-origin: right; animation: speed-fade 1.4s ease-in-out infinite; }
        .ha-speed-2   { will-change: opacity, transform; transform-origin: right; animation: speed-fade 1.4s ease-in-out infinite 0.25s; }
        .ha-speed-3   { will-change: opacity, transform; transform-origin: right; animation: speed-fade 1.4s ease-in-out infinite 0.5s; }
        .ha-glow      { will-change: opacity, transform; transform-origin: center; animation: glow-pulse 2.2s ease-in-out infinite; }
        .ha-grid      { animation: grid-drift 8s linear infinite; }
      `}</style>

      {/* ── Background dot grid (full hero) ─────────────────────────────────── */}
      <div
        className="ha-grid absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(249,115,22,0.18) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Ambient blobs ────────────────────────────────────────────────────── */}
      <div
        className="absolute right-0 top-1/4 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)" }}
      />

      {/* ── Scene SVG — route + pins + truck + packages ──────────────────────── */}
      {/*
          The SVG viewport is 800×400. It sits on the RIGHT half of the hero,
          pushed right so content starts roughly at center.
      */}
      <div
        className="absolute inset-y-0 right-0 flex items-center"
        style={{ width: "55%", minWidth: 340, paddingRight: "4%" }}
      >
        <svg
          viewBox="0 0 800 340"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto", overflow: "visible" }}
        >
          {/* ── Dashed route line ────────────────────────────────────────────── */}
          <line
            className="ha-route"
            x1="0" y1="210" x2="800" y2="210"
            stroke="#F97316"
            strokeWidth="2.5"
            strokeDasharray="18 10"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* ── Location pins along the route ──────────────────────────────── */}
          {/* Pin 1 */}
          <g className="ha-pin-1" transform="translate(140, 175)">
            <circle cx="0" cy="0" r="14" fill="rgba(249,115,22,0.15)" />
            <path
              d="M0,-9 C4,-9 7,-6 7,-2 C7,3 0,10 0,10 C0,10 -7,3 -7,-2 C-7,-6 -4,-9 0,-9 Z"
              fill="#F97316"
            />
            <circle cx="0" cy="-2" r="2.5" fill="white" />
          </g>

          {/* Pin 2 */}
          <g className="ha-pin-2" transform="translate(380, 175)">
            <circle cx="0" cy="0" r="14" fill="rgba(249,115,22,0.15)" />
            <path
              d="M0,-9 C4,-9 7,-6 7,-2 C7,3 0,10 0,10 C0,10 -7,3 -7,-2 C-7,-6 -4,-9 0,-9 Z"
              fill="#F97316"
            />
            <circle cx="0" cy="-2" r="2.5" fill="white" />
          </g>

          {/* Pin 3 */}
          <g className="ha-pin-3" transform="translate(640, 175)">
            <circle cx="0" cy="0" r="14" fill="rgba(249,115,22,0.15)" />
            <path
              d="M0,-9 C4,-9 7,-6 7,-2 C7,3 0,10 0,10 C0,10 -7,3 -7,-2 C-7,-6 -4,-9 0,-9 Z"
              fill="#F97316"
            />
            <circle cx="0" cy="-2" r="2.5" fill="white" />
          </g>

          {/* ── Floating packages (static in SVG; animated by CSS above) ────── */}
          {/* Package A — upper area */}
          <g className="ha-pkg-a" transform="translate(200, 105)">
            <rect x="-18" y="-15" width="36" height="30" rx="4" fill="#F97316" opacity="0.9" />
            <rect x="-18" y="-15" width="36" height="30" rx="4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            {/* Tape lines */}
            <line x1="-18" y1="0" x2="18" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="0" y1="-15" x2="0" y2="15" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          </g>

          {/* Package B — mid-right */}
          <g className="ha-pkg-b" transform="translate(590, 120)">
            <rect x="-14" y="-12" width="28" height="24" rx="3" fill="#ea580c" opacity="0.85" />
            <rect x="-14" y="-12" width="28" height="24" rx="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <line x1="-14" y1="0" x2="14" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="0" y1="-12" x2="0" y2="12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          </g>

          {/* Package C — lower left */}
          <g className="ha-pkg-c" transform="translate(700, 95)">
            <rect x="-20" y="-16" width="40" height="32" rx="4" fill="#c2410c" opacity="0.8" />
            <rect x="-20" y="-16" width="40" height="32" rx="4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <line x1="-20" y1="0" x2="20" y2="0" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <line x1="0" y1="-16" x2="0" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          </g>

          {/* ── Truck group — animates horizontally ─────────────────────────── */}
          <g className="ha-truck">

            {/* Glow beneath the truck */}
            <ellipse
              className="ha-glow"
              cx="310" cy="228"
              rx="95" ry="10"
              fill="#F97316"
              opacity="0.3"
            />

            {/* Speed lines (behind the cab) */}
            <rect className="ha-speed-1" x="80" y="185" width="60" height="3" rx="1.5" fill="#F97316" opacity="0.6" />
            <rect className="ha-speed-2" x="70" y="197" width="40" height="2.5" rx="1.25" fill="#F97316" opacity="0.45" />
            <rect className="ha-speed-3" x="85" y="209" width="52" height="2" rx="1" fill="#F97316" opacity="0.35" />

            {/* Cargo container body */}
            <rect x="155" y="163" width="140" height="55" rx="6" fill="white" opacity="0.95" />
            {/* Container ribs */}
            <line x1="195" y1="163" x2="195" y2="218" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="235" y1="163" x2="235" y2="218" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="275" y1="163" x2="275" y2="218" stroke="#e5e7eb" strokeWidth="1" />
            {/* "D" logotype on container */}
            <text
              x="178" y="198"
              fontSize="28"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              fill="#F97316"
            >D</text>

            {/* Cab body */}
            <rect x="295" y="175" width="75" height="43" rx="8" fill="#F97316" />
            {/* Cab roof slope */}
            <path d="M295,175 L330,158 L370,158 L370,175 Z" fill="#ea580c" />
            {/* Windshield */}
            <rect x="308" y="162" width="55" height="25" rx="4" fill="rgba(180,220,255,0.5)" />
            {/* Windshield glare */}
            <line x1="315" y1="165" x2="322" y2="185" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            {/* Headlight */}
            <rect x="366" y="195" width="8" height="7" rx="2" fill="#fef08a" />
            {/* Orange grill accent */}
            <rect x="366" y="203" width="8" height="12" rx="1" fill="#c2410c" />
            {/* Side mirror */}
            <rect x="370" y="178" width="7" height="5" rx="1" fill="#c2410c" />

            {/* Undercarriage */}
            <rect x="165" y="216" width="210" height="8" rx="2" fill="rgba(0,0,0,0.25)" />

            {/* Wheel 1 — rear */}
            <g className="ha-wheel" style={{ transformOrigin: "210px 226px" }}>
              <circle cx="210" cy="226" r="18" fill="#1f2937" />
              <circle cx="210" cy="226" r="12" fill="#374151" />
              <circle cx="210" cy="226" r="5" fill="#6b7280" />
              {/* Spokes */}
              <line x1="210" y1="208" x2="210" y2="244" stroke="#4b5563" strokeWidth="2" />
              <line x1="192" y1="226" x2="228" y2="226" stroke="#4b5563" strokeWidth="2" />
              <line x1="197" y1="213" x2="223" y2="239" stroke="#4b5563" strokeWidth="2" />
              <line x1="197" y1="239" x2="223" y2="213" stroke="#4b5563" strokeWidth="2" />
            </g>

            {/* Wheel 2 — front */}
            <g className="ha-wheel" style={{ transformOrigin: "335px 226px" }}>
              <circle cx="335" cy="226" r="18" fill="#1f2937" />
              <circle cx="335" cy="226" r="12" fill="#374151" />
              <circle cx="335" cy="226" r="5" fill="#6b7280" />
              <line x1="335" y1="208" x2="335" y2="244" stroke="#4b5563" strokeWidth="2" />
              <line x1="317" y1="226" x2="353" y2="226" stroke="#4b5563" strokeWidth="2" />
              <line x1="322" y1="213" x2="348" y2="239" stroke="#4b5563" strokeWidth="2" />
              <line x1="322" y1="239" x2="348" y2="213" stroke="#4b5563" strokeWidth="2" />
            </g>

            {/* Exhaust stack */}
            <rect x="288" y="148" width="6" height="18" rx="3" fill="#374151" />
            {/* Exhaust puff dots */}
            <circle cx="291" cy="143" r="4" fill="rgba(255,255,255,0.12)" />
            <circle cx="293" cy="136" r="3" fill="rgba(255,255,255,0.08)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
