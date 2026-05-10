import {
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  Mail,
  Phone,
  Save,
  Send,
  Server,
  Settings,
  Upload,
  User,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { tplPrueba, getLogoUrl, getCompanyName } from "../lib/emailTemplates";

const SMTP_KEY = "dropit-smtp-config";
const CLIENT_KEY = "dropit-client-config";

function loadStorage(key, defaults) {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || "{}") }; }
  catch { return { ...defaults }; }
}

const SMTP_DEFAULTS = {
  host: "smtp.gmail.com",
  port: "587",
  encryption: "TLS",
  email: "",
  password: "",
  senderName: "DropIt Service",
};

const CLIENT_DEFAULTS = {
  companyName: "DropIt Service",
  replyTo: "",
  cc: "",
  bcc: "",
  trackingUrl: "https://dropit.cl/track/",
  supportPhone: "",
  supportEmail: "soporte@dropit.cl",
  signature: "Equipo DropIt Service\nSoporte: soporte@dropit.cl\nwww.dropit.cl",
  primaryColor: "#F97316",
  logoUrl: "/dropit-logo.jpeg",
};

// ─── Test Email Modal ──────────────────────────────────────────────────────────
function TestEmailModal({ onClose, smtpConfig }) {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    if (!to.includes("@")) return;
    setSending(true);
    try {
      await api.sendEmail({
        to,
        subject: "Correo de prueba — DropIt Service",
        html: tplPrueba({ templateSubject: "Verificación de configuración SMTP", senderName: smtpConfig.senderName, logoUrl: getLogoUrl(), companyName: getCompanyName() }),
        text: "Correo de prueba — DropIt Service. La configuración SMTP está funcionando correctamente.",
      });
      setSending(false);
      setResult({ ok: true, msg: `Correo enviado a ${to} correctamente.` });
      setTimeout(() => onClose(), 3000);
    } catch (err) {
      setSending(false);
      setResult({ ok: false, msg: err.message || "Error al enviar. Verifica la configuración SMTP." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Enviar correo de prueba</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Destinatario</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="tu@email.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              autoFocus
            />
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            <p><span className="font-semibold">Desde:</span> {smtpConfig.senderName || "DropIt Service"} &lt;{smtpConfig.email || "—"}&gt;</p>
            <p className="mt-0.5"><span className="font-semibold">Servidor:</span> {smtpConfig.host || "—"}:{smtpConfig.port || "—"} ({smtpConfig.encryption || "—"})</p>
          </div>
          {result && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"
            }`}>
              <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
              {result.msg}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={send} disabled={sending || !to.includes("@")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-dropit-accent py-2.5 text-sm font-bold text-white hover:bg-dropit-accent/90 disabled:opacity-50">
              {sending ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Enviando...</> : <><Send size={14} />Enviar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SMTP Tab ──────────────────────────────────────────────────────────────────
function SmtpTab() {
  const [cfg, setCfg] = useState(() => loadStorage(SMTP_KEY, SMTP_DEFAULTS));
  const [showPass, setShowPass] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // On mount: push saved localStorage config to backend (covers server restarts)
  useEffect(() => {
    const stored = loadStorage(SMTP_KEY, SMTP_DEFAULTS);
    if (stored.email && stored.password) {
      api.updateSmtpConfig({
        host: stored.host,
        port: stored.port,
        secure: stored.encryption === "SSL",
        user: stored.email,
        pass: stored.password,
        fromName: stored.senderName,
      }).catch(() => {});
    }
  }, []);

  function update(k, v) { setCfg((c) => ({ ...c, [k]: v })); setSaved(false); setTestResult(null); }

  async function save() {
    localStorage.setItem(SMTP_KEY, JSON.stringify(cfg));
    // Sync to backend so all subsequent emails use the new credentials
    try {
      await api.updateSmtpConfig({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.encryption === "SSL",
        user: cfg.email,
        pass: cfg.password,
        fromName: cfg.senderName,
      });
    } catch { /* backend may be down — localStorage still updated */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function testConn() {
    setTesting(true); setTestResult(null);
    try {
      const result = await api.testSmtp();
      setTesting(false);
      setTestResult({ ok: true, msg: result.message || `Conexión exitosa con ${cfg.host}:${cfg.port}` });
    } catch (err) {
      setTesting(false);
      setTestResult({ ok: false, msg: err.message || "No se pudo conectar al servidor SMTP." });
    }
  }

  return (
    <>
      {showTestModal && <TestEmailModal onClose={() => setShowTestModal(false)} smtpConfig={cfg} />}
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Servidor SMTP</label>
            <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="smtp.gmail.com" value={cfg.host} onChange={(e) => update("host", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Puerto y cifrado</label>
            <div className="flex gap-2">
              <input className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="587" value={cfg.port} onChange={(e) => update("port", e.target.value)} />
              <select className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none"
                value={cfg.encryption} onChange={(e) => update("encryption", e.target.value)}>
                <option>TLS</option><option>SSL</option><option>STARTTLS</option><option>Sin cifrado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Correo emisor</label>
            <input type="email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="notificaciones@tuempresa.cl" value={cfg.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Contraseña / App Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                placeholder="••••••••••••" value={cfg.password} onChange={(e) => update("password", e.target.value)} />
              <button type="button" onClick={() => setShowPass((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Nombre del remitente</label>
            <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="DropIt Service" value={cfg.senderName} onChange={(e) => update("senderName", e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700"><Info size={13} />Instrucciones para Gmail</div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-600 leading-relaxed">
            <li>Ve a <strong>myaccount.google.com → Seguridad</strong></li>
            <li>Activa la <strong>verificación en dos pasos</strong></li>
            <li>En "Contraseñas de aplicaciones", genera una nueva para "Correo"</li>
            <li>Pega esa clave de 16 caracteres en el campo "Contraseña" de arriba</li>
            <li>Usa <strong>smtp.gmail.com</strong>, puerto <strong>587</strong>, cifrado <strong>TLS</strong></li>
          </ol>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"
          }`}>
            <CheckCircle2 size={15} />{testResult.msg}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={testConn} disabled={testing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {testing ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />Probando...</> : <><Server size={13} />Probar conexión</>}
          </button>
          <button onClick={() => setShowTestModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/40 px-4 py-2 text-sm font-medium text-dropit-accent hover:bg-dropit-accent/5">
            <Mail size={13} />Enviar correo de prueba
          </button>
          <button onClick={save}
            className={`ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              saved ? "bg-emerald-500 text-white" : "bg-dropit-accent text-white hover:bg-dropit-accent/90"
            }`}>
            <Save size={13} />{saved ? "¡Guardado!" : "Guardar configuración"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Client Config Tab ─────────────────────────────────────────────────────────
function ClientTab() {
  const [cfg, setCfg] = useState(() => loadStorage(CLIENT_KEY, CLIENT_DEFAULTS));
  const [saved, setSaved] = useState(false);

  function update(k, v) { setCfg((c) => ({ ...c, [k]: v })); setSaved(false); }

  function save() {
    localStorage.setItem(CLIENT_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Configura cómo se envían y presentan los correos a los clientes finales.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Nombre de la empresa (aparece en todos los correos)</label>
          <div className="relative">
            <Settings size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="DropIt Service" value={cfg.companyName} onChange={(e) => update("companyName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Reply-To (respuestas del cliente)</label>
          <input type="email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="soporte@tuempresa.cl" value={cfg.replyTo} onChange={(e) => update("replyTo", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Email soporte al cliente</label>
          <input type="email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="soporte@dropit.cl" value={cfg.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">CC interno (separado por comas)</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="operaciones@empresa.cl, logistica@empresa.cl" value={cfg.cc} onChange={(e) => update("cc", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">BCC copia oculta</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            placeholder="registros@empresa.cl" value={cfg.bcc} onChange={(e) => update("bcc", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Teléfono soporte</label>
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="+56 9 xxxx xxxx" value={cfg.supportPhone} onChange={(e) => update("supportPhone", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">URL portal de seguimiento</label>
          <div className="relative">
            <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="https://dropit.cl/track/" value={cfg.trackingUrl} onChange={(e) => update("trackingUrl", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Color corporativo (en emails)</label>
          <div className="flex items-center gap-2">
            <input type="color" className="h-9 w-14 cursor-pointer rounded-lg border border-slate-200 p-1"
              value={cfg.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
            <input className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              value={cfg.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
            <div className="h-9 w-9 rounded-lg border border-slate-200 flex-shrink-0" style={{ background: cfg.primaryColor }} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Logo (cabecera de emails)</label>
          <div className="flex items-center gap-3">
            {cfg.logoUrl ? (
              <div className="relative flex-shrink-0">
                <img src={cfg.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain bg-slate-50 p-1" />
                <button
                  type="button"
                  onClick={() => update("logoUrl", "")}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow hover:bg-red-600"
                >✕</button>
              </div>
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-2xl text-slate-300">🖼</div>
            )}
            <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-3 px-4 text-center transition hover:border-dropit-accent hover:bg-orange-50">
              <Upload size={15} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">{cfg.logoUrl ? "Cambiar logo" : "Cargar logo"}</span>
              <span className="text-[11px] text-slate-400">PNG, JPG · 200×200px recomendado</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => update("logoUrl", ev.target.result);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Firma automática del correo</label>
          <textarea rows={4}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
            value={cfg.signature} onChange={(e) => update("signature", e.target.value)} />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Vista previa del pie de correo</p>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <div className="mb-2 flex items-center gap-2">
            <img src={cfg.logoUrl} alt="logo" className="h-8 w-8 rounded object-cover"
              onError={(e) => { e.target.style.display = "none"; }} />
            <span className="font-bold" style={{ color: cfg.primaryColor }}>DropIt Service</span>
          </div>
          <div className="border-t pt-2 mt-2" style={{ borderColor: cfg.primaryColor + "33" }}>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-500">{cfg.signature}</pre>
          </div>
          {cfg.supportPhone && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
              <Phone size={10} /> {cfg.supportPhone}
            </p>
          )}
        </div>
      </div>

      <button onClick={save}
        className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
          saved ? "bg-emerald-500 text-white" : "bg-dropit-accent text-white hover:bg-dropit-accent/90"
        }`}>
        <Save size={13} />{saved ? "¡Guardado!" : "Guardar configuración cliente"}
      </button>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function MailConfigModule({ currentUser }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Comunicaciones</p>
        <h2 className="text-2xl font-black text-slate-800">Configuración de correo</h2>
        <p className="mt-1 text-sm text-slate-500">Servidor SMTP, identidad de la empresa y parámetros de notificación</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <Server size={16} className="text-dropit-accent" />
          <h3 className="text-base font-bold text-slate-700">Servidor SMTP</h3>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SmtpTab />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <User size={16} className="text-dropit-accent" />
          <h3 className="text-base font-bold text-slate-700">Identidad y preferencias de correo</h3>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ClientTab />
        </div>
      </div>
    </div>
  );
}
