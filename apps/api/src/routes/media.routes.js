/**
 * Media routes — image upload (GCS/local) + persistent carousel/branding storage
 * ────────────────────────────────────────────────────────────────────────
 * POST   /api/media/upload       — Upload single image → returns { url, publicId }
 * POST   /api/media/upload-batch — Upload multiple images → returns { urls: [...] }
 * GET    /api/media/carousels    — Get all carousels (login + marketing)
 * PUT    /api/media/carousels    — Save carousels { login: [...], marketing: [...] }
 * GET    /api/media/branding     — Get branding (logoUrl, companyName, etc.)
 * PUT    /api/media/branding     — Save branding
 */
import { Router } from "express";
import { uploadImage, uploadImages, isStorageConfigured } from "../services/storage.service.js";
import { saveStore, store } from "../data/store.js";
import * as db from "../data/db.js";

const router = Router();
const HAS_DB = !!process.env.DATABASE_URL;

// ─── helpers para leer/escribir media en DB/store ────────────────────────────
async function getMedia() {
  if (HAS_DB) {
    const dbMedia = await db.getSetting("media");
    if (dbMedia) return dbMedia;
  }
  return store.media || {};
}

async function setMedia(patch) {
  const current = await getMedia();
  const next    = { ...current, ...patch };
  if (HAS_DB) {
    await db.setSetting("media", next);
  }
  // Mantener store en sync para compatibilidad legacy
  if (!store.media) store.media = {};
  Object.assign(store.media, next);
  saveStore();
  return next;
}

// ─── Single image upload ──────────────────────────────────────────────────────
router.post("/upload", async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) return res.status(400).json({ message: "No image provided" });
    const result = await uploadImage(image, { folder: folder || "dropit" });
    res.json({ ok: true, ...result, cloudinary: isStorageConfigured() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Upload failed" });
  }
});

// ─── Batch image upload ───────────────────────────────────────────────────────
router.post("/upload-batch", async (req, res) => {
  try {
    const { images, folder } = req.body;
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "No images provided" });
    }
    const results = await uploadImages(images, { folder: folder || "dropit" });
    res.json({ ok: true, urls: results.map(r => r.url), results, cloudinary: isStorageConfigured() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Batch upload failed" });
  }
});

// ─── Carousels (login + marketing) ───────────────────────────────────────────
router.get("/carousels", async (_req, res) => {
  try {
    const media = await getMedia();
    res.json({
      login: media.loginCarousel || [],
      marketing: media.marketingCarousel || [],
    });
  } catch (err) {
    console.error("[media/carousels GET] error:", err);
    res.status(500).json({ message: "Error al leer carouseles" });
  }
});

router.put("/carousels", async (req, res) => {
  try {
    const patch = {};
    if (req.body.login !== undefined)     patch.loginCarousel     = req.body.login;
    if (req.body.marketing !== undefined) patch.marketingCarousel = req.body.marketing;
    const next = await setMedia(patch);
    res.json({ ok: true, login: next.loginCarousel, marketing: next.marketingCarousel });
  } catch (err) {
    console.error("[media/carousels PUT] error:", err);
    res.status(500).json({ message: err.message || "Error al guardar carouseles" });
  }
});

// ─── Branding (logo, company info) ───────────────────────────────────────────
router.get("/branding", async (_req, res) => {
  try {
    const media = await getMedia();
    res.json({
      logoUrl: media.logoUrl || "/dropit-logo.jpeg",
      companyName: media.companyName || "DropIt Service",
      primaryColor: media.primaryColor || "#F97316",
    });
  } catch (err) {
    console.error("[media/branding GET] error:", err);
    res.status(500).json({ message: "Error al leer branding" });
  }
});

router.put("/branding", async (req, res) => {
  try {
    const patch = {};
    if (req.body.logoUrl !== undefined)     patch.logoUrl     = req.body.logoUrl;
    if (req.body.companyName !== undefined) patch.companyName = req.body.companyName;
    if (req.body.primaryColor !== undefined) patch.primaryColor = req.body.primaryColor;
    const next = await setMedia(patch);
    res.json({ ok: true, ...next });
  } catch (err) {
    console.error("[media/branding PUT] error:", err);
    res.status(500).json({ message: err.message || "Error al guardar branding" });
  }
});

// ─── Status ───────────────────────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  res.json({ cloudinary: isStorageConfigured() });
});

export default router;
