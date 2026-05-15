import { useState, useEffect, useRef } from "react";
import {
  Truck, MapPin, Package, Phone, Mail, User, Calendar,
  CheckCircle2, ChevronRight, ChevronDown, Star, Zap, Shield, Clock,
  ArrowRight, Send, Navigation, AlertCircle, Search, X,
  Plus, Trash2, Camera, Route as RouteIcon, Loader2,
} from "lucide-react";
import { tplClienteNuevaCotizacion, tplEmpresaNuevaCotizacion, getLogoUrl, getCompanyName } from "../lib/emailTemplates";
import { calcPrice } from "../lib/pricing";
import ChileCoverageMap from "../components/ChileCoverageMap";
import { loadGoogleMaps } from "../components/GoogleMap";

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// ─── Chilean communes ─────────────────────────────────────────────────────────
const COMUNAS = [
  "Alhué","Alto Biobío","Alto del Carmen","Alto Hospicio","Ancud","Andacollo","Angol",
  "Antofagasta","Arauco","Arica","Aysén","Buin","Bulnes","Cabildo","Cabo de Hornos",
  "Calama","Caldera","Calera","Calera de Tango","Camarones","Carahue","Cartagena",
  "Castro","Cauquenes","Chaitén","Chañaral","Chimbarongo","Chiguayante","Chillán",
  "Chillán Viejo","Chonchi","Cisnes","Colchane","Colina","Coltauco","Combarbalá",
  "Concepción","Conchalí","Concón","Constitución","Copiapó","Coquimbo","Coronel",
  "Corral","Coyhaique","Curicó","Dalcahue","El Bosque","El Monte","El Quisco",
  "El Tabo","Estación Central","Freire","Freirina","Fresia","Frutillar","Futrono",
  "General Lagos","Graneros","Gorbea","Hijuelas","Hualaihué","Hualqui","Huara",
  "Huasco","Huechuraba","Illapel","Independencia","Isla de Maipo","Iquique",
  "La Calera","La Cisterna","La Cruz","La Florida","La Granja","La Ligua",
  "La Pintana","La Reina","La Serena","La Unión","Lago Ranco","Lampa","Lanco",
  "Las Cabras","Las Condes","Lautaro","Lebu","Limache","Linares","Lo Barnechea",
  "Lo Espejo","Lo Prado","Longaví","Los Álamos","Los Andes","Los Lagos",
  "Los Muermos","Los Vilos","Los Ángeles","Lota","Macul","Maipú","Máfil",
  "María Elena","María Pinto","Mariquina","Maullín","Mejillones","Melipilla",
  "Molina","Monte Patria","Mostazal","Mulchén","Nacimiento","Nueva Imperial",
  "Ñuñoa","Nogales","Ollagüe","Olmué","Osorno","Ovalle","Padre Hurtado",
  "Padre Las Casas","Paillaco","Paine","Panguipulli","Papudo","Parral",
  "Pedro Aguirre Cerda","Peñaflor","Peñalolén","Penco","Petorca","Peumo",
  "Pica","Pichidegua","Pichilemu","Pitrufquén","Pirque","Porvenir",
  "Pozo Almonte","Providencia","Puchuncaví","Pudahuel","Puerto Montt",
  "Puerto Natales","Puerto Varas","Puerto Williams","Puente Alto","Punitaqui",
  "Purranque","Punta Arenas","Pucón","Putre","Quellón","Quilicura","Quilpué",
  "Quillota","Quinta Normal","Quintero","Rancagua","Recoleta","Renca","Rengo",
  "Retiro","Río Bueno","Río Ibáñez","Río Negro","Sagrada Familia","Salamanca",
  "San Antonio","San Bernardo","San Carlos","San Clemente","San Esteban",
  "San Felipe","San Fernando","San Ignacio","San Javier","San Joaquín",
  "San José de Maipo","San Miguel","San Nicolás","San Pedro","San Pedro de Atacama",
  "San Pedro de la Paz","Santa Bárbara","Santa Cruz","Santa Juana","Santa María",
  "Santiago","Santo Domingo","Sierra Gorda","Talagante","Talca","Talcahuano",
  "Taltal","Temuco","Tierra Amarilla","Tiltil","Tocopilla","Tomé","Tortel",
  "Traiguén","Tucapel","Valdivia","Vallenar","Valparaíso","Victoria","Vicuña",
  "Villa Alemana","Villarrica","Viña del Mar","Vitacura","Yumbel","Zapallar",
].sort();

// ─── Región Metropolitana communes (for pricing) ──────────────────────────────
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

