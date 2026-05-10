import { store } from "../data/store.js";
import { createId } from "../lib/id.js";

const notificationTemplates = {
  quote_received: "Confirmacion de recepcion de solicitud",
  quote_internal: "Nueva solicitud pendiente de cotizacion",
  quote_sent: "Cotizacion enviada al cliente",
  order_scheduled: "Pedido agendado",
  order_preparing: "Pedido en preparacion",
  order_on_route: "Pedido en ruta",
  order_delivered: "Pedido entregado",
  order_incident: "Pedido no conforme / incidencia",
};

export function notify({ type, to, requestId, payload = {} }) {
  const notification = {
    id: createId("not"),
    type,
    title: notificationTemplates[type] || "Notificacion Dropit",
    to,
    requestId,
    payload,
    status: "simulada",
    createdAt: new Date().toISOString(),
  };

  store.notifications.unshift(notification);
  return notification;
}
