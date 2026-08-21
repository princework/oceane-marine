"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";

/** WMO weather codes (Open-Meteo) grouped into visual categories. */
const CODE_CATEGORY = {
  0: "sunny",
  1: "partlySunny",
  2: "partlySunny",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "drizzle",
  57: "drizzle",
  61: "rain",
  63: "rain",
  65: "rain",
  66: "rain",
  67: "rain",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "rain",
  81: "rain",
  82: "rain",
  85: "snow",
  86: "snow",
  95: "storm",
  96: "storm",
  99: "storm",
};

const CODE_LABEL = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

/** Accent theme per category — drives the hero gradient + icon strokes. */
const CATEGORY_THEME = {
  sunny: { from: "#f97316", to: "#facc15", glow: "rgba(249,115,22,0.35)" },
  partlySunny: { from: "#f59e0b", to: "#94a3b8", glow: "rgba(245,158,11,0.25)" },
  cloudy: { from: "#94a3b8", to: "#475569", glow: "rgba(148,163,184,0.25)" },
  fog: { from: "#cbd5e1", to: "#64748b", glow: "rgba(203,213,225,0.2)" },
  drizzle: { from: "#38bdf8", to: "#0ea5e9", glow: "rgba(56,189,248,0.3)" },
  rain: { from: "#3b82f6", to: "#1d4ed8", glow: "rgba(59,130,246,0.35)" },
  snow: { from: "#7dd3fc", to: "#e0f2fe", glow: "rgba(224,242,254,0.3)" },
  storm: { from: "#a78bfa", to: "#6d28d9", glow: "rgba(167,139,250,0.35)" },
};

function categoryOf(code) {
  return CODE_CATEGORY[code] || "cloudy";
}

/** Hand-drawn weather icon set — flat emoji render poorly across platforms, so
 * each condition gets a small gradient SVG instead. Sub-shapes are plain
 * functions (not components) so no JSX-component gets created during render.
 * Each shape accepts an `animated` flag: sunny glows + spins, cloudy/storm
 * flash like lightning, rain/drizzle drops fall. */
function cloudPath(gradId, opacity = 1, y = 0, animated = false) {
  return (
    <path
      key="cloud"
      opacity={opacity}
      transform={`translate(0 ${y})`}
      d="M18 44c-6.6 0-12-5.2-12-11.6 0-5.7 4.2-10.4 9.7-11.4C17.6 15.2 23.2 11 30 11c8 0 14.6 6.1 15.5 13.9 5.6.9 9.9 5.7 9.9 11.5 0 6.4-5.4 11.6-12 11.6H18Z"
      fill={`url(#${gradId})`}
      className={animated ? "wx-cloud-flash" : undefined}
    />
  );
}

