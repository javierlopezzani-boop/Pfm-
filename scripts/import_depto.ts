// Importa el historial de data/Depto.xlsx (julio 2025 → junio 2026).
// Uso:
//   npm run import:depto            → solo muestra el reporte (dry-run)
//   npm run import:depto:confirm    → escribe en la base de datos
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import "dotenv/config";

const CONFIRMAR = process.argv.includes("--confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
const supabase = createClient(url, serviceKey);

// ------------------------------------------------------------------
// Meses objetivo: 2025-07 … 2026-06, con nombres tolerantes
// ------------------------------------------------------------------

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// nombres aceptables para un YYYY-MM: "julio 25", "jul 25", etc.
function nombresAceptables(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const nombre = NOMBRES_MES[m - 1];
  const yy = String(y).slice(2);
  const base = [
    `${nombre} ${yy}`,
    `${nombre.slice(0, 3)} ${yy}`,
    `${nombre.slice(0, 4)} ${yy}`,
  ];
  // Anomalía conocida en la planilla: diciembre 2025 está rotulado "Dic 26"
  if (mes === "2025-12") {
    base.push("dic 26", "diciembre 26");
  }
  return base;
}

function mesesObjetivo(): string[] {
  const meses: string[] = [];
  for (let i = 0; i < 12; i++) {
    const total = 2025 * 12 + 6 + i; // 2025-07 en meses absolutos (0-index)
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    meses.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return meses;
}

// ------------------------------------------------------------------
// Inferencia de categoría por palabras clave (el orden importa)
// ------------------------------------------------------------------

const REGLAS: [RegExp, string][] = [
  [/gastos comunes|gasto comun|gc\b/, "Gastos comunes"],
  [/arriendo|dividendo/, "Arriendo"],
  [/agua\b/, "Agua"],
  [/luz|enel|electric/, "Luz"],
  [/\bgas\b|lipigas|abastible|metrogas/, "Gas"],
  [/entel|gtd|internet|telefono|wom|movistar/, "Entel"],
  [/nana|asesora/, "Nana"],
  [/netflix/, "Netflix"],
  [/spotify/, "Spotify"],
  [/super|lider|jumbo|unimarc|tottus|santa isabel|mercado/, "Supermercado"],
  [/bencina|copec|shell|petrobras|combustible|carga tesla|electrolinera/, "Bencina"],
  [/\btag\b|autopista|peaje|vespucio|costanera/, "TAG"],
  [/seguro/, "Seguro depto"],
  [/reparac|hogar|ferreter|sodimac|easy|gasfiter/, "Reparaciones y hogar"],
  [/restauran|resto|delivery|rappi|pedidosya|uber eats|comida/, "Restaurantes"],
  [/deporte|gym|gimnasio|padel|futbol/, "Deporte"],
  [/lola|veterinari|mascota|trazodona/, "Lola"],
  [/salud|farmacia|isapre|clinica|medico|doctor/, "Salud"],
];

function inferirCategoria(texto: string): string {
  const n = normalizar(texto);
  for (const [regex, categoria] of REGLAS) {
    if (regex.test(n)) return categoria;
  }
  return "Otros";
}

// Filas de totales / encabezados que hay que ignorar
const TEXTO_IGNORAR = /^(gastos?|pagos?|importe|fecha|descripcion|categoria|status|total|pagado|por pagar|javier|josefina)$/;

// ------------------------------------------------------------------
// Lectura de una hoja mensual: pares texto+número en columnas B..F
// ------------------------------------------------------------------

interface FilaImportada {
  descripcion: string;
  monto: number;
  categoria: string;
}

function leerHoja(ws: XLSX.WorkSheet): { filas: FilaImportada[]; ignoradas: number } {
  const matriz: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const filas: FilaImportada[] = [];
  let ignoradas = 0;

  for (const fila of matriz) {
    // Solo columnas B..F (índices 1..5) para no leer la sección "Pagos"
    const celdas = (fila ?? []).slice(1, 6);

    // número más plausible de la fila (monto)
    let monto: number | null = null;
    const textos: string[] = [];
    for (const c of celdas) {
      if (typeof c === "number" && isFinite(c) && c > 0) {
        // toma el primer número > 0 como monto
        if (monto === null) monto = Math.round(c);
      } else if (typeof c === "string" && c.trim()) {
        const limpio = c.trim();
        // números guardados como texto ("383009")
        const comoNumero = Number(limpio.replace(/\./g, "").replace(",", "."));
        if (/^[\d.,]+$/.test(limpio) && isFinite(comoNumero) && comoNumero > 0) {
          if (monto === null) monto = Math.round(comoNumero);
        } else {
          textos.push(limpio);
        }
      }
    }

    if (monto === null || monto <= 0) {
      if (textos.length > 0) ignoradas++;
      continue;
    }

    const textosUtiles = textos.filter((t) => !TEXTO_IGNORAR.test(normalizar(t)));
    if (textosUtiles.length === 0) {
      // número sin texto: probablemente un total → ignorar
      ignoradas++;
      continue;
    }

    // montos absurdos (celdas de fórmula rotas, porcentajes, etc.)
    if (monto < 100 || monto > 50_000_000) {
      ignoradas++;
      continue;
    }

    const descripcion = textosUtiles[0];
    // la categoría de la planilla (si existe) suele venir en la segunda celda de texto
    const textoCategoria = textosUtiles[1] ?? descripcion;
    const categoria = inferirCategoria(`${textoCategoria} ${descripcion}`);

    filas.push({ descripcion, monto, categoria });
  }

  return { filas, ignoradas };
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  const wb = XLSX.readFile("data/Depto.xlsx");
  const hojasNormalizadas = new Map(
    wb.SheetNames.map((n) => [normalizar(n), n])
  );

  const porMes = new Map<string, { filas: FilaImportada[]; ignoradas: number; hoja: string }>();
  const sinHoja: string[] = [];

  for (const mes of mesesObjetivo()) {
    const nombreHoja = nombresAceptables(mes)
      .map((n) => hojasNormalizadas.get(n))
      .find(Boolean);
    if (!nombreHoja) {
      sinHoja.push(mes);
      continue;
    }
    const { filas, ignoradas } = leerHoja(wb.Sheets[nombreHoja]);
    porMes.set(mes, { filas, ignoradas, hoja: nombreHoja });
  }

  // ------------------ Reporte ------------------
  console.log("\n═══ Reporte de importación (Depto.xlsx) ═══\n");
  const porCategoria = new Map<string, { n: number; total: number }>();
  let totalFilas = 0;
  let totalIgnoradas = 0;

  for (const [mes, info] of porMes) {
    const suma = info.filas.reduce((a, f) => a + f.monto, 0);
    console.log(
      `${mes}  (hoja "${info.hoja}"): ${info.filas.length} filas, ${info.ignoradas} ignoradas, total $${suma.toLocaleString("es-CL")}`
    );
    totalFilas += info.filas.length;
    totalIgnoradas += info.ignoradas;
    for (const f of info.filas) {
      const acc = porCategoria.get(f.categoria) ?? { n: 0, total: 0 };
      acc.n += 1;
      acc.total += f.monto;
      porCategoria.set(f.categoria, acc);
    }
  }
  for (const mes of sinHoja) {
    console.log(`${mes}  — sin hoja en el Excel, se omite`);
  }

  console.log("\nPor categoría:");
  for (const [cat, { n, total }] of Array.from(porCategoria).sort(
    (a, b) => b[1].total - a[1].total
  )) {
    console.log(`  ${cat.padEnd(22)} ${String(n).padStart(3)} filas  $${total.toLocaleString("es-CL")}`);
  }
  console.log(`\nTotal: ${totalFilas} filas a importar, ${totalIgnoradas} ignoradas.\n`);

  if (!CONFIRMAR) {
    console.log("Dry-run. Para escribir en la base de datos: npm run import:depto:confirm");
    return;
  }

  // ------------------ Escritura ------------------
  console.log("Escribiendo en Supabase…");

  const { data: users } = await supabase.from("users").select("id, nombre");
  const javier = users?.find((u) => u.nombre === "Javier");
  if (!javier) throw new Error("Usuario Javier no existe. Corre primero: npm run seed");

  const { data: cats } = await supabase.from("categories").select("id, nombre");
  const catPorNombre = new Map((cats ?? []).map((c) => [c.nombre, c.id]));
  const otrosId = catPorNombre.get("Otros");
  if (!otrosId) throw new Error("Categoría 'Otros' no existe. Corre primero: npm run seed");

  for (const [mes, info] of porMes) {
    if (info.filas.length === 0) continue;

    // Evitar duplicados si el script se corre dos veces
    const { data: yaImportadas } = await supabase
      .from("transactions")
      .select("id")
      .eq("mes", mes)
      .limit(1);
    if ((yaImportadas ?? []).length > 0) {
      console.log(`  ${mes}: ya tiene transacciones, se omite`);
      continue;
    }

    const filas = info.filas.map((f) => ({
      fecha: `${mes}-01`,
      descripcion: f.descripcion,
      monto: f.monto,
      categoria_id: catPorNombre.get(f.categoria) ?? otrosId,
      pagador_id: javier.id,
      tipo_reparto: "compartido",
      created_by: javier.id,
    }));

    const { error } = await supabase.from("transactions").insert(filas);
    if (error) throw error;
    console.log(`  ${mes}: ${filas.length} transacciones insertadas`);
  }

  // Marcar meses como saldados (monto 0) para no ensuciar el balance de pareja.
  // Se insertan DESPUÉS de las transacciones para que fecha_saldado > created_at.
  const settlements = Array.from(porMes.keys()).map((mes) => ({
    mes,
    monto_saldado: 0,
    saldado_por: javier.id,
  }));
  const { error: eS } = await supabase.from("monthly_settlements").insert(settlements);
  if (eS) throw eS;
  console.log(`  ${settlements.length} meses marcados como saldados (monto 0)`);

  console.log("\n✓ Importación completa");
}

main().catch((err) => {
  console.error("Error importando:", err);
  process.exit(1);
});
