# Vertical Slice Design: Drakensang × Fallout/Planescape: Torment (Brzezina + Trakt)

**Date:** 2026-11-22  
**Status:** Approved by user  
**Scope:** Vertical Slice covering Prologue locations `brzezina_dziedziniec` and `trakt_zasadzka`, backed by reusable engine hooks in `ulfRPG`.

---

## 1. Goal & Creative Direction

Elevate **Ostrze 2.5D** from a classic slow-paced turn-based CRPG into a visually rich, snappy experience inspired by:
- **Drakensang:** denser, painterly, hand-crafted vistas with rich isometric architecture, dynamic torchlight, and juicy combat VFX.
- **Fallout 1/2 & Planescape: Torment:** fluid real-time exploration where the player can manually initiate turn-based AP combat at any moment with an opening strike (including a Surprise Attack bonus from stealth), transitioning seamlessly into crisp, fast-paced turn-based combat.

## 2. Architecture (Approach A — Thin Engine Hooks + Game Vertical Slice)

### 2.1 Engine (`C:\laragon\www\ulfRPG` → submodule `ostrze/engine/`)
1. **Custom Painterly Prop Texture Registry (`isoSceneView.ts`):**
   - `registerCustomPropSprite(entry: { id?: string; kind?: string; url: string; anchorX?: number; anchorY?: number; targetWidthPx?: number })`
   - Asynchronously loads PNG assets into `propTextureCache` with auto-generated Sobel luminance normal maps (`normalMat`) so painted 2.5D structures receive full Y-depth sorting and dynamic PBR lighting (torches, campfires, day/night cycle).
   - Automatic transparent-background fallback to existing procedural PBR buffers when unavailable (including Node/Vitest environments).
2. **Fallout-Style Exploration Combat Initiation (`gameLoop.ts` + `isoSceneView.ts`):**
   - `commandAttackEnemyFromExploration(enemyId: string): boolean` on `CrpgGameState`:
     - Only targets living hostile NPCs (protects story allies in Prologue).
     - Marks `pendingSurpriseAttack = true` when `isStealthActive` or target is out of alert state (`!combatState.active`).
     - If already in weapon range: immediately starts turn-based combat and executes the opening strike.
     - If out of range: paths toward target with `pendingAttackTargetId` and executes the opening strike on arrival.
   - `isoSceneView.explorationAttackMode: boolean` toggles crosshair cursor & red target ring on hostile NPCs; right-click on a living hostile NPC during exploration also invokes `commandAttackEnemyFromExploration`.
3. **Snappy Combat Pacing & Juicy VFX (`gameLoop.ts` + `isoSceneView.ts`):**
   - Configurable `enemyCombatMoveSpeed` (default `4.6` vs legacy `3.2`) and `enemyCombatPauseScale` (default `0.55`) so enemy turns feel snappy rather than sluggish.
   - Brief `hitStopTimer` (`45 ms`) and enhanced `screenShake` on critical hits and surprise opening strikes.

### 2.2 Game (`C:\laragon\www\ostrze`)
1. **6 Painterly 2.5D PNG Assets in `public/assets/props/`:**
   - `brzezina_dwor.png` — Szkoła Ostrzy timber-and-stone manor hall with banners
   - `brzezina_kuznia.png` — Rustic Slavic smithy/workshop with awning and anvil
   - `brzezina_brama.png` — Timber palisade gatehouse with watchtower
   - `trakt_kapliczka.png` — Wayside stone-and-wood Slavic shrine
   - `trakt_woz.png` — Broken merchant wagon on the forest road
   - `drzewo_brzoza.png` — Painterly ancient silver birch / woodland oak
2. **Registration & Framing (`src/game/assets/painterlyProps.ts`, `OstrzeEngineState.ts`, `main.ts`):**
   - Registers all 6 painterly assets on engine init with proper `anchorX`/`anchorY`/`targetWidthPx` matching building footprints.
   - Surprise Opening Strike bonus in `OstrzeEngineState`: `+20%` damage, `+15%` crit chance, floating text `⚡ Z ZASKOCZENIA!`.
   - Tighter, Drakensang-like default camera zoom (`0.88`) and richer torch/banner/flora dressing in `brzezina_dziedziniec` and `trakt_zasadzka`.
3. **Fallout Target Mode UI (`main.ts`, `ostrze.css`):**
   - `[A]` keyboard shortcut and subtle HUD button `⚔️ Atakuj [A]` toggling `sceneView.explorationAttackMode` (hidden during active combat or open modals; shows `body.ostrze-attack-cursor` crosshair).

## 3. Global Constraints
- Never edit `ostrze/engine/` directly; commit & push in `C:\laragon\www\ulfRPG`, then pull submodule in `ostrze`.
- Maintain 100% pass rate on all existing `ulfRPG` (166 tests) and `ostrze` (115 tests) suites plus Playwright browser tests.
- All exits and walking paths in `brzezina_dziedziniec` and `trakt_zasadzka` must remain unobstructed; no mobile 375px horizontal overflow.
