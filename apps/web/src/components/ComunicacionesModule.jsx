import {
  CheckCircle2,
  Edit2,
  Mail,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  X,
} from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { tplPrueba } from "../lib/emailTemplates";

const SMTP_KEY = "dropit-smtp-config";

function loadSmtp() {
  try { return JSON.parse(localStorage.getItem(SMTP_KEY) || "{}"); }
  catch { return {}; }
}

function TestEmailModal({ onClose, templateSubject }) {
  const smtp = loadSmtp();
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    if (!to.includes("@")) return;
    setSending(true);
    try {
      const smtp = loadSmtp();
      await api.sendEmail({
        to,
        subject: `[Prueba] ${templateSubject}`,
        html: tplPrueba({ templateSubject, senderName: smtp.senderName }),
        text: `Prueba de plantilla — ${templateSubject}`,
      });
      setSending(false);
      setResult({ ok: true, msg: `Correo enviado a ${to} correctamente.` });
      setTimeout(() => onClose(), 3000);
    } catch (err) {
      setSending(false);
      setResult({ ok: false, msg: err.message || "Error al enviar. Verifica la configuración en Config. correo." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Enviar mensaje de prueba</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Destinatario</label>
            <input type="email" autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
              placeholder="tu@email.com" value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()} />
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 space-y-0.5">
            <p><span className="font-semibold">Asunto:</span> {templateSubject}</p>
            <p><span className="font-semibold">Desde:</span> {smtp.senderName || "DropIt Service"} &lt;{smtp.email || "no configurado"}&gt;</p>
            <p><span className="font-semibold">Servidor:</span> {smtp.host || "—"}:{smtp.port || "—"} ({smtp.encryption || "—"})</p>
          </div>
          {result && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />{result.msg}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
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

const STATUS_TEMPLATES = [
  {
    id: "programado",
    label: "Programado",
    color: "bg-sky-100 text-sky-700 border-sky-200",
    dotColor: "bg-sky-400",
    subject: "Tu pedido ha sido programado — Dropit",
    body: `Hola {{nombre_cliente}},

Tu pedido {{id_pedido}} ha sido programado exitosamente para el día {{fecha_entrega}}.

📦 Origen: {{direccion_origen}}
🏠 Destino: {{direccion_destino}}
🚚 Conductor asignado: {{nombre_conductor}}

Puedes hacer seguimiento de tu pedido en: {{link_tracking}}

¡Gracias por confiar en Dropit!`,
  },
  {
    id: "en_ruta",
    label: "En ruta",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    dotColor: "bg-dropit-accent",
    subject: "Tu pedido está en camino — Dropit",
    body: `Hola {{nombre_cliente}},

¡Buenas noticias! Tu pedido {{id_pedido}} ya está en camino.

🚚 Conductor: {{nombre_conductor}}
📞 Teléfono: {{telefono_conductor}}
⏰ Hora estimada de llegada: {{hora_estimada}}

Seguimiento en tiempo real: {{link_tracking}}

¡Tu pedido llegará pronto!`,
  },
  {
    id: "en_camino",
    label: "En camino (próximo)",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dotColor: "bg-amber-400",
    subject: "Tu pedido llegará en breve — Dropit",
    body: `Hola {{nombre_cliente}},

Tu pedido {{id_pedido}} llegará en aproximadamente 30 minutos.

📍 Conductor: {{nombre_conductor}}
📞 Contacto: {{telefono_conductor}}

Por favor asegúrate de estar disponible para recibir tu entrega.

Ver en mapa: {{link_tracking}}`,
  },
  {
    id: "entregado",
    label: "Entregado",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
    subject: "¡Tu pedido fue entregado! — Dropit",
    body: `Hola {{nombre_cliente}},

Tu pedido {{id_pedido}} fue entregado exitosamente el {{fecha_entrega}} a las {{hora_entrega}}.

✅ Entregado por: {{nombre_conductor}}
📷 Evidencia fotográfica disponible en: {{link_tracking}}

Si tienes alguna consulta o inconveniente, responde este correo o contáctanos.

¡Gracias por elegir Dropit!`,
  },
  {
    id: "fallido",
    label: "Fallido / No entregado",
    color: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
    subject: "No pudimos entregar tu pedido — Dropit",
    body: `Hola {{nombre_cliente}},

Lamentablemente no pudimos entregar tu pedido {{id_pedido}} el día {{fecha_intento}}.

❌ Motivo: {{motivo_falla}}

Nuestro equipo se pondrá en contacto contigo para reagendar la entrega.
También puedes contactarnos directamente respondiendo este correo.

Disculpa los inconvenientes,
Equipo Dropit`,
  },
];

const VARIABLES = [
  "{{nombre_cliente}}", "{{id_pedido}}", "{{fecha_entrega}}", "{{hora_entrega}}",
  "{{hora_estimada}}", "{{direccion_origen}}", "{{direccion_destino}}",
  "{{nombre_conductor}}", "{{telefono_conductor}}", "{{link_tracking}}", "{{motivo_falla}}", "{{fecha_intento}}",
];

function StatusDot({ color }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function ComunicacionesModule({ currentUser }) {
  const [activeChannel, setActiveChannel] = useState("email");
  const [selectedTemplate, setSelectedTemplate] = useState(STATUS_TEMPLATES[0]);
  const [editingId, setEditingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function startEdit(tpl) {
    setEditingId(tpl.id);
    setDrafts((d) => ({ ...d, [tpl.id]: { subject: tpl.subject, body: tpl.body } }));
    setSelectedTemplate(tpl);
  }

  function saveEdit(id) {
    setEditingId(null);
    showToast("Plantilla guardada correctamente");
  }

  function cancelEdit(id) {
    setDrafts((d) => { const copy = { ...d }; delete copy[id]; return copy; });
    setEditingId(null);
  }

  function resetTemplate(tpl) {
    setDrafts((d) => { const copy = { ...d }; delete copy[tpl.id]; return copy; });
    showToast("Plantilla restaurada a valores originales");
  }

  function getDraft(tpl) {
    return drafts[tpl.id] || { subject: tpl.subject, body: tpl.body };
  }

  const displayBody = getDraft(selectedTemplate).body;
  const previewBody = displayBody
    .replace(/{{nombre_cliente}}/g, "Juan Pérez")
    .replace(/{{id_pedido}}/g, "DRP-1042")
    .replace(/{{fecha_entrega}}/g, "30/04/2026")
    .replace(/{{hora_entrega}}/g, "15:32")
    .replace(/{{hora_estimada}}/g, "16:00")
    .replace(/{{direccion_origen}}/g, "Ñuñoa, Santiago")
    .replace(/{{direccion_destino}}/g, "Maipú, Santiago")
    .replace(/{{nombre_conductor}}/g, "Jason Huerta")
    .replace(/{{telefono_conductor}}/g, "+56 940328208")
    .replace(/{{link_tracking}}/g, "https://dropit.cl/track/DRP-1042")
    .replace(/{{motivo_falla}}/g, "Destinatario ausente")
    .replace(/{{fecha_intento}}/g, "30/04/2026");

  return (
    <div className="space-y-6">
      {showTestModal && (
        <TestEmailModal
          onClose={() => setShowTestModal(false)}
          templateSubject={getDraft(selectedTemplate).subject}
        />
      )}
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
          <p className="text-xs font-bold uppercase tracking-wider text-dropit-accent">Notificaciones automáticas</p>
          <h2 className="text-2xl font-black text-slate-800">Comunicaciones</h2>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setActiveChannel("email")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeChannel === "email" ? "bg-dropit-accent text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Mail size={15} />Email
          </button>
          <button onClick={() => setActiveChannel("whatsapp")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeChannel === "whatsapp" ? "bg-green-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <MessageSquare size={15} />WhatsApp
          </button>
        </div>
      </div>

      {activeChannel === "whatsapp" ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
          <MessageSquare size={32} className="mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">WhatsApp Business — próximamente</p>
          <p className="text-xs text-slate-400 mt-1">Integración con WhatsApp API en desarrollo</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Template List */}
          <div className="space-y-4">
            <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Plantillas por estado</p>
            {STATUS_TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" onClick={() => setSelectedTemplate(tpl)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                  selectedTemplate.id === tpl.id
                    ? "border-dropit-accent bg-dropit-accent/5 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                <StatusDot color={tpl.dotColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{tpl.label}</p>
                  {drafts[tpl.id] && (
                    <p className="text-[10px] text-dropit-accent font-medium">Modificado</p>
                  )}
                </div>
              </button>
            ))}
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Editor header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${selectedTemplate.color}`}>
                  {selectedTemplate.label}
                </span>
                {editingId === selectedTemplate.id && (
                  <span className="text-xs font-medium text-dropit-accent">● Editando</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTestModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-dropit-accent/30 px-3 py-1.5 text-xs font-semibold text-dropit-accent hover:bg-dropit-accent/5">
                  <Send size={12} />Enviar prueba
                </button>
                <button onClick={() => setPreview((p) => !p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    preview ? "border-dropit-accent bg-dropit-accent/5 text-dropit-accent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  {preview ? "Editar" : "Vista previa"}
                </button>
                {editingId !== selectedTemplate.id ? (
                  <>
                    <button onClick={() => resetTemplate(selectedTemplate)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <RotateCcw size={13} />Restaurar
                    </button>
                    <button onClick={() => startEdit(selectedTemplate)}
                      className="flex items-center gap-1.5 rounded-lg bg-dropit-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-dropit-accent/90">
                      <Edit2 size={13} />Editar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => cancelEdit(selectedTemplate.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <X size={13} />Cancelar
                    </button>
                    <button onClick={() => saveEdit(selectedTemplate.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-dropit-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-dropit-accent/90">
                      <Save size={13} />Guardar
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Subject */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Asunto</label>
                {editingId === selectedTemplate.id ? (
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dropit-accent/30"
                    value={getDraft(selectedTemplate).subject}
                    onChange={(e) => setDrafts((d) => ({ ...d, [selectedTemplate.id]: { ...d[selectedTemplate.id], subject: e.target.value } }))}
                  />
                ) : (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {getDraft(selectedTemplate).subject}
                  </p>
                )}
              </div>

              {/* Body */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {preview ? "Vista previa del mensaje" : "Cuerpo del mensaje"}
                </label>
                {preview ? (
                  <div className="min-h-48 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {previewBody}
                  </div>
                ) : editingId === selectedTemplate.id ? (
                  <textarea
                    rows={12}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-dropit-accent/30 resize-none"
                    value={getDraft(selectedTemplate).body}
                    onChange={(e) => setDrafts((d) => ({ ...d, [selectedTemplate.id]: { ...d[selectedTemplate.id], body: e.target.value } }))}
                  />
                ) : (
                  <pre className="min-h-48 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed overflow-auto">
                    {getDraft(selectedTemplate).body}
                  </pre>
                )}
              </div>

              {/* Variables reference — always visible */}
              <div className="rounded-lg border border-dropit-accent/20 bg-dropit-accent/5 p-3">
                <p className="text-xs font-bold text-dropit-accent mb-2">Variables disponibles:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <code key={v}
                      className={`rounded border border-dropit-accent/20 bg-white px-1.5 py-0.5 text-[10px] text-dropit-accent font-mono transition-colors ${
                        editingId === selectedTemplate.id ? "cursor-pointer hover:bg-dropit-accent/10" : "opacity-70"
                      }`}
                      onClick={() => {
                        if (editingId !== selectedTemplate.id) return;
                        const draft = getDraft(selectedTemplate);
                        setDrafts((d) => ({ ...d, [selectedTemplate.id]: { ...draft, body: draft.body + v } }));
                      }}>
                      {v}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {editingId === selectedTemplate.id
                    ? "Haz clic en una variable para insertarla al final del cuerpo."
                    : "Presiona Editar para insertar variables en la plantilla."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
