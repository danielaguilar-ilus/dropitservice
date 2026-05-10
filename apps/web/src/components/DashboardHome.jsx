import {
  Clock,
  TrendingUp,
  Calendar,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Route,
  Truck,
  AlertCircle,
} from "lucide-react";
import StatusBadge from "./StatusBadge";

const statLabels = [
  { key: "pendingQuotes", label: "Pendientes", icon: Clock, color: "warning" },
  { key: "quoted", label: "Cotizados", icon: FileText, color: "info" },
  { key: "scheduled", label: "Agendados", icon: Calendar, color: "info" },
  { key: "onRoute", label: "En ruta", icon: Navigation, color: "accent" },
  { key: "delivered", label: "Entregados", icon: CheckCircle2, color: "success" },
  { key: "incidents", label: "Incidencias", icon: AlertTriangle, color: "error" },
  { key: "activeRoutes", label: "Rutas activas", icon: Route, color: "info" },
  { key: "trucksAvailable", label: "Disponibles", icon: Truck, color: "success" },
];

function StatCard({ icon: Icon, label, value, color = "info" }) {
  const bgColor = {
    warning: "bg-dropit-warning/10 text-dropit-warning",
    info: "bg-blue-50 text-blue-600",
    accent: "bg-dropit-accent/10 text-dropit-accent",
    success: "bg-green-50 text-green-600",
    error: "bg-dropit-error/10 text-dropit-error",
  };

  return (
    <article className="surface p-5 transition-all hover:shadow-lg">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor[color]}`}>
        <Icon size={20} />
      </div>
      <p className="mt-3 text-sm font-medium text-dropit-700">{label}</p>
      <p className="mt-1 text-3xl font-bold text-dropit-950">{value || 0}</p>
    </article>
  );
}

export default function DashboardHome({ dashboard, requests, routes, notifications }) {
  const recentRequests = requests.slice(0, 6);

  return (
    <section className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statLabels.map(({ key, label, icon, color }) => (
          <StatCard
            key={key}
            icon={icon}
            label={label}
            value={dashboard.stats[key]}
            color={color}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Recent Requests Table */}
        <article className="surface overflow-hidden">
          <div className="border-b border-dropit-300 px-5 py-4">
            <h3 className="text-lg font-bold text-dropit-950">Pedidos recientes</h3>
            <p className="mt-1 text-sm text-dropit-700">
              {recentRequests.length} de {requests.length} total
            </p>
          </div>
          <div className="overflow-x-auto">
            {recentRequests.length === 0 ? (
              <div className="empty-state mx-6 my-12">
                <AlertCircle className="empty-state-icon" size={32} />
                <p className="empty-state-title">Sin pedidos</p>
                <p className="empty-state-description">
                  Los nuevos pedidos aparecerán aquí
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-dropit-200">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Destino</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dropit-100">
                  {recentRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-dropit-100/30"
                    >
                      <td className="px-4 py-3 font-semibold text-dropit-950">
                        {request.id}
                      </td>
                      <td className="px-4 py-3 text-dropit-800">
                        {request.customerName}
                      </td>
                      <td className="px-4 py-3 text-dropit-700">
                        {request.destinationCity}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={request.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>

        {/* Notifications Sidebar */}
        <article className="surface p-5">
          <h3 className="text-lg font-bold text-dropit-950">Actividad reciente</h3>
          <div className="mt-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="rounded-md border-2 border-dashed border-dropit-400 bg-dropit-200/20 p-4">
                <p className="text-sm text-dropit-700">
                  Sin notificaciones en las últimas horas
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-md border border-dropit-300 bg-dropit-100/30 p-3 transition-colors hover:bg-dropit-100/50"
                >
                  <p className="text-sm font-semibold text-dropit-950">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-xs text-dropit-700">
                    {notification.to}
                  </p>
                  <p className="mt-1 text-xs font-medium text-dropit-accent">
                    {notification.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      {/* Active Routes Section */}
      <article className="surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-dropit-950">Rutas activas</h3>
          <span className="text-sm font-medium text-dropit-700">
            {routes.length} ruta{routes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {routes.length === 0 ? (
          <div className="empty-state">
            <Route className="empty-state-icon" size={32} />
            <p className="empty-state-title">Sin rutas activas</p>
            <p className="empty-state-description">
              Las nuevas rutas planificadas aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {routes.map((route) => (
              <div
                key={route.id}
                className="rounded-lg border border-dropit-300 bg-dropit-100/30 p-4 transition-all hover:border-dropit-accent/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-dropit-950">{route.name}</p>
                    <p className="mt-1 text-sm text-dropit-700">
                      {route.truckName}
                    </p>
                    <p className="text-xs text-dropit-600">{route.driverName}</p>
                  </div>
                  <StatusBadge status={route.status} size="sm" />
                </div>
                <div className="mt-3 flex gap-2 border-t border-dropit-300 pt-3 text-xs text-dropit-700">
                  <span>{route.requestIds?.length || 0} entregas</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

// Helper component for icons
function FileText({ size = 24 }) {
  return <TrendingUp size={size} />;
}
