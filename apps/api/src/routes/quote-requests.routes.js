import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createQuoteRequest, quoteRequest } from "../services/request.service.js";
import { getSmtpConfig, sendMail } from "../services/mail.service.js";

const router = Router();

// ─── Operator notification email (server-side, guaranteed delivery) ──────────
function newQuoteEmailHtml(req) {
  const now = new Date().toLocaleString("es-CL");
  const isUrgent = !!req.urgent;
  const headerBg = isUrgent
    ? "linear-gradient(135deg,#dc2626,#991b1b)"
    : "linear-gradient(135deg,#f97316,#c2590a)";
  const headerTitle = isUrgent ? "⚡ COTIZACIÓN URGENTE" : "🚛 Nueva cotización recibida";
  const headerSub   = isUrgent
    ? "El cliente marcó esta solicitud como urgente — atender de inmediato"
    : "Un cliente acaba de enviar una solicitud de cotización";
  const badge = isUrgent
    ? `<div class="badge urgent">🔴 PRIORIDAD MÁXIMA</div>`
    : `<div class="badge normal">📋 Pendiente de cotización</div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:${headerBg};padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.85}
  .body{padding:28px 32px}
  .badge{display:inline-block;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:800;margin-bottom:18px}
  .badge.urgent{background:#dc2626;color:#fff}
  .badge.normal{background:#f97316;color:#fff}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:60%}
  .btn{display:block;margin:24px auto 0;background:${isUrgent ? "#dc2626" : "#f97316"};color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:800;font-size:15px;text-align:center}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>${headerTitle}</h1>
    <p>${headerSub}</p>
  </div>
  <div class="body">
    ${badge}
    <div class="row"><span>Código</span><span><strong style="font-family:monospace">${req.trackingCode}</strong></span></div>
    <div class="row"><span>Cliente</span><span>${req.customerName}</span></div>
    <div class="row"><span>Teléfono</span><span>${req.contactPhone || "—"}</span></div>
    <div class="row"><span>Email</span><span>${req.contactEmail || "—"}</span></div>
    <div class="row"><span>📦 Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>🏁 Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.cargoDescription ? `<div class="row"><span>Carga</span><span>${req.cargoDescription}</span></div>` : ""}
    ${req.avionetaCount > 0 ? `<div class="row"><span>Peonetas</span><span>${req.avionetaCount} peoneta${req.avionetaCount > 1 ? "s" : ""} solicitada${req.avionetaCount > 1 ? "s" : ""}</span></div>` : ""}
    ${req.distanceKm ? `<div class="row"><span>Distancia</span><span><strong>${req.distanceKm} km</strong></span></div>` : ""}
    <div class="row"><span>Recibida</span><span>${now}</span></div>
    <a href="https://dropitapi-production.up.railway.app" class="btn">${isUrgent ? "⚡ Ir al panel ahora" : "📋 Ver cotización en el panel"}</a>
  </div>
  <div class="footer">Dropit Service · Notificación automática · No responder</div>
</div></body></html>`;
}

router.get("/", (_req, res) => {
  res.json({ requests: store.requests });
});

router.post("/", async (req, res) => {
  try {
    const requiredFields = [
      "customerName",
      "contactPerson",
      "contactPhone",
      "contactEmail",
      "pickupAddress",
      "deliveryAddress",
      "destinationCity",
      "packages",
      "estimatedWeightKg",
      "cargoDescription",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(422).json({
        message: "Faltan campos obligatorios",
        errors: missingFields.map((field) => ({ field, message: `Falta ${field}` })),
      });
    }

    const request = await createQuoteRequest(req.body);

    // ─── Operator notification email on EVERY new quote ─────────────────────
    const smtpCfg = getSmtpConfig();
    console.log("[new-quote-mail] SMTP state →", {
      host: smtpCfg.host || "(vacío)",
      port: smtpCfg.port,
      user: smtpCfg.user || "(vacío)",
      hasPass: !!smtpCfg.pass,
      trackingCode: request.trackingCode,
    });
    if (smtpCfg.user && smtpCfg.host && smtpCfg.pass) {
      const isUrgent = !!req.body.urgent;
      const subject = isUrgent
        ? `[${request.trackingCode}] ⚡ URGENTE — NUEVA COTIZACIÓN — ${request.customerName}`
        : `[${request.trackingCode}] Nueva cotización — ${request.customerName}`;
      console.log("[new-quote-mail] intentando envío a", smtpCfg.user, "· asunto:", subject);
      // Fire-and-forget — la respuesta HTTP se envía sin esperar el correo.
      // Esto es intencional: el envío SMTP no debe bloquear la creación de cotización.
      // Los errores se loguean con detalle MÁXIMO para diagnóstico en Railway.
      sendMail({
        to: smtpCfg.user,
        subject,
        html: newQuoteEmailHtml(request),
      }).then(info => {
        console.log("[new-quote-mail] OK — messageId:", info.messageId,
          "· accepted:", info.accepted, "· rejected:", info.rejected,
          "· response:", info.response, "· trackingCode:", request.trackingCode);
      }).catch(err => {
        // ★ LOG SUPER VISIBLE — esto debe aparecer en los logs de Railway ★
        console.error("==================================================");
        console.error("[new-quote-mail] ✗✗✗ FALLO al enviar correo de nueva cotización");
        console.error("[new-quote-mail] trackingCode:", request.trackingCode);
        console.error("[new-quote-mail] destinatario:", smtpCfg.user);
        console.error("[new-quote-mail] error.message:", err.message);
        console.error("[new-quote-mail] error.code:", err.code);
        console.error("[new-quote-mail] error.command:", err.command);
        console.error("[new-quote-mail] error.response:", err.response);
        console.error("[new-quote-mail] error.responseCode:", err.responseCode);
        console.error("[new-quote-mail] error.stack:", err.stack);
        console.error("==================================================");
      });
    } else {
      const missing = [
        !smtpCfg.host && "SMTP_HOST",
        !smtpCfg.user && "SMTP_USER",
        !smtpCfg.pass && "SMTP_PASS",
      ].filter(Boolean).join(", ");
      console.warn("[new-quote-mail] OMITIDO — SMTP incompleto, faltan:", missing,
        "· configura env vars en Railway o usa el panel Config. correo");
    }

    res.status(201).json({ request, ...buildDashboardPayload() });
  } catch (err) {
    console.error("Error creating quote request:", err);
    res.status(500).json({ message: err.message || "Error al crear solicitud" });
  }
});

// Append photos to an existing request (called in background after form submit)
router.patch("/:requestId/photos", (req, res) => {
  const request = store.requests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ ok: false, message: "No encontrado" });
  const incoming = (req.body.photos || []).filter(Boolean);
  request.photos = [...(request.photos || []), ...incoming].slice(0, 20);
  saveStore();
  res.json({ ok: true, photoCount: request.photos.length });
});

// Mark WhatsApp reminder sent
router.patch("/:requestId/reminder", (req, res) => {
  const request = store.requests.find(r => r.id === req.params.requestId);
  if (!request) return res.status(404).json({ message: "No encontrado" });
  if (!request.remindersSent) request.remindersSent = [];
  request.remindersSent.push({ type: req.body.type, sentAt: new Date().toISOString() });
  request.whatsappSent = true;
  saveStore();
  res.json({ ok: true, request });
});

router.patch("/:requestId/quote", (req, res) => {
  try {
    const request = quoteRequest(req.params.requestId, req.body);
    res.json({ request, ...buildDashboardPayload() });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

export default router;
