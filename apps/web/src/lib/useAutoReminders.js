/**
 * useAutoReminders
 * ────────────────
 * Hook global que corre SIEMPRE, independiente del módulo activo.
 * Escanea cada 30s las solicitudes pendientes y envía recordatorios
 * automáticos a los 30, 45 y 60 minutos por:
 *   • WhatsApp (Twilio) → al cliente
 *   • Email (SMTP)      → al operador / admin
 *
 * Montado en App.jsx → nunca se desmonta al cambiar de módulo.
 */
import { useEffect, useRef, useState } from "react";
import { addToLog } from "./messageLog";
import { sendWAReminder } from "../components/AdminQuotesModule";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const THRESHOLDS = [
  { type: "30min", min: 30, label: "30 minutos" },
  { type: "45min", min: 45, label: "45 minutos" },
  { type: "60min", min: 60, label: "1 hora" },
];

function getElapsedMinutes(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

// ─── Email al operador ────────────────────────────────────────────────────────
async function sendEmailReminder(req, type, adminEmail, smtpConfig) {
  if (!adminEmail || !smtpConfig?.host) return false;

  const labels = { "30min": "30 minutos", "45min": "45 minutos", "60min": "1 hora" };
  const icons  = { "30min": "⏰", "45min": "⚠️", "60min": "🔴" };
  const label  = labels[type];
  const icon   = icons[type];
  const now    = new Date().toLocaleString("es-CL");

  const subject = `${icon} Cotización sin respuesta (${label}) — ${req.customerName}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: Arial, sans-serif; background: #f8f8f8; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #F97316, #C2590A); padding: 28px 32px; color: #fff; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 900; }
  .header p  { margin: 6px 0 0; font-size: 13px; opacity: .8; }
  .body { padding: 28px 32px; }
  .alert { background: #fff8f1; border-left: 4px solid #F97316; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; }
  .alert p { margin: 0; font-size: 15px; font-weight: 700; color: #C2590A; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .row span:first-child { color: #666; }
  .row span:last-child  { font-weight: 700; color: #111; text-align: right; max-width: 60%; }
  .btn { display: block; margin: 24px auto 0; background: #F97316; color: #fff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 800; font-size: 15px; text-align: center; }
  .footer { padding: 16px 32px; background: #f4f4f4; text-align: center; font-size: 11px; color: #999; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>${icon} Alerta — cotización pendiente</h1>
    <p>Han pasado <strong>${label}</strong> sin responder esta solicitud</p>
  </div>
  <div class="body">
    <div class="alert">
      <p>⚡ Acción requerida: cotiza de inmediato para no perder al cliente</p>
    </div>
    <div class="row"><span>Código</span><span><strong style="font-family:monospace;">${req.trackingCode}</strong></span></div>
    <div class="row"><span>Cliente</span><span>${req.customerName}</span></div>
    <div class="row"><span>Teléfono</span><span>${req.contactPhone}</span></div>
    <div class="row"><span>Email cliente</span><span>${req.contactEmail}</span></div>
    <div class="row"><span>📦 Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>🏁 Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.distanceKm ? `<div class="row"><span>Distancia</span><span><strong style="color:#F97316;">${req.distanceKm} km</strong></span></div>` : ""}
    <div class="row"><span>Recibida</span><span>${new Date(req.createdAt).toLocaleString("es-CL")}</span></div>
    <div class="row"><span>Alerta generada</span><span>${now}</span></div>
    <a href="http://localhost:5173" class="btn">Ir al panel → Cotizar ahora</a>
  </div>
  <div class="footer">Dropit Service · Alerta automática · No responder este correo</div>
</div>
</body>
</html>`;

  try {
    const res = await fetch(`${API_URL}/mail/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: adminEmail, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export default function useAutoReminders(requests = []) {
  const sentRef     = useRef(new Set());   // "requestId-type" sent this session
  const retriesRef  = useRef({});          // "requestId-type" → retry count (max 3)
  const requestsRef = useRef(requests);    // always up-to-date without re-creating interval
  const [toast, setToast] = useState(null);

  // Keep requestsRef in sync with prop
  useEffect(() => { requestsRef.current = requests; }, [requests]);

  function runScan() {
    // Read configs
    let waConfig   = null;
    let smtpConfig = null;
    let adminEmail = "";
    try { waConfig   = JSON.parse(localStorage.getItem("dropit-whatsapp-config") || "null"); } catch {}
    try { smtpConfig = JSON.parse(localStorage.getItem("dropit-smtp-config")     || "null"); } catch {}
    adminEmail = smtpConfig?.user || smtpConfig?.email || "";

    // Need at least one channel configured
    const hasWA    = !!(waConfig?.authToken && waConfig?.accountSid);
    const hasEmail = !!(adminEmail && smtpConfig?.host);
    if (!hasWA && !hasEmail) return;

    const pending = requestsRef.current.filter(r => r.status === "Pendiente de cotizacion");

    pending.forEach(req => {
      const mins = getElapsedMinutes(req.createdAt);

      THRESHOLDS.forEach(({ type, min, label }) => {
        if (mins < min) return;

        const key = `${req.id}-${type}`;
        if (sentRef.current.has(key)) return;
        if ((req.remindersSent || []).some(r => r.type === type)) return;

        sentRef.current.add(key);
        console.log(`[AutoReminder] 📤 Enviando ${type} a ${req.customerName} (${mins} min elapsed)`);

        // Fire WA + Email in parallel
        const waPromise    = hasWA    ? sendWAReminder(req, type, waConfig)                : Promise.resolve(false);
        const emailPromise = hasEmail ? sendEmailReminder(req, type, adminEmail, smtpConfig) : Promise.resolve(false);

        Promise.all([waPromise, emailPromise]).then(([waOk, emailOk]) => {
          const anyOk = waOk || emailOk;

          // Log each channel
          if (hasWA) {
            addToLog({
              channel: "whatsapp", type: `reminder_${type}`, mode: "auto",
              recipient: req.contactPhone, requestId: req.id,
              trackingCode: req.trackingCode, customerName: req.customerName,
              status: waOk ? "sent" : "failed",
            });
          }
          if (hasEmail) {
            addToLog({
              channel: "email", type: `reminder_${type}`, mode: "auto",
              recipient: adminEmail, requestId: req.id,
              trackingCode: req.trackingCode, customerName: req.customerName,
              status: emailOk ? "sent" : "failed",
            });
          }

          if (anyOk) {
            // Build toast text showing which channels fired
            const channels = [waOk && "WA", emailOk && "Email"].filter(Boolean).join(" + ");
            setToast({ ok: true, text: `⚡ Recordatorio (${label}) → ${req.customerName} · ${channels}` });
            setTimeout(() => setToast(null), 7000);
            console.log(`[AutoReminder] ✅ ${type} OK → ${req.customerName} (${channels})`);
          } else {
            const retries = (retriesRef.current[key] || 0) + 1;
            retriesRef.current[key] = retries;
            if (retries < 3) {
              console.warn(`[AutoReminder] ❌ ${type} FALLÓ → ${req.customerName} — reintento ${retries}/3`);
              sentRef.current.delete(key); // allow retry (max 3)
            } else {
              console.warn(`[AutoReminder] ❌ ${type} FALLÓ 3 veces → ${req.customerName} — abandonado`);
            }
          }
        });
      });
    });
  }

  useEffect(() => {
    // Run once immediately on mount (catches already-elapsed requests)
    runScan();
    // Then every 30 seconds
    const id = setInterval(runScan, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — interval runs forever, reads fresh data via requestsRef

  return { toast, clearToast: () => setToast(null) };
}
