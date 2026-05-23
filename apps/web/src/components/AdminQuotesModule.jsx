import {
  AlertTriangle, Camera, CheckCircle2, Clock, Download, FileText,
  Mail, MessageSquare, Phone, Send, Truck, User, X, Zap,
  MapPin, Package, RefreshCw, Bell, ZoomIn, Eye, ThumbsUp, Trash2,
  ChevronLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addToLog } from "../lib/messageLog";
import { api } from "../lib/api";
import { getCompanyName, getLogoUrl, tplEmpresaNuevaCotizacion, tplCotizacionConfirmada } from "../lib/emailTemplates";
import { serviceTypes } from "../lib/constants";
import StatusBadge from "./StatusBadge";
import QuotePDFPreview from "./QuotePDFPreview";
import { loadGoogleMaps } from "./GoogleMap";
import { calcPrice, calcNationalBase, calcRMPrice } from "../lib/pricing";
import StreetAutocomplete from "./StreetAutocomplete";

const API_URL  = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const API_BASE = API_URL.replace(/\/api\/?$/, ""); // strip trailing /api → http://localhost:4000

// Resolve a stored photo reference to an absolute URL.
// Handles: data: URLs (legacy base64), absolute http(s), and relative /uploads/...
function photoUrl(p) {
  if (!p || typeof p !== "string") return "";
  if (p.startsWith("data:") || /^https?:\/\//.test(p)) return p;
  return API_BASE + (p.startsWith("/") ? p : "/" + p);
}
const RM_COMUNAS = new Set([
  "Alhué","Buin","Calera de Tango","Cerrillos","Cerro Navia","Colina","Conchalí",
  "Curacaví","El Bosque","El Monte","Estación Central","Huechuraba","Independencia",
  "Isla de Maipo","La Cisterna","La Florida","La Granja","La Pintana","La Reina",
  "Lampa","Las Condes","Lo Barnechea","Lo Espejo","Lo Prado","Macul","Maipú",
  "María Pinto","Melipilla","Ñuñoa","Padre Hurtado","Paine","Pedro Aguirre Cerda",
  "Peñaflor","Peñalolén","Pirque","Providencia","Pudahuel","Puente Alto","Quilicura",
  "Quinta Normal","Recoleta","Renca","San Bernardo","San Joaquín","San José de Maipo",
  "San Miguel","San Pedro","Santiago","Talagante","Tiltil","Vitacura",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getElapsedMinutes(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatElapsed(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function urgencyConfig(mins) {
  if (mins >= 60) return { color: "text-red-600", bg: "bg-red-50 border-red-200", dot: "bg-red-500", label: "Vencida", pulse: true };
  if (mins >= 45) return { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500", label: "Urgente", pulse: true };
  if (mins >= 30) return { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400", label: "Pronto", pulse: false };
  return { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-400", label: "Reciente", pulse: false };
}

function calcSuggestedPrice(req, overrideKm = null) {
  const km = overrideKm || req.distanceKm;
  if (!km) return null;
  const isRM = RM_COMUNAS.has((req.pickupAddress || "").split(",").pop()?.trim()) ||
               RM_COMUNAS.has((req.deliveryAddress || "").split(",").pop()?.trim());
  if (!isRM) return null;
  const rate = req.estimatedWeightKg > 50 ? 3000 : 2200;
  const base = Math.round(km * rate);
  return base;
}

// ─── Live timer hook ──────────────────────────────────────────────────────────
function useTick(intervalMs = 15000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

// ─── PDF Generator — returns HTML string (no side effects) ───────────────────
function buildPDFHtml(request, finalAmount, photos = []) {
  const logoUrl = getLogoUrl();
  const companyName = getCompanyName();
  const now = new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const price = finalAmount || request.estimatedPrice;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cotización ${request.trackingCode}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; font-size: 12px; }
  .page { width: 100%; }
  .header { background: linear-gradient(135deg, #F97316 0%, #C2590A 55%, #7C3308 100%); padding: 18px 24px; color: #fff; border-radius: 8px 8px 0 0; }
  .logo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .logo-img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); }
  .logo-fallback { width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fff; border: 2px solid rgba(255,255,255,0.3); }
  .company-name { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 9px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
  .doc-title { font-size: 22px; font-weight: 900; }
  .doc-subtitle { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 4px; }
  .body { padding: 16px 24px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 10px; font-weight: 800; color: #F97316; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #fed7aa; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-card { background: #fff8f1; border: 1px solid #fed7aa; border-left: 3px solid #F97316; border-radius: 5px; padding: 7px 10px; }
  .info-label { font-size: 9px; color: #C2590A; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 12px; color: #1f2937; font-weight: 500; margin-top: 1px; }
  .price-box { background: linear-gradient(135deg, #F97316 0%, #C2590A 100%); color: #fff; border-radius: 10px; padding: 16px 24px; text-align: center; margin: 14px 0; }
  .price-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
  .price-amount { font-size: 34px; font-weight: 900; margin: 4px 0; letter-spacing: -1px; }
  .price-note { font-size: 10px; opacity: 0.7; }
  .route-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; display: flex; align-items: center; gap: 12px; }
  .route-point { flex: 1; }
  .route-point-label { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  .route-point-value { font-size: 12px; font-weight: 600; color: #111827; margin-top: 2px; }
  .route-arrow { font-size: 18px; color: #F97316; flex-shrink: 0; }
  .footer { margin-top: 14px; padding: 12px 24px; background: #1a0f05; color: rgba(255,255,255,0.5); font-size: 9px; text-align: center; border-radius: 0 0 8px 8px; }
  .footer strong { color: #F97316; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; background: rgba(249,115,22,0.15); color: #C2590A; border: 1px solid rgba(249,115,22,0.3); }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo-row">
      ${logoUrl ? `<img class="logo-img" src="${logoUrl}" alt="Logo" />` : `<div class="logo-fallback">D</div>`}
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-sub">Transportes &amp; Logística</div>
      </div>
    </div>
    <div class="doc-title">Propuesta de cotización</div>
    <div class="doc-subtitle">${now} · Ref. ${request.trackingCode}</div>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="grid-2">
        <div class="info-card"><div class="info-label">Empresa / Persona</div><div class="info-value">${request.customerName}</div></div>
        ${(request.customerRut || (() => { const m = (request.observations || "").split("\n").find(l => l.startsWith("RUT:")); return m ? m.replace("RUT: ", "").trim() : ""; })()) ? `<div class="info-card"><div class="info-label">RUT</div><div class="info-value" style="font-family:monospace;">${request.customerRut || (request.observations || "").split("\n").find(l => l.startsWith("RUT:"))?.replace("RUT: ", "").trim() || "—"}</div></div>` : ""}
        <div class="info-card"><div class="info-label">Teléfono</div><div class="info-value">${request.contactPhone}</div></div>
        <div class="info-card"><div class="info-label">Email</div><div class="info-value">${request.contactEmail}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Ruta de servicio</div>
      <div class="route-box">
        <div class="route-point">
          <div class="route-point-label">📦 Retiro</div>
          <div class="route-point-value">${request.pickupAddress}</div>
        </div>
        <div class="route-arrow">→</div>
        <div class="route-point">
          <div class="route-point-label">🏁 Entrega</div>
          <div class="route-point-value">${request.deliveryAddress}</div>
        </div>
      </div>
      ${request.distanceKm ? `<p style="margin-top:7px;font-size:11px;color:#6b7280;">Distancia calculada: <strong style="color:#F97316;">${request.distanceKm} km</strong></p>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Detalle de carga</div>
      <div class="grid-2">
        <div class="info-card"><div class="info-label">Bultos / Peso total</div><div class="info-value">${request.packages} bultos · ${request.estimatedWeightKg} kg en total</div></div>
        <div class="info-card"><div class="info-label">Fecha requerida</div><div class="info-value">${request.requiredDate || "—"}${request.requiredTime ? ` a las ${request.requiredTime}` : ""}</div></div>
        <div class="info-card" style="grid-column:1/-1"><div class="info-label">Descripción</div><div class="info-value">${request.cargoDescription}</div></div>
        ${(request.avionetaCount > 0 || request.avioneta) ? `<div class="info-card" style="grid-column:1/-1"><div class="info-label">Peonetas</div><div class="info-value">✓ ${request.avionetaCount > 0 ? `${request.avionetaCount} peoneta${request.avionetaCount > 1 ? "s" : ""} incluida${request.avionetaCount > 1 ? "s" : ""}` : "1 peoneta incluida"}</div></div>` : ""}
      </div>
    </div>

    ${price ? `
    <div class="price-box">
      <div class="price-label">Valor del servicio</div>
      <div class="price-amount">$${Number(price).toLocaleString("es-CL")}</div>
      <div class="price-note">Precio referencial · Los valores pueden variar según dificultad del flete</div>
    </div>
    ` : ""}

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-top:8px;">
      <p style="font-size:11px;color:#6b7280;line-height:1.6;">
        Esta cotización es referencial y tiene validez de <strong>24 horas</strong> desde su emisión.
        El precio final puede variar según condiciones del acceso, dificultad de maniobra o cambios en la carga.
        Para confirmar el servicio, responda este documento a <strong style="color:#F97316;">${getCompanyName()}</strong>.
      </p>
    </div>

    ${photos.length > 0 ? `
    <div class="section" style="margin-top:24px;">
      <div class="section-title">Fotos adjuntas (${photos.length})</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${photos.map((src, i) => `<img src="${photoUrl(src)}" alt="Foto ${i+1}" style="width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" />`).join("")}
      </div>
    </div>` : ""}
  </div>

  <div class="footer">
    Documento generado por <strong>${companyName}</strong> · ${now}
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

  return html;
}

// ─── WhatsApp reminder ────────────────────────────────────────────────────────
// ─── Normalize Chilean phone → whatsapp:+569XXXXXXXX ─────────────────────────
function normalizePhone(raw = "") {
  const digits = raw.replace(/\D/g, "");
  // Already has country code 56
  if (digits.startsWith("56") && digits.length >= 11) return `whatsapp:+${digits}`;
  // 9-digit cell starting with 9
  if (digits.startsWith("9") && digits.length === 9) return `whatsapp:+56${digits}`;
  // 8-digit without leading 9
  if (digits.length === 8) return `whatsapp:+569${digits}`;
  return `whatsapp:+${digits}`;
}

export async function sendWAReminder(request, type, waConfig) {
  // Only requires authToken + accountSid (businessNumber is for receiving, not sending)
  if (!waConfig?.authToken || !waConfig?.accountSid) return false;
  if (!request.contactPhone) return false;

  const companyName = getCompanyName();
  const msgs = {
    "30min": `⏰ *Recordatorio — ${companyName}*\n\nHan pasado 30 minutos desde que recibimos tu solicitud.\n\n📋 *Código:* ${request.trackingCode}\n👤 *Cliente:* ${request.customerName}\n\nEstamos preparando tu cotización. Te respondemos pronto.`,
    "45min": `⚠️ *Aviso urgente — ${companyName}*\n\nHan pasado 45 minutos. Tu cotización está a punto de vencer.\n\n📋 *Código:* ${request.trackingCode}\n👤 *Cliente:* ${request.customerName}\n📞 ${request.contactPhone}\n\n¡Responderemos antes de que se cumpla la hora!`,
    "60min": `🔴 *Cotización vencida — ${companyName}*\n\nSe ha cumplido 1 hora desde tu solicitud y aún no hemos enviado cotización formal.\n\n📋 *Código:* ${request.trackingCode}\nNos disculpamos por la demora. Te contactaremos de inmediato.`,
  };
  try {
    const [waRes] = await Promise.all([
      fetch(`${API_URL}/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSid: waConfig.accountSid,
          authToken:  waConfig.authToken,
          from: waConfig.fromNumber || "whatsapp:+14155238886",
          to:   normalizePhone(request.contactPhone),
          body: msgs[type] || msgs["30min"],
        }),
      }),
      fetch(`${API_URL}/quote-requests/${request.id}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      }),
    ]);
    return waRes.ok;
  } catch { return false; }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminQuotesModule({ requests, onSendQuote, onRefresh }) {
  const tick = useTick(30000); // re-render every 30s to update timers
  const [selectedId, setSelectedId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    quotedAmount: "",
    serviceType: serviceTypes[0],
    internalNotes: "",
    avionetaCount: 0,
    peonetaUnitCost: 0,       // editable unit cost per peoneta (CLP) — default 0 = metadata only
    discount: 0,              // discount to subtract from the calculated total
    manualOverride: false,    // when true, quotedAmount input is the source of truth
    pickupOverride: "",       // override of pickup address (empty = use request's)
    deliveryOverride: "",     // override of delivery address (empty = use request's)
    pickupCoords: null,       // {lat,lng} resolved by autocomplete (skip geocoding)
    deliveryCoords: null,     // {lat,lng} resolved by autocomplete (skip geocoding)
  });
  const [updateMode, setUpdateMode] = useState(false); // true when re-quoting an already-quoted request
  const [photos, setPhotos] = useState([]); // base64 strings, max 3
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null); // {ok, text}
  const [waConfig, setWaConfig] = useState(null);
  const [reminderSent, setReminderSent] = useState({}); // {requestId: {type: boolean}}
  const [filter, setFilter] = useState("all"); // all | pending | quoted
  const [lightboxPhoto, setLightboxPhoto] = useState(null); // src string or null
  const [autoToast, setAutoToast] = useState(null); // {ok, text}
  const [pdfPreview, setPdfPreview] = useState(null); // HTML string or null
  const [acceptingManual, setAcceptingManual] = useState(false);
  // ─── On-demand distance calculation per request ─────────────────────────────
  // Caches computed km by requestId so we don't re-geocode every selection
  const [routeCache, setRouteCache] = useState({}); // { [requestId]: {km, durationMin, loading, error} }
  const [deletingQuote, setDeletingQuote] = useState(false);
  const autoSentRef = useRef(new Set()); // tracks keys "requestId-type" sent this session
  const photoInputRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    try { setWaConfig(JSON.parse(localStorage.getItem("dropit-whatsapp-config") || "null")); } catch {}
  }, []);

  // ─── Geocode + OSRM route → live km calculation ─────────────────────────────
  // req puede incluir pickupCoords/deliveryCoords (pre-resueltos por autocomplete)
  // para omitir la fase de geocodificación y ir directo a OSRM.
  async function calcRouteForRequest(req, overrideCoords = {}) {
    if (!req || routeCache[req.id]?.km || routeCache[req.id]?.loading) return;
    if (!req.pickupAddress || !req.deliveryAddress) return;

    setRouteCache(prev => ({ ...prev, [req.id]: { loading: true } }));

    const timeout = (ms, msg = "Timeout") => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));

    // Si el autocomplete ya resolvió coords, úsalas; de lo contrario geocodificar vía Nominatim
    const nominatimGeocode = async (addr) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ", Chile")}&limit=1`;
      const res = await Promise.race([fetch(url, { headers: { "Accept-Language": "es" } }), timeout(7000, "Geocode timeout")]);
      const data = await res.json();
      if (!data[0]) throw new Error("Dirección no encontrada");
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    };

    try {
      const pc = overrideCoords.pickup || await nominatimGeocode(req.pickupAddress);
      const dc = overrideCoords.delivery || await nominatimGeocode(req.deliveryAddress);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pc.lng},${pc.lat};${dc.lng},${dc.lat}?overview=false`;
      const r = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timer);
      const data = await r.json();
      const route = data.routes?.[0];
      if (!route) throw new Error("Sin ruta OSRM");
      const km = Math.round(route.distance / 100) / 10;
      const durationMin = Math.round(route.duration / 60);
      setRouteCache(prev => ({ ...prev, [req.id]: { km, durationMin } }));
    } catch (err) {
      const msg = err.name === "AbortError" ? "Timeout de red — reintentar" : (err.message || "No se pudo calcular");
      setRouteCache(prev => ({ ...prev, [req.id]: { error: msg } }));
    }
  }

  useEffect(() => {
    if (selected && !selected.distanceKm) calcRouteForRequest(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // On mobile (<xl), auto-scroll to the detail panel when a quote is selected
  useEffect(() => {
    if (!selectedId) return;
    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
    if (!isDesktop && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80); // slight delay so the DOM has rendered
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    files.slice(0, 6 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(prev => prev.length < 6 ? [...prev, ev.target.result] : prev);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  const pending = requests.filter(r => r.status === "Pendiente de cotizacion")
    .sort((a, b) => {
      // Urgent first, then oldest first
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  const quoted  = requests.filter(r => r.status === "Cotizado");
  const shown   = filter === "pending" ? pending : filter === "quoted" ? quoted : [...pending, ...quoted];

  const selected = requests.find(r => r.id === selectedId) || pending[0] || null;

  // Auto-select first pending
  useEffect(() => {
    if (!selectedId && pending.length > 0) setSelectedId(pending[0].id);
  }, [pending.length]);

  // Load photos from localStorage when selected changes
  useEffect(() => {
    if (selectedId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`dropit-photos-${selectedId}`) || "[]");
        setPhotos(Array.isArray(stored) ? stored : []);
      } catch { setPhotos([]); }
    }
  }, [selectedId]);

  // Persist photos to localStorage whenever they change
  useEffect(() => {
    if (selectedId) {
      try { localStorage.setItem(`dropit-photos-${selectedId}`, JSON.stringify(photos)); } catch {}
    }
  }, [photos, selectedId]);

  // Auto-reminders now handled globally in App.jsx via useAutoReminders hook

  // Pre-fill price when selected changes
  useEffect(() => {
    if (selected) {
      const suggested = calcSuggestedPrice(selected);
      // If already quoted, pre-fill from the saved quote so admin can adjust
      const baseAmount = selected.status === "Cotizado" && selected.quotedAmount
        ? String(selected.quotedAmount)
        : suggested ? String(suggested) : (selected.estimatedPrice ? String(selected.estimatedPrice) : "");
      setQuoteForm(f => ({
        ...f,
        quotedAmount: baseAmount,
        serviceType: selected.serviceType || serviceTypes[0],
        internalNotes: selected.internalNotes || "",
        avionetaCount: Number(selected.avionetaCount) || 0,
        peonetaUnitCost: selected.peonetaUnitCost != null ? Number(selected.peonetaUnitCost) : 0,
        discount: Number(selected.discount) || 0,
        manualOverride: false,
        pickupOverride: "",
        deliveryOverride: "",
        pickupCoords: null,
        deliveryCoords: null,
      }));
      setUpdateMode(false);
      setMessage(null);
    }
  }, [selectedId]);

  // ─── Helper: compute final amount from wizard state ────────────────────────
  function getFinalAmount() {
    if (!selected) return 0;
    const liveKm = routeCache[selected.id]?.km;
    const km = Number(selected.distanceKm || liveKm) || 0;
    const weight = Number(selected.estimatedWeightKg) || 0;
    const pickupAddr = quoteForm.pickupOverride || selected.pickupAddress || "";
    const deliveryAddr = quoteForm.deliveryOverride || selected.deliveryAddress || "";
    const isRM = RM_COMUNAS.has(pickupAddr.split(",").pop()?.trim()) ||
                 RM_COMUNAS.has(deliveryAddr.split(",").pop()?.trim());
    const basePrice = km > 0 ? (isRM ? calcRMPrice(km) : calcNationalBase(km)) : 0;
    const weightSurcharge = weight > 500 ? 0.35 : weight > 200 ? 0.25 : weight > 50 ? 0.15 : 0;
    const baseFlete = basePrice > 0 ? Math.round(basePrice * (1 + weightSurcharge) / 1000) * 1000 : 0;
    const peonetaCount = Number(quoteForm.avionetaCount) || 0;
    const peonetaUnit = Number(quoteForm.peonetaUnitCost) || 0;
    const peonetaSubtotal = peonetaCount * peonetaUnit;
    const discount = Number(quoteForm.discount) || 0;
    const calculatedTotal = Math.max(0, baseFlete + peonetaSubtotal - discount);
    return quoteForm.manualOverride
      ? (Number(quoteForm.quotedAmount) || 0)
      : calculatedTotal;
  }

  async function submitQuote(e) {
    e.preventDefault();
    if (!selected) return;

    const finalAmount = getFinalAmount();
    if (finalAmount <= 0) {
      setMessage({ ok: false, text: "El total debe ser mayor a $0. Revisa los pasos del constructor." });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      // Mark as quoted — pass computed final amount + address overrides
      const payload = {
        ...quoteForm,
        quotedAmount: String(finalAmount),
        pickupAddress: quoteForm.pickupOverride || selected.pickupAddress,
        deliveryAddress: quoteForm.deliveryOverride || selected.deliveryAddress,
      };
      const request = await onSendQuote(selected.id, payload);

      // Build PDF HTML for attachment
      const pdfHtml       = buildPDFHtml(selected, finalAmount, selected.photos || []);
      const pdfBase64     = btoa(unescape(encodeURIComponent(pdfHtml)));

      // Send email with PDF attached + confirmation link
      const companyEmail = (() => { try { return JSON.parse(localStorage.getItem("dropit-smtp-config") || "{}").user || ""; } catch { return ""; } })();
      const logoUrl = getLogoUrl();
      const companyName = getCompanyName();
      const isUpdate = updateMode || selected.status === "Cotizado";
      const subjectPrefix = isUpdate ? "Cotización actualizada" : "Cotización confirmada";
      // Build confirmation URL (client clicks to accept online)
      const confirmUrl = `${window.location.origin}/confirmar?id=${selected.id}&token=${request.acceptanceToken || selected.acceptanceToken || ""}`;
      try {
        await fetch(`${API_URL}/mail/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: selected.contactEmail,
            subject: `${subjectPrefix} — ${companyName} · Ref. ${selected.trackingCode}`,
            html: tplCotizacionConfirmada({
              customerName:    selected.customerName,
              trackingCode:    selected.trackingCode,
              pickupAddress:   selected.pickupAddress,
              deliveryAddress: selected.deliveryAddress,
              packages:        selected.packages,
              estimatedWeightKg: selected.estimatedWeightKg,
              distanceKm:      selected.distanceKm,
              serviceType:     quoteForm.serviceType,
              quotedAmount:    finalAmount,
              avionetaCount:   Number(quoteForm.avionetaCount) || selected.avionetaCount || 0,
              requiredDate:    selected.requiredDate,
              requiredTime:    selected.requiredTime,
              internalNotes:   quoteForm.internalNotes,
              isUpdate,
              logoUrl,
              companyName,
              supportEmail:    companyEmail || "soporte@dropit.cl",
              confirmUrl,
            }),
            text: `${subjectPrefix} para ${selected.customerName}. Valor total: $${finalAmount.toLocaleString("es-CL")}${quoteForm.avionetaCount ? ` · Incluye ${quoteForm.avionetaCount} peoneta(s)` : ""}`,
            // PDF adjunto como HTML imprimible
            attachments: [{
              filename: `Cotizacion-${selected.trackingCode}.html`,
              content:  pdfBase64,
              encoding: "base64",
              contentType: "text/html; charset=utf-8",
            }],
          }),
        });
      } catch {}

      // WhatsApp confirmation to client
      if (waConfig?.authToken) {
        try {
          await fetch(`${API_URL}/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountSid: waConfig.accountSid,
              authToken:  waConfig.authToken,
              from: waConfig.fromNumber || "whatsapp:+14155238886",
              to:   selected.contactPhone,
              body:
                `✅ *Cotización lista — ${companyName}*\n\n` +
                `📋 *Código:* ${selected.trackingCode}\n` +
                `💰 *Valor del servicio:* $${Number(quoteForm.quotedAmount).toLocaleString("es-CL")}\n` +
                `🚛 *Servicio:* ${quoteForm.serviceType}\n\n` +
                `Revisa tu correo (${selected.contactEmail}) para ver la cotización completa.\n` +
                `Para confirmar, responde este mensaje o escríbenos.`,
            }),
          });
        } catch {}
      }

      // Log email
      addToLog({
        channel:      "email",
        type:         "cotizacion_enviada",
        mode:         "manual",
        recipient:    selected.contactEmail,
        requestId:    selected.id,
        trackingCode: selected.trackingCode,
        customerName: selected.customerName,
        status:       "sent",
        amount:       Number(quoteForm.quotedAmount),
      });
      // Log WA if configured
      if (waConfig?.authToken) {
        addToLog({
          channel:      "whatsapp",
          type:         "cotizacion_enviada",
          mode:         "manual",
          recipient:    selected.contactPhone,
          requestId:    selected.id,
          trackingCode: selected.trackingCode,
          customerName: selected.customerName,
          status:       "sent",
          amount:       Number(quoteForm.quotedAmount),
        });
      }

      const successText = (updateMode || selected.status === "Cotizado")
        ? `✅ Cotización actualizada y reenviada a ${selected.customerName}`
        : `✅ Cotización enviada a ${selected.customerName}`;
      setMessage({ ok: true, text: successText });
      setQuoteForm({
        quotedAmount: "",
        serviceType: serviceTypes[0],
        internalNotes: "",
        avionetaCount: 0,
        peonetaUnitCost: 0,
        discount: 0,
        manualOverride: false,
        pickupOverride: "",
        deliveryOverride: "",
        pickupCoords: null,
        deliveryCoords: null,
      });
      setUpdateMode(false);
    } catch (err) {
      setMessage({ ok: false, text: `Error: ${err.message}` });
    } finally {
      setSending(false);
    }
  }

  async function handleReminder(type) {
    if (!selected) return;
    const ok = await sendWAReminder(selected, type, waConfig);
    const key = `${selected.id}-${type}`;
    autoSentRef.current.add(key); // prevent auto-re-send
    setReminderSent(prev => ({ ...prev, [key]: ok }));
    addToLog({
      channel:      "whatsapp",
      type:         `reminder_${type}`,
      mode:         "manual",
      recipient:    selected.contactPhone,
      requestId:    selected.id,
      trackingCode: selected.trackingCode,
      customerName: selected.customerName,
      status:       ok ? "sent" : "failed",
    });
    setMessage(ok
      ? { ok: true,  text: `Recordatorio "${type}" enviado por WhatsApp` }
      : { ok: false, text: "Error al enviar recordatorio. Verifica config WA." }
    );
  }

  async function handleAcceptManual() {
    if (!selected || acceptingManual) return;
    if (!window.confirm(`¿Marcar la cotización de ${selected.customerName} como aceptada por el cliente? Se enviarán emails de confirmación.`)) return;
    setAcceptingManual(true);
    try {
      await fetch(`${API_URL}/quote-requests/${selected.id}/accept-manual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setMessage({ ok: true, text: `✅ Cotización marcada como aceptada — emails enviados a ${selected.contactEmail} y al equipo` });
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ ok: false, text: `Error al marcar como aceptado: ${err.message}` });
    } finally {
      setAcceptingManual(false);
    }
  }

  async function handleDeleteQuote() {
    if (!selected) return;
    const confirmed = window.confirm(
      `¿Eliminar esta cotización permanentemente? Esta acción no se puede deshacer.\n\nCliente: ${selected.customerName}\nCódigo: ${selected.trackingCode}`
    );
    if (!confirmed) return;
    setDeletingQuote(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/quote-requests/${selected.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      if (onRefresh) onRefresh();
      setSelectedId(null);
    } catch (err) {
      setMessage({ ok: false, text: `Error al eliminar: ${err.message}` });
    } finally {
      setDeletingQuote(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxPhoto}
              alt="Vista ampliada"
              className="max-h-[85vh] max-w-[85vw] rounded-2xl border border-white/10 object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-100 transition-colors"
            >
              <X size={16} className="text-slate-700" />
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-reminder toast ─────────────────────────────────────────────────── */}
      {/* ── PDF Preview Modal ── */}
      {pdfPreview && (
        <QuotePDFPreview
          html={pdfPreview}
          filename={`Cotizacion-${selected?.trackingCode || "dropit"}.pdf`}
          onClose={() => setPdfPreview(null)}
        />
      )}

      {autoToast && (
        <div className={`fixed bottom-6 right-6 z-[9998] flex max-w-sm items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl transition-all ${
          autoToast.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <span className="text-xl leading-none">{autoToast.ok ? "⚡" : "⚠️"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-0.5">Recordatorio automático</p>
            <p className="text-sm font-semibold">{autoToast.text}</p>
          </div>
          <button onClick={() => setAutoToast(null)} className="text-current opacity-50 hover:opacity-80 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Gestión</p>
          <h2 className="text-2xl font-black text-slate-800">Cotizaciones</h2>
        </div>
        <div className="flex items-center gap-2">
          {["all","pending","quoted"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${filter === f ? "bg-dropit-accent text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-dropit-accent/40"}`}>
              {f === "all" ? `Todas (${requests.length})` : f === "pending" ? `Pendientes (${pending.length})` : `Cotizadas (${quoted.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        {/* ── List ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {pending.length > 0 ? `${pending.length} pendiente${pending.length > 1 ? "s" : ""} — ordenadas por urgencia` : "Sin pendientes"}
            </p>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-slate-100">
            {shown.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Sin solicitudes en esta vista.</p>}
            {shown.map(req => {
              const mins = getElapsedMinutes(req.createdAt);
              const u    = urgencyConfig(mins);
              const isPending = req.status === "Pendiente de cotizacion";
              return (
                <button key={req.id} type="button" onClick={() => setSelectedId(req.id)}
                  className={`block w-full p-4 text-left transition-all hover:bg-slate-50 ${selected?.id === req.id ? "bg-dropit-accent/10 border-l-4 border-dropit-accent" : "border-l-4 border-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isPending && <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${u.dot} ${u.pulse ? "animate-pulse" : ""}`} />}
                        <p className="truncate font-semibold text-slate-900">{req.customerName}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{req.trackingCode}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="mt-1.5 truncate text-xs text-slate-500">{req.deliveryAddress}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isPending && (
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${u.bg} ${u.color}`}>
                        <Clock size={9} /> {formatElapsed(mins)}
                      </span>
                    )}
                    {req.emailSent && <span className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-600"><Mail size={9} />Email</span>}
                    {req.whatsappSent && <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-600"><MessageSquare size={9} />WA</span>}
                    {req.urgent && <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">⚡ Urgente</span>}
                    {(req.avionetaCount > 0 || req.avioneta) && <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600">🧑‍🏭 {req.avionetaCount > 1 ? `${req.avionetaCount}× ` : ""}Peoneta</span>}
                    {req.distanceKm && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{req.distanceKm} km</span>}
                    {selected?.id === req.id && (
                      <span className="xl:hidden flex items-center gap-1 rounded-full bg-dropit-accent px-2 py-0.5 text-[10px] font-bold text-white">
                        ▼ Ver detalle
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Detail ── */}
        {selected ? (
          <div className="space-y-4" ref={detailRef}>
            {/* ── Mobile: back button ── */}
            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} /> Volver a lista
              </button>
            </div>
            {/* Urgency banner for pending */}
            {selected.status === "Pendiente de cotizacion" && (() => {
              const mins = getElapsedMinutes(selected.createdAt);
              const u = urgencyConfig(mins);
              return (
                <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${u.bg}`}>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className={u.color} />
                    <span className={`text-sm font-bold ${u.color}`}>
                      {mins >= 60 ? "⏱ Cotización vencida" : `⏱ ${formatElapsed(mins)} transcurridos`}
                    </span>
                    <span className={`text-xs ${u.color} opacity-70`}>
                      · Recibida el {new Date(selected.createdAt).toLocaleString("es-CL")}
                    </span>
                  </div>
                  {/* WA Reminders */}
                  {waConfig?.authToken && (
                    <div className="flex gap-2">
                      {["30min","45min","60min"].map(type => {
                        const sentKey = `${selected.id}-${type}`;
                        const done = reminderSent[sentKey] || (selected.remindersSent || []).some(r => r.type === type);
                        return (
                          <button key={type} onClick={() => handleReminder(type)} disabled={done}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${done ? "bg-green-100 text-green-700 cursor-default" : "bg-white border border-slate-200 text-slate-700 hover:border-dropit-accent/40 hover:text-dropit-accent"}`}>
                            <Bell size={11} />
                            {done ? "✓" : `WA ${type}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Client + route info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-xl font-black text-slate-950 flex items-center gap-2">
                    {selected.customerName}
                    {selected.urgent && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2.5 py-0.5 text-xs font-bold text-red-600 animate-pulse">⚡ Urgente</span>}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{selected.id} · {selected.trackingCode}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selected.status} />
                  <button onClick={() => setPdfPreview(buildPDFHtml(selected, Number(quoteForm.quotedAmount) || selected.quotedAmount, selected.photos || []))}
                    className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-2 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all shadow-sm">
                    <Eye size={14} /> Vista previa PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteQuote}
                    disabled={deletingQuote}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingQuote ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    {deletingQuote ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>

              {/* ── Bandeja de entrada: bloque de datos completo ───────────── */}
              <div className="grid gap-3 md:grid-cols-2">
                {/* RUT: campo dedicado, con fallback a observaciones para solicitudes antiguas */}
                {(() => {
                  const rut = selected.customerRut || (selected.observations || "").split("\n").find(l => l.startsWith("RUT:"))?.replace("RUT: ", "").trim();
                  return rut ? (
                    <InfoCard icon={User} label="RUT" value={<span className="font-mono font-bold text-slate-900">{rut}</span>} />
                  ) : null;
                })()}
                <InfoCard icon={User}    label="Contacto"       value={selected.contactPerson || selected.customerName} />
                <InfoCard icon={Phone}   label="Teléfono"       value={<a href={`tel:${selected.contactPhone}`} className="text-dropit-accent font-bold">{selected.contactPhone}</a>} />
                <InfoCard icon={Mail}    label="Email cliente"  value={<a href={`mailto:${selected.contactEmail}`} className="text-dropit-accent font-bold truncate">{selected.contactEmail}</a>} />
                <InfoCard icon={Clock}   label="Fecha / Hora"   value={`${selected.requiredDate || "—"}${selected.requiredTime ? ` a las ${selected.requiredTime}` : ""}`} />
                <InfoCard icon={MapPin}  label="📦 Dirección retiro"  value={selected.pickupAddress} />
                <InfoCard icon={MapPin}  label="🏁 Dirección entrega" value={selected.deliveryAddress} />
                <InfoCard icon={Package} label="Carga"          value={`${selected.packages} bultos · ${selected.estimatedWeightKg} kg en total`} />
                {(() => {
                  const live    = routeCache[selected.id];
                  const km      = selected.distanceKm || live?.km;
                  const minutes = live?.durationMin;
                  return (
                    <InfoCard
                      icon={Truck}
                      label="Distancia ruta"
                      value={
                        km ? (
                          <span>
                            <strong className="text-dropit-accent">{km} km</strong>
                            {minutes && <span className="text-xs text-slate-500"> · ~{minutes} min en auto</span>}
                            {!selected.distanceKm && live?.km && (
                              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-200">CALCULADO</span>
                            )}
                          </span>
                        ) : live?.loading ? (
                          <span className="text-slate-500 text-sm flex items-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin" /> Calculando ruta…
                          </span>
                        ) : live?.error ? (
                          <button
                            onClick={() => { setRouteCache(p => ({...p, [selected.id]: undefined})); calcRouteForRequest(selected); }}
                            className="text-amber-600 text-xs font-semibold hover:underline">
                            ⚠ {live.error} — reintentar
                          </button>
                        ) : (
                          <button
                            onClick={() => calcRouteForRequest(selected)}
                            className="text-dropit-accent text-xs font-bold hover:underline">
                            📍 Calcular ruta ahora
                          </button>
                        )
                      }
                    />
                  );
                })()}

                {/* ── Propuesta económica sugerida ────────────────────────────── */}
                {(() => {
                  const liveKm = routeCache[selected.id]?.km;
                  const km     = Number(selected.distanceKm || liveKm) || 0;
                  if (!km) return null;

                  const weight      = Number(selected.estimatedWeightKg) || 0;
                  const peonetaQty  = selected.avionetaCount ?? (selected.avioneta ? 1 : 0);
                  const isRM        = RM_COMUNAS.has((selected.pickupAddress || "").split(",").pop()?.trim()) ||
                                      RM_COMUNAS.has((selected.deliveryAddress || "").split(",").pop()?.trim());
                  const basePrice   = isRM ? calcRMPrice(km) : calcNationalBase(km);
                  const weightSurcharge = weight > 500 ? 0.35 : weight > 200 ? 0.25 : weight > 50 ? 0.15 : 0;
                  const baseFlete   = Math.round(basePrice * (1 + weightSurcharge) / 1000) * 1000;
                  const total       = baseFlete;
                  const zone        = isRM ? "Santiago RM" : km > 500 ? "Larga distancia" : km > 100 ? "Regional" : "Local";
                  return (
                    <div className="md:col-span-2 rounded-xl border-2 border-dropit-accent/30 bg-gradient-to-br from-dropit-accent/5 to-dropit-accent/10 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={16} className="text-dropit-accent" />
                          <p className="text-xs font-black uppercase tracking-wider text-dropit-accent">
                            Propuesta económica sugerida
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          {zone}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                          <span className="text-slate-600">Distancia</span>
                          <strong className="text-slate-900">{km} km</strong>
                        </div>
                        <div className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                          <span className="text-slate-600">Zona / Tarifa</span>
                          <strong className="text-slate-900">{isRM ? "RM $750/km" : "Nacional tramos"}</strong>
                        </div>
                        <div className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                          <span className="text-slate-600">Flete base</span>
                          <strong className="text-slate-900">${basePrice.toLocaleString("es-CL")}</strong>
                        </div>
                        {weightSurcharge > 0 && (
                          <div className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                            <span className="text-slate-600">Recargo peso (+{Math.round(weightSurcharge*100)}%)</span>
                            <strong className="text-slate-900">+${Math.round(basePrice * weightSurcharge).toLocaleString("es-CL")}</strong>
                          </div>
                        )}
                        {peonetaQty > 0 && (
                          <div className="flex justify-between rounded-lg bg-white/70 px-3 py-2">
                            <span className="text-slate-600">🧑‍🏭 {peonetaQty} peoneta{peonetaQty > 1 ? "s" : ""} solicitada{peonetaQty > 1 ? "s" : ""}</span>
                            <strong className="text-slate-500 text-xs italic">precio manual</strong>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-dropit-accent px-4 py-3 text-white shadow-md shadow-dropit-accent/20">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-90">Total sugerido</span>
                        <strong className="text-2xl font-black tracking-tight">${total.toLocaleString("es-CL")}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuoteForm(f => ({ ...f, quotedAmount: String(total) }))}
                        className="mt-3 w-full rounded-lg border border-dropit-accent/30 bg-white px-3 py-2 text-xs font-bold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-colors"
                      >
                        ⚡ Usar este precio en la cotización
                      </button>
                    </div>
                  );
                })()}

                <div className="md:col-span-2">
                  <InfoCard icon={Package} label="Descripción" value={selected.cargoDescription} />
                </div>
                {selected.observations && (
                  <div className="md:col-span-2">
                    <InfoCard icon={FileText} label="Observaciones" value={selected.observations} />
                  </div>
                )}
                {(selected.avionetaCount > 0 || selected.avioneta) && (
                  <div className="md:col-span-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-700">
                        🧑‍🏭 {selected.avionetaCount > 0 ? `${selected.avionetaCount} peoneta${selected.avionetaCount > 1 ? "s" : ""} solicitada${selected.avionetaCount > 1 ? "s" : ""}` : "1 peoneta solicitada"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Fotos del cliente (enviadas en el formulario) ─────────────── */}
              {Array.isArray(selected.photos) && selected.photos.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Camera size={14} className="text-dropit-accent" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Fotos del cliente ({selected.photos.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {selected.photos.map((src, idx) => {
                      const url = photoUrl(src);
                      return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxPhoto(url)}
                        className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all hover:border-dropit-accent/50 hover:shadow-md"
                      >
                        <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                          <ZoomIn size={18} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Detalle de bultos (largo/ancho/alto/peso) ──────────────────── */}
              {Array.isArray(selected.bultosDetail) && selected.bultosDetail.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Package size={14} className="text-dropit-accent" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Medidas por bulto ({selected.bultosDetail.length})
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-3 py-2">Bulto</th>
                          <th className="px-3 py-2">Largo (cm)</th>
                          <th className="px-3 py-2">Ancho (cm)</th>
                          <th className="px-3 py-2">Alto (cm)</th>
                          <th className="px-3 py-2">Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white">
                        {selected.bultosDetail.map((b, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-semibold text-slate-700">#{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-600">{b.largo || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{b.ancho || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{b.alto || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{b.peso || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Quote form */}
            {(selected.status === "Pendiente de cotizacion" || updateMode) && (
              <form onSubmit={submitQuote} className="rounded-2xl border border-dropit-accent/20 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dropit-accent/10">
                      <Send size={16} className="text-dropit-accent" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-950">{updateMode ? "Modificar cotización" : "Enviar cotización"}</h4>
                      <p className="text-xs text-slate-500">{updateMode ? "Se reenviará al cliente con los cambios" : "Se enviará por email y WhatsApp al cliente"}</p>
                    </div>
                  </div>
                  {updateMode && (
                    <button type="button" onClick={() => { setUpdateMode(false); setMessage(null); }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      <X size={12} /> Cancelar
                    </button>
                  )}
                </div>

                {/* ─── Constructor paso a paso ────────────────────────────── */}
                {(() => {
                  const liveKm = routeCache[selected.id]?.km;
                  const km = Number(selected.distanceKm || liveKm) || 0;
                  const weight = Number(selected.estimatedWeightKg) || 0;
                  const pickupAddr = quoteForm.pickupOverride || selected.pickupAddress || "";
                  const deliveryAddr = quoteForm.deliveryOverride || selected.deliveryAddress || "";
                  const isRM = RM_COMUNAS.has(pickupAddr.split(",").pop()?.trim()) ||
                               RM_COMUNAS.has(deliveryAddr.split(",").pop()?.trim());
                  const basePrice = km > 0 ? (isRM ? calcRMPrice(km) : calcNationalBase(km)) : 0;
                  const weightSurcharge = weight > 500 ? 0.35 : weight > 200 ? 0.25 : weight > 50 ? 0.15 : 0;
                  const baseFlete = basePrice > 0 ? Math.round(basePrice * (1 + weightSurcharge) / 1000) * 1000 : 0;
                  const peonetaCount = Number(quoteForm.avionetaCount) || 0;
                  const peonetaUnit = Number(quoteForm.peonetaUnitCost) || 0;
                  const peonetaSubtotal = peonetaCount * peonetaUnit;
                  const discount = Number(quoteForm.discount) || 0;
                  const calculatedTotal = Math.max(0, baseFlete + peonetaSubtotal - discount);
                  const finalTotal = quoteForm.manualOverride
                    ? (Number(quoteForm.quotedAmount) || 0)
                    : calculatedTotal;

                  return (
                    <div className="space-y-4">
                      {/* STEP 1 — Ruta */}
                      <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/30 overflow-hidden">
                        <div className="flex items-center gap-3 bg-blue-100/60 px-4 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-md shadow-blue-300">1</div>
                          <div className="flex-1">
                            <h5 className="text-sm font-black text-blue-900">Confirma la ruta</h5>
                            <p className="text-[11px] text-blue-700">Edita las direcciones si necesitas y recalcula la distancia</p>
                          </div>
                          {km > 0 && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">
                              {km} km
                            </span>
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider block">📦 Origen</label>
                              <StreetAutocomplete
                                value={quoteForm.pickupOverride || selected.pickupAddress || ""}
                                onChange={v => setQuoteForm(f => ({ ...f, pickupOverride: v, pickupCoords: null }))}
                                onCoordsChange={coords => setQuoteForm(f => ({ ...f, pickupCoords: coords }))}
                                placeholder="Dirección de retiro"
                                dotColor="#3B82F6"
                              />
                            </div>
                            <div>
                              <label className="mb-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider block">🏁 Destino</label>
                              <StreetAutocomplete
                                value={quoteForm.deliveryOverride || selected.deliveryAddress || ""}
                                onChange={v => setQuoteForm(f => ({ ...f, deliveryOverride: v, deliveryCoords: null }))}
                                onCoordsChange={coords => setQuoteForm(f => ({ ...f, deliveryCoords: coords }))}
                                placeholder="Dirección de entrega"
                                dotColor="#10B981"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button type="button"
                              onClick={() => {
                                const reqForCalc = {
                                  ...selected,
                                  id: selected.id + "__override",
                                  pickupAddress: quoteForm.pickupOverride || selected.pickupAddress,
                                  deliveryAddress: quoteForm.deliveryOverride || selected.deliveryAddress,
                                };
                                // Clear stale cache for this request so it recalculates
                                setRouteCache(prev => {
                                  const next = { ...prev };
                                  delete next[selected.id];
                                  delete next[selected.id + "__override"];
                                  return next;
                                });
                                calcRouteForRequest(
                                  { ...reqForCalc, id: selected.id },
                                  {
                                    pickup:   quoteForm.pickupCoords   || undefined,
                                    delivery: quoteForm.deliveryCoords || undefined,
                                  }
                                );
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm">
                              <RefreshCw size={12} /> Recalcular ruta
                            </button>
                            {km > 0 && (
                              <div className="text-xs font-bold text-blue-900">
                                Zona: {isRM ? "Santiago RM" : km > 500 ? "Larga distancia" : km > 100 ? "Regional" : "Local"} · Base ${basePrice.toLocaleString("es-CL")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* STEP 2 — Peonetas */}
                      <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/30 overflow-hidden">
                        <div className="flex items-center gap-3 bg-amber-100/60 px-4 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-black text-white shadow-md shadow-amber-300">2</div>
                          <div className="flex-1">
                            <h5 className="text-sm font-black text-amber-900">Peonetas requeridos</h5>
                            <p className="text-[11px] text-amber-700">
                              Cliente solicitó <strong>{selected.avionetaCount || 0}</strong>. Tú decides cuántos incluir y el costo unitario.
                            </p>
                          </div>
                          {peonetaCount > 0 && (
                            <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white">
                              🧑‍🏭 {peonetaCount}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-4 p-4 md:grid-cols-2">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cantidad</label>
                            <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-white px-2 py-1.5">
                              <button type="button"
                                onClick={() => setQuoteForm(f => ({ ...f, avionetaCount: Math.max(0, Number(f.avionetaCount) - 1) }))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-amber-600 hover:bg-amber-100 disabled:opacity-30 transition-colors"
                                disabled={!Number(quoteForm.avionetaCount)}>−</button>
                              <span className="flex-1 text-center text-xl font-black text-slate-900">{Number(quoteForm.avionetaCount) || 0}</span>
                              <button type="button"
                                onClick={() => setQuoteForm(f => ({ ...f, avionetaCount: Math.min(5, (Number(f.avionetaCount) || 0) + 1) }))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-amber-600 hover:bg-amber-100 transition-colors">+</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Valor unitario por peoneta (CLP)</label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">$</span>
                              <input className="input-base pl-7 font-bold" type="number" min="0" step="1000"
                                inputMode="numeric"
                                value={quoteForm.peonetaUnitCost}
                                onChange={e => setQuoteForm(f => ({ ...f, peonetaUnitCost: Number(e.target.value) || 0 }))}
                                placeholder="0 = solo registrar cantidad" />
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">Déjalo en 0 para registrar la cantidad sin afectar el precio</p>
                          </div>
                          {peonetaCount > 0 && (
                            <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-white border-2 border-amber-200 px-3 py-2 shadow-sm">
                              <span className="text-xs font-semibold text-slate-600">Subtotal peonetas</span>
                              <strong className="text-base font-black text-amber-700">{peonetaCount} × ${peonetaUnit.toLocaleString("es-CL")} = ${peonetaSubtotal.toLocaleString("es-CL")}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* STEP 3 — Precio final + detalles */}
                      <div className="rounded-2xl border-2 border-dropit-accent/30 bg-gradient-to-br from-dropit-accent/5 to-dropit-accent/10 overflow-hidden">
                        <div className="flex items-center gap-3 bg-dropit-accent/15 px-4 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dropit-accent text-sm font-black text-white shadow-md shadow-dropit-accent/40">3</div>
                          <div className="flex-1">
                            <h5 className="text-sm font-black text-dropit-accent">Precio final</h5>
                            <p className="text-[11px] text-dropit-700">Desglose transparente — puedes ajustar el descuento o sobrescribir el total</p>
                          </div>
                          <span className="rounded-full bg-dropit-accent px-2.5 py-1 text-[11px] font-bold text-white">
                            ${finalTotal.toLocaleString("es-CL")}
                          </span>
                        </div>
                        <div className="space-y-3 p-4">
                          {/* Breakdown */}
                          <div className="space-y-1.5 rounded-xl bg-white/80 p-3 text-sm shadow-inner">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Flete base {km > 0 ? `(${km} km)` : "(sin ruta)"}</span>
                              <strong className="text-slate-900">${basePrice.toLocaleString("es-CL")}</strong>
                            </div>
                            {weightSurcharge > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-600">Recargo peso ({weight} kg, +{Math.round(weightSurcharge * 100)}%)</span>
                                <strong className="text-slate-900">+${Math.round(basePrice * weightSurcharge).toLocaleString("es-CL")}</strong>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-1.5">
                              <span className="text-slate-700 font-semibold">Subtotal flete</span>
                              <strong className="text-slate-900">${baseFlete.toLocaleString("es-CL")}</strong>
                            </div>
                            {peonetaCount > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-600">🧑‍🏭 Peonetas ({peonetaCount} × ${peonetaUnit.toLocaleString("es-CL")})</span>
                                <strong className="text-slate-900">+${peonetaSubtotal.toLocaleString("es-CL")}</strong>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                              <span className="text-slate-600">Descuento</span>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500">−$</span>
                                <input className="w-32 rounded-md border-2 border-red-200 bg-red-50/40 pl-7 pr-2 py-1 text-right text-sm font-bold text-red-700 focus:border-red-400 focus:outline-none" type="number" min="0" step="500"
                                  value={quoteForm.discount}
                                  onChange={e => setQuoteForm(f => ({ ...f, discount: Number(e.target.value) || 0 }))}
                                  placeholder="0" />
                              </div>
                            </div>
                          </div>

                          {/* Total banner */}
                          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-dropit-accent to-dropit-accent-dark px-4 py-3 text-white shadow-lg shadow-dropit-accent/30">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Total a cotizar al cliente</p>
                              <p className="text-[10px] opacity-75">{quoteForm.manualOverride ? "Sobrescrito manualmente" : "Calculado automáticamente"}</p>
                            </div>
                            <strong className="text-3xl font-black tracking-tight">${finalTotal.toLocaleString("es-CL")}</strong>
                          </div>

                          {/* Manual override */}
                          <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox"
                                checked={quoteForm.manualOverride}
                                onChange={e => setQuoteForm(f => ({
                                  ...f,
                                  manualOverride: e.target.checked,
                                  quotedAmount: e.target.checked ? String(calculatedTotal) : f.quotedAmount,
                                }))}
                                className="h-4 w-4 rounded border-slate-300 text-dropit-accent focus:ring-dropit-accent" />
                              <span className="text-xs font-bold text-slate-700">Sobrescribir total manualmente</span>
                            </label>
                            {quoteForm.manualOverride && (
                              <div className="mt-2 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">$</span>
                                <input className="input-base pl-7 text-right text-lg font-black text-dropit-accent" type="number" min="0"
                                  value={quoteForm.quotedAmount}
                                  onChange={e => setQuoteForm(f => ({ ...f, quotedAmount: e.target.value }))}
                                  placeholder="0" />
                              </div>
                            )}
                          </div>

                          {/* Tipo de servicio + comentarios */}
                          <div className="grid gap-3 md:grid-cols-2 pt-1">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tipo de servicio</label>
                              <select className="input-base mt-1" value={quoteForm.serviceType}
                                onChange={e => setQuoteForm(f => ({ ...f, serviceType: e.target.value }))}>
                                {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <p className="text-[10px] text-slate-500 leading-tight">
                                ✓ Las peonetas se mencionan en el correo<br />
                                ✓ El PDF incluye desglose completo
                              </p>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Comentarios para el cliente (visibles en el correo)</label>
                            <textarea className="input-base mt-1 min-h-[64px] resize-none text-sm"
                              value={quoteForm.internalNotes}
                              onChange={e => setQuoteForm(f => ({ ...f, internalNotes: e.target.value }))}
                              placeholder="Detalles del servicio, condiciones especiales, contacto del conductor..." />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid gap-4 mt-4 md:grid-cols-2">
                  {/* Photo upload */}
                  <div className="md:col-span-2">
                    <label className="label-base">Fotos adjuntas (máx. 6)</label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {photos.map((src, idx) => (
                        <div key={idx} className="relative group">
                          <img src={src} alt={`foto-${idx + 1}`} className="h-20 w-20 rounded-lg object-cover border border-slate-200 shadow-sm" />
                          <button type="button" onClick={() => removePhoto(idx)}
                            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {photos.length < 6 && (
                        <button type="button" onClick={() => photoInputRef.current?.click()}
                          className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-dropit-accent/40 hover:text-dropit-accent transition-colors">
                          <span className="text-2xl">+</span>
                          <span className="text-[9px] font-semibold">Foto</span>
                        </button>
                      )}
                      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                    </div>
                    {photos.length > 0 && <p className="mt-1 text-[10px] text-slate-400">{photos.length} foto{photos.length > 1 ? "s" : ""} adjunta{photos.length > 1 ? "s" : ""} · se incluirán en el PDF</p>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={sending || getFinalAmount() <= 0}
                    className="flex items-center gap-2 rounded-xl bg-dropit-accent px-6 py-3 text-sm font-bold text-white shadow-md shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? "Enviando..." : (updateMode ? `Reenviar — $${getFinalAmount().toLocaleString("es-CL")}` : `Enviar cotización — $${getFinalAmount().toLocaleString("es-CL")}`)}
                  </button>
                  <button type="button" onClick={() => setPdfPreview(buildPDFHtml(selected, getFinalAmount(), selected.photos || []))}
                    className="flex items-center gap-2 rounded-xl border border-dropit-accent/30 bg-dropit-accent/5 px-5 py-3 text-sm font-bold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all">
                    <Eye size={15} /> Vista previa PDF
                  </button>
                </div>

                {message && (
                  <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {message.text}
                  </div>
                )}
              </form>
            )}

            {/* Already quoted */}
            {selected.status === "Cotizado" && !updateMode && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-800">Cotización enviada al cliente</p>
                      <p className="text-sm text-emerald-700">
                        Valor: <strong>${Number(selected.quotedAmount).toLocaleString("es-CL")}</strong> · {selected.serviceType}
                        {(Number(selected.avionetaCount) > 0) && <> · <strong>{selected.avionetaCount} peoneta{selected.avionetaCount > 1 ? "s" : ""}</strong></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setUpdateMode(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-dropit-accent px-3 py-2 text-xs font-bold text-white shadow hover:bg-dropit-accent-dark transition-all">
                      <RefreshCw size={13} /> Modificar y reenviar
                    </button>
                  </div>
                </div>
                {/* Confirmation link + manual accept */}
                <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 space-y-3">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Opciones de confirmación</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleAcceptManual}
                      disabled={acceptingManual}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-all disabled:opacity-60"
                    >
                      {acceptingManual ? <RefreshCw size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
                      {acceptingManual ? "Procesando..." : "Cliente aceptó (por teléfono / chat)"}
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/confirmar?id=${selected.id}&token=${selected.acceptanceToken || ""}`;
                        navigator.clipboard?.writeText(url).catch(() => {});
                        window.open(url, "_blank");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-all"
                    >
                      <Eye size={13} /> Ver página del cliente
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    O comparte el link de confirmación con el cliente para que acepte online.
                  </p>
                </div>
                {message && (
                  <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-emerald-100 border border-emerald-300 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {message.text}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end">
                  <button onClick={() => setPdfPreview(buildPDFHtml(selected, selected.quotedAmount, selected.photos || []))}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-all">
                    <Eye size={14} /> Ver PDF
                  </button>
                </div>
              </div>
            )}

            {/* Already accepted by client */}
            {selected.status === "Aceptado por cliente" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-center gap-3">
                  <ThumbsUp size={22} className="text-blue-600" />
                  <div>
                    <p className="font-bold text-blue-800">✅ Cliente aceptó la cotización</p>
                    <p className="text-sm text-blue-700">
                      Valor confirmado: <strong>${Number(selected.quotedAmount).toLocaleString("es-CL")}</strong>
                      {selected.acceptedAt && <> · {new Date(selected.acceptedAt).toLocaleString("es-CL")}</>}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      🚛 El pedido ya está disponible en el módulo de <strong>Planificación</strong> para asignar ruta y camión.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden xl:flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
            <div>
              <Truck size={40} className="mx-auto mb-4 text-dropit-accent/30" />
              <p className="font-semibold text-slate-600">Selecciona una cotización de la lista</p>
              <p className="mt-1 text-sm text-slate-400">para ver los detalles y cotizar</p>
            </div>
          </div>
        )}
      </div>

      {/* Quoted table */}
      {quoted.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-bold text-slate-700">Cotizaciones enviadas ({quoted.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                  {["Código","Cliente","Retiro → Entrega","Distancia","Valor","Servicio","Enviado","PDF"].map(h => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quoted.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-dropit-accent">{req.trackingCode}</td>
                    <td className="px-4 py-3 font-semibold">{req.customerName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{req.pickupAddress} → {req.deliveryAddress}</td>
                    <td className="px-4 py-3">{req.distanceKm ? `${req.distanceKm} km` : "—"}</td>
                    <td className="px-4 py-3 font-bold text-dropit-accent">${Number(req.quotedAmount).toLocaleString("es-CL")}</td>
                    <td className="px-4 py-3 text-slate-600">{req.serviceType}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {req.emailSent && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">📧</span>}
                        {req.whatsappSent && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">💬</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPdfPreview(buildPDFHtml(req, req.quotedAmount, req.photos || []))}
                        className="flex items-center gap-1 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-2.5 py-1.5 text-xs font-semibold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all">
                        <Eye size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-dropit-accent" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}
