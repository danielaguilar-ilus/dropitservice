export const serviceTypes = [
  "Flete urbano",
  "Última milla",
  "Mudanza",
  "Traslado especial",
  "Ruta dedicada",
];

export const statusTone = {
  "Pendiente de cotizacion": "bg-amber-50 text-amber-700 border-amber-200",
  Cotizado: "bg-blue-50 text-blue-700 border-blue-200",
  "Aceptado por cliente": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Agendado: "bg-sky-50 text-sky-700 border-sky-200",
  "Asignado a camion / chofer": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "En preparacion": "bg-violet-50 text-violet-700 border-violet-200",
  "En ruta": "bg-orange-50 text-orange-600 border-orange-200",
  Entregado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "No conforme / incidencia": "bg-red-50 text-red-700 border-red-200",
};

export const statusConfig = {
  "Pendiente de cotizacion": { label: "Pendiente", icon: "Clock", color: "warning" },
  Cotizado: { label: "Cotizado", icon: "FileText", color: "info" },
  "Aceptado por cliente": { label: "Aceptado", icon: "CheckCircle", color: "info" },
  Agendado: { label: "Agendado", icon: "Calendar", color: "info" },
  "Asignado a camion / chofer": { label: "Asignado", icon: "Truck", color: "info" },
  "En preparacion": { label: "En preparación", icon: "Package", color: "info" },
  "En ruta": { label: "En ruta", icon: "Navigation", color: "accent" },
  Entregado: { label: "Entregado", icon: "CheckCircle2", color: "success" },
  "No conforme / incidencia": { label: "Incidencia", icon: "AlertTriangle", color: "error" },
};

// Visit status for tracking module
export const visitStatus = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-600 border-slate-200" },
  en_ruta: { label: "En ruta", color: "bg-orange-50 text-orange-600 border-orange-200" },
  exitosa: { label: "Exitosa", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  fallida: { label: "Fallida", color: "bg-red-50 text-red-700 border-red-200" },
};
