import {
  AlertTriangle, Camera, CheckCircle2, Clock, Download, FileText,
  Mail, MessageSquare, Phone, Send, Truck, User, X, Zap,
  MapPin, Package, RefreshCw, Bell, ZoomIn, Eye,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addToLog } from "../lib/messageLog";
import { api } from "../lib/api";
import { getCompanyName, getLogoUrl, tplEmpresaNuevaCotizacion } from "../lib/emailTemplates";
import { serviceTypes } from "../lib/constants";
import StatusBadge from "./StatusBadge";
import QuotePDFPreview from "./QuotePDFPreview";
import { loadGoogleMaps } from "./GoogleMap";
import { calcPrice, calcNationalBase, calcRMPrice } from "../lib/pricing";

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

function calcSuggestedPrice(req) {
  if (!req.distanceKm) return null;
  const isRM = RM_COMUNAS.has((req.pickupAddress || "").split(",").pop()?.trim()) ||
               RM_COMUNAS.has((req.deliveryAddress || "").split(",").pop()?.trim());
  if (!isRM) return null;
  const rate = req.estimatedWeightKg > 50 ? 3000 : 2200;
  const base = Math.round(req.distanceKm * rate);
  const avionetaCount = req.avionetaCount ?? (req.avioneta ? 1 : 0);
  const avioneta = avionetaCount * 50000;
  return base + avioneta;
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
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 0; }
  .header { background: linear-gradient(135deg, #F97316 0%, #C2590A 55%, #7C3308 100%); padding: 32px 40px; color: #fff; }
  .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
  .logo-img { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); }
  .logo-fallback { width: 52px; height: 52px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #fff; border: 2px solid rgba(255,255,255,0.3); }
  .company-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
  .doc-title { font-size: 30px; font-weight: 900; }
  .doc-subtitle { font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 6px; }
  .body { padding: 32px 40px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 800; color: #F97316; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #fed7aa; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-card { background: #fff8f1; border: 1px solid #fed7aa; border-left: 3px solid #F97316; border-radius: 6px; padding: 10px 14px; }
  .info-label { font-size: 10px; color: #C2590A; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 13px; color: #1f2937; font-weight: 500; margin-top: 2px; }
  .price-box { background: linear-gradient(135deg, #F97316 0%, #C2590A 100%); color: #fff; border-radius: 12px; padding: 24px 32px; text-align: center; margin: 24px 0; }
  .price-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
  .price-amount { font-size: 42px; font-weight: 900; margin: 6px 0; letter-spacing: -1px; }
  .price-note { font-size: 11px; opacity: 0.7; }
  .route-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 16px; }
  .route-point { flex: 1; }
  .route-point-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
  .route-point-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 2px; }
  .route-arrow { font-size: 20px; color: #F97316; flex-shrink: 0; }
  .footer { margin-top: 32px; padding: 20px 40px; background: #1a0f05; color: rgba(255,255,255,0.5); font-size: 10px; text-align: center; }
  .footer strong { color: #F97316; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: rgba(249,115,22,0.15); color: #C2590A; border: 1px solid rgba(249,115,22,0.3); }
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
        <div class="info-card"><div class="info-label">RUT</div><div class="info-value">${(request.observations || "").split("\n")[0]?.replace("RUT: ", "") || "—"}</div></div>
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
      ${request.distanceKm ? `<p style="margin-top:8px;font-size:12px;color:#6b7280;">📏 Distancia calculada: <strong style="color:#F97316;">${request.distanceKm} km</strong></p>` : ""}
      <div style="margin-top:12px;text-align:center;">
        <a href="https://www.google.com/maps/dir/${encodeURIComponent(request.pickupAddress + ", Chile")}/${encodeURIComponent(request.deliveryAddress + ", Chile")}"
          target="_blank" style="display:inline-block;background:#F97316;color:#fff;padding:8px 20px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">
          🗺️ Ver ruta en Google Maps
        </a>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalle de carga</div>
      <div class="grid-2">
        <div class="info-card"><div class="info-label">Bultos / Peso</div><div class="info-value">${request.packages} bultos · ${request.estimatedWeightKg} kg</div></div>
        <div class="info-card"><div class="info-label">Fecha requerida</div><div class="info-value">${request.requiredDate || "—"}${request.requiredTime ? ` a las ${request.requiredTime}` : ""}</div></div>
        <div class="info-card" style="grid-column:1/-1"><div class="info-label">Descripción</div><div class="info-value">${request.cargoDescription}</div></div>
        ${(request.avionetaCount > 0 || request.avioneta) ? `<div class="info-card" style="grid-column:1/-1"><div class="info-label">Servicio adicional</div><div class="info-value">✓ ${request.avionetaCount > 0 ? `${request.avionetaCount} peoneta${request.avionetaCount > 1 ? "s" : ""} incluida${request.avionetaCount > 1 ? "s" : ""} (+$${(request.avionetaCount * 50000).toLocaleString("es-CL")})` : "Avioneta/Cargador incluido (+$50.000)"}</div></div>` : ""}
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
export default function AdminQuotesModule({ requests, onSendQuote }) {
  const tick = useTick(30000); // re-render every 30s to update timers
  const [selectedId, setSelectedId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({ quotedAmount: "", serviceType: serviceTypes[0], internalNotes: "" });
  const [photos, setPhotos] = useState([]); // base64 strings, max 3
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null); // {ok, text}
  const [waConfig, setWaConfig] = useState(null);
  const [reminderSent, setReminderSent] = useState({}); // {requestId: {type: boolean}}
  const [filter, setFilter] = useState("all"); // all | pending | quoted
  const [lightboxPhoto, setLightboxPhoto] = useState(null); // src string or null
  const [autoToast, setAutoToast] = useState(null); // {ok, text}
  const [pdfPreview, setPdfPreview] = useState(null); // HTML string or null
  // ─── On-demand distance calculation per request ─────────────────────────────
  // Caches computed km by requestId so we don't re-geocode every selection
  const [routeCache, setRouteCache] = useState({}); // { [requestId]: {km, durationMin, loading, error} }
  const autoSentRef = useRef(new Set()); // tracks keys "requestId-type" sent this session
  const photoInputRef = useRef(null);

  useEffect(() => {
    try { setWaConfig(JSON.parse(localStorage.getItem("dropit-whatsapp-config") || "null")); } catch {}
  }, []);

  // ─── Geocode + OSRM route → live km calculation ─────────────────────────────
  // Runs whenever a request is selected. If the request already has distanceKm
  // we do nothing. Otherwise we geocode both addresses via Google and ask OSRM
  // for the driving distance. Result cached per requestId.
  async function calcRouteForRequest(req) {
    if (!req || routeCache[req.id]?.km || routeCache[req.id]?.loading) return;
    if (!req.pickupAddress || !req.deliveryAddress) return;

    setRouteCache(prev => ({ ...prev, [req.id]: { loading: true } }));

    // Helper: reject after N ms
    const timeout = (ms, msg = "Timeout") => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));

    // Nominatim geocode — no API key needed, works everywhere
    const nominatimGeocode = async (addr) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ", Chile")}&limit=1`;
      const res = await Promise.race([fetch(url, { headers: { "Accept-Language": "es" } }), timeout(7000, "Geocode timeout")]);
      const data = await res.json();
      if (!data[0]) throw new Error("Dirección no encontrada");
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    };

    try {
      const [pc, dc] = await Promise.all([nominatimGeocode(req.pickupAddress), nominatimGeocode(req.deliveryAddress)]);
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
      setQuoteForm(f => ({
        ...f,
        quotedAmount: suggested ? String(suggested) : (selected.estimatedPrice ? String(selected.estimatedPrice) : f.quotedAmount),
        serviceType: selected.serviceType || serviceTypes[0],
        internalNotes: selected.internalNotes || "",
      }));
      setMessage(null);
    }
  }, [selectedId]);

  async function submitQuote(e) {
    e.preventDefault();
    if (!selected) return;
    setSending(true);
    setMessage(null);
    try {
      // Mark as quoted
      const request = await onSendQuote(selected.id, quoteForm);

      // Build PDF HTML for attachment
      const finalAmount   = Number(quoteForm.quotedAmount);
      const pdfHtml       = buildPDFHtml(selected, finalAmount, selected.photos || []);
      const pdfBase64     = btoa(unescape(encodeURIComponent(pdfHtml)));

      // Send email with PDF attached
      const companyEmail = (() => { try { return JSON.parse(localStorage.getItem("dropit-smtp-config") || "{}").email || ""; } catch { return ""; } })();
      const logoUrl = getLogoUrl();
      const companyName = getCompanyName();
      if (companyEmail) {
        try {
          await fetch(`${API_URL}/mail/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: selected.contactEmail,
              subject: `Cotización lista — ${companyName} · Ref. ${selected.trackingCode}`,
              html: tplEmpresaNuevaCotizacion({
                customerName: selected.customerName,
                rut: (selected.observations || "").split("\n")[0]?.replace("RUT: ", "") || "—",
                contactPhone: selected.contactPhone,
                contactEmail: selected.contactEmail,
                pickupAddress: selected.pickupAddress,
                pickupCommune: "",
                deliveryAddress: selected.deliveryAddress,
                deliveryCommune: "",
                packages: selected.packages,
                estimatedWeightKg: selected.estimatedWeightKg,
                cargoDescription: selected.cargoDescription,
                requiredDate: selected.requiredDate,
                requiredTime: selected.requiredTime,
                observations: selected.observations,
                trackingCode: selected.trackingCode,
                logoUrl, companyName,
                distanceKm: selected.distanceKm,
                estimatedPrice: finalAmount,
                imageCount: 0,
              }),
              text: `Cotización lista para ${selected.customerName}. Valor: $${finalAmount.toLocaleString("es-CL")}`,
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
      }

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

      setMessage({ ok: true, text: `✅ Cotización enviada a ${selected.customerName}` });
      setQuoteForm({ quotedAmount: "", serviceType: serviceTypes[0], internalNotes: "" });
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
                  className={`block w-full p-4 text-left transition-all hover:bg-slate-50 ${selected?.id === req.id ? "bg-dropit-accent/5 border-l-2 border-dropit-accent" : "border-l-2 border-transparent"}`}>
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Detail ── */}
        {selected ? (
          <div className="space-y-4">
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <button onClick={() => setPdfPreview(buildPDFHtml(selected, Number(quoteForm.quotedAmount) || selected.quotedAmount, selected.photos || []))}
                    className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-2 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all shadow-sm">
                    <Eye size={14} /> Vista previa PDF
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoCard icon={User}    label="Contacto"       value={selected.contactPerson} />
                <InfoCard icon={Phone}   label="Teléfono"       value={<a href={`tel:${selected.contactPhone}`} className="text-dropit-accent font-semibold">{selected.contactPhone}</a>} />
                <InfoCard icon={Mail}    label="Email"          value={<a href={`mailto:${selected.contactEmail}`} className="text-dropit-accent font-semibold">{selected.contactEmail}</a>} />
                <InfoCard icon={Clock}   label="Fecha / Hora"   value={`${selected.requiredDate || "—"}${selected.requiredTime ? ` a las ${selected.requiredTime}` : ""}`} />
                <InfoCard icon={MapPin}  label="📦 Retiro"      value={selected.pickupAddress} />
                <InfoCard icon={MapPin}  label="🏁 Entrega"     value={selected.deliveryAddress} />
                <InfoCard icon={Package} label="Carga"          value={`${selected.packages} bultos · ${selected.estimatedWeightKg} kg`} />
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
                  const peonetaCost = peonetaQty * 50000;
                  const total       = baseFlete + peonetaCost;
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
                            <span className="text-slate-600">{peonetaQty} peoneta{peonetaQty > 1 ? "s" : ""} (× $50.000)</span>
                            <strong className="text-slate-900">+${peonetaCost.toLocaleString("es-CL")}</strong>
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
                        🧑‍🏭 {selected.avionetaCount > 0 ? `${selected.avionetaCount} peoneta${selected.avionetaCount > 1 ? "s" : ""} solicitada${selected.avionetaCount > 1 ? "s" : ""} (+$${(selected.avionetaCount * 50000).toLocaleString("es-CL")})` : "Avioneta/Cargador solicitado (+$50.000)"}
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
            {selected.status === "Pendiente de cotizacion" && (
              <form onSubmit={submitQuote} className="rounded-2xl border border-dropit-accent/20 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dropit-accent/10">
                    <Send size={16} className="text-dropit-accent" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-950">Enviar cotización</h4>
                    <p className="text-xs text-slate-500">Se enviará por email y WhatsApp al cliente</p>
                  </div>
                </div>

                {/* Price suggestion */}
                {(() => {
                  const suggested = calcSuggestedPrice(selected);
                  return suggested ? (
                    <div className="mb-4 flex items-center justify-between rounded-xl bg-dropit-accent/8 border border-dropit-accent/20 px-4 py-3">
                      <div>
                        <p className="text-xs font-bold text-dropit-700">💡 Precio calculado automáticamente</p>
                        <p className="text-2xl font-black text-dropit-accent">${suggested.toLocaleString("es-CL")}</p>
                        {(selected.avionetaCount > 0 || selected.avioneta) && <p className="text-[10px] text-dropit-600">Incluye {selected.avionetaCount || 1} peoneta(s) +${((selected.avionetaCount || 1) * 50000).toLocaleString("es-CL")}</p>}
                      </div>
                      <button type="button" onClick={() => setQuoteForm(f => ({ ...f, quotedAmount: String(suggested) }))}
                        className="rounded-lg bg-dropit-accent px-3 py-2 text-xs font-bold text-white hover:bg-dropit-accent-dark transition-all">
                        Usar este valor
                      </button>
                    </div>
                  ) : null;
                })()}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label-base">Valor final del servicio (CLP)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">$</span>
                      <input className="input-base pl-7 text-lg font-bold" type="number" min="0"
                        value={quoteForm.quotedAmount}
                        onChange={e => setQuoteForm(f => ({ ...f, quotedAmount: e.target.value }))}
                        required placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="label-base">Tipo de servicio</label>
                    <select className="input-base" value={quoteForm.serviceType}
                      onChange={e => setQuoteForm(f => ({ ...f, serviceType: e.target.value }))}>
                      {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label-base">Notas internas (no se envían al cliente)</label>
                    <textarea className="input-base min-h-[72px] resize-none"
                      value={quoteForm.internalNotes}
                      onChange={e => setQuoteForm(f => ({ ...f, internalNotes: e.target.value }))}
                      placeholder="Comentarios internos sobre el pedido..." />
                  </div>

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
                  <button type="submit" disabled={sending || !quoteForm.quotedAmount}
                    className="flex items-center gap-2 rounded-xl bg-dropit-accent px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all disabled:opacity-50">
                    {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? "Enviando..." : "Enviar cotización"}
                  </button>
                  <button type="button" onClick={() => setPdfPreview(buildPDFHtml(selected, Number(quoteForm.quotedAmount) || 0, selected.photos || []))}
                    className="flex items-center gap-2 rounded-xl border border-dropit-accent/30 bg-dropit-accent/5 px-5 py-2.5 text-sm font-bold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all">
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
            {selected.status === "Cotizado" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-800">Cotización enviada</p>
                      <p className="text-sm text-emerald-700">Valor: <strong>${Number(selected.quotedAmount).toLocaleString("es-CL")}</strong> · {selected.serviceType}</p>
                    </div>
                  </div>
                  <button onClick={() => setPdfPreview(buildPDFHtml(selected, selected.quotedAmount, selected.photos || []))}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-all">
                    <Eye size={14} /> Ver PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
            <div>
              <Zap size={32} className="mx-auto mb-3 text-dropit-accent/40" />
              <p className="font-semibold text-slate-600">Selecciona una solicitud</p>
              <p className="mt-1 text-sm text-slate-400">para ver el detalle y cotizar</p>
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
