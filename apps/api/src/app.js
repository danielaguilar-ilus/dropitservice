import cors from "cors";
import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import apiRoutes from "./routes/index.js";

const IS_PROD = process.env.NODE_ENV === "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const UPLOADS_DIR = join(__dirname, "../uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// â”€â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// En producciÃ³n restringimos al origen del frontend (PUBLIC_URL) y al dominio
// pÃºblico que asigna Railway. En desarrollo permitimos cualquier origen para
// agilizar el trabajo local. Como la API sirve el SPA desde el mismo dominio,
// la mayorÃ­a de las peticiones en prod son same-origin de todas formas.
function buildCorsOptions() {
  if (!IS_PROD) return {}; // dev: abierto
  const allowed = new Set();
  if (process.env.PUBLIC_URL) allowed.add(process.env.PUBLIC_URL.replace(/\/$/, ""));
  if (process.env.RAILWAY_PUBLIC_DOMAIN) allowed.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  // Sin allowlist configurada â†’ reflejar el origen (no romper), pero avisar.
  if (allowed.size === 0) {
    console.warn("[cors] PUBLIC_URL no configurado en producciÃ³n â€” CORS abierto. ConfigÃºralo para restringir.");
    return {};
  }
  return {
    origin(origin, cb) {
      // Permite peticiones sin Origin (curl, same-origin, health checks)
      if (!origin || allowed.has(origin.replace(/\/$/, ""))) return cb(null, true);
      return cb(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  };
}

export function createApp() {
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Serve persisted quote photos (saved by request.service.js â†’ persistPhoto)
  app.use("/uploads", express.static(UPLOADS_DIR, {
    maxAge: "30d",
    setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
  }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "dropit-api",
    });
  });

  app.use("/api", apiRoutes);

  // In production, serve the built Vite frontend
  if (IS_PROD) {
    const distPath = join(__dirname, "../../web/dist");
    if (existsSync(distPath)) {
      app.use(express.static(distPath));
      // SPA fallback â€” any non-API route returns index.html
      app.get("*", (_req, res) => {
        res.sendFile(join(distPath, "index.html"));
      });
    }
  }

  app.use((error, _req, res, _next) => {
    res.status(500).json({
      message: error.message || "Unexpected server error",
    });
  });

  return app;
}

// deploy-trigger-12: fix hardcoded URLs + PDF redesign + Cloud Run ready
