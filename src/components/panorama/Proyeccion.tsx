"use client";

import { clp, nombreMesCorto } from "@/lib/format";
import { mesDeCruce, type MesProyectado } from "@/lib/projection";

export function Proyeccion({ meses }: { meses: MesProyectado[] }) {
  const cruce = mesDeCruce(meses);
  const maxAbs = Math.max(1, ...meses.map((m) => Math.abs(m.saldoAcumulado)));

  // Línea de saldo acumulado (SVG simple)
  const W = 320;
  const H = 96;
  const puntos = meses.map((m, i) => {
    const x = (i / (meses.length - 1)) * (W - 16) + 8;
    const y = H / 2 - (m.saldoAcumulado / maxAbs) * (H / 2 - 8);
    return { x, y, m };
  });
  const path = puntos
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">
        Flujo de caja · 12 meses
      </h2>
      {cruce ? (
        <p className="mt-1 text-xs text-brand-600">
          ✦ En <span className="capitalize">{nombreMesCorto(cruce)}</span> el mes
          pasa a flujo positivo
        </p>
      ) : meses[0]?.saldoMes >= 0 ? (
        <p className="mt-1 text-xs text-brand-600">Todos los meses en positivo</p>
      ) : (
        <p className="mt-1 text-xs text-red-500">
          Sin cruce a positivo en 12 meses
        </p>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        <line
          x1="8"
          y1={H / 2}
          x2={W - 8}
          y2={H / 2}
          stroke="#e5e7eb"
          strokeDasharray="3 3"
        />
        <path d={path} fill="none" stroke="#2f9e6e" strokeWidth="2" />
        {puntos.map((p) => (
          <circle
            key={p.m.mes}
            cx={p.x}
            cy={p.y}
            r={p.m.mes === cruce ? 4 : 2}
            fill={p.m.saldoAcumulado >= 0 ? "#2f9e6e" : "#ef4444"}
          />
        ))}
      </svg>

      {/* Lista por mes: el saldo acumulado (la cifra clave) siempre visible.
          Cuotas y gastos van como subtítulo, sin tabla que se corte en móvil. */}
      <div className="mt-3 divide-y divide-gray-50">
        <div className="flex items-center justify-between pb-1 text-[11px] uppercase tracking-wide text-gray-400">
          <span>Mes</span>
          <div className="flex gap-4">
            <span className="w-20 text-right">Saldo mes</span>
            <span className="w-24 text-right">Acumulado</span>
          </div>
        </div>
        {meses.map((m) => (
          <div
            key={m.mes}
            className={`flex items-center justify-between py-2 ${
              m.mes === cruce ? "-mx-2 rounded-lg bg-brand-50 px-2" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">
                {nombreMesCorto(m.mes)}
                {m.esReal && (
                  <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                    real
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-400">
                cuotas {clp(m.cuotas)} · gastos {clp(m.gastosFijos)}
              </p>
            </div>
            <div className="flex shrink-0 gap-4">
              <span
                className={`w-20 text-right text-sm ${
                  m.saldoMes < 0 ? "text-red-600" : "text-brand-600"
                }`}
              >
                {clp(m.saldoMes)}
              </span>
              <span
                className={`w-24 text-right text-sm font-semibold ${
                  m.saldoAcumulado < 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {clp(m.saldoAcumulado)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
