"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setCargando(false);
    if (error) {
      setError("No se pudo enviar el enlace. Revisa el email e intenta de nuevo.");
    } else {
      setEnviado(true);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-brand-700">
          Finanzas JJ
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Finanzas de Javier y Josefina
        </p>

        {enviado ? (
          <div className="mt-8 rounded-xl bg-brand-50 p-4 text-center text-sm text-brand-700">
            Te enviamos un enlace mágico a <strong>{email}</strong>. Ábrelo
            desde este teléfono para entrar.
          </div>
        ) : (
          <form onSubmit={enviarMagicLink} className="mt-8 space-y-3">
            <input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-50"
            >
              {cargando ? "Enviando…" : "Enviarme enlace mágico"}
            </button>
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
