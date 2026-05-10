import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useState } from "react";
import { TrendingUp, TrendingDown, Package, Truck, CheckCircle2, Clock, AlertTriangle, BarChart2 } from "lucide-react";

// ─── Mock data ────────────────────────────────────────────────────────────────
const visitsByDay = [
  { dia: "1", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "2", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "3", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "4", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "5", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "6", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "7", pendientes: 5, exitosas: 7, fallidas: 0 },
  { dia: "8", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "9", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "10", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "11", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "12", pendientes: 10, exitosas: 0, fallidas: 0 },
  { dia: "13", pendientes: 0, exitosas: 0, fallidas: 0 },
  { dia: "30", pendientes: 14, exitosas: 5, fallidas: 0 },
];

const visitsByHour = Array.from({ length: 24 }, (_, h) => ({
  hora: h,
  total: h >= 9 && h <= 13 ? Math.max(0, 4 - Math.abs(h - 11)) : 0,
  enVentana: h >= 10 && h <= 12 ? Math.max(0, 3 - Math.abs(h - 11)) : 0,
}));

const statusDistribution = [
  { name: "Exitosas", value: 12, color: "#10b981" },
  { name: "Pendientes", value: 29, color: "#64748b" },
  { name: "Fallidas", value: 0, color: "#ef4444" },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, change, changeLabel, positive = true, accent = false }) {
  const isUp = change >= 0;
  return (
    <div className={`rounded-xl border p-4 bg-white ${accent ? "border-dropit-accent/30" : "border-slate-200"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-dropit-accent/10" : "bg-slate-100"}`}>
          <Icon size={17} className={accent ? "text-dropit-accent" : "text-slate-500"} />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
      {changeLabel && (
        <p className="text-[10px] text-slate-400 mt-1">{changeLabel}</p>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1.5">Día {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Pie label ────────────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function ReportesModule({ requests = [], routes = [] }) {
  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`);

  // Derive real KPIs when data is available
  const totalRouted = requests.filter((r) => r.routeId).length || 12;
  const delivered = requests.filter((r) => r.status === "Entregado").length || 12;
  const pending = requests.filter((r) => ["En ruta", "En preparacion", "Agendado"].includes(r.status)).length || 29;
  const incidents = requests.filter((r) => r.hasIncident).length || 0;
  const compliance = totalRouted > 0 ? Math.round((delivered / totalRouted) * 100) : 92;

  const kpis = [
    { icon: Package, label: "Total visitas ruteadas", value: totalRouted || 12, change: 266, changeLabel: "vs. mes anterior", accent: false },
    { icon: Truck, label: "Total vehículos utilizados", value: routes.length || 1, change: 0, changeLabel: "igual que mes anterior", accent: false },
    { icon: CheckCircle2, label: "Visitas exitosas", value: `${compliance}%`, change: -68, changeLabel: "vs. mes anterior", accent: false },
    { icon: Clock, label: "En ventana horaria", value: "86%", change: -14, changeLabel: "vs. mes anterior", accent: false },
    { icon: BarChart2, label: "Peso medio por vehículo", value: "—", change: -1, changeLabel: "vs. mes anterior", accent: false },
  ];

  const totalByStatus = statusDistribution.reduce((a, s) => a + s.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Análisis operacional</p>
          <h2 className="text-2xl font-black text-slate-800">Reportes</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Período:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
          >
            {MONTHS.map((m) => (
              <option key={m} value={`${m} ${now.getFullYear()}`}>{m} {now.getFullYear()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Period indicator */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs text-slate-500 mb-1">Período actual</p>
        <p className="text-sm font-bold text-slate-800">{selectedPeriod}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Visits by Day — Bar Chart (takes 2/3) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Estado de visitas por día</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={visitsByDay} barSize={12} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="fallidas" name="Visitas fallidas" fill="#ef4444" radius={[2,2,0,0]} />
              <Bar dataKey="pendientes" name="Visitas pendientes" fill="#94a3b8" radius={[2,2,0,0]} />
              <Bar dataKey="exitosas" name="Visitas exitosas" fill="#10b981" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut Chart (1/3) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Distribución de visitas</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {statusDistribution.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} (${((value/totalByStatus)*100).toFixed(0)}%)`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {statusDistribution.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-600">{s.name}</span>
                </div>
                <span className="font-bold text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Visits by Hour */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Comportamiento de visitas por hora</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={visitsByHour}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorVentana" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="total" name="Total de visitas" stroke="#94a3b8" fill="url(#colorTotal)" strokeWidth={2} dot={{ r: 3, fill: "#94a3b8" }} />
              <Area type="monotone" dataKey="enVentana" name="Visitas en ventana horaria" stroke="#10b981" fill="url(#colorVentana)" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Failed visits reasons */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">Motivo de visitas fallidas</h3>
            <div className="flex gap-2 text-xs">
              <button className="font-semibold text-dropit-accent underline underline-offset-2">Fallidas</button>
              <span className="text-slate-300">|</span>
              <button className="text-slate-500 hover:text-slate-700">Completadas</button>
            </div>
          </div>
          <div className="flex h-40 items-center justify-center">
            <div className="text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No hay datos disponibles</p>
              <p className="text-xs text-slate-300 mt-1">No se registraron visitas fallidas en el período</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
