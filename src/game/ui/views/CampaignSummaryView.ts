import type { OriginGameData, OstrzeGameState } from '../../data/originTypes';
import { evaluateAchievements, OSTRZE_ACHIEVEMENTS } from '../../rules/achievements';
import { getDifficultyProfile, getOstrzeDifficulty } from '../../rules/difficulty';
import { getVisitedOstrzeLocations, OSTRZE_LOCATIONS } from '../../rules/travel';
import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';

export interface CampaignSummaryOptions {
  viaOblawa: boolean;
  storyText?: string;
  onStayFreeRoam: () => void;
  onExportHeroKey?: () => void;
  onNewGame?: () => void;
}

export interface CampaignSummaryData {
  title: string;
  subtitle: string;
  moralPathTitle: string;
  epilogueText: string;
  heroName: string;
  className: string;
  level: number;
  xp: number;
  money: number;
  difficultyLabel: string;
  completedQuests: number;
  visitedCount: number;
  totalLocations: number;
  unlockedAchievements: number;
  totalAchievements: number;
  wola: number;
  dlug: number;
  keepsakes: string[];
}

export function buildCampaignSummaryData(
  state: OstrzeGameState,
  data: OriginGameData,
  viaOblawa: boolean,
  storyText?: string
): CampaignSummaryData {
  const ch = state.character;
  const cls = data.classes.find((c) => c.id === ch?.classId);
  const wola = state.vars.wola ?? 0;
  const dlug = state.vars.dlug ?? 0;
  const diff = getDifficultyProfile(getOstrzeDifficulty(state));

  let moralPathTitle = 'Równowaga Wędrowca';
  let moralParagraph =
    'Nie dałeś się złamać ani pychą, ani rozpaczą. Na Szklane Wzgórza idziesz z chłodną głową i pewnym chwytem na rękojeści.';
  if (wola >= dlug + 2) {
    moralPathTitle = 'Ścieżka Woli';
    moralParagraph =
      'Twoje wybory na Pogórzu i w Głuszcu niosły ludziom otuchę mimo cesarskiego cienia. W osadach jeszcze długo będą powtarzać twoje imię z szacunkiem.';
  } else if (dlug >= wola + 2) {
    moralPathTitle = 'Ścieżka Długu';
    moralParagraph =
      'Przetrwałeś za każdą cenę, spłacając światu twardą monetą. Nikt na szlaku nie odważy się stanąć ci na drodze — ale cienie Brzeziny idą tuż za tobą.';
  }

  const routeParagraph =
    typeof storyText === 'string' && storyText.trim()
      ? storyText.trim()
      : viaOblawa
        ? 'Na Wzgórzu Wartowniczym przełamałeś cesarską obławę siłą stali. Szlak na Szklane Wzgórza stoi otworem, a echo bitwy niesie się po całej puszczy.'
        : 'Z podrobionymi papierami i wsparciem mieszkańców Głuszca prześlizgnąłeś się obok cesarskiej obławy. Przed tobą Szklane Wzgórza i Obserwatorium.';

  const completedQuests = Object.values(state.quests).filter((s) => s === 'completed').length;
  const visitedCount = getVisitedOstrzeLocations(state).length;
  const unlockedAchievements = evaluateAchievements(state, data).filter((a) => a.unlocked).length;
  const keepsakeIds = ['pamiatka_skarimira', 'pamiatka_wojmira', 'pamiatka_ragnoslawy'];
  const keepsakes = state.inventory.items
    .filter((i) => keepsakeIds.includes(i.id) && i.qty > 0)
    .map((i) => data.items.find((d) => d.id === i.id)?.name ?? i.id);

  return {
    title: viaOblawa ? 'Przerwanie Obławy — Koniec Aktu II' : 'Za Głuszcem — Koniec Aktu II',
    subtitle: 'Zapowiedź Aktu III: Obserwatorium na Szklanym Wzgórzu',
    moralPathTitle,
    epilogueText: `${routeParagraph}\n\n${moralParagraph}`,
    heroName: ch?.name ?? 'Adept',
    className: cls?.name ?? 'Szkoła Ostrzy',
    level: ch?.level ?? 1,
    xp: ch?.xp ?? 0,
    money: ch?.money ?? 0,
    difficultyLabel: diff.label,
    completedQuests,
    visitedCount,
    totalLocations: OSTRZE_LOCATIONS.length,
    unlockedAchievements,
    totalAchievements: OSTRZE_ACHIEVEMENTS.length,
    wola,
    dlug,
    keepsakes
  };
}

