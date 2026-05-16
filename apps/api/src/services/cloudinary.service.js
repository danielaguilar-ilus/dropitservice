/**
 * Cloudinary upload service
 * ─────────────────────────
 * Handles image upload to Cloudinary cloud storage.
 * Requires CLOUDINARY_URL env var (format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME)
 * or individual CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 *
 * Falls back to local /uploads/ folder if Cloudinary is not configured.
 */
import { v2 as cloudinary } from "cloudinary";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const UPLOADS_DIR = join(__dirname, "../../uploads");

// Configure Cloudinary from env
const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY     = process.env.CLOUDINARY_API_KEY || "";
const API_SECRET  = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_URL = process.env.CLOUDINARY_URL || "";

let cloudinaryReady = false;

if (CLOUDINARY_URL) {
  // CLOUDINARY_URL has format: cloudinary://key:secret@cloud_name
  cloudinary.config({ secure: true }); // auto-reads CLOUDINARY_URL
  cloudinaryReady = true;
  console.log("☁️  Cloudinary configurado via CLOUDINARY_URL");
} else if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
  cloudinaryReady = true;
  console.log(`☁️  Cloudinary configurado: ${CLOUD_NAME}`);
} else {
  console.log("⚠️  Cloudinary NO configurado — fotos se guardan localmente en /uploads/");
}

export function isCloudinaryConfigured() {
  return cloudinaryReady;
}

/**
 * Upload a base64 data URL to Cloudinary (or local fallback)
 * @param {string} dataUrl - "data:image/jpeg;base64,..."
 * @param {object} opts - { folder, publicId }
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadImage(dataUrl, opts = {}) {
  if (!dataUrl || typeof dataUrl !== "string") throw new Error("No image data");

  // If already a URL (http/https), return as-is
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    return { url: dataUrl, publicId: null };
  }

  const folder = opts.folder || "dropit";

  if (cloudinaryReady) {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      public_id: opts.publicId || undefined,
      resource_type: "image",
      transformation: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto:good", fetch_format: "auto" }
      ],
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  // Local fallback — save to /uploads/
  if (!dataUrl.startsWith("data:")) return { url: dataUrl, publicId: null };

  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");

  const ext  = match[1] === "jpeg" ? "jpg" : match[1];
  const buf  = Buffer.from(match[2], "base64");
  const name = `${folder.replace("/", "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  writeFileSync(join(UPLOADS_DIR, name), buf);

  return { url: `/uploads/${name}`, publicId: name };
}

/**
 * Upload multiple images in parallel
 * @param {string[]} images - Array of base64 data URLs
 * @param {object} opts - { folder }
 * @returns {Promise<Array<{url, publicId}>>}
 */
export async function uploadImages(images, opts = {}) {
  if (!Array.isArray(images)) return [];
  const results = await Promise.allSettled(
    images.filter(Boolean).map((img, i) => uploadImage(img, { ...opts, publicId: opts.publicId ? `${opts.publicId}-${i + 1}` : undefined }))
  );
  return results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value);
}

/**
 * Delete an image from Cloudinary by publicId
 */
export async function deleteImage(publicId) {
  if (!cloudinaryReady || !publicId) return false;
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch {
    return false;
  }
}
