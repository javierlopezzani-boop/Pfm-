"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Settings, User } from "@/lib/types";

// Datos base compartidos por todas las pantallas
export function useAppData() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [miEmail, setMiEmail] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [{ data: auth }, { data: u }, { data: c }, { data: s }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase.from("users").select("*"),
          supabase.from("categories").select("*").order("nombre"),
          supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
        ]);
      if (cancelado) return;
      setMiEmail(auth.user?.email ?? null);
      setUsers((u as User[]) ?? []);
      setCategorias((c as Category[]) ?? []);
      setSettings((s as Settings) ?? null);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  const javier = users.find((u) => u.nombre === "Javier");
  const josefina = users.find((u) => u.nombre === "Josefina");
  const yo = users.find((u) => u.email === miEmail) ?? javier;

  return { supabase, users, categorias, settings, javier, josefina, yo, cargando };
}
