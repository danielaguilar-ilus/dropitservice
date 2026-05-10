import { Download, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

const fieldMap = {
  "Id de referencia": "referenceId",
  "Persona de contacto": "contactPerson",
  "Direccion completa": "fullAddress",
  "Dirección completa": "fullAddress",
  "Habilidades requeridas / ciudad destino": "skills",
  "Ciudad / comuna": "destinationCity",
  "Comuna": "destinationCity",
  "Bultos": "packages",
  "Telefono de contacto": "contactPhone",
  "Teléfono de contacto": "contactPhone",
  "Correo electronico de contacto": "contactEmail",
  "Correo electrónico de contacto": "contactEmail",
  "Peso": "weight",
  "Costo": "cost",
};

const TEMPLATE_HEADERS = [
  "Id de referencia",
  "Persona de contacto",
  "Direccion completa",
  "Ciudad / comuna",
  "Bultos",
  "Peso",
  "Telefono de contacto",
  "Correo electronico de contacto",
];

const TEMPLATE_ROWS = [
  ["REF-001", "Juan Pérez", "Av. Providencia 1234, Piso 3", "Providencia", "2", "15", "+56912345678", "juan.perez@email.com"],
  ["REF-002", "María González", "Calle Ñuñoa 456", "Ñuñoa", "1", "8", "+56987654321", "maria.g@empresa.cl"],
  ["REF-003", "Carlos Soto", "Av. Las Condes 789, Of. 201", "Las Condes", "3", "22", "+56911223344", "csoto@logistica.cl"],
];

async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);

  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 28 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
  XLSX.writeFile(wb, "plantilla-dropit.xlsx");
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[fieldMap[key.trim()] || key.trim()] = value;
    });
    return normalized;
  });
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",").map((item) => item.trim());
  return lines.map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

export default function BulkImportModule({ onImport }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMessage("");
    setErrors([]);

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "xlsx" || extension === "xls") {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      setRows(normalizeRows(XLSX.utils.sheet_to_json(sheet, { defval: "" })));
      return;
    }

    const text = await file.text();
    setRows(normalizeRows(parseCsv(text)));
  }

  async function submitImport() {
    setErrors([]);
    setMessage("");
    setLoading(true);

    try {
      const result = await onImport(rows);
      setMessage(`${result.imported.length} pedidos importados y disponibles para planificación.`);
      setRows([]);
      setFileName("");
    } catch (error) {
      setErrors(error.details?.length ? error.details : [{ message: error.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      {/* Upload Panel */}
      <article className="surface p-5 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-dropit-950">Carga masiva por Excel</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-dropit-700">
            Sube un archivo <span className="font-semibold text-dropit-950">.xlsx</span> o{" "}
            <span className="font-semibold text-dropit-950">.csv</span> con los pedidos a importar.
            Descarga la plantilla para ver el formato esperado.
          </p>
        </div>

        {/* Download template */}
        <div className="rounded-xl border border-dropit-accent/30 bg-dropit-accent/5 p-4">
          <p className="mb-3 text-sm font-semibold text-dropit-950">Plantilla oficial</p>
          <p className="mb-3 text-xs text-dropit-700">
            Descarga el archivo Excel con el formato y columnas correctas. Complétalo y súbelo aquí.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg border border-dropit-accent bg-white px-4 py-2.5 text-sm font-semibold text-dropit-accent transition hover:bg-dropit-accent hover:text-white"
          >
            <Download size={16} />
            Descargar plantilla.xlsx
          </button>
        </div>

        {/* File picker */}
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-dropit-300 bg-dropit-100/40 p-8 text-center transition hover:border-dropit-accent/50 hover:bg-dropit-accent/5">
            <FileUp size={28} className="text-dropit-accent" />
            {fileName ? (
              <>
                <span className="mt-3 text-sm font-semibold text-dropit-950">{fileName}</span>
                <span className="mt-1 text-xs text-dropit-600">{rows.length} filas detectadas</span>
              </>
            ) : (
              <>
                <span className="mt-3 text-sm font-semibold text-dropit-800">
                  Seleccionar archivo
                </span>
                <span className="mt-1 text-xs text-dropit-600">.xlsx, .xls o .csv</span>
              </>
            )}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <button
          className="btn-primary w-full gap-2"
          type="button"
          onClick={submitImport}
          disabled={rows.length === 0 || loading}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Importando...
            </>
          ) : (
            <>
              <FileUp size={16} />
              Importar {rows.length > 0 ? `${rows.length} pedidos` : "pedidos"}
            </>
          )}
        </button>

        {message && (
          <div className="flex items-start gap-3 rounded-lg border border-dropit-success/30 bg-dropit-success/8 px-4 py-3">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-dropit-success" />
            <p className="text-sm font-medium text-dropit-success">{message}</p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-dropit-error/30 bg-dropit-error/8 p-4 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={15} className="text-dropit-error" />
              <p className="text-sm font-semibold text-dropit-error">Errores de validación</p>
            </div>
            {errors.map((error, index) => (
              <p key={`${error.row}-${error.field}-${index}`} className="text-xs text-dropit-error">
                Fila {error.row || "-"}: {error.message}
              </p>
            ))}
          </div>
        )}

        {/* Required columns */}
        <div className="rounded-lg border border-dropit-300 bg-dropit-100/30 p-3 text-xs text-dropit-700 space-y-1.5">
          <p className="font-semibold text-dropit-800">Columnas requeridas:</p>
          {TEMPLATE_HEADERS.map((h) => (
            <p key={h} className="font-mono text-dropit-600">• {h}</p>
          ))}
        </div>
      </article>

      {/* Preview Table */}
      <article className="surface overflow-hidden">
        <div className="border-b border-dropit-300 bg-dropit-50 px-5 py-4">
          <h3 className="text-lg font-bold text-dropit-950">Previsualización</h3>
          <p className="mt-1 text-sm text-dropit-700">
            {rows.length > 0 ? `${rows.length} filas detectadas` : "Sube un archivo para previsualizar"}
          </p>
        </div>

        {rows.length > 0 ? (
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full divide-y divide-dropit-200 text-sm">
              <thead className="sticky top-0 bg-dropit-100">
                <tr>
                  {["Referencia", "Contacto", "Dirección", "Comuna", "Bultos", "Peso"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-dropit-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dropit-100">
                {rows.slice(0, 60).map((row, index) => (
                  <tr key={`${row.referenceId}-${index}`} className="hover:bg-dropit-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-dropit-800">{row.referenceId}</td>
                    <td className="px-4 py-3 text-dropit-950">{row.contactPerson}</td>
                    <td className="px-4 py-3 text-dropit-700">{row.fullAddress}</td>
                    <td className="px-4 py-3 text-dropit-700">{row.destinationCity}</td>
                    <td className="px-4 py-3 text-center font-semibold text-dropit-950">{row.packages}</td>
                    <td className="px-4 py-3 text-dropit-700">{row.weight} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state m-6">
            <FileUp className="empty-state-icon" size={32} />
            <p className="empty-state-title">Sin datos</p>
            <p className="empty-state-description">
              Sube un archivo .xlsx o .csv para ver la previsualización de los pedidos
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
