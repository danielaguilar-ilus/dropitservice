import { Image, Plus, Trash2, Upload, X, Cloud, Loader2, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Compress before upload for faster transfer
async function compressForUpload(file, maxSide = 1200, quality = 0.8) {
  if (typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      let { width: w, height: h } = bitmap;
      if (w > maxSide || h > maxSide) { const r = Math.min(maxSide / w, maxSide / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    } catch { /* fallback */ }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

function CarouselSection({ title, desc, carouselKey, max, images, setImages, onSave, saving, saved }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function addFiles(files) {
    const remaining = max - images.length;
    const toAdd = [...files].slice(0, remaining).filter((f) => f.type.startsWith("image/"));
    if (toAdd.length === 0) return;

    setUploading(true);
    try {
      // Compress all files
      const compressed = await Promise.all(toAdd.map(f => compressForUpload(f)));
      // Upload batch to API → Cloudinary
      const res = await fetch(`${API_URL}/media/upload-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressed, folder: `dropit/${carouselKey}` }),
      });
      const data = await res.json();
      if (data.ok && data.urls) {
        setImages((prev) => [...prev, ...data.urls]);
      } else {
        alert("Error al subir imágenes: " + (data.message || ""));
      }
    } catch (err) {
      alert("Error de conexión al subir: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setImages([]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-dropit-950">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
        </div>
        <span className="rounded-full bg-dropit-accent/10 px-2.5 py-1 text-xs font-bold text-dropit-accent">
          {images.length}/{max}
        </span>
      </div>

      {/* Upload zone */}
      {images.length < max && (
        <div
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all ${
            dragging
              ? "border-dropit-accent bg-dropit-accent/5"
              : "border-slate-200 bg-slate-50 hover:border-dropit-accent/50"
          }`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {uploading ? (
            <>
              <Loader2 size={22} className="text-dropit-accent animate-spin" />
              <p className="text-sm font-medium text-slate-600">Subiendo a la nube...</p>
            </>
          ) : (
            <>
              <Upload size={22} className="text-dropit-accent" />
              <p className="text-sm font-medium text-slate-600">
                Arrastra o <span className="text-dropit-accent underline">selecciona archivos</span>
              </p>
              <p className="text-xs text-slate-400">PNG, JPG, WEBP — hasta {max - images.length} más</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      )}

      {/* Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {images.map((src, i) => (
            <div key={i} className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
              <div className="absolute inset-0 scale-110 bg-cover bg-center blur-sm opacity-60" style={{ backgroundImage: `url(${src})` }} />
              <img src={src} alt={`Slide ${i + 1}`} className="relative h-full w-full object-contain" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                  className="scale-0 rounded-full bg-red-500 p-1 text-white shadow transition-transform group-hover:scale-100"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">
                {i + 1}
              </div>
            </div>
          ))}
          {images.length < max && (
            <button
              onClick={() => inputRef.current?.click()}
              className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-dropit-accent/50"
            >
              <Plus size={16} className="text-slate-400" />
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      {images.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={clearAll}
            className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
          >
            Limpiar todo
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              saved ? "bg-emerald-500 text-white" : "bg-dropit-accent text-white hover:bg-dropit-accent-dark"
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Cloud size={14} />}
            {saving ? "Guardando..." : saved ? "¡Guardado en la nube!" : "Guardar y aplicar"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ContentModule() {
  const [loginImages, setLoginImages] = useState([]);
  const [marketingImages, setMarketingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(null);

  // Load from API on mount
  useEffect(() => {
    fetch(`${API_URL}/media/carousels`)
      .then(r => r.json())
      .then(data => {
        setLoginImages(data.login || []);
        setMarketingImages(data.marketing || []);
      })
      .catch(() => {
        // Fallback: try localStorage for migration
        try { setLoginImages(JSON.parse(localStorage.getItem("dropit-login-carousel") || "[]")); } catch {}
        try { setMarketingImages(JSON.parse(localStorage.getItem("dropit-marketing-carousel") || "[]")); } catch {}
      });

    fetch(`${API_URL}/media/status`).then(r => r.json()).then(d => setCloudStatus(d.cloudinary)).catch(() => {});
  }, []);

  async function saveCarousels() {
    setSaving(true);
    try {
      await fetch(`${API_URL}/media/carousels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginImages, marketing: marketingImages }),
      });
      // Also keep localStorage in sync for offline/instant load
      localStorage.setItem("dropit-login-carousel", JSON.stringify(loginImages));
      localStorage.setItem("dropit-marketing-carousel", JSON.stringify(marketingImages));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image size={20} className="text-dropit-accent" />
          <h1 className="text-lg font-black text-slate-800">Contenido de marketing</h1>
        </div>
        {cloudStatus !== null && (
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            cloudStatus ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <Cloud size={12} />
            {cloudStatus ? "Cloudinary activo" : "Almacenamiento local"}
          </span>
        )}
      </div>

      <CarouselSection
        title="Fotos de pantalla de login"
        desc="Máx. 5 imágenes. Aparecen en el login con transición automática cada 5 s."
        carouselKey="login"
        max={5}
        images={loginImages}
        setImages={setLoginImages}
        onSave={saveCarousels}
        saving={saving}
        saved={saved}
      />

      <CarouselSection
        title="Carrusel hero en cotizador público"
        desc="Máx. 15 imágenes. Aparecen como fondo en el hero de la página /cotizar."
        carouselKey="marketing"
        max={15}
        images={marketingImages}
        setImages={setMarketingImages}
        onSave={saveCarousels}
        saving={saving}
        saved={saved}
      />
    </div>
  );
}
