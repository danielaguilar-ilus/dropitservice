import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Key,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { api } from "../lib/api";

// ─── Password helpers ─────────────────────────────────────────────────────────

// Genera una contraseña fuerte usando crypto (sin caracteres ambiguos: l, I, O, 0, 1)
function generateStrongPassword(length = 16) {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums  = "23456789";
  const syms  = "!@#$%&*?-_+";
  const all   = lower + upper + nums + syms;

  const pick = (set) => set[randomInt(set.length)];
  // Garantiza al menos uno de cada categoría
  const chars = [pick(lower), pick(upper), pick(nums), pick(syms)];
  for (let i = chars.length; i < length; i++) chars.push(pick(all));

  // Fisher-Yates shuffle con aleatoriedad criptográfica
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function randomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

// Devuelve { score 0-4, label, color, bar } para el medidor de fortaleza
function passwordStrength(pwd) {
  if (!pwd) return { score: 0, label: "", color: "", pct: 0 };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  const clamped = Math.min(4, score);
  const levels = [
    { label: "Muy débil", color: "bg-red-500",    text: "text-red-600",    pct: 20 },
    { label: "Débil",     color: "bg-orange-500", text: "text-orange-600", pct: 40 },
    { label: "Aceptable", color: "bg-amber-500",  text: "text-amber-600",  pct: 60 },
    { label: "Fuerte",    color: "bg-lime-500",   text: "text-lime-600",   pct: 80 },
    { label: "Excelente", color: "bg-emerald-500",text: "text-emerald-600",pct: 100 },
  ];
  return { score: clamped, ...levels[clamped] };
}

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "admin",       label: "Administrador", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "operator",    label: "Operador", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "conductor",   label: "Conductor", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "lector",      label: "Lector", color: "bg-slate-100 text-slate-600 border-slate-200" },
];

function roleConfig(role) {
  return ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[ROLE_OPTIONS.length - 1];
}

