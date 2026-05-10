import { Plus } from "lucide-react";
import { useState } from "react";

const initialTruck = {
  name: "",
  plate: "",
  maxWeightKg: "",
  maxPackages: "",
  driverName: "",
  driverPhone: "",
  originAddress: "Av. Irarrazaval 2401, Ñuñoa, Santiago",
  status: "Disponible",
};

export default function FleetModule({ trucks, onCreateTruck }) {
  const [form, setForm] = useState(initialTruck);

  async function submit(event) {
    event.preventDefault();
    await onCreateTruck(form);
    setForm(initialTruck);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <article className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-950">Camiones y choferes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Camion</th>
                <th className="px-4 py-3">Patente</th>
                <th className="px-4 py-3">Peso max.</th>
                <th className="px-4 py-3">Bultos max.</th>
                <th className="px-4 py-3">Chofer</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {trucks.map((truck) => (
                <tr key={truck.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">{truck.name}</td>
                  <td className="px-4 py-3">{truck.plate}</td>
                  <td className="px-4 py-3">{truck.maxWeightKg} kg</td>
                  <td className="px-4 py-3">{truck.maxPackages}</td>
                  <td className="px-4 py-3">{truck.driverName}<br /><span className="text-xs text-slate-500">{truck.driverPhone}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{truck.originAddress || "—"}</td>
                  <td className="px-4 py-3">{truck.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <form className="surface p-5" onSubmit={submit}>
        <h3 className="text-lg font-bold text-slate-950">Registrar camion</h3>
        <div className="mt-4 space-y-3">
          {[
            ["name", "Camion"],
            ["plate", "Patente"],
            ["maxWeightKg", "Capacidad maxima de peso (kg)"],
            ["maxPackages", "Capacidad maxima de bultos"],
            ["driverName", "Chofer asignado"],
            ["driverPhone", "Telefono chofer"],
            ["originAddress", "📍 Dirección de origen (desde dónde sale siempre)"],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="label-base">{label}</label>
              <input
                className="input-base"
                value={form[field]}
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                required
              />
            </div>
          ))}
          <div>
            <label className="label-base">Estado</label>
            <select
              className="input-base"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option>Disponible</option>
              <option>En ruta</option>
              <option>Mantencion</option>
            </select>
          </div>
        </div>
        <button className="btn-primary mt-4 w-full gap-2" type="submit">
          <Plus size={16} />
          Guardar camion
        </button>
      </form>
    </section>
  );
}
