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

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Serve persisted quote photos (saved by request.service.js → persistPhoto)
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
      // SPA fallback — any non-API route returns index.html
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
