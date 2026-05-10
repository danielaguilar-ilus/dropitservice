import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  Menu,
  MessageSquare,
  Moon,
  Navigation,
  Route,
  ScrollText,
  Settings,
  Sun,
  Truck,
  UserCog,
  Users,
  Package,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    id: "rutas",
    label: "Rutas",
    icon: Route,
    children: [
      { id: "planning", label: "Planificación de rutas", icon: Navigation },
      { id: "import", label: "Carga masiva", icon: FileSpreadsheet },
      { id: "quotes", label: "Cotizaciones", icon: Package },
    ],
  },
  {
    id: "seguimiento",
    label: "Seguimiento",
    icon: Map,
    children: [
      { id: "seg-vehiculos", label: "Vehículos", icon: Truck },
      { id: "seg-visitas", label: "Visitas", icon: Activity },
      { id: "seg-eventos", label: "Eventos", icon: Bell },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart3,
    module: "reportes",
  },
  {
    id: "conductores",
    label: "Conductores",
    icon: UserCog,
    module: "conductores",
    roles: ["super_admin", "admin", "conductor"],
  },
  {
    id: "fleet",
    label: "Vehículos",
    icon: Truck,
    module: "fleet",
  },
  {
    id: "comunicaciones",
    label: "Comunicaciones",
    icon: MessageSquare,
    children: [
      { id: "com-email", label: "Email", icon: Mail },
      { id: "com-whatsapp", label: "WhatsApp", icon: MessageSquare },
      { id: "com-config", label: "Config. correo", icon: Settings },
      { id: "com-whatsapp-config", label: "Config. WhatsApp", icon: MessageSquare, roles: ["super_admin"] },
      { id: "com-log", label: "Log de mensajes", icon: ScrollText },
    ],
  },
];

const BOTTOM_ITEMS = [
  { id: "contenido", label: "Marketing", icon: Image, module: "contenido", roles: ["super_admin", "admin"] },
  { id: "settings", label: "Ajustes", icon: Settings, module: "settings" },
];

// ─── Shared sidebar content ───────────────────────────────────────────────────
function SidebarContent({ user, activeModule, onChangeModule, onLogout, dark, onToggleDark, onClose }) {
  const [openGroups, setOpenGroups] = useState({ rutas: true, seguimiento: false });

  function toggleGroup(id) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isGroupActive(group) {
    if (group.module) return activeModule === group.module;
    return group.children?.some((c) => c.id === activeModule);
  }

  function navigate(id) {
    onChangeModule(id);
    onClose?.();
  }

  const userRole = user?.role || "";

  const roleLabel = {
    super_admin: "Super Admin",
    admin: "Administrador",
    conductor: "Conductor",
    lector: "Lector",
  }[userRole] || userRole;

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-dropit-accent shadow-lg shadow-dropit-accent/30">
          <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-dropit-accent">DropIt</p>
          <p className="text-xs text-white/50">Panel operativo</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_GROUPS.map((item) => {
          if (item.roles && !item.roles.includes(userRole)) return null;

          const Icon = item.icon;
          const groupActive = isGroupActive(item);

          if (item.module) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.module)}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all ${
                  groupActive
                    ? "bg-dropit-accent text-white shadow-md shadow-dropit-accent/25"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => toggleGroup(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all ${
                  groupActive ? "text-dropit-accent" : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex flex-1 items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {openGroups[item.id] ? (
                    <ChevronDown size={14} className="flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="flex-shrink-0" />
                  )}
                </span>
              </button>
              {openGroups[item.id] && item.children && (
                <div className="mt-0.5 ml-3 border-l border-white/10 pl-3 space-y-0.5">
                  {item.children
                    .filter((child) => !child.roles || child.roles.includes(userRole))
                    .map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = activeModule === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => navigate(child.id)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-all ${
                            childActive
                              ? "bg-dropit-accent/15 text-dropit-accent"
                              : "text-white/50 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <ChildIcon size={14} className="flex-shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-white/8 px-2 pt-2 pb-1 space-y-0.5">
        <button
          type="button"
          title={dark ? "Modo claro" : "Modo oscuro"}
          onClick={onToggleDark}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium text-white/50 transition hover:bg-white/8 hover:text-white"
        >
          {dark ? <Sun size={17} className="flex-shrink-0" /> : <Moon size={17} className="flex-shrink-0" />}
          <span className="truncate">{dark ? "Modo claro" : "Modo oscuro"}</span>
        </button>

        {BOTTOM_ITEMS.map((item) => {
          if (item.roles && !item.roles.includes(userRole)) return null;
          const Icon = item.icon;
          const active = activeModule === item.module;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.module)}
              className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all ${
                active ? "bg-dropit-accent text-white" : "text-white/50 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* User Section */}
      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent text-xs font-black text-white">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-white/40">{roleLabel}</p>
          </div>
        </div>
        <button
          className="mt-1.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/8 hover:text-white"
          type="button"
          onClick={onLogout}
        >
          <LogOut size={15} className="flex-shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  );
}

// ─── Main Sidebar export ──────────────────────────────────────────────────────
export default function Sidebar({ user, activeModule, onChangeModule, onLogout, dark, onToggleDark }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex h-screen flex-col bg-dropit-950 text-white w-[240px] flex-shrink-0 overflow-hidden">
        <SidebarContent
          user={user}
          activeModule={activeModule}
          onChangeModule={onChangeModule}
          onLogout={onLogout}
          dark={dark}
          onToggleDark={onToggleDark}
        />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 bg-dropit-950 px-4 py-3 shadow-lg">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 overflow-hidden rounded-md bg-dropit-accent">
            <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
          </div>
          <span className="text-sm font-black text-white">
            Drop<span className="text-dropit-accent">It</span>
          </span>
        </div>
        <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-dropit-accent text-xs font-black text-white">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative flex w-[280px] max-w-[85vw] flex-col bg-dropit-950 text-white h-full overflow-y-auto shadow-2xl">
            <SidebarContent
              user={user}
              activeModule={activeModule}
              onChangeModule={onChangeModule}
              onLogout={() => { setMobileOpen(false); onLogout(); }}
              dark={dark}
              onToggleDark={onToggleDark}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
