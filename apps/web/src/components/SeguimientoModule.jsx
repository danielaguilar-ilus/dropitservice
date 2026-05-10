import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  Map,
  MapPin,
  Navigation,
  Search,
  Truck,
  User,
  X,
  Camera,
} from "lucide-react";
import { useState, useMemo } from "react";
import LeafletMap from "./LeafletMap";

// ─── Mock data (se reemplazará con datos reales del backend) ─────────────────
const MOCK_VEHICLES = [
  {
    id: "v1",
    plate: "RFDR84",
    driver: "Jason Huerta",
    phone: "+56 940328208",
    startTime: "09:01",
    progress: 27,
    status: "active",
    route: "Ruta 1",
    totalVisits: 19,
    completedVisits: 5,
    battery: 0.32,
  },
  {
    id: "v2",
    plate: "JSTX61",
    driver: "Susana Chamorro",
    phone: "+56 912345678",
    startTime: "08:30",
    progress: 0,
    status: "inactive",
    route: null,
    totalVisits: 0,
    completedVisits: 0,
    battery: 85,
  },
];

const MOCK_VISITS = [
  { id: 1, client: "G-9991 F-269365 MATERIALES Y SOLUCIONES S.A.", address: "Millán 45, Rancagua, Chile", estimatedTime: "17:05", status: "pendiente", vehicle: "RFDR84", driver: "Jason Huerta", checkin: null, checkout: null },
  { id: 2, client: "F-269855 FIGUEROA Y SALAZAR", address: "Av. Lo Espejo 01565, Pasillo 7, Bodega 0713", estimatedTime: "18:14", status: "pendiente", vehicle: "RFDR84", driver: "Jason Huerta", checkin: null, checkout: null },
  { id: 3, client: "F-269858 ELECTROCOM VALDIVIA", address: "Chañarcillo 1201, Bodega 30, Maipú, Santiago", estimatedTime: "18:40", status: "pendiente", vehicle: "RFDR84", driver: "Jason Huerta", checkin: null, checkout: null },
  { id: 4, client: "F-269867 COMERCIAL ATABALES", address: "Lo Espejo 860, Bodega 63, Maipú, Santiago", estimatedTime: "19:01", status: "pendiente", vehicle: "RFDR84", driver: "Jason Huerta", checkin: null, checkout: null },
  { id: 5, client: "F-269856 CAROLYN DEL CARMEN CORNEJO", address: "Bernardo O'Higgins 1886, Maipú, Chile", estimatedTime: "19:31", status: "pendiente", vehicle: "RFDR84", driver: "Jason Huerta", checkin: null, checkout: null },
  { id: 9, client: "G-99920 F-269381 SOCIEDAD VIBRADOS CHILE", address: "TERESITA ESTACION 4022, ESTACION CENTRAL, SANTIAGO", estimatedTime: "20:38", status: "exitosa", vehicle: "RFDR84", driver: "Jason Huerta", checkin: "15:56 2026-04-30", checkout: "16:03 2026-04-30", serviceTime: "00:07", window: "00:00 a 21:06" },
  { id: 10, client: "G-99922 F-269413 CLIENTE EJEMPLO", address: "AVENIDA CENTRAL 1200, SANTIAGO CENTRO", estimatedTime: "15:46", status: "exitosa", vehicle: "RFDR84", driver: "Jason Huerta", checkin: "15:40 2026-04-30", checkout: "15:46 2026-04-30", serviceTime: "00:06", window: "00:00 a 21:06" },
];

