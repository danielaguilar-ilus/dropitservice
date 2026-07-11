/**
 * Storage service — Google Cloud Storage + local fallback
 * ─────────────────────────────────────────────────────────
 * Handles image upload to a PRIVATE Google Cloud Storage bucket.
 * Uploaded objects are stored with key `<folder>/<timestamp>-<random>.<ext>`
 * and exposed as relative URLs `/f/<key>` served by the app's own
 * proxy route (see app.js) — the bucket never needs to be public.
 *
 * Config: GCS_BUCKET env var (bucket name, e.g. "dropit-fotos").
 * Auth: Application Default Credentials (ADC) — on Cloud Run the
 * service runs with its default service account, no JSON keys needed.
 *
 * Falls back to local /uploads/ folder if GCS_BUCKET is not set.
 */
import { Storage } from "@google-cloud/storage";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const UPLOADS_DIR = join(__dirname, "../../uploads");

const GCS_BUCKET = (process.env.GCS_BUCKET || "").trim();
const CACHE_CONTROL = "public, max-age=2592000"; // 30 días

let bucket = null;

if (GCS_BUCKET) {
  // ADC — sin credenciales explícitas (Cloud Run usa su service account)
  const storage = new Storage();
  bucket = storage.bucket(GCS_BUCKET);
  console.log(`🗄️ GCS configurado: ${GCS_BUCKET}`);
} else {
  console.log("⚠️ GCS no configurado — fotos locales en /uploads/");
}

export function isStorageConfigured() {
  return !!bucket;
}

export function getBucket() {
  return bucket;
}

/**
 * Upload a base64 data URL to GCS (or local fallback)
 * @param {string} dataUrl - "data:image/jpeg;base64,..."
 * @param {object} opts - { folder, publicId }
 * @returns {Promise<{url: string, publicId: string|null}>}
 */
export async function uploadImage(dataUrl, opts = {}) {
  if (!dataUrl || typeof dataUrl !== "string") throw new Error("No image data");

  // Already a URL (remote, or already proxied through /f/) — return as-is
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://") || dataUrl.startsWith("/f/")) {
    return { url: dataUrl, publicId: null };
  }

  const folder = opts.folder || "dropit";

  // Any other non-data URL (e.g. /uploads/...) — keep as-is
  if (!dataUrl.startsWith("data:")) return { url: dataUrl, publicId: null };

  const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");

  const subtype = match[1].toLowerCase();
  const ext = subtype === "jpeg" ? "jpg" : subtype.split("+")[0];
  const buf = Buffer.from(match[2], "base64");

  if (bucket) {
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await bucket.file(key).save(buf, {
      contentType: `image/${subtype}`,
      resumable: false,
      metadata: { cacheControl: CACHE_CONTROL },
    });
    return { url: `/f/${key}`, publicId: key };
  }

  // Local fallback — save to /uploads/
  const name = `${folder.replace(/\//g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
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
 * Delete an image from GCS by key (publicId). Local files: no-op.
 */
export async function deleteImage(publicId) {
  if (!bucket || !publicId) return false;
  try {
    // Tolerate "/f/<key>" URLs as well as raw keys
    const key = publicId.startsWith("/f/") ? publicId.slice(3) : publicId;
    await bucket.file(key).delete();
    return true;
  } catch {
    return false;
  }
}

// ─── /f/<key> proxy helper ───────────────────────────────────────────────────
const MIME_BY_EXT = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
  svg:  "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  bmp:  "image/bmp",
  ico:  "image/x-icon",
};

/**
 * Stream a stored object to an Express response (used by the /f/* route).
 * Responds 404 if GCS is not configured, the key is empty, or the object
 * does not exist / fails to stream.
 */
export function streamFile(key, res) {
  const cleanKey = String(key || "").replace(/^\/+/, "");
  if (!bucket || !cleanKey) {
    res.status(404).end();
    return;
  }
  const ext = (cleanKey.split(".").pop() || "").toLowerCase();
  res.setHeader("Content-Type", MIME_BY_EXT[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", CACHE_CONTROL);
  bucket
    .file(cleanKey)
    .createReadStream()
    .on("error", () => {
      if (!res.headersSent) res.status(404);
      res.end();
    })
    .pipe(res);
}
