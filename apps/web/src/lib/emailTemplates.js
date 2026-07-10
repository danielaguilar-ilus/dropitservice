// ─── Shared DropIt HTML email templates ──────────────────────────────────────
// All templates use inline CSS for maximum email client compatibility.

const BRAND = {
  accent:     "#F97316",
  accentDark: "#C2590A",
  accentDeep: "#7C3308",
  dark:       "#0c0907",
  darkMid:    "#1a0f05",
  darkCard:   "#2d1a0a",
  text:       "#1f2937",
  muted:      "#6b7280",
  border:     "#e5e7eb",
};

// ─── Helper: read logo URL from client config ─────────────────────────────────
// Priority: 1) custom URL saved in localStorage  2) bundled public asset
export function getLogoUrl() {
  try {
    const cc = JSON.parse(localStorage.getItem("dropit-client-config") || "{}");
    const url = cc.logoUrl || "";
    if (url.startsWith("http") || url.startsWith("data:")) return url;
  } catch { /* fall through */ }
  // Resolve against the page origin so blob:/print contexts get an absolute URL
  try {
    return `${window.location.origin}/dropit-logo.jpeg`;
  } catch { return "/dropit-logo.jpeg"; }
}

// ─── Helper: read company name from client config ─────────────────────────────
export function getCompanyName() {
  try {
    const cc = JSON.parse(localStorage.getItem("dropit-client-config") || "{}");
    return cc.companyName || "DropIt Service";
  } catch { return "DropIt Service"; }
}

// ─── Logo block — white badge on orange header ────────────────────────────────
function buildLogo(logoUrl, companyName) {
  const name  = companyName || "DropIt Service";
  const hasImage = logoUrl && (logoUrl.startsWith("http") || logoUrl.startsWith("data:"));
  const imgBlock = hasImage
    ? `<td><img src="${logoUrl}" alt="${name}" width="52" height="52" style="width:52px;height:52px;border-radius:12px;display:block;object-fit:cover;border:3px solid rgba(255,255,255,0.3);" /></td>`
    : `<td><div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:12px;font-size:24px;font-weight:900;color:#fff;font-family:Arial,sans-serif;border:2px solid rgba(255,255,255,0.3);">D</div></td>`;

  return `
<table cellpadding="0" cellspacing="0" border="0">
  <tr>
    ${imgBlock}
    <td style="padding-left:14px;vertical-align:middle;">
      <div style="font-size:22px;font-weight:900;color:#fff;font-family:Arial,sans-serif;letter-spacing:-0.5px;line-height:1.1;">
        ${name}
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:2.5px;margin-top:2px;">
        Transportes &amp; Logística
      </div>
    </td>
  </tr>
</table>`;
}

