# Przypomnienie projektowe (tymczasowe)

## Faza 2 malarskich propów (1 pozostała grafika z 10)
- **Status:** 9/10 ZROBIONE i podpięte w `src/game/assets/painterlyProps.ts`. Pozostał **1 brakujący sprite** (`skrzynia_otwarta.jpg`) — oczekuje na reset limitu generatora obrazów (`HTTP 429 RESOURCE_EXHAUSTED`, reset ok. 4h59m od 2026-11-24 21:18, tj. ~02:17 2026-11-25).
- **Co już jest gotowe w silniku i grze:**
  - Obsługa `isOpen?: boolean` w `CustomPropSpriteSpec` / `resolveCustomPropSprite` / `getPropTexturePair` w `engine/src/renderer/isoSceneView.ts` oraz 512-px supersampled `keyOutWhiteBackgroundRgba` i `allowMirrorX`.
  - Wygenerowane, zweryfikowane na ciemnym tle i podpięte: `ognisko.jpg`, `skrzynia_zamknieta.jpg`, `manekin_treningowy.jpg`, `sztandar_szkoly.jpg`, `pien_drzewa.jpg`, `zwalony_pien.jpg`, `krzak_jagod.jpg`, `krysztal_runiczny.jpg`, `plot_cmentarny.jpg`.
- **Zasada dla agenta:** Dopóki poniższy ostatni plik nie zostanie wygenerowany i podpięty w `src/game/assets/painterlyProps.ts`, przypominaj krótko użytkownikowi o dokończeniu Fazy 2.
- **Pozostały sprite (1024×1024, czyste białe tło `#FFFFFF`, na podstawie `src/game/assets/props/skrzynia_zamknieta.jpg`):**
  1. `skrzynia_otwarta.jpg` (`kind: 'chest'`, `isOpen: true`) — dokładnie ta sama skrzynia co `skrzynia_zamknieta.jpg`, ale z otwartym wiekiem (ciemne puste wnętrze).
- **Po wdrożeniu:** Sprawdzić `skrzynia_otwarta.jpg` w 2× powiększeniu na ciemnym tle, podpiąć w `src/game/assets/painterlyProps.ts`, dopisać asercję `isOpen: true` w `tests/verticalSliceFalloutDrakensang.test.ts`, puścić `vitest` + `tsc --noEmit` i **usunąć ten plik `AGENTS.md`**.
