/**
 * MessageLogModule — historial completo de mensajes enviados (WA + Email)
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2, Download, Mail, MessageSquare, RefreshCw,
  Search, Trash2, X, Zap, AlertTriangle,
} from "lucide-react";
import { clearLog, getLog, TYPE_LABELS, CHANNEL_LABELS } from "../lib/messageLog";

function relativeTime(ts) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins   = Math.floor(diffMs / 60000);
  if (mins < 1)  return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  return `Hace ${d}d`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("es-CL", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const CHANNEL_COLORS = {
  whatsapp: "bg-green-100 text-green-700 border-green-200",
  email:    "bg-blue-100  text-blue-700  border-blue-200",
};

const TYPE_COLORS = {
  reminder_30min:     "bg-amber-50  text-amber-700  border-amber-200",
  reminder_45min:     "bg-orange-50 text-orange-700 border-orange-200",
  reminder_60min:     "bg-red-50    text-red-700    border-red-200",
  cotizacion_enviada: "bg-emerald-50 text-emerald-700 border-emerald-200",
  nueva_cotizacion:   "bg-sky-50    text-sky-700    border-sky-200",
};

const MODE_LABELS = { auto: "⚡ Auto", manual: "✋ Manual" };

export default function MessageLogModule() {
  const [log,     setLog]     = useState([]);
  const [query,   setQuery]   = useState("");
  const [channel, setChannel] = useState("all");
  const [type,    setType]    = useState("all");
  const [confirm, setConfirm] = useState(false);

  function load() { setLog(getLog()); }

  useEffect(() => {
    load();
    // refresh every 30s in case other tabs add entries
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  function handleClear() {
    clearLog();
    setLog([]);
    setConfirm(false);
  }

  function exportCsv() {
    const headers = ["Fecha","Canal","Tipo","Modo","Destinatario","Cliente","Código","Estado"];
    const rows = filtered.map(e => [
      formatDate(e.ts),
      CHANNEL_LABELS[e.channel] || e.channel,
      TYPE_LABELS[e.type] || e.type,
      e.mode === "auto" ? "Automático" : "Manual",
      e.recipient || "",
      e.customerName || "",
      e.trackingCode || e.requestId || "",
      e.status === "sent" ? "Enviado" : "Error",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `dropit-mensajes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = log.filter(e => {
    if (channel !== "all" && e.channel !== channel) return false;
    if (type    !== "all" && e.type    !== type)    return false;
    if (query) {
      const q = query.toLowerCase();
      const haystack = [e.customerName, e.trackingCode, e.requestId, e.recipient].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sentCount   = log.filter(e => e.status === "sent").length;
  const failedCount = log.filter(e => e.status === "failed").length;
  const autoCount   = log.filter(e => e.mode   === "auto").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Historial</p>
          <h2 className="text-2xl font-black text-slate-800">Log de mensajes</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Registro de todos los mensajes enviados por WhatsApp y Email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-dropit-accent/40 hover:text-dropit-accent transition-all shadow-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 bg-dropit-accent/5 px-3 py-2 text-sm font-semibold text-dropit-accent hover:bg-dropit-accent/10 transition-all disabled:opacity-40">
            <Download size={14} /> Exportar CSV
          </button>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} disabled={log.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-40">
              <Trash2 size={14} /> Limpiar log
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-red-600">¿Confirmar?</span>
              <button onClick={handleClear} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600">Sí</button>
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">No</button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total enviados", value: log.length,   icon: "📨", color: "text-slate-800" },
          { label: "Exitosos",       value: sentCount,    icon: "✅", color: "text-emerald-700" },
          { label: "Con error",      value: failedCount,  icon: "❌", color: "text-red-600" },
          { label: "Automáticos",    value: autoCount,    icon: "⚡", color: "text-dropit-accent" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xl">{icon}</p>
            <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="Buscar cliente, código, teléfono..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Channel filter */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {[["all","Todos"], ["whatsapp","WhatsApp"], ["email","Email"]].map(([v, l]) => (
            <button key={v} onClick={() => setChannel(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                channel === v
                  ? v === "whatsapp" ? "bg-green-500 text-white" : v === "email" ? "bg-blue-500 text-white" : "bg-dropit-accent text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
          value={type}
          onChange={e => setType(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <span className="text-xs text-slate-400">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Zap size={32} className="mb-3 text-dropit-accent/30" />
          <p className="font-semibold text-slate-600">Sin mensajes en el log</p>
          <p className="mt-1 text-sm text-slate-400">
            {log.length === 0
              ? "Los mensajes enviados aparecerán aquí automáticamente"
              : "No hay resultados para los filtros aplicados"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-40">Fecha / Hora</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Modo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Destinatario</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-semibold text-slate-700">{relativeTime(entry.ts)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(entry.ts)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${CHANNEL_COLORS[entry.channel] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {entry.channel === "whatsapp"
                          ? <MessageSquare size={10} />
                          : <Mail size={10} />
                        }
                        {CHANNEL_LABELS[entry.channel] || entry.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${TYPE_COLORS[entry.type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {TYPE_LABELS[entry.type] || entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold ${entry.mode === "auto" ? "text-dropit-accent" : "text-slate-500"}`}>
                        {MODE_LABELS[entry.mode] || entry.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 max-w-[160px] truncate">
                      {entry.customerName || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-dropit-accent">
                      {entry.trackingCode || entry.requestId || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                      {entry.recipient || "—"}
                      {entry.amount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold">${Number(entry.amount).toLocaleString("es-CL")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={9} /> Enviado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <AlertTriangle size={9} /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-right">
            <p className="text-[10px] text-slate-400">
              Mostrando {filtered.length} de {log.length} entradas · almacenado localmente en este dispositivo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
