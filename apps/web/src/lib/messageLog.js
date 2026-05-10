/**
 * messageLog.js — registro persistente de todos los mensajes enviados
 * Almacenado en localStorage, máx. 500 entradas.
 */

const KEY    = "dropit-message-log";
const MAX    = 500;

/**
 * Agrega una entrada al log.
 * @param {object} entry
 *  - channel:      "whatsapp" | "email"
 *  - type:         "reminder_30min" | "reminder_45min" | "reminder_60min" | "cotizacion_enviada" | "nueva_cotizacion"
 *  - mode:         "auto" | "manual"
 *  - recipient:    phone or email string
 *  - requestId:    "SOL-XXXX"
 *  - trackingCode: "DRP-XXXX"
 *  - customerName: string
 *  - status:       "sent" | "failed"
 *  - amount?:      number (for cotizacion)
 *  - note?:        string
 */
export function addToLog(entry) {
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || "[]");
    existing.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      ...entry,
    });
    if (existing.length > MAX) existing.length = MAX;
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

/** Retorna todas las entradas del log (más reciente primero). */
export function getLog() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

/** Elimina todo el log. */
export function clearLog() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Etiquetas legibles para cada tipo de evento. */
export const TYPE_LABELS = {
  reminder_30min:      "Recordatorio 30 min",
  reminder_45min:      "Recordatorio 45 min",
  reminder_60min:      "Recordatorio 60 min",
  cotizacion_enviada:  "Cotización enviada",
  nueva_cotizacion:    "Nueva cotización",
};

export const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  email:    "Email",
};
