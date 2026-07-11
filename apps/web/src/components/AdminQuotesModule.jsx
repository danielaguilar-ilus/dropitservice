import {
  AlertTriangle, Camera, CheckCircle2, Clock, Download, FileText,
  Mail, MessageSquare, Phone, Send, Truck, User, X, Zap,
  MapPin, Package, RefreshCw, Bell, ZoomIn, Eye, ThumbsUp, Trash2,
  ChevronLeft, ChevronRight, Lock, Pencil, Check, Inbox, Wrench,
  Route as RouteIcon,
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

const API_URL  = import.meta.env.VITE_API_URL || "/api";
const API_BASE = API_URL.replace(/\/api\/?$/, ""); // strip trailing /api â†’ http://localhost:4000

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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Live timer hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useTick(intervalMs = 15000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

// â”€â”€â”€ PDF Generator â€” returns HTML string (no side effects) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildPDFHtml(request, finalAmount, photos = []) {
  const companyName = getCompanyName();
  const logoUrl = getLogoUrl();
  const now = new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const price = finalAmount || request.estimatedPrice || 0;

  // Format CLP
  const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

  // Status label
  const statusLabel = (() => {
    const s = request.status || "";
    if (s === "Pendiente de cotizacion") return "Pendiente de cotización";
    if (s === "Cotizado")                return "Cotización enviada";
    if (s === "Aceptado")                return "Aceptada";
    return s || "—";
  })();

  // Price breakdown (neto + IVA)
  const neto = price ? Math.round(price / 1.19) : 0;
  const iva  = price ? price - neto : 0;

  // Route stops (retiro + 1..N entregas) rendered as a vertical timeline
  const routeHtml = (() => {
    const stops = Array.isArray(request.deliveryStops) ? request.deliveryStops : [];
    const entregas = stops.length > 1
      ? stops.map((s, i) => ({ label: `Entrega ${i + 1}`, text: `${s.address}${s.commune ? `, ${s.commune}` : ""}` }))
      : [{ label: "Entrega", text: request.deliveryAddress || "—" }];
    const all = [{ label: "Retiro", text: request.pickupAddress || "—", solid: true }, ...entregas];
    return all.map((p, i) => {
      const last = i === all.length - 1;
      return `
        <div class="route-stop">
          <div class="route-rail">
            <span class="dot ${p.solid ? "dot-solid" : "dot-open"}"></span>
            ${last ? "" : '<span class="rail-line"></span>'}
          </div>
          <div class="route-body" style="${last ? "padding-bottom:0" : ""}">
            <div class="route-label">${p.label}</div>
            <div class="route-text">${p.text}</div>
          </div>
        </div>`;
    }).join("");
  })();

  // Peonetas (personal de apoyo)
  const peonetas = (request.avionetaCount > 0 || request.avioneta)
    ? String(request.avionetaCount > 0 ? request.avionetaCount : 1)
    : "";

  // Observations
  const obsHtml = request.observations
    ? `<div class="note-block">
         <div class="f-label">Observaciones</div>
         <div class="f-value">${request.observations}</div>
       </div>`
    : "";

  // CTAs — use window.location.origin so they point to the live deployment
  const _origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlAceptar  = `${_origin}/confirmar?id=${request.id}&tracking=${request.trackingCode}`;
  const _phoneDigits = (request.contactPhone || "").replace(/\D/g, "");
  const _waPhone    = _phoneDigits.startsWith("56") ? _phoneDigits : `56${_phoneDigits.replace(/^0/, "")}`;
  const urlWhatsapp = _waPhone.length >= 10
    ? `https://wa.me/${_waPhone}?text=Hola%20${encodeURIComponent(request.customerName)}%2C%20te%20contactamos%20por%20tu%20cotizaci%C3%B3n%20${request.trackingCode}`
    : `https://wa.me/?text=Cotizaci%C3%B3n%20${request.trackingCode}`;
  const ctaTracking = request.trackingCode
    ? `<div class="cta-tracking"><a href="${urlAceptar}">Ver seguimiento online de la cotización ${request.trackingCode}</a></div>`
    : "";

  // RUT
  const rut = request.customerRut
    || (request.observations || "").split("\n").find(l => l.startsWith("RUT:"))?.replace("RUT:", "").trim()
    || "—";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${request.trackingCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 10mm 12mm; }
    @media print {
      body { background: white; }
      .card, .price-box, .cta-section, .route-card, table { break-inside: avoid; page-break-inside: avoid; }
    }
    a { color: #F97316; }
    .doc { max-width: 800px; margin: 0 auto; padding: 0 16px 28px; }

    /* ── Header ─────────────────────────────────────────── */
    .topbar { height: 6px; background: #F97316; border-radius: 0 0 3px 3px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 22px 0 18px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { height: 46px; width: 46px; object-fit: cover; border-radius: 10px; display: block; }
    .brand-name { font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: #1e293b; }
    .brand-tag  { font-size: 11px; color: #64748b; margin-top: 1px; }
    .doc-id { text-align: right; }
    .doc-id .kind { font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #F97316; }
    .doc-id .code { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #1e293b; margin: 2px 0; }
    .doc-id .date { font-size: 11px; color: #64748b; }
    .doc-id .status {
      display: inline-block; margin-top: 6px;
      background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;
      border-radius: 50px; padding: 2px 12px;
      font-size: 11px; font-weight: 700;
    }

    /* ── Section titles ─────────────────────────────────── */
    .sec-title {
      font-size: 11px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: #64748b; margin-bottom: 8px;
      display: flex; align-items: center; gap: 7px;
    }
    .sec-title::before { content: ''; display: block; width: 4px; height: 12px; background: #F97316; border-radius: 2px; }

    /* ── Data cards (Cliente / Servicio) ────────────────── */
    .grid-2 { display: flex; gap: 14px; margin-bottom: 18px; }
    .grid-2 > div { flex: 1; min-width: 0; }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .f-row { display: flex; gap: 14px; }
    .f-row + .f-row, .f-row + .f-item, .f-item + .f-item, .f-item + .f-row { margin-top: 9px; }
    .f-item { flex: 1; min-width: 0; }
    .f-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 1px; }
    .f-value { font-size: 13px; color: #0f172a; font-weight: 600; word-break: break-word; }
    .f-value.big { font-size: 15px; font-weight: 800; }

    /* ── Route timeline ─────────────────────────────────── */
    .route-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 18px; }
    .route-stop { display: flex; gap: 12px; }
    .route-rail { display: flex; flex-direction: column; align-items: center; width: 14px; flex-shrink: 0; }
    .dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 3px; flex-shrink: 0; }
    .dot-solid { background: #F97316; box-shadow: 0 0 0 3px #ffedd5; }
    .dot-open  { background: #ffffff; border: 3px solid #1e293b; }
    .rail-line { flex: 1; width: 2px; background: #cbd5e1; min-height: 14px; margin: 3px 0; }
    .route-body { flex: 1; min-width: 0; padding-bottom: 14px; }
    .route-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .route-text  { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 1px; }
    .route-meta { display: flex; gap: 14px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }

    /* ── Cargo table ────────────────────────────────────── */
    table.cargo { width: 100%; border-collapse: collapse; margin-bottom: 10px; border-radius: 10px; overflow: hidden; }
    table.cargo th {
      background: #1e293b; color: #ffffff;
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
      padding: 9px 12px; text-align: left;
    }
    table.cargo th:first-child { border-radius: 8px 0 0 0; }
    table.cargo th:last-child  { border-radius: 0 8px 0 0; }
    table.cargo td {
      padding: 10px 12px;
      font-size: 13px; font-weight: 600; color: #0f172a;
      background: #ffffff;
      border: 1px solid #e2e8f0; border-top: none;
    }
    .note-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-top: 10px; }
    .note-block .f-value { font-weight: 500; white-space: pre-line; }

    /* ── Price box ──────────────────────────────────────── */
    .price-box {
      border: 2px solid #F97316;
      background: #fff7ed;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 18px 0;
    }
    .price-line { display: flex; justify-content: space-between; font-size: 13px; color: #475569; padding: 4px 0; }
    .price-total {
      display: flex; justify-content: space-between; align-items: baseline;
      border-top: 1px solid #fed7aa; margin-top: 8px; padding-top: 10px;
    }
    .price-total .lbl { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #9a3412; }
    .price-total .amount { font-size: 30px; font-weight: 900; letter-spacing: -1px; color: #ea580c; }
    .price-iva { font-size: 11px; color: #9a3412; font-weight: 600; text-align: right; margin-top: 2px; }

    /* ── Condiciones ────────────────────────────────────── */
    .conditions { margin-bottom: 18px; }
    .cond-item { display: flex; gap: 8px; font-size: 12px; color: #475569; margin-bottom: 5px; }
    .cond-item::before { content: '·'; font-weight: 900; color: #F97316; }

    /* ── CTAs ───────────────────────────────────────────── */
    .cta-section { text-align: center; margin: 22px 0 6px; }
    .cta-btn {
      display: inline-block;
      padding: 13px 26px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      margin: 0 6px 10px;
    }
    .btn-accept { background: #F97316; color: #ffffff; border: 2px solid #F97316; }
    .btn-whatsapp { background: #ffffff; color: #1da851; border: 2px solid #25D366; }
    .cta-tracking { font-size: 12px; margin-top: 2px; }
    .cta-tracking a { color: #64748b; text-decoration: underline; }

    /* ── Footer ─────────────────────────────────────────── */
    .footer { text-align: center; border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 14px; color: #94a3b8; font-size: 11px; line-height: 1.8; }
    .footer strong { color: #F97316; font-size: 13px; display: block; margin-bottom: 2px; }
  </style>
</head>
<body>
<div class="topbar"></div>
<div class="doc">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="${companyName}" onerror="this.style.display='none'">
      <div>
        <div class="brand-name">${companyName}</div>
        <div class="brand-tag">Transporte · Fletes · Última milla</div>
      </div>
    </div>
    <div class="doc-id">
      <div class="kind">Cotización</div>
      <div class="code">${request.trackingCode}</div>
      <div class="date">${now}</div>
      <div class="status">${statusLabel}</div>
    </div>
  </div>

  <!-- CLIENTE + SERVICIO -->
  <div class="grid-2">
    <div>
      <div class="sec-title">Cliente</div>
      <div class="card">
        <div class="f-item">
          <div class="f-label">Empresa / Persona</div>
          <div class="f-value big">${request.customerName}</div>
        </div>
        <div class="f-row">
          <div class="f-item">
            <div class="f-label">RUT</div>
            <div class="f-value">${rut}</div>
          </div>
          <div class="f-item">
            <div class="f-label">Contacto</div>
            <div class="f-value">${request.contactPerson || request.customerName}</div>
          </div>
        </div>
        <div class="f-row">
          <div class="f-item">
            <div class="f-label">Teléfono</div>
            <div class="f-value">${request.contactPhone || "—"}</div>
          </div>
          <div class="f-item">
            <div class="f-label">Correo electrónico</div>
            <div class="f-value">${request.contactEmail || "—"}</div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="sec-title">Servicio</div>
      <div class="card">
        <div class="f-row">
          <div class="f-item">
            <div class="f-label">Tipo de servicio</div>
            <div class="f-value big">${request.serviceType || "Flete / Transporte"}</div>
          </div>
        </div>
        <div class="f-row">
          <div class="f-item">
            <div class="f-label">Fecha requerida</div>
            <div class="f-value">${request.requiredDate ? `${request.requiredDate}${request.requiredTime ? ` · ${request.requiredTime}` : ""}` : "—"}</div>
          </div>
          <div class="f-item">
            <div class="f-label">Distancia calculada</div>
            <div class="f-value">${request.distanceKm ? `${request.distanceKm} km` : "—"}</div>
          </div>
        </div>
        ${peonetas ? `
        <div class="f-row">
          <div class="f-item">
            <div class="f-label">Peonetas (personal de apoyo)</div>
            <div class="f-value">${peonetas}</div>
          </div>
        </div>` : ""}
      </div>
    </div>
  </div>

  <!-- RUTA -->
  <div class="sec-title">Ruta del servicio</div>
  <div class="route-card">
    ${routeHtml}
  </div>

  <!-- DETALLE DE CARGA -->
  <div class="sec-title">Detalle de carga</div>
  <table class="cargo">
    <thead>
      <tr>
        <th style="width:15%">Bultos</th>
        <th style="width:20%">Peso estimado</th>
        <th>Descripción de la carga</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${request.packages || "—"}</td>
        <td>${request.estimatedWeightKg ? `${request.estimatedWeightKg} kg` : "—"}</td>
        <td>${request.cargoDescription || "—"}</td>
      </tr>
    </tbody>
  </table>
  ${obsHtml}

  <!-- PRECIO -->
  <div class="price-box">
    ${price ? `
    <div class="price-line"><span>Valor neto</span><span>${clp(neto)}</span></div>
    <div class="price-line"><span>IVA (19%)</span><span>${clp(iva)}</span></div>
    <div class="price-total">
      <span class="lbl">Total del servicio</span>
      <span class="amount">${clp(price)}</span>
    </div>
    <div class="price-iva">Precio incluye IVA</div>` : `
    <div class="price-total" style="border-top:none;margin-top:0;padding-top:0">
      <span class="lbl">Total del servicio</span>
      <span class="amount" style="font-size:22px">Por confirmar</span>
    </div>`}
  </div>

  <!-- CONDICIONES -->
  <div class="conditions">
    <div class="sec-title">Condiciones del servicio</div>
    <div class="cond-item"><span><strong>Incluye:</strong> Traslado puerta a puerta, seguimiento en tiempo real, confirmación de entrega.</span></div>
    <div class="cond-item"><span><strong>No incluye:</strong> Embalaje de mercancía, seguro adicional de carga, almacenaje.</span></div>
    <div class="cond-item"><span><strong>Validez:</strong> Esta cotización es válida por 72 horas desde su emisión.</span></div>
    <div class="cond-item"><span><strong>Pago:</strong> Se coordina con el operador al aceptar la cotización.</span></div>
  </div>

  <!-- CTAs -->
  <div class="cta-section">
    <a href="${urlAceptar}" class="cta-btn btn-accept">Aceptar cotización</a>
    <a href="${urlWhatsapp}" class="cta-btn btn-whatsapp">Contactar por WhatsApp</a>
    ${ctaTracking}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <strong>${companyName}</strong>
    Transporte · Fletes · Última milla · Santiago, Chile
    <br>Cotización generada el ${now} · Válida por 72 horas
  </div>
</div>

<script>
  if (window.location.search.includes('print=1')) {
    window.addEventListener('load', () => setTimeout(() => window.print(), 800));
  }
</script>
</body>
</html>`;

  return html;
}

// â”€â”€â”€ WhatsApp reminder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€ Normalize Chilean phone â†’ whatsapp:+569XXXXXXXX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    "30min": `â° *Recordatorio â€” ${companyName}*\n\nHan pasado 30 minutos desde que recibimos tu solicitud.\n\nðŸ“‹ *Código:* ${request.trackingCode}\nðŸ‘¤ *Cliente:* ${request.customerName}\n\nEstamos preparando tu cotización. Te respondemos pronto.`,
    "45min": `âš ï¸ *Aviso urgente â€” ${companyName}*\n\nHan pasado 45 minutos. Tu cotización está a punto de vencer.\n\nðŸ“‹ *Código:* ${request.trackingCode}\nðŸ‘¤ *Cliente:* ${request.customerName}\nðŸ“ž ${request.contactPhone}\n\n¡Responderemos antes de que se cumpla la hora!`,
    "60min": `ðŸ”´ *Cotización vencida â€” ${companyName}*\n\nSe ha cumplido 1 hora desde tu solicitud y aún no hemos enviado cotización formal.\n\nðŸ“‹ *Código:* ${request.trackingCode}\nNos disculpamos por la demora. Te contactaremos de inmediato.`,
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

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AdminQuotesModule({ requests, onSendQuote, onRefresh }) {
  const tick = useTick(30000); // re-render every 30s to update timers
  const [selectedId, setSelectedId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    quotedAmount: "",
    serviceType: serviceTypes[0],
    internalNotes: "",
    avionetaCount: 0,
    peonetaUnitCost: 0,       // editable unit cost per peoneta (CLP) â€” default 0 = metadata only
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
  // â”€â”€â”€ On-demand distance calculation per request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Caches computed km by requestId so we don't re-geocode every selection
  const [routeCache, setRouteCache] = useState({}); // { [requestId]: {km, durationMin, loading, error} }
  const [deletingQuote, setDeletingQuote] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const autoSentRef = useRef(new Set()); // tracks keys "requestId-type" sent this session
  const photoInputRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    try { setWaConfig(JSON.parse(localStorage.getItem("dropit-whatsapp-config") || "null")); } catch {}
  }, []);

  // â”€â”€â”€ Geocode + OSRM route â†’ live km calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      const msg = err.name === "AbortError" ? "Timeout de red â€” reintentar" : (err.message || "No se pudo calcular");
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

  // â”€â”€â”€ Helper: compute final amount from wizard state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      // Mark as quoted â€” pass computed final amount + address overrides
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
            subject: `${subjectPrefix} â€” ${companyName} · Ref. ${selected.trackingCode}`,
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
                `âœ… *Cotización lista â€” ${companyName}*\n\n` +
                `ðŸ“‹ *Código:* ${selected.trackingCode}\n` +
                `ðŸ’° *Valor del servicio:* $${Number(quoteForm.quotedAmount).toLocaleString("es-CL")}\n` +
                `ðŸš› *Servicio:* ${quoteForm.serviceType}\n\n` +
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
        ? `âœ… Cotización actualizada y reenviada a ${selected.customerName}`
        : `âœ… Cotización enviada a ${selected.customerName}`;
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
      setMessage({ ok: true, text: `âœ… Cotización marcada como aceptada â€” emails enviados a ${selected.contactEmail} y al equipo` });
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ ok: false, text: `Error al marcar como aceptado: ${err.message}` });
    } finally {
      setAcceptingManual(false);
    }
  }

  async function handleDeleteQuote() {
    if (!selected) return;
    setConfirmDeleteOpen(false);
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
      {/* â”€â”€ Lightbox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Auto-reminder toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* â”€â”€ PDF Preview Modal â”€â”€ */}
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
          <span className="text-xl leading-none">{autoToast.ok ? "âš¡" : "âš ï¸"}</span>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Gestión</p>
          <h2 className="text-2xl font-black text-slate-800">Cotizaciones</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["all","pending","quoted"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${filter === f ? "bg-dropit-accent text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-dropit-accent/40"}`}>
              {f === "all" ? `Todas (${requests.length})` : f === "pending" ? `Pendientes (${pending.length})` : `Cotizadas (${quoted.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        {/* â”€â”€ List â”€â”€ hidden on mobile when a quote is selected so detail takes full width */}
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${selectedId ? "hidden xl:block" : "block"}`}>
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {pending.length > 0 ? `${pending.length} pendiente${pending.length > 1 ? "s" : ""} â€” ordenadas por urgencia` : "Sin pendientes"}
            </p>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-slate-100">
            {shown.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Sin solicitudes en esta vista.</p>}
            {shown.map(req => {
              const mins = getElapsedMinutes(req.createdAt);
              const u    = urgencyConfig(mins);
              const isPending = req.status === "Pendiente de cotizacion";
              const isSelected = selected?.id === req.id;
              return (
                <button key={req.id} type="button" onClick={() => { setSelectedId(req.id); setConfirmDeleteOpen(false); }}
                  className={`block w-full min-h-[64px] p-4 text-left transition-all hover:bg-slate-50 ${isSelected ? "bg-dropit-accent/10 border-l-4 border-dropit-accent" : "border-l-4 border-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isPending && <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${u.dot} ${u.pulse ? "animate-pulse" : ""}`} />}
                        <p className="truncate font-semibold text-slate-900">{req.customerName}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{req.trackingCode}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <StatusBadge status={req.status} />
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
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
                    {req.urgent && <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">âš¡ Urgente</span>}
                    {(req.avionetaCount > 0 || req.avioneta) && <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600">ðŸ§‘â€ðŸ­ {req.avionetaCount > 1 ? `${req.avionetaCount}× ` : ""}Peoneta</span>}
                    {req.distanceKm && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{req.distanceKm} km</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* â”€â”€ Detail â”€â”€ */}
        {selected ? (
          <div className="space-y-4 min-w-0" ref={detailRef}>
            {/* â”€â”€ Mobile: back button â€” sticky so it's reachable while scrolling â”€â”€ */}
            <div className="xl:hidden sticky top-0 z-10 -mx-0 pt-0">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors w-full"
              >
                <ChevronLeft size={16} className="text-dropit-accent" />
                <span>Volver a lista</span>
              </button>
            </div>
            {/* Urgency banner for pending */}
            {selected.status === "Pendiente de cotizacion" && (() => {
              const mins = getElapsedMinutes(selected.createdAt);
              const u = urgencyConfig(mins);
              return (
                <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${u.bg}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock size={15} className={u.color} />
                    <span className={`text-sm font-bold ${u.color}`}>
                      {mins >= 60 ? "Cotización vencida" : `${formatElapsed(mins)} transcurridos`}
                    </span>
                    <span className={`text-xs ${u.color} opacity-70`}>
                      Recibida: {new Date(selected.createdAt).toLocaleString("es-CL")}
                    </span>
                  </div>
                  {/* WA Reminders */}
                  {waConfig?.authToken && (
                    <div className="flex flex-wrap gap-2">
                      {["30min","45min","60min"].map(type => {
                        const sentKey = `${selected.id}-${type}`;
                        const done = reminderSent[sentKey] || (selected.remindersSent || []).some(r => r.type === type);
                        return (
                          <button key={type} onClick={() => handleReminder(type)} disabled={done}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${done ? "bg-green-100 text-green-700 cursor-default" : "bg-white border border-slate-200 text-slate-700 hover:border-dropit-accent/40 hover:text-dropit-accent"}`}>
                            <Bell size={11} />
                            {done ? "Enviado" : `WA ${type}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                 ZONA A â€” DATOS DEL CLIENTE (solo lectura)
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 shadow-sm overflow-hidden">
              {/* Header Zona A â€” fuerte y explícito */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-700 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-500/40">
                    <Inbox size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Entrada</p>
                    <h3 className="text-base font-black text-white leading-tight flex flex-wrap items-center gap-2">
                      DATOS DEL CLIENTE
                      {selected.urgent && <span className="inline-flex items-center gap-1 rounded-full bg-red-500 border border-red-400 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">URGENTE</span>}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-lg bg-slate-600 border border-slate-500 px-2.5 py-1 text-[11px] font-bold text-slate-200">
                    <Lock size={11} /> Solo lectura
                  </span>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              {/* Sub-header con nombre + código + acciones */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                <div className="min-w-0">
                  <h4 className="text-base font-black text-slate-800 break-words">{selected.customerName}</h4>
                  <p className="text-[10px] text-slate-500 break-all font-mono">{selected.trackingCode} · {selected.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <StatusBadge status={selected.status} />
                  <button onClick={() => setPdfPreview(buildPDFHtml(selected, Number(quoteForm.quotedAmount) || selected.quotedAmount, selected.photos || []))}
                    className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-2 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all shadow-sm">
                    <Eye size={14} /> Vista previa PDF
                  </button>
                  {/* â”€â”€ Eliminar con confirmación inline (sin window.confirm) â”€â”€ */}
                  {confirmDeleteOpen ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 w-full sm:w-auto">
                      <span className="text-xs font-semibold text-red-700">¿Eliminar permanentemente?</span>
                      <button type="button" onClick={handleDeleteQuote} disabled={deletingQuote}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                        {deletingQuote ? "..." : "Sí, eliminar"}
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteOpen(false)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={deletingQuote}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingQuote ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      {deletingQuote ? "Eliminando..." : "Eliminar"}
                    </button>
                  )}
                </div>
              </div>

              {/* â”€â”€ Cuerpo Zona A: datos read-only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* RUT */}
                  {(() => {
                    const rut = selected.customerRut || (selected.observations || "").split("\n").find(l => l.startsWith("RUT:"))?.replace("RUT: ", "").trim();
                    return rut ? (
                      <ReadOnlyCard icon={User} label="RUT" value={<span className="font-mono font-bold text-slate-900">{rut}</span>} />
                    ) : null;
                  })()}
                  <ReadOnlyCard icon={User}    label="Contacto"            value={selected.contactPerson || selected.customerName} />
                  <ReadOnlyCard icon={Phone}   label="Teléfono"            value={<a href={`tel:${selected.contactPhone}`} className="text-dropit-accent font-bold">{selected.contactPhone}</a>} />
                  <ReadOnlyCard icon={Mail}    label="Email cliente"       value={<a href={`mailto:${selected.contactEmail}`} className="text-dropit-accent font-bold break-all">{selected.contactEmail}</a>} />
                  <ReadOnlyCard icon={Clock}   label="Fecha / Hora"        value={`${selected.requiredDate || "â€”"}${selected.requiredTime ? ` a las ${selected.requiredTime}` : ""}`} />
                  <ReadOnlyCard icon={MapPin}  label="Retiro (origen)"     value={selected.pickupAddress} />
                  {(() => {
                    const stops = Array.isArray(selected.deliveryStops) ? selected.deliveryStops : [];
                    // Si hay más de una entrega, listarlas todas; si no, mostrar el destino único.
                    if (stops.length > 1) {
                      return (
                        <div className="sm:col-span-2">
                          <ReadOnlyCard
                            icon={MapPin}
                            label={`Entregas (${stops.length} destinos)`}
                            value={
                              <ol className="mt-0.5 space-y-1">
                                {stops.map((s, i) => (
                                  <li key={i} className="flex gap-2 text-slate-700">
                                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{i + 1}</span>
                                    <span className="break-words">{s.address}{s.commune ? `, ${s.commune}` : ""}</span>
                                  </li>
                                ))}
                              </ol>
                            }
                          />
                        </div>
                      );
                    }
                    return <ReadOnlyCard icon={MapPin} label="Entrega (destino)" value={selected.deliveryAddress} />;
                  })()}
                  <ReadOnlyCard icon={Package} label="Carga"               value={`${selected.packages} bultos · ${selected.estimatedWeightKg} kg en total`} />
                  {(() => {
                    const live    = routeCache[selected.id];
                    const km      = selected.distanceKm || live?.km;
                    const minutes = live?.durationMin;
                    return (
                      <ReadOnlyCard
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
                              <RefreshCw size={12} className="animate-spin" /> Calculando rutaâ€¦
                            </span>
                          ) : live?.error ? (
                            <button
                              onClick={() => { setRouteCache(p => ({...p, [selected.id]: undefined})); calcRouteForRequest(selected); }}
                              className="text-amber-600 text-xs font-semibold hover:underline">
                              {live.error} â€” reintentar
                            </button>
                          ) : (
                            <button
                              onClick={() => calcRouteForRequest(selected)}
                              className="text-dropit-accent text-xs font-bold hover:underline">
                              Calcular ruta ahora
                            </button>
                          )
                        }
                      />
                    );
                  })()}
                  {/* Desglose por tramo — solo cuando hay múltiples destinos y el payload guardó legs */}
                  {Array.isArray(selected.legs) && selected.legs.length > 1 && (
                    <div className="sm:col-span-2">
                      <div className="rounded-lg border border-dropit-200 bg-dropit-50 px-4 py-3">
                        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-dropit-600">
                          <RouteIcon size={11} /> Desglose por tramo
                        </p>
                        <div className="space-y-1">
                          {selected.legs.map((leg, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-dropit-700">
                              <span className="flex items-center gap-1.5">
                                <MapPin size={11} className="flex-shrink-0 text-dropit-accent" />
                                <span>{leg.from} → {leg.to}</span>
                              </span>
                              <span className="font-bold tabular-nums">{leg.distanceKm} km</span>
                            </div>
                          ))}
                          <div className="mt-1.5 flex items-center justify-between border-t border-dropit-200 pt-1.5 text-xs font-black text-dropit-950">
                            <span>Total ruta</span>
                            <span className="tabular-nums text-dropit-accent">{selected.distanceKm} km</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <ReadOnlyCard icon={Package} label="Descripción" value={selected.cargoDescription} />
                  </div>
                  {selected.observations && (
                    <div className="sm:col-span-2">
                      <ReadOnlyCard icon={FileText} label="Observaciones" value={selected.observations} />
                    </div>
                  )}
                  {(selected.avionetaCount > 0 || selected.avioneta) && (
                    <div className="sm:col-span-2">
                      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                          Peonetas solicitados por el cliente: {selected.avionetaCount > 0 ? `${selected.avionetaCount} peoneta${selected.avionetaCount > 1 ? "s" : ""}` : "1 peoneta"}
                        </p>
                        <p className="text-[10px] text-amber-700 mt-0.5">Cantidad definitiva la fijas tú en el Paso 2.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fotos del cliente */}
                {Array.isArray(selected.photos) && selected.photos.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Camera size={14} className="text-slate-500" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Fotos enviadas por el cliente ({selected.photos.length})
                      </p>
                      <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        <Lock size={9} /> Solo lectura
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selected.photos.map((src, idx) => {
                        const url = photoUrl(src);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxPhoto(url)}
                            className="group relative h-24 w-24 overflow-hidden rounded-xl border-2 border-slate-200 shadow-sm transition-all hover:border-slate-400 hover:shadow-md"
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

                {/* Detalle de bultos */}
                {Array.isArray(selected.bultosDetail) && selected.bultosDetail.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Package size={14} className="text-slate-500" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Medidas por bulto ({selected.bultosDetail.length})
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                              <td className="px-3 py-2 text-slate-600">{b.largo || "â€”"}</td>
                              <td className="px-3 py-2 text-slate-600">{b.ancho || "â€”"}</td>
                              <td className="px-3 py-2 text-slate-600">{b.alto || "â€”"}</td>
                              <td className="px-3 py-2 text-slate-600">{b.peso || "â€”"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* â”€â”€ FIN ZONA A â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

            {/* Quote form */}
            {(selected.status === "Pendiente de cotizacion" || updateMode) && (
              <form onSubmit={submitQuote} className="rounded-2xl border-2 border-dropit-accent bg-white shadow-md overflow-hidden">
                {/* â”€â”€ ZONA B header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="bg-dropit-accent px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
                      <Wrench size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-100">Tu trabajo</p>
                      <h4 className="font-black text-white text-base leading-tight">
                        {updateMode ? "MODIFICAR COTIZACIÓN" : "CONSTRUYE Y ENVÍA LA COTIZACIÓN"}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white/20 border border-white/30 px-2.5 py-1 text-[11px] font-bold text-white">
                      3 pasos
                    </span>
                    {updateMode && (
                      <button type="button" onClick={() => { setUpdateMode(false); setMessage(null); }}
                        className="flex items-center gap-1.5 rounded-lg bg-white/20 border border-white/30 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition-colors">
                        <X size={12} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* â”€â”€ STEPPER de proceso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {(() => {
                  const liveKmStep = routeCache[selected.id]?.km;
                  const kmStep = Number(selected.distanceKm || liveKmStep) || 0;
                  const step1Done = kmStep > 0;
                  const step2Done = true; // siempre configurable, se puede avanzar
                  const step3Done = getFinalAmount() > 0;
                  const steps = [
                    { num: 1, label: "Ruta", done: step1Done },
                    { num: 2, label: "Peonetas", done: step2Done },
                    { num: 3, label: "Precio", done: step3Done },
                    { num: null, label: "Enviar", done: step3Done, isFinal: true },
                  ];
                  return (
                    <div className="flex items-center gap-0 border-b border-dropit-accent/20 bg-orange-50 px-4 py-3 overflow-x-auto">
                      {steps.map((s, i) => (
                        <div key={i} className="flex items-center flex-shrink-0">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black border-2 transition-colors ${
                              s.isFinal
                                ? (s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-slate-400")
                                : (s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-dropit-accent bg-dropit-accent text-white")
                            }`}>
                              {s.done ? <Check size={14} strokeWidth={3} /> : (s.isFinal ? <Send size={13} /> : s.num)}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap ${
                              s.done ? "text-emerald-700" : (s.isFinal ? "text-slate-400" : "text-dropit-accent")
                            }`}>
                              {s.label}
                            </span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`mx-2 h-0.5 w-8 sm:w-12 flex-shrink-0 rounded-full transition-colors ${
                              s.done ? "bg-emerald-400" : "bg-slate-200"
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="p-5">

                {/* â”€â”€â”€ Constructor paso a paso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    <div className="space-y-5">
                      {/* STEP 1 â€” Ruta */}
                      <div className="rounded-2xl border-2 border-blue-600 bg-white overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 bg-blue-600 px-4 py-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-blue-600 text-base font-black shadow">1</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Paso 1 de 3</p>
                            <h5 className="text-sm font-black text-white">RUTA â€” Confirma y recalcula</h5>
                          </div>
                          {km > 0 ? (
                            <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-1 text-[11px] font-bold text-white">
                              {km} km
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-400/90 px-2.5 py-1 text-[11px] font-bold text-yellow-900">
                              Sin km
                            </span>
                          )}
                        </div>
                        <div className="space-y-3 p-4 bg-blue-50/40">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                                <Pencil size={10} className="text-blue-500" /> Origen (editable)
                              </label>
                              <StreetAutocomplete
                                value={quoteForm.pickupOverride || selected.pickupAddress || ""}
                                onChange={v => setQuoteForm(f => ({ ...f, pickupOverride: v, pickupCoords: null }))}
                                onCoordsChange={coords => setQuoteForm(f => ({ ...f, pickupCoords: coords }))}
                                placeholder="Dirección de retiro"
                                dotColor="#3B82F6"
                              />
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                                <Pencil size={10} className="text-blue-500" /> Destino (editable)
                              </label>
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

                      {/* STEP 2 â€” Peonetas */}
                      <div className="rounded-2xl border-2 border-amber-500 bg-white overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 bg-amber-500 px-4 py-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-amber-600 text-base font-black shadow">2</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Paso 2 de 3</p>
                            <h5 className="text-sm font-black text-white">PEONETAS â€” Cantidad y costo</h5>
                          </div>
                          <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-1 text-[11px] font-bold text-white">
                            Cliente pidio: {selected.avionetaCount || 0}
                          </span>
                        </div>
                        <div className="grid gap-4 p-4 bg-amber-50/40 md:grid-cols-2">
                          <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                              <Pencil size={10} className="text-amber-600" /> Cantidad (editable)
                            </label>
                            <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-white px-2 py-1.5">
                              <button type="button"
                                onClick={() => setQuoteForm(f => ({ ...f, avionetaCount: Math.max(0, Number(f.avionetaCount) - 1) }))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-amber-600 hover:bg-amber-100 disabled:opacity-30 transition-colors"
                                disabled={!Number(quoteForm.avionetaCount)}>âˆ’</button>
                              <span className="flex-1 text-center text-xl font-black text-slate-900">{Number(quoteForm.avionetaCount) || 0}</span>
                              <button type="button"
                                onClick={() => setQuoteForm(f => ({ ...f, avionetaCount: Math.min(5, (Number(f.avionetaCount) || 0) + 1) }))}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold text-amber-600 hover:bg-amber-100 transition-colors">+</button>
                            </div>
                          </div>
                          <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                              <Pencil size={10} className="text-amber-600" /> Valor unitario (CLP, editable)
                            </label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">$</span>
                              <input className="input-base pl-7 font-bold" type="number" min="0" max="100000" step="1000"
                                inputMode="numeric"
                                value={quoteForm.peonetaUnitCost}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const raw = Number(e.target.value) || 0;
                                  // Acepta 0 (metadata) o entre 10.000 y 100.000 (rango razonable)
                                  const clamped = raw === 0 ? 0 : Math.min(100000, Math.max(0, raw));
                                  setQuoteForm(f => ({ ...f, peonetaUnitCost: clamped }));
                                }}
                                onBlur={e => {
                                  const v = Number(e.target.value) || 0;
                                  // Al perder foco: si está entre 1 y 9.999 lo subimos a 10.000 (rango mínimo razonable)
                                  if (v > 0 && v < 10000) {
                                    setQuoteForm(f => ({ ...f, peonetaUnitCost: 10000 }));
                                  }
                                }}
                                placeholder="0 = solo registrar cantidad" />
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">
                              0 = solo registra cantidad sin afectar precio · Rango sugerido $10.000 â€“ $100.000
                            </p>
                          </div>
                          {peonetaCount > 0 && (
                            <div className="col-span-full flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border-2 border-amber-200 px-3 py-2 shadow-sm">
                              <span className="text-xs font-semibold text-slate-600">Subtotal peonetas</span>
                              <strong className="text-base font-black text-amber-700">{peonetaCount} × ${peonetaUnit.toLocaleString("es-CL")} = ${peonetaSubtotal.toLocaleString("es-CL")}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* STEP 3 â€” Precio final + detalles */}
                      <div className="rounded-2xl border-2 border-orange-600 bg-white overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 bg-orange-600 px-4 py-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-orange-600 text-base font-black shadow">3</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-orange-100">Paso 3 de 3</p>
                            <h5 className="text-sm font-black text-white">PRECIO â€” Desglose y total final</h5>
                          </div>
                          <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-1 text-[11px] font-bold text-white">
                            ${finalTotal.toLocaleString("es-CL")}
                          </span>
                        </div>
                        <div className="space-y-3 p-4 bg-orange-50/30">
                          {/* Panel "Sugerencia del sistema" â€” referencial, dentro del Paso 3 */}
                          {(() => {
                            const liveKmS = routeCache[selected.id]?.km;
                            const kmS     = Number(selected.distanceKm || liveKmS) || 0;
                            if (!kmS) return null;
                            const weightS    = Number(selected.estimatedWeightKg) || 0;
                            const peonetaQty = selected.avionetaCount ?? (selected.avioneta ? 1 : 0);
                            const isRMS      = RM_COMUNAS.has((selected.pickupAddress || "").split(",").pop()?.trim()) ||
                                               RM_COMUNAS.has((selected.deliveryAddress || "").split(",").pop()?.trim());
                            const basePriceS   = isRMS ? calcRMPrice(kmS) : calcNationalBase(kmS);
                            const weightSurchargeS = weightS > 500 ? 0.35 : weightS > 200 ? 0.25 : weightS > 50 ? 0.15 : 0;
                            const baseFleteS   = Math.round(basePriceS * (1 + weightSurchargeS) / 1000) * 1000;
                            const zoneS        = isRMS ? "Santiago RM" : kmS > 500 ? "Larga distancia" : kmS > 100 ? "Regional" : "Local";
                            return (
                              <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-3">
                                <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-indigo-600" />
                                    <p className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
                                      Sugerencia del sistema
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-indigo-100 border border-indigo-300 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                    {zoneS}
                                  </span>
                                </div>
                                <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                                  <div className="flex justify-between rounded-lg bg-white/80 px-2.5 py-1.5">
                                    <span className="text-slate-600">Distancia</span>
                                    <strong className="text-slate-900">{kmS} km</strong>
                                  </div>
                                  <div className="flex justify-between rounded-lg bg-white/80 px-2.5 py-1.5">
                                    <span className="text-slate-600">Tarifa</span>
                                    <strong className="text-slate-900">{isRMS ? "RM" : "Nacional"}</strong>
                                  </div>
                                  {weightSurchargeS > 0 && (
                                    <div className="flex justify-between rounded-lg bg-white/80 px-2.5 py-1.5 sm:col-span-2">
                                      <span className="text-slate-600">Recargo peso (+{Math.round(weightSurchargeS*100)}%)</span>
                                      <strong className="text-slate-900">incluido</strong>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center justify-between rounded-lg bg-indigo-600 px-3 py-2 text-white">
                                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Flete sugerido</span>
                                  <strong className="text-lg font-black">${baseFleteS.toLocaleString("es-CL")}</strong>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setQuoteForm(f => ({ ...f, quotedAmount: String(baseFleteS), manualOverride: true }))}
                                  className="mt-2 w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors"
                                >
                                  Usar este precio como punto de partida
                                </button>
                                <p className="mt-1 text-center text-[9px] text-indigo-500">Calculado por formula â€” adjustalo libremente en los campos de abajo</p>
                              </div>
                            );
                          })()}
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
                                <span className="text-slate-600">ðŸ§‘â€ðŸ­ Peonetas ({peonetaCount} × ${peonetaUnit.toLocaleString("es-CL")})</span>
                                <strong className="text-slate-900">+${peonetaSubtotal.toLocaleString("es-CL")}</strong>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                              <span className="text-slate-600">Descuento</span>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500">âˆ’$</span>
                                <input className="w-32 rounded-md border-2 border-red-200 bg-red-50/40 pl-7 pr-2 py-1 text-right text-sm font-bold text-red-700 focus:border-red-400 focus:outline-none" type="number" min="0" step="500"
                                  value={quoteForm.discount}
                                  onChange={e => setQuoteForm(f => ({ ...f, discount: Number(e.target.value) || 0 }))}
                                  placeholder="0" />
                              </div>
                            </div>
                          </div>

                          {/* Total banner */}
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-dropit-accent to-dropit-accent-dark px-4 py-3 text-white shadow-lg shadow-dropit-accent/30">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 whitespace-nowrap">Total a cotizar</p>
                              <p className="text-[10px] opacity-75">{quoteForm.manualOverride ? "Manual" : "Auto"}</p>
                            </div>
                            <strong className="text-2xl font-black tracking-tight shrink-0">${finalTotal.toLocaleString("es-CL")}</strong>
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
                              <label className="flex items-center gap-1 text-[11px] font-bold text-orange-900 uppercase tracking-wider">
                                <Pencil size={10} className="text-orange-500" /> Tipo de servicio
                              </label>
                              <select className="input-base mt-1" value={quoteForm.serviceType}
                                onChange={e => setQuoteForm(f => ({ ...f, serviceType: e.target.value }))}>
                                {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <p className="text-[10px] text-slate-500 leading-tight">
                                âœ“ Las peonetas se mencionan en el correo<br />
                                âœ“ El PDF incluye desglose completo
                              </p>
                            </div>
                          </div>
                          <div>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-orange-900 uppercase tracking-wider">
                              <Pencil size={10} className="text-orange-500" /> Comentarios para el cliente
                            </label>
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

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button type="submit" disabled={sending || getFinalAmount() <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-dropit-accent px-6 py-3 text-sm font-bold text-white shadow-md shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto">
                    {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                    {sending ? "Enviando..." : (updateMode ? `Reenviar â€” $${getFinalAmount().toLocaleString("es-CL")}` : `Enviar cotización â€” $${getFinalAmount().toLocaleString("es-CL")}`)}
                  </button>
                  <button type="button" onClick={() => setPdfPreview(buildPDFHtml(selected, getFinalAmount(), selected.photos || []))}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dropit-accent/30 bg-dropit-accent/5 px-5 py-3 text-sm font-bold text-dropit-accent hover:bg-dropit-accent hover:text-white transition-all sm:w-auto">
                    <Eye size={15} /> Vista previa PDF
                  </button>
                </div>

                {message && (
                  <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {message.text}
                  </div>
                )}
                </div>{/* /p-5 Zona B body */}
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={handleAcceptManual}
                      disabled={acceptingManual}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-all disabled:opacity-60 sm:w-auto"
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
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-all sm:w-auto"
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
                    <p className="font-bold text-blue-800">âœ… Cliente aceptó la cotización</p>
                    <p className="text-sm text-blue-700">
                      Valor confirmado: <strong>${Number(selected.quotedAmount).toLocaleString("es-CL")}</strong>
                      {selected.acceptedAt && <> · {new Date(selected.acceptedAt).toLocaleString("es-CL")}</>}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      ðŸš› El pedido ya está disponible en el módulo de <strong>Planificación</strong> para asignar ruta y camión.
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
                  {["Código","Cliente","Retiro â†’ Entrega","Distancia","Valor","Servicio","Enviado","PDF"].map(h => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quoted.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-dropit-accent">{req.trackingCode}</td>
                    <td className="px-4 py-3 font-semibold">{req.customerName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{req.pickupAddress} â†’ {req.deliveryAddress}</td>
                    <td className="px-4 py-3">{req.distanceKm ? `${req.distanceKm} km` : "â€”"}</td>
                    <td className="px-4 py-3 font-bold text-dropit-accent">${Number(req.quotedAmount).toLocaleString("es-CL")}</td>
                    <td className="px-4 py-3 text-slate-600">{req.serviceType}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {req.emailSent && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">ðŸ“§</span>}
                        {req.whatsappSent && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">ðŸ’¬</span>}
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-dropit-accent flex-shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <div className="text-sm font-medium text-slate-800 break-words">{value}</div>
    </div>
  );
}

// Zona A â€” tarjeta de solo lectura con paleta neutra/fría
function ReadOnlyCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-slate-400 flex-shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <div className="text-sm font-medium text-slate-700 break-words">{value}</div>
    </div>
  );
}