const MOCK_EVENTS = [
  { id: "e1", type: "exitosa", client: "G-99920 F-269381 SOCIEDAD VIBRADOS CHILE", time: "16:03", address: "TERESITA ESTACION 4022, ESTACION CENTRAL, SANTIAGO", driver: "Jason Huerta", vehicle: "RFDR84", checkin: "15:56 2026-04-30", checkout: "16:03 2026-04-30", serviceTime: "00:07", window: "00:00 a 21:06", note: "", attachments: 2 },
  { id: "e2", type: "exitosa", client: "G-99922 F-269413 CLIENTE EJEMPLO", time: "15:46", address: "AVENIDA CENTRAL 1200, SANTIAGO CENTRO", driver: "Jason Huerta", vehicle: "RFDR84", checkin: "15:40 2026-04-30", checkout: "15:46 2026-04-30", serviceTime: "00:06", window: "00:00 a 21:06", note: "", attachments: 1 },
  { id: "e3", type: "exitosa", client: "G-99918 F-269377 DISTRIBUIDORA SUR", time: "15:03", address: "SAN PABLO 4100, QUINTA NORMAL, SANTIAGO", driver: "Jason Huerta", vehicle: "RFDR84", checkin: "14:55 2026-04-30", checkout: "15:03 2026-04-30", serviceTime: "00:08", window: "00:00 a 21:06", note: "Cliente ausente, dejado con conserje", attachments: 1 },
  { id: "e4", type: "exitosa", client: "G-99919 F-269376 FERRETERÍA CENTRAL", time: "15:03", address: "LONGITUDINAL SUR 890, PEDRO AGUIRRE CERDA", driver: "Jason Huerta", vehicle: "RFDR84", checkin: "14:50 2026-04-30", checkout: "15:03 2026-04-30", serviceTime: "00:13", window: "00:00 a 21:06", note: "", attachments: 2 },
  { id: "e5", type: "exitosa", client: "G-99924 F-269291 COMERCIAL LAS CONDES", time: "14:29", address: "APOQUINDO 4500, LAS CONDES, SANTIAGO", driver: "Jason Huerta", vehicle: "RFDR84", checkin: "14:20 2026-04-30", checkout: "14:29 2026-04-30", serviceTime: "00:09", window: "00:00 a 21:06", note: "", attachments: 0 },
];

// ─── Mock vehicle route stops (coords from LeafletMap's COMMUNE_COORDS) ──────
const VEHICLE_ROUTES = {
  v1: [
    { coords: [-33.4568, -70.5987], label: "Base — Ñuñoa", status: "base", popup: "Base de operaciones" },
    { coords: [-33.4163, -70.5831], label: "COMERCIAL LAS CONDES", status: "exitosa", popup: "F-269291 • Las Condes" },
    { coords: [-33.4906, -70.6672], label: "FERRETERÍA CENTRAL", status: "exitosa", popup: "F-269376 • Pedro Aguirre Cerda" },
    { coords: [-33.4356, -70.6806], label: "DISTRIBUIDORA SUR", status: "exitosa", popup: "F-269377 • Quinta Normal" },
    { coords: [-33.4569, -70.6483], label: "CLIENTE EJEMPLO", status: "exitosa", popup: "F-269413 • Santiago Centro" },
    { coords: [-33.4561, -70.6783], label: "SOCIEDAD VIBRADOS CHILE", status: "exitosa", popup: "F-269381 • Estación Central" },
    { coords: [-33.5175, -70.7006], label: "FIGUEROA Y SALAZAR", status: "en_ruta", popup: "F-269855 • Lo Espejo (en ruta)" },
    { coords: [-33.5103, -70.7634], label: "ELECTROCOM VALDIVIA", status: "pendiente", popup: "F-269858 • Maipú" },
    { coords: [-33.5134, -70.7500], label: "COMERCIAL ATABALES", status: "pendiente", popup: "F-269867 • Maipú" },
    { coords: [-33.5160, -70.7420], label: "CAROLYN CORNEJO", status: "pendiente", popup: "F-269856 • Maipú" },
    { coords: [-34.1703, -70.7444], label: "MATERIALES Y SOLUCIONES", status: "pendiente", popup: "F-269365 • Rancagua" },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const colors = { active: "bg-emerald-400", inactive: "bg-slate-400", alert: "bg-amber-400" };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] || "bg-slate-400"}`} />;
}

function VisitStatusBadge({ status }) {
  const cfg = {
    pendiente: "bg-slate-100 text-slate-600 border-slate-200",
    en_ruta: "bg-orange-50 text-orange-600 border-orange-200",
    exitosa: "bg-emerald-50 text-emerald-700 border-emerald-200",
    fallida: "bg-red-50 text-red-700 border-red-200",
  };
  const labels = { pendiente: "Pendiente", en_ruta: "En ruta", exitosa: "Exitosa", fallida: "Fallida" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg[status] || cfg.pendiente}`}>
      {labels[status] || status}
    </span>
  );
}

