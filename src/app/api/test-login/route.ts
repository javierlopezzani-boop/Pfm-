import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Ruta SOLO para pruebas automatizadas (QA de CX con Playwright).
// Gated por ALLOW_TEST_LOGIN=true: en producción (Vercel) está apagada.
// Fija una contraseña temporal al usuario de prueba con la service key y hace
// signInWithPassword, que escribe las cookies de @supabase/ssr correctamente,
// para que los tests entren sin depender del magic link por email.
export async function GET(request: Request) {
  if (process.env.ALLOW_TEST_LOGIN !== "true") {
    return NextResponse.json({ error: "No habilitado" }, { status: 404 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Faltan credenciales" }, { status: 500 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get("email") ?? process.env.JAVIER_EMAIL ?? "";
  const next = searchParams.get("next") ?? "/";
  const tempPassword = "qa-cx-" + serviceKey.slice(-12);

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Buscar el usuario y fijarle una contraseña temporal (idempotente).
  //    Si no existe en auth (aún no ha hecho login nunca), lo creamos confirmado.
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password: tempPassword });
  } else {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (cErr) {
      return NextResponse.json({ error: "No se pudo crear usuario", detalle: cErr.message }, { status: 500 });
    }
    user = created.user;
  }

  // 2) signInWithPassword con el server client → escribe cookies de sesión.
  const cookieStore = cookies();
  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (signErr) {
    return NextResponse.json({ error: "No se pudo iniciar sesión", detalle: signErr.message }, { status: 500 });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
