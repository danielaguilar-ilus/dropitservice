const STORAGE_KEY = "dropit-static-platform-v2";
const SESSION_KEY = "dropit-static-session-v2";

const adminUser = {
  name: "Juandaniel Aguilar",
  email: "Juandaniel.aguilar17@gmail.com",
  password: "19109364Daniel",
  role: "Super administrador",
};

const workflow = [
  "Solicitud recibida",
  "Cotizacion enviada",
  "Aceptado por cliente",
  "Pedido agendado",
  "Asignado a camion / chofer",
  "En preparacion",
  "En ruta",
  "Pedido entregado",
];

const statusMap = {
  "Solicitud recibida": "pending",
  "Pendiente de cotizacion": "pending",
  "Cotizacion enviada": "blue",
  "Aceptado por cliente": "blue",
  "Pedido agendado": "blue",
  "Asignado a camion / chofer": "blue",
  "En preparacion": "blue",
  "En ruta": "blue",
  "Pedido entregado": "green",
  "Pedido no conforme": "red",
};

const initialState = {
  requests: [
    {
      id: "SOL-1001",
      trackingCode: "DRP-1001",
      customerName: "Comercial Los Aromos",
      contactPerson: "Valentina Rojas",
      phone: "+56 9 4444 1200",
      email: "valentina@losaromos.cl",
      pickupAddress: "Av. Irarrazaval 2401, Nunoa",
      deliveryAddress: "Av. Apoquindo 4501, Las Condes",
      city: "Las Condes",
      packages: 18,
      weight: 420,
      cargoDescription: "Cajas selladas de productos comerciales",
      requiredDate: "2026-05-06",
      observations: "Retiro por estacionamiento subterraneo",
      status: "Solicitud recibida",
      quoteAmount: "",
      serviceType: "",
      internalNotes: "",
      truckId: "",
      truckName: "",
      driverName: "",
      routeId: "",
      incident: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: "SOL-1002",
      trackingCode: "DRP-1002",
      customerName: "Carga Importada Santiago",
      contactPerson: "Mauricio Vega",
      phone: "+56 9 5555 4455",
      email: "operaciones@cargaimportada.cl",
      pickupAddress: "Nunoa, Santiago",
      deliveryAddress: "Camino El Alba 11969, Las Condes",
      city: "Las Condes",
      packages: 32,
      weight: 950,
      cargoDescription: "Bultos medianos para entrega comercial",
      requiredDate: "2026-05-07",
      observations: "Requiere dos personas para descarga",
      status: "Cotizacion enviada",
      quoteAmount: 78000,
      serviceType: "Flete urbano",
      internalNotes: "Cliente recurrente",
      truckId: "",
      truckName: "",
      driverName: "",
      routeId: "",
      incident: "",
      createdAt: new Date().toISOString(),
    },
  ],
  trucks: [
    {
      id: "TRK-01",
      name: "Camion 1",
      plate: "LTKF-21",
      maxWeight: 1500,
      maxPackages: 80,
      driver: "Daniel Aguilar",
      driverPhone: "+56 9 1111 1111",
      status: "Disponible",
    },
    {
      id: "TRK-02",
      name: "Camion 2",
      plate: "PHKZ-88",
      maxWeight: 3000,
      maxPackages: 140,
      driver: "Chofer por asignar",
      driverPhone: "+56 9 2222 2222",
      status: "Disponible",
    },
    {
      id: "TRK-03",
      name: "Camion 3",
      plate: "TRSA-41",
      maxWeight: 5000,
      maxPackages: 220,
      driver: "Chofer eventual",
      driverPhone: "+56 9 3333 3333",
      status: "Mantencion",
    },
  ],
  routes: [],
  notifications: [],
};

let state = loadState();
let publicView = "quote";
let adminView = "dashboard";
let selectedQuoteId = "";
let selectedRouteIds = [];

