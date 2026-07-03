"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TabBar } from "@/components/TabBar";
import { clp, mesActual, nombreMes } from "@/lib/format";
import { deudaDeTransaccion, textoBalance } from "@/lib/reparto";
import type { MonthlySettlement, TipoReparto, Transaction } from "@/lib/types";
import { useAppData } from "@/lib/useAppData";

const REPARTO_LABEL: Record<TipoReparto, string> = {
  compartido: "Compartido",
  de_javier: "De Javier",
  de_josefina: "De Josefina",
  abono: "Abono",
};

export default function NosotrosPage() {
  const { supabase, users, settings, javier, josefina, yo, cargando } = useAppData();
  const [transacciones, setTransacciones] = useState<Transaction[]>([]);
  const [settlements, setSettlements] = useState<MonthlySettlement[]>([]);
  const [saldando, setSaldando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mes = mesActual();
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    async function cargar() {
      const [{ data: tx }, { data: st }] = await Promise.all([
        supabase.from("transactions").select("*").lte("mes", mes),
        supabase.from("monthly_settlements").select("*"),
      ]);
      setTransacciones((tx as Transaction[]) ?? []);
      setSettlements((st as MonthlySettlement[]) ?? []);
    }
    cargar();
  }, [supabase, mes, version]);

  // Última fecha de saldado por mes
  const saldadoPorMes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of settlements) {
      const actual = map.get(s.mes);
      if (!actual || s.fecha_saldado > actual) map.set(s.mes, s.fecha_saldado);
    }
    return map;
  }, [settlements]);

  // Una transacción está pendiente si su mes no está saldado, o si fue
  // ingresada después del último saldado de ese mes.
  const pendientes = useMemo(
    () =>
      transacciones.filter((t) => {
        const saldado = saldadoPorMes.get(t.mes);
        return !saldado || t.created_at > saldado;
      }),
    [transacciones, saldadoPorMes]
  );

  const factor = settings?.factor_reparto_josefina ?? 0.275;

  const balanceTotal = useMemo(() => {
    if (!javier || !josefina) return 0;
    return pendientes.reduce(
      (acc, t) => acc + deudaDeTransaccion(t, javier.id, josefina.id, factor),
      0
    );
  }, [pendientes, javier, josefina, factor]);

  const balanceMesActual = useMemo(() => {
    if (!javier || !josefina) return 0;
    return pendientes
      .filter((t) => t.mes === mes)
      .reduce(
        (acc, t) => acc + deudaDeTransaccion(t, javier.id, josefina.id, factor),
        0
      );
  }, [pendientes, javier, josefina, factor, mes]);

  const txDelMes = useMemo(
    () =>
      transacciones
        .filter((t) => t.mes === mes)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [transacciones, mes]
  );

  async function saldar() {
    if (!yo) return;
    setSaldando(true);
    // Meses con transacciones pendientes (incluye el actual)
    const mesesPendientes = Array.from(new Set(pendientes.map((t) => t.mes)));
    const total = Math.round(Math.abs(balanceTotal));
    const filas = mesesPendientes.map((m) => ({
      mes: m,
      monto_saldado: m === mes ? total : 0,
      saldado_por: yo.id,
    }));
    if (filas.length === 0) {
      filas.push({ mes, monto_saldado: 0, saldado_por: yo.id });
    }
    await supabase.from("monthly_settlements").insert(filas);
    setSaldando(false);
    recargar();
  }

  async function actualizarTx(id: string, cambios: Partial<Transaction>) {
    await supabase.from("transactions").update(cambios).eq("id", id);
    setEditando(null);
    recargar();
  }

  async function eliminarTx(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    recargar();
  }

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        Cargando…
      </main>
    );
  }

  const nombrePagador = (id: string | null) =>
    users.find((u) => u.id === id)?.nombre ?? "—";

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <h1 className="mb-3 text-xl font-bold text-gray-900">Nosotros</h1>

      {/* Balance: una sola cifra clara */}
      <section className="rounded-2xl bg-white p-5 text-center shadow-sm">
        <p className="text-sm text-gray-500">{textoBalance(balanceTotal)}</p>
        <p
          className={`mt-1 text-4xl font-bold ${
            Math.round(balanceTotal) === 0 ? "text-brand-600" : "text-gray-900"
          }`}
        >
          {clp(Math.abs(Math.round(balanceTotal)))}
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Mes en curso: {clp(Math.abs(Math.round(balanceMesActual)))} · Acumulado
          anterior:{" "}
          {clp(Math.abs(Math.round(balanceTotal - balanceMesActual)))}
        </p>

        {Math.round(balanceTotal) !== 0 && (
          <button
            onClick={saldar}
            disabled={saldando}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white active:bg-brand-700 disabled:opacity-50"
          >
            {saldando ? "Saldando…" : "Saldar cuentas ✓"}
          </button>
        )}
      </section>

      {/* Movimientos del mes con su reparto, editables */}
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold capitalize text-gray-700">
          Movimientos de {nombreMes(mes)}
        </h2>
        <div className="space-y-2">
          {txDelMes.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
              Sin movimientos este mes
            </p>
          )}
          {txDelMes.map((t) => {
            const deuda =
              javier && josefina
                ? deudaDeTransaccion(t, javier.id, josefina.id, factor)
                : 0;
            const enEdicion = editando === t.id;
            return (
              <div key={t.id} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {t.descripcion}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.fecha.slice(8, 10)}/{t.fecha.slice(5, 7)} · Pagó{" "}
                      {nombrePagador(t.pagador_id)} ·{" "}
                      {REPARTO_LABEL[t.tipo_reparto]}
                    </p>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="font-semibold text-gray-900">{clp(t.monto)}</p>
                    {Math.round(deuda) !== 0 && (
                      <p className="text-xs text-gray-400">
                        {deuda > 0 ? "J. debe" : "Jv. debe"}{" "}
                        {clp(Math.abs(Math.round(deuda)))}
                      </p>
                    )}
                  </div>
                </div>

                {enEdicion ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
                    <select
                      defaultValue={t.tipo_reparto}
                      onChange={(e) =>
                        actualizarTx(t.id, {
                          tipo_reparto: e.target.value as TipoReparto,
                        })
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {(Object.keys(REPARTO_LABEL) as TipoReparto[]).map((r) => (
                        <option key={r} value={r}>
                          {REPARTO_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <select
                      defaultValue={t.pagador_id ?? ""}
                      onChange={(e) =>
                        actualizarTx(t.id, { pagador_id: e.target.value })
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          Pagó {u.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => eliminarTx(t.id)}
                      className="text-left text-sm text-red-600"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="text-right text-sm text-gray-500"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditando(t.id)}
                    className="mt-1 text-xs text-brand-600"
                  >
                    Editar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <TabBar />
    </main>
  );
}
