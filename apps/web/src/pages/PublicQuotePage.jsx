import { useState, useEffect, useRef } from "react";
import {
  Truck, MapPin, Package, Phone, Mail, User, Calendar,
  CheckCircle2, ChevronRight, ChevronDown, Star, Zap, Shield, Clock,
  ArrowRight, Send, Navigation, AlertCircle, Search, X,
  Plus, Trash2, Camera, Route as RouteIcon, Loader2,
} from "lucide-react";
import { calcPrice } from "../lib/pricing";
import ChileCoverageMap from "../components/ChileCoverageMap";
import SaulLoader from "../components/SaulLoader";
import HeroAnimation from "../components/HeroAnimation";
import StreetAutocomplete from "../components/StreetAutocomplete";
import { COMUNAS, RM_COMUNAS } from "../lib/comunas";

// â”€â”€â”€ Image compression â€” resize + JPEG re-encode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reduces large camera photos (5â€“15 MB) to ~200â€“500 KB so the JSON payload stays
// manageable and the API can save them reliably to db.json.
async function compressImage(file, maxSide = 900, quality = 0.7) {
  // Fast path: OffscreenCanvas + createImageBitmap (Chrome/Edge/Firefox)
  if (typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      let { width: w, height: h } = bitmap;
      if (w > maxSide || h > maxSide) {
        const r = Math.min(maxSide / w, maxSide / h);
        w = Math.round(w * r); h = Math.round(h * r);
      }
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      return await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    } catch { /* fall through to legacy path */ }
  }
  // Legacy fallback (Safari/older iOS)
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = reject; r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl;
  });
  let { width: w, height: h } = img;
  if (w > maxSide || h > maxSide) { const r = Math.min(maxSide / w, maxSide / h); w = Math.round(w * r); h = Math.round(h * r); }
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// â”€â”€â”€ Nominatim geocoder â€” used as fallback when Google Maps is unavailable â”€â”€â”€
// Returns raw Nominatim results so callers can access .lat / .lon as strings.
async function nominatimSearch(q) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json` +
    `&q=${encodeURIComponent(q)}` +
    `&countrycodes=cl&addressdetails=1&limit=5&dedupe=1&accept-language=es`;
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  return res.json();
}

// calcPrice is now imported from ../lib/pricing â€” works for RM + all of Chile

// â”€â”€â”€ Chilean phone formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auto-prefixes +56 9 if the user types a raw 8-digit mobile number.
// Formats: 912345678 â†’ +56 9 1234 5678 | 56912345678 â†’ +56 9 1234 5678
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  // Already has +56 prefix typed: just format
  if (digits.length >= 11 && digits.startsWith("56")) {
    const num = digits.slice(2); // remove 56
    if (num.length >= 9) {
      return `+56 ${num[0]} ${num.slice(1, 5)} ${num.slice(5, 9)}`;
    }
    return `+56 ${num}`;
  }
  // 9-digit starting with 9: mobile
  if (digits.length >= 9 && digits.startsWith("9")) {
    return `+56 ${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
  }
  // 8-digit (no leading 9): assume mobile, prepend 9
  if (digits.length === 8 && !digits.startsWith("0")) {
    return `+56 9 ${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
  }
  // Partial input â€” just show what they typed with + prefix hint
  if (digits.length > 0 && digits.length < 9 && !raw.startsWith("+")) {
    return `+56 9 ${digits}`;
  }
  return raw; // keep as-is if it already has + or is complex
}

// â”€â”€â”€ RUT helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatRut(raw) {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) return clean;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  let fmt = "", c = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    fmt = body[i] + fmt; c++;
    if (c % 3 === 0 && i !== 0) fmt = "." + fmt;
  }
  return `${fmt}-${dv}`;
}
function validateRut(rut) {
  const clean = rut.replace(/[^0-9kK]/g, "").toLowerCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1), dv = clean.slice(-1);
  let sum = 0, factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rem = 11 - (sum % 11);
  const expected = rem === 11 ? "0" : rem === 10 ? "k" : String(rem);
  return dv === expected;
}

// â”€â”€â”€ Commune searchable selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ComunaSelect({ value, onChange, placeholder = "Seleccionar comunaâ€¦" }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const filtered = query.trim().length > 0
    ? COMUNAS.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : COMUNAS.slice(0, 8);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 60); }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm transition-all focus:outline-none ${
          value ? "border-dropit-accent/40 bg-dropit-accent/5 font-semibold text-slate-700" : "border-slate-200 bg-white text-slate-400"
        } hover:border-dropit-accent/40`}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-slate-50 p-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input ref={inputRef} autoFocus
                className="w-full rounded-lg border border-slate-100 bg-white py-1.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-dropit-accent/30"
                placeholder="Buscarâ€¦" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map(c => (
              <li key={c} onMouseDown={() => { onChange(c); setOpen(false); setQuery(""); }}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors hover:bg-dropit-accent/8 ${c === value ? "font-bold text-dropit-accent" : "text-slate-700"}`}>
                {c}
              </li>
            ))}
            {filtered.length === 0 && <li className="px-4 py-3 text-center text-sm text-slate-400">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Reverse geocode coords â†’ address string â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Primary: Nominatim (OpenStreetMap). Fallback: Google Maps Geocoding API.
// If both fail, returns a placeholder so the form still captures coordinates.
async function reverseGeocode(lat, lng) {
  // â”€â”€ Attempt 1: Nominatim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      const street = [a.road || a.pedestrian || "", a.house_number || ""].filter(Boolean).join(" ");
      const rawCity = a.city_district || a.suburb || a.city || a.town || a.village || a.municipality || "";
      const commune = COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase()) || rawCity;
      return { street: street || data.display_name.split(",")[0], commune, lat, lng };
    }
  } catch { /* fall through to Google Maps */ }

  // â”€â”€ Attempt 2: Google Maps Geocoding API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gmKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (gmKey) {
    try {
      const gmUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${gmKey}&language=es`;
      const gmRes = await fetch(gmUrl);
      const gmData = await gmRes.json();
      if (gmData.results?.[0]) {
        const result = gmData.results[0];
        const formattedAddress = result.formatted_address || "";
        // Extract commune from address_components
        const localityComp = result.address_components?.find(
          c => c.types.includes("locality") || c.types.includes("sublocality") || c.types.includes("sublocality_level_1")
        );
        const rawCity = localityComp?.long_name || "";
        const commune = COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase()) || rawCity;
        // Use first part of formatted_address as street (before first comma)
        const street = formattedAddress.split(",")[0] || formattedAddress;
        return { street, commune, lat, lng };
      }
    } catch { /* fall through to coords-only fallback */ }
  }

  // â”€â”€ Fallback: coords known but no street name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return { street: "UbicaciÃ³n detectada (sin direcciÃ³n exacta)", commune: "", lat, lng };
}

