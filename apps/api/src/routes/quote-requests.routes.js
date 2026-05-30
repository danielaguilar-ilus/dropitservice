import { Router } from "express";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";
import { buildDashboardPayload } from "../services/dashboard.service.js";
import { createQuoteRequest, quoteRequest, acceptQuoteRequest } from "../services/request.service.js";
import { sendMail, isMailConfigured, getOperatorInbox } from "../services/mail.service.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

// ─── Public base URL (used in confirmation links) ─────────────────────────────
function getPublicUrl() {
  return process.env.PUBLIC_URL || "http://localhost:5173";
}

// ─── Email: confirmation to CLIENT on new quote ───────────────────────────────
function clientConfirmationEmailHtml(req) {
  const pub = getPublicUrl();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#f97316,#c2590a);padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.85}
  .body{padding:28px 32px}
  .tracking{font-family:monospace;font-size:24px;font-weight:900;color:#f97316;letter-spacing:2px;display:block;margin:16px 0}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:65%}
  .note{background:#fff7ed;border-left:4px solid #f97316;padding:14px 16px;border-radius:6px;font-size:13px;color:#374151;margin:20px 0;line-height:1.6}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>✅ Solicitud recibida</h1>
    <p>Hola ${req.customerName} — ya tenemos tu pedido y lo estamos procesando</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#111;margin:0 0 8px">Tu código de seguimiento:</p>
    <span class="tracking">${req.trackingCode}</span>
    <div class="row"><span>Retiro</span><span>${req.pickupAddress}</span></div>
    ${Array.isArray(req.deliveryStops) && req.deliveryStops.length > 1
      ? `<div class="row"><span>Entregas (${req.deliveryStops.length})</span><span>${req.deliveryStops.map((s, i) => `${i + 1}. ${s.address}${s.commune ? `, ${s.commune}` : ""}`).join("<br>")}</span></div>`
      : `<div class="row"><span>Entrega</span><span>${req.deliveryAddress}</span></div>`}
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.requiredDate ? `<div class="row"><span>Fecha requerida</span><span>${req.requiredDate}</span></div>` : ""}
    <div class="note">
      🕐 <strong>Te enviamos la cotización en menos de 1 hora hábil</strong> al correo ${req.contactEmail}.<br>
      Guarda el código <strong>${req.trackingCode}</strong> para hacer seguimiento de tu pedido.
    </div>
  </div>
  <div class="footer">DropIt Service · No responder a este correo</div>
</div></body></html>`;
}

// ─── Email: notify operator/superadmin when quote IS SENT ─────────────────────
function adminQuoteSentEmailHtml(req, quotedAmount, serviceType, confirmUrl) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#1a1a1a,#2a2a2a);padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:20px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.7}
  .body{padding:28px 32px}
  .price{font-size:36px;font-weight:900;color:#f97316;display:block;margin:8px 0 20px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:65%}
  .btn{display:block;margin:20px auto 0;background:#f97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;text-align:center;max-width:280px}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>📤 Cotización enviada al cliente</h1>
    <p>Ref. ${req.trackingCode} · ${req.customerName}</p>
  </div>
  <div class="body">
    <p style="font-size:14px;color:#555;margin:0 0 4px">Valor cotizado:</p>
    <span class="price">$${Number(quotedAmount).toLocaleString("es-CL")}</span>
    <div class="row"><span>Cliente</span><span>${req.customerName}</span></div>
    <div class="row"><span>Email cliente</span><span>${req.contactEmail}</span></div>
    <div class="row"><span>Teléfono</span><span>${req.contactPhone || "—"}</span></div>
    <div class="row"><span>Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Tipo servicio</span><span>${serviceType || "—"}</span></div>
    <div class="row"><span>Código</span><span style="font-family:monospace;color:#f97316">${req.trackingCode}</span></div>
    ${confirmUrl ? `<a href="${confirmUrl}" class="btn">🔗 Ver página de confirmación del cliente</a>` : ""}
  </div>
  <div class="footer">DropIt Service · Sistema de gestión interna</div>
</div></body></html>`;
}

// ─── Email: client accepted the quote ────────────────────────────────────────
function quoteAcceptedClientEmailHtml(req) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#16a34a,#166534);padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.85}
  .body{padding:28px 32px}
  .price{background:linear-gradient(135deg,#f97316,#c2590a);color:#fff;padding:20px 24px;border-radius:12px;text-align:center;margin:16px 0}
  .price p{margin:0 0 4px;font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:1px}
  .price strong{font-size:32px;font-weight:900}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:65%}
  .note{background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:6px;font-size:13px;color:#166534;margin:20px 0;line-height:1.6}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>🎉 ¡Cotización confirmada!</h1>
    <p>Tu servicio está agendado — nos pondremos en contacto pronto</p>
  </div>
  <div class="body">
    <div class="price"><p>Total confirmado</p><strong>$${Number(req.quotedAmount).toLocaleString("es-CL")}</strong></div>
    <div class="row"><span>Código</span><span style="font-family:monospace;color:#f97316">${req.trackingCode}</span></div>
    <div class="row"><span>Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.requiredDate ? `<div class="row"><span>Fecha</span><span>${req.requiredDate}${req.requiredTime ? ` · ${req.requiredTime}` : ""}</span></div>` : ""}
    <div class="note">
      ✅ <strong>¡Listo!</strong> Hemos registrado tu confirmación. Nuestro equipo coordinará el retiro y te avisaremos con anticipación.<br>
      Usa el código <strong>${req.trackingCode}</strong> para hacer seguimiento en tiempo real.
    </div>
  </div>
  <div class="footer">DropIt Service · Gracias por confiar en nosotros</div>
</div></body></html>`;
}

// ─── Email: notify admin when client accepts ──────────────────────────────────
function quoteAcceptedAdminEmailHtml(req) {
  const now = new Date().toLocaleString("es-CL");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#16a34a,#166534);padding:28px 32px;color:#fff}
  .header h1{margin:0;font-size:20px;font-weight:900}
  .header p{margin:6px 0 0;font-size:13px;opacity:.8}
  .body{padding:28px 32px}
  .price{font-size:36px;font-weight:900;color:#16a34a;display:block;margin:8px 0 20px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:700;color:#111;text-align:right;max-width:65%}
  .btn{display:block;margin:20px auto 0;background:#f97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;text-align:center;max-width:280px}
  .footer{padding:16px 32px;background:#f4f4f4;text-align:center;font-size:11px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>✅ Cliente aceptó la cotización</h1>
    <p>${req.customerName} · ${now}</p>
  </div>
  <div class="body">
    <p style="font-size:14px;color:#555;margin:0 0 4px">Valor aceptado:</p>
    <span class="price">$${Number(req.quotedAmount).toLocaleString("es-CL")}</span>
    <div class="row"><span>Cliente</span><span>${req.customerName}</span></div>
    <div class="row"><span>Teléfono</span><span>${req.contactPhone || "—"}</span></div>
    <div class="row"><span>Email</span><span>${req.contactEmail}</span></div>
    <div class="row"><span>Retiro</span><span>${req.pickupAddress}</span></div>
    <div class="row"><span>Entrega</span><span>${req.deliveryAddress}</span></div>
    <div class="row"><span>Bultos / Peso</span><span>${req.packages} bultos · ${req.estimatedWeightKg} kg</span></div>
    ${req.requiredDate ? `<div class="row"><span>Fecha</span><span>${req.requiredDate}${req.requiredTime ? ` · ${req.requiredTime}` : ""}</span></div>` : ""}
    <div class="row"><span>Código</span><span style="font-family:monospace;color:#f97316">${req.trackingCode}</span></div>
    <a href="${getPublicUrl()}" class="btn">📦 Ir al panel — planificar ruta</a>
  </div>
  <div class="footer">DropIt Service · El pedido ya está disponible para asignar a una ruta</div>
</div></body></html>`;
}

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
    ${Array.isArray(req.deliveryStops) && req.deliveryStops.length > 1
      ? `<div class="row"><span>🏁 Entregas (${req.deliveryStops.length})</span><span>${req.deliveryStops.map((s, i) => `${i + 1}. ${s.address}${s.commune ? `, ${s.commune}` : ""}`).join("<br>")}</span></div>`
      : `<div class="row"><span>🏁 Entrega</span><span>${req.deliveryAddress}</span></div>`}
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

router.get("/", async (_req, res) => {
  try {
    const requests = HAS_DB ? await db.listRequests() : store.requests;
    res.json({ requests });
  } catch (err) {
    console.error("[quote-requests/list] error:", err);
    res.status(500).json({ message: "Error al listar solicitudes" });
  }
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

    // ─── Email notifications on EVERY new quote (fire-and-forget) ──────────
    // No exigimos SMTP: mail.service decide el proveedor (Resend > SMTP).
    if (isMailConfigured()) {
      const operatorInbox = getOperatorInbox();
      const isUrgent = !!req.body.urgent;
      const operatorSubject = isUrgent
        ? `[${request.trackingCode}] ⚡ URGENTE — NUEVA COTIZACIÓN — ${request.customerName}`
        : `[${request.trackingCode}] Nueva cotización — ${request.customerName}`;

      // 1) Email al OPERADOR/SUPERADMIN
      if (operatorInbox) {
        sendMail({ to: operatorInbox, subject: operatorSubject, html: newQuoteEmailHtml(request) })
          .then(info => console.log("[new-quote-mail/operator] OK", info.messageId, request.trackingCode))
          .catch(err => console.error("[new-quote-mail/operator] FALLO", err.message, err.code));
      }

      // 2) Email de CONFIRMACIÓN al CLIENTE
      if (request.contactEmail) {
        const clientSubject = `Recibimos tu solicitud ${request.trackingCode} — DropIt Service`;
        sendMail({ to: request.contactEmail, subject: clientSubject, html: clientConfirmationEmailHtml(request) })
          .then(info => console.log("[new-quote-mail/client] OK", info.messageId, request.trackingCode))
          .catch(err => console.error("[new-quote-mail/client] FALLO", err.message, err.code));
      }
    } else {
      console.warn("[new-quote-mail] OMITIDO — no hay proveedor de correo (ni Resend ni SMTP). " +
        "Configura RESEND_API_KEY (recomendado) o SMTP_* en Railway.");
    }

    res.status(201).json({ request, ...(await buildDashboardPayload()) });
  } catch (err) {
    console.error("Error creating quote request:", err);
    res.status(500).json({ message: err.message || "Error al crear solicitud" });
  }
});

