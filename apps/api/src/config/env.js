import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  mapboxToken: process.env.MAPBOX_TOKEN || "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  appOriginAddress: process.env.APP_ORIGIN_ADDRESS || "Nunoa, Santiago de Chile",
  // Public-facing URL of this deployment (used in email links, PDF CTAs).
  // Set to the Cloud Run URL or custom domain in production.
  publicUrl: process.env.PUBLIC_URL || "",
  // Operator inbox — receives new-quote alerts. Falls back to SMTP_USER.
  operatorEmail: process.env.OPERATOR_EMAIL || "",
  // Contact email shown to clients (in PDFs, email footers).
  contactEmail: process.env.CONTACT_EMAIL || "",
  // WhatsApp number for CTAs (full Chilean format: 569XXXXXXXX)
  waNumber: process.env.WA_NUMBER || "",
  smtpFrom: process.env.SMTP_FROM || "DropIt Service",
  // Gmail OAuth2 (preferred) — set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN
  gmailUser:          process.env.GMAIL_USER           || process.env.SMTP_USER || "",
  gmailClientId:      process.env.GMAIL_CLIENT_ID      || "",
  gmailClientSecret:  process.env.GMAIL_CLIENT_SECRET  || "",
  gmailRefreshToken:  process.env.GMAIL_REFRESH_TOKEN  || "",
};
