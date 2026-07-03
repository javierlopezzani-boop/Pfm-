"use client";

import { clp } from "@/lib/format";
import { cuotasRestantes } from "@/lib/projection";
import type { Installment } from "@/lib/types";

export function Deuda({ installments }: { installments: Installment[] }) {
  const filas = installments
    .map((inst) => {
      const restantes = cuotasRestantes(inst);
      return { inst, restantes, total: restantes * inst.monto_cuota };
    })
    .filter((f) => f.restantes > 0);

  const totalDeuda = filas.reduce((acc, f) => acc + f.total, 0);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Deuda en cuotas</h2>
        <span className="font-bold text-gray-900">{clp(totalDeuda)}</span>
      </div>
      <div className="mt-2 divide-y divide-gray-50">
        {filas.length === 0 && (
          <p className="py-2 text-sm text-gray-400">Sin cuotas activas 🎉</p>
        )}
        {filas.map(({ inst, restantes, total }) => (
          <div key={inst.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-800">{inst.detalle}</p>
              <p className="text-xs text-gray-500">
                {restantes} de {inst.total_cuotas} cuotas restantes ·{" "}
                {clp(inst.monto_cuota)}/mes
              </p>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {clp(total)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
