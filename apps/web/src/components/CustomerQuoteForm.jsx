import { AlertCircle, Calendar, Check, ChevronDown, MapPin, Package, Phone, Send, User } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { tplClienteNuevaCotizacion, tplEmpresaNuevaCotizacion } from "../lib/emailTemplates";

// ─── Chilean communes (346 communes) ─────────────────────────────────────────
const COMUNAS = [
  "Alhué","Alto Biobío","Alto del Carmen","Alto Hospicio","Ancud","Andacollo","Angol",
  "Antofagasta","Antuco","Arauco","Arica","Aysén","Buin","Bulnes","Cabildo","Cabo de Hornos",
  "Calama","Caldera","Calera","Calera de Tango","Camarones","Camiña","Canela","Carahue",
  "Cartagena","Castro","Cauquenes","Chaitén","Chañaral","Chimbarongo","Chiguayante",
  "Chillán","Chillán Viejo","Chonchi","Cisnes","Cobquecura","Cochamo","Cochrane",
  "Codegua","Coihueco","Colbún","Colchane","Colina","Collipulli","Coltauco","Combarbalá",
  "Concepción","Conchalí","Concón","Constitución","Contulmo","Copiapó","Coquimbo",
  "Coronel","Corral","Coyhaique","Cunco","Curacautín","Curacaví","Curanilahue",
  "Curarrehue","Curicó","Dalcahue","Diego de Almagro","Doñihue","El Bosque","El Monte",
  "El Quisco","El Tabo","El Carmen","Empedrado","Ercilla","Estación Central","Florida",
  "Freire","Freirina","Fresia","Frutillar","Futaleufu","Futrono","General Lagos",
  "Graneros","Guaitecas","Gorbea","Hijuelas","Hualaihué","Hualañé","Hualqui","Huara",
  "Huasco","Huechuraba","Illapel","Independencia","Isla de Maipo","Isla de Pascua",
  "Juan Fernández","La Calera","La Cisterna","La Cruz","La Florida","La Granja",
  "La Higuera","La Ligua","La Pintana","La Reina","La Serena","La Unión","Lago Ranco",
  "Lago Verde","Laguna Blanca","Lampa","Lanco","Las Cabras","Las Condes","Lautaro",
  "Lebu","Licantén","Limache","Linares","Litueche","Lo Barnechea","Lo Espejo","Lo Prado",
  "Lolol","Longaví","Los Álamos","Los Andes","Los Lagos","Los Muermos","Los Sauces",
  "Los Vilos","Los Ángeles","Lota","Lumaco","Macul","Maipú","Máfil","María Elena",
  "María Pinto","Mariquina","Maullín","Mejillones","Melipilla","Molina","Monte Patria",
  "Mostazal","Mulchén","Nacimiento","Nueva Imperial","Ñiquén","Ñuñoa","Ninhue","Nogales",
  "Ohiggins","Ollagüe","Olmué","Osorno","Ovalle","Padre Hurtado","Padre Las Casas",
  "Paillaco","Paine","Palena","Panguipulli","Panquehue","Papudo","Parral","Pedro Aguirre Cerda",
  "Pelarco","Peñaflor","Peñalolén","Penco","Peralillo","Perquenco","Petorca","Peumo",
  "Pica","Pichidegua","Pichilemu","Pitrufquén","Pirque","Porvenir","Pozo Almonte",
  "Primavera","Providencia","Puchuncaví","Pudahuel","Puerto Montt","Puerto Natales",
  "Puerto Octay","Puerto Varas","Puerto Williams","Puente Alto","Punitaqui","Purén",
  "Purranque","Punta Arenas","Puqueldón","Pucón","Putre","Quellón","Quilicura",
  "Quilleco","Quilpué","Quillota","Quillón","Quinchao","Quinta de Tilcoco","Quinta Normal",
  "Quintero","Quirihue","Rancagua","Ranquil","Rauco","Recoleta","Renca","Rengo",
  "Requínoa","Retiro","Río Bueno","Río Hurtado","Río Ibáñez","Río Negro","Río Verde",
  "Romeral","Sagrada Familia","Salamanca","San Antonio","San Bernardo","San Carlos",
  "San Clemente","San Esteban","San Fabián","San Felipe","San Fernando","San Gregorio",
  "San Ignacio","San Javier","San Joaquín","San José de Maipo","San Juan de la Costa",
  "San Miguel","San Nicolás","San Pablo","San Pedro","San Pedro de Atacama",
  "San Pedro de la Paz","San Rafael","San Rosendo","Santa Bárbara","Santa Cruz",
  "Santa Juana","Santa María","Santiago","Santo Domingo","Sierra Gorda","Talagante",
  "Talca","Talcahuano","Taltal","Temuco","Tierra Amarilla","Tiltil","Timaukel",
  "Tirúa","Tocopilla","Tomé","Tortel","Traiguén","Trehuaco","Tucapel","Valdivia",
  "Vallenar","Valparaíso","Victoria","Vicuña","Villa Alemana","Villa Alegre",
  "Vilcún","Villarrica","Viña del Mar","Vitacura","Yerbas Buenas","Yumbel","Zapallar",
].sort();

