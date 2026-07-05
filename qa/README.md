# QA de CX — Finanzas JJ

Arnés de QA de experiencia (CX) que maneja la app en un viewport de teléfono,
captura screenshots de cada pantalla con datos reales y corre chequeos de
usabilidad medibles. Los screenshots luego se revisan (por una persona o por
Claude con visión) para detectar problemas de experiencia.

## Cómo correrlo

En una terminal, levanta la app con el modo QA habilitado:

```bash
ALLOW_TEST_LOGIN=true NODE_USE_ENV_PROXY=1 npm run dev
```

En otra terminal, corre la captura:

```bash
NODE_USE_ENV_PROXY=1 npx tsx scripts/cx_capture.ts
```

Salida:
- `qa/screenshots/*.png` — una imagen por pantalla/estado.
- `qa/reporte_automatico.md` — hallazgos de los chequeos automáticos.

`NODE_USE_ENV_PROXY=1` solo hace falta en el entorno de Claude Code (para que
Node alcance Supabase por el proxy). En tu computador no es necesario.

## Qué verifica automáticamente (gratis)

- Sin scroll horizontal en móvil.
- Áreas de toque ≥ 40px (usable con una mano).
- Sin textos rotos (`undefined`, `NaN`, `${…}`).
- Todo en español.
- Sin errores de JavaScript en consola.

## Cómo funciona por dentro

El navegador de prueba trae los datos reales desde Supabase (vía Node) y los
sirve interceptando las llamadas del navegador — así el QA es determinístico y
no depende de la red en cada corrida.

Dos afordancias de prueba, **apagadas en producción** (gated por
`ALLOW_TEST_LOGIN`, que nunca se setea en Vercel):
- `src/app/api/test-login/route.ts` — inicia sesión sin magic link.
- El middleware hace pass-through cuando `ALLOW_TEST_LOGIN=true`.

## Revisión con IA (visión)

Los screenshots se le pueden pasar a Claude (visión) para que critique el CX
como diseñador. Para automatizarlo de forma recurrente se necesita
`ANTHROPIC_API_KEY`; para una revisión puntual basta con abrir las imágenes.
