"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BudgetBar } from "@/components/BudgetBar";
import { QuickEntry } from "@/components/QuickEntry";
import { TabBar } from "@/components/TabBar";
import { clp, hoyLocal, mesActual, nombreMes, sumarMeses } from "@/lib/format";
import { balanceDeTransacciones, textoBalance } from "@/lib/reparto";
import type { Transaction } from "@/lib/types";
import { useAppData } from "@/lib/useAppData";

export default function HoyPage() {
  const { supabase, categorias, users, settings, javier, josefina, yo, cargando } =
    useAppData();
  const [txMes, setTxMes] = useState<Transaction[]>([]);
  const [txMesAnterior, setTxMesAnterior] = useState<Transaction[]>([]);
  const [mesAnteriorSaldado, setMesAnteriorSaldado] = useState(true);
  const [version, setVersion] = useState(0);

  const mes = mesActual();
  const mesAnterior = sumarMeses(mes, -1);
  const esInicioDeMes = parseInt(hoyLocal().slice(8, 10), 10) <= 5;

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    async function cargar() {
      const [{ data: tx }, { data: txPrev }, { data: settle }] = await Promise.all([
        supabase.from("transactions").select("*").eq("mes", mes),
        esInicioDeMes
          ? supabase.from("transactions").select("*").eq("mes", mesAnterior)
          : Promise.resolve({ data: [] as Transaction[] }),
        supabase.from("monthly_settlements").select("mes").eq("mes", mesAnterior),
      ]);
      setTxMes((tx as Transaction[]) ?? []);
      setTxMesAnterior((txPrev as Transaction[]) ?? []);
      setMesAnteriorSaldado(((settle as { mes: string }[]) ?? []).length > 0);
    }
    cargar();
  }, [supabase, mes, mesAnterior, esInicioDeMes, version]);

  const categoriasDepto = useMemo(
    () => categorias.filter((c) => c.ambito === "depto" && c.activa),
    [categorias]
  );

  const gastoPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txMes) {
      if (t.tipo_reparto === "abono" || !t.categoria_id) continue;
      map.set(t.categoria_id, (map.get(t.categoria_id) ?? 0) + t.monto);
    }
    return map;
  }, [txMes]);

  const totalGastadoDepto = categoriasDepto.reduce(
    (acc, c) => acc + (gastoPorCategoria.get(c.id) ?? 0),
    0
  );
  const totalPresupuesto = categoriasDepto.reduce(
    (acc, c) => acc + c.presupuesto_mensual,
    0
  );

  // Resumen de cierre del mes anterior (banner el día 1)
  const cierre = useMemo(() => {
    if (!esInicioDeMes || txMesAnterior.length === 0) return null;
    const gastoPrev = txMesAnterior
      .filter((t) => t.tipo_reparto !== "abono")
      .reduce((acc, t) => acc + t.monto, 0);
    const porCat = new Map<string, number>();
    for (const t of txMesAnterior) {
      if (t.tipo_reparto === "abono" || !t.categoria_id) continue;
      porCat.set(t.categoria_id, (porCat.get(t.categoria_id) ?? 0) + t.monto);
    }
    const desviaciones = categoriasDepto
      .map((c) => ({
        nombre: c.nombre,
        desviacion: (porCat.get(c.id) ?? 0) - c.presupuesto_mensual,
      }))
      .sort((a, b) => b.desviacion - a.desviacion)
      .slice(0, 3);
    const balancePrev =
      javier && josefina && settings
        ? balanceDeTransacciones(
            txMesAnterior,
            javier.id,
            josefina.id,
            settings.factor_reparto_josefina
          )
        : 0;
    return { gastoPrev, desviaciones, balancePrev };
  }, [esInicioDeMes, txMesAnterior, categoriasDepto, javier, josefina, settings]);

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        Cargando…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-gray-900">Hoy</h1>
        <span className="text-sm capitalize text-gray-500">{nombreMes(mes)}</span>
      </header>

      {/* Ingreso rápido SIEMPRE visible arriba */}
      <QuickEntry
        supabase={supabase}
        categorias={categorias}
        users={users}
        yo={yo}
        onGuardado={recargar}
      />

      {/* Banner de cierre de mes */}
      {cierre && !mesAnteriorSaldado && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-sm font-semibold capitalize text-amber-900">
            Cierre de {nombreMes(mesAnterior)}
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Total: <strong>{clp(cierre.gastoPrev)}</strong> vs presupuesto{" "}
            {clp(totalPresupuesto)}
          </p>
          <ul className="mt-1 text-xs text-amber-800">
            {cierre.desviaciones.map((d) => (
              <li key={d.nombre}>
                {d.nombre}: {d.desviacion >= 0 ? "+" : ""}
                {clp(d.desviacion)}
              </li>
            ))}
          </ul>
          {Math.round(cierre.balancePrev) !== 0 && (
            <p className="mt-1 text-sm text-amber-900">
              {textoBalance(cierre.balancePrev)}{" "}
              <strong>{clp(Math.abs(cierre.balancePrev))}</strong>
            </p>
          )}
          <Link
            href="/nosotros"
            className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Ir a saldar →
          </Link>
        </div>
      )}

      {/* Resumen del mes: total y por categoría */}
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Depto este mes</h2>
          <span className="text-sm">
            <strong
              className={
                totalGastadoDepto > totalPresupuesto
                  ? "text-red-600"
                  : "text-gray-900"
              }
            >
              {clp(totalGastadoDepto)}
            </strong>
            <span className="text-gray-400"> / {clp(totalPresupuesto)}</span>
          </span>
        </div>

        <div className="mt-2 divide-y divide-gray-50">
          {categoriasDepto.map((c) => (
            <BudgetBar
              key={c.id}
              nombre={c.nombre}
              gastado={gastoPorCategoria.get(c.id) ?? 0}
              presupuesto={c.presupuesto_mensual}
            />
          ))}
        </div>
      </section>

      <TabBar />
    </main>
  );
}
