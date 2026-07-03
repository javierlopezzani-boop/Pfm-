"use client";

import { clp } from "@/lib/format";

// Barra de avance con semáforo: verde <80%, amarillo 80-100%, rojo >100%
export function BudgetBar({
  nombre,
  gastado,
  presupuesto,
}: {
  nombre: string;
  gastado: number;
  presupuesto: number;
}) {
  const pct = presupuesto > 0 ? (gastado / presupuesto) * 100 : gastado > 0 ? 100 : 0;
  const color =
    pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-brand-500";

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-gray-800">{nombre}</span>
        <span className="text-gray-500">
          {clp(gastado)}
          {presupuesto > 0 && (
            <span className="text-gray-400"> / {clp(presupuesto)}</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
