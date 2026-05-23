import { store } from "../data/store.js";
import * as db from "../data/db.js";
import { createId } from "../lib/id.js";

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

export async function notify({ type, to, requestId, payload = {} }) {
  const id = createId("not");
  const notification = {
    id,
    type,
    title: notificationTemplates[type] || "Notificacion Dropit",
    to,
    requestId,
    payload,
    status: "simulada",
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
