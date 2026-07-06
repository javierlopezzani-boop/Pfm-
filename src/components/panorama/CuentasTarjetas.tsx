"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clp } from "@/lib/format";
import type { Account, TipoCuenta } from "@/lib/types";

export function CuentasTarjetas({
  supabase,
  accounts,
  onCambio,
}: {
  supabase: SupabaseClient;
  accounts: Account[];
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState<TipoCuenta | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [montoNuevo, setMontoNuevo] = useState("");
  const [cupoNuevo, setCupoNuevo] = useState("");
  const [montoEdit, setMontoEdit] = useState("");
  const [cupoEdit, setCupoEdit] = useState("");

  const cuentas = accounts.filter((a) => a.tipo === "cuenta");
  const tarjetas = accounts.filter((a) => a.tipo === "tarjeta");

  const totalCuentas = cuentas.reduce((a, c) => a + c.monto, 0);
  const totalUtilizado = tarjetas.reduce((a, t) => a + t.monto, 0);

  const parse = (s: string) => {
    const n = parseInt(s.replace(/\./g, "").replace(/[^\d-]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  };

  async function agregar(tipo: TipoCuenta) {
    if (!nombreNuevo.trim()) return;
    await supabase.from("accounts").insert({
      nombre: nombreNuevo.trim(),
      tipo,
      monto: parse(montoNuevo),
      cupo: tipo === "tarjeta" && cupoNuevo ? parse(cupoNuevo) : null,
      orden: accounts.length,
      fecha_actualizacion: new Date().toISOString(),
    });
    setNombreNuevo("");
    setMontoNuevo("");
    setCupoNuevo("");
    setAgregando(null);
    onCambio();
  }

  async function guardarEdit(a: Account) {
    await supabase
      .from("accounts")
      .update({
        monto: parse(montoEdit),
        cupo: a.tipo === "tarjeta" ? (cupoEdit ? parse(cupoEdit) : null) : null,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", a.id);
    setEditando(null);
    onCambio();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from("accounts").delete().eq("id", id);
    onCambio();
  }

  function Fila({ a }: { a: Account }) {
    const enEdicion = editando === a.id;
    const disponible = a.tipo === "tarjeta" && a.cupo != null ? a.cupo - a.monto : null;
    return (
      <div className="py-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">{a.nombre}</p>
            {a.tipo === "tarjeta" && a.cupo != null && (
              <p className="text-[11px] text-gray-400">
                Cupo {clp(a.cupo)} · disponible {clp(disponible ?? 0)}
              </p>
            )}
          </div>
          {enEdicion ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                inputMode="numeric"
                value={montoEdit}
                onChange={(e) => setMontoEdit(e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
                placeholder={a.tipo === "tarjeta" ? "utilizado" : "saldo"}
              />
              <button
                onClick={() => guardarEdit(a)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white"
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditando(a.id);
                setMontoEdit(String(a.monto));
                setCupoEdit(a.cupo != null ? String(a.cupo) : "");
              }}
              className="text-right text-sm font-semibold text-gray-900 underline decoration-dotted underline-offset-2"
            >
              {clp(a.monto)}
            </button>
          )}
        </div>
        {enEdicion && (
          <div className="mt-1 flex items-center gap-3">
            {a.tipo === "tarjeta" && (
              <input
                inputMode="numeric"
                value={cupoEdit}
                onChange={(e) => setCupoEdit(e.target.value)}
                placeholder="Cupo total (opcional)"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
            <button
              onClick={() => eliminar(a.id)}
              className="py-1.5 text-sm text-red-600"
            >
              Eliminar
            </button>
            <button
              onClick={() => setEditando(null)}
              className="py-1.5 text-sm text-gray-500"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    );
  }

  function FormAgregar({ tipo }: { tipo: TipoCuenta }) {
    return (
      <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
        <input
          autoFocus
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder={tipo === "cuenta" ? "Nombre de la cuenta" : "Nombre de la tarjeta"}
          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            value={montoNuevo}
            onChange={(e) => setMontoNuevo(e.target.value)}
            placeholder={tipo === "cuenta" ? "Saldo" : "Monto utilizado"}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
          {tipo === "tarjeta" && (
            <input
              inputMode="numeric"
              value={cupoNuevo}
              onChange={(e) => setCupoNuevo(e.target.value)}
              placeholder="Cupo (opc.)"
              className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => agregar(tipo)}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white"
          >
            Agregar
          </button>
          <button
            onClick={() => {
              setAgregando(null);
              setNombreNuevo("");
              setMontoNuevo("");
              setCupoNuevo("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Cuentas y tarjetas</h2>

      {/* Cuentas */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Cuentas
          </h3>
          <span className="text-sm font-semibold text-gray-900">
            {clp(totalCuentas)}
          </span>
        </div>
        <div className="divide-y divide-gray-50">
          {cuentas.map((a) => (
            <Fila key={a.id} a={a} />
          ))}
        </div>
        {agregando === "cuenta" ? (
          <FormAgregar tipo="cuenta" />
        ) : (
          <button
            onClick={() => setAgregando("cuenta")}
            className="mt-1 text-sm font-medium text-brand-600"
          >
            + Agregar cuenta
          </button>
        )}
      </div>

      {/* Tarjetas */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Tarjetas · utilizado
          </h3>
          <span className="text-sm font-semibold text-gray-900">
            {clp(totalUtilizado)}
          </span>
        </div>
        <div className="divide-y divide-gray-50">
          {tarjetas.map((a) => (
            <Fila key={a.id} a={a} />
          ))}
        </div>
        {agregando === "tarjeta" ? (
          <FormAgregar tipo="tarjeta" />
        ) : (
          <button
            onClick={() => setAgregando("tarjeta")}
            className="mt-1 text-sm font-medium text-brand-600"
          >
            + Agregar tarjeta
          </button>
        )}
      </div>
    </section>
  );
}
