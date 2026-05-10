import twilio from "twilio";

/**
 * Send a WhatsApp message via Twilio.
 * @param {Object} opts
 * @param {string} opts.accountSid   - Twilio Account SID
 * @param {string} opts.authToken    - Twilio Auth Token
 * @param {string} opts.from         - From number e.g. "whatsapp:+14155238886"
 * @param {string} opts.to           - To number e.g. "+56912345678" (auto-prefixed with whatsapp:)
 * @param {string} opts.body         - Message text
 */
// Extract just the SID from a URL if the user accidentally pasted the full URL
function cleanSid(value) {
  if (!value) return value;
  // e.g. "AC766e.../Messages.json" → "AC766e..."
  const match = value.match(/(AC[a-f0-9]{32})/i);
  return match ? match[1] : value.trim();
}

export async function sendWhatsApp({ accountSid, authToken, from, to, body, contentSid, contentVariables }) {
  const sid = cleanSid(accountSid);
  if (!sid || !authToken || authToken === "[AuthToken]") {
    throw new Error("Account SID o Auth Token inválidos. Revisa la configuración.");
  }
  if (!from || !to) {
    throw new Error("Faltan números de origen y destino.");
  }

  const client = twilio(sid, authToken);

  const fromNumber = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const toNumber   = to.startsWith("whatsapp:")   ? to   : `whatsapp:${to}`;

  const params = { from: fromNumber, to: toNumber };

  if (contentSid) {
    // Template-based (required for business-initiated messages in sandbox)
    params.contentSid = contentSid;
    if (contentVariables) params.contentVariables = JSON.stringify(contentVariables);
  } else if (body) {
    params.body = body;
  } else {
    throw new Error("Se requiere 'body' o 'contentSid'.");
  }

  const message = await client.messages.create(params);
  return { sid: message.sid, status: message.status };
}