// Append photos to an existing request (called in background after form submit)
router.patch("/:requestId/photos", async (req, res) => {
  try {
    const incoming = (req.body.photos || []).filter(Boolean);

    if (HAS_DB) {
      const request = await db.findRequest(req.params.requestId);
      if (!request) return res.status(404).json({ ok: false, message: "No encontrado" });
      const merged = [...(request.photos || []), ...incoming].slice(0, 20);
      const updated = await db.updateRequest(req.params.requestId, { photos: merged });
      return res.json({ ok: true, photoCount: updated.photos.length });
    }

    const request = store.requests.find(r => r.id === req.params.requestId);
    if (!request) return res.status(404).json({ ok: false, message: "No encontrado" });
    request.photos = [...(request.photos || []), ...incoming].slice(0, 20);
    saveStore();
    res.json({ ok: true, photoCount: request.photos.length });
  } catch (err) {
    console.error("[quote-requests/photos] error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Mark WhatsApp reminder sent
router.patch("/:requestId/reminder", async (req, res) => {
  try {
    if (HAS_DB) {
      const request = await db.findRequest(req.params.requestId);
      if (!request) return res.status(404).json({ message: "No encontrado" });
      const reminders = Array.isArray(request.remindersSent) ? [...request.remindersSent] : [];
      reminders.push({ type: req.body.type, sentAt: new Date().toISOString() });
      const updated = await db.updateRequest(req.params.requestId, {
        remindersSent: reminders,
        whatsappSent: true,
      });
      return res.json({ ok: true, request: updated });
    }

    const request = store.requests.find(r => r.id === req.params.requestId);
    if (!request) return res.status(404).json({ message: "No encontrado" });
    if (!request.remindersSent) request.remindersSent = [];
    request.remindersSent.push({ type: req.body.type, sentAt: new Date().toISOString() });
    request.whatsappSent = true;
    saveStore();
    res.json({ ok: true, request });
  } catch (err) {
    console.error("[quote-requests/reminder] error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.patch("/:requestId/quote", async (req, res) => {
  try {
    const updated = await quoteRequest(req.params.requestId, req.body);

    // ─── Server-side notification to OPERATOR/SUPERADMIN when quote is sent ──
    const operatorInbox = getOperatorInbox();
    if (isMailConfigured() && operatorInbox) {
      const confirmUrl = `${getPublicUrl()}/confirmar?id=${updated.id}&token=${updated.acceptanceToken || ""}`;
      const subject = `[${updated.trackingCode}] Cotización enviada — $${Number(updated.quotedAmount).toLocaleString("es-CL")} — ${updated.customerName}`;
      sendMail({
        to: operatorInbox,
        subject,
        html: adminQuoteSentEmailHtml(updated, updated.quotedAmount, updated.serviceType, confirmUrl),
      }).then(info => console.log("[quote-sent-mail/admin] OK", info.messageId))
        .catch(err => console.error("[quote-sent-mail/admin] FALLO", err.message));
    }

    res.json({ request: updated, ...(await buildDashboardPayload()) });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// ─── GET /:requestId/public — public quote detail (for confirmation page) ─────
router.get("/:requestId/public", async (req, res) => {
  try {
    const { token } = req.query;
    const request = HAS_DB
      ? await db.findRequest(req.params.requestId)
      : store.requests.find(r => r.id === req.params.requestId);

    if (!request) return res.status(404).json({ message: "Solicitud no encontrada" });
    if (token && request.acceptanceToken && request.acceptanceToken !== token) {
      return res.status(403).json({ message: "Token inválido" });
    }

    // Return only public-safe fields
    const { acceptanceToken: _tok, internalNotes: _notes, ...publicFields } = request;
    res.json({ request: publicFields });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PATCH /:requestId/accept — client confirms the quote ─────────────────────
router.patch("/:requestId/accept", async (req, res) => {
  try {
    const { token } = req.body;
    const updated = await acceptQuoteRequest(req.params.requestId, token);

    // Send emails (fire-and-forget)
    const operatorInbox = getOperatorInbox();
    if (isMailConfigured()) {
      // Email to CLIENT
      if (updated.contactEmail) {
        sendMail({
          to: updated.contactEmail,
          subject: `✅ [${updated.trackingCode}] Confirmación recibida — DropIt Service`,
          html: quoteAcceptedClientEmailHtml(updated),
        }).catch(err => console.error("[accept-mail/client] FALLO", err.message));
      }
      // Email to OPERATOR/SUPERADMIN
      if (operatorInbox) {
        sendMail({
          to: operatorInbox,
          subject: `[${updated.trackingCode}] ✅ ACEPTADO — ${updated.customerName} confirmó la cotización`,
          html: quoteAcceptedAdminEmailHtml(updated),
        }).catch(err => console.error("[accept-mail/admin] FALLO", err.message));
      }
    }

    res.json({ ok: true, request: updated, ...(await buildDashboardPayload()) });
  } catch (err) {
    const status = err.message.includes("no encontrada") ? 404
                 : err.message.includes("inválido") ? 403 : 400;
    res.status(status).json({ message: err.message });
  }
});

// ─── DELETE /:requestId — permanently remove a quote request ─────────────────
router.delete("/:requestId", async (req, res) => {
  try {
    if (HAS_DB) {
      const request = await db.findRequest(req.params.requestId);
      if (!request) return res.status(404).json({ ok: false, message: "No encontrado" });
      await db.deleteRequest(req.params.requestId);
      return res.json({ ok: true, message: "Eliminada" });
    }

    const idx = store.requests.findIndex(r => r.id === req.params.requestId);
    if (idx === -1) return res.status(404).json({ ok: false, message: "No encontrado" });
    store.requests.splice(idx, 1);
    saveStore();
    res.json({ ok: true, message: "Eliminada" });
  } catch (err) {
    console.error("[quote-requests/delete] error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── PATCH /:requestId/accept-manual — admin marks as accepted manually ───────
router.patch("/:requestId/accept-manual", async (req, res) => {
  try {
    const updated = await acceptQuoteRequest(req.params.requestId, null); // no token check

    const operatorInbox = getOperatorInbox();
    if (isMailConfigured()) {
      if (updated.contactEmail) {
        sendMail({
          to: updated.contactEmail,
          subject: `✅ [${updated.trackingCode}] Confirmación registrada — DropIt Service`,
          html: quoteAcceptedClientEmailHtml(updated),
        }).catch(err => console.error("[accept-manual-mail/client] FALLO", err.message));
      }
      if (operatorInbox) {
        sendMail({
          to: operatorInbox,
          subject: `[${updated.trackingCode}] ✅ ACEPTADO manualmente — ${updated.customerName}`,
          html: quoteAcceptedAdminEmailHtml(updated),
        }).catch(err => console.error("[accept-manual-mail/admin] FALLO", err.message));
      }
    }

    res.json({ ok: true, request: updated, ...(await buildDashboardPayload()) });
  } catch (err) {
    const status = err.message.includes("no encontrada") ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
});

export default router;
