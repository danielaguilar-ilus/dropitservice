import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createQuoteRequest, quoteRequest } from "../services/request.service.js";
import { getSmtpConfig, sendMail } from "../services/mail.service.js";

const router = Router();

// ─── Urgent email template (server-side, guaranteed delivery) ────────────────
function urgentEmailHtml(req) {
  const now = new Date().toLocaleString("es-CL");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.85}
  .body{padding:28px 32px}
  .badge{display:inline-block;background:#dc2626;color:#fff;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:800;margin-bottom:18px;animation:none}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:60%}
  .btn{display:block;margin:24px auto 0;background:#dc2626;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:800;font-size:15px;text-align:center}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>⚡ COTIZACIÓN URGENTE</h1>
    <p>El cliente marcó esta solicitud como urgente — atender de inmediato</p>
  </div>
  <div class="body">
    <div class="badge">🔴 PRIORIDAD MÁXIMA</div>
    <div class="row"><span>Código</span><span><strong style="font-family:monospace">${req.trackingCode}</strong></span></div>
    <div class="row"><span>Cliente</span><span>${req.customerName}</span></div>
    <div class="row"><span>Teléfono</span><span>${req.contactPhone || "—"}</span></div>
    <div class="row"><span>Email</span><span>${req.contactEmail || "—"}</span></div>
    <div class="row"><span>📦 Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>🏁 Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.distanceKm ? `<div class="row"><span>Distancia</span><span><strong style="color:#dc2626">${req.distanceKm} km</strong></span></div>` : ""}
    <div class="row"><span>Recibida</span><span>${now}</span></div>
    <a href="https://dropitapi-production.up.railway.app" class="btn">⚡ Ir al panel ahora</a>
  </div>
  <div class="footer">Dropit Service · Alerta urgente automática · No responder</div>
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

    // ─── Urgent: fire server-side email immediately (non-blocking) ──────────
    if (req.body.urgent) {
      const smtpCfg = getSmtpConfig();
      if (smtpCfg.user && smtpCfg.host) {
        sendMail({
          to: smtpCfg.user,
          subject: `⚡ URGENTE — Cotización de ${request.customerName} (${request.trackingCode})`,
          html: urgentEmailHtml(request),
        }).catch(err => console.error("[urgent-mail]", err.message));
      }
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
