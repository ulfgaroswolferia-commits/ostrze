# Drakensang × Fallout Vertical Slice Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD verification and clean commits across `ulfRPG` (engine) and `ostrze` (game).

**Goal:** Deliver the Brzezina + Trakt Vertical Slice with painterly 2.5D PNG architecture, Fallout-style `[A]` / RMB exploration combat initiation with Surprise Attack bonus, and snappy Drakensang-grade combat pacing & VFX.

**Architecture:** Add reusable custom prop PNG loading (with Sobel PBR normal generation), exploration attack initiation, and combat pacing controls in `C:\laragon\www\ulfRPG`, bump the `engine/` submodule in `C:\laragon\www\ostrze`, generate 6 painterly PNG props, wire `[A]` attack mode UI + Surprise Attack bonus, enrich Brzezina/Trakt framing, and verify with Vitest + Playwright screenshots.

**Tech Stack:** TypeScript, PixiJS v8, Vite, Vitest, Playwright, AI-generated painterly isometric PNGs.

**Spec:** `docs/superpowers/specs/2026-11-22-drakensang-fallout-vertical-slice-design.md`

## Global Constraints
- Never edit `ostrze/engine/` directly; commit & push engine changes in `C:\laragon\www\ulfRPG`, then `git submodule update --remote engine`.
- Zero regressions across all 166 `ulfRPG` tests and 115+ `ostrze` tests.
- Maintain unobstructed exits/paths and zero horizontal overflow on 375px mobile.

---

### Task 1: Generate 6 Painterly 2.5D Isometric PNG Assets (`ostrze/public/assets/props/`)
- Generate cohesive dark Slavic fantasy isometric sprites (clean isolated background, bottom-centered 2.5D angle matching `ulfRPG`) via `image-generator` and post-process alpha transparency cleanly:
  - `brzezina_dwor.png`, `brzezina_kuznia.png`, `brzezina_brama.png`, `trakt_kapliczka.png`, `trakt_woz.png`, `drzewo_brzoza.png`.

### Task 2: Engine Hooks in `C:\laragon\www\ulfRPG`
**Files:**
- Modify: `C:\laragon\www\ulfRPG\src\renderer\isoSceneView.ts`
- Modify: `C:\laragon\www\ulfRPG\src\rpg\gameLoop.ts`
- Create: `C:\laragon\www\ulfRPG\tests\rpg\explorationCombatAndProps.test.ts`

**Deliverables:**
- `registerCustomPropSprite(...)` + `resolveCustomPropSprite(...)` + async PNG loader with Sobel normal map generation & procedural fallback.
- `CrpgGameState.commandAttackEnemyFromExploration(enemyId)` + `pendingSurpriseAttack` flag + `enemyCombatMoveSpeed` (`4.6`) + `enemyCombatPauseScale` (`0.55`).
- `IsoSceneView.explorationAttackMode`, right-click hostile initiation, and `hitStopTimer` (`45ms`).
- Run `npm run build` and `npx vitest run` in `C:\laragon\www\ulfRPG`, commit & push.

### Task 3: Submodule Bump + Surprise Attack + Painterly Prop Wiring in `ostrze`
**Files:**
- Update submodule: `engine/`
- Create: `src/game/assets/painterlyProps.ts`
- Modify: `src/engine-bridge/OstrzeEngineState.ts`
- Modify: `src/main.ts`
- Modify: `src/game/styles/ostrze.css`
- Modify: `src/game/maps/prologueMaps.ts` (tighter framing & richer torch/banner dressing for Brzezina + Trakt)
- Create: `tests/verticalSliceFalloutDrakensang.test.ts`

**Deliverables:**
- Register all 6 painterly PNG props for Brzezina + Trakt.
- Surprise Opening Strike (`+20%` damage, `+15%` crit chance, `⚡ ATAK Z ZASKOCZENIA!` floating text).
- `[A]` shortcut + `⚔️ Atakuj [A]` HUD toggle button + crosshair cursor.
- Tighter `0.88` default camera zoom for richer Drakensang-style framing.

### Task 4: Full Verification & Visual Screenshots
- Run `npm run build`, `npx vitest run`, and Playwright screenshots of `brzezina_dziedziniec` and `trakt_zasadzka` to visually inspect the painterly assets and zero errors.
- Commit & push to `origin/main`.
