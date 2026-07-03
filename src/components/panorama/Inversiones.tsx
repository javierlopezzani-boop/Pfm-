"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clp } from "@/lib/format";
import type { Investment } from "@/lib/types";

export function Inversiones({
  supabase,
  investments,
  onCambio,
}: {
  supabase: SupabaseClient;
  investments: Investment[];
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");

  const total = investments.reduce((acc, i) => acc + i.monto_actual, 0);

  async function guardar(id: string) {
    const n = parseInt(valor.replace(/\./g, ""), 10);
    if (!isNaN(n) && n >= 0) {
      await supabase
        .from("investments")
        .update({ monto_actual: n, fecha_actualizacion: new Date().toISOString() })
        .eq("id", id);
      onCambio();
    }
    setEditando(null);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Inversiones</h2>
        <span className="font-bold text-gray-900">{clp(total)}</span>
      </div>
      <div className="mt-2 divide-y divide-gray-50">
        {investments.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between py-2">
            <p className="text-sm font-medium text-gray-800">{inv.nombre}</p>
            {editando === inv.id ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardar(inv.id)}
                  className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                />
                <button
                  onClick={() => guardar(inv.id)}
                  className="rounded-lg bg-brand-600 px-2 py-1 text-sm text-white"
                >
                  ✓
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditando(inv.id);
                  setValor(String(inv.monto_actual));
                }}
                className="text-sm font-semibold text-gray-900 underline decoration-dotted underline-offset-2"
              >
                {clp(inv.monto_actual)}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
