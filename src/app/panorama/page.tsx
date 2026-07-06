"use client";

import { useCallback, useEffect, useState } from "react";
import { TabBar } from "@/components/TabBar";
import { CuentasTarjetas } from "@/components/panorama/CuentasTarjetas";
import { Deuda } from "@/components/panorama/Deuda";
import { Historial } from "@/components/panorama/Historial";
import { Inversiones } from "@/components/panorama/Inversiones";
import { Proyeccion } from "@/components/panorama/Proyeccion";
import { mesActual, sumarMeses } from "@/lib/format";
import { proyeccion12Meses } from "@/lib/projection";
import type { Account, Installment, Investment, Transaction } from "@/lib/types";
import { useAppData } from "@/lib/useAppData";

export default function PanoramaPage() {
  const { supabase, categorias, settings, javier, cargando } = useAppData();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transacciones, setTransacciones] = useState<Transaction[]>([]);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    async function cargar() {
      // Historial de 24 meses para tendencia + comparación año anterior
      const desde = sumarMeses(mesActual(), -24);
      const [{ data: inst }, { data: inv }, { data: acc }, { data: tx }] =
        await Promise.all([
          supabase.from("installments").select("*").order("fecha_inicio"),
          supabase.from("investments").select("*").order("monto_actual", { ascending: false }),
          supabase.from("accounts").select("*").order("orden"),
          supabase.from("transactions").select("*").gte("mes", desde),
        ]);
      setInstallments((inst as Installment[]) ?? []);
      setInvestments((inv as Investment[]) ?? []);
      setAccounts((acc as Account[]) ?? []);
      setTransacciones((tx as Transaction[]) ?? []);
    }
    cargar();
  }, [supabase, version]);

  if (cargando || !settings || !javier) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-400">
        Cargando…
      </main>
    );
  }

  const meses = proyeccion12Meses({
    settings,
    categorias,
    installments,
    transacciones,
    javierId: javier.id,
  });

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-24 pt-4">
      <h1 className="text-xl font-bold text-gray-900">Panorama</h1>
      <Proyeccion meses={meses} />
      <CuentasTarjetas
        supabase={supabase}
        accounts={accounts}
        onCambio={recargar}
      />
      <Deuda installments={installments} />
      <Inversiones
        supabase={supabase}
        investments={investments}
        onCambio={recargar}
      />
      <Historial transacciones={transacciones} categorias={categorias} />
      <TabBar />
    </main>
  );
}