const publicApp = document.getElementById("publicApp");
const adminApp = document.getElementById("adminApp");
const publicHeader = document.getElementById("publicHeader");
const loginDialog = document.getElementById("loginDialog");
const toast = document.getElementById("toast");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(initialState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isAdminSession() {
  return localStorage.getItem(SESSION_KEY) === "active";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function money(value) {
  if (!value) return "-";
  return `$${Number(value).toLocaleString("es-CL")}`;
}

function statusClass(status) {
  return statusMap[status] || "blue";
}

function notify(type, to, request) {
  state.notifications.unshift({
    id: `NOT-${Date.now()}`,
    type,
    to,
    requestId: request.id,
    status: "Simulado",
    createdAt: new Date().toISOString(),
  });
}

function nextRequestId() {
  return `SOL-${1001 + state.requests.length}`;
}

function nextTrackingCode() {
  return `DRP-${1001 + state.requests.length}`;
}

function render() {
  if (isAdminSession()) {
    publicHeader.classList.add("hidden");
    publicApp.classList.add("hidden");
    adminApp.classList.remove("hidden");
    renderAdmin();
    return;
  }

  publicHeader.classList.remove("hidden");
  publicApp.classList.remove("hidden");
  adminApp.classList.add("hidden");
  renderPublic();
}

function renderPublic() {
  document.querySelectorAll("[data-public-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.publicView === publicView);
  });

  if (publicView === "tracking") {
    renderTrackingPublic();
    return;
  }

  publicApp.innerHTML = `
    <section class="hero-band">
      <div class="hero-copy">
        <p class="muted" style="color:#bfdbfe;font-weight:800;text-transform:uppercase">Solicitud de transporte</p>
        <h1>Agenda tu flete y solicita cotizacion en Dropit.</h1>
        <p>
          Completa los datos del retiro y entrega. Tu solicitud queda registrada,
          recibe numero de referencia y avanza al panel administrativo para cotizacion,
          agenda, asignacion de camion y seguimiento.
        </p>
        <div class="kpi-strip">
          <div class="kpi"><strong>3</strong><span>camiones disponibles para planificar</span></div>
          <div class="kpi"><strong>8</strong><span>estados de trazabilidad cliente</span></div>
          <div class="kpi"><strong>24h</strong><span>control operativo para ultima milla</span></div>
        </div>
      </div>
      <form class="panel" id="customerQuoteForm">
        <div class="panel-title">
          <div>
            <h2>Formulario de cotizacion</h2>
            <p>Todos los campos son obligatorios para poder cotizar correctamente.</p>
          </div>
        </div>
        <div class="form-grid">
          ${field("customerName", "Nombre cliente o empresa")}
          ${field("contactPerson", "Persona de contacto")}
          ${field("phone", "Telefono de contacto")}
          ${field("email", "Correo electronico", "email")}
          ${field("pickupAddress", "Direccion de retiro")}
          ${field("deliveryAddress", "Direccion de entrega")}
          ${field("city", "Comuna / ciudad destino")}
          ${field("packages", "Cantidad de bultos", "number")}
          ${field("weight", "Peso estimado", "number")}
          ${field("requiredDate", "Fecha requerida del servicio", "date")}
          ${textField("cargoDescription", "Descripcion de la carga")}
          ${textField("observations", "Observaciones")}
        </div>
        <div id="customerResult"></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Enviar solicitud</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById("customerQuoteForm").addEventListener("submit", handleCustomerSubmit);
}

function field(name, label, type = "text") {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" required />
    </label>
  `;
}

function textField(name, label) {
  return `
    <label class="field full">
      <span>${label}</span>
      <textarea name="${name}" required></textarea>
    </label>
  `;
}

function handleCustomerSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const request = {
    id: nextRequestId(),
    trackingCode: nextTrackingCode(),
    customerName: formData.get("customerName").trim(),
    contactPerson: formData.get("contactPerson").trim(),
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim(),
    pickupAddress: formData.get("pickupAddress").trim(),
    deliveryAddress: formData.get("deliveryAddress").trim(),
    city: formData.get("city").trim(),
    packages: Number(formData.get("packages")),
    weight: Number(formData.get("weight")),
    cargoDescription: formData.get("cargoDescription").trim(),
    requiredDate: formData.get("requiredDate"),
    observations: formData.get("observations").trim(),
    status: "Solicitud recibida",
    quoteAmount: "",
    serviceType: "",
    internalNotes: "",
    truckId: "",
    truckName: "",
    driverName: "",
    routeId: "",
    incident: "",
    createdAt: new Date().toISOString(),
  };

  state.requests.unshift(request);
  notify("Recepcion de solicitud al cliente", request.email, request);
  notify("Nueva solicitud para cotizar", "admin@dropit.local", request);
  saveState();
  event.currentTarget.reset();

  document.getElementById("customerResult").innerHTML = `
    <div class="success-box" style="margin-top:16px">
      <strong>Solicitud recibida.</strong><br />
      ID de referencia: ${request.id}<br />
      Codigo de seguimiento: ${request.trackingCode}<br />
      Se notifico al cliente y al administrador para iniciar la cotizacion.
    </div>
  `;
  showToast("Solicitud registrada y notificaciones simuladas creadas.");
}

