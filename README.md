# Finanzas JJ 💚

App de finanzas personales y de pareja para Javier y Josefina (Chile). Reemplaza las planillas Excel con una PWA mobile-first: ingreso rápido de gastos con categorización automática (claude-haiku), balance de pareja con reparto 27,5/72,5, y proyección de flujo de caja a 12 meses.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase**: Postgres + Auth por magic link + Row Level Security
- **Anthropic API** (claude-haiku) para categorizar texto libre
- **PWA** instalable (manifest + service worker), pensada para usarse desde el teléfono
- Despliegue en **Vercel**

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor, ejecuta `supabase/migrations/0001_schema.sql`.
3. En **Authentication → Providers → Email**, deja activado el magic link (OTP por email).
4. En **Authentication → URL Configuration**, agrega la URL de la app (local y de Vercel) como redirect permitido: `http://localhost:3000/auth/callback` y `https://TU-APP.vercel.app/auth/callback`.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Completa: URL y anon key de Supabase, la service role key (solo para scripts), tu `ANTHROPIC_API_KEY` y el email de Josefina.

### 3. Datos semilla e historial

```bash
npm install
npm run seed              # usuarios, categorías, settings, cuotas, inversiones
npm run import:depto      # reporte de importación de data/Depto.xlsx (dry-run)
npm run import:depto:confirm  # escribe el historial jul 2025 – jun 2026
```

La importación marca los meses históricos como saldados (monto 0) para no ensuciar el balance de pareja actual.

### 4. Correr en local

```bash
npm run dev
# → http://localhost:3000
```

### 5. Desplegar en Vercel

1. Importa el repo en Vercel.
2. Configura las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY`.
3. Agrega el dominio de Vercel a los redirects de Supabase Auth.

### Instalar como PWA

- **iPhone**: Safari → Compartir → "Agregar a pantalla de inicio".
- **Android**: Chrome → menú ⋮ → "Instalar app".

## Pantallas

| Tab | Qué hace |
| --- | --- |
| **Hoy** | Ingreso rápido siempre visible ("bencina 48.200"), resumen del mes con semáforo por categoría, banner de cierre de mes. |
| **Nosotros** | Balance de pareja (compartido 27,5/72,5, gastos personales pagados por el otro, abonos), botón Saldar, movimientos editables. |
| **Panorama** | Proyección de flujo de caja a 12 meses con mes de cruce a positivo, deuda en cuotas (expiran solas), inversiones editables e historial con tendencias. |

## Cómo funciona la categorización

1. El texto se normaliza y se busca en `aliases` → si hay match, categoriza al instante sin llamar a la API.
2. Si no hay alias, se llama a claude-haiku con las categorías activas → devuelve categoría, monto, pagador y reparto sugeridos.
3. Tarjeta de confirmación de un toque (los 4 campos editables). Al guardar se crea/actualiza el alias; si corriges la categoría, el alias aprende la corrección.
4. Sin conexión o sin API: selector manual.

## Estructura

```
supabase/migrations/   esquema SQL + RLS
scripts/seed.ts        datos semilla
scripts/import_depto.ts  importador del Excel (dry-run por defecto)
src/app/               pantallas (Hoy, Nosotros, Panorama, login, API)
src/components/        UI (QuickEntry, BudgetBar, TabBar, panorama/*)
src/lib/               lógica (reparto, proyección, formato CLP, Supabase)
```
