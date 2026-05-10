import { Image, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CarouselSection({ title, desc, storageKey, max }) {
  const [images, setImages] = useState([]);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setImages(Array.isArray(stored) ? stored : []);
    } catch { setImages([]); }
  }, [storageKey]);

  async function addFiles(files) {
    const remaining = max - images.length;
    const toAdd = [...files].slice(0, remaining).filter((f) => f.type.startsWith("image/"));
    const b64s = await Promise.all(toAdd.map(toBase64));
    setImages((prev) => [...prev, ...b64s]);
    setSaved(false);
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(images));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function clearAll() {
    setImages([]);
    localStorage.removeItem(storageKey);
    setSaved(false);
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
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload size={22} className="text-dropit-accent" />
          <p className="text-sm font-medium text-slate-600">
            Arrastra o <span className="text-dropit-accent underline">selecciona archivos</span>
          </p>
          <p className="text-xs text-slate-400">PNG, JPG, WEBP — hasta {max - images.length} más</p>
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
              {/* Blurred fill for non-matching aspect ratios */}
              <div className="absolute inset-0 scale-110 bg-cover bg-center blur-sm opacity-60" style={{ backgroundImage: `url(${src})` }} />
              {/* Main image contained */}
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
            onClick={save}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              saved ? "bg-emerald-500 text-white" : "bg-dropit-accent text-white hover:bg-dropit-accent-dark"
            }`}
          >
            {saved ? "¡Guardado!" : "Guardar y aplicar"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ContentModule() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Image size={20} className="text-dropit-accent" />
        <h1 className="text-lg font-black text-slate-800">Contenido de marketing</h1>
      </div>

      <CarouselSection
        title="Fotos de pantalla de login"
        desc={`Máx. 5 imágenes. Aparecen en el login con transición automática cada 5 s.`}
        storageKey="dropit-login-carousel"
        max={5}
      />

      <CarouselSection
        title="Carrusel hero en cotizador público"
        desc={`Máx. 15 imágenes. Aparecen como fondo en el hero de la página /cotizar.`}
        storageKey="dropit-marketing-carousel"
        max={15}
      />
    </div>
  );
}
