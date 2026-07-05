// QA de CX: maneja la app en viewport de teléfono, con datos reales de Supabase,
// captura screenshots de cada pantalla y estado, y corre chequeos de usabilidad.
//
// El navegador de este entorno no puede abrir TLS a Supabase a través del proxy,
// así que traemos los datos por Node (que sí puede) e interceptamos las llamadas
// del navegador a Supabase sirviéndolas desde esos datos (PostgREST-lite).
// Esto hace el QA determinístico y reproducible.
//
// Uso: ALLOW_TEST_LOGIN=true npm run dev (en otra terminal) y luego:
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/cx_capture.ts
import { chromium, type Page, type Route } from "playwright";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const OUT = path.join("qa", "screenshots");
const hallazgos: string[] = [];
fs.mkdirSync(OUT, { recursive: true });

const TABLAS = [
  "users",
  "categories",
  "transactions",
  "installments",
  "aliases",
  "settings",
  "monthly_settlements",
  "investments",
] as const;

type Fila = Record<string, unknown>;

// ---------- 1) Traer datos reales por Node ----------
async function traerFixtures(): Promise<Record<string, Fila[]>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const fixtures: Record<string, Fila[]> = {};
  for (const t of TABLAS) {
    const { data } = await supabase.from(t).select("*");
    fixtures[t] = (data as Fila[]) ?? [];
  }
  return fixtures;
}

// ---------- 2) PostgREST-lite: filtrar/ordenar según los query params ----------
function aplicarConsulta(filas: Fila[], url: URL): Fila[] {
  let res = [...filas];
  let order: { col: string; desc: boolean } | null = null;
  let limit: number | null = null;

  for (const [key, val] of url.searchParams.entries()) {
    if (key === "select") continue;
    if (key === "order") {
      const [col, dir] = val.split(".");
      order = { col, desc: dir === "desc" };
      continue;
    }
    if (key === "limit") {
      limit = parseInt(val, 10);
      continue;
    }
    if (key === "offset") continue;
    // col=op.value  (eq, neq, lte, gte, lt, gt)
    const m = val.match(/^(eq|neq|lte|gte|lt|gt)\.(.*)$/);
    if (!m) continue;
    const [, op, raw] = m;
    const valor = decodeURIComponent(raw);
    res = res.filter((f) => {
      const c = f[key];
      const a = String(c ?? "");
      const b = valor;
      switch (op) {
        case "eq":
          return a === b || Number(a) === Number(b);
        case "neq":
          return a !== b;
        case "lte":
          return a <= b;
        case "gte":
          return a >= b;
        case "lt":
          return a < b;
        case "gt":
          return a > b;
      }
      return true;
    });
  }

  if (order) {
    res.sort((x, y) => {
      const a = String(x[order!.col] ?? "");
      const b = String(y[order!.col] ?? "");
      const cmp = isNaN(Number(a)) || isNaN(Number(b)) ? a.localeCompare(b) : Number(a) - Number(b);
      return order!.desc ? -cmp : cmp;
    });
  }
  if (limit != null) res = res.slice(0, limit);
  return res;
}

// ---------- Chequeos de usabilidad medibles ----------
async function chequeos(page: Page, pantalla: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (overflow) hallazgos.push(`[${pantalla}] Hay scroll horizontal en móvil.`);

  const chicos = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button, a, select, input[type=submit]"));
    const malos: string[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 40 || r.width < 40) {
        const txt = (el.textContent || (el as HTMLElement).getAttribute("aria-label") || "")
          .trim()
          .slice(0, 24);
        malos.push(`${Math.round(r.width)}×${Math.round(r.height)} "${txt}"`);
      }
    }
    return malos.slice(0, 8);
  });
  if (chicos.length) hallazgos.push(`[${pantalla}] Áreas de toque < 40px: ${chicos.join(", ")}`);

  const roto = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/undefined|NaN|\$\{|\bnull\b/);
    return m ? m[0] : null;
  });
  if (roto) hallazgos.push(`[${pantalla}] Texto sospechoso en pantalla: "${roto}".`);

  const ingles = await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return /\b(loading|submit|save|cancel|budget|balance sheet)\b/.test(t);
  });
  if (ingles) hallazgos.push(`[${pantalla}] Se detectó texto en inglés.`);
}