export function renderCampaignSummaryView(params: {
  root: HTMLElement;
  state: OstrzeGameState;
  data: OriginGameData;
  opts: CampaignSummaryOptions;
  onClose: () => void;
}): void {
  const { root, state, data, opts, onClose } = params;
  const s = buildCampaignSummaryData(state, data, opts.viaOblawa, opts.storyText);

  mountModalCard(
    root,
    'ostrze-card ostrze-summary-card',
    `
        <div class="ostrze-summary-badge">🏁 ${escapeHtml(s.moralPathTitle)} · Trudność: ${escapeHtml(s.difficultyLabel)}</div>
        <h2 class="ostrze-title" style="margin-bottom:4px;">${escapeHtml(s.title)}</h2>
        <p class="ostrze-subtitle" style="margin-bottom:14px;">${escapeHtml(s.subtitle)}</p>
        <div class="ostrze-prose" style="margin-bottom:16px;">${escapeHtml(s.epilogueText)}</div>
        <div class="ostrze-summary-grid">
          <div class="ostrze-panel">
            <h3>Bohater</h3>
            <div class="ostrze-row"><span>Imię i klasa</span><strong>${escapeHtml(s.heroName)} · ${escapeHtml(s.className)}</strong></div>
            <div class="ostrze-row"><span>Poziom / XP</span><strong>Poz. ${s.level} (${s.xp} XP)</strong></div>
            <div class="ostrze-row"><span>Sakiewka</span><strong>${s.money} gr</strong></div>
            <div class="ostrze-row"><span>Osie moralne</span><strong>Wola ${s.wola} · Dług ${s.dlug}</strong></div>
          </div>
          <div class="ostrze-panel">
            <h3>Kronika kampanii</h3>
            <div class="ostrze-row"><span>Ukończone zadania</span><strong>${s.completedQuests}</strong></div>
            <div class="ostrze-row"><span>Poznane lokacje</span><strong>${s.visitedCount} / ${s.totalLocations}</strong></div>
            <div class="ostrze-row"><span>Dokonania</span><strong>${s.unlockedAchievements} / ${s.totalAchievements}</strong></div>
            <div class="ostrze-row"><span>Pamiątki z Brzeziny</span><strong>${s.keepsakes.length > 0 ? escapeHtml(s.keepsakes.join(', ')) : 'Brak'}</strong></div>
          </div>
        </div>
        <div class="ostrze-summary-actions">
          ${opts.onExportHeroKey ? `<button type="button" class="ostrze-btn" data-summary-action="export-key">🔑 Eksportuj Klucz Bohatera (Akt III)</button>` : ''}
          <button type="button" class="ostrze-hub-btn" data-summary-action="free-roam">🗺️ Zostań w okolicach Głuszca</button>
          ${opts.onNewGame ? `<button type="button" class="ostrze-hub-btn" data-summary-action="new-game">🔄 Nowa gra</button>` : ''}
        </div>
    `
  );

  root.querySelector('[data-summary-action="free-roam"]')?.addEventListener('click', () => {
    onClose();
    opts.onStayFreeRoam();
  });
  root.querySelector('[data-summary-action="export-key"]')?.addEventListener('click', () => {
    onClose();
    opts.onExportHeroKey?.();
  });
  root.querySelector('[data-summary-action="new-game"]')?.addEventListener('click', () => {
    onClose();
    opts.onNewGame?.();
  });
}