function renderTrackingPublic() {
  publicApp.innerHTML = `
    <section class="split">
      <form class="panel" id="trackingForm">
        <div class="panel-title">
          <div>
            <h2>Seguimiento de pedido</h2>
            <p>Ingresa tu codigo de tracking o ID de solicitud.</p>
          </div>
        </div>
        <label class="field">
          <span>Codigo</span>
          <input name="code" value="DRP-1001" required />
        </label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Buscar pedido</button>
        </div>
      </form>
      <section class="panel" id="trackingResult">
        <p class="muted">Aun no hay una busqueda activa.</p>
      </section>
    </section>
  `;

  document.getElementById("trackingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code").trim();
    const request = findByTracking(code);
    const result = document.getElementById("trackingResult");

    if (!request) {
      result.innerHTML = `<p class="form-message">No encontramos un pedido con ese codigo.</p>`;
      return;
    }

    result.innerHTML = trackingMarkup(request, true);
    const acceptButton = result.querySelector("[data-accept-quote]");
    if (acceptButton) {
      acceptButton.addEventListener("click", () => {
        request.status = "Aceptado por cliente";
        notify("Cotizacion aceptada por cliente", "admin@dropit.local", request);
        saveState();
        renderTrackingPublic();
        showToast("Cotizacion aceptada. El pedido queda listo para agenda.");
      });
    }
  });
}

function findByTracking(code) {
  return state.requests.find((request) => request.trackingCode === code || request.id === code);
}

function trackingMarkup(request, allowAccept = false) {
  const visibleWorkflow = request.incident ? [...workflow, "Pedido no conforme"] : workflow;
  const currentIndex = visibleWorkflow.indexOf(request.status);

  return `
    <div class="tracking-card">
      <div class="panel-title">
        <div>
          <h3>${request.customerName}</h3>
          <p>${request.id} - ${request.trackingCode}</p>
        </div>
        ${statusBadge(request.status)}
      </div>
      <div class="success-box" style="background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">
        Retiro: ${request.pickupAddress}<br />
        Entrega: ${request.deliveryAddress}<br />
        ${request.truckName ? `Camion: ${request.truckName} - Chofer: ${request.driverName}` : "Camion pendiente de asignacion"}
      </div>
      ${request.status === "Cotizacion enviada" && allowAccept ? `
        <div class="success-box" style="background:#f8fafc;border-color:#cbd5e1;color:#334155">
          Valor cotizado: <strong>${money(request.quoteAmount)}</strong><br />
          Servicio: ${request.serviceType}
          <div class="form-actions" style="justify-content:flex-start">
            <button class="btn btn-primary" data-accept-quote>Aceptar cotizacion</button>
          </div>
        </div>
      ` : ""}
      <div class="timeline">
        ${visibleWorkflow.map((status, index) => `
          <div class="timeline-step ${index < currentIndex ? "done" : ""} ${index === currentIndex ? "active" : ""}">
            <span class="timeline-dot"></span>
            <strong>${status}</strong>
          </div>
        `).join("")}
      </div>
      ${request.incident ? `<div class="success-box" style="background:#fee2e2;border-color:#fecaca;color:#991b1b">${request.incident}</div>` : ""}
    </div>
  `;
}

function statusBadge(status) {
  return `<span class="status ${statusClass(status)}">${status}</span>`;
}

