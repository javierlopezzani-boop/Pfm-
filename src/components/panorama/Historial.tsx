"use client";

import { useMemo, useState } from "react";
import { clp, mesActual, nombreMes, nombreMesCorto, normalizarTexto, sumarMeses } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

export function Historial({
  transacciones,
  categorias,
}: {
  transacciones: Transaction[]; // últimos ~24 meses
  categorias: Category[];
}) {
  const actual = mesActual();
  const [mesSel, setMesSel] = useState(actual);
  const [catSel, setCatSel] = useState<string>("");
  const [filtro, setFiltro] = useState("");

  const mesesDisponibles = useMemo(() => {
    const set = new Set(transacciones.map((t) => t.mes));
    set.add(actual);
    return Array.from(set).sort().reverse();
  }, [transacciones, actual]);

  const categoriasPorId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c])),
    [categorias]
  );

  const txMes = useMemo(() => {
    const norm = normalizarTexto(filtro);
    return transacciones
      .filter((t) => t.mes === mesSel)
      .filter((t) => !catSel || t.categoria_id === catSel)
      .filter((t) => !norm || normalizarTexto(t.descripcion).includes(norm))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [transacciones, mesSel, catSel, filtro]);

  // Resumen inteligente para meses cerrados (distintos del actual)
  const resumen = useMemo(() => {
    if (mesSel === actual) return null;
    const delMes = transacciones.filter(
      (t) => t.mes === mesSel && t.tipo_reparto !== "abono"
    );
    if (delMes.length === 0) return null;

    const total = delMes.reduce((a, t) => a + t.monto, 0);
    const categoriasDepto = categorias.filter((c) => c.ambito === "depto");
    const pptoTotal = categoriasDepto.reduce((a, c) => a + c.presupuesto_mensual, 0);

    const porCat = new Map<string, number>();
    for (const t of delMes) {
      if (!t.categoria_id) continue;
      porCat.set(t.categoria_id, (porCat.get(t.categoria_id) ?? 0) + t.monto);
    }
    const desviaciones = categoriasDepto
      .map((c) => ({
        nombre: c.nombre,
        desviacion: (porCat.get(c.id) ?? 0) - c.presupuesto_mensual,
      }))
      .sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion))
      .slice(0, 3);

    // Comparación con el mismo mes del año anterior, si existe
    const mesAnioAnterior = sumarMeses(mesSel, -12);
    const txAnterior = transacciones.filter(
      (t) => t.mes === mesAnioAnterior && t.tipo_reparto !== "abono"
    );
    const totalAnterior = txAnterior.reduce((a, t) => a + t.monto, 0);

    return {
      total,
      pptoTotal,
      desviaciones,
      mesAnioAnterior,
      totalAnterior: txAnterior.length > 0 ? totalAnterior : null,
    };
  }, [mesSel, actual, transacciones, categorias]);

  // Tendencia mensual por categoría, últimos 12 meses
  const tendencia = useMemo(() => {
    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) meses.push(sumarMeses(actual, -i));
    return meses.map((m) => {
      const total = transacciones
        .filter(
          (t) =>
            t.mes === m &&
            t.tipo_reparto !== "abono" &&
            (!catSel || t.categoria_id === catSel)
        )
        .reduce((a, t) => a + t.monto, 0);
      return { mes: m, total };
    });
  }, [transacciones, actual, catSel]);

  const maxTendencia = Math.max(1, ...tendencia.map((t) => t.total));

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Historial</h2>

      <div className="mt-2 flex gap-2">
        <select
          value={mesSel}
          onChange={(e) => setMesSel(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm capitalize"
        >
          {mesesDisponibles.map((m) => (
            <option key={m} value={m} className="capitalize">
              {nombreMes(m)}
            </option>
          ))}
        </select>
        <select
          value={catSel}
          onChange={(e) => setCatSel(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por texto…"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {/* Gráfico de tendencia mensual (últimos 12 meses) */}
      <div className="mt-3">
        <p className="mb-1 text-xs text-gray-400">
          Tendencia 12 meses{" "}
          {catSel ? `· ${categoriasPorId.get(catSel)?.nombre}` : "· total"}
        </p>
        <div className="flex h-20 items-end gap-1">
          {tendencia.map((t) => (
            <div key={t.mes} className="flex flex-1 flex-col items-center gap-0.5">
              <div
                className={`w-full rounded-t ${
                  t.mes === mesSel ? "bg-brand-600" : "bg-brand-100"
                }`}
                style={{ height: `${Math.max(2, (t.total / maxTendencia) * 64)}px` }}
                title={`${nombreMesCorto(t.mes)}: ${clp(t.total)}`}
              />
              <span className="text-[8px] text-gray-400">
                {nombreMesCorto(t.mes).slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen de mes cerrado */}
      {resumen && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
          <p>
            Total: <strong>{clp(resumen.total)}</strong>{" "}
            <span className="text-gray-500">
              vs presupuesto {clp(resumen.pptoTotal)}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">Mayores desviaciones:</p>
          <ul className="text-xs text-gray-600">
            {resumen.desviaciones.map((d) => (
              <li key={d.nombre}>
                {d.nombre}: {d.desviacion >= 0 ? "+" : ""}
                {clp(d.desviacion)}
              </li>
            ))}
          </ul>
          {resumen.totalAnterior !== null && (
            <p className="mt-1 text-xs text-gray-500">
              <span className="capitalize">{nombreMes(resumen.mesAnioAnterior)}</span>
              : {clp(resumen.totalAnterior)} (
              {resumen.total >= resumen.totalAnterior ? "+" : ""}
              {clp(resumen.total - resumen.totalAnterior)} este año)
            </p>
          )}
        </div>
      )}

      {/* Lista de transacciones */}
      <div className="mt-3 divide-y divide-gray-50">
        {txMes.length === 0 && (
          <p className="py-3 text-center text-sm text-gray-400">
            Sin movimientos con ese filtro
          </p>
        )}
        {txMes.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">
                {t.descripcion}
              </p>
              <p className="text-xs text-gray-400">
                {t.fecha.slice(8, 10)}/{t.fecha.slice(5, 7)} ·{" "}
                {t.categoria_id
                  ? categoriasPorId.get(t.categoria_id)?.nombre ?? "—"
                  : "Sin categoría"}
              </p>
            </div>
            <span className="ml-2 text-sm font-semibold text-gray-900">
              {clp(t.monto)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
