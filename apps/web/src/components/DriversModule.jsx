import {
  Phone,
  Plus,
  Search,
  Star,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const MOCK_DRIVERS = [
  { id: "d1", name: "Jason Huerta", phone: "+56 940328208", license: "B+E", vehicle: "RFDR84", status: "active", rating: 4.8, trips: 312, joined: "2023-03-15" },
  { id: "d2", name: "Susana Chamorro", phone: "+56 912345678", license: "B", vehicle: "JSTX61", status: "inactive", rating: 4.6, trips: 198, joined: "2023-07-22" },
  { id: "d3", name: "Carlos Vergara", phone: "+56 956781234", license: "B+E", vehicle: null, status: "available", rating: 4.9, trips: 445, joined: "2022-11-01" },
  { id: "d4", name: "María López", phone: "+56 933445566", license: "B", vehicle: null, status: "available", rating: 4.7, trips: 267, joined: "2024-01-10" },
  { id: "d5", name: "Felipe Riquelme", phone: "+56 978901234", license: "B+E", vehicle: null, status: "vacation", rating: 4.5, trips: 134, joined: "2024-04-01" },
];

const STATUS_CFG = {
  active:    { label: "En ruta",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  available: { label: "Disponible",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  inactive:  { label: "Inactivo",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
  vacation:  { label: "Vacaciones",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.inactive;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Stars({ value }) {
  return (
    <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
      <Star size={11} fill="currentColor" />
      {value.toFixed(1)}
    </span>
  );
}

function DriverModal({ driver, onClose, onSave }) {
  const [form, setForm] = useState(driver || { name: "", phone: "", license: "B", status: "available", vehicle: "", rating: 5, trips: 0, joined: new Date().toISOString().slice(0, 10) });

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">{driver ? "Editar conductor" : "Nuevo conductor"}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nombre completo</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nombre del conductor"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Teléfono</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+56 9..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Licencia</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.license}
                onChange={(e) => set("license", e.target.value)}
              >
                <option value="B">B</option>
                <option value="B+E">B+E</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Estado</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="available">Disponible</option>
                <option value="active">En ruta</option>
                <option value="inactive">Inactivo</option>
                <option value="vacation">Vacaciones</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Vehículo asignado</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                value={form.vehicle || ""}
                onChange={(e) => set("vehicle", e.target.value)}
                placeholder="Placa (ej. RFDR84)"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 rounded-lg bg-dropit-accent py-2 text-sm font-bold text-white hover:bg-dropit-accent-dark"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DriversModule() {
  const [drivers, setDrivers] = useState(MOCK_DRIVERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalDriver, setModalDriver] = useState(undefined);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.vehicle || "").toLowerCase().includes(search.toLowerCase()) ||
        d.phone.includes(search);
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [drivers, search, statusFilter]);

  const counts = useMemo(() => ({
    all: drivers.length,
    active: drivers.filter((d) => d.status === "active").length,
    available: drivers.filter((d) => d.status === "available").length,
    inactive: drivers.filter((d) => d.status === "inactive").length,
  }), [drivers]);

  function handleSave(form) {
    if (form.id) {
      setDrivers((ds) => ds.map((d) => d.id === form.id ? { ...d, ...form } : d));
    } else {
      setDrivers((ds) => [...ds, { ...form, id: `d${Date.now()}` }]);
    }
    setShowModal(false);
    setModalDriver(undefined);
  }

  function openNew() {
    setModalDriver(undefined);
    setShowModal(true);
  }

  function openEdit(driver) {
    setModalDriver(driver);
    setShowModal(true);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={20} className="text-dropit-accent" />
          <h1 className="text-lg font-black text-slate-800">Conductores</h1>
          <span className="rounded-full bg-dropit-accent/10 px-2 py-0.5 text-xs font-bold text-dropit-accent">
            {drivers.length}
          </span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-dropit-accent px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-dropit-accent-dark transition-colors"
        >
          <Plus size={15} />
          Nuevo conductor
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: counts.all, color: "text-slate-700" },
          { label: "En ruta", value: counts.active, color: "text-emerald-600" },
          { label: "Disponibles", value: counts.available, color: "text-blue-600" },
          { label: "Inactivos", value: counts.inactive, color: "text-slate-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="Buscar por nombre, placa o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="active">En ruta</option>
          <option value="available">Disponibles</option>
          <option value="inactive">Inactivos</option>
          <option value="vacation">Vacaciones</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Conductor</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 md:table-cell">Teléfono</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 sm:table-cell">Licencia</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Estado</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 md:table-cell">Vehículo</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 lg:table-cell">Rating</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 lg:table-cell">Viajes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((driver) => (
              <tr key={driver.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent/10 text-xs font-black text-dropit-accent">
                      {driver.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 leading-tight">{driver.name}</p>
                      <p className="text-[10px] text-slate-400">Desde {driver.joined}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  <div className="flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" />
                    {driver.phone}
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{driver.license}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={driver.status} />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {driver.vehicle ? (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Truck size={12} className="text-slate-400" />
                      <span className="font-mono text-xs font-semibold">{driver.vehicle}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <Stars value={driver.rating} />
                </td>
                <td className="hidden px-4 py-3 text-xs font-semibold text-slate-700 lg:table-cell">{driver.trips}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(driver)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-dropit-accent/40 hover:text-dropit-accent transition-colors"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                  No hay conductores que coincidan con la búsqueda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <DriverModal
          driver={modalDriver}
          onClose={() => { setShowModal(false); setModalDriver(undefined); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