function renderAdmin() {
  adminApp.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <img src="./assets/dropit-logo.jpeg" alt="Dropit" />
          <div>
            <strong>Dropit</strong><br />
            <span class="muted">Panel administrador</span>
          </div>
        </div>
        <nav class="admin-nav">
          ${adminNavButton("dashboard", "Dashboard")}
          ${adminNavButton("quotes", "Cotizar solicitudes")}
          ${adminNavButton("bulk", "Carga masiva")}
          ${adminNavButton("planning", "Planificacion de ruta")}
          ${adminNavButton("fleet", "Camiones y choferes")}
          ${adminNavButton("tracking", "Tracking")}
        </nav>
        <button class="btn btn-secondary" style="width:100%;margin-top:18px" id="logoutButton">Cerrar sesion</button>
      </aside>
      <section class="admin-main">
        <header class="admin-top">
          <div>
            <span class="muted">Transporte y ultima milla</span>
            <h1>${adminTitle()}</h1>
          </div>
          <div class="muted">${adminUser.name} - ${adminUser.role}</div>
        </header>
        <div id="adminContent"></div>
      </section>
    </div>
  `;

  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => {
      adminView = button.dataset.adminView;
      renderAdmin();
    });
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    render();
  });

  renderAdminContent();
}

function adminNavButton(view, label) {
  return `<button data-admin-view="${view}" class="${adminView === view ? "is-active" : ""}">${label}</button>`;
}

function adminTitle() {
  return {
    dashboard: "Dashboard operacional",
    quotes: "Cotizacion administrativa",
    bulk: "Importar pedidos",
    planning: "Planificacion de ruta",
    fleet: "Camiones y choferes",
    tracking: "Tracking cliente",
  }[adminView];
}

function renderAdminContent() {
  const content = document.getElementById("adminContent");

  if (adminView === "quotes") return renderQuotesAdmin(content);
  if (adminView === "bulk") return renderBulkImport(content);
  if (adminView === "planning") return renderPlanning(content);
  if (adminView === "fleet") return renderFleet(content);
  if (adminView === "tracking") return renderTrackingAdmin(content);
  return renderDashboard(content);
}

function renderDashboard(content) {
  const stats = {
    pending: count("Solicitud recibida"),
    quoted: count("Cotizacion enviada"),
    accepted: count("Aceptado por cliente"),
    scheduled: count("Pedido agendado"),
    onRoute: count("En ruta"),
    delivered: count("Pedido entregado"),
    incidents: state.requests.filter((request) => request.incident).length,
    routes: state.routes.length,
    trucksAvailable: state.trucks.filter((truck) => truck.status === "Disponible").length,
    trucksRoute: state.trucks.filter((truck) => truck.status === "En ruta").length,
  };

  content.innerHTML = `
    <section class="grid-kpis">
      ${metric("Pendientes cotizacion", stats.pending)}
      ${metric("Cotizados", stats.quoted)}
      ${metric("Aceptados", stats.accepted)}
      ${metric("Agendados", stats.scheduled)}
      ${metric("En ruta", stats.onRoute)}
      ${metric("Entregados", stats.delivered)}
      ${metric("Incidencias", stats.incidents)}
      ${metric("Rutas activas", stats.routes)}
      ${metric("Camiones disponibles", stats.trucksAvailable)}
      ${metric("Camiones en ruta", stats.trucksRoute)}
    </section>
    <section class="panel">
      <div class="panel-title">
        <div>
          <h3>Pedidos recientes</h3>
          <p>Vista operacional del flujo completo.</p>
        </div>
      </div>
      ${requestsTable(state.requests)}
    </section>
  `;
}

function metric(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
}

function count(status) {
  return state.requests.filter((request) => request.status === status).length;
}

function requestsTable(requests) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Cliente</th><th>Destino</th><th>Fecha</th><th>Estado</th><th>Camion</th><th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((request) => `
            <tr>
              <td><strong>${request.id}</strong><br /><span class="muted">${request.trackingCode}</span></td>
              <td>${request.customerName}<br /><span class="muted">${request.contactPerson}</span></td>
              <td>${request.city}<br /><span class="muted">${request.deliveryAddress}</span></td>
              <td>${request.requiredDate || "-"}</td>
              <td>${statusBadge(request.status)}</td>
              <td>${request.truckName || "-"}</td>
              <td>${money(request.quoteAmount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQuotesAdmin(content) {
  const pending = state.requests.filter((request) => request.status === "Solicitud recibida");
  const selected = state.requests.find((request) => request.id === selectedQuoteId) || pending[0] || state.requests[0];
  selectedQuoteId = selected?.id || "";

  content.innerHTML = `
    <section class="split">
      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>Solicitudes pendientes</h3>
            <p>Selecciona una solicitud y envia la propuesta al cliente.</p>
          </div>
        </div>
        <div class="list">
          ${pending.map((request) => `
            <button class="row-card ${request.id === selectedQuoteId ? "selected" : ""}" data-select-quote="${request.id}">
              <strong>${request.customerName}</strong><br />
              <span class="muted">${request.id} - ${request.city} - ${request.packages} bultos</span>
            </button>
          `).join("") || `<p class="muted">No hay solicitudes pendientes de cotizacion.</p>`}
        </div>
      </div>
      <form class="panel" id="quoteAdminForm">
        <div class="panel-title">
          <div>
            <h3>${selected ? selected.customerName : "Sin solicitud seleccionada"}</h3>
            <p>${selected ? `${selected.id} - ${selected.trackingCode}` : ""}</p>
          </div>
          ${selected ? statusBadge(selected.status) : ""}
        </div>
        ${selected ? requestDetails(selected) : ""}
        <div class="form-grid">
          <label class="field">
            <span>Costo del servicio</span>
            <input name="quoteAmount" type="number" required />
          </label>
          <label class="field">
            <span>Tipo de servicio</span>
            <select name="serviceType" required>
              <option>Flete urbano</option>
              <option>Ultima milla</option>
              <option>Mudanza</option>
              <option>Traslado especial</option>
              <option>Ruta dedicada</option>
            </select>
          </label>
          <label class="field full">
            <span>Observaciones internas</span>
            <textarea name="internalNotes"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" ${selected ? "" : "disabled"}>Enviar cotizacion</button>
        </div>
      </form>
    </section>
  `;

  document.querySelectorAll("[data-select-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedQuoteId = button.dataset.selectQuote;
      renderQuotesAdmin(content);
    });
  });

  document.getElementById("quoteAdminForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    selected.quoteAmount = Number(formData.get("quoteAmount"));
    selected.serviceType = formData.get("serviceType");
    selected.internalNotes = formData.get("internalNotes").trim();
    selected.status = "Cotizacion enviada";
    notify("Cotizacion enviada al cliente", selected.email, selected);
    saveState();
    showToast("Cotizacion enviada. El cliente ya puede aceptarla desde tracking.");
    renderQuotesAdmin(content);
  });
}

