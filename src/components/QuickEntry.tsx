"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extraerMonto, hoyLocal, normalizarTexto, clp } from "@/lib/format";
import type { Category, CategorizeSuggestion, TipoReparto, User } from "@/lib/types";

interface Props {
  supabase: SupabaseClient;
  categorias: Category[];
  users: User[];
  yo: User | undefined;
  onGuardado: () => void;
}

interface Borrador {
  texto: string;
  descripcion: string;
  monto: number;
  categoriaId: string | null;
  pagadorId: string | null;
  tipoReparto: TipoReparto;
  vinoDeAlias: boolean;
}

export function QuickEntry({ supabase, categorias, users, yo, onGuardado }: Props) {
  const [texto, setTexto] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [avisoDuplicado, setAvisoDuplicado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriasActivas = categorias.filter((c) => c.activa);

  function descripcionDesdeTexto(t: string): string {
    return t
      .replace(/\d{1,3}(?:\.\d{3})+|\d+/g, "")
      .replace(/\s+/g, " ")
      .trim() || t;
  }

  function pagadorPorTexto(t: string): User | undefined {
    const bajo = t.toLowerCase();
    if (/\bjose(fina)?\b|\bella\b/.test(bajo)) {
      return users.find((u) => u.nombre === "Josefina");
    }
    return yo;
  }

  async function procesar() {
    const t = texto.trim();
    if (!t) return;
    setError(null);
    setProcesando(true);

    const monto = extraerMonto(t) ?? 0;
    const norm = normalizarTexto(t);
    const descripcion = descripcionDesdeTexto(t);
    const pagador = pagadorPorTexto(t);

    // 1) Buscar alias: match exacto o el alias contenido en el texto
    const { data: aliases } = await supabase
      .from("aliases")
      .select("texto_normalizado, categoria_id");

    let categoriaAlias: string | null = null;
    if (aliases) {
      const exacto = aliases.find((a) => a.texto_normalizado === norm);
      const contenido = aliases.find(
        (a) =>
          a.texto_normalizado.length >= 3 &&
          norm.split(" ").some(
            (palabra) =>
              palabra === a.texto_normalizado ||
              a.texto_normalizado.split(" ").includes(palabra)
          )
      );
      categoriaAlias = (exacto ?? contenido)?.categoria_id ?? null;
    }

    if (categoriaAlias) {
      // Categorización instantánea, sin API
      setBorrador({
        texto: t,
        descripcion,
        monto,
        categoriaId: categoriaAlias,
        pagadorId: pagador?.id ?? null,
        tipoReparto: "compartido",
        vinoDeAlias: true,
      });
      setProcesando(false);
      return;
    }

    // 2) Sin alias: llamar a claude-haiku
    try {
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: t,
          categorias: categoriasActivas.map((c) => c.nombre),
        }),
      });
      if (!res.ok) throw new Error("api");
      const sugerencia = (await res.json()) as CategorizeSuggestion;
      const cat = categoriasActivas.find((c) => c.nombre === sugerencia.categoria);
      const pagadorSugerido = users.find(
        (u) => u.nombre === sugerencia.pagador_sugerido
      );
      setBorrador({
        texto: t,
        descripcion,
        monto: sugerencia.monto || monto,
        categoriaId: cat?.id ?? null,
        pagadorId: (pagadorSugerido ?? pagador)?.id ?? null,
        tipoReparto: sugerencia.tipo_reparto_sugerido ?? "compartido",
        vinoDeAlias: false,
      });
    } catch {
      // 3) Fallback sin conexión o sin API: selector manual
      setBorrador({
        texto: t,
        descripcion,
        monto,
        categoriaId: null,
        pagadorId: pagador?.id ?? null,
        tipoReparto: "compartido",
        vinoDeAlias: false,
      });
    } finally {
      setProcesando(false);
    }
  }

  async function confirmar(ignorarDuplicado = false) {
    if (!borrador || !borrador.categoriaId || borrador.monto <= 0) {
      setError("Falta categoría o monto válido.");
      return;
    }
    setGuardando(true);
    setError(null);

    // Detección de duplicados: mismo monto + descripción similar en las últimas 2 horas
    if (!ignorarDuplicado) {
      const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recientes } = await supabase
        .from("transactions")
        .select("id, descripcion, monto")
        .eq("monto", borrador.monto)
        .gte("created_at", hace2h);
      const normBorrador = normalizarTexto(borrador.descripcion);
      const similar = (recientes ?? []).some((r) => {
        const normR = normalizarTexto(r.descripcion);
        return normR.includes(normBorrador) || normBorrador.includes(normR);
      });
      if (similar) {
        setAvisoDuplicado(true);
        setGuardando(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      fecha: hoyLocal(),
      descripcion: borrador.descripcion,
      monto: borrador.monto,
      categoria_id: borrador.categoriaId,
      pagador_id: borrador.pagadorId,
      tipo_reparto: borrador.tipoReparto,
      created_by: yo?.id ?? null,
    });

    if (insertError) {
      setError("No se pudo guardar. Intenta de nuevo.");
      setGuardando(false);
      return;
    }

    // Aprender/actualizar alias con la palabra clave principal.
    // Si el usuario corrigió la categoría, el alias queda con la corrección.
    const claveNorm = normalizarTexto(borrador.descripcion);
    if (claveNorm.length >= 3) {
      await supabase
        .from("aliases")
        .upsert(
          {
            texto_normalizado: claveNorm,
            categoria_id: borrador.categoriaId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "texto_normalizado" }
        );
    }

    setTexto("");
    setBorrador(null);
    setAvisoDuplicado(false);
    setGuardando(false);
    onGuardado();
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          procesar();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder='Ej: "bencina 48.200" o "super lider 89.225 jose"'
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={procesando || !texto.trim()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white active:bg-brand-700 disabled:opacity-40"
        >
          {procesando ? "…" : "+"}
        </button>
      </form>

      {borrador && (
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-brand-700">
              {borrador.vinoDeAlias ? "Categorizado al instante ⚡" : "Confirma el gasto"}
            </span>
            <button
              onClick={() => {
                setBorrador(null);
                setAvisoDuplicado(false);
              }}
              className="text-sm text-gray-500"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-xs text-gray-500">
              Descripción
              <input
                value={borrador.descripcion}
                onChange={(e) =>
                  setBorrador({ ...borrador, descripcion: e.target.value })
                }
                className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-2 text-base text-gray-900"
              />
            </label>
            <label className="text-xs text-gray-500">
              Monto (CLP)
              <input
                type="text"
                inputMode="numeric"
                value={borrador.monto ? clp(borrador.monto).slice(1) : ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\./g, ""), 10);
                  setBorrador({ ...borrador, monto: isNaN(n) ? 0 : n });
                }}
                className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-2 text-base text-gray-900"
              />
            </label>
            <label className="text-xs text-gray-500">
              Categoría
              <select
                value={borrador.categoriaId ?? ""}
                onChange={(e) =>
                  setBorrador({ ...borrador, categoriaId: e.target.value || null })
                }
                className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-base text-gray-900"
              >
                <option value="">Elegir…</option>
                {categoriasActivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.ambito === "personal" ? "(personal)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Pagó
              <select
                value={borrador.pagadorId ?? ""}
                onChange={(e) =>
                  setBorrador({ ...borrador, pagadorId: e.target.value || null })
                }
                className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-base text-gray-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Reparto
              <select
                value={borrador.tipoReparto}
                onChange={(e) =>
                  setBorrador({
                    ...borrador,
                    tipoReparto: e.target.value as TipoReparto,
                  })
                }
                className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-base text-gray-900"
              >
                <option value="compartido">Compartido</option>
                <option value="de_javier">De Javier</option>
                <option value="de_josefina">De Josefina</option>
                <option value="abono">Abono</option>
              </select>
            </label>
          </div>

          {avisoDuplicado ? (
            <div className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              ⚠️ Hay un gasto igual en las últimas 2 horas. ¿Guardar de todos modos?
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => confirmar(true)}
                  disabled={guardando}
                  className="flex-1 rounded-lg bg-amber-600 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Sí, guardar
                </button>
                <button
                  onClick={() => setAvisoDuplicado(false)}
                  className="flex-1 rounded-lg border border-amber-300 py-2 font-semibold text-amber-800"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => confirmar()}
              disabled={guardando || !borrador.categoriaId || borrador.monto <= 0}
              className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-base font-semibold text-white active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {guardando
                ? "Guardando…"
                : !borrador.categoriaId
                ? "Elige una categoría"
                : borrador.monto <= 0
                ? "Ingresa un monto"
                : `Guardar ${clp(borrador.monto)}`}
            </button>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