function RoleBadge({ role }) {
  const cfg = roleConfig(role);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Shield size={10} />
      {cfg.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function inputCls(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-dropit-accent/30"
  }`;
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── PasswordField — input seguro con ojo, generar, copiar y medidor ─────────
// autoComplete="new-password" activa el sugeridor nativo de Chrome/Google.
function PasswordField({
  label,
  value,
  onChange,
  error,
  placeholder = "Mínimo 6 caracteres",
  showStrength = true,
  autoFocus = false,
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied]   = useState(false);
  const strength = passwordStrength(value);

  function handleGenerate() {
    const pwd = generateStrongPassword(16);
    onChange(pwd);
    setVisible(true); // mostrar para que el operador la vea/copie
  }

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard puede estar bloqueado — ignorar silenciosamente */
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          onClick={handleGenerate}
          className="inline-flex items-center gap-1 rounded-md bg-dropit-accent/10 px-2 py-0.5 text-[11px] font-bold text-dropit-accent hover:bg-dropit-accent/20"
        >
          <Sparkles size={11} /> Generar segura
        </button>
      </div>
      <div className="relative">
        <input
          className={`w-full rounded-lg border px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-2 ${
            error ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-dropit-accent/30"
          }`}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {copied ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            title={visible ? "Ocultar" : "Mostrar"}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {showStrength && value && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
              style={{ width: `${strength.pct}%` }}
            />
          </div>
          <p className={`mt-1 text-[11px] font-semibold ${strength.text}`}>
            Seguridad: {strength.label}
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Modal: Create / Edit ────────────────────────────────────────────────────

function UserModal({ user, onClose, onSubmit }) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState(
    user
      ? { name: user.name || "", email: user.email || "", role: user.role || "operator", isActive: user.isActive !== false }
      : { name: "", email: "", role: "operator", isActive: true },
  );
  const [password, setPassword] = useState("");
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [apiError, setApiErr] = useState("");

  function validate() {
    const e = {};
    if (!isEdit) {
      if (!form.email.trim()) e.email = "El email es obligatorio";
      else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "Email inválido";
      if (!password) e.password = "La contraseña es obligatoria";
      else if (password.length < 6) e.password = "Mínimo 6 caracteres";
    } else if (form.email && !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) {
      e.email = "Email inválido";
    }
    if (!form.name.trim()) e.name = "El nombre es obligatorio";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiErr("");
    try {
      if (isEdit) {
        await onSubmit({ id: user.id, name: form.name, role: form.role, isActive: form.isActive });
      } else {
        await onSubmit({ email: form.email, name: form.name, role: form.role, password });
      }
      onClose();
    } catch (err) {
      setApiErr(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
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

        <div className="space-y-4 p-5">
          <Field label="Nombre completo" error={errors.name}>
            <input
              className={inputCls(errors.name)}
              placeholder="Ej: Juan Pérez"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              className={inputCls(errors.email)}
              type="email"
              disabled={isEdit}
              placeholder="usuario@dominio.cl"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {isEdit && <p className="mt-1 text-[11px] text-slate-400">El email no se puede editar.</p>}
          </Field>

          <Field label="Rol">
            <select
              className={inputCls(false)}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          {!isEdit && (
            <>
              {/* username oculto: ayuda a Chrome a asociar la contraseña al usuario */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={form.email}
                readOnly
                hidden
              />
              <PasswordField
                label="Contraseña inicial"
                value={password}
                onChange={setPassword}
                error={errors.password}
              />
              <p className="-mt-2 text-[11px] text-slate-400">El usuario podrá cambiarla luego del primer login.</p>
            </>
          )}

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-dropit-accent focus:ring-dropit-accent/30"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Usuario activo
            </label>
          )}

          {apiError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{apiError}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-dropit-accent px-5 py-2 text-sm font-bold text-white hover:bg-dropit-accent-dark disabled:opacity-60"
          >
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Reset password ───────────────────────────────────────────────────

function PasswordModal({ user, onClose, onSubmit }) {
  const [pwd, setPwd]       = useState("");
  const [pwd2, setPwd2]     = useState("");
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);

  const matches    = pwd.length > 0 && pwd === pwd2;
  const longEnough = pwd.length >= 6;
  const canSubmit  = matches && longEnough && !saving;

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!longEnough) return setError("La contraseña debe tener al menos 6 caracteres");
    if (!matches)    return setError("Las contraseñas no coinciden");
    setSaving(true);
    setError("");
    try {
      await onSubmit(pwd);
      setDone(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || "Error al cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Key size={16} />
            </span>
            <h3 className="text-base font-bold text-slate-800">Cambiar contraseña</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={30} />
            </span>
            <p className="text-sm font-semibold text-slate-700">Contraseña actualizada correctamente</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-5">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Usuario: <strong className="text-slate-800">{user.name}</strong>
                <br />
                <span className="text-xs text-slate-500">{user.email}</span>
              </p>

              {/* username oculto: Chrome asocia la nueva contraseña al usuario */}
              <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />

              <PasswordField
                label="Nueva contraseña"
                value={pwd}
                onChange={(v) => { setPwd(v); setError(""); }}
                autoFocus
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      pwd2 && !matches
                        ? "border-red-300 focus:ring-red-200"
                        : pwd2 && matches
                          ? "border-emerald-300 focus:ring-emerald-200"
                          : "border-slate-200 focus:ring-dropit-accent/30"
                    }`}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    value={pwd2}
                    onChange={(e) => { setPwd2(e.target.value); setError(""); }}
                  />
                  {pwd2 && matches && (
                    <CheckCircle2 size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                {pwd2 && !matches && <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden</p>}
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-dropit-accent px-5 py-2 text-sm font-bold text-white hover:bg-dropit-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                {saving ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// ─── Main module ─────────────────────────────────────────────────────────────

export default function UsersModule({ currentUser }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [modalUser, setModalUser]       = useState(null); // null | {} (new) | user obj (edit)
  const [pwdUser, setPwdUser]           = useState(null);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [toast, setToast]               = useState("");

  const isSuper = currentUser?.role === "super_admin";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { users } = await api.listUsers();
      setUsers(users || []);
    } catch (err) {
      setError(err.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSuper) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.name || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleCreate(payload) {
    await api.createUser(payload);
    await load();
    flashToast("Usuario creado");
  }

  async function handleUpdate(payload) {
    const { id, ...rest } = payload;
    await api.updateUser(id, rest);
    await load();
    flashToast("Usuario actualizado");
  }

  async function handleChangePwd(newPassword) {
    await api.changePassword(pwdUser.id, newPassword);
    flashToast("Contraseña cambiada");
  }

  async function handleDeactivate() {
    try {
      await api.deactivateUser(confirmDel.id);
      setConfirmDel(null);
      await load();
      flashToast("Usuario desactivado");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isSuper) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <Shield size={32} className="mx-auto mb-3 text-amber-500" />
        <h2 className="text-lg font-bold text-amber-800">Acceso restringido</h2>
        <p className="mt-2 text-sm text-amber-700">
          Sólo los super administradores pueden gestionar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestiona accesos, roles y contraseñas de tu equipo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refrescar
          </button>
          <button
            onClick={() => setModalUser({})}
            className="inline-flex items-center gap-2 rounded-lg bg-dropit-accent px-4 py-2 text-sm font-bold text-white shadow hover:bg-dropit-accent-dark"
          >
            <Plus size={16} /> Crear usuario
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
          placeholder="Buscar por nombre, email o rol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Última actualización</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Cargando usuarios...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay usuarios para mostrar</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dropit-accent/10 text-dropit-accent">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{u.name || "(sin nombre)"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={10} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(u.updatedAt || u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModalUser(u)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setPwdUser(u)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-amber-100 hover:text-amber-700"
                        title="Cambiar contraseña"
                      >
                        <Key size={14} />
                      </button>
                      {u.isActive && u.id !== currentUser?.id && (
                        <button
                          onClick={() => setConfirmDel(u)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-100 hover:text-red-700"
                          title="Desactivar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modalUser !== null && (
        <UserModal
          user={modalUser.id ? modalUser : null}
          onClose={() => setModalUser(null)}
          onSubmit={modalUser.id ? handleUpdate : handleCreate}
        />
      )}
      {pwdUser && (
        <PasswordModal
          user={pwdUser}
          onClose={() => setPwdUser(null)}
          onSubmit={handleChangePwd}
        />
      )}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800">¿Desactivar usuario?</h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong>{confirmDel.name}</strong> ({confirmDel.email}) no podrá volver a iniciar sesión.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button onClick={handleDeactivate} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Desactivar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 shadow-2xl">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">{toast}</span>
        </div>
      )}
    </div>
  );
}