function requestDetails(request) {
  return `
    <div class="success-box" style="background:#f8fafc;border-color:#e2e8f0;color:#334155;margin-bottom:14px">
      Contacto: ${request.contactPerson} - ${request.phone} - ${request.email}<br />
      Retiro: ${request.pickupAddress}<br />
      Entrega: ${request.deliveryAddress}<br />
      Carga: ${request.cargoDescription}<br />
      Observaciones: ${request.observations}
    </div>
  `;
}

function renderBulkImport(content) {
  content.innerHTML = `
    <section class="split">
      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>Carga masiva de pedidos</h3>
            <p>Acepta Excel si el navegador carga SheetJS, o CSV como alternativa.</p>
          </div>
        </div>
        <label class="field">
          <span>Archivo Excel o CSV</span>
          <input id="bulkFile" type="file" accept=".xlsx,.xls,.csv" />
        </label>
        <div class="success-box" style="background:#f8fafc;border-color:#e2e8f0;color:#334155;margin-top:16px">
          Obligatorios: Id de referencia, Persona de contacto, Direccion completa,
          Ciudad / comuna, Bultos, Telefono de contacto, Correo electronico de contacto y Peso.
        </div>
      </div>
      <div class="panel" id="bulkPreview">
        <p class="muted">Selecciona un archivo para validar e importar pedidos.</p>
      </div>
    </section>
  `;

  document.getElementById("bulkFile").addEventListener("change", handleBulkFile);
}

