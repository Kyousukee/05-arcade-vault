# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Important: check the vendored docs first

`node_modules/next/dist/docs/` is this Next.js version's own doc set (16.2.10 — App Router,
React 19). APIs/conventions can differ from training data. Before writing routing, data-fetching,
config, or file-convention code, check the relevant page under `01-app/` (`02-guides`,
`03-api-reference/03-file-conventions`, `03-api-reference/04-functions`, `03-api-reference/05-config`)
rather than assuming prior knowledge of Next.js.

## Project

Arcade Vault — plataforma para jugar online y competir por puntaje (see README.md).
App Router + TypeScript + Tailwind v4 + Supabase. Pantallas: `/` (Home), `/biblioteca`,
`/game/[id]` y `/game/[id]/play`, `/hall-of-fame`, `/login`, `/about`.
Route handlers: `app/api/contact` (Resend) y `app/api/scores` (alta de puntajes).

**Los datos viven en Supabase, no en el repo.** `lib/data.ts` solo tiene tipos y helpers de UI;
la lectura está en `lib/queries.ts` (server-only). La app no arranca sin las variables de
entorno de Supabase: Home, `/biblioteca`, `/game/[id]`, `/play` y `/hall-of-fame` leen de la
base en cada render y no hay fallback local. Copiar `.env.template` → `.env.local`.

Uses Spec Driven Design via the `/spec` and `/spec-impl` skills from
https://github.com/Klerith/fernando-skills (installed with
`npx skills@latest add Klerith/fernando-skills`). Check for `/spec` and `/spec-impl` slash
commands / spec docs before implementing features — specs should drive implementation.
Los specs entregados viven en `specs/NN-*.md`; `specs/.spec-config.yml` controla si
`/spec-impl` crea la rama `spec-NN-slug` automáticamente (hoy `AutoCreateBranch: true`).

## Skills

- `/frontend-design` — **siempre** para diseñar interfaz de usuario.
- `/spec` → escribe el spec; `/spec-impl` → lo implementa en su propia rama.
- `/add-game` (`.claude/skills/add-game/`) — spec de un juego jugable nuevo: portado a TS sobre
  el contrato `GameFactory`, alta en el registry, fila en la tabla `games` y verificación del
  leaderboard. Solo escribe el spec, no código. `platform-contract.md` (mismo directorio) es el
  mapa de rutas y contratos de la plataforma que el skill consulta.

Los skills están duplicados en `.claude/skills/` y `.agents/skills/` (portabilidad entre
agentes); si editas uno, edita el otro. `skills-lock.json` registra lo instalado.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npm run format  # prettier --write .
```

No test runner is configured yet.

## Automatización de la sesión

- **Hook PostToolUse** (`.claude/settings.json`): tras cada Write/Edit/MultiEdit, corre
  `.claude/hooks/format-file.mjs` — Prettier + `eslint --fix` + `strip-blank-lines.mjs`, que
  elimina las líneas en blanco del archivo (respetando template literals, strings multilínea y
  texto JSX). Por eso el código del repo no tiene líneas en blanco: no las re-añadas a mano.
- **MCP Supabase** (`.mcp.json`): servidor HTTP apuntando al proyecto real (docs, database,
  debugging, functions, branching). Úsalo para migraciones, consultas y `get_advisors` antes de
  tocar el esquema. Los tipos generados van a `lib/supabase/database.types.ts`.
- Prettier: `printWidth: 100`, comillas dobles, `trailingComma: all` (`.prettierrc.json`).

## Architecture

- App Router under `app/`: `app/layout.tsx` (root layout, Geist fonts) + páginas por ruta.
  Path alias `@/*` maps to repo root (tsconfig.json).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config` — v4 uses
  CSS-based config in `app/globals.css`).
- `next.config.ts` is currently empty — no custom config yet.
- Fuentes Geist cargadas con `next/font/google` en `app/layout.tsx`, expuestas como CSS vars
  (`--font-geist-sans`, `--font-geist-mono`); el root layout define el shell `h-full` /
  `min-h-full flex flex-col`.
- Supabase: `lib/supabase/client.ts` (browser, `createBrowserClient`) y `server.ts` (server
  components y route handlers, `createServerClient` con cookies). Tablas `games` y `scores` con
  RLS. `lib/queries.ts` deriva `best = max(score)` y `plays = count(scores)` de los puntajes
  embebidos.

### Juegos

Los juegos son TypeScript sobre canvas, portados de `references/Started Games/`:

- `lib/games/types.ts` — contrato: `GameFactory(opts) => GameInstance` con
  `pause/resume/end/restart/destroy`, y `GameState` publicado al HUD a ~10 Hz (no por frame).
  Stats opcionales (`lives`, `lines`, `fruits`) se omiten cuando el juego no los usa.
- `lib/games/registry.ts` — mapa `id → import() dinámico`. El `id` es el mismo de la tabla
  `games` en Supabase. `hasRealGame(id)` decide si `GamePlayer` monta el juego real o el
  simulador de demo.
- Juegos actuales: `asteroides` (asteroids), `caida` (tetris), `bloque-buster` (arkanoid),
  `serpentina` (snake). Assets en `public/games/<slug>/`. Puedes verlos aqui C:\Users\Kyousukee\Desktop\ClaudeCode\05-arcade-vault\references\implemented-games.md
  when you need to check wich games are implemented and how to implement new ones.  
- `components/GamePlayer.tsx` (client) monta el canvas, dibuja el HUD y al terminar postea a
  `POST /api/scores` (`gameId`, `playerName` 3–10 chars en mayúsculas, `score` entero ≥ 0).

**Para añadir un juego:** usa `/add-game` → spec → `/spec-impl`. Un juego nuevo necesita las
cuatro piezas: módulo en `lib/games/<juego>/`, entrada en el registry, fila en `games` y su
aparición en el leaderboard.

## References

`references/templates/` contiene los mockups originales (HTML/JSX/CSS) de cada pantalla —
consúltalos como referencia de diseño, no son código de producción.
`references/Started Games/` contiene los juegos originales en JS vanilla que se portan a
`lib/games/` — fuente de verdad de la mecánica, no código de producción.
