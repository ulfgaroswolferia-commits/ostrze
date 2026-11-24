# Przypomnienie projektowe (tymczasowe)

## Faza 2 malarskich propów (10 brakujących grafik)
- **Status:** DO ZROBIENIA — oczekuje na reset limitu generatora obrazów (`HTTP 429 RESOURCE_EXHAUSTED`, reset ok. 2h24m od 2026-11-24 11:43).
- **Co już jest gotowe w silniku:** Obsługa `isOpen?: boolean` w `CustomPropSpriteSpec` / `resolveCustomPropSprite` / `getPropTexturePair` w `engine/src/renderer/isoSceneView.ts` oraz 512-px supersampled `keyOutWhiteBackgroundRgba` i `allowMirrorX`.
- **Zasada dla agenta:** Dopóki poniższe 10 plików nie zostanie wygenerowanych i podpiętych w `src/game/assets/painterlyProps.ts`, przypominaj krótko użytkownikowi o oczekującej Fazie 2.
- **Lista 10 sprite'ów (1024×1024, czyste białe tło `#FFFFFF`, styl spójny z istniejącymi propami w `src/game/assets/props/`):**
  1. `ognisko.jpg` (`kind: 'campfire'`) — kamienny krąg z nadpalonymi polanami i żarem (bez wysokich płomieni, silnik nakłada żywy ogień).
  2. `skrzynia_zamknieta.jpg` (`kind: 'chest'`, `isOpen: false`) — dębowa skrzynia z kutymi okuciami, zamknięta.
  3. `skrzynia_otwarta.jpg` (`kind: 'chest'`, `isOpen: true`) — ta sama skrzynia z otwartym wiekiem.
  4. `manekin_treningowy.jpg` (`kind: 'training_dummy'`) — drewniany manekin treningowy z jutą/słomą i przywiązaną okrągłą tarczą.
  5. `sztandar_szkoly.jpg` (`kind: 'school_banner'`) — karmazynowy sztandar ze złotymi skrzyżowanymi mieczami (jak na `brzezina_dwor.jpg`) na kamiennym postumencie.
  6. `pien_drzewa.jpg` (`kind: 'tree_stump'`, `allowMirrorX: true`) — stary omszały pniak po ściętym drzewie.
  7. `zwalony_pien.jpg` (`kind: 'fallen_log'`, `allowMirrorX: true`) — zwalony, omszały pień drzewa z drobnymi grzybami.
  8. `krzak_jagod.jpg` (`kind: 'berry_bush'`, `allowMirrorX: true`) — ciemnozielony leśny krzew z drobnymi ciemnymi jagodami (stonowana słowiańska paleta).
  9. `krysztal_runiczny.jpg` (`kind: 'arcane_crystal'`, `allowMirrorX: true`) — klaster chłodnobłękitnych/cyjanowych kryształów runicznych wyrastających z ciemnej skały (spójny z runami na `oltarz_runiczny.jpg`).
  10. `plot_cmentarny.jpg` (`kind: 'graveyard_fence'`) — kuty, zardzewiały płot cmentarny na omszałym kamiennym murku (układ izometryczny).
- **Po wdrożeniu:** Sprawdzić wszystkie 10 sprite'ów w 2× powiększeniu na ciemnym tle, dopisać asercje w `tests/verticalSliceFalloutDrakensang.test.ts`, puścić `vitest` + `tsc --noEmit` i **usunąć ten plik `AGENTS.md`**.