// ─── Outer wrapper — dark background ─────────────────────────────────────────
function wrapper(content, companyName) {
  const name = companyName || "DropIt Service";
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title></head>
<body style="margin:0;padding:0;background:${BRAND.dark};font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.dark};padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" border="0"
      style="max-width:580px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.7);">
      ${content}
      <!-- Global footer -->
      <tr><td style="background:${BRAND.dark};padding:20px 0;text-align:center;">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);font-family:Arial,sans-serif;">
          Correo generado automáticamente por
          <strong style="color:${BRAND.accent};">${name}</strong>
        </p>
        <p style="margin:6px 0 0;font-size:10px;color:rgba(255,255,255,0.2);font-family:Arial,sans-serif;">
          © 2026 ${name} · Santiago, Chile
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Header — solid orange gradient ──────────────────────────────────────────
function header(title, subtitle, logoUrl, companyName) {
  return `
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:linear-gradient(135deg,${BRAND.accent} 0%,${BRAND.accentDark} 55%,${BRAND.accentDeep} 100%);padding:30px 32px 26px;">
      <tr><td>${buildLogo(logoUrl, companyName)}</td></tr>
      <tr><td style="padding-top:22px;border-top:1px solid rgba(255,255,255,0.15);margin-top:18px;">
        <h1 style="margin:0;font-size:26px;font-weight:900;color:#fff;line-height:1.2;font-family:Arial,sans-serif;">${title}</h1>
        ${subtitle ? `<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-family:Arial,sans-serif;">${subtitle}</p>` : ""}
      </td></tr>
    </table>
  </td></tr>`;
}

// ─── Body — white card ────────────────────────────────────────────────────────
function body(content) {
  return `
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#ffffff;padding:32px;">
      ${content}
    </table>
  </td></tr>`;
}

// ─── Footer — dark card with CTA buttons ─────────────────────────────────────
function footer(content) {
  return `
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:${BRAND.darkMid};padding:24px 32px;">
      ${content}
    </table>
  </td></tr>`;
}

// ─── Info box — warm orange-tinted table ─────────────────────────────────────
function infoBox(rows) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 14px;font-size:12px;color:${BRAND.accentDark};font-weight:700;width:150px;vertical-align:top;text-transform:uppercase;letter-spacing:0.5px;">${label}</td>
      <td style="padding:8px 14px;font-size:13px;color:${BRAND.text};font-weight:500;border-left:2px solid #fed7aa;">${value}</td>
    </tr>`).join("");
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#fff8f1;border:1px solid #fed7aa;border-left:4px solid ${BRAND.accent};border-radius:10px;margin:16px 0;">
      <tr><td colspan="2" style="padding:10px 14px 4px;">
        <p style="margin:0;font-size:10px;font-weight:800;color:${BRAND.accent};text-transform:uppercase;letter-spacing:1.5px;">📋 Detalle de solicitud</p>
      </td></tr>
      ${cells}
    </table>`;
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function button(text, url, outline = false) {
  return outline
    ? `<a href="${url}" style="display:inline-block;padding:12px 28px;border-radius:8px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.4);font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">${text}</a>`
    : `<a href="${url}" style="display:inline-block;padding:13px 30px;border-radius:8px;background:${BRAND.accent};color:#fff;font-size:14px;font-weight:800;text-decoration:none;font-family:Arial,sans-serif;box-shadow:0 4px 14px rgba(249,115,22,0.4);">${text}</a>`;
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function badge(text, color) {
  const c = color || BRAND.accent;
  return `<span style="display:inline-block;padding:5px 14px;border-radius:20px;background:${c}22;color:${c};font-size:11px;font-weight:800;border:1px solid ${c}55;font-family:Arial,sans-serif;letter-spacing:0.5px;">${text}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Quote confirmation → client ──────────────────────────────────────────────
export function tplClienteNuevaCotizacion({ customerName, rut, trackingCode, pickupAddress, pickupCommune, deliveryAddress, deliveryCommune, packages, estimatedWeightKg, requiredDate, requiredTime, supportEmail, logoUrl, companyName }) {
  const name = companyName || "DropIt Service";
  return wrapper(`
    ${header("¡Solicitud recibida!", "Tu cotización está en proceso — te respondemos en menos de 1 hora hábil", logoUrl, name)}
    ${body(`
      <tr><td>
        <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};font-family:Arial,sans-serif;">
          Hola <strong>${customerName}</strong>,
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;font-family:Arial,sans-serif;">
          Recibimos tu solicitud de cotización correctamente. Nuestro equipo la está revisando
          y te enviará una <strong style="color:${BRAND.accentDark};">propuesta de precio en menos de 1 hora hábil</strong>.
        </p>
        ${infoBox([
          ["RUT",        rut || "—"],
          ["Origen",     `${pickupAddress || "—"}${pickupCommune ? `, <strong>${pickupCommune}</strong>` : ""}`],
          ["Destino",    `${deliveryAddress || "—"}${deliveryCommune ? `, <strong>${deliveryCommune}</strong>` : ""}`],
          ["Bultos / Peso total", `${packages || "—"}${estimatedWeightKg ? ` bultos · ${estimatedWeightKg} kg en total` : " bultos"}`],
          ["Fecha / Hora", `${requiredDate || "—"}${requiredTime ? ` a las ${requiredTime}` : ""}`],
          ["Código",     `<strong style="color:${BRAND.accent};font-size:16px;letter-spacing:1px;">${trackingCode || "N/A"}</strong>`],
        ])}
        <p style="margin:20px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.6;font-family:Arial,sans-serif;">
          ¿Tienes dudas? Responde este correo o escríbenos a
          <a href="mailto:${supportEmail || "soporte@dropit.cl"}" style="color:${BRAND.accent};font-weight:700;">${supportEmail || "soporte@dropit.cl"}</a>.
        </p>
      </td></tr>
    `)}
    ${footer(`
      <tr><td align="center">
        <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;">Haz seguimiento de tu solicitud en cualquier momento:</p>
        ${button("🔍 Ver estado de mi solicitud", "https://dropit.cl/cotizar")}
      </td></tr>
    `)}
  `, name);
}