function ProgressBar({ value, color = "bg-dropit-accent" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Visit Detail Modal ───────────────────────────────────────────────────────
function VisitModal({ visit, onClose }) {
  if (!visit) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between rounded-t-2xl px-5 py-4 ${
          visit.status === "exitosa" ? "bg-emerald-500" : "bg-slate-700"
        }`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Visita {visit.id}</p>
            <p className="mt-0.5 text-sm font-bold text-white">{visit.client}</p>
            <p className={`mt-1 text-xs font-medium ${visit.status === "exitosa" ? "text-emerald-100" : "text-slate-300"}`}>
              {visit.status === "exitosa" ? "Visita exitosa" : "Visita pendiente"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/70 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Location + ID + Date */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider mb-1">Ubicación</p>
              <p className="text-slate-800 font-medium">{visit.address}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider mb-1">ID</p>
              <p className="text-slate-800 font-medium font-mono">{visit.client.split(" ")[0]}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider mb-1">Fecha</p>
              <p className="text-slate-800 font-medium">2026-04-30</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-700 mb-3">Información de la visita</p>
            <div className="space-y-2 text-sm">
              <Row label="Hora estimada" value={visit.estimatedTime} />
              {visit.checkin && <Row label="Check in" value={visit.checkin} />}
              {visit.checkout && <Row label="Check out" value={visit.checkout} />}
              {visit.serviceTime && <Row label="Tiempo de servicio" value={visit.serviceTime} />}
              {visit.window && <Row label="Ventanas horarias" value={visit.window} />}
              <Row label="Conductor" value={visit.driver} icon={<User size={13} className="text-slate-400" />} />
              <Row label="Vehículo" value={visit.vehicle} icon={<Truck size={13} className="text-slate-400" />} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Ver más
            </button>
            {visit.status === "exitosa" && (
              <button className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-4 py-2 text-sm font-medium text-dropit-accent hover:bg-dropit-accent/10">
                <Download size={14} />
                Descargar adjuntos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 flex items-center gap-1">{icon}{label}</span>
      <span className="font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function VehiculosTab({ vehicles, onSelectVehicle, selectedVehicle }) {
  const active = vehicles.filter((v) => v.status === "active");
  const inactive = vehicles.filter((v) => v.status !== "active");

  return (
    <div className="space-y-4">
      {/* Sort */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Ordenar por:</label>
        <select className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30">
          <option>Orden alfabético (ASC)</option>
          <option>Progreso</option>
          <option>Hora inicio</option>
        </select>
      </div>

      {active.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Vehículos activos ({active.length})
          </p>
          <div className="space-y-2">
            {active.map((v) => (
              <VehicleCard key={v.id} vehicle={v} selected={selectedVehicle?.id === v.id} onSelect={onSelectVehicle} />
            ))}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Vehículos inactivos ({inactive.length})
          </p>
          <div className="space-y-2">
            {inactive.map((v) => (
              <VehicleCard key={v.id} vehicle={v} selected={selectedVehicle?.id === v.id} onSelect={onSelectVehicle} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VehicleCard({ vehicle, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle)}
      className={`w-full rounded-xl border p-3.5 text-left transition-all ${
        selected ? "border-dropit-accent bg-dropit-accent/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Truck size={15} className={selected ? "text-dropit-accent" : "text-slate-500"} />
          <span className="font-bold text-sm text-slate-800">{vehicle.plate}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot status={vehicle.status} />
          {vehicle.status === "active" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {vehicle.battery}%
            </span>
          )}
        </div>
      </div>
      {vehicle.driver && (
        <div className="flex items-center gap-1.5 mb-2">
          <User size={12} className="text-slate-400" />
          <span className="text-xs text-slate-600">{vehicle.driver}</span>
        </div>
      )}
      {vehicle.status === "active" && (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Hora inicio: {vehicle.startTime}</span>
            <span className="text-xs font-bold text-dropit-accent">{vehicle.progress}%</span>
          </div>
          <ProgressBar value={vehicle.progress} />
        </>
      )}
    </button>
  );
}

function VisitasTab({ visits, onSelectVisit }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      const matchSearch = v.client.toLowerCase().includes(search.toLowerCase()) || v.address.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || v.status === filter;
      return matchSearch && matchFilter;
    });
  }, [visits, search, filter]);

  const counts = useMemo(() => ({
    all: visits.length,
    alertas: visits.filter((v) => v.status === "fallida").length,
    errores: visits.filter((v) => v.status === "error").length,
  }), [visits]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
          placeholder="Buscar por título, dirección o referencia"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "all", label: `Todas(${counts.all})` },
          { key: "fallida", label: `Alertas` },
          { key: "error", label: `Errores` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              filter === tab.key ? "border-dropit-accent text-dropit-accent" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((v, idx) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVisit(v)}
            className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-dropit-accent/40 hover:shadow-sm transition-all"
          >
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent text-[10px] font-bold text-white mt-0.5">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{v.client}</p>
                <VisitStatusBadge status={v.status} />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500 truncate">{v.address}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-600">{v.estimatedTime}</p>
            </div>
            {v.status === "exitosa" && (
              <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500 mt-0.5" />
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400">Sin visitas que coincidan</p>
        )}
      </div>
    </div>
  );
}

