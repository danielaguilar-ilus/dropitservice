import { useEffect, useRef, useState } from "react";
import { X, Download, Printer, Loader2, FileText, ZoomIn, ZoomOut } from "lucide-react";

/**
 * QuotePDFPreview
 * ───────────────
 * Modal de pantalla completa que muestra un HTML de cotización en un iframe
 * con barra superior profesional: imprimir / descargar PDF / cerrar.
 *
 * Props:
 *   html      → string HTML completo de la cotización
 *   filename  → nombre sugerido al descargar (default: "cotizacion.pdf")
 *   onClose   → función para cerrar el modal
 */
export default function QuotePDFPreview({ html, filename = "cotizacion.pdf", onClose }) {
  const iframeRef   = useRef(null);
  const [ready,    setReady]   = useState(false);
  const [blobUrl,  setBlobUrl] = useState(null);
  const [zoom,     setZoom]    = useState(100); // %

  // ── Build blob URL from HTML ──────────────────────────────────────────────
  useEffect(() => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Print (via iframe) ────────────────────────────────────────────────────
  function handlePrint() {
    const iframeWin = iframeRef.current?.contentWindow;
    if (iframeWin) {
      iframeWin.focus();
      iframeWin.print();
    }
  }

  // ── Download as PDF (open in new tab + print dialog) ─────────────────────
  function handleDownload() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Permite ventanas emergentes para descargar el PDF."); return; }
    win.document.write(html);
    win.document.close();
    // Small delay to ensure styles load before print dialog opens
    setTimeout(() => win.print(), 600);
  }

  const pageStyle = {
    width:     "210mm",
    minHeight: "297mm",
    transform: `scale(${zoom / 100})`,
    transformOrigin: "top center",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      {/* ── Backdrop ── */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* ── Modal container ── */}
      <div className="relative z-10 flex h-full flex-col">

        {/* ── Top bar ── */}
        <div className="flex flex-shrink-0 items-center gap-4 bg-dropit-950 px-5 py-3 shadow-2xl">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-dropit-accent shadow-md shadow-dropit-accent/30">
              <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover"
                onError={e => { e.target.style.display = "none"; }} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-dropit-accent">DropIt</p>
              <p className="text-xs font-semibold text-white/60">Vista previa · Cotización PDF</p>
            </div>
          </div>

          {/* Doc label */}
          <div className="hidden items-center gap-2 rounded-lg bg-white/8 px-3 py-1.5 md:flex">
            <FileText size={13} className="text-white/50" />
            <span className="text-xs font-medium text-white/60 truncate max-w-[200px]">{filename}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Zoom controls */}
            <div className="hidden items-center gap-1 rounded-lg bg-white/8 px-2 py-1 md:flex">
              <button onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white transition">
                <ZoomOut size={13} />
              </button>
              <span className="w-10 text-center text-xs font-semibold text-white/70">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(150, z + 10))}
                className="flex h-6 w-6 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white transition">
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Print */}
            <button
              onClick={handlePrint}
              disabled={!ready}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownload}
              disabled={!ready}
              className="flex items-center gap-2 rounded-lg bg-dropit-accent px-4 py-2 text-sm font-bold text-white shadow-lg shadow-dropit-accent/30 transition hover:bg-dropit-accent-dark disabled:opacity-40"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Descargar PDF</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Page preview area ── */}
        <div className="flex-1 overflow-auto bg-slate-700 py-8 px-4 flex justify-center">
          {!ready && (
            <div className="flex flex-col items-center gap-3 mt-24 text-white/50">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Cargando vista previa...</span>
            </div>
          )}

          {blobUrl && (
            <div style={pageStyle}>
              <iframe
                ref={iframeRef}
                src={blobUrl}
                title="Vista previa cotización"
                className={`w-full bg-white shadow-2xl shadow-black/50 ${ready ? "block" : "hidden"}`}
                style={{ minHeight: "297mm", border: "none" }}
                onLoad={() => setReady(true)}
              />
            </div>
          )}
        </div>

        {/* ── Bottom hint ── */}
        <div className="flex-shrink-0 bg-dropit-950/80 px-5 py-2 text-center text-[11px] text-white/30">
          Presiona <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">Esc</kbd> para cerrar ·
          "Descargar PDF" abre el diálogo de impresión del navegador → guarda como PDF
        </div>
      </div>
    </div>
  );
}
