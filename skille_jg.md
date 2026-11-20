# Zainstalowane skille AI i komendy (Antigravity)

Zestawienie wszystkich zainstalowanych skilli (`SKILL.md`) oraz wbudowanych komend `/` (slash commands) w środowisku Antigravity (`~/.gemini/`).

**Podsumowanie:** 31 skilli `SKILL.md` + 9 wbudowanych slash commands (**razem 40**).

---

## 1. Wbudowane Slash Commands (9)

Komendy wywoływane w czacie przez `/` (wbudowane w Antigravity, nie występują jako osobne pliki `SKILL.md`):

| Komenda | Zastosowanie |
|---|---|
| `/grill-me` | Interaktywny wywiad doprecyzowujący plan i decyzje projektowe |
| `/plan` | Szczegółowe planowanie krok po kroku przed implementacją |
| `/goal` | Tryb długodystansowy nastawiony na pełne dowiezienie celu |
| `/boost` | Głębokie myślenie, wiele perspektyw i rygorystyczna weryfikacja |
| `/teamwork` | Praca zespołowa wielu autonomicznych agentów |
| `/browser` | Praca z przeglądarką, wyszukiwanie i interakcja z aplikacjami webowymi |
| `/schedule` | Harmonogramy cykliczne (cron) i jednorazowe timery |
| `/compact` | Kompresja i podsumowanie kontekstu rozmowy |
| `/learn` | Utrwalenie reguł i zachowań agenta na przyszłe zadania |

---

## 2. Własne skille użytkownika (1)

Lokalizacja: `~/.gemini/config/skills/`

- **`impeccable`** — projektowanie, audyt, polish, redesign i poprawa UX/UI interfejsów frontendowych.

---

## 3. Plugin Superpowers (15)

Lokalizacja: `~/.gemini/config/plugins/superpowers/skills/`

- **`brainstorming`** — eksploracja intencji, wymagań i projektu przed pracą kreatywną
- **`browser-testing`** — wizualna weryfikacja prac frontendowych i UI w przeglądarce
- **`dispatching-parallel-agents`** — równoległe delegowanie niezależnych zadań do agentów
- **`executing-plans`** — wykonywanie spisanego planu implementacji z punktami kontrolnymi
- **`finishing-a-development-branch`** — domykanie gałęzi deweloperskiej (testy, merge/PR/integracja)
- **`receiving-code-review`** — techniczna weryfikacja i wdrażanie uwag z code review
- **`requesting-code-review`** — uruchamianie przeglądu kodu przed scaleniem zmian
- **`subagent-driven-development`** — realizacja planów z niezależnymi zadaniami przez subagentów
- **`systematic-debugging`** — systematyczna diagnoza przyczyn błędów przed proponowaniem poprawek
- **`test-driven-development`** — cykl TDD (testy przed kodem implementacyjnym)
- **`using-git-worktrees`** — izolacja pracy nad funkcjami przy użyciu git worktrees
- **`using-superpowers`** — zasady wyszukiwania i aktywacji skilli na starcie rozmowy
- **`verification-before-completion`** — wymóg uruchomienia i potwierdzenia weryfikacji przed zgłoszeniem ukończenia
- **`writing-plans`** — tworzenie szczegółowych planów implementacji przed edycją kodu
- **`writing-skills`** — tworzenie, edycja i weryfikacja nowych skilli

---

## 4. Wbudowane skille Antigravity (15)

Lokalizacja: `~/.gemini/antigravity-cli/builtin/skills/`

### Aktywne w standardowej sesji (5)
- **`agy-customizations`** — przewodnik po systemie customizacji Antigravity (skille, reguły, pluginy, hooki, MCP)
- **`antigravity_guide`** (`antigravity-guide`) — kompletny przewodnik po Google Antigravity, CLI i IDE
- **`native_swarm`** (`swarm`) — równoległa praca roju agentów na wspólnej tablicy wiadomości
- **`run-workflow`** — pisanie i uruchamianie skryptów orkiestracji Python (`run_workflow`)
- **`swarm_monitor`** — monitorowanie postępu roju agentów i wykrywanie zastojów

### Pozostałe wbudowane na dysku (10)
- **`automation`**
- **`generative_ui`**
- **`mcp-app-development`**
- **`migrate-agent-settings`**
- **`migrate-workflows`**
- **`permissioned-github`**
- **`plugin`**
- **`swarm_narrator`**
- **`swarm_pane`**
- **`ui-plugin-navigation`**