async function handleBulkFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  let rows = [];
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    if (!window.XLSX) {
      showToast("No se pudo cargar el lector Excel. Usa CSV o instala la app React.");
      return;
    }
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    const text = await file.text();
    rows = parseCsv(text);
  }

  const normalized = rows.map(normalizeBulkRow);
  const errors = validateBulkRows(normalized);
  const preview = document.getElementById("bulkPreview");

  if (errors.length) {
    preview.innerHTML = `
      <h3>Errores de validacion</h3>
      <div class="list">
        ${errors.map((error) => `<div class="row-card"><strong>Fila ${error.row}</strong><br /><span class="muted">${error.message}</span></div>`).join("")}
      </div>
    `;
    return;
  }

  preview.innerHTML = `
    <div class="panel-title">
      <div>
        <h3>${normalized.length} pedidos listos para importar</h3>
        <p>Quedaran disponibles para planificacion de ruta.</p>
      </div>
    </div>
    ${bulkPreviewTable(normalized)}
    <div class="form-actions">
      <button class="btn btn-primary" id="confirmBulkImport">Importar pedidos</button>
    </div>
  `;

  document.getElementById("confirmBulkImport").addEventListener("click", () => {
    normalized.forEach((row) => {
      state.requests.unshift({
        id: row.id,
        trackingCode: row.trackingCode || `DRP-${row.id.replace(/\D/g, "") || Date.now()}`,
        customerName: row.contactPerson,
        contactPerson: row.contactPerson,
        phone: row.phone,
        email: row.email,
        pickupAddress: row.pickupAddress || "Nunoa, Santiago de Chile",
        deliveryAddress: row.address,
        city: row.city,
        packages: Number(row.packages),
        weight: Number(row.weight),
        cargoDescription: row.skills || "Pedido importado por Excel",
        requiredDate: row.requiredDate || "",
        observations: row.observations || "Importado por carga masiva",
        status: row.cost ? "Aceptado por cliente" : "Solicitud recibida",
        quoteAmount: row.cost ? Number(row.cost) : "",
        serviceType: row.cost ? "Pedido importado" : "",
        internalNotes: "Importado por Excel",
        truckId: "",
        truckName: "",
        driverName: "",
        routeId: "",
        incident: "",
        createdAt: new Date().toISOString(),
      });
    });
    saveState();
    showToast(`${normalized.length} pedidos importados.`);
    renderBulkImport(document.getElementById("adminContent"));
  });
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",").map((header) => header.trim());
  return lines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function normalizeBulkRow(row) {
  return {
    id: row["Id de referencia"] || row.id || row.referenceId || nextRequestId(),
    contactPerson: row["Persona de contacto"] || row.contactPerson || "",
    address: row["Direccion completa"] || row["Dirección completa"] || row.fullAddress || "",
    city: row["Ciudad / comuna"] || row["Habilidades requeridas / ciudad destino"] || row.destinationCity || "",
    skills: row["Habilidades requeridas / ciudad destino"] || row.skills || "",
    packages: row.Bultos || row.packages || "",
    phone: row["Telefono de contacto"] || row["Teléfono de contacto"] || row.contactPhone || "",
    email: row["Correo electronico de contacto"] || row["Correo electrónico de contacto"] || row.contactEmail || "",
    weight: row.Peso || row.weight || "",
    cost: row.Costo || row.cost || "",
  };
}

function validateBulkRows(rows) {
  const required = [
    ["id", "Id de referencia"],
    ["contactPerson", "Persona de contacto"],
    ["address", "Direccion completa"],
    ["city", "Ciudad / comuna"],
    ["packages", "Bultos"],
    ["phone", "Telefono de contacto"],
    ["email", "Correo electronico de contacto"],
    ["weight", "Peso"],
  ];

  return rows.flatMap((row, index) =>
    required
      .filter(([field]) => !row[field])
      .map(([, label]) => ({ row: index + 1, message: `Falta ${label}` }))
  );
}

function bulkPreviewTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Contacto</th><th>Direccion</th><th>Comuna</th><th>Bultos</th><th>Peso</th></tr></thead>
        <tbody>
          ${rows.slice(0, 60).map((row) => `
            <tr><td>${row.id}</td><td>${row.contactPerson}</td><td>${row.address}</td><td>${row.city}</td><td>${row.packages}</td><td>${row.weight}</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlanning(content) {
  const candidates = state.requests.filter((request) =>
    ["Cotizacion enviada", "Aceptado por cliente", "Pedido agendado"].includes(request.status)
  );

  content.innerHTML = `
    <section class="split">
      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>Pedidos disponibles para ruta</h3>
            <p>Selecciona pedidos, asigna camion y define orden.</p>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom:14px">
          <label class="field"><span>Filtrar comuna</span><input id="cityFilter" placeholder="Las Condes" /></label>
          <label class="field"><span>Filtrar fecha</span><input id="dateFilter" type="date" /></label>
        </div>
        <div class="list" id="planningList">
          ${planningListMarkup(candidates)}
        </div>
      </div>
      <form class="panel" id="routeForm">
        <div class="panel-title">
          <div>
            <h3>Crear ruta</h3>
            <p>${selectedRouteIds.length} pedidos seleccionados</p>
          </div>
        </div>
        <div class="form-grid">
          <label class="field full"><span>Nombre de ruta</span><input name="routeName" required /></label>
          <label class="field full"><span>Camion</span><select name="truckId" required>${state.trucks.map((truck) => `<option value="${truck.id}">${truck.name} - ${truck.status}</option>`).join("")}</select></label>
          <label class="field"><span>Fecha ruta</span><input name="routeDate" type="date" required /></label>
          <label class="field"><span>Estado inicial</span><select name="initialStatus"><option>Pedido agendado</option><option>En ruta</option></select></label>
        </div>
        <div class="list" style="margin-top:14px">
          ${selectedRouteIds.map((id, index) => `<div class="row-card">${index + 1}. ${id}</div>`).join("") || `<p class="muted">Aun no hay pedidos seleccionados.</p>`}
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" ${selectedRouteIds.length ? "" : "disabled"}>Crear ruta</button>
        </div>
      </form>
    </section>
  `;

  const renderFiltered = () => {
    const city = document.getElementById("cityFilter").value.toLowerCase();
    const date = document.getElementById("dateFilter").value;
    const filtered = candidates.filter((request) =>
      (!city || request.city.toLowerCase().includes(city)) && (!date || request.requiredDate === date)
    );
    document.getElementById("planningList").innerHTML = planningListMarkup(filtered);
    bindPlanningChecks(content);
  };

  document.getElementById("cityFilter").addEventListener("input", renderFiltered);
  document.getElementById("dateFilter").addEventListener("input", renderFiltered);
  bindPlanningChecks(content);

  document.getElementById("routeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const truck = state.trucks.find((item) => item.id === formData.get("truckId"));
    const route = {
      id: `RUT-${1001 + state.routes.length}`,
      name: formData.get("routeName"),
      truckId: truck.id,
      truckName: truck.name,
      driverName: truck.driver,
      requestIds: [...selectedRouteIds],
      status: formData.get("initialStatus"),
      date: formData.get("routeDate"),
      createdAt: new Date().toISOString(),
    };

    state.routes.unshift(route);
    truck.status = route.status === "En ruta" ? "En ruta" : truck.status;

    selectedRouteIds.forEach((id) => {
      const request = state.requests.find((item) => item.id === id);
      request.routeId = route.id;
      request.truckId = truck.id;
      request.truckName = truck.name;
      request.driverName = truck.driver;
      request.status = route.status === "En ruta" ? "En ruta" : "Pedido agendado";
      notify(request.status, request.email, request);
    });

    selectedRouteIds = [];
    saveState();
    showToast("Ruta creada y pedidos actualizados.");
    renderPlanning(content);
  });
}

function planningListMarkup(requests) {
  return requests.map((request) => `
    <label class="row-card ${selectedRouteIds.includes(request.id) ? "selected" : ""}">
      <input type="checkbox" data-plan-id="${request.id}" ${selectedRouteIds.includes(request.id) ? "checked" : ""} />
      <strong>${request.id} - ${request.customerName}</strong><br />
      <span class="muted">${request.city} - ${request.packages} bultos - ${request.weight} kg</span><br />
      ${statusBadge(request.status)}
    </label>
  `).join("") || `<p class="muted">No hay pedidos disponibles para planificar.</p>`;
}

function bindPlanningChecks(content) {
  document.querySelectorAll("[data-plan-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.planId;
      selectedRouteIds = checkbox.checked
        ? [...new Set([...selectedRouteIds, id])]
        : selectedRouteIds.filter((item) => item !== id);
      renderPlanning(content);
    });
  });
}

function renderFleet(content) {
  content.innerHTML = `
    <section class="split">
      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>Camiones registrados</h3>
            <p>Flota actual de 1 a 3 camiones, preparada para crecer.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Camion</th><th>Patente</th><th>Peso</th><th>Bultos</th><th>Chofer</th><th>Estado</th></tr></thead>
            <tbody>
              ${state.trucks.map((truck) => `
                <tr>
                  <td><strong>${truck.name}</strong></td>
                  <td>${truck.plate}</td>
                  <td>${truck.maxWeight} kg</td>
                  <td>${truck.maxPackages}</td>
                  <td>${truck.driver}<br /><span class="muted">${truck.driverPhone}</span></td>
                  <td>${truck.status}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <form class="panel" id="truckForm">
        <div class="panel-title"><h3>Registrar camion</h3></div>
        <div class="form-grid">
          ${field("name", "Camion")}
          ${field("plate", "Patente")}
          ${field("maxWeight", "Capacidad maxima peso", "number")}
          ${field("maxPackages", "Capacidad maxima bultos", "number")}
          ${field("driver", "Chofer asignado")}
          ${field("driverPhone", "Telefono chofer")}
          <label class="field full"><span>Estado</span><select name="status"><option>Disponible</option><option>En ruta</option><option>Mantencion</option></select></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar camion</button></div>
      </form>
    </section>
  `;

  document.getElementById("truckForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    state.trucks.push({
      id: `TRK-${String(state.trucks.length + 1).padStart(2, "0")}`,
      name: formData.get("name"),
      plate: formData.get("plate"),
      maxWeight: Number(formData.get("maxWeight")),
      maxPackages: Number(formData.get("maxPackages")),
      driver: formData.get("driver"),
      driverPhone: formData.get("driverPhone"),
      status: formData.get("status"),
    });
    saveState();
    showToast("Camion registrado.");
    renderFleet(content);
  });
}