// ─── RUT helpers ─────────────────────────────────────────────────────────────
function formatRut(raw) {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) return clean;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  let fmt = "";
  let c = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    fmt = body[i] + fmt;
    c++;
    if (c % 3 === 0 && i !== 0) fmt = "." + fmt;
  }
  return `${fmt}-${dv}`;
}

function validateRut(rut) {
  const clean = rut.replace(/[^0-9kK]/g, "").toLowerCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0, factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rem = 11 - (sum % 11);
  const expected = rem === 11 ? "0" : rem === 10 ? "k" : String(rem);
  return dv === expected;
}

// ─── Commune autocomplete ─────────────────────────────────────────────────────
function ComunaInput({ value, onChange, placeholder, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef(null);

  const filtered = query.length >= 2
    ? COMUNAS.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function select(comuna) {
    setQuery(comuna);
    onChange(comuna);
    setOpen(false);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          id={id}
          className="input-base pr-8"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          {filtered.map(c => (
            <li
              key={c}
              onMouseDown={() => select(c)}
              className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-dropit-accent/10 hover:text-dropit-accent transition-colors"
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="label-base">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────
const initialForm = {
  rut: "",
  customerName: "",
  contactPhone: "",
  contactEmail: "",
  pickupAddress: "",
  pickupCommune: "",
  deliveryAddress: "",
  deliveryCommune: "",
  packages: "",
  estimatedWeightKg: "",
  cargoDescription: "",
  requiredDate: "",
  observations: "",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function CustomerQuoteForm({ onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function handleRut(e) {
    const formatted = formatRut(e.target.value);
    update("rut", formatted);
  }

  function validate() {
    const e = {};
    if (!form.rut) e.rut = "RUT requerido";
    else if (!validateRut(form.rut)) e.rut = "RUT inválido — verifica el dígito verificador";
    if (!form.customerName.trim()) e.customerName = "Nombre requerido";
    if (!form.contactPhone.trim()) e.contactPhone = "Teléfono requerido";
    if (!form.contactEmail.trim()) e.contactEmail = "Correo requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = "Correo inválido";
    if (!form.pickupAddress.trim()) e.pickupAddress = "Dirección de retiro requerida";
    if (!form.pickupCommune.trim()) e.pickupCommune = "Comuna de retiro requerida";
    if (!form.deliveryAddress.trim()) e.deliveryAddress = "Dirección de entrega requerida";
    if (!form.deliveryCommune.trim()) e.deliveryCommune = "Comuna de entrega requerida";
    if (!form.packages) e.packages = "Cantidad requerida";
    if (!form.cargoDescription.trim()) e.cargoDescription = "Descripción requerida";
    if (!form.requiredDate) e.requiredDate = "Fecha requerida";
    return e;
  }

  async function submit(event) {
    event.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setLoading(true);
    setError("");
    try {
      // Create request in backend
      const payload = {
        customerName: form.customerName,
        contactPerson: form.customerName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        pickupAddress: `${form.pickupAddress}, ${form.pickupCommune}`,
        deliveryAddress: `${form.deliveryAddress}, ${form.deliveryCommune}`,
        destinationCity: form.deliveryCommune,
        packages: form.packages,
        estimatedWeightKg: form.estimatedWeightKg,
        cargoDescription: form.cargoDescription,
        requiredDate: form.requiredDate,
        observations: `RUT: ${form.rut}\n${form.observations}`,
      };
      const request = await onCreate(payload);
      setCreated(request);

      // Load config
      const cfg = (() => { try { return { ...JSON.parse(localStorage.getItem("dropit-client-config") || "{}"), ...JSON.parse(localStorage.getItem("dropit-smtp-config") || "{}") }; } catch { return {}; } })();
      const companyEmail = cfg.supportEmail || cfg.email || "";

      // Email to client
      try {
        await api.sendEmail({
          to: form.contactEmail,
          subject: "Solicitud de cotización recibida — DropIt Service",
          html: tplClienteNuevaCotizacion({
            customerName: form.customerName, rut: form.rut,
            trackingCode: request?.trackingCode,
            pickupAddress: form.pickupAddress, pickupCommune: form.pickupCommune,
            deliveryAddress: form.deliveryAddress, deliveryCommune: form.deliveryCommune,
            packages: form.packages, estimatedWeightKg: form.estimatedWeightKg,
            requiredDate: form.requiredDate, supportEmail: cfg.supportEmail,
          }),
          text: `Hola ${form.customerName}, recibimos tu solicitud. Código: ${request?.trackingCode || "N/A"}`,
        });
      } catch { /* silent */ }

      // Email to company
      if (companyEmail) {
        try {
          await api.sendEmail({
            to: companyEmail,
            subject: `🚛 Nueva cotización — ${form.rut} | ${form.customerName}`,
            html: tplEmpresaNuevaCotizacion({
              customerName: form.customerName, rut: form.rut,
              contactPhone: form.contactPhone, contactEmail: form.contactEmail,
              pickupAddress: form.pickupAddress, pickupCommune: form.pickupCommune,
              deliveryAddress: form.deliveryAddress, deliveryCommune: form.deliveryCommune,
              packages: form.packages, estimatedWeightKg: form.estimatedWeightKg,
              cargoDescription: form.cargoDescription, requiredDate: form.requiredDate,
              observations: form.observations, trackingCode: request?.trackingCode,
            }),
            text: `Nueva cotización de ${form.customerName} (${form.rut}). Retiro: ${form.pickupAddress}, ${form.pickupCommune}.`,
          });
        } catch { /* silent */ }
      }

      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
      {/* ─── Form ─── */}
      <form className="surface overflow-hidden" onSubmit={submit}>
        <div className="border-b border-dropit-300 bg-dropit-50 px-6 py-5">
          <h2 className="text-2xl font-bold text-dropit-950">Solicitar cotización</h2>
          <p className="mt-1 text-sm text-dropit-700">Completa el formulario y recibirás una propuesta en menos de 1 hora</p>
        </div>

        <div className="p-6 space-y-8">
          {/* ── Identificación ── */}
          <fieldset>
            <legend className="mb-4 flex items-center gap-2 text-lg font-bold text-dropit-950">
              <User size={20} className="text-dropit-accent" />
              Identificación
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="RUT" error={errors.rut} required>
                <input
                  className={`input-base ${errors.rut ? "border-red-400 focus:ring-red-300/30" : ""}`}
                  placeholder="12.456.789-K"
                  value={form.rut}
                  onChange={handleRut}
                  maxLength={12}
                />
              </Field>
              <Field label="Empresa o Persona" error={errors.customerName} required>
                <input
                  className={`input-base ${errors.customerName ? "border-red-400" : ""}`}
                  placeholder="Nombre completo o razón social"
                  value={form.customerName}
                  onChange={e => update("customerName", e.target.value)}
                />
              </Field>
              <Field label="Teléfono de contacto" error={errors.contactPhone} required>
                <input
                  className={`input-base ${errors.contactPhone ? "border-red-400" : ""}`}
                  type="tel"
                  placeholder="+56 9 XXXX XXXX"
                  value={form.contactPhone}
                  onChange={e => update("contactPhone", e.target.value)}
                />
              </Field>
              <Field label="Correo electrónico" error={errors.contactEmail} required>
                <input
                  className={`input-base ${errors.contactEmail ? "border-red-400" : ""}`}
                  type="email"
                  placeholder="tu@empresa.cl"
                  value={form.contactEmail}
                  onChange={e => update("contactEmail", e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          {/* ── Dirección de Retiro ── */}
          <fieldset>
            <legend className="mb-4 flex items-center gap-2 text-lg font-bold text-dropit-950">
              <MapPin size={20} className="text-dropit-accent" />
              Dirección de retiro
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dirección de retiro" error={errors.pickupAddress} required>
                <input
                  className={`input-base ${errors.pickupAddress ? "border-red-400" : ""}`}
                  placeholder="Calle y número (ej: Av. Providencia 1234)"
                  value={form.pickupAddress}
                  onChange={e => update("pickupAddress", e.target.value)}
                />
              </Field>
              <Field label="Comuna de retiro" error={errors.pickupCommune} required>
                <ComunaInput
                  id="pickupCommune"
                  value={form.pickupCommune}
                  onChange={v => update("pickupCommune", v)}
                  placeholder="Escribe para buscar comuna..."
                />
                {errors.pickupCommune && <p className="mt-1 text-xs text-red-500">{errors.pickupCommune}</p>}
              </Field>
            </div>
          </fieldset>

          {/* ── Dirección de Entrega ── */}
          <fieldset>
            <legend className="mb-4 flex items-center gap-2 text-lg font-bold text-dropit-950">
              <MapPin size={20} className="text-dropit-accent" />
              Dirección de entrega
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dirección de entrega" error={errors.deliveryAddress} required>
                <input
                  className={`input-base ${errors.deliveryAddress ? "border-red-400" : ""}`}
                  placeholder="Calle y número (ej: Calle Los Leones 456)"
                  value={form.deliveryAddress}
                  onChange={e => update("deliveryAddress", e.target.value)}
                />
              </Field>
              <Field label="Comuna de entrega" error={errors.deliveryCommune} required>
                <ComunaInput
                  id="deliveryCommune"
                  value={form.deliveryCommune}
                  onChange={v => update("deliveryCommune", v)}
                  placeholder="Escribe para buscar comuna..."
                />
                {errors.deliveryCommune && <p className="mt-1 text-xs text-red-500">{errors.deliveryCommune}</p>}
              </Field>
            </div>
          </fieldset>

          {/* ── Carga ── */}
          <fieldset>
            <legend className="mb-4 flex items-center gap-2 text-lg font-bold text-dropit-950">
              <Package size={20} className="text-dropit-accent" />
              Detalle de carga
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cantidad de bultos" error={errors.packages} required>
                <input
                  className={`input-base ${errors.packages ? "border-red-400" : ""}`}
                  type="number"
                  min="1"
                  placeholder="Ej: 5"
                  value={form.packages}
                  onChange={e => update("packages", e.target.value)}
                />
              </Field>
              <Field label="Peso estimado (kg)" error={errors.estimatedWeightKg}>
                <input
                  className="input-base"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ej: 150"
                  value={form.estimatedWeightKg}
                  onChange={e => update("estimatedWeightKg", e.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Descripción de la carga" error={errors.cargoDescription} required>
                  <textarea
                    className={`input-base min-h-[90px] resize-none ${errors.cargoDescription ? "border-red-400" : ""}`}
                    placeholder="Ej: Cajas de electrodomésticos, muebles, documentos frágiles..."
                    value={form.cargoDescription}
                    onChange={e => update("cargoDescription", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* ── Servicio ── */}
          <fieldset>
            <legend className="mb-4 flex items-center gap-2 text-lg font-bold text-dropit-950">
              <Calendar size={20} className="text-dropit-accent" />
              Fecha y observaciones
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fecha requerida del servicio" error={errors.requiredDate} required>
                <input
                  className={`input-base ${errors.requiredDate ? "border-red-400" : ""}`}
                  type="date"
                  value={form.requiredDate}
                  onChange={e => update("requiredDate", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Observaciones especiales (opcional)">
                  <textarea
                    className="input-base min-h-[80px] resize-none"
                    placeholder="Ej: Requiere escalera, ingresar por estacionamiento..."
                    value={form.observations}
                    onChange={e => update("observations", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Error */}
        {error && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-4">
            <div className="flex gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Validation summary */}
        {Object.keys(errors).length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <AlertCircle size={15} /> Corrige los campos marcados en rojo antes de continuar
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="border-t border-dropit-300 bg-dropit-100/30 px-6 py-4">
          <button className="btn-primary w-full gap-2" type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Enviando solicitud...
              </>
            ) : (
              <>
                <Send size={18} />
                Solicitar cotización
              </>
            )}
          </button>
        </div>
      </form>

      {/* ─── Sidebar ─── */}
      <aside className="surface overflow-hidden">
        {created ? (
          <>
            <div className="border-b border-dropit-300 bg-gradient-to-r from-dropit-accent to-orange-400 px-6 py-6 text-white">
              <div className="flex items-center gap-3">
                <Check size={24} className="flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold">¡Solicitud enviada!</h3>
                  <p className="text-sm text-white/80">Revisa tu correo electrónico</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {created.trackingCode && (
                <div className="rounded-lg bg-dropit-100/30 p-4">
                  <p className="text-xs font-semibold uppercase text-dropit-700 mb-1">Código de seguimiento</p>
                  <p className="font-mono text-xl font-bold text-dropit-accent">{created.trackingCode}</p>
                </div>
              )}
              <div className="space-y-2 rounded-lg border-l-4 border-dropit-accent bg-dropit-accent/5 p-4">
                <p className="text-sm font-semibold text-dropit-950">Próximos pasos:</p>
                <ul className="mt-2 space-y-2 text-sm text-dropit-700">
                  <li className="flex gap-2"><span className="text-dropit-accent font-bold">✓</span> Confirmación enviada a tu correo</li>
                  <li className="flex gap-2"><span className="text-dropit-accent font-bold">→</span> Cotización en máximo 1 hora</li>
                  <li className="flex gap-2"><span className="text-dropit-accent font-bold">→</span> Usa tu código para hacer seguimiento</li>
                </ul>
              </div>
              <button
                className="btn-secondary w-full"
                type="button"
                onClick={() => setCreated(null)}
              >
                Enviar otra solicitud
              </button>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-dropit-950 mb-3">¿Por qué DropIt?</h3>
              <ul className="space-y-2.5 text-sm text-dropit-700">
                {[
                  "Respuesta en menos de 1 hora hábil",
                  "Rutas optimizadas por inteligencia",
                  "Seguimiento GPS en tiempo real",
                  "Cobertura en toda la Región Metropolitana",
                  "Notificaciones automáticas por email",
                ].map(t => (
                  <li key={t} className="flex gap-2">
                    <span className="text-dropit-accent font-bold">✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-dropit-100/30 p-4 border border-dropit-300">
              <p className="text-sm font-semibold text-dropit-950">💡 Tip</p>
              <p className="mt-1 text-xs text-dropit-700">
                Incluye calle y número exacto en las direcciones para recibir una cotización más precisa.
              </p>
            </div>
            <div className="rounded-lg border border-dropit-accent/20 bg-dropit-accent/5 p-4 text-xs text-dropit-700 space-y-1">
              <p className="font-bold text-dropit-accent">🔒 RUT requerido</p>
              <p>Necesitamos tu RUT para emitir documentos tributarios válidos (boleta o factura).</p>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