function sunGroup(sunId, cx = 32, cy = 22, r = 11, animated = false) {
  return (
    <g key="sun">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={`url(#${sunId})`}
        className={animated ? "wx-sun-pulse" : undefined}
      />
      <g
        className={animated ? "wx-ray-spin" : undefined}
        style={animated ? { transformOrigin: `${cx}px ${cy}px` } : undefined}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * Math.PI) / 4;
          const x1 = cx + Math.cos(angle) * (r + 4);
          const y1 = cy + Math.sin(angle) * (r + 4);
          const x2 = cx + Math.cos(angle) * (r + 9);
          const y2 = cy + Math.sin(angle) * (r + 9);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={`url(#${sunId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </g>
  );
}

function dropsGroup(color, n = 3, y = 46, animated = false) {
  return (
    <g key="drops" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      {Array.from({ length: n }).map((_, i) => (
        <line
          key={i}
          x1={16 + i * 12}
          y1={y}
          x2={12 + i * 12}
          y2={y + 9}
          className={animated ? "wx-drop-fall" : undefined}
          style={animated ? { animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
    </g>
  );
}

function flakesGroup(color, n = 3, y = 50) {
  return (
    <g key="flakes" fill={color}>
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={16 + i * 12} cy={y} r="2.4" />
      ))}
    </g>
  );
}

function boltPath(animated = false) {
  return (
    <path
      key="bolt"
      d="M30 42l-6 12h6l-3 8 10-13h-6l4-7z"
      fill="#fde047"
      stroke="#f59e0b"
      strokeWidth="1"
      strokeLinejoin="round"
      className={animated ? "wx-bolt-flash" : undefined}
    />
  );
}

function fogLinesGroup(color) {
  return (
    <g key="fog" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
      <line x1="10" y1="40" x2="54" y2="40" />
      <line x1="14" y1="47" x2="50" y2="47" />
      <line x1="18" y1="54" x2="46" y2="54" />
    </g>
  );
}

function WeatherIcon({ code, uid, size = 56, animated = false }) {
  const category = categoryOf(code);
  const theme = CATEGORY_THEME[category];
  const gradId = `wx-grad-${uid}`;
  const sunId = `wx-sun-${uid}`;
  const isBright = animated && (category === "sunny" || category === "partlySunny");
  const isLightning = animated && (category === "cloudy" || category === "storm");
  const isRainy = animated && (category === "rain" || category === "drizzle");

  let body = null;
  if (category === "sunny") {
    body = sunGroup(sunId, 32, 30, 14, isBright);
  } else if (category === "partlySunny") {
    body = (
      <>
        {sunGroup(sunId, 22, 20, 9, isBright)}
        {cloudPath(gradId, 1, 4)}
      </>
    );
  } else if (category === "cloudy") {
    body = (
      <>
        {cloudPath(gradId, 1, 0, isLightning)}
        {isLightning && boltPath(true)}
      </>
    );
  } else if (category === "fog") {
    body = (
      <>
        {cloudPath(gradId, 0.9, -6)}
        {fogLinesGroup(theme.to)}
      </>
    );
  } else if (category === "drizzle") {
    body = (
      <>
        {cloudPath(gradId, 1, -6)}
        {dropsGroup(theme.to, 3, 40, isRainy)}
      </>
    );
  } else if (category === "rain") {
    body = (
      <>
        {cloudPath(gradId, 1, -6)}
        {dropsGroup(theme.to, 4, 42, isRainy)}
      </>
    );
  } else if (category === "snow") {
    body = (
      <>
        {cloudPath(gradId, 1, -6)}
        {flakesGroup(theme.to, 4, 46)}
      </>
    );
  } else if (category === "storm") {
    body = (
      <>
        {cloudPath(gradId, 0.95, -8, isLightning)}
        {boltPath(isLightning)}
      </>
    );
  }

  return (
    <>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="6" y1="11" x2="58" y2="47" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={theme.from} stopOpacity="0.95" />
            <stop offset="1" stopColor={theme.to} stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id={sunId}>
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="1" stopColor={theme.from} />
          </radialGradient>
        </defs>
        {body}
      </svg>
      {animated && (
        <style jsx global>{`
          .wx-sun-pulse {
            transform-box: fill-box;
            transform-origin: center;
            animation: wxSunPulse 2.2s ease-in-out infinite;
          }
          @keyframes wxSunPulse {
            0%,
            100% {
              filter: drop-shadow(0 0 3px rgba(250, 204, 21, 0.55));
              transform: scale(1);
            }
            50% {
              filter: drop-shadow(0 0 11px rgba(250, 204, 21, 0.95));
              transform: scale(1.07);
            }
          }
          .wx-ray-spin {
            transform-box: view-box;
            animation: wxRaySpin 10s linear infinite;
          }
          @keyframes wxRaySpin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          .wx-bolt-flash {
            animation: wxBoltFlash 3.2s ease-in-out infinite;
          }
          @keyframes wxBoltFlash {
            0%,
            100% {
              opacity: 0.12;
            }
            4%,
            7% {
              opacity: 1;
            }
            10% {
              opacity: 0.2;
            }
            13% {
              opacity: 0.9;
            }
            17% {
              opacity: 0.1;
            }
          }
          .wx-cloud-flash {
            animation: wxCloudFlash 3.2s ease-in-out infinite;
          }
          @keyframes wxCloudFlash {
            0%,
            90%,
            100% {
              filter: brightness(1);
            }
            94% {
              filter: brightness(1.5);
            }
            97% {
              filter: brightness(1);
            }
          }
          .wx-drop-fall {
            transform-box: fill-box;
            animation: wxDropFall 0.9s ease-in infinite;
          }
          @keyframes wxDropFall {
            0% {
              transform: translateY(-3px);
              opacity: 0;
            }
            35% {
              opacity: 1;
            }
            100% {
              transform: translateY(9px);
              opacity: 0;
            }
          }
        `}</style>
      )}
    </>
  );
}

function describeWeatherCode(code) {
  return { label: CODE_LABEL[code] || "Unknown", category: categoryOf(code) };
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDay(dateStr, index) {
  if (index === 0) return "Today";
  const d = new Date(dateStr);
  return DAY_LABELS[d.getDay()];
}

function formatClock(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function compassLabel(deg) {
  if (deg == null) return "—";
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function MetricChip({ icon, label, value }) {
  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all hover:border-white/20 hover:bg-white/[0.07]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

const ICONS = {
  thermometer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
    </svg>
  ),
  droplet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5s6.5 7.2 6.5 12a6.5 6.5 0 11-13 0c0-4.8 6.5-12 6.5-12z" />
    </svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h11a3 3 0 100-3M3 16h14a3 3 0 110 3M3 12h8a2.5 2.5 0 100-5" />
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 12l4-4M12 12V8" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sunrise: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M4.2 10.2l1.4 1.4M19.8 10.2l-1.4 1.4M2 18h20M6 18a6 6 0 0112 0" />
    </svg>
  ),
  sunset: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9V5M4.2 12.2l1.4 1.4M19.8 12.2l-1.4 1.4M2 18h20M6 18a6 6 0 0112 0" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-11.5a7 7 0 10-14 0C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  uv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="15" r="5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M4.2 7.2l1.8 1.8M19.8 7.2L18 9M2 15h3M19 15h3" />
    </svg>
  ),
};

/** Deterministic (not Math.random) particle layouts — stable across re-renders. */
const RAIN_DROPS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37.3) % 100,
  delay: (i % 10) * 0.14,
  duration: 0.6 + (i % 5) * 0.15,
}));
const SNOW_FLAKES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 52.7) % 100,
  delay: (i % 8) * 0.5,
  duration: 5 + (i % 6) * 0.9,
  size: 2 + (i % 3),
}));

/** Full-card ambient weather effects — drifting glow, lightning flash across
 * the whole panel, falling rain/snow, drifting fog bands. Sits behind the
 * card content (z-0), driven by the currently displayed condition. */
function WeatherBackgroundFX({ category, theme }) {
  const isBright = category === "sunny" || category === "partlySunny";
  const isLightning = category === "cloudy" || category === "storm";
  const isRainy = category === "rain" || category === "drizzle";
  const isSnowy = category === "snow";
  const isFoggy = category === "fog";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl md:rounded-2xl" aria-hidden="true">
      <div
        className={`wx-bg-glow wx-bg-glow-a${isBright ? " wx-bg-glow-bright" : ""}`}
        style={{ background: theme.glow }}
      />
      <div
        className={`wx-bg-glow wx-bg-glow-b${isBright ? " wx-bg-glow-bright" : ""}`}
        style={{ background: theme.glow }}
      />

      {isLightning && <div className="wx-bg-lightning-flash" />}

      {isRainy && (
        <div className="wx-bg-rain">
          {RAIN_DROPS.map((d, i) => (
            <span
              key={i}
              className="wx-bg-raindrop"
              style={{
                left: `${d.left}%`,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      {isSnowy && (
        <div className="wx-bg-snow">
          {SNOW_FLAKES.map((f, i) => (
            <span
              key={i}
              className="wx-bg-snowflake"
              style={{
                left: `${f.left}%`,
                width: `${f.size}px`,
                height: `${f.size}px`,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      {isFoggy && (
        <>
          <div className="wx-bg-fog-band wx-bg-fog-band-1" />
          <div className="wx-bg-fog-band wx-bg-fog-band-2" />
        </>
      )}

      <style jsx global>{`
        .wx-bg-glow {
          position: absolute;
          width: 18rem;
          height: 18rem;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.5;
          animation: wxBgGlowDrift 16s ease-in-out infinite alternate;
        }
        .wx-bg-glow-a {
          top: -6rem;
          right: -4rem;
        }
        .wx-bg-glow-b {
          bottom: -5rem;
          left: -3rem;
          opacity: 0.4;
          animation-duration: 20s;
          animation-direction: alternate-reverse;
        }
        .wx-bg-glow-bright {
          animation-name: wxBgGlowPulseBright;
        }
        @keyframes wxBgGlowDrift {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate(-2rem, 1.5rem) scale(1.15);
            opacity: 0.65;
          }
          100% {
            transform: translate(1rem, -1rem) scale(1);
            opacity: 0.5;
          }
        }
        @keyframes wxBgGlowPulseBright {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.9;
          }
        }
        .wx-bg-lightning-flash {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 70% 15%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 60%);
          opacity: 0;
          animation: wxBgFlash 3.2s ease-in-out infinite;
        }
        @keyframes wxBgFlash {
          0%,
          100% {
            opacity: 0;
          }
          4%,
          7% {
            opacity: 0.85;
          }
          10% {
            opacity: 0.1;
          }
          13% {
            opacity: 0.55;
          }
          17% {
            opacity: 0;
          }
        }
        .wx-bg-rain,
        .wx-bg-snow {
          position: absolute;
          inset: 0;
        }
        .wx-bg-raindrop {
          position: absolute;
          top: -10%;
          width: 1px;
          height: 16%;
          background: linear-gradient(to bottom, rgba(147, 197, 253, 0), rgba(147, 197, 253, 0.6));
          animation: wxBgDropFall linear infinite;
        }
        @keyframes wxBgDropFall {
          0% {
            transform: translateY(-10%) rotate(10deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(120%) rotate(10deg);
            opacity: 0;
          }
        }
        .wx-bg-snowflake {
          position: absolute;
          top: -5%;
          border-radius: 9999px;
          background: rgba(224, 242, 254, 0.85);
          animation: wxBgSnowFall linear infinite;
        }
        @keyframes wxBgSnowFall {
          0% {
            transform: translate(0, -5%);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          50% {
            transform: translate(0.75rem, 55%);
          }
          100% {
            transform: translate(-0.5rem, 115%);
            opacity: 0;
          }
        }
        .wx-bg-fog-band {
          position: absolute;
          left: -20%;
          width: 140%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.5), transparent);
          filter: blur(6px);
          animation: wxBgFogDrift 14s ease-in-out infinite alternate;
        }
        .wx-bg-fog-band-1 {
          top: 30%;
        }
        .wx-bg-fog-band-2 {
          top: 65%;
          animation-duration: 18s;
          animation-direction: alternate-reverse;
        }
        @keyframes wxBgFogDrift {
          0% {
            transform: translateX(-5%);
            opacity: 0.3;
          }
          50% {
            transform: translateX(5%);
            opacity: 0.6;
          }
          100% {
            transform: translateX(-3%);
            opacity: 0.35;
          }
        }
      `}</style>
    </div>
  );
}

export default function WeatherMonitoring() {
  const uid = useId();
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSpot, setActiveSpot] = useState(null); // { name, latitude, longitude }
  const [weather, setWeather] = useState(null);
  const [selectedDate, setSelectedDate] = useState(""); // ISO date (YYYY-MM-DD) within the forecast window
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchBoxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/master/locations/list");
        const data = await res.json();
        if (res.ok && data.locations) {
          const withCoords = data.locations.filter(
            (l) => l.latitude != null && l.longitude != null
          );
          setLocations(withCoords);
          if (withCoords.length > 0) {
            setSelectedLocationId(String(withCoords[0]._id));
            setActiveSpot({
              name: withCoords[0].name,
              latitude: withCoords[0].latitude,
              longitude: withCoords[0].longitude,
            });
          }
        }
      } catch {
        setError("Failed to load saved locations");
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchWeather = useCallback(async (latitude, longitude) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/operations/dashboard/weather?lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch weather");
      setWeather(data.data);
      if (data.data?.daily?.time?.[0]) {
        setSelectedDate(data.data.daily.time[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch weather");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSpot) {
      fetchWeather(activeSpot.latitude, activeSpot.longitude);
    }
  }, [activeSpot, fetchWeather]);

  const handleLocationChange = (id) => {
    setSelectedLocationId(id);
    const loc = locations.find((l) => String(l._id) === id);
    if (loc) {
      setSearchTerm("");
      setShowSuggestions(false);
      setActiveSpot({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude });
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setSelectedLocationId("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/operations/dashboard/weather/search?q=${encodeURIComponent(value.trim())}`
        );
        const data = await res.json();
        if (res.ok) {
          setSearchResults(data.data || []);
          setShowSuggestions(true);
        }
      } catch {
        // silent — search suggestions are best-effort
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handlePickSearchResult = (result) => {
    const label = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
    setSearchTerm(label);
    setShowSuggestions(false);
    setActiveSpot({ name: label, latitude: result.latitude, longitude: result.longitude });
  };

  const current = weather?.current;
  const dailyTimes = weather?.daily?.time || [];
  const selectedIndex = Math.max(dailyTimes.indexOf(selectedDate), 0);
  const isToday = selectedIndex === 0;
  const heroCode = isToday ? current?.weather_code : weather?.daily?.weather_code?.[selectedIndex];
  const heroInfo = heroCode != null ? describeWeatherCode(heroCode) : null;
  const theme = heroInfo ? CATEGORY_THEME[heroInfo.category] : CATEGORY_THEME.cloudy;

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-white/15 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 shadow-2xl">
      {/* full-section ambient animation tied to current condition */}
      <WeatherBackgroundFX category={heroInfo?.category || "cloudy"} theme={theme} />

      <div className="relative z-10 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2">
              {isToday ? (
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)] animate-pulse" />
              ) : (
                <span className="text-orange-300">{ICONS.calendar}</span>
              )}
              Weather Monitoring
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {isToday
                ? "Live conditions for STS locations"
                : `Forecast for ${formatDateLabel(selectedDate)}`}{" "}
              · powered by Open-Meteo
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                min={dailyTimes[0] || undefined}
                max={dailyTimes[dailyTimes.length - 1] || undefined}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                disabled={!weather}
                title="Check the forecast for a future operation date"
                className="[color-scheme:dark] bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              />
            </div>

            <div className="relative">
              <select
                value={selectedLocationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="appearance-none bg-white/5 border border-white/15 rounded-xl pl-3 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 min-w-[11rem] cursor-pointer transition"
              >
                <option value="" disabled className="bg-slate-900">
                  Select saved location
                </option>
                {locations.map((loc) => (
                  <option key={loc._id} value={String(loc._id)} className="bg-slate-900">
                    {loc.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div ref={searchBoxRef} className="relative w-full sm:w-60">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                placeholder="Search any location..."
                className="w-full bg-white/5 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition"
              />
              {showSuggestions && (
                <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-white/15 bg-slate-900/98 backdrop-blur-md shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {searching && (
                    <div className="px-3 py-2.5 text-xs text-white/50">Searching...</div>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <div className="px-3 py-2.5 text-xs text-white/50">No matches found</div>
                  )}
                  {!searching &&
                    searchResults.map((result, idx) => (
                      <button
                        key={`${result.name}-${result.latitude}-${idx}`}
                        type="button"
                        onClick={() => handlePickSearchResult(result)}
                        className="flex w-full items-center gap-2 text-left px-3 py-2.5 text-xs sm:text-sm text-white/90 hover:bg-orange-500/15 transition border-b border-white/5 last:border-b-0"
                      >
                        <span className="text-white/40">{ICONS.pin}</span>
                        {[result.name, result.admin1, result.country].filter(Boolean).join(", ")}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 mb-4">
            {error}
          </div>
        )}

        {loading && !weather && (
          <div className="flex items-center justify-center py-14">
            <div className="animate-spin rounded-full h-9 w-9 border-2 border-sky-400/30 border-t-sky-400" />
          </div>
        )}

        {weather && heroInfo && (
          <div className="space-y-4">
            {/* Hero */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                  style={{
                    background: `linear-gradient(135deg, ${theme.from}22, ${theme.to}11)`,
                  }}
                >
                  <WeatherIcon code={heroCode} uid={`${uid}-hero`} size={64} animated />
                </div>
                <div>
                  {isToday ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                        {Math.round(current.temperature_2m)}
                      </span>
                      <span className="text-xl sm:text-2xl font-semibold text-white/60">°C</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                        {Math.round(weather.daily.temperature_2m_max[selectedIndex])}°
                      </span>
                      <span className="text-xl sm:text-2xl font-semibold text-white/50">
                        {Math.round(weather.daily.temperature_2m_min[selectedIndex])}°
                      </span>
                    </div>
                  )}
                  <p className="text-sm font-medium text-slate-200">{heroInfo.label}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <span className="text-slate-500">{ICONS.pin}</span>
                    {activeSpot?.name}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                    <span>{ICONS.calendar}</span>
                    {formatDateLabel(selectedDate || dailyTimes[0])}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 lg:ml-auto lg:w-[26rem]">
                {isToday ? (
                  <>
                    <MetricChip icon={ICONS.thermometer} label="Feels like" value={`${Math.round(current.apparent_temperature)}°C`} />
                    <MetricChip icon={ICONS.droplet} label="Humidity" value={`${current.relative_humidity_2m}%`} />
                    <MetricChip
                      icon={ICONS.wind}
                      label="Wind"
                      value={`${Math.round(current.wind_speed_10m)} km/h ${compassLabel(current.wind_direction_10m)}`}
                    />
                    <MetricChip icon={ICONS.gauge} label="Pressure" value={`${Math.round(current.pressure_msl)} hPa`} />
                    <MetricChip icon={ICONS.eye} label="Visibility" value={`${(current.visibility / 1000).toFixed(1)} km`} />
                    {weather.daily?.sunset && (
                      <MetricChip icon={ICONS.sunset} label="Sunset" value={formatClock(weather.daily.sunset[0])} />
                    )}
                  </>
                ) : (
                  <>
                    <MetricChip
                      icon={ICONS.thermometer}
                      label="Feels like"
                      value={`${Math.round(weather.daily.apparent_temperature_max[selectedIndex])}°C`}
                    />
                    <MetricChip
                      icon={ICONS.droplet}
                      label="Rain chance"
                      value={`${weather.daily.precipitation_probability_max?.[selectedIndex] ?? 0}%`}
                    />
                    <MetricChip
                      icon={ICONS.wind}
                      label="Max wind"
                      value={`${Math.round(weather.daily.wind_speed_10m_max[selectedIndex])} km/h ${compassLabel(
                        weather.daily.wind_direction_10m_dominant?.[selectedIndex]
                      )}`}
                    />
                    <MetricChip
                      icon={ICONS.gauge}
                      label="Gusts"
                      value={`${Math.round(weather.daily.wind_gusts_10m_max[selectedIndex])} km/h`}
                    />
                    <MetricChip icon={ICONS.uv} label="UV index" value={`${Math.round(weather.daily.uv_index_max[selectedIndex])}`} />
                    {weather.daily?.sunset && (
                      <MetricChip icon={ICONS.sunset} label="Sunset" value={formatClock(weather.daily.sunset[selectedIndex])} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 16-day outlook — click a day to preview it for a future operation */}
            <div>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  16-Day Outlook
                </p>
                <p className="text-[10px] text-slate-500 hidden sm:block">
                  Tap a day to plan around it
                </p>
              </div>
              <div className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
                {weather.daily.time.map((date, idx) => {
                  const dayInfo = describeWeatherCode(weather.daily.weather_code[idx]);
                  const dayTheme = CATEGORY_THEME[dayInfo.category];
                  const max = weather.daily.temperature_2m_max[idx];
                  const min = weather.daily.temperature_2m_min[idx];
                  const globalMax = Math.max(...weather.daily.temperature_2m_max);
                  const globalMin = Math.min(...weather.daily.temperature_2m_min);
                  const span = Math.max(globalMax - globalMin, 1);
                  const barLeft = ((min - globalMin) / span) * 100;
                  const barWidth = Math.max(((max - min) / span) * 100, 12);
                  const isActive = date === selectedDate;

                  return (
                    <button
                      type="button"
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`w-[4.5rem] sm:w-[5.5rem] shrink-0 rounded-xl border p-2.5 sm:p-3 text-center transition-all hover:-translate-y-0.5 ${
                        isActive
                          ? "border-orange-400/60 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                      }`}
                    >
                      <p
                        className={`text-[10px] sm:text-xs font-semibold ${
                          isActive ? "text-orange-200" : "text-slate-300"
                        }`}
                      >
                        {formatDay(date, idx)}
                      </p>
                      <div className="flex justify-center my-1.5">
                        <WeatherIcon code={weather.daily.weather_code[idx]} uid={`${uid}-day-${idx}`} size={36} />
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs">
                        <span className="text-white font-semibold">{Math.round(max)}°</span>
                        <span className="text-slate-500">{Math.round(min)}°</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 relative overflow-hidden">
                        <div
                          className="absolute top-0 h-1 rounded-full"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                            background: `linear-gradient(90deg, ${dayTheme.from}, ${dayTheme.to})`,
                          }}
                        />
                      </div>
                      {weather.daily.precipitation_probability_max?.[idx] > 0 && (
                        <p className="mt-1 text-[10px] text-sky-300/80">
                          💧 {weather.daily.precipitation_probability_max[idx]}%
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && !weather && !error && (
          <div className="text-center py-10 text-sm text-slate-400">
            Select a location to view weather conditions.
          </div>
        )}
      </div>
    </div>
  );
}
