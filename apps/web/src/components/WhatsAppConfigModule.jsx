import {
  AlertCircle, CheckCircle2, Eye, EyeOff, Info,
  MessageSquare, Phone, Save, Send, Settings, Smartphone, X,
} from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

const WA_KEY = "dropit-whatsapp-config";

const DEFAULTS = {
  provider: "twilio",
  accountSid: "",
  authToken: "",
  fromNumber: "",   // whatsapp:+14155238886  (Twilio sandbox)
  businessNumber: "",  // Tu número de WhatsApp Business
  // Plantillas
  tplNuevaCotizacion: "Hola {{nombre}}, recibimos tu solicitud de cotización DropIt ({{codigo}}). Te responderemos en menos de 1 hora hábil. Gracias por contactarnos.",
  tplProgramado: "Hola {{nombre}}, tu pedido {{codigo}} ha sido programado para el {{fecha}}. Conductor: {{conductor}}. Tracking: {{link}}",
  tplEnRuta: "Hola {{nombre}}, tu pedido {{codigo}} está en camino. ETA: {{eta}}. Conductor: {{conductor}} ({{telefono}}). Tracking: {{link}}",
  tplEntregado: "Hola {{nombre}}, tu pedido {{codigo}} fue entregado exitosamente el {{fecha}} a las {{hora}}. Gracias por confiar en DropIt.",
  tplFallido: "Hola {{nombre}}, no pudimos entregar tu pedido {{codigo}}. Motivo: {{motivo}}. Te contactaremos para reagendar.",
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(WA_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}

const PROVIDERS = [
  {
    id: "twilio",
    name: "Twilio WhatsApp",
    logo: "🔵",
    desc: "Recomendado. Sandbox gratuito disponible para pruebas.",
    fields: [
      { key: "accountSid", label: "Account SID (solo el código, ej: AC766e…)", type: "text", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { key: "authToken", label: "Auth Token (Twilio Dashboard → ojo 👁 para revelar)", type: "password", placeholder: "Tu auth token real de Twilio" },
      { key: "fromNumber", label: "Número Twilio sandbox (NO el tuyo)", type: "text", placeholder: "whatsapp:+14155238886" },
      { key: "businessNumber", label: "Tu número de WhatsApp (para recibir pruebas)", type: "text", placeholder: "+56912345678" },
    ],
    instructions: [
      { step: "1", text: 'Ve a console.twilio.com y crea una cuenta gratuita' },
      { step: "2", text: 'En el menú lateral: Messaging → Try it out → Send a WhatsApp message' },
      { step: "3", text: 'Conecta tu número al sandbox enviando el código que te indica' },
      { step: "4", text: 'Copia tu Account SID y Auth Token desde el dashboard' },
      { step: "5", text: 'El número "From" del sandbox es: whatsapp:+14155238886' },
    ],
  },
  {
    id: "meta",
    name: "Meta WhatsApp Business API",
    logo: "🟢",
    desc: "Oficial de Meta. Requiere cuenta de Meta Business verificada.",
    fields: [
      { key: "authToken", label: "Access Token (Meta)", type: "password", placeholder: "EAAxxxxxxxx..." },
      { key: "accountSid", label: "Phone Number ID", type: "text", placeholder: "ID del número en Meta" },
      { key: "businessNumber", label: "Número de destino para pruebas", type: "text", placeholder: "+56912345678" },
    ],
    instructions: [
      { step: "1", text: 'Ve a developers.facebook.com y crea una app de tipo "Business"' },
      { step: "2", text: 'Agrega el producto "WhatsApp" a tu app' },
      { step: "3", text: 'En WhatsApp → API Setup, copia el Access Token temporal y el Phone Number ID' },
      { step: "4", text: 'Agrega un número de teléfono de prueba en la sección de destinatarios' },
      { step: "5", text: 'Para producción necesitas verificar tu empresa en Meta Business' },
    ],
  },
];

const TEMPLATES = [
  { key: "tplNuevaCotizacion", label: "Nueva cotización recibida", event: "Al crear cotización", color: "bg-blue-100 text-blue-700" },
  { key: "tplProgramado", label: "Pedido programado", event: "Al programar envío", color: "bg-sky-100 text-sky-700" },
  { key: "tplEnRuta", label: "Pedido en ruta", event: "Al despachar", color: "bg-orange-100 text-orange-700" },
  { key: "tplEntregado", label: "Pedido entregado", event: "Al confirmar entrega", color: "bg-emerald-100 text-emerald-700" },
  { key: "tplFallido", label: "Entrega fallida", event: "Al registrar fallo", color: "bg-red-100 text-red-700" },
];

const VARIABLES = [
  "{{nombre}}", "{{codigo}}", "{{fecha}}", "{{hora}}", "{{eta}}",
  "{{conductor}}", "{{telefono}}", "{{link}}", "{{motivo}}",
];

// ─── Test modal ───────────────────────────────────────────────────────────────
function TestModal({ cfg, onClose }) {
  const [to, setTo] = useState(cfg.businessNumber || "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    if (!to) return;
    if (!cfg.accountSid || cfg.accountSid === "[AuthToken]") {
      setResult({ ok: false, msg: "❌ Account SID inválido. Copia solo el SID (empieza con AC…)." });
      return;
    }
    if (!cfg.authToken || cfg.authToken === "[AuthToken]") {
      setResult({ ok: false, msg: "❌ Auth Token inválido. Ve a Twilio → Account Dashboard y copia el token real." });
      return;
    }
    setSending(true);
    try {
      await api.sendWhatsApp({
        accountSid: cfg.accountSid,
        authToken: cfg.authToken,
        from: cfg.fromNumber || "whatsapp:+14155238886",
        to,
        body: `🚛 *DropIt Service*\nMensaje de prueba enviado correctamente.\nFecha: ${new Date().toLocaleString("es-CL")}\n\nSi recibes esto, WhatsApp está funcionando ✅`,
      });
      setSending(false);
      setResult({ ok: true, msg: `✅ Mensaje enviado a ${to} vía Twilio. Revisa tu WhatsApp.` });
      setTimeout(() => onClose(), 3000);
    } catch (err) {
      setSending(false);
      setResult({ ok: false, msg: err.message || "Error al enviar. Verifica las credenciales." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Enviar mensaje de prueba</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Número destino</label>
            <input type="tel" autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              placeholder="+56912345678" value={to} onChange={e => setTo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()} />
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
            <p className="font-semibold mb-1">Proveedor: {PROVIDERS.find(p => p.id === cfg.provider)?.name}</p>
            <p>Desde: {cfg.fromNumber || "no configurado"}</p>
          </div>
          {result && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"
            }`}>
              <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />{result.msg}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button onClick={send} disabled={sending || !to}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
              {sending ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Enviando...</> : <><Send size={14} />Enviar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function WhatsAppConfigModule({ currentUser }) {
  const [cfg, setCfg] = useState(() => load());
  const [tab, setTab] = useState("conexion");
  const [showPass, setShowPass] = useState({});
  const [saved, setSaved] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);

  const isSuperAdmin = currentUser?.role === "super_admin";

  function update(k, v) { setCfg(c => ({ ...c, [k]: v })); setSaved(false); }

  function save() {
    localStorage.setItem(WA_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const provider = PROVIDERS.find(p => p.id === cfg.provider) || PROVIDERS[0];

  if (!isSuperAdmin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
        <MessageSquare size={32} className="mb-3 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">Acceso restringido</p>
        <p className="text-xs text-slate-400 mt-1">Solo el Super Admin puede configurar WhatsApp</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTest && <TestModal cfg={cfg} onClose={() => setShowTest(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-green-600">Comunicaciones</p>
          <h2 className="text-2xl font-black text-slate-800">WhatsApp Business</h2>
          <p className="mt-1 text-sm text-slate-500">Notificaciones automáticas por WhatsApp a clientes — Solo Super Admin</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTest(true)}
            className="flex items-center gap-1.5 rounded-lg border border-green-400/40 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50">
            <Send size={13} />Enviar prueba
          </button>
          <button onClick={save}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              saved ? "bg-emerald-500 text-white" : "bg-green-500 text-white hover:bg-green-600"
            }`}>
            <Save size={13} />{saved ? "¡Guardado!" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit shadow-sm">
        {[
          { id: "conexion", label: "Conexión", icon: Settings },
          { id: "plantillas", label: "Plantillas", icon: MessageSquare },
          { id: "instrucciones", label: "Instrucciones", icon: Info },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
              tab === id ? "bg-green-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* ── Conexión ── */}
        {tab === "conexion" && (
          <div className="space-y-6">
            {/* Provider selector */}
            <div>
              <label className="mb-3 block text-sm font-bold text-slate-700">Proveedor de WhatsApp</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROVIDERS.map(p => (
                  <button key={p.id} type="button" onClick={() => update("provider", p.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                      cfg.provider === p.id
                        ? "border-green-400 bg-green-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    }`}>
                    <span className="text-2xl">{p.logo}</span>
                    <div>
                      <p className={`text-sm font-bold ${cfg.provider === p.id ? "text-green-700" : "text-slate-800"}`}>{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              {provider.fields.map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
                  <div className="relative">
                    <input
                      type={type === "password" && !showPass[key] ? "password" : "text"}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
                      placeholder={placeholder}
                      value={cfg[key] || ""}
                      onChange={e => update(key, e.target.value)}
                    />
                    {type === "password" && (
                      <button type="button"
                        onClick={() => setShowPass(p => ({ ...p, [key]: !p[key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Status indicator */}
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${
              cfg.authToken && cfg.fromNumber
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <div className={`h-2.5 w-2.5 rounded-full ${cfg.authToken && cfg.fromNumber ? "bg-green-500 animate-pulse" : "bg-amber-400"}`} />
              <p className="text-sm font-medium text-slate-700">
                {cfg.authToken && cfg.fromNumber
                  ? "Configuración completa — haz clic en Enviar prueba para verificar"
                  : "Completa los campos para activar WhatsApp"}
              </p>
            </div>
          </div>
        )}

        {/* ── Plantillas ── */}
        {tab === "plantillas" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Edita los mensajes que se envían automáticamente a los clientes.
              Usa las variables para personalizar cada mensaje.
            </p>

            {TEMPLATES.map(tpl => (
              <div key={tpl.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tpl.color}`}>{tpl.label}</span>
                    <span className="text-xs text-slate-400">{tpl.event}</span>
                  </div>
                  <button
                    onClick={() => setEditingTpl(editingTpl === tpl.key ? null : tpl.key)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    {editingTpl === tpl.key ? "Cerrar" : "Editar"}
                  </button>
                </div>
                {editingTpl === tpl.key ? (
                  <textarea
                    rows={3}
                    className="w-full resize-none rounded-lg border border-green-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400/30"
                    value={cfg[tpl.key]}
                    onChange={e => update(tpl.key, e.target.value)}
                  />
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 font-mono whitespace-pre-wrap">
                    {cfg[tpl.key]}
                  </p>
                )}
              </div>
            ))}

            {/* Variables reference */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-bold text-green-700 mb-2">Variables disponibles:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <code key={v} className="rounded border border-green-200 bg-white px-1.5 py-0.5 text-[10px] text-green-700 font-mono">{v}</code>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Instrucciones ── */}
        {tab === "instrucciones" && (
          <div className="space-y-6">
            {PROVIDERS.map(p => (
              <div key={p.id} className={`rounded-xl border p-5 ${cfg.provider === p.id ? "border-green-300 bg-green-50/50" : "border-slate-200"}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{p.logo}</span>
                  <h3 className="font-bold text-slate-800">{p.name}</h3>
                  {cfg.provider === p.id && (
                    <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
                  )}
                </div>
                <ol className="space-y-2">
                  {p.instructions.map(({ step, text }) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">{step}</span>
                      <p className="text-sm text-slate-700">{text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={15} className="text-amber-600" />
                <p className="text-sm font-bold text-amber-700">Nota importante</p>
              </div>
              <p className="text-sm text-amber-700">
                El envío real de WhatsApp requiere que el backend de DropIt tenga integrado el SDK de Twilio o Meta.
                Actualmente los mensajes de prueba son simulados. Contacta al equipo técnico para activar el envío real.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
