import { incidentStatus, store } from "../data/store.js";

function countByStatus(status) {
  return store.requests.filter((request) => request.status === status).length;
}

export function buildDashboardPayload() {
  return {
    dashboard: {
      stats: {
        pendingQuotes: countByStatus("Pendiente de cotizacion"),
        quoted: countByStatus("Cotizado"),
        scheduled: countByStatus("Agendado"),
        onRoute: countByStatus("En ruta"),
        delivered: countByStatus("Entregado"),
        incidents: store.requests.filter((request) => request.status === incidentStatus || request.hasIncident).length,
        activeRoutes: store.routes.filter((route) => route.status === "En ruta").length,
        trucksAvailable: store.trucks.filter((truck) => truck.status === "Disponible").length,
        trucksOnRoute: store.trucks.filter((truck) => truck.status === "En ruta").length,
      },
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
    requests: store.requests,
    trucks: store.trucks,
    routes: store.routes,
    notifications: store.notifications.slice(0, 12),
  };
}
