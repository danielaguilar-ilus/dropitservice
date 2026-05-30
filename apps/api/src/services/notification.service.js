import { store } from "../data/store.js";
import * as db from "../data/db.js";
import { createId } from "../lib/id.js";
import { isMailConfigured } from "./mail.service.js";

const HAS_DB = !!process.env.DATABASE_URL;

const notificationTemplates = {
  quote_received: "Confirmacion de recepcion de solicitud",
  quote_internal: "Nueva solicitud pendiente de cotizacion",
  quote_sent: "Cotizacion enviada al cliente",
  quote_accepted: "Cotizacion aceptada por el cliente",
  order_scheduled: "Pedido agendado",
  order_preparing: "Pedido en preparacion",
  order_on_route: "Pedido en ruta",
  order_delivered: "Pedido entregado",
  order_incident: "Pedido no conforme / incidencia",
};

// status real de la notificación:
//   - "sent"      → hay proveedor de correo y el envío se despachó
//   - "failed"    → el caller informó que el envío falló
//   - "simulated" → no hay proveedor configurado (solo se registra, no se envía)
// El caller puede forzar el status (p.ej. "failed") vía el parámetro `status`.
export async function notify({ type, to, requestId, payload = {}, status } = {}) {
  const id = createId("not");
  const resolvedStatus = status || (isMailConfigured() ? "sent" : "simulated");
  const notification = {
    id,
    type,
    title: notificationTemplates[type] || "Notificacion Dropit",
    to,
    requestId,
    payload,
    status: resolvedStatus,
    createdAt: new Date().toISOString(),
  };

  if (HAS_DB) {
    try {
      await db.createNotification(notification);
    } catch (err) {
      // Si falla por FK (requestId no existe todavía en DB), persistimos sin requestId.
      console.warn("[notify] no se pudo crear notification en DB:", err.message);
      try {
        await db.createNotification({ ...notification, requestId: null });
      } catch (err2) {
        console.warn("[notify] retry sin requestId también falló:", err2.message);
      }
    }
  } else {
    store.notifications.unshift(notification);
  }

  return notification;
}
