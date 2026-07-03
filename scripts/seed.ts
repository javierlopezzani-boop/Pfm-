// Datos semilla de Finanzas JJ.
// Uso: npm run seed  (requiere .env con SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const javierEmail = process.env.JAVIER_EMAIL ?? "javier.lopezzani@gmail.com";
const josefinaEmail = process.env.JOSEFINA_EMAIL;

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
if (!josefinaEmail) {
  console.error("Falta JOSEFINA_EMAIL en .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

// Categorías ámbito depto con presupuesto mensual (CLP)
const CATEGORIAS_DEPTO: [string, number][] = [
  ["Arriendo", 704652],
  ["Gastos comunes", 270000],
  ["Supermercado", 322000],
  ["Nana", 111000],
  ["Entel", 29850],
  ["Luz", 82107],
  ["Agua", 15860],
  ["Gas", 8600],
  ["Seguro depto", 49299],
  ["TAG", 140000],
  ["Bencina", 200000],
  ["Spotify", 7400],
  ["Netflix", 14253],
  ["Reparaciones y hogar", 0],
];

// Categorías adicionales sin presupuesto
const CATEGORIAS_EXTRA = ["Restaurantes", "Deporte", "Lola", "Salud", "Otros"];

// Cuotas activas a julio 2026
const INSTALLMENTS = [
  { detalle: "Crédito consumo", monto_cuota: 545780, total_cuotas: 24, cuotas_pagadas: 13, fecha_inicio: "2025-08-01" },
  { detalle: "Crédito Tesla", monto_cuota: 267240, total_cuotas: 48, cuotas_pagadas: 1, fecha_inicio: "2026-06-01" },
  { detalle: "Tesla wawa", monto_cuota: 388307, total_cuotas: 48, cuotas_pagadas: 1, fecha_inicio: "2026-06-01" },
  { detalle: "Alergika", monto_cuota: 103883, total_cuotas: 6, cuotas_pagadas: 2, fecha_inicio: "2026-05-01" },
];

const INVESTMENTS = [
  { nombre: "mm", monto_actual: 1556000 },
  { nombre: "racional", monto_actual: 5500000 },
  { nombre: "APV", monto_actual: 11451000 },
  { nombre: "1+1", monto_actual: 4100000 },
  { nombre: "Platanus", monto_actual: 1854480 },
  { nombre: "Depto", monto_actual: 108350200 },
];

async function main() {
  console.log("→ allowed_users y users…");
  const { error: e1 } = await supabase.from("allowed_users").upsert(
    [{ email: javierEmail }, { email: josefinaEmail }],
    { onConflict: "email" }
  );
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("users").upsert(
    [
      { email: javierEmail, nombre: "Javier" },
      { email: josefinaEmail, nombre: "Josefina" },
    ],
    { onConflict: "email" }
  );
  if (e2) throw e2;

  console.log("→ settings…");
  const { error: e3 } = await supabase.from("settings").upsert({
    id: 1,
    factor_reparto_josefina: 0.275,
    sueldo_liquido: 4005513,
    ahorro_mensual: 500000,
    apv_mensual: 150000,
    ppto_variable_mensual: 500000,
  });
  if (e3) throw e3;

  console.log("→ categorías…");
  const categorias = [
    ...CATEGORIAS_DEPTO.map(([nombre, ppto]) => ({
      nombre,
      presupuesto_mensual: ppto,
      ambito: "depto" as const,
    })),
    ...CATEGORIAS_EXTRA.map((nombre) => ({
      nombre,
      presupuesto_mensual: 0,
      ambito: "depto" as const,
    })),
  ];
  const { error: e4 } = await supabase
    .from("categories")
    .upsert(categorias, { onConflict: "nombre,ambito" });
  if (e4) throw e4;

  console.log("→ cuotas…");
  const { data: existentes } = await supabase.from("installments").select("detalle");
  const yaExisten = new Set((existentes ?? []).map((i) => i.detalle));
  const nuevas = INSTALLMENTS.filter((i) => !yaExisten.has(i.detalle));
  if (nuevas.length > 0) {
    const { error: e5 } = await supabase.from("installments").insert(nuevas);
    if (e5) throw e5;
  }

  console.log("→ inversiones…");
  const { data: invExistentes } = await supabase.from("investments").select("nombre");
  const invYa = new Set((invExistentes ?? []).map((i) => i.nombre));
  const invNuevas = INVESTMENTS.filter((i) => !invYa.has(i.nombre));
  if (invNuevas.length > 0) {
    const { error: e6 } = await supabase.from("investments").insert(invNuevas);
    if (e6) throw e6;
  }

  console.log("✓ Seed completo");
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