// â”€â”€â”€ Address pair â€” Google Maps-style vertical stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AddressPair({
  pickupValue, onPickupChange, onPickupCommune, onPickupCoords,
  deliveryValue, onDeliveryChange, onDeliveryCommune, onDeliveryCoords,
}) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalizaciÃ³n");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (result) {
            onPickupChange(result.street + (result.commune ? `, ${result.commune}` : ""));
            onPickupCommune?.(result.commune);
            onPickupCoords?.({ lat: result.lat, lng: result.lng });
          }
        } catch {
          setGeoError("No se pudo obtener la direcciÃ³n. IngrÃ©sala manualmente.");
        }
        setGeoLoading(false);
      },
      (err) => {
        if (err.code === 1) {
          setGeoError("Permiso de ubicaciÃ³n denegado. ActÃ­valo en la configuraciÃ³n de tu navegador.");
        } else if (err.code === 3) {
          setGeoError("Tiempo de espera agotado al obtener tu ubicaciÃ³n. IntÃ©ntalo de nuevo.");
        } else {
          setGeoError("No se pudo detectar tu ubicaciÃ³n. IngrÃ©sala manualmente.");
        }
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* â”€â”€ Origin â”€â”€ */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-white" />
          <div className="w-px bg-slate-200" style={{ height: 20 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Origen</p>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoLoading}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {geoLoading
                ? <Loader2 size={10} className="animate-spin" />
                : <Navigation size={10} />
              }
              Mi ubicaciÃ³n
            </button>
          </div>
          <StreetAutocomplete
            value={pickupValue}
            onChange={onPickupChange}
            onComunaChange={onPickupCommune}
            onCoordsChange={onPickupCoords}
            placeholder="Calle y nÃºmero de retiro"
            dotColor="#10b981"
            required
            inputClassName={pickupValue && pickupValue.trim().length >= 4 ? "!border-emerald-400 !bg-emerald-50/50 focus:!ring-emerald-300" : ""}
          />
          {geoError && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
              <AlertCircle size={11} className="flex-shrink-0" />
              {geoError}
            </p>
          )}
        </div>
      </div>

      {/* â”€â”€ Destination â”€â”€ */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-px bg-slate-200" style={{ height: 4 }} />
          <div className="h-3 w-3 rounded-full bg-dropit-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-dropit-accent">Destino</p>
          <StreetAutocomplete
            value={deliveryValue}
            onChange={onDeliveryChange}
            onComunaChange={onDeliveryCommune}
            onCoordsChange={onDeliveryCoords}
            placeholder="Calle y nÃºmero de entrega"
            dotColor="#F97316"
            required
            inputClassName={deliveryValue && deliveryValue.trim().length >= 4 ? "!border-emerald-400 !bg-emerald-50/50 focus:!ring-emerald-300" : ""}
          />
        </div>
      </div>
    </div>
  );
}

// Mock tracking data for public demo
const MOCK_TRACKING = {
  "DR-001": { status: "En reparto", client: "Comercial Las Condes", address: "Apoquindo 4500, Las Condes", steps: ["Recibido","En bodega","En trÃ¡nsito","En reparto"], currentStep: 3, date: "2026-05-01", eta: "hoy 18:00" },
  "DR-002": { status: "Entregado", client: "Sociedad Vibrados Chile", address: "EstaciÃ³n Central 4022", steps: ["Recibido","En bodega","En trÃ¡nsito","En reparto","Entregado"], currentStep: 4, date: "2026-04-30", eta: "Entregado 15:46" },
};

const API_URL = import.meta.env.VITE_API_URL || "/api";

// â”€â”€â”€ ValidaciÃ³n por campo â€” devuelve true si el valor es vÃ¡lido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isFieldValid(name, form) {
  const v = String(form?.[name] ?? "").trim();
  if (!v && name !== "observations" && name !== "requiredTime") return false;
  switch (name) {
    case "rut":               return validateRut(form.rut);
    case "customerName":      return v.length >= 2;
    case "contactPhone":      return v.replace(/\D/g, "").length >= 9;
    case "contactEmail":      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case "pickupAddress":     return v.length >= 4;
    case "deliveryAddress":   return v.length >= 4;
    case "pickupCommune":     return v.length >= 2;
    case "deliveryCommune":   return v.length >= 2;
    case "packages":          return Number(form.packages) > 0;
    case "estimatedWeightKg": return Number(form.estimatedWeightKg) > 0;
    case "cargoDescription":  return v.length >= 4;
    case "requiredDate":      return /^\d{4}-\d{2}-\d{2}$/.test(v);
    case "requiredTime":      return v === "" || /^\d{2}:\d{2}$/.test(v);
    case "observations":      return true; // opcional
    default:                  return v.length > 0;
  }
}

// Devuelve clases adicionales para que el input se torne verde cuando es vÃ¡lido
function fieldGreen(name, form) {
  const v = String(form?.[name] ?? "").trim();
  if (!v) return ""; // vacÃ­o = neutro, no marca rojo ni verde
  return isFieldValid(name, form)
    ? "!border-emerald-400 !bg-emerald-50/50 focus:!ring-emerald-300 pr-9" // verde + espacio para el âœ“
    : "";
}

// â”€â”€â”€ Formulario inicial â€” campos vacÃ­os para el cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Solo se sugiere fecha/hora (maÃ±ana 10:00, siempre â‰¥ 4h y â‰¤ 21:00) por comodidad;
// el cliente puede cambiarlas. NingÃºn dato personal viene pre-cargado.
function getInitialForm() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return {
    rut: "",
    customerName: "",
    contactPhone: "",
    contactEmail: "",
    pickupAddress: "",
    pickupCommune: "",
    deliveryAddress: "",
    deliveryCommune: "",
    packages: "",
    estimatedWeightKg: "",
    cargoDescription: "",
    requiredDate: `${yyyy}-${mm}-${dd}`,
    requiredTime: "10:00",
    avionetaCount: 0,
    urgent: false,
    observations: "",
  };
}
const initialForm = getInitialForm();

const features = [
  {
    icon: Zap,
    title: "CotizaciÃ³n en minutos",
    desc: "Recibe tu propuesta de precio en menos de 1 hora hÃ¡bil, sin llamadas ni esperas.",
  },
  {
    icon: Navigation,
    title: "Rutas optimizadas",
    desc: "Algoritmo de optimizaciÃ³n garantiza el menor tiempo y costo de entrega.",
  },
  {
    icon: Shield,
    title: "Carga asegurada",
    desc: "Tu mercaderÃ­a viaja protegida con choferes certificados y camiones en buen estado.",
  },
  {
    icon: Clock,
    title: "Tracking en tiempo real",
    desc: "Sigue tu pedido en vivo desde que sale hasta que llega. Sin misterios.",
  },
];

const steps = [
  { num: "01", title: "Solicitas cotizaciÃ³n", desc: "Completas el formulario con origen, destino y tipo de carga." },
  { num: "02", title: "Recives propuesta", desc: "Te enviamos el precio exacto a tu correo en menos de 1 hora." },
  { num: "03", title: "Apruebas y agendamos", desc: "Confirmas la cotizaciÃ³n y coordinamos la fecha de retiro." },
  { num: "04", title: "Retiro y entrega", desc: "Nuestro equipo retira y entrega con tracking en tiempo real." },
];

