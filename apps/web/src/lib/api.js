const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

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
    throw error;
  }

  return payload;
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
  sendEmail: (payload) =>
    request("/mail/send", { method: "POST", body: JSON.stringify(payload) }),
  testSmtp: () => request("/mail/test", { method: "POST" }),
  updateSmtpConfig: (payload) =>
    request("/mail/config", { method: "POST", body: JSON.stringify(payload) }),
  sendWhatsApp: (payload) =>
    request("/whatsapp/send", { method: "POST", body: JSON.stringify(payload) }),
};
