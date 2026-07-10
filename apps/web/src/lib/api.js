const API_URL = import.meta.env.VITE_API_URL || "/api";

// â”€â”€â”€ Session helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// El login persiste el email en localStorage para que las llamadas a /users
// (que requieren X-User-Email) puedan identificar al actor sin estado global.
const CURRENT_EMAIL_KEY = "dropit-current-email";

export function getCurrentUserEmail() {
  try {
    return localStorage.getItem(CURRENT_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function setCurrentUserEmail(email) {
  try {
    if (email) localStorage.setItem(CURRENT_EMAIL_KEY, email);
    else localStorage.removeItem(CURRENT_EMAIL_KEY);
  } catch {
    // ignore
  }
}

async function request(path, options = {}) {
  // IMPORTANTE: extraer headers de options ANTES del spread. Si hacemos
  // `{ headers: {...}, ...options }`, el spread re-inyecta options.headers y
  // pisa el merge â€” perdiendo Content-Type cuando el caller pasa headers
  // (p.ej. withActor()). Eso dejaba el body sin parsear en el backend.
  const { headers: callerHeaders, ...rest } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(callerHeaders || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || "No fue posible completar la accion");
    error.details = payload.errors || [];
    error.status = response.status;
    throw error;
  }

  return payload;
}

// â”€â”€â”€ Helper: añade X-User-Email cuando hay sesión â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function withActor(headers = {}) {
  const email = getCurrentUserEmail();
  if (email) return { ...headers, "X-User-Email": email };
  return headers;
}

export const api = {
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getBootstrap: () => request("/dashboard/bootstrap"),
  createQuoteRequest: (payload) =>
    request("/quote-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sendQuote: (requestId, payload) =>
    request(`/quote-requests/${requestId}/quote`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  importOrders: (rows) =>
    request("/imports/orders", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  createRoutePlan: (payload) =>
    request("/planning/routes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateOrderStatus: (orderId, payload) =>
    request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createTruck: (payload) =>
    request("/trucks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTracking: (code) => request(`/tracking/${code}`),
  // â”€â”€â”€ Quote acceptance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  acceptQuoteManual: (requestId) =>
    request(`/quote-requests/${requestId}/accept-manual`, { method: "PATCH", body: JSON.stringify({}) }),
  getPublicQuote: (requestId, token) =>
    request(`/quote-requests/${requestId}/public?token=${encodeURIComponent(token || "")}`),
  acceptQuote: (requestId, token) =>
    request(`/quote-requests/${requestId}/accept`, { method: "PATCH", body: JSON.stringify({ token }) }),

  sendEmail: (payload) =>
    request("/mail/send", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),
  getMailHealth: () => request("/mail/health", { headers: withActor() }),
  getMailConfig: () => request("/mail/config", { headers: withActor() }),
  testSmtp: () => request("/mail/test", { method: "POST", body: JSON.stringify({}), headers: withActor() }),
  updateSmtpConfig: (payload) =>
    request("/mail/config", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),
  sendWhatsApp: (payload) =>
    request("/whatsapp/send", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),

  // â”€â”€â”€ Users management (require super_admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  listUsers: () =>
    request("/users", { headers: withActor() }),
  createUser: (payload) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: withActor(),
    }),
  updateUser: (id, payload) =>
    request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: withActor(),
    }),
  changePassword: (id, newPassword) =>
    request(`/users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
      headers: withActor(),
    }),
  deactivateUser: (id) =>
    request(`/users/${id}`, {
      method: "DELETE",
      headers: withActor(),
    }),
};
