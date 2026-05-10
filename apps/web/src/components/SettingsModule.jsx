import {
  ChevronDown,
  Edit2,
  Key,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import DriversModule from "./DriversModule";

const ROLE_CONFIG = {
  super_admin: { label: "Super Admin", color: "bg-red-100 text-red-700 border-red-200" },
  admin: { label: "Administrador", color: "bg-purple-100 text-purple-700 border-purple-200" },
  conductor: { label: "Conductor", color: "bg-blue-100 text-blue-700 border-blue-200" },
  lector: { label: "Lector", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

// Mock users (in prod, from API)
const INITIAL_USERS = [
  { id: "usr-1", name: "Daniel Aguilar", email: "daniel.aguilar@sphs.cl", role: "super_admin", active: true, createdAt: "2026-01-15" },
  { id: "usr-2", name: "Susana Chamorro", email: "susana.chamorro@dropit.cl", role: "conductor", active: true, createdAt: "2026-02-10" },
  { id: "usr-3", name: "Jason Huerta", email: "jason.huerta@dropit.cl", role: "conductor", active: true, createdAt: "2026-03-01" },
  { id: "usr-4", name: "María González", email: "mgonzalez@dropit.cl", role: "admin", active: true, createdAt: "2026-03-15" },
  { id: "usr-5", name: "Carlos Riquelme", email: "criquelme@dropit.cl", role: "lector", active: false, createdAt: "2026-04-01" },
];

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.lector;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Shield size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Create/Edit User Modal ───────────────────────────────────────────────────
function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState(user || { name: "", email: "", role: "lector", active: true });
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio";
    if (!form.email.trim()) e.email = "El email es obligatorio";
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "Email inválido";
    if (!isEdit && !pass) e.pass = "La contraseña es obligatoria";
    if (pass && pass.length < 8) e.pass = "Mínimo 8 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, ...(pass ? { password: pass } : {}) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{isEdit ? "Editar usuario" : "Nuevo usuario"}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Nombre completo" error={errors.name}>
            <input className={inputCls(errors.name)} placeholder="Ej: Juan Pérez" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputCls(errors.email)} type="email" placeholder="usuario@empresa.cl" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Rol" error={errors.role}>
            <select className={inputCls(errors.role)} value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="lector">Lector</option>
              <option value="conductor">Conductor</option>
              <option value="admin">Administrador</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </Field>
          <Field label={isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"} error={errors.pass}>
            <div className="relative">
              <input
                className={`${inputCls(errors.pass)} pr-10`}
                type={showPass ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPass((p) => !p)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <div className="flex items-center gap-3">
            <input id="active-chk" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-dropit-accent"
              checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <label htmlFor="active-chk" className="text-sm text-slate-700">Usuario activo</label>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-1 rounded-lg bg-dropit-accent py-2 text-sm font-bold text-white hover:bg-dropit-accent/90">
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(err) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30 ${
    err ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
  }`;
}

function DriversTabContent() {
  return <DriversModule />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SettingsModule({ currentUser }) {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalUser, setModalUser] = useState(null); // null=closed, {}=new, {id,...}=edit
  const [activeTab, setActiveTab] = useState("usuarios");
  const [toast, setToast] = useState("");

  const isSuperAdmin = currentUser?.role === "super_admin";

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function handleSave(data) {
    if (data.id) {
      setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
      showToast("Usuario actualizado correctamente");
    } else {
      setUsers((prev) => [...prev, { ...data, id: `usr-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) }]);
      showToast("Usuario creado correctamente");
    }
    setModalUser(null);
  }

  function handleDelete(id) {
    if (!confirm("¿Eliminar este usuario?")) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showToast("Usuario eliminado");
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
        <Shield size={32} className="mb-3 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">Acceso restringido</p>
        <p className="text-xs text-slate-400 mt-1">Solo el Super Admin puede gestionar usuarios</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700">{toast}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Administración</p>
          <h2 className="text-2xl font-black text-slate-800">Ajustes</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[{ id: "usuarios", label: "Usuarios" }, { id: "conductores", label: "Conductores" }, { id: "empresa", label: "Empresa" }, { id: "notificaciones", label: "Notificaciones" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? "border-dropit-accent text-dropit-accent" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "usuarios" && (
        <div className="space-y-4">
          {/* Filters + Create */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none"
              value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">Todos los roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Administrador</option>
              <option value="conductor">Conductor</option>
              <option value="lector">Lector</option>
            </select>
            <button onClick={() => setModalUser({})}
              className="flex items-center gap-2 rounded-lg bg-dropit-accent px-4 py-2 text-sm font-bold text-white hover:bg-dropit-accent/90">
              <Plus size={16} />
              Nuevo usuario
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Creado</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dropit-accent text-xs font-bold text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.createdAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Editar" onClick={() => setModalUser(u)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Edit2 size={15} />
                        </button>
                        <button title="Cambiar contraseña" onClick={() => setModalUser({ ...u, _changePass: true })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Key size={15} />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button title="Eliminar" onClick={() => handleDelete(u.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">No se encontraron usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">{filtered.length} usuario{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {activeTab === "conductores" && (
        <DriversTabContent />
      )}

      {activeTab === "empresa" && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <p className="text-sm text-slate-400">Configuración de empresa — próximamente</p>
        </div>
      )}

      {activeTab === "notificaciones" && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <p className="text-sm text-slate-400">Configuración de notificaciones — próximamente</p>
        </div>
      )}

      {modalUser !== null && (
        <UserModal user={modalUser} onClose={() => setModalUser(null)} onSave={handleSave} />
      )}
    </div>
  );
}