// ─── New quote notification → company ────────────────────────────────────────
export function tplEmpresaNuevaCotizacion({ customerName, rut, contactPhone, contactEmail, pickupAddress, pickupCommune, deliveryAddress, deliveryCommune, packages, estimatedWeightKg, cargoDescription, requiredDate, requiredTime, observations, trackingCode, logoUrl, companyName, distanceKm, estimatedPrice, imageCount }) {
  const name = companyName || "DropIt Service";

  const mailtoSubject = encodeURIComponent(`Propuesta de cotización ${name} — Ref. ${trackingCode}`);
  const mailtoBody    = encodeURIComponent(
    `Estimado/a ${customerName},\n\n` +
    `Hemos revisado su solicitud (Ref. ${trackingCode}) y le proponemos:\n\n` +
    (distanceKm    ? `📏 Distancia: ${distanceKm} km\n` : "") +
    (estimatedPrice ? `💰 Precio: $${estimatedPrice.toLocaleString("es-CL")} + IVA\n` : "") +
    `\nPara confirmar, responda este correo.\n\nSaludos,\nEquipo ${name}`
  );
  const mailtoLink = `mailto:${contactEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return wrapper(`
    ${header("🚛 Nueva cotización recibida", new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" }), logoUrl, name)}
    ${body(`
      <tr><td>
        <div style="margin-bottom:18px;display:flex;align-items:center;gap:10px;">
          ${badge("Nueva solicitud")}
          ${estimatedPrice ? badge(`$${estimatedPrice.toLocaleString("es-CL")} est.", "${BRAND.accentDark}`) : ""}
        </div>
        ${infoBox([
          ["RUT",           `<strong>${rut || "—"}</strong>`],
          ["Cliente",       `<strong>${customerName}</strong>`],
          ["Teléfono",      `<a href="tel:${contactPhone}" style="color:${BRAND.accent};font-weight:700;">${contactPhone || "—"}</a>`],
          ["Email",         `<a href="mailto:${contactEmail}" style="color:${BRAND.accent};font-weight:700;">${contactEmail || "—"}</a>`],
          ["Retiro",        `${pickupAddress || "—"}${pickupCommune ? `, <strong>${pickupCommune}</strong>` : ""}`],
          ["Entrega",       `${deliveryAddress || "—"}${deliveryCommune ? `, <strong>${deliveryCommune}</strong>` : ""}`],
          ["Bultos / Peso total", `${packages || "—"} bultos${estimatedWeightKg ? ` · ${estimatedWeightKg} kg en total` : ""}`],
          ["Fecha / Hora",  `${requiredDate || "—"}${requiredTime ? ` a las ${requiredTime}` : ""}`],
          ...(distanceKm    ? [["Distancia",    `<strong style="color:${BRAND.accent};">${distanceKm} km</strong>`]] : []),
          ...(estimatedPrice ? [["Precio est.",  `<strong style="color:${BRAND.accent};font-size:15px;">$${estimatedPrice.toLocaleString("es-CL")}</strong>`]] : []),
          ["Descripción",   cargoDescription || "—"],
          ...(observations  ? [["Observaciones", observations]] : []),
          ...(imageCount    ? [["Fotos",         `${imageCount} imagen${imageCount > 1 ? "es" : ""} adjunta${imageCount > 1 ? "s" : ""}`]] : []),
          ["Código",        `<strong style="color:${BRAND.accent};font-size:16px;letter-spacing:1px;">${trackingCode || "—"}</strong>`],
        ])}
      </td></tr>
    `)}
    ${footer(`
      <tr><td align="center" style="padding-bottom:12px;">
        <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;">Gestiona esta solicitud desde el panel operativo:</p>
        ${button("📊 Abrir panel DropIt", typeof window !== "undefined" ? window.location.origin : "https://dropit.cl")}
      </td></tr>
      ${estimatedPrice ? `
      <tr><td align="center" style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);">
        <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;">¿El precio es aceptable? Envía la propuesta directamente al cliente:</p>
        ${button(`✉️ Proponer $${estimatedPrice.toLocaleString("es-CL")} al cliente`, mailtoLink, true)}
      </td></tr>` : ""}
    `)}
  `, name);
}

// ─── Cotización confirmada → cliente (precio final, con peoneta si aplica) ───
export function tplCotizacionConfirmada({
  customerName,
  trackingCode,
  pickupAddress,
  deliveryAddress,
  packages,
  estimatedWeightKg,
  distanceKm,
  serviceType,
  quotedAmount,
  avionetaCount,
  requiredDate,
  requiredTime,
  internalNotes,
  isUpdate,
  logoUrl,
  companyName,
  supportEmail,
  confirmUrl,
}) {
  const name = companyName || "DropIt Service";
  const peonetas = Number(avionetaCount) || 0;
  const total = Number(quotedAmount) || 0;
  const titleText = isUpdate ? "Cotización actualizada" : "Cotización confirmada";
  const subtitleText = isUpdate
    ? "Hemos ajustado tu propuesta con los nuevos parámetros"
    : "Tu propuesta final está lista";

  return wrapper(`
    ${header(titleText, subtitleText, logoUrl, name)}
    ${body(`
      <tr><td>
        <p style="margin:0 0 14px;font-size:15px;color:${BRAND.text};font-family:Arial,sans-serif;">
          Hola <strong>${customerName}</strong>,
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.65;font-family:Arial,sans-serif;">
          ${isUpdate
            ? "Te enviamos la <strong>versión actualizada</strong> de tu cotización con los ajustes aplicados. Si todo está conforme, confirma para agendar el retiro."
            : "Tu solicitud fue procesada y este es el <strong>valor final</strong> de tu servicio de transporte. Si lo confirmas, agendamos el retiro de inmediato."}
        </p>

        <!-- Precio destacado -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.accent},${BRAND.accentDark});padding:24px 28px;border-radius:14px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Valor total del servicio</p>
              <p style="margin:0;font-size:36px;color:#fff;font-family:Arial,sans-serif;font-weight:900;letter-spacing:-1px;line-height:1.1;">
                $${total.toLocaleString("es-CL")} <span style="font-size:14px;font-weight:600;opacity:.8;">CLP</span>
              </p>
              ${peonetas > 0 ? `<p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;">Incluye ${peonetas} peoneta${peonetas > 1 ? "s" : ""} profesional${peonetas > 1 ? "es" : ""} para la carga</p>` : ""}
            </td>
          </tr>
        </table>

        ${infoBox([
          ["Código de seguimiento", `<strong style="font-family:monospace;color:${BRAND.accent};">${trackingCode || "—"}</strong>`],
          ["Tipo de servicio",       serviceType || "—"],
          ["📦 Retiro",              pickupAddress || "—"],
          ["🏁 Entrega",             deliveryAddress || "—"],
          ["Bultos / Peso total",     `${packages || "—"} bultos · ${estimatedWeightKg || "—"} kg en total`],
          ...(distanceKm ? [["Distancia", `${distanceKm} km`]] : []),
          ...(peonetas > 0 ? [["Ayudantes incluidos", `${peonetas} peoneta${peonetas > 1 ? "s" : ""}`]] : []),
          ...(requiredDate ? [["Fecha solicitada", `${requiredDate}${requiredTime ? ` · ${requiredTime}` : ""}`]] : []),
        ])}

        ${internalNotes ? `
          <div style="margin-top:18px;padding:14px 18px;background:#fff7ed;border-left:3px solid ${BRAND.accent};border-radius:6px;">
            <p style="margin:0 0 4px;font-size:11px;color:${BRAND.accentDeep};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Comentarios del operador</p>
            <p style="margin:0;font-size:13px;color:#374151;font-family:Arial,sans-serif;line-height:1.6;">${internalNotes}</p>
          </div>
        ` : ""}

        <div style="margin-top:24px;padding:14px 18px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
          <p style="margin:0;font-size:13px;color:#166534;font-family:Arial,sans-serif;line-height:1.55;">
            ✅ <strong>Para confirmar el servicio</strong>, responde este correo o escríbenos a <a href="mailto:${supportEmail || "soporte@dropit.cl"}" style="color:${BRAND.accent};font-weight:700;text-decoration:none;">${supportEmail || "soporte@dropit.cl"}</a>.
          </p>
        </div>

        <div style="text-align:center;margin:24px 0">
          <a href="${confirmUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/tracking?code=${trackingCode}`}"
             style="display:inline-block;background:#F97316;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">
            Ver mi cotización online →
          </a>
          <p style="margin-top:8px;font-size:12px;color:#6b7280;font-family:Arial,sans-serif">También puedes abrir el archivo adjunto para ver el detalle completo</p>
        </div>
      </td></tr>
    `)}
    ${footer(`
      <tr><td align="center">
        <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;">El valor es válido por 24 horas. Una vez confirmado, agendamos el retiro.</p>
        ${confirmUrl
          ? button("✅ Confirmar cotización online", confirmUrl)
          : button("📩 Confirmar cotización", `mailto:${supportEmail || "soporte@dropit.cl"}?subject=Confirmo cotización ${trackingCode}&body=Hola, confirmo la cotización ${trackingCode} por $${total.toLocaleString("es-CL")}.`)
        }
      </td></tr>
      ${confirmUrl ? `
      <tr><td align="center" style="padding-top:12px;">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);font-family:Arial,sans-serif;">
          O escribe a <a href="mailto:${supportEmail || "soporte@dropit.cl"}" style="color:${BRAND.accent};">${supportEmail || "soporte@dropit.cl"}</a> para confirmar por correo.
        </p>
      </td></tr>` : ""}
    `)}
  `, name);
}

// ─── Status update → client ───────────────────────────────────────────────────
export function tplEstadoPedido({ customerName, status, trackingCode, eta, conductorName, conductorPhone, trackingUrl, logoUrl, companyName }) {
  const name = companyName || "DropIt Service";
  const statusColors = { "Programado":"#0ea5e9", "En ruta":BRAND.accent, "En camino":"#f59e0b", "Entregado":"#10b981", "Fallido":"#ef4444" };
  const color = statusColors[status] || BRAND.accent;
  return wrapper(`
    ${header(`Tu pedido: ${status}`, trackingCode ? `Código de seguimiento: ${trackingCode}` : "", logoUrl, name)}
    ${body(`
      <tr><td>
        <p style="margin:0 0 16px;font-size:15px;color:${BRAND.text};font-family:Arial,sans-serif;">Hola <strong>${customerName}</strong>,</p>
        <div style="text-align:center;padding:20px 0;">${badge(status, color)}</div>
        ${infoBox([
          ...(conductorName  ? [["Conductor",    conductorName]]  : []),
          ...(conductorPhone ? [["Contacto",     conductorPhone]] : []),
          ...(eta            ? [["Hora estimada", `<strong style="color:${color}">${eta}</strong>`]] : []),
          ["Código",          `<strong style="color:${BRAND.accent}">${trackingCode || "—"}</strong>`],
        ])}
      </td></tr>
    `)}
    ${footer(`
      <tr><td align="center">
        ${button("📍 Ver seguimiento en vivo", trackingUrl || "https://dropit.cl/cotizar")}
      </td></tr>
    `)}
  `, name);
}

// ─── Test email ───────────────────────────────────────────────────────────────
export function tplPrueba({ templateSubject, senderName, logoUrl, companyName }) {
  const name = companyName || senderName || "DropIt Service";
  return wrapper(`
    ${header("✅ Correo de prueba", "Verificación de configuración SMTP", logoUrl, name)}
    ${body(`
      <tr><td>
        <p style="margin:0 0 12px;font-size:15px;color:${BRAND.text};font-family:Arial,sans-serif;">¡Hola!</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;font-family:Arial,sans-serif;">
          Este es un correo de prueba enviado desde <strong>${name}</strong>.
          La configuración SMTP está funcionando correctamente. 🎉
        </p>
        ${infoBox([
          ["Asunto de prueba", templateSubject || "—"],
          ["Remitente",        name],
          ["Estado",           `<strong style="color:#10b981;">✓ Conexión exitosa</strong>`],
        ])}
      </td></tr>
    `)}
    ${footer(`
      <tr><td align="center">
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);font-family:Arial,sans-serif;">Si recibes este correo, tu configuración SMTP es correcta.</p>
      </td></tr>
    `)}
  `, name);
}