// ─── Image compression — resize + JPEG re-encode ──────────────────────────────
// Reduces large camera photos (5–15 MB) to ~200–500 KB so the JSON payload stays
// manageable and the API can save them reliably to db.json.
async function compressImage(file, maxSide = 1280, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width: w, height: h } = img;
  if (w > maxSide || h > maxSide) {
    const r = Math.min(maxSide / w, maxSide / h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// calcPrice is now imported from ../lib/pricing — works for RM + all of Chile

// ─── RUT helpers ─────────────────────────────────────────────────────────────
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

// ─── Commune searchable selector ─────────────────────────────────────────────
// ─── Nominatim search ─────────────────────────────────────────────────────────
async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=cl&addressdetails=1&limit=7&accept-language=es`;
  const res  = await fetch(url, { headers: { "Accept-Language": "es" } });
  return res.json();
}

function parseNominatim(result) {
  const a       = result.address || {};
  const num     = a.house_number || "";
  const road    = a.road || a.pedestrian || a.footway || a.cycleway || a.path || "";
  const rawCity = a.city_district || a.suburb || a.quarter || a.city || a.town || a.village || a.municipality || "";
  // Try to match commune from our list
  const commune = COMUNAS.find(c => c.toLowerCase() === rawCity.toLowerCase())
               || COMUNAS.find(c => rawCity.toLowerCase().includes(c.toLowerCase()))
               || rawCity;
  const street  = road ? [road, num].filter(Boolean).join(" ") : result.display_name.split(",")[0].trim();
  const subtext = [rawCity, a.county, a.state].filter(Boolean).slice(0, 2).join(", ");
  // Keep coordinates for route calculation
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  return { street, commune, subtext, raw: rawCity, lat, lng };
}

// ─── Extract commune from Google address_components ───────────────────────────
function extractGoogleCommune(components = []) {
  const raw =
    components.find(c => c.types.includes("locality"))?.long_name ||
    components.find(c => c.types.includes("sublocality_level_1"))?.long_name ||
    components.find(c => c.types.includes("administrative_area_level_3"))?.long_name ||
    "";
  return (
    COMUNAS.find(c => c.toLowerCase() === raw.toLowerCase()) ||
    COMUNAS.find(c => raw.toLowerCase().includes(c.toLowerCase())) ||
    raw
  );
}

// ─── Street autocomplete — one input, Google suggestions, no commune picker ───
//
//  value          → what's shown in the input (full address string)
//  onChange       → update the display string
//  onComunaChange → called silently with detected commune (hidden from user)
//  onCoordsChange → called with {lat,lng} when selection resolved
//
function StreetAutocomplete({ value, onChange, onComunaChange, onCoordsChange, placeholder, dotColor = "#F97316", required }) {
  const [open,       setOpen]    = useState(false);
  const [results,    setResults] = useState([]);   // [{label, sublabel, placeId?, ...nominatim}]
  const [loading,    setLoading] = useState(false);
  const [usingGoogle, setGoogle] = useState(false);
  const debRef   = useRef(null);
  const gmRef    = useRef(null);
  const wrapRef  = useRef(null);

  // Load Google Maps SDK once
  useEffect(() => {
    loadGoogleMaps()
      .then(gm => { gmRef.current = gm; setGoogle(true); })
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function onDown(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    onCoordsChange?.(null);
    clearTimeout(debRef.current);
    if (val.trim().length < 3) { setResults([]); setOpen(false); return; }

    debRef.current = setTimeout(() => {
      setLoading(true);
      const gm = gmRef.current || window.google?.maps;

      if (gm?.places?.AutocompleteService) {
        // ── Google Places ──────────────────────────────────────────────────
        new gm.places.AutocompleteService().getPlacePredictions(
          { input: val, componentRestrictions: { country: "cl" }, types: ["address"] },
          (preds, status) => {
            setLoading(false);
            if (status !== gm.places.PlacesServiceStatus.OK || !preds) { setResults([]); setOpen(false); return; }
            setResults(preds.map(p => ({
              placeId:  p.place_id,
              label:    p.structured_formatting.main_text,
              sublabel: p.structured_formatting.secondary_text || "",
              full:     p.description,
            })));
            setOpen(true);
          }
        );
      } else {
        // ── Nominatim fallback ─────────────────────────────────────────────
        nominatimSearch(val).then(data => {
          const seen = new Set();
          const items = data.map(parseNominatim).filter(p => {
            const k = `${p.street}|${p.commune}`;
            if (seen.has(k)) return false; seen.add(k); return true;
          }).slice(0, 5).map(p => ({
            label:    p.street,
            sublabel: [p.commune, "Chile"].filter(Boolean).join(", "),
            commune:  p.commune,
            lat: p.lat, lng: p.lng,
          }));
          setResults(items);
          setOpen(items.length > 0);
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    }, 280);
  }

  function select(item) {
    const gm = gmRef.current || window.google?.maps;
    setResults([]); setOpen(false);

    if (item.placeId && gm) {
      // Show label immediately, geocode in background for coords+commune
      onChange(item.label + (item.sublabel ? ", " + item.sublabel.split(",")[0] : ""));
      new gm.Geocoder().geocode({ placeId: item.placeId }, (res, status) => {
        if (status !== "OK" || !res[0]) return;
        const loc = res[0].geometry.location;
        onCoordsChange?.({ lat: loc.lat(), lng: loc.lng() });
        onComunaChange?.(extractGoogleCommune(res[0].address_components));
      });
    } else {
      onChange(item.label + (item.sublabel ? ", " + item.sublabel : ""));
      if (item.commune) onComunaChange?.(item.commune);
      if (!isNaN(item.lat)) onCoordsChange?.({ lat: item.lat, lng: item.lng });
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Input */}
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
          <div className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: dotColor, backgroundColor: "#fff" }} />
        </div>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-9 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-dropit-accent focus:outline-none focus:ring-2 focus:ring-dropit-accent/20"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          required={required}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading
            ? <Loader2 size={14} className="animate-spin text-slate-400" />
            : value
              ? <button type="button" onClick={() => { onChange(""); onComunaChange?.(""); onCoordsChange?.(null); setResults([]); setOpen(false); }}>
                  <X size={14} className="text-slate-300 hover:text-slate-500" />
                </button>
              : <Search size={14} className="text-slate-300" />
          }
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-[9999] mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {results.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => select(r)}
              className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                <MapPin size={14} className="text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{r.label}</p>
                <p className="truncate text-xs text-slate-400">{r.sublabel}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-end bg-white px-4 py-2">
            {usingGoogle
              ? <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" className="h-4 object-contain" />
              : <span className="text-[9px] text-slate-400">© OpenStreetMap contributors</span>
            }
          </li>
        </ul>
      )}
    </div>
  );
}

// ─── Commune searchable selector ─────────────────────────────────────────────
function ComunaSelect({ value, onChange, placeholder = "Seleccionar comuna…" }) {
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
                placeholder="Buscar…" value={query} onChange={e => setQuery(e.target.value)} />
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

// ─── Address pair — Google Maps-style vertical stack ──────────────────────────
function AddressPair({
  pickupValue, onPickupChange, onPickupCommune, onPickupCoords,
  deliveryValue, onDeliveryChange, onDeliveryCommune, onDeliveryCoords,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Origin ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-white" />
          <div className="w-px bg-slate-200" style={{ height: 20 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">Origen</p>
          <StreetAutocomplete
            value={pickupValue}
            onChange={onPickupChange}
            onComunaChange={onPickupCommune}
            onCoordsChange={onPickupCoords}
            placeholder="Calle y número de retiro"
            dotColor="#10b981"
            required
          />
        </div>
      </div>

      {/* ── Destination ── */}
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
            placeholder="Calle y número de entrega"
            dotColor="#F97316"
            required
          />
        </div>
      </div>
    </div>
  );
}

// Mock tracking data for public demo
const MOCK_TRACKING = {
  "DR-001": { status: "En reparto", client: "Comercial Las Condes", address: "Apoquindo 4500, Las Condes", steps: ["Recibido","En bodega","En tránsito","En reparto"], currentStep: 3, date: "2026-05-01", eta: "hoy 18:00" },
  "DR-002": { status: "Entregado", client: "Sociedad Vibrados Chile", address: "Estación Central 4022", steps: ["Recibido","En bodega","En tránsito","En reparto","Entregado"], currentStep: 4, date: "2026-04-30", eta: "Entregado 15:46" },
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Pre-filled default form (test data) ─────────────────────────────────────
function getInitialForm() {
  // Auto-set date to tomorrow at 10:00 (always ≥ 4h from now and ≤ 21:00)
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return {
    rut: "12.456.789-K",
    customerName: "Comercial San Martín",
    contactPhone: "+56 9 7746 8766",
    contactEmail: "juandaniel.aguilar17@gmail.com",
    pickupAddress: "Av. Irarrázaval 2401",
    pickupCommune: "Ñuñoa",
    deliveryAddress: "Caupolican 960",
    deliveryCommune: "Providencia",
    packages: "8",
    estimatedWeightKg: "120",
    cargoDescription: "Cajas de material de oficina selladas, frágil",
    requiredDate: `${yyyy}-${mm}-${dd}`,
    requiredTime: "10:00",
    avionetaCount: 0,
    observations: "Favor tocar timbre, preguntar por Valeria",
  };
}
const initialForm = getInitialForm();

const features = [
  {
    icon: Zap,
    title: "Cotización en minutos",
    desc: "Recibe tu propuesta de precio en menos de 1 hora hábil, sin llamadas ni esperas.",
  },
  {
    icon: Navigation,
    title: "Rutas optimizadas",
    desc: "Algoritmo de optimización garantiza el menor tiempo y costo de entrega.",
  },
  {
    icon: Shield,
    title: "Carga asegurada",
    desc: "Tu mercadería viaja protegida con choferes certificados y camiones en buen estado.",
  },
  {
    icon: Clock,
    title: "Tracking en tiempo real",
    desc: "Sigue tu pedido en vivo desde que sale hasta que llega. Sin misterios.",
  },
];

const steps = [
  { num: "01", title: "Solicitas cotización", desc: "Completas el formulario con origen, destino y tipo de carga." },
  { num: "02", title: "Recives propuesta", desc: "Te enviamos el precio exacto a tu correo en menos de 1 hora." },
  { num: "03", title: "Apruebas y agendamos", desc: "Confirmas la cotización y coordinamos la fecha de retiro." },
  { num: "04", title: "Retiro y entrega", desc: "Nuestro equipo retira y entrega con tracking en tiempo real." },
];

export default function PublicQuotePage() {
  const [form, setForm] = useState(initialForm);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // mapReady removed — ChileCoverageMap handles its own loading state
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
  const [routeInfo, setRouteInfo] = useState(null); // {distanceKm, price, isRM, geometry}
  const [geocoding, setGeocoding] = useState(false);
  const [routeError, setRouteError] = useState("");
  // Image uploads (6 slots)
  const [images, setImages] = useState([null, null, null, null, null, null]);

  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const formRef = useRef(null);

  // Load marketing carousel images
  useEffect(() => {
    try {
      const imgs = JSON.parse(localStorage.getItem("dropit-marketing-carousel") || "[]");
      setCarouselImages(Array.isArray(imgs) ? imgs : []);
    } catch { setCarouselImages([]); }
  }, []);

  useEffect(() => {
    if (carouselImages.length < 2) return;
    const id = setInterval(() => setCarouselIndex((i) => (i + 1) % carouselImages.length), 5000);
    return () => clearInterval(id);
  }, [carouselImages.length]);

  function searchTracking(e) {
    e.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    const result = MOCK_TRACKING[code];
    if (result) { setTrackingResult(result); setTrackingError(""); }
    else { setTrackingResult(null); setTrackingError(`No se encontró el envío "${code}". Verifica el código.`); }
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

  // ─── Route map: draw when coords/geometry arrive ─────────────────────────────
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
          attribution: '© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>',
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
      const markerA = L.marker([pickupCoords.lat, pickupCoords.lng], { icon: makeIcon("#10b981", "📦 Retiro") }).addTo(map);
      const markerB = L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: makeIcon("#F97316", "🏁 Entrega") }).addTo(map);

      routeLayersRef.current = [routeGeo, markerA, markerB];
      // Fit to the full route geometry for best detail
      map.fitBounds(routeGeo.getBounds(), { padding: [50, 50], maxZoom: 15 });
    });
    }, 80);
    return () => clearTimeout(tid);
  }, [routeInfo, pickupCoords, deliveryCoords]);

  // Route map cleanup
  useEffect(() => {
    return () => {
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.remove();
        routeMapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── Auto-calculate route when both addresses are validated ──────────────────
  useEffect(() => {
    if (pickupCoords && deliveryCoords) {
      calculateRoute(pickupCoords, deliveryCoords);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, deliveryCoords]);

  // ─── Geocode fallback: if address typed manually (no suggestion picked) ───────
  const geocodeTimerRef = useRef({});
  useEffect(() => {
    if (pickupCoords) return;
    const addr = form.pickupAddress.trim();
    if (addr.length < 6) return;
    clearTimeout(geocodeTimerRef.current.pickup);
    geocodeTimerRef.current.pickup = setTimeout(async () => {
      try {
        const gm = window.google?.maps;
        if (gm) {
          new gm.Geocoder().geocode({ address: addr + ", Chile" }, (res, status) => {
            if (status === "OK" && res[0]) {
              const loc = res[0].geometry.location;
              setPickupCoords({ lat: loc.lat(), lng: loc.lng() });
            }
          });
        } else {
          const data = await nominatimSearch(addr + ", Chile");
          if (data[0]) setPickupCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
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
        const gm = window.google?.maps;
        if (gm) {
          new gm.Geocoder().geocode({ address: addr + ", Chile" }, (res, status) => {
            if (status === "OK" && res[0]) {
              const loc = res[0].geometry.location;
              setDeliveryCoords({ lat: loc.lat(), lng: loc.lng() });
            }
          });
        } else {
          const data = await nominatimSearch(addr + ", Chile");
          if (data[0]) setDeliveryCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch { /* ignore */ }
    }, 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.deliveryAddress]);

  // ─── OSRM route calculation (coords already known from autocomplete) ──────────
  async function calculateRoute(pc, dc) {
    setGeocoding(true);
    setRouteInfo(null);
    setRouteError("");
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pc.lng},${pc.lat};${dc.lng},${dc.lat}?overview=full&geometries=geojson`;
      const routeRes  = await fetch(osrmUrl);
      const routeData = await routeRes.json();
      if (routeData.routes?.[0]) {
        const distanceKm = Math.round((routeData.routes[0].distance / 1000) * 10) / 10;
        const isRM = RM_COMUNAS.has(form.pickupCommune) && RM_COMUNAS.has(form.deliveryCommune);
        const price = calcPrice(distanceKm, form.estimatedWeightKg, isRM, form.avionetaCount);
        setRouteInfo({ distanceKm, price, isRM, geometry: routeData.routes[0].geometry });
      } else {
        setRouteError("No se pudo calcular la ruta entre las dos direcciones.");
      }
    } catch {
      setRouteError("Error de red al calcular la ruta.");
    } finally {
      setGeocoding(false);
    }
  }

  // ─── Recalculate price if weight changes after route is drawn ─────────────────
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
    if (!form.rut || !validateRut(form.rut)) { setError("RUT inválido — verifica el dígito verificador"); return; }
    if (!form.contactEmail.includes("@")) { setError("Correo electrónico inválido"); return; }
    if (!form.pickupAddress.trim())   { setError("Ingresa la dirección de retiro"); return; }
    if (!form.deliveryAddress.trim()) { setError("Ingresa la dirección de entrega"); return; }

    // ─── Date / time validation ───────────────────────────────────────────────
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

    setLoading(true);
    setError("");
    try {
      const payload = {
        customerName: form.customerName,
        contactPerson: form.customerName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        pickupAddress: form.pickupAddress,
        deliveryAddress: form.deliveryAddress,
        destinationCity: form.deliveryCommune || form.deliveryAddress.split(",")[1]?.trim() || "",
        packages: form.packages,
        estimatedWeightKg: form.estimatedWeightKg,
        cargoDescription: form.cargoDescription,
        requiredDate: form.requiredDate,
        requiredTime: form.requiredTime,
        distanceKm: routeInfo?.distanceKm,
        estimatedPrice: routeInfo?.price != null ? routeInfo.price + (form.avionetaCount * 50000) : null,
        avionetaCount: form.avionetaCount,
        avioneta: form.avionetaCount > 0,
        observations: `RUT: ${form.rut}\n${form.observations}`,
        photos: images.filter(Boolean),
        bultosDetail: bultos.filter(b => b.largo || b.ancho || b.alto || b.peso),
      };
      const res = await fetch(`${API_URL}/quote-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar solicitud");

      // ─── Read config ──────────────────────────────────────────────────────
      let companyEmail = "";
      let waConfig = null;
      try {
        const sc = JSON.parse(localStorage.getItem("dropit-smtp-config") || "{}");
        // Company email = the SMTP sender account configured in the app
        companyEmail = sc.email || "";
      } catch { /* ignore */ }
      try {
        waConfig = JSON.parse(localStorage.getItem("dropit-whatsapp-config") || "null");
      } catch { /* ignore */ }

      const trackingCode  = data.request?.trackingCode || "N/A";
      const logoUrl       = getLogoUrl();
      const companyName   = getCompanyName();
      const imagesSent    = images.filter(Boolean).length;

      // ─── Email to client ──────────────────────────────────────────────────
      try {
        await fetch(`${API_URL}/mail/send`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: form.contactEmail,
            subject: `Solicitud de cotización recibida — ${companyName}`,
            html: tplClienteNuevaCotizacion({
              customerName: form.customerName, rut: form.rut, trackingCode,
              pickupAddress: form.pickupAddress, pickupCommune: form.pickupCommune,
              deliveryAddress: form.deliveryAddress, deliveryCommune: form.deliveryCommune,
              packages: form.packages, estimatedWeightKg: form.estimatedWeightKg,
              requiredDate: form.requiredDate, requiredTime: form.requiredTime,
              supportEmail: companyEmail || "soporte@dropit.cl", logoUrl, companyName,
            }),
            text: `Hola ${form.customerName}, recibimos tu solicitud. Código: ${trackingCode}`,
          }),
        });
      } catch { /* silent */ }

      // ─── Email to company (only the configured SMTP email) ────────────────
      if (companyEmail) {
        try {
          await fetch(`${API_URL}/mail/send`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: companyEmail,
              subject: `🚛 Nueva cotización — ${form.rut} | ${form.customerName}`,
              html: tplEmpresaNuevaCotizacion({
                customerName: form.customerName, rut: form.rut,
                contactPhone: form.contactPhone, contactEmail: form.contactEmail,
                pickupAddress: form.pickupAddress, pickupCommune: form.pickupCommune,
                deliveryAddress: form.deliveryAddress, deliveryCommune: form.deliveryCommune,
                packages: form.packages, estimatedWeightKg: form.estimatedWeightKg,
                cargoDescription: form.cargoDescription, requiredDate: form.requiredDate,
                requiredTime: form.requiredTime,
                observations: form.observations, trackingCode, logoUrl, companyName,
                distanceKm: routeInfo?.distanceKm,
                estimatedPrice: routeInfo?.price,
                imageCount: imagesSent,
              }),
              text: `Nueva cotización de ${form.customerName} (${form.rut}). Código: ${trackingCode}`,
            }),
          });
        } catch { /* silent */ }
      }

      // ─── WhatsApp to company number ───────────────────────────────────────
      if (waConfig?.authToken && waConfig?.accountSid && waConfig?.businessNumber) {
        try {
          await fetch(`${API_URL}/whatsapp/send`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountSid: waConfig.accountSid,
              authToken:  waConfig.authToken,
              from: waConfig.fromNumber || "whatsapp:+14155238886",
              to:   waConfig.businessNumber,
              body:
                `🚛 *Nueva cotización — ${companyName}*\n\n` +
                `📋 *Código:* ${trackingCode}\n` +
                `👤 *Cliente:* ${form.customerName}\n` +
                `🪪 *RUT:* ${form.rut}\n` +
                `📞 *Teléfono:* ${form.contactPhone || "—"}\n` +
                `📧 *Email:* ${form.contactEmail || "—"}\n` +
                `📦 *Bultos:* ${form.packages || "—"} · ${form.estimatedWeightKg || "—"} kg\n` +
                `📍 *Retiro:* ${form.pickupAddress}${form.pickupCommune ? `, ${form.pickupCommune}` : ""}\n` +
                `🏁 *Entrega:* ${form.deliveryAddress}${form.deliveryCommune ? `, ${form.deliveryCommune}` : ""}\n` +
                `📅 *Fecha:* ${form.requiredDate || "—"}${form.requiredTime ? ` a las ${form.requiredTime}` : ""}\n` +
                `📏 *Distancia:* ${routeInfo ? `${routeInfo.distanceKm} km` : "—"}\n` +
                `💰 *Precio est.:* ${routeInfo?.price ? `$${routeInfo.price.toLocaleString("es-CL")}` : "—"}\n` +
                `📸 *Fotos:* ${imagesSent}`,
            }),
          });
        } catch { /* silent */ }
      }

      // ─── Show success, auto-return to form after 3 seconds ───────────────
      setCreated(data.request);
      setForm(getInitialForm());
      setRouteInfo(null);
      setPickupCoords(null);
      setDeliveryCoords(null);
      setImages([null, null, null, null, null, null]);
      setTimeout(() => setCreated(null), 3000);

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
      {/* ─── NAVBAR ─── */}
      <header className="sticky top-0 z-50 border-b border-dropit-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-lg bg-white border border-slate-300 shadow-sm">
              <img src="/dropit-logo.jpeg" alt="DropIt Service" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-black text-dropit-950">
              Drop<span className="text-dropit-accent">It</span> Service
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-dropit-700 md:flex">
            <a href="#como-funciona" className="hover:text-dropit-accent transition-colors">Cómo funciona</a>
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
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Phone size={14} />
              Contáctanos
            </a>
            <a
              href="/"
              className="hidden sm:inline-flex rounded-lg border border-dropit-300 px-4 py-2 text-sm font-semibold text-dropit-950 hover:bg-dropit-100 transition-colors"
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

      {/* ─── SEGUIMIENTO DROPDOWN ─── */}
      {trackingOpen && (
        <div className="border-b border-dropit-200 bg-white px-4 py-6 shadow-lg">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-dropit-accent">Tracking</p>
                <h3 className="text-xl font-black text-dropit-950">Rastrear mi envío</h3>
              </div>
              <button onClick={() => { setTrackingOpen(false); setTrackingResult(null); setTrackingError(""); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={searchTracking} className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="Ingresa tu código de seguimiento (ej: DR-001)"
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

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-dropit-950 px-4 py-24 text-white">
        {/* Marketing carousel — smart fit: blurred fill + contained main image */}
        {carouselImages.map((src, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === carouselIndex ? 1 : 0 }}
          >
            {/* Blurred fill for letterbox areas */}
            <div className="absolute inset-0 scale-110 bg-cover bg-center blur-md opacity-35" style={{ backgroundImage: `url(${src})` }} />
            {/* Main image contained — no cropping */}
            <img src={src} className="absolute inset-0 h-full w-full object-contain opacity-55" alt="" />
          </div>
        ))}
        {/* Dark gradient overlay — stronger at bottom for text legibility */}
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
            Cotización en menos de 1 hora
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] md:text-7xl">
            Entregamos donde<br />
            <span className="text-dropit-accent">nadie más llega.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)] md:text-xl">
            Fletes, última milla y distribución urbana con tecnología de primer nivel.
            Tracking en tiempo real, rutas optimizadas y atención inmediata.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
            <button
              onClick={scrollToForm}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-dropit-accent px-8 py-4 text-base font-bold text-white shadow-xl shadow-dropit-accent/30 hover:bg-dropit-accent-dark transition-all hover:scale-105"
            >
              Solicitar cotización gratis
              <ArrowRight size={18} />
            </button>
            <a
              href="#como-funciona"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/8 transition-colors"
            >
              ¿Cómo funciona?
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

      {/* ─── FEATURES ─── */}
      <section className="bg-dropit-100 px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Por qué DropIt Service</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-dropit-950">Tecnología que trabaja por ti</h2>
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

      {/* ─── CÓMO FUNCIONA ─── */}
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

      {/* ─── FORMULARIO ─── */}
      <section id="formulario" ref={formRef} className="px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Cotización gratuita</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-dropit-950">Cuéntanos tu necesidad</h2>
            <p className="mt-3 text-dropit-700">
              Completa el formulario y recibirás tu cotización en menos de 1 hora hábil
            </p>
          </div>

          {created ? (
            <div className="overflow-hidden rounded-2xl border border-dropit-accent/20 bg-white shadow-xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-dropit-accent to-dropit-accent-dark px-8 py-8 text-center text-white">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <CheckCircle2 size={34} className="text-white" />
                </div>
                <h3 className="text-2xl font-black">¡Solicitud enviada con éxito!</h3>
                <p className="mt-1 text-sm text-white/80">Te responderemos en menos de 1 hora hábil</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-bold backdrop-blur">
                  <span className="opacity-70">Código:</span>
                  <span className="font-mono text-base tracking-widest">{created.trackingCode}</span>
                </div>
              </div>

              {/* Detail cards */}
              <div className="grid gap-3 p-6 md:grid-cols-2">
                <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">Solicitud</p>
                  <p className="mt-1 font-mono text-lg font-black text-dropit-950">{created.id}</p>
                </div>
                <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">Bultos / Peso</p>
                  <p className="mt-1 text-lg font-black text-dropit-950">{created.packages} bultos · {created.estimatedWeightKg} kg</p>
                </div>
                <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">📍 Retiro</p>
                  <p className="mt-1 text-sm font-semibold text-dropit-800">{created.pickupAddress}</p>
                </div>
                <div className="rounded-xl border border-dropit-200 bg-dropit-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">🏁 Entrega</p>
                  <p className="mt-1 text-sm font-semibold text-dropit-800">{created.deliveryAddress}</p>
                </div>
                {created.distanceKm && (
                  <div className="rounded-xl border border-dropit-accent/20 bg-dropit-accent/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">📏 Distancia</p>
                    <p className="mt-1 text-lg font-black text-dropit-950">{created.distanceKm} km</p>
                  </div>
                )}
                {created.estimatedPrice && (
                  <div className="rounded-xl border border-dropit-accent/20 bg-dropit-accent/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dropit-500">💰 Valor referencial</p>
                    <p className="mt-1 text-lg font-black text-dropit-accent">${created.estimatedPrice.toLocaleString("es-CL")}</p>
                    <p className="text-[10px] text-dropit-500 mt-0.5">Los valores pueden variar según dificultad</p>
                  </div>
                )}
              </div>

              <div className="border-t border-dropit-200 px-6 py-5 text-center">
                <p className="mb-4 text-sm text-dropit-600">
                  Revisa tu correo <strong>{created.contactEmail}</strong> — te enviaremos la cotización formal allí
                </p>
                <button
                  onClick={() => setCreated(null)}
                  className="inline-flex items-center gap-2 rounded-xl bg-dropit-accent px-8 py-3 font-semibold text-white hover:bg-dropit-accent-dark transition-colors"
                >
                  Nueva solicitud
                  <ArrowRight size={16} />
                </button>
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
                      <input className="input-base" placeholder="12.456.789-K" maxLength={12}
                        value={form.rut}
                        onChange={e => update("rut", formatRut(e.target.value))} />
                    </div>
                    <Field label="Empresa o Persona" field="customerName" form={form} update={update} placeholder="Nombre completo o razón social" />
                    <Field label="Teléfono" field="contactPhone" form={form} update={update} type="tel" placeholder="+56 9 1234 5678" />
                    <Field label="Correo electrónico" field="contactEmail" form={form} update={update} type="email" placeholder="juan@empresa.cl" />
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

                  {/* Address pair — Google Maps style */}
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

                  {/* Date + time */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label-base">Fecha requerida <span className="text-red-500">*</span></label>
                      <input
                        className="input-base"
                        type="date"
                        value={form.requiredDate}
                        onChange={e => update("requiredDate", e.target.value)}
                        min={(() => { const d = new Date(Date.now() + 4 * 60 * 60 * 1000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })()}
                        required
                      />
                      <p className="mt-1 text-[10px] text-dropit-500">Mínimo 4 horas desde ahora</p>
                    </div>
                    <div>
                      <label className="label-base">Hora de retiro</label>
                      <input className="input-base" type="time" value={form.requiredTime}
                        onChange={e => update("requiredTime", e.target.value)}
                        max="21:00" />
                      <p className="mt-1 text-[10px] text-dropit-500">Hasta las 21:00 hrs</p>
                    </div>
                  </div>

                  {/* Route status */}
                  {geocoding && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-dropit-700">
                      <Loader2 size={14} className="animate-spin text-dropit-accent" />
                      Calculando ruta y precio estimado…
                    </div>
                  )}
                  {routeError && !geocoding && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
                      <AlertCircle size={14} className="flex-shrink-0" /> {routeError}
                    </p>
                  )}

                  {/* Route result */}
                  {routeInfo && (() => {
                    const avionetaBonus = (form.avionetaCount || 0) * 50000;
                    const finalPrice = routeInfo.price != null ? routeInfo.price + avionetaBonus : null;
                    return (
                    <div className="mt-3 overflow-hidden rounded-xl border border-dropit-300 shadow-sm">
                      {/* Price banner */}
                      <div className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 ${routeInfo.isRM ? "border-b border-dropit-accent/20 bg-gradient-to-r from-dropit-accent/10 to-orange-50" : "border-b border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dropit-accent/20">
                            <RouteIcon size={17} className="text-dropit-accent" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-dropit-600">Distancia de la ruta</p>
                            <p className="text-2xl font-black text-dropit-950">{routeInfo.distanceKm} <span className="text-base font-bold">km</span></p>
                          </div>
                        </div>
                        {routeInfo.isRM && finalPrice != null ? (
                          <div className="text-right">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-dropit-600">Precio referencial</p>
                            <p className="text-2xl font-black text-dropit-accent">${finalPrice.toLocaleString("es-CL")}</p>
                            <div className="mt-1 rounded-md bg-amber-100 px-2 py-1">
                              <p className="text-[10px] font-semibold text-amber-700">⚠️ Valor referencial — sujeto a confirmación. El precio final puede variar según dificultad, acceso y condiciones del flete.</p>
                            </div>
                          </div>
                        ) : !routeInfo.isRM ? (
                          <div className="text-right max-w-xs">
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <p className="text-xs font-bold text-slate-700">📍 Ruta fuera de Santiago RM</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">Para fletes fuera de la Región Metropolitana cotizamos caso a caso. Te contactaremos con el precio exacto.</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {/* Ayudantes de carga */}
                      <div className="border-b border-dropit-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl">💪</div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">¿Necesitas ayuda con la carga?</p>
                              <p className="mt-0.5 text-xs text-slate-500">Sumamos cargadores profesionales para objetos pesados, voluminosos o frágiles</p>
                              <p className="mt-1 text-xs font-semibold text-blue-600">+$50.000 por cada ayudante</p>
                              {form.avionetaCount > 0 && (
                                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                                  {form.avionetaCount} ayudante{form.avionetaCount > 1 ? "s" : ""} · ${(form.avionetaCount * 50000).toLocaleString("es-CL")}
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
                            >−</button>
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
                      <label className="label-base">Descripción de la carga</label>
                      <textarea
                        className="input-base min-h-[88px] resize-none"
                        value={form.cargoDescription}
                        onChange={(e) => update("cargoDescription", e.target.value)}
                        placeholder="Ej: Cajas de electrodomésticos, requieren cuidado especial..."
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label-base">Observaciones (opcional)</label>
                      <textarea
                        className="input-base min-h-[72px] resize-none"
                        value={form.observations}
                        onChange={(e) => update("observations", e.target.value)}
                        placeholder="Ej: Debe ingresar por portón lateral, preguntar por Jorge..."
                      />
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
                        <p className="text-xs text-dropit-600">Opcional — para cotización más exacta</p>
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
                      Sin medidas — haz clic en "Agregar bulto" si quieres detallar dimensiones
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
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dropit-accent/10">
                    <Camera size={18} className="text-dropit-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-dropit-950">Fotos de la carga</h3>
                    <p className="text-xs text-dropit-600">Opcional — adjunta hasta 6 imágenes para mejorar la cotización</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((img, idx) => (
                    <div key={idx}>
                      {img ? (
                        <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-dropit-accent/30">
                          <img src={img} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImages(prev => prev.map((x, i) => i === idx ? null : x))}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                          ><X size={11} /></button>
                        </div>
                      ) : (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-dropit-300 bg-dropit-100/40 transition hover:border-dropit-accent hover:bg-dropit-accent/5">
                          <Camera size={22} className="mb-1 text-dropit-400" />
                          <span className="text-[11px] font-semibold text-dropit-600">Foto {idx + 1}</span>
                          <span className="text-[10px] text-dropit-400">JPG, PNG</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 15 * 1024 * 1024) { alert("La imagen no puede superar 15 MB"); return; }
                              try {
                                const compressed = await compressImage(file, 1280, 0.82);
                                setImages(prev => prev.map((x, i) => i === idx ? compressed : x));
                              } catch (err) {
                                alert("No se pudo procesar la imagen. Intenta con otra.");
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
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
                      política de privacidad
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
                        Solicitar cotización gratis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ─── MAPA ─── */}
      <section id="mapa" className="bg-dropit-950 px-4 py-12 sm:py-20" style={{ isolation: "isolate" }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-dropit-accent">Cobertura nacional</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-white">De Arica a Punta Arenas</h2>
            <p className="mt-3 text-dropit-400">Una red de despacho que cubre los 4.300 km de Chile — sin excepciones</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-dropit-accent/10">
            <ChileCoverageMap height="500px" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            {[
              { val: "17", suffix: " ciudades", label: "Nodos de cobertura", icon: "📍" },
              { val: "4.300", suffix: " km", label: "Arica → Punta Arenas", icon: "🛣️" },
              { val: "<1", suffix: "h", label: "Cotización garantizada", icon: "⚡" },
              { val: "24/7", suffix: "", label: "Seguimiento en tiempo real", icon: "📡" },
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

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-dropit-200 bg-dropit-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            {/* Brand */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-white border border-slate-500 shadow-sm">
                  <img src="/dropit-logo.jpeg" alt="DropIt Service" className="h-full w-full object-cover" />
                </div>
                <span className="text-lg font-black text-white">
                  Drop<span className="text-dropit-accent">It</span> Service
                </span>
              </div>
              <p className="max-w-xs text-sm text-dropit-500">
                Fletes, última milla y distribución con tecnología de primer nivel en todo Chile.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-dropit-400">Navegación</p>
              <a href="#como-funciona" className="text-sm text-dropit-500 hover:text-white transition-colors">Cómo funciona</a>
              <a href="#formulario" className="text-sm text-dropit-500 hover:text-white transition-colors">Solicitar cotización</a>
              <a href="#mapa" className="text-sm text-dropit-500 hover:text-white transition-colors">Cobertura</a>
              <a href="/privacidad" className="text-sm text-dropit-500 hover:text-white transition-colors">Política de privacidad</a>
            </div>

            {/* Social + contact */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-dropit-400">Síguenos</p>
              <div className="flex items-center gap-3">
                {/* Instagram */}
                <a href="https://www.instagram.com/dropit.service?igsh=MThpdnhmOG1zOGc4eg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 transition-all"
                  title="Instagram">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                {/* Facebook */}
                <a href="https://www.facebook.com/share/18QJHs8tKm/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-blue-600 transition-all"
                  title="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* WhatsApp */}
                <a href="https://api.whatsapp.com/send?phone=56950979687&text=Hola%2C%20%F0%9F%91%8B%20%0AQuisiera%20informaci%C3%B3n%20sobre%20sus%20servicios...%0AGracias!!%20%F0%9F%98%80"
                  target="_blank" rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-emerald-500 transition-all"
                  title="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
              {/* WhatsApp CTA */}
              <a
                href="https://api.whatsapp.com/send?phone=56950979687&text=Hola%2C%20%F0%9F%91%8B%20%0AQuisiera%20informaci%C3%B3n%20sobre%20sus%20servicios...%0AGracias!!%20%F0%9F%98%80"
                target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Escríbenos por WhatsApp
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-dropit-600">
              © 2026 DropIt Service · Santiago, Chile · Fletes y distribución con tecnología de primer nivel
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, field, form, update, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="label-base">{label}</label>
      <input
        className="input-base"
        type={type}
        value={form[field]}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        required={field !== "observations"}
      />
    </div>
  );
}
