/**
 * pricing.js — Tarifario oficial Dropit Service
 * ──────────────────────────────────────────────
 * Fuente: tabulador ajustado por el operador (mayo 2026)
 *
 * RM (Santiago Metro):   fórmula FEX -20% → $19.000 + $750/km
 * Nacional (fuera RM):   tarifa acumulada por tramos (precio marginal por km)
 *
 * Puntos ancla validados por el operador:
 *   50 km  → $90.000  (Melipilla)
 *   120 km → $125.000 (Valparaíso)
 *   260 km → $200.000 (Talca)
 *   500 km → $275.000 (Concepción)
 *  1000 km → $450.000 (Puerto Montt)
 */

// ─── Tramos nacionales (precio marginal acumulado) ────────────────────────────
const TIERS = [
  { upTo: 50,   rate: 1800 },   // 0-50 km    → $1.800/km   (50km  = $90.000)
  { upTo: 120,  rate: 500  },   // 51-120 km  → $500/km     (120km = $125.000)
  { upTo: 260,  rate: 535  },   // 121-260 km → $535/km     (260km ≈ $200.000)
  { upTo: 500,  rate: 312  },   // 261-500 km → $312/km     (500km ≈ $275.000)
  { upTo: Infinity, rate: 350 },// 501+ km    → $350/km     (1000km = $450.000)
];

// ─── Recargo por peso ─────────────────────────────────────────────────────────
function weightSurcharge(weightKg) {
  const w = parseFloat(weightKg) || 0;
  if (w > 500) return 0.35;
  if (w > 200) return 0.25;
  if (w > 50)  return 0.15;
  return 0;
}

// ─── Precio base nacional (tramos acumulados) ─────────────────────────────────
export function calcNationalBase(km) {
  let remaining = Math.max(0, km);
  let total = 0;
  let prev = 0;
  for (const { upTo, rate } of TIERS) {
    if (remaining <= 0) break;
    const segment = Math.min(remaining, upTo - prev);
    total += segment * rate;
    remaining -= segment;
    prev = upTo;
  }
  return Math.round(total / 1000) * 1000; // redondear al millar
}

// ─── Precio RM (Santiago Metro) — FEX -20% ───────────────────────────────────
export function calcRMPrice(km) {
  const raw = 19000 + 750 * Math.max(0, km);
  return Math.round(raw / 1000) * 1000; // redondear al millar
}

// ─── Función principal — usa según zona ──────────────────────────────────────
// isRM: true si tanto origen como destino están en la Región Metropolitana
export function calcPrice(km, weightKg = 0, isRM = false, avionetaCount = 0) {
  const base    = isRM ? calcRMPrice(km) : calcNationalBase(km);
  const surcharge = weightSurcharge(weightKg);
  const withWeight = Math.round(base * (1 + surcharge) / 1000) * 1000;
  const peoneta = (avionetaCount || 0) * 50000;
  return withWeight + peoneta;
}

// ─── Tabla de referencia por destino (para mostrar al operador) ───────────────
export const REFERENCE_TABLE = [
  // RM
  { dest: "Independencia",   km: 4,    zone: "RM" },
  { dest: "Providencia",     km: 5,    zone: "RM" },
  { dest: "Las Condes",      km: 19,   zone: "RM" },
  { dest: "Maipú",           km: 17,   zone: "RM" },
  { dest: "Puente Alto",     km: 27,   zone: "RM" },
  { dest: "San Bernardo",    km: 20,   zone: "RM" },
  // Regiones
  { dest: "Melipilla",       km: 50,   zone: "Regional" },
  { dest: "Valparaíso",      km: 120,  zone: "Regional" },
  { dest: "Viña del Mar",    km: 125,  zone: "Regional" },
  { dest: "Rancagua",        km: 87,   zone: "Regional" },
  { dest: "San Fernando",    km: 130,  zone: "Regional" },
  { dest: "Talca",           km: 260,  zone: "Regional" },
  { dest: "Chillán",         km: 390,  zone: "Regional" },
  { dest: "Concepción",      km: 500,  zone: "Regional" },
  { dest: "Los Ángeles",     km: 540,  zone: "Regional" },
  { dest: "Temuco",          km: 680,  zone: "Regional" },
  { dest: "Valdivia",        km: 840,  zone: "Regional" },
  { dest: "Osorno",          km: 940,  zone: "Regional" },
  { dest: "Puerto Montt",    km: 1000, zone: "Regional" },
  { dest: "Punta Arenas",    km: 3000, zone: "Regional" },
].map(r => ({
  ...r,
  price: calcPrice(r.km, 0, r.zone === "RM"),
}));
