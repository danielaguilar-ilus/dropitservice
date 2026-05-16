/**
 * Media routes — Cloudinary upload + persistent carousel/branding storage
 * ────────────────────────────────────────────────────────────────────────
 * POST   /api/media/upload       — Upload single image → returns { url, publicId }
 * POST   /api/media/upload-batch — Upload multiple images → returns { urls: [...] }
 * GET    /api/media/carousels    — Get all carousels (login + marketing)
 * PUT    /api/media/carousels    — Save carousels { login: [...], marketing: [...] }
 * GET    /api/media/branding     — Get branding (logoUrl, companyName, etc.)
 * PUT    /api/media/branding     — Save branding
 */
import { Router } from "express";
import { uploadImage, uploadImages, isCloudinaryConfigured } from "../services/cloudinary.service.js";
import { saveStore, store } from "../data/store.js";

const router = Router();

// ─── Single image upload ──────────────────────────────────────────────────────
router.post("/upload", async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) return res.status(400).json({ message: "No image provided" });
    const result = await uploadImage(image, { folder: folder || "dropit" });
    res.json({ ok: true, ...result, cloudinary: isCloudinaryConfigured() });
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
    res.json({ ok: true, urls: results.map(r => r.url), results, cloudinary: isCloudinaryConfigured() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Batch upload failed" });
  }
});

// ─── Carousels (login + marketing) ───────────────────────────────────────────
router.get("/carousels", (_req, res) => {
  const media = store.media || {};
  res.json({
    login: media.loginCarousel || [],
    marketing: media.marketingCarousel || [],
  });
});

router.put("/carousels", (req, res) => {
  if (!store.media) store.media = {};
  if (req.body.login !== undefined)    store.media.loginCarousel     = req.body.login;
  if (req.body.marketing !== undefined) store.media.marketingCarousel = req.body.marketing;
  saveStore();
  res.json({ ok: true, login: store.media.loginCarousel, marketing: store.media.marketingCarousel });
});

// ─── Branding (logo, company info) ───────────────────────────────────────────
router.get("/branding", (_req, res) => {
  const media = store.media || {};
  res.json({
    logoUrl: media.logoUrl || "/dropit-logo.jpeg",
    companyName: media.companyName || "DropIt Service",
    primaryColor: media.primaryColor || "#F97316",
  });
});

router.put("/branding", (req, res) => {
  if (!store.media) store.media = {};
  if (req.body.logoUrl !== undefined)     store.media.logoUrl     = req.body.logoUrl;
  if (req.body.companyName !== undefined) store.media.companyName = req.body.companyName;
  if (req.body.primaryColor !== undefined) store.media.primaryColor = req.body.primaryColor;
  saveStore();
  res.json({ ok: true, ...store.media });
});

// ─── Status ───────────────────────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  res.json({ cloudinary: isCloudinaryConfigured() });
});

export default router;