export default function PublicQuotePage() {
  const [form, setForm] = useState(initialForm);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // mapReady removed â€” ChileCoverageMap handles its own loading state
  // Tracking
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState("");
  // Medidas por bulto (opcional)
  const [bultos, setBultos] = useState([]);
  // Marketing carousel
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  // Route & geo
  const [pickupCoords, setPickupCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  // Entregas ADICIONALES (1 retiro â†’ varias entregas). El destino principal
  // sigue en form.deliveryAddress; estas son las paradas extra del cliente.
  const [extraDeliveries, setExtraDeliveries] = useState([]); // [{ address, commune, coords }]
  const [routeInfo, setRouteInfo] = useState(null); // {distanceKm, price, isRM, geometry}
  const [geocoding, setGeocoding] = useState(false);
  const [routeError, setRouteError] = useState("");
  // Image uploads â€” dynamic array, max 6
  const MAX_PHOTOS = 6;
  const [images, setImages] = useState([]);   // Array of base64 strings
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const formRef = useRef(null);

  // Load marketing carousel from API (Cloudinary), fallback localStorage
  useEffect(() => {
    fetch(`${API_URL}/media/carousels`)
      .then(r => r.json())
      .then(data => {
        const imgs = data.marketing || [];
        setCarouselImages(imgs.length > 0 ? imgs : JSON.parse(localStorage.getItem("dropit-marketing-carousel") || "[]"));
      })
      .catch(() => {
        try { setCarouselImages(JSON.parse(localStorage.getItem("dropit-marketing-carousel") || "[]")); } catch { setCarouselImages([]); }
      });
  }, []);

  useEffect(() => {
    if (carouselImages.length < 2) return;
    const id = setInterval(() => setCarouselIndex((i) => (i + 1) % carouselImages.length), 5000);
    return () => clearInterval(id);
  }, [carouselImages.length]);

  async function searchTracking(e) {
    e.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    if (!code) return;
    setTrackingError("");
    setTrackingResult(null);
    try {
      const res = await fetch(`${API_URL}/tracking/${code}`);
      const data = await res.json();
      if (res.ok && data.tracking) {
        setTrackingResult(data.tracking);
      } else {
        // Fallback to mock for demo
        const mock = MOCK_TRACKING[code];
        if (mock) { setTrackingResult(mock); }
        else { setTrackingError(`No se encontrÃ³ el envÃ­o "${code}". Verifica el cÃ³digo.`); }
      }
    } catch {
      // Offline fallback
      const mock = MOCK_TRACKING[code];
      if (mock) { setTrackingResult(mock); }
      else { setTrackingError(`No se encontrÃ³ el envÃ­o "${code}". Verifica el cÃ³digo.`); }
    }
  }

  // â”€â”€â”€ Entregas adicionales (1 retiro â†’ varias entregas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function addDelivery() {
    setExtraDeliveries((d) => [...d, { address: "", commune: "", coords: null }]);
  }
  function removeDelivery(idx) {
    setExtraDeliveries((d) => d.filter((_, i) => i !== idx));
  }
  function updateDelivery(idx, patch) {
    setExtraDeliveries((d) => d.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function addBulto() {
    setBultos((b) => [...b, { alto: "", ancho: "", largo: "", peso: "" }]);
  }
  function removeBulto(idx) {
    setBultos((b) => b.filter((_, i) => i !== idx));
  }
  function updateBulto(idx, field, value) {
    setBultos((b) => b.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  // Coverage map is now handled by <ChileCoverageMap /> component

  // â”€â”€â”€ Route map: draw when coords/geometry arrive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!pickupCoords || !deliveryCoords || !routeInfo?.geometry) {
      // Destroy existing map so it re-initializes fresh next time
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
        routeLayersRef.current = [];
      }
      return;
    }
    // Snapshot extra delivery coords for use inside the async import
    const extraWithCoords = extraDeliveries.filter(d => d.coords);
    // Small defer to ensure the newly rendered div is in the DOM
    const tid = setTimeout(() => {
    import("leaflet").then((L) => {
      if (!routeMapRef.current) return;

      // Ensure Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Initialize or reuse
      if (!routeMapInstanceRef.current) {
        routeMapInstanceRef.current = L.map(routeMapRef.current, {
          center: [pickupCoords.lat, pickupCoords.lng], zoom: 12,
          zoomControl: true, scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: 'Â© <a href="https://openstreetmap.org">OSM</a> Â© <a href="https://carto.com">CARTO</a>',
          maxZoom: 19,
        }).addTo(routeMapInstanceRef.current);
      }

      const map = routeMapInstanceRef.current;
      // Clear previous layers
      routeLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
      routeLayersRef.current = [];

      const makeIcon = (color, label) => L.divIcon({
        className: "",
        html: `<div style="position:relative;"><div style="width:26px;height:26px;background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.5);"></div><div style="position:absolute;bottom:28px;left:50%;transform:translateX(-50%);background:${color};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.4);">${label}</div></div>`,
        iconSize: [26, 26], iconAnchor: [13, 26],
      });

      const routeGeo = L.geoJSON(routeInfo.geometry, {
        style: { color: "#ea580c", weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round" }
      }).addTo(map);

      const layers = [routeGeo];

      // Paradas en el MISMO orden que los waypoints enviados a OSRM:
      // 0 = retiro Â· 1 = entrega principal Â· 2+ = entregas adicionales con coords.
      const allStops = [
        { lat: pickupCoords.lat,   lng: pickupCoords.lng,   origin: true  },
        { lat: deliveryCoords.lat, lng: deliveryCoords.lng, origin: false },
        ...extraWithCoords.map(d => ({ lat: d.coords.lat, lng: d.coords.lng, origin: false })),
      ];
      // routeInfo.order[posVisita] = Ã­ndiceOriginal. Si no hubo optimizaciÃ³n
      // (o no coincide el largo), usamos el orden natural de ingreso.
      const visitOrder = (routeInfo.order && routeInfo.order.length === allStops.length)
        ? routeInfo.order
        : allStops.map((_, i) => i);

      // Marcadores numerados segÃºn el ORDEN Ã“PTIMO de visita.
      let entregaNum = 0;
      visitOrder.forEach((origIdx) => {
        const s = allStops[origIdx];
        if (!s) return;
        const label = s.origin ? "ðŸ“¦ Retiro" : `ðŸ Entrega ${++entregaNum}`;
        const color = s.origin ? "#10b981" : "#F97316";
        layers.push(L.marker([s.lat, s.lng], { icon: makeIcon(color, label) }).addTo(map));
      });

      routeLayersRef.current = layers;
      // Fit to the full route geometry for best detail
      map.fitBounds(routeGeo.getBounds(), { padding: [50, 50], maxZoom: 15 });
    });
    }, 80);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeInfo, pickupCoords, deliveryCoords, JSON.stringify(extraDeliveries.map(d => d.coords))]);

  // Route map cleanup
  useEffect(() => {
    return () => {
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      }
    };
  }, []);

  // â”€â”€â”€ Auto-calculate route when any waypoint coords change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Re-runs whenever pickup, main delivery, or any extra-delivery coord changes.
  useEffect(() => {
    if (!pickupCoords || !deliveryCoords) return;
    // Build the ordered waypoints list: origin + main destination + extras with coords
    const waypoints = [
      pickupCoords,
      deliveryCoords,
      ...extraDeliveries.filter(d => d.coords).map(d => d.coords),
    ];
    calculateRoute(waypoints);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, deliveryCoords, JSON.stringify(extraDeliveries.map(d => d.coords))]);

  // â”€â”€â”€ Geocode fallback: if address typed manually (no suggestion picked) â”€â”€â”€â”€â”€â”€â”€
  const geocodeTimerRef = useRef({});
  useEffect(() => {
    if (pickupCoords) return;
    const addr = form.pickupAddress.trim();
    if (addr.length < 6) return;
    clearTimeout(geocodeTimerRef.current.pickup);
    geocodeTimerRef.current.pickup = setTimeout(async () => {
      try {
        // Best-effort para direcciones escritas a mano (sin elegir sugerencia).
        // Nominatim (OSM) no depende de la Geocoding API de Google. El caso
        // comun -elegir una sugerencia- ya resuelve coords via Places Details.
        const data = await nominatimSearch(addr + ", Chile");
        if (data[0]) setPickupCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } catch { /* ignore */ }
    }, 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pickupAddress]);

  useEffect(() => {
    if (deliveryCoords) return;
    const addr = form.deliveryAddress.trim();
    if (addr.length < 6) return;
    clearTimeout(geocodeTimerRef.current.delivery);
    geocodeTimerRef.current.delivery = setTimeout(async () => {
      try {
        // Best-effort para direcciones escritas a mano (sin elegir sugerencia).
        // Nominatim (OSM) no depende de la Geocoding API de Google. El caso
        // comun -elegir una sugerencia- ya resuelve coords via Places Details.
        const data = await nominatimSearch(addr + ", Chile");
        if (data[0]) setDeliveryCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } catch { /* ignore */ }
    }, 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.deliveryAddress]);

  // â”€â”€â”€ Geocode fallback for extra deliveries typed manually â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mirrors the pickup/delivery fallback: Google â†’ Nominatim, debounced 900 ms.
  // Only fires when the entry has â‰¥6 chars but no coords yet.
  useEffect(() => {
    extraDeliveries.forEach((d, idx) => {
      if (d.coords) return; // already resolved â€” skip
      const addr = (d.address || "").trim();
      if (addr.length < 6) return;
      const timerKey = `extra_${idx}`;
      clearTimeout(geocodeTimerRef.current[timerKey]);
      geocodeTimerRef.current[timerKey] = setTimeout(async () => {
        try {
          // Best-effort (Nominatim/OSM, sin Geocoding API). El caso comun
          // -elegir sugerencia- ya resuelve coords via Places Details.
          const results = await nominatimSearch(addr + ", Chile");
          if (results[0]) {
            updateDelivery(idx, { coords: { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) } });
          }
        } catch { /* ignore â€” geocode is best-effort */ }
      }, 900);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(extraDeliveries.map(d => ({ address: d.address, hasCoords: Boolean(d.coords) })))]);

  // â”€â”€â”€ OSRM multi-waypoint route calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // waypoints: ordered array of {lat, lng} â€” [pickup, mainDelivery, ...extras]
  // OSRM accepts: /route/v1/driving/lng1,lat1;lng2,lat2;lng3,lat3?overview=full&geometries=geojson
  // routes[0].distance = total metres across ALL legs; routes[0].geometry = full polyline.
  async function calculateRoute(waypoints) {
    setGeocoding(true);
    setRouteInfo(null);
    setRouteError("");
    try {
      const coordStr = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
      const isRM = RM_COMUNAS.has(form.pickupCommune) && RM_COMUNAS.has(form.deliveryCommune);

      // distanceM/geometry se llenan por TRIP (optimizado) o ROUTE (directo).
      // order[posiciÃ³nDeVisita] = Ã­ndiceOriginal del waypoint (origen incluido en pos 0).
      let distanceM = null, geometry = null, order = null, optimized = false;

      // â”€â”€ Optimizador inteligente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Con 3+ puntos (origen + 2 o mÃ¡s entregas) usamos el servicio TRIP de OSRM,
      // que resuelve el ORDEN Ã“PTIMO de las paradas (TSP) partiendo del origen fijo
      // (source=first) y sin volver al inicio (roundtrip=false). AsÃ­, si una entrega
      // queda "de paso", se visita antes aunque se haya agregado despuÃ©s.
      if (waypoints.length >= 3) {
        try {
          const tripUrl = `https://router.project-osrm.org/trip/v1/driving/${coordStr}` +
            `?source=first&roundtrip=false&overview=full&geometries=geojson`;
          const tripRes  = await fetch(tripUrl);
          const tripData = await tripRes.json();
          if (tripData.code === "Ok" && tripData.trips?.[0]) {
            distanceM = tripData.trips[0].distance;
            geometry  = tripData.trips[0].geometry;
            order = new Array(waypoints.length);
            (tripData.waypoints || []).forEach((wp, originalIdx) => {
              if (typeof wp.waypoint_index === "number") order[wp.waypoint_index] = originalIdx;
            });
            optimized = true;
          }
        } catch { /* cae a ruta directa abajo */ }
      }

      // â”€â”€ Ruta directa (2 puntos) o fallback si TRIP fallÃ³ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (distanceM == null) {
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
        const routeRes  = await fetch(routeUrl);
        const routeData = await routeRes.json();
        if (routeData.routes?.[0]) {
          distanceM = routeData.routes[0].distance;
          geometry  = routeData.routes[0].geometry;
        }
      }

      if (distanceM == null) {
        setRouteError("No se pudo calcular la ruta entre las direcciones.");
        return;
      }

      // OSRM ya suma todos los tramos en distance
      const distanceKm = Math.round((distanceM / 1000) * 10) / 10;
      const price = calcPrice(distanceKm, form.estimatedWeightKg, isRM, form.avionetaCount);
      setRouteInfo({ distanceKm, price, isRM, geometry, order, optimized });
    } catch {
      setRouteError("Error de red al calcular la ruta.");
    } finally {
      setGeocoding(false);
    }
  }

  // â”€â”€â”€ Recalculate price if weight changes after route is drawn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (routeInfo && form.estimatedWeightKg) {
      const isRM = RM_COMUNAS.has(form.pickupCommune) && RM_COMUNAS.has(form.deliveryCommune);
      const price = calcPrice(routeInfo.distanceKm, form.estimatedWeightKg, isRM, form.avionetaCount);
      setRouteInfo(prev => prev ? { ...prev, price, isRM } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.estimatedWeightKg]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.rut || !validateRut(form.rut)) { setError("RUT invÃ¡lido â€” verifica el dÃ­gito verificador"); return; }
    if (!form.contactEmail.includes("@")) { setError("Correo electrÃ³nico invÃ¡lido"); return; }
    if (!form.pickupAddress.trim())   { setError("Ingresa la direcciÃ³n de retiro"); return; }
    if (!form.deliveryAddress.trim()) { setError("Ingresa la direcciÃ³n de entrega"); return; }

    // â”€â”€â”€ Date / time validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (form.requiredDate) {
      const timeStr = form.requiredTime || "09:00";
      const requested = new Date(`${form.requiredDate}T${timeStr}:00`);
      const minAllowed = new Date(Date.now() + 4 * 60 * 60 * 1000); // now + 4h
      if (requested < minAllowed) {
        setError("La fecha y hora de retiro debe ser al menos 4 horas desde ahora");
        return;
      }
      if (form.requiredTime && form.requiredTime > "21:00") {
        setError("No se puede agendar pasadas las 21:00 horas");
        return;
      }
    }

    // â”€â”€â”€ Entregas adicionales: validar las que tengan texto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cleanExtra = extraDeliveries
      .map(d => ({ address: (d.address || "").trim(), commune: d.commune || "", coords: d.coords || null }))
      .filter(d => d.address.length > 0);
    if (cleanExtra.some(d => d.address.length < 4)) {
      setError("Hay una entrega adicional incompleta â€” escribe la direcciÃ³n o quÃ­tala");
      return;
    }
    // Lista completa de entregas: destino principal + adicionales
    const deliveryStops = [
      { address: form.deliveryAddress.trim(), commune: form.deliveryCommune || "", coords: deliveryCoords },
      ...cleanExtra,
    ];

    setLoading(true);
    setError("");
    // Minimum loader duration so the SaulLoader animation completes all 4 steps
    // (~800 + 1200 + 900 + 1100 = 4000 ms). Only enforced on success â€” errors exit immediately.
    const MIN_LOADER_MS = 4000;
    try {
      const payload = {
        customerName: form.customerName,
        customerRut: form.rut,
        contactPerson: form.customerName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        pickupAddress: form.pickupAddress,
        deliveryAddress: form.deliveryAddress,
        deliveryStops,
        destinationCity: form.deliveryCommune || form.deliveryAddress.split(",")[1]?.trim() || "",
        packages: form.packages,
        estimatedWeightKg: form.estimatedWeightKg,
        cargoDescription: form.cargoDescription,
        requiredDate: form.requiredDate,
        requiredTime: form.requiredTime,
        distanceKm: routeInfo?.distanceKm,
        avionetaCount: form.avionetaCount,
        avioneta: form.avionetaCount > 0,
        urgent: form.urgent || false,
        observations: `${form.urgent ? "âš¡ URGENTE\n" : ""}${form.observations}`.trim(),
        photos: [],  // Photos sent separately in background (faster first response)
        bultosDetail: bultos.filter(b => b.largo || b.ancho || b.alto || b.peso),
      };
      // Run the API call and the minimum-duration timer in parallel.
      // The timer only pads the success path; throw exits immediately and skips the delay.
      const [res] = await Promise.all([
        fetch(`${API_URL}/quote-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        new Promise(resolve => setTimeout(resolve, MIN_LOADER_MS)),
      ]);
      // Lee el cuerpo de forma robusta: puede venir vacÃ­o o no-JSON (API
      // inalcanzable, 500 sin body, timeout del proxy, etc.). Nunca dejamos
      // que un res.json() crudo reviente con "Unexpected end of JSON input":
      // siempre mostramos un mensaje claro al usuario.
      let data = {};
      try {
        const raw = await res.text();
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(
          data.message ||
          `No pudimos enviar tu solicitud (error ${res.status}). IntÃ©ntalo de nuevo en unos segundos.`
        );
      }
      if (!data.request) {
        throw new Error(
          "Tu solicitud saliÃ³, pero no recibimos confirmaciÃ³n del servidor. " +
          "EscrÃ­benos por WhatsApp para asegurarnos de que llegÃ³."
        );
      }

      // â”€â”€â”€ Show success IMMEDIATELY â€” tracking code ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setCreated(data.request);
      setForm(getInitialForm());
      setRouteInfo(null);
      setPickupCoords(null);
      setDeliveryCoords(null);
      setExtraDeliveries([]);
      const capturedImages = [...images];
      setImages([]);
      // Scroll to top of page so user sees the success screen
      window.scrollTo({ top: 0, behavior: "smooth" });

      // â”€â”€â”€ Background: subir fotos (no bloqueante) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Las notificaciones por email (cliente + operador) las envÃ­a el SERVIDOR
      // automÃ¡ticamente en POST /quote-requests vÃ­a Resend/SMTP. El formulario
      // pÃºblico ya NO llama /mail/send ni /whatsapp/send (endpoints protegidos).
      const savedImages = capturedImages;
      (async () => {
        try {
          if (savedImages.length > 0 && data.request?.id) {
            fetch(`${API_URL}/quote-requests/${data.request.id}/photos`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photos: savedImages }),
            }).catch(() => {});
          }
        } catch { /* upload de fotos es best-effort */ }
      })();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* â”€â”€â”€ SaÃºl loader during form submission â”€â”€â”€ */}
      <SaulLoader visible={loading} />

      {/* â”€â”€â”€ NAVBAR â”€â”€â”€ */}
      <header className="sticky top-0 z-50 border-b border-dropit-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-lg bg-white border border-black shadow-sm">
              <img src="/dropit-logo.jpeg" alt="DropIt Service" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-black text-dropit-950">
              Drop<span className="text-dropit-accent">It</span> Service
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-dropit-700 md:flex">
            <a href="#como-funciona" className="hover:text-dropit-accent transition-colors">CÃ³mo funciona</a>
            <a href="#formulario" className="hover:text-dropit-accent transition-colors">Cotizar</a>
            <a href="#mapa" className="hover:text-dropit-accent transition-colors">Cobertura</a>
            <button
              onClick={() => setTrackingOpen((o) => !o)}
              className={`flex items-center gap-1.5 transition-colors ${trackingOpen ? "text-dropit-accent" : "hover:text-dropit-accent"}`}
            >
              <Search size={14} />
              Seguimiento
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://api.whatsapp.com/send?phone=56950979687&text=Hola%2C%20%F0%9F%91%8B%20%0AQuisiera%20informaci%C3%B3n%20sobre%20sus%20servicios...%0AGracias!!%20%F0%9F%98%80"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors shadow-sm sm:px-4"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="hidden sm:inline">ContÃ¡ctanos</span>
            </a>
            <a
              href="/"
              className="inline-flex rounded-lg border border-dropit-300 px-2.5 py-1.5 text-xs font-semibold text-dropit-950 hover:bg-dropit-100 transition-colors sm:px-4 sm:py-2 sm:text-sm"
            >
              Acceso operadores
            </a>
            <button
              onClick={scrollToForm}
              className="rounded-lg bg-dropit-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-colors"
            >
              Cotizar ahora
            </button>
          </div>
        </div>
      </header>

      {/* â”€â”€â”€ SEGUIMIENTO DROPDOWN â”€â”€â”€ */}
      {trackingOpen && (
        <div className="border-b border-dropit-200 bg-white px-4 py-6 shadow-lg">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-dropit-accent">Tracking</p>
                <h3 className="text-xl font-black text-dropit-950">Rastrear mi envÃ­o</h3>
              </div>
              <button onClick={() => { setTrackingOpen(false); setTrackingResult(null); setTrackingError(""); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={searchTracking} className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="Ingresa tu cÃ³digo de seguimiento (ej: DR-001)"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
              <button type="submit" className="rounded-xl bg-dropit-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-dropit-accent-dark">
                <Search size={16} />
              </button>
            </form>

            {trackingError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{trackingError}</p>
            )}

            {trackingResult && (
              <div className="mt-4 rounded-xl border border-dropit-accent/20 bg-dropit-accent/5 p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-dropit-950">{trackingResult.client}</p>
                    <p className="text-xs text-slate-500">{trackingResult.address}</p>
                  </div>
                  <span className="rounded-full bg-dropit-accent px-3 py-1 text-xs font-bold text-white">{trackingResult.status}</span>
                </div>
                {/* Timeline */}
                <div className="flex items-center gap-0">
                  {trackingResult.steps.map((step, i) => {
                    const done = i <= trackingResult.currentStep;
                    const active = i === trackingResult.currentStep;
                    return (
                      <div key={step} className="flex flex-1 flex-col items-center gap-1">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          done ? "bg-dropit-accent text-white" : "bg-slate-200 text-slate-400"
                        } ${active ? "ring-2 ring-dropit-accent ring-offset-2" : ""}`}>
                          {done && i < trackingResult.currentStep ? <CheckCircle2 size={14} /> : i + 1}
                        </div>
                        <p className={`text-center text-[10px] font-medium leading-tight ${done ? "text-dropit-accent" : "text-slate-400"}`}>{step}</p>
                        {i < trackingResult.steps.length - 1 && (
                          <div className={`absolute h-0.5 w-full translate-y-[-14px] ${done && i < trackingResult.currentStep ? "bg-dropit-accent" : "bg-slate-200"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-center text-xs text-slate-500">ETA: <span className="font-bold text-dropit-accent">{trackingResult.eta}</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ HERO â”€â”€â”€ */}
      <section className="relative overflow-hidden bg-dropit-950 px-4 py-24 text-white">
        {/* Marketing carousel â€” smart fit: blurred fill + contained main image */}
        {carouselImages.length > 0 ? carouselImages.map((src, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === carouselIndex ? 1 : 0 }}
          >
            {/* Blurred fill for letterbox areas */}
            <div className="absolute inset-0 scale-110 bg-cover bg-center blur-md opacity-35" style={{ backgroundImage: `url(${src})` }} />
            {/* Main image contained â€” no cropping */}
            <img src={src} className="absolute inset-0 h-full w-full object-contain opacity-55" alt="" />
          </div>
        )) : (
          /* Animated illustration fallback when no carousel images are loaded */
          <HeroAnimation />
        )}
        {/* Dark gradient overlay â€” stronger at bottom for text legibility */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(12,8,4,0.55) 0%, rgba(12,8,4,0.45) 40%, rgba(12,8,4,0.65) 100%)"
        }} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-dropit-accent/10 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-dropit-accent/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-dropit-accent/30 bg-dropit-accent/10 px-4 py-2 text-sm font-semibold text-dropit-accent">
            <Zap size={14} />
            CotizaciÃ³n en menos de 1 hora
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] md:text-7xl">
            Entregamos donde<br />
            <span className="text-dropit-accent">nadie mÃ¡s llega.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)] md:text-xl">
            Fletes, Ãºltima milla y distribuciÃ³n urbana con tecnologÃ­a de primer nivel.
            Tracking en tiempo real, rutas optimizadas y atenciÃ³n inmediata.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
            <button
              onClick={scrollToForm}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-dropit-accent px-8 py-4 text-base font-bold text-white shadow-xl shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all hover:scale-105"
            >
              Solicitar cotizaciÃ³n gratis
              <ArrowRight size={18} />
            </button>
            <a
              href="#como-funciona"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/8 transition-colors"
            >
              Â¿CÃ³mo funciona?
              <ChevronRight size={18} />
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:mt-12 sm:flex-row sm:items-center sm:gap-6 sm:pt-10">
            <div className="flex -space-x-2">
              {["C", "M", "A", "R"].map((l, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dropit-950 bg-dropit-accent text-xs font-bold text-white"
                >
                  {l}
                </div>
              ))}
            </div>
            <div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} size={14} className="fill-dropit-accent text-dropit-accent" />)}
              </div>
              <p className="mt-1 text-xs text-dropit-400">+200 entregas exitosas este mes</p>
            </div>
          </div>

          {/* Carousel dot indicators */}
          {carouselImages.length > 1 && (
            <div className="mt-8 flex justify-center gap-1.5">
              {carouselImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === carouselIndex ? "w-6 bg-dropit-accent" : "w-1.5 bg-white/30"}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* â”€â”€â”€ FEATURES â”€â”€â”€ */}
      <section className="bg-dropit-100 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Por quÃ© DropIt Service</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-dropit-950">TecnologÃ­a que trabaja por ti</h2>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border border-dropit-300 bg-white p-6 shadow-sm transition-all hover:border-dropit-accent/40 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-dropit-accent/10 transition-colors group-hover:bg-dropit-accent">
                  <Icon size={22} className="text-dropit-accent transition-colors group-hover:text-white" />
                </div>
                <h3 className="font-bold text-dropit-950">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dropit-700">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ CÃ“MO FUNCIONA â”€â”€â”€ */}
      <section id="como-funciona" className="px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Proceso simple</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-dropit-950">4 pasos para tu entrega</h2>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="relative">
                <div className="mb-4 text-5xl font-black text-dropit-accent/20">{num}</div>
                <h3 className="font-bold text-dropit-950">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dropit-700">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ FORMULARIO â”€â”€â”€ */}
      <section id="formulario" ref={formRef} className="px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">CotizaciÃ³n gratuita</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-dropit-950">CuÃ©ntanos tu necesidad</h2>
            <p className="mt-3 text-dropit-700">
              Completa el formulario y recibirÃ¡s tu cotizaciÃ³n en menos de 1 hora hÃ¡bil
            </p>
          </div>

          {created ? (
            /* â”€â”€ SUCCESS SCREEN â€” full page overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-dropit-950/90 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-br from-dropit-accent via-orange-500 to-dropit-accent-dark px-8 py-10 text-center text-white">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur ring-4 ring-white/30">
                    <CheckCircle2 size={40} className="text-white" />
                  </div>
                  <h3 className="text-3xl font-black">Â¡Solicitud enviada!</h3>
                  <p className="mt-2 text-base text-white/85">Te responderemos en menos de 1 hora hÃ¡bil</p>
                  <div className="mt-5 inline-flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-6 py-3 backdrop-blur">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/70">CÃ³digo de seguimiento</span>
                    <span className="font-mono text-2xl font-black tracking-widest">{created.trackingCode}</span>
                  </div>
                </div>

                {/* Detail cards */}
                <div className="grid gap-3 p-6 sm:grid-cols-2">
                  <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">NÂ° Solicitud</p>
                    <p className="mt-1 font-mono text-lg font-black text-dropit-950">{created.id}</p>
                  </div>
                  <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">Carga</p>
                    <p className="mt-1 text-base font-black text-dropit-950">{created.packages} bultos Â· {created.estimatedWeightKg} kg</p>
                  </div>
                  <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">ðŸ“ Retiro</p>
                    <p className="mt-1 text-sm font-semibold text-dropit-800">{created.pickupAddress}</p>
                  </div>
                  <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">ðŸ Entrega</p>
                    <p className="mt-1 text-sm font-semibold text-dropit-800">{created.deliveryAddress}</p>
                  </div>
                </div>

                <div className="border-t border-dropit-200 bg-dropit-50/50 px-6 py-5">
                  <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 mb-4">
                    <Mail size={18} className="flex-shrink-0 mt-0.5 text-sky-500" />
                    <p className="text-sm text-sky-700">
                      Enviamos confirmaciÃ³n a <strong>{created.contactEmail}</strong> â€” recibirÃ¡s tu cotizaciÃ³n formal muy pronto
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setCreated(null)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dropit-accent px-6 py-3 font-bold text-dropit-accent hover:bg-dropit-accent/5 transition-colors"
                    >
                      <ArrowRight size={16} />
                      Nueva solicitud
                    </button>
                    <a
                      href={`#formulario`}
                      onClick={() => { setCreated(null); setTimeout(() => setTrackingOpen(true), 200); }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-dropit-accent px-6 py-3 font-bold text-white hover:bg-dropit-accent-dark transition-colors"
                    >
                      <Search size={16} />
                      Ver seguimiento
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="rounded-2xl border border-dropit-300 bg-white shadow-xl"
            >
              {/* Form sections */}
              <div className="divide-y divide-dropit-200">
                {/* Datos cliente */}
                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                      <User size={18} className="text-dropit-accent" />
                    </div>
                    <h3 className="text-lg font-bold text-dropit-950">Datos del solicitante</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label-base">RUT <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input className={`input-base ${fieldGreen("rut", form)}`} placeholder="12.456.789-K" maxLength={12}
                          value={form.rut}
                          onChange={e => update("rut", formatRut(e.target.value))} />
                        {form.rut && isFieldValid("rut", form) && (
                          <CheckCircle2 size={18} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <Field label="Empresa o Persona" field="customerName" form={form} update={update} placeholder="Nombre completo o razÃ³n social" />
                    <div>
                      <label className="label-base">TelÃ©fono <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input className={`input-base ${fieldGreen("contactPhone", form)}`} type="tel" placeholder="+56 9 1234 5678"
                          value={form.contactPhone}
                          onChange={e => update("contactPhone", e.target.value)}
                          onBlur={e => { const fmt = formatPhone(e.target.value); if (fmt !== e.target.value) update("contactPhone", fmt); }}
                        />
                        {form.contactPhone && isFieldValid("contactPhone", form) && (
                          <CheckCircle2 size={18} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <Field label="Correo electrÃ³nico" field="contactEmail" form={form} update={update} type="email" placeholder="juan@empresa.cl" />
                  </div>
                </div>

                {/* Ubicaciones */}
                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                      <MapPin size={18} className="text-dropit-accent" />
                    </div>
                    <h3 className="text-lg font-bold text-dropit-950">Origen y destino</h3>
                  </div>

                  {/* Address pair â€” Google Maps style */}
                  <AddressPair
                    pickupValue={form.pickupAddress}
                    onPickupChange={v => update("pickupAddress", v)}
                    onPickupCommune={v => update("pickupCommune", v)}
                    onPickupCoords={coords => setPickupCoords(coords)}
                    deliveryValue={form.deliveryAddress}
                    onDeliveryChange={v => update("deliveryAddress", v)}
                    onDeliveryCommune={v => update("deliveryCommune", v)}
                    onDeliveryCoords={coords => setDeliveryCoords(coords)}
                  />

                  {/* â”€â”€ Entregas adicionales (1 retiro â†’ varias entregas) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                  {extraDeliveries.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {extraDeliveries.map((d, idx) => (
                        <div key={idx} className="rounded-2xl border border-dropit-200 bg-dropit-50/60 p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-dropit-accent">
                              <MapPin size={11} /> Entrega {idx + 2}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeDelivery(idx)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Quitar esta entrega"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <StreetAutocomplete
                            value={d.address}
                            onChange={v => updateDelivery(idx, { address: v, coords: null })}
                            onComunaChange={v => updateDelivery(idx, { commune: v })}
                            onCoordsChange={coords => updateDelivery(idx, { coords })}
                            placeholder={`Calle y nÃºmero de la entrega ${idx + 2}`}
                            dotColor="#F97316"
                            inputClassName={d.address && d.address.trim().length >= 4 ? "!border-emerald-400 !bg-emerald-50/50 focus:!ring-emerald-300" : ""}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addDelivery}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-2 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent/10 transition-colors"
                  >
                    <Plus size={15} />
                    Agregar otra entrega
                  </button>

                  {/* Date + time */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label-base">Fecha requerida <span className="text-red-500">*</span></label>
                      <input
                        className={`input-base ${fieldGreen("requiredDate", form)}`}
                        type="date"
                        value={form.requiredDate}
                        onChange={e => update("requiredDate", e.target.value)}
                        min={(() => { const d = new Date(Date.now() + 4 * 60 * 60 * 1000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })()}
                        required
                      />
                      <p className="mt-1 text-[10px] text-dropit-500">MÃ­nimo 4 horas desde ahora</p>
                    </div>
                    <div>
                      <label className="label-base">Hora de retiro</label>
                      <input className={`input-base ${fieldGreen("requiredTime", form)}`} type="time" value={form.requiredTime}
                        onChange={e => update("requiredTime", e.target.value)}
                        max="21:00" />
                      <p className="mt-1 text-[10px] text-dropit-500">Hasta las 21:00 hrs</p>
                    </div>
                  </div>

                  {/* Route status */}
                  {geocoding && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-dropit-700">
                      <Loader2 size={14} className="animate-spin text-dropit-accent" />
                      Calculando rutaâ€¦
                    </div>
                  )}
                  {routeError && !geocoding && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
                      <AlertCircle size={14} className="flex-shrink-0" /> {routeError}
                    </p>
                  )}

                  {/* Route result */}
                  {routeInfo && (() => {
                    // Total stop count: main delivery + extra deliveries with coords
                    const resolvedExtras = extraDeliveries.filter(d => d.coords).length;
                    const totalDestinos = 1 + resolvedExtras; // 1 = main delivery
                    return (
                    <div className="mt-3 overflow-hidden rounded-xl border border-dropit-300 shadow-sm">
                      {/* Route info banner â€” price hidden to prevent scraping */}
                      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 border-b border-dropit-accent/20 bg-gradient-to-r from-dropit-accent/10 to-orange-50">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dropit-accent/20">
                            <RouteIcon size={17} className="text-dropit-accent" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-dropit-600">Ruta calculada</p>
                            <p className="text-2xl font-black text-dropit-950">
                              {routeInfo.distanceKm} <span className="text-base font-bold">km</span>
                              {totalDestinos > 1 && (
                                <span className="ml-2 text-sm font-semibold text-dropit-600">Â· {totalDestinos} destinos</span>
                              )}
                            </p>
                            {routeInfo.optimized && (
                              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                <Zap size={11} className="flex-shrink-0" /> Ruta optimizada Â· orden inteligente de paradas
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5">
                          <span className="text-xl">ðŸ’°</span>
                          <div>
                            <p className="text-xs font-bold text-sky-700">CotizaciÃ³n personalizada</p>
                            <p className="text-[11px] text-sky-600">RecibirÃ¡s el precio exacto en tu correo en <strong>menos de 1 hora hÃ¡bil</strong></p>
                          </div>
                        </div>
                      </div>
                      {/* Ayudantes de carga */}
                      <div className="border-b border-dropit-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl">ðŸ’ª</div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">Â¿Necesitas ayuda con la carga?</p>
                              <p className="mt-0.5 text-xs text-slate-500">Sumamos peonetas profesionales para objetos pesados, voluminosos o frÃ¡giles</p>
                              <p className="mt-1 text-xs text-slate-400">El valor se cotiza segÃºn el trabajo y metodologÃ­a requerida</p>
                              {form.avionetaCount > 0 && (
                                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                                  {form.avionetaCount} peoneta{form.avionetaCount > 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 rounded-full border border-blue-200 bg-white px-1 py-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => update("avionetaCount", Math.max(0, (form.avionetaCount || 0) - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30"
                              disabled={!form.avionetaCount}
                            >âˆ’</button>
                            <span className="w-6 text-center text-lg font-black text-slate-800">{form.avionetaCount || 0}</span>
                            <button
                              type="button"
                              onClick={() => update("avionetaCount", Math.min(5, (form.avionetaCount || 0) + 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>
                      {/* Route map */}
                      <div ref={routeMapRef} className="w-full" style={{ height: "420px", background: "#e8e8e0" }} />
                    </div>
                    );
                  })()}
                </div>

                {/* Carga */}
                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                      <Package size={18} className="text-dropit-accent" />
                    </div>
                    <h3 className="text-lg font-bold text-dropit-950">Detalle de carga</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Cantidad de bultos" field="packages" form={form} update={update} type="number" placeholder="Ej: 10" />
                    <Field label="Peso estimado (kg)" field="estimatedWeightKg" form={form} update={update} type="number" placeholder="Ej: 250" />
                    <div className="md:col-span-2">
                      <label className="label-base">DescripciÃ³n de la carga</label>
                      <div className="relative">
                        <textarea
                          className={`input-base min-h-[88px] resize-none ${fieldGreen("cargoDescription", form)}`}
                          value={form.cargoDescription}
                          onChange={(e) => update("cargoDescription", e.target.value)}
                          placeholder="Ej: Cajas de electrodomÃ©sticos, requieren cuidado especial..."
                          required
                        />
                        {form.cargoDescription && isFieldValid("cargoDescription", form) && (
                          <CheckCircle2 size={18} className="pointer-events-none absolute right-2.5 top-3 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label-base">Observaciones (opcional)</label>
                      <textarea
                        className="input-base min-h-[72px] resize-none"
                        value={form.observations}
                        onChange={(e) => update("observations", e.target.value)}
                        placeholder="Ej: Debe ingresar por portÃ³n lateral, preguntar por Jorge..."
                      />
                    </div>

                    {/* Urgente toggle */}
                    <div className="md:col-span-2">
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-all select-none ${form.urgent ? 'border-red-400 bg-red-50' : 'border-dropit-200 bg-white hover:border-dropit-300'}`}>
                        <div className={`flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.urgent ? 'bg-red-500' : 'bg-slate-200'}`}>
                          <div className={`h-5 w-5 rounded-full bg-white shadow transform transition-transform ${form.urgent ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-dropit-950 flex items-center gap-1.5">
                            <Zap size={14} className={form.urgent ? "text-red-500" : "text-dropit-400"} />
                            CotizaciÃ³n urgente
                          </span>
                          <p className="text-xs text-dropit-500 mt-0.5">Prioridad inmediata â€” respuesta en menos de 30 minutos</p>
                        </div>
                        <input type="checkbox" className="sr-only" checked={form.urgent} onChange={e => update("urgent", e.target.checked)} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Medidas por bulto */}
                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                        <Package size={18} className="text-dropit-accent" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-dropit-950">Medidas por bulto</h3>
                        <p className="text-xs text-dropit-600">Opcional â€” para cotizaciÃ³n mÃ¡s exacta</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addBulto}
                      className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-1.5 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent/10 transition-colors"
                    >
                      <Plus size={15} />
                      Agregar bulto
                    </button>
                  </div>

                  {bultos.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-dropit-300 py-6 text-center text-sm text-dropit-500">
                      Sin medidas â€” haz clic en "Agregar bulto" si quieres detallar dimensiones
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {bultos.map((b, idx) => (
                        <div key={idx} className="rounded-xl border border-dropit-200 bg-dropit-100/40 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-dropit-700">Bulto {idx + 1}</p>
                            <button
                              type="button"
                              onClick={() => removeBulto(idx)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {[
                              { key: "largo", label: "Largo (cm)" },
                              { key: "ancho", label: "Ancho (cm)" },
                              { key: "alto", label: "Alto (cm)" },
                              { key: "peso", label: "Peso (kg)" },
                            ].map(({ key, label }) => (
                              <div key={key}>
                                <label className="mb-1 block text-xs font-medium text-dropit-700">{label}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  className="w-full rounded-lg border border-dropit-300 bg-white px-3 py-2 text-sm focus:border-dropit-accent focus:outline-none focus:ring-1 focus:ring-dropit-accent/30"
                                  value={b[key]}
                                  onChange={(e) => updateBulto(idx, key, e.target.value)}
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fotos de la carga */}
              <div className="border-t border-dropit-200 p-6 md:p-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                      <Camera size={18} className="text-dropit-accent" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-dropit-950">Fotos de la carga <span className="text-xs font-normal text-dropit-500">(opcional)</span></h3>
                      <p className="text-xs text-dropit-500">Capacidad mÃ¡xima: {MAX_PHOTOS} fotos de envÃ­o</p>
                    </div>
                  </div>
                  {images.length > 0 && (
                    <span className="rounded-full bg-dropit-accent/10 px-2.5 py-1 text-xs font-bold text-dropit-accent">
                      {images.length}/{MAX_PHOTOS}
                    </span>
                  )}
                </div>

                {/* Thumbnails row â€” fotos ya agregadas */}
                {images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-dropit-200 shadow-sm">
                        <img src={img} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                          <button
                            type="button"
                            onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                            className="scale-0 rounded-full bg-red-500 p-1 text-white shadow transition-transform group-hover:scale-100"
                          ><X size={10} /></button>
                        </div>
                        <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload zone â€” solo si hay espacio */}
                {images.length < MAX_PHOTOS && (
                  <label
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all ${
                      photoUploading
                        ? "border-dropit-accent/40 bg-dropit-accent/5"
                        : "border-dropit-300 bg-dropit-50 hover:border-dropit-accent hover:bg-dropit-accent/5"
                    }`}
                  >
                    {photoUploading ? (
                      <>
                        <Loader2 size={22} className="text-dropit-accent animate-spin" />
                        <p className="text-sm font-semibold text-dropit-600">Procesando imagen...</p>
                      </>
                    ) : (
                      <>
                        <Camera size={22} className="text-dropit-400" />
                        <p className="text-sm font-semibold text-dropit-600">
                          {images.length === 0 ? "Agregar fotos de la carga" : `Agregar mÃ¡s Â· ${MAX_PHOTOS - images.length} disponible${MAX_PHOTOS - images.length !== 1 ? "s" : ""}`}
                        </p>
                        <p className="text-xs text-dropit-400">JPG, PNG â€” toca para seleccionar o arrastra aquÃ­</p>
                      </>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - images.length);
                        if (!files.length) return;
                        setPhotoUploading(true);
                        try {
                          const compressed = await Promise.all(
                            files.map(async (f) => {
                              if (f.size > 15 * 1024 * 1024) return null;
                              try { return await compressImage(f, 1280, 0.82); } catch { return null; }
                            })
                          );
                          setImages(prev => [...prev, ...compressed.filter(Boolean)].slice(0, MAX_PHOTOS));
                        } catch { /* silent */ }
                        setPhotoUploading(false);
                        if (photoInputRef.current) photoInputRef.current.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Submit */}
              <div className="border-t border-dropit-200 bg-dropit-100/50 p-6 md:p-8">
                {error && (
                  <div className="mb-4 flex gap-3 rounded-xl border border-dropit-error/30 bg-dropit-error/8 p-4">
                    <AlertCircle size={18} className="flex-shrink-0 text-dropit-error" />
                    <p className="text-sm font-medium text-dropit-error">{error}</p>
                  </div>
                )}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-dropit-700">
                    Al enviar aceptas nuestra{" "}
                    <a href="/privacidad" className="font-semibold text-dropit-accent hover:underline">
                      polÃ­tica de privacidad
                    </a>
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-dropit-accent px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Enviando solicitud...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Solicitar cotizaciÃ³n gratis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* â”€â”€â”€ MAPA â”€â”€â”€ */}
      <section id="mapa" className="bg-dropit-950 px-4 py-12 sm:py-20" style={{ isolation: "isolate" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Cobertura nacional</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-white">De Arica a Punta Arenas</h2>
            <p className="mt-3 text-dropit-400">Una red de despacho que cubre los 4.300 km de Chile â€” sin excepciones</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-dropit-accent/10">
            <ChileCoverageMap height="500px" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            {[
              { val: "17", suffix: " ciudades", label: "Nodos de cobertura", icon: "ðŸ“" },
              { val: "4.300", suffix: " km", label: "Arica â†’ Punta Arenas", icon: "ðŸ›£ï¸" },
              { val: "<1", suffix: "h", label: "CotizaciÃ³n garantizada", icon: "âš¡" },
              { val: "24/7", suffix: "", label: "Seguimiento en tiempo real", icon: "ðŸ“¡" },
            ].map(({ val, suffix, label, icon }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-colors">
                <p className="text-2xl">{icon}</p>
                <p className="mt-1 text-2xl font-black text-dropit-accent leading-none">{val}<span className="text-base font-bold">{suffix}</span></p>
                <p className="mt-1.5 text-[11px] leading-tight text-dropit-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ FOOTER â”€â”€â”€ */}
      <footer className="border-t border-dropit-200 bg-dropit-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            {/* Brand */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-white border border-black shadow-sm">
                  <img src="/dropit-logo.jpeg" alt="DropIt Service" className="h-full w-full object-cover" />
                </div>
                <span className="text-lg font-black text-white">
                  Drop<span className="text-dropit-accent">It</span> Service
                </span>
              </div>
              <p className="max-w-xs text-sm text-dropit-500">
                Fletes, Ãºltima milla y distribuciÃ³n con tecnologÃ­a de primer nivel en todo Chile.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-dropit-400">NavegaciÃ³n</p>
              <a href="#como-funciona" className="text-sm text-dropit-500 hover:text-white transition-colors">CÃ³mo funciona</a>
              <a href="#formulario" className="text-sm text-dropit-500 hover:text-white transition-colors">Solicitar cotizaciÃ³n</a>
              <a href="#mapa" className="text-sm text-dropit-500 hover:text-white transition-colors">Cobertura</a>
              <a href="/privacidad" className="text-sm text-dropit-500 hover:text-white transition-colors">PolÃ­tica de privacidad</a>
            </div>

            {/* Social + contact â€” centered */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-dropit-400">SÃ­guenos</p>
              <div className="flex items-center justify-center gap-4">
                {/* Instagram */}
                <a href="https://www.instagram.com/dropit.service?igsh=MThpdnhmOG1zOGc4eg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 transition-all"
                  title="Instagram">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                {/* Facebook */}
                <a href="https://www.facebook.com/share/18QJHs8tKm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-blue-600 transition-all"
                  title="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* WhatsApp */}
                <a href="https://api.whatsapp.com/send?phone=56950979687&text=Hola%2C%20%F0%9F%91%8B%20%0AQuisiera%20informaci%C3%B3n%20sobre%20sus%20servicios...%0AGracias!!%20%F0%9F%98%80"
                  target="_blank" rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-emerald-500 transition-all"
                  title="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
              {/* WhatsApp CTA â€” centered */}
              <a
                href="https://api.whatsapp.com/send?phone=56950979687&text=Hola%2C%20%F0%9F%91%8B%20%0AQuisiera%20informaci%C3%B3n%20sobre%20sus%20servicios...%0AGracias!!%20%F0%9F%98%80"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                EscrÃ­benos por WhatsApp
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-dropit-600">
              Â© 2026 DropIt Service Â· Santiago, Chile Â· Fletes y distribuciÃ³n con tecnologÃ­a de primer nivel
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, field, form, update, type = "text", placeholder = "" }) {
  const valid = isFieldValid(field, form);
  const filled = String(form?.[field] ?? "").trim().length > 0;
  return (
    <div>
      <label className="label-base">{label}</label>
      <div className="relative">
        <input
          className={`input-base ${fieldGreen(field, form)}`}
          type={type}
          value={form[field]}
          onChange={(e) => update(field, e.target.value)}
          placeholder={placeholder}
          required={field !== "observations"}
        />
        {filled && valid && (
          <CheckCircle2
            size={18}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500"
          />
        )}
      </div>
    </div>
  );
}
