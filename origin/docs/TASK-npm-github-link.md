# Zadanie: powiązanie repozytorium GitHub z pakietem npm `ostrze`

## Kontekst
- Repozytorium: https://github.com/Twisterson/ostrze-gwiazd-cliRpgGame
- Pakiet npm: https://www.npmjs.com/package/ostrze
- Cel: strona pakietu na npmjs.com ma linkować do repo, a repo na GitHubie ma linkować do npm.
- NIE publikujemy do GitHub Packages (npm.pkg.github.com) – tylko npmjs.com.

## Krok 1 – uzupełnij `package.json`

Dodaj (lub popraw, jeśli istnieją) poniższe pola. Nie zmieniaj pól `name`, `bin`, `main`, `dependencies` ani innych istniejących ustawień.

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/Twisterson/ostrze-gwiazd-cliRpgGame.git"
},
"homepage": "https://github.com/Twisterson/ostrze-gwiazd-cliRpgGame#readme",
"bugs": {
  "url": "https://github.com/Twisterson/ostrze-gwiazd-cliRpgGame/issues"
}
```

Dodatkowo:
- Jeśli brakuje pola `keywords`, dodaj sensowne, np. `["rpg", "cli", "terminal", "game", "fallout"]`.
- Sprawdź, czy `"license"` jest ustawione i zgadza się z plikiem LICENSE w repo (jeśli pliku nie ma – zapytaj mnie, nie wymyślaj licencji).
- Uruchom `npm pkg fix` i potwierdź, że nie zgłasza błędów.

## Krok 2 – link z GitHuba do npm

### 2a. Badge w README.md
Na samej górze `README.md`, pod tytułem, dodaj:

```markdown
[![npm version](https://img.shields.io/npm/v/ostrze)](https://www.npmjs.com/package/ostrze)
[![npm downloads](https://img.shields.io/npm/dm/ostrze)](https://www.npmjs.com/package/ostrze)
```

Jeśli w README nie ma sekcji instalacji, dodaj ją:

```markdown
## Instalacja

npm install -g ostrze
```

(użyj nazwy komendy z pola `bin` w `package.json` w przykładzie uruchomienia)

### 2b. Pole „Website” w sekcji About repozytorium
Jeśli dostępne jest `gh` CLI i jest zalogowane, wykonaj:

```bash
gh repo edit Twisterson/ostrze-gwiazd-cliRpgGame --homepage "https://www.npmjs.com/package/ostrze"
```

Jeśli `gh` nie jest dostępne – pomiń i napisz mi, że muszę to ustawić ręcznie (⚙️ przy „About” → Website).

## Krok 3 – commit i nowa wersja (NIE publikuj bez mojej zgody)

1. Zacommituj zmiany: `chore: link package.json with GitHub repo, add npm badges`
2. Podbij wersję: `npm version patch` (tworzy commit + tag).
3. **Zatrzymaj się** i pokaż mi podsumowanie zmian. `npm publish` oraz `git push --follow-tags` wykonam sam albo po mojej wyraźnej zgodzie.

## Weryfikacja po publikacji
- `npm view ostrze repository.url` → powinno zwrócić adres repo.
- Na https://www.npmjs.com/package/ostrze po prawej widoczne linki „Repository” i „Homepage”.