async function shot(page: Page, nombre: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${nombre}.png`), fullPage: true });
  console.log(`  📸 ${nombre}.png`);
}

async function main() {
  console.log("→ Trayendo datos reales por Node…");
  const fixtures = await traerFixtures();
  const javier = fixtures.users.find((u) => u.nombre === "Javier") ?? fixtures.users[0];
  console.log(
    `  ${fixtures.transactions.length} transacciones, ${fixtures.categories.length} categorías`
  );

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    locale: "es-CL",
  });

  // Interceptar TODAS las llamadas del navegador a Supabase y servirlas con datos reales
  await context.route(/supabase\.co\//, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;

    // Auth: getUser / sesión → usuario Javier autenticado
    if (p.startsWith("/auth/v1/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: javier.id,
          email: javier.email,
          aud: "authenticated",
          role: "authenticated",
          user_metadata: {},
          app_metadata: {},
        }),
      });
    }
    if (p.startsWith("/auth/v1/token") || p.startsWith("/auth/v1/logout")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }

    // REST: /rest/v1/<tabla>
    const mTabla = p.match(/\/rest\/v1\/([a-z_]+)/);
    if (mTabla) {
      const tabla = mTabla[1];
      const filas = fixtures[tabla] ?? [];
      if (req.method() !== "GET") {
        // inserts/updates/deletes en QA: responder OK sin persistir
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      const resultado = aplicarConsulta(filas, url);
      // .single()/.maybeSingle() piden un objeto, no un arreglo
      const accept = req.headers()["accept"] ?? "";
      const single = accept.includes("vnd.pgrst.object");
      const body = single ? JSON.stringify(resultado[0] ?? null) : JSON.stringify(resultado);
      return route.fulfill({ status: 200, contentType: "application/json", body });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => hallazgos.push(`[JS error] ${e.message}`));

  console.log("→ Login");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await shot(page, "01-login");
  await chequeos(page, "Login");

  console.log("→ Hoy");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const input = page.locator('input[placeholder*="bencina"]').first();
  await input.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, "02-hoy");
  await chequeos(page, "Hoy");

  console.log("→ Ingreso rápido (tarjeta de confirmación)");
  if (await input.count()) {
    await input.fill("cafe 3.500");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    await shot(page, "03-hoy-confirmacion");
    await chequeos(page, "Ingreso rápido");
  } else {
    hallazgos.push("[Hoy] No se encontró el campo de ingreso rápido (quedó en Cargando).");
  }

  console.log("→ Nosotros");
  await page.goto(`${BASE}/nosotros`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, "04-nosotros");
  await chequeos(page, "Nosotros");

  console.log("→ Panorama");
  await page.goto(`${BASE}/panorama`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot(page, "05-panorama");
  await chequeos(page, "Panorama");

  await browser.close();

  const reporte = [
    "# QA de CX — chequeos automáticos",
    "",
    `Fecha: ${new Date().toISOString()}`,
    `Screenshots: ${OUT}/`,
    "",
    hallazgos.length === 0
      ? "✅ Sin hallazgos en los chequeos automáticos de usabilidad."
      : `⚠️ ${hallazgos.length} hallazgo(s):`,
    ...hallazgos.map((h) => `- ${h}`),
  ].join("\n");
  fs.writeFileSync(path.join("qa", "reporte_automatico.md"), reporte);
  console.log("\n" + reporte);
}

main().catch((e) => {
  console.error("Error en captura CX:", e);
  process.exit(1);
});
