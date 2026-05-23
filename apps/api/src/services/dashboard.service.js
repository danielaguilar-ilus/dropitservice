import { incidentStatus, store } from "../data/store.js";
import * as db from "../data/db.js";

const HAS_DB = !!process.env.DATABASE_URL;

function statsFromArrays(requests, trucks, routes) {
  const countByStatus = (status) => requests.filter((r) => r.status === status).length;
  return {
    pendingQuotes:   countByStatus("Pendiente de cotizacion"),
    quoted:          countByStatus("Cotizado"),
    scheduled:       countByStatus("Agendado"),
    onRoute:         countByStatus("En ruta"),
    delivered:       countByStatus("Entregado"),
    incidents:       requests.filter((r) => r.status === incidentStatus || r.hasIncident).length,
    activeRoutes:    routes.filter((r) => r.status === "En ruta").length,
    trucksAvailable: trucks.filter((t) => t.status === "Disponible").length,
    trucksOnRoute:   trucks.filter((t) => t.status === "En ruta").length,
  };
}

export async function buildDashboardPayload() {
  let requests;
  let trucks;
  let routes;
  let notifications;

  if (HAS_DB) {
    requests      = await db.listRequests();
    trucks        = await db.listTrucks();
    routes        = await db.listRoutes();
    const notifs  = await db.listNotifications(12);
    notifications = notifs.map((n) => ({
      id:        n.id,
      type:      n.type,
      title:     n.title,
      to:        n.to_address,
      requestId: n.request_id,
      payload:   n.payload,
      status:    n.status,
      createdAt: n.created_at ? n.created_at.toISOString() : null,
    }));
  } else {
    requests      = store.requests;
    trucks        = store.trucks;
    routes        = store.routes;
    notifications = store.notifications.slice(0, 12);
  }

  return {
    dashboard: {
      stats: statsFromArrays(requests, trucks, routes),
      workflow: [
        "Pendiente de cotizacion",
        "Cotizado",
        "Aceptado por cliente",
        "Agendado",
        "Asignado a camion / chofer",
        "En preparacion",
        "En ruta",
        "Entregado",
      ],
    },
    requests,
    trucks,
    routes,
    notifications,
  };
}