function renderTrackingAdmin(content) {
  content.innerHTML = `
    <section class="split">
      <form class="panel" id="adminTrackingForm">
        <div class="panel-title"><h3>Buscar tracking</h3></div>
        <label class="field"><span>Codigo</span><input name="code" value="DRP-1001" required /></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Buscar</button></div>
      </form>
      <section class="panel" id="adminTrackingResult"><p class="muted">Busca un pedido para ver y modificar estados.</p></section>
    </section>
  `;

  document.getElementById("adminTrackingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    const request = findByTracking(code);
    const result = document.getElementById("adminTrackingResult");

    if (!request) {
      result.innerHTML = `<p class="form-message">Pedido no encontrado.</p>`;
      return;
    }

    result.innerHTML = `
      ${trackingMarkup(request)}
      <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap">
        ${["Aceptado por cliente", "Pedido agendado", "Asignado a camion / chofer", "En preparacion", "En ruta", "Pedido entregado"].map((status) => `
          <button class="btn btn-secondary" data-set-status="${status}">${status}</button>
        `).join("")}
        <button class="btn btn-danger" data-set-incident>Pedido no conforme</button>
      </div>
    `;

    result.querySelectorAll("[data-set-status]").forEach((button) => {
      button.addEventListener("click", () => {
        request.status = button.dataset.setStatus;
        request.incident = "";
        notify(request.status, request.email, request);
        saveState();
        renderTrackingAdmin(content);
        showToast("Estado actualizado.");
      });
    });

    result.querySelector("[data-set-incident]").addEventListener("click", () => {
      request.status = "Pedido no conforme";
      request.incident = "Incidencia registrada por administracion.";
      notify("Incidencia o pedido no conforme", request.email, request);
      saveState();
      renderTrackingAdmin(content);
      showToast("Incidencia registrada.");
    });
  });
}

document.querySelectorAll("[data-public-view]").forEach((button) => {
  button.addEventListener("click", () => {
    publicView = button.dataset.publicView;
    renderPublic();
  });
});

document.getElementById("openLoginButton").addEventListener("click", () => {
  document.getElementById("loginEmail").value = adminUser.email;
  document.getElementById("loginPassword").value = adminUser.password;
  document.getElementById("loginMessage").textContent = "";
  loginDialog.showModal();
});

document.getElementById("closeLoginButton").addEventListener("click", () => {
  loginDialog.close();
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (email !== adminUser.email.toLowerCase() || password !== adminUser.password) {
    document.getElementById("loginMessage").textContent = "Credenciales invalidas.";
    return;
  }

  localStorage.setItem(SESSION_KEY, "active");
  loginDialog.close();
  render();
});

render();
