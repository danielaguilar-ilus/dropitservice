const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Session helpers ─────────────────────────────────────────────────────────
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
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
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

// ─── Helper: añade X-User-Email cuando hay sesión ────────────────────────────
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
  // ─── Quote acceptance ───────────────────────────────────────────────────────
  acceptQuoteManual: (requestId) =>
    request(`/quote-requests/${requestId}/accept-manual`, { method: "PATCH", body: JSON.stringify({}) }),
  getPublicQuote: (requestId, token) =>
    request(`/quote-requests/${requestId}/public?token=${encodeURIComponent(token || "")}`),
  acceptQuote: (requestId, token) =>
    request(`/quote-requests/${requestId}/accept`, { method: "PATCH", body: JSON.stringify({ token }) }),

  sendEmail: (payload) =>
    request("/mail/send", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),
  getMailHealth: () => request("/mail/health", { headers: withActor() }),
  testSmtp: () => request("/mail/test", { method: "POST", headers: withActor() }),
  updateSmtpConfig: (payload) =>
    request("/mail/config", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),
  sendWhatsApp: (payload) =>
    request("/whatsapp/send", { method: "POST", body: JSON.stringify(payload), headers: withActor() }),

  // ─── Users management (require super_admin) ────────────────────────────────
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
