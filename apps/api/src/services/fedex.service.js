import { env } from "../config/env.js";

const FEDEX_BASE = "https://apis.fedex.com";

// Token cache per project (rates vs tracking have different credentials)
const tokenCache = {
  rates: { token: null, expiresAt: 0 },
  tracking: { token: null, expiresAt: 0 },
};

async function getToken(project) {
  const cache = tokenCache[project];
  if (cache.token && Date.now() < cache.expiresAt - 30_000) {
    return cache.token;
  }

  const clientId = project === "rates" ? env.fedexRatesClientId : env.fedexTrackingClientId;
  const clientSecret = project === "rates" ? env.fedexRatesClientSecret : env.fedexTrackingClientSecret;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${FEDEX_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FedEx auth error (${project}): ${text}`);
  }

  const data = await response.json();
  cache.token = data.access_token;
  cache.expiresAt = Date.now() + data.expires_in * 1000;
  return cache.token;
}

export async function getRatesAndTransitTimes(payload) {
  const token = await getToken("rates");

  const body = {
    accountNumber: { value: env.fedexAccountNumber },
    requestedShipment: payload.requestedShipment,
    carrierCodes: payload.carrierCodes || ["FDXE"],
    returnLocalizedDateTime: true,
    webSiteCountryCode: payload.webSiteCountryCode || "CL",
  };

  const response = await fetch(`${FEDEX_BASE}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message || `FedEx rates error ${response.status}`);
  }
  return data;
}

export async function trackByNumber(trackingNumber, carrierCode = "FDXE") {
  const token = await getToken("tracking");

  const response = await fetch(`${FEDEX_BASE}/track/v1/trackingnumbers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      trackingInfo: [{ trackingNumberInfo: { trackingNumber, carrierCode } }],
      includeDetailedScans: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message || `FedEx tracking error ${response.status}`);
  }
  return data;
}
