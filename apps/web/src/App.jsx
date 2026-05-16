import { Component, useEffect, useMemo, useState } from "react";
import AdminQuotesModule from "./components/AdminQuotesModule";
import MessageLogModule from "./components/MessageLogModule";
import MailConfigModule from "./components/MailConfigModule";
import WhatsAppConfigModule from "./components/WhatsAppConfigModule";
import BulkImportModule from "./components/BulkImportModule";
import ComunicacionesModule from "./components/ComunicacionesModule";
import CustomerQuoteForm from "./components/CustomerQuoteForm";
import DashboardHome from "./components/DashboardHome";
import ContentModule from "./components/ContentModule";
import DriversModule from "./components/DriversModule";
import DriversRouteView from "./components/DriversRouteView";
import FleetModule from "./components/FleetModule";
import LoginScreen from "./components/LoginScreen";
import ReportesModule from "./components/ReportesModule";
import RoutePlanningModule from "./components/RoutePlanningModule";
import SeguimientoModule from "./components/SeguimientoModule";
import SettingsModule from "./components/SettingsModule";
import Sidebar from "./components/Sidebar";
import TrackingModule from "./components/TrackingModule";
import { api } from "./lib/api";
import useAutoReminders from "./lib/useAutoReminders";

const initialCredentials = { email: "", password: "" };

// Error boundary to prevent white-screen crashes
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-lg text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="text-lg font-bold text-slate-900">Algo salió mal</h2>
            <p className="mt-2 text-sm text-slate-500">{this.state.error?.message || "Error inesperado"}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="mt-4 rounded-lg bg-dropit-accent px-6 py-2 text-sm font-bold text-white hover:bg-dropit-accent-dark">
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [requests, setRequests] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("dropit-dark") === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dropit-dark", dark);
  }, [dark]);

  function applyBootstrap(payload) {
    setDashboard(payload.dashboard);
    setRequests(payload.requests || payload.orders || []);
    setTrucks(payload.trucks || []);
    setRoutes(payload.routes || []);
    setNotifications(payload.notifications || []);
  }

  async function loadBootstrap() {
    applyBootstrap(await api.getBootstrap());
  }

  useEffect(() => {
    if (session) {
      loadBootstrap().catch(() => undefined);
    }
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoadingLogin(true);
    setLoginError("");
    try {
      setSession(await api.login(credentials));
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleCreateRequest(payload) {
    const result = await api.createQuoteRequest(payload);
    applyBootstrap(result);
    return result.request;
  }

  async function handleSendQuote(requestId, payload) {
    const result = await api.sendQuote(requestId, payload);
    applyBootstrap(result);
    return result.request;
  }

  async function handleImport(rows) {
    const result = await api.importOrders(rows);
    applyBootstrap(result);
    return result;
  }

  async function handleCreateRoute(payload) {
    const result = await api.createRoutePlan(payload);
    applyBootstrap(result);
    return result.route;
  }

  async function handleCreateTruck(payload) {
    const result = await api.createTruck(payload);
    setTrucks(result.trucks);
    await loadBootstrap();
  }

  async function handleSearchTracking(code) {
    const result = await api.getTracking(code);
    return result.tracking;
  }

  const moduleView = useMemo(() => {
    if (!dashboard) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-dropit-accent/20 border-t-dropit-accent" />
            <p className="text-sm text-slate-500">Cargando información operacional...</p>
          </div>
        </div>
      );
    }

    switch (activeModule) {
      case "request":
        return <CustomerQuoteForm onCreate={handleCreateRequest} />;
      case "quotes":
        return <AdminQuotesModule requests={requests} onSendQuote={handleSendQuote} />;
      case "import":
        return <BulkImportModule onImport={handleImport} />;
      case "planning":
        return (
          <RoutePlanningModule
            requests={requests}
            trucks={trucks}
            routes={routes}
            onCreateRoute={handleCreateRoute}
          />
        );
      case "fleet":
        return <FleetModule trucks={trucks} onCreateTruck={handleCreateTruck} />;
      case "tracking":
        return <TrackingModule onSearchTracking={handleSearchTracking} />;
      case "seg-vehiculos":
        return <SeguimientoModule initialTab="vehiculos" requests={requests} trucks={trucks} routes={routes} />;
      case "seg-visitas":
        return <SeguimientoModule initialTab="visitas" requests={requests} trucks={trucks} routes={routes} />;
      case "seg-eventos":
        return <SeguimientoModule initialTab="eventos" requests={requests} trucks={trucks} routes={routes} />;
      case "reportes":
        return <ReportesModule requests={requests} routes={routes} />;
      case "settings":
        return <SettingsModule currentUser={session?.user} />;
      case "com-email":
        return <ComunicacionesModule currentUser={session?.user} />;
      case "com-whatsapp":
        return <ComunicacionesModule currentUser={session?.user} />;
      case "com-config":
        return <MailConfigModule currentUser={session?.user} />;
      case "com-whatsapp-config":
        return <WhatsAppConfigModule currentUser={session?.user} />;
      case "com-log":
        return <MessageLogModule />;
      case "conductores":
        return <DriversRouteView currentUser={session?.user} routes={routes} requests={requests} trucks={trucks} />;
      case "contenido":
        return <ContentModule />;
      default:
        return (
          <DashboardHome
            dashboard={dashboard}
            requests={requests}
            routes={routes}
            notifications={notifications}
          />
        );
    }
  }, [activeModule, dashboard, notifications, requests, routes, trucks, session]);

  // ── Global auto-reminders — must be before any conditional return (Rules of Hooks) ──
  const { toast: reminderToast, clearToast } = useAutoReminders(requests);

  const isSeguimiento = activeModule.startsWith("seg-");

  if (!session) {
    return (
      <LoginScreen
        credentials={credentials}
        onChange={(field, value) => setCredentials((current) => ({ ...current, [field]: value }))}
        onSubmit={handleLogin}
        error={loginError}
        loading={loadingLogin}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">

      {/* ── Global WA reminder toast ── */}
      {reminderToast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-2xl animate-in slide-in-from-bottom-4">
          <span className="text-xl leading-none">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Recordatorio automático WA</p>
            <p className="text-sm font-semibold text-emerald-800">{reminderToast.text}</p>
          </div>
          <button onClick={clearToast} className="text-emerald-500 hover:text-emerald-700 flex-shrink-0 mt-0.5">✕</button>
        </div>
      )}
      <Sidebar
        user={session.user}
        activeModule={activeModule}
        onChangeModule={setActiveModule}
        onLogout={() => {
          setSession(null);
          setActiveModule("dashboard");
        }}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {isSeguimiento ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Full-screen header */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white dark:bg-slate-800 px-5 py-3 shadow-sm">
              <img src="/dropit-logo.jpeg" alt="DropIt" className="h-9 w-9 rounded-xl object-cover shadow-md shadow-dropit-accent/30" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dropit-accent">DropIt</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Módulo de Seguimiento</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <img
                  src="/dropit-mascot.jpg"
                  alt="DropIt mascot"
                  className="hidden h-14 w-auto md:block"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <button
                  onClick={() => setActiveModule("dashboard")}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  ← Volver al panel
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {moduleView}
            </div>
          </div>
        ) : (
          <div className="p-4 pt-16 lg:pt-6 md:p-6">
            {moduleView}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