function EventosTab({ events, onSelectEvent }) {
  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <button
          key={ev.id}
          type="button"
          onClick={() => onSelectEvent(ev)}
          className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-dropit-accent/40 hover:shadow-sm transition-all"
        >
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{ev.client}</p>
              <span className="flex-shrink-0 text-[10px] font-bold text-slate-500">{ev.time}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500 truncate">{ev.driver}</p>
            {ev.attachments > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <Camera size={10} className="text-slate-400" />
                <span className="text-[10px] text-slate-400">{ev.attachments} adj.</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Real Leaflet Tracking Map ────────────────────────────────────────────────
function TrackingMap({ selectedVehicle }) {
  const stops = selectedVehicle ? (VEHICLE_ROUTES[selectedVehicle.id] || []) : [];
  const polyline = stops.map((s) => s.coords);

  return (
    <div className="relative h-full min-h-96 overflow-hidden rounded-xl">
      <LeafletMap
        markers={stops}
        polyline={polyline}
        routing={true}
        dark={true}
        height="100%"
        center={[-33.47, -70.68]}
        zoom={11}
        fitBounds={selectedVehicle !== null && stops.length > 0}
      />

      {!selectedVehicle && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div className="rounded-xl bg-white/90 px-6 py-4 text-center shadow-lg backdrop-blur">
            <Map size={28} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600">Selecciona un vehículo</p>
            <p className="text-xs text-slate-400">para ver su ruta en el mapa</p>
          </div>
        </div>
      )}

      {selectedVehicle && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000]">
          <div className="rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-dropit-accent" />
                <span className="text-sm font-bold text-slate-800">{selectedVehicle.plate}</span>
                <span className="text-xs text-slate-500">— {selectedVehicle.driver}</span>
              </div>
              <span className="text-xs font-bold text-dropit-accent">{selectedVehicle.progress}%</span>
            </div>
            <ProgressBar value={selectedVehicle.progress} color="bg-dropit-accent" />
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-500" />
                {selectedVehicle.completedVisits} completadas
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {selectedVehicle.totalVisits - selectedVehicle.completedVisits} pendientes
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export default function SeguimientoModule({ initialTab = "vehiculos", requests = [], trucks = [], routes = [] }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchVisit, setSearchVisit] = useState("");

  // Derive stats from real data if available, fall back to mock
  const vehicles = MOCK_VEHICLES;
  const visits = MOCK_VISITS;
  const events = MOCK_EVENTS;

  const completedVisits = visits.filter((v) => v.status === "exitosa").length;
  const totalVisits = visits.length;
  const progressPct = totalVisits ? Math.round((completedVisits / totalVisits) * 100) : 0;

  const tabs = [
    { id: "vehiculos", label: "Vehículos", icon: Truck },
    { id: "visitas", label: "Visitas", icon: Activity },
    { id: "eventos", label: "Eventos", icon: Bell },
  ];

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Left Panel */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-slate-200">
        {/* Progress Bar Header */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Progreso de visitas</span>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {vehicles.filter((v) => v.status === "active").length}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                <AlertCircle size={12} /> Alertas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-dropit-accent transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">{progressPct}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-dropit-accent text-dropit-accent"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "vehiculos" && (
            <VehiculosTab vehicles={vehicles} selectedVehicle={selectedVehicle} onSelectVehicle={setSelectedVehicle} />
          )}
          {activeTab === "visitas" && (
            <VisitasTab visits={visits} onSelectVisit={setSelectedVisit} />
          )}
          {activeTab === "eventos" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-slate-500">Mostrando 1 – {Math.min(events.length, 10)} de {events.length} eventos</p>
              </div>
              <EventosTab events={events} onSelectEvent={setSelectedEvent} />
            </>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 p-3">
        <TrackingMap selectedVehicle={selectedVehicle} activeTab={activeTab} />
      </div>

      {/* Modals */}
      {selectedVisit && (
        <VisitModal visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}
      {selectedEvent && (
        <VisitModal visit={{ ...selectedEvent, id: selectedEvent.id, status: selectedEvent.type }} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
