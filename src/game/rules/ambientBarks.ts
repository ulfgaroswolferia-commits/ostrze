import type { ActorEntity } from '@ulf/rpg/gameLoop';

export interface AmbientBarkResult {
  npcId: string;
  text: string;
}

export interface AmbientBarkParams {
  sceneId: string | null | undefined;
  playerX: number;
  playerY: number;
  npcs: readonly ActorEntity[];
  combatActive: boolean;
  modalOpen: boolean;
  timeOfDayId?: string | null;
  phenomenonId?: string | null;
  maxDistance?: number;
  durationSeconds?: number;
  lastNpcId?: string | null;
  lastLine?: string | null;
  randomFn?: () => number;
}

const HUB_SCENES = new Set(['brzezina_dziedziniec', 'wilczy_brod', 'gluszec']);

const NPC_BARKS: Readonly<Record<string, readonly string[]>> = {
  // === PROLOGUE — BRZEZINA ===
  npc_radogost: [
    'Łokieć wyżej, adepcie — garda ratuje łeb!',
    'Cięcie idzie z biodra, nie z samego nadgarstka.',
    'Kto nie pilnuje oddechu, ten nie dożyje drugiej rundy.'
  ],
  npc_dobrogost: [
    'Olej na klingę i suche onuce — reszta to fanaberie.',
    'Zapasowe bandaże zawsze przy pasie, pamiętaj.',
    'Dobra stal nie wybacza rdzy.'
  ],
  npc_skarimir: [
    'Znowu ciągnie chłodem od traktu...',
    'Mistrz Gnieworad ma dziś wyjątkowo ponurą minę.',
    'Obyśmy nie musieli wyciągać żelaza przed zmierzchem.'
  ],
  npc_wojmir: [
    'Słyszałeś? Na przełęczy widziano cesarski patrol.',
    'Może po treningu uda się wyskoczyć na ciepłą polewkę.'
  ],
  npc_ragnoslawa: [
    'Cisza przed burzą nigdy nie wróży dobrze.',
    'Pilnuj pleców na trakcie — las ma teraz oczy.'
  ],

  // === ACT I — STRAŻNICA WILCZY BRÓD ===
  npc_kowal_zbych: [
    'Żelazo stygnie — kto ma wyszczerbione ostrze, niech podchodzi!',
    'Porządna klinga to pół wygranej na trakcie.',
    'Stuk, puk... i zaraz będzie jak nowa.'
  ],
  npc_szkarad: [
    'Proch musi być suchy, inaczej kula zostanie w lufie.',
    'Olej, lonty, garnek huku — wszystko na ciężkie czasy.'
  ],
  npc_wrzosek: [
    'Ciepła polewka i gęste piwo — prosto z kadzi!',
    'Plotki z całego pogórza, taniej niż za miedziaka.',
    'Zajrzyj do izby, zanim znów lunie.'
  ],
  npc_kramarz_brod: [
    'Świeże zioła, bandaże, suchary na drogę!',
    'Nie ruszaj na szlak z pustym pasem, wędrowcze.'
  ],
  npc_wartownik: [
    'Spokój przy bramie... przynajmniej na razie.',
    'Po zmroku lepiej nie zapuszczać się pod Stary Młyn.',
    'Oczy szeroko — zbóje z przełęczy nie śpią.'
  ],
  npc_ostromir: [
    'Wóz cały, ale bez eskorty przez przełęcz nie ruszę.',
    'Kupiecki chleb ciężki, gdy na traktach wilki i rabusie.'
  ],
  npc_zona_borka: [
    'Żeby tylko Borek wrócił przed nocą...',
    'Woda w studni dziś lodowata.'
  ],
  npc_wszebor: [
    'Każdy miecz w tej strażnicy jest na wagę złota.',
    'Zaglądaj na tablicę zleceń — roboty nie brakuje.'
  ],

  // === ACT II — OSADA GŁUSZEC ===
  npc_kowal_bogdan: [
    'Przynieś gwiezdne żelazo, a wykuję ci ostrze, co upiora przetnie.',
    'Dobra stal śpiewa pod młotem.',
    'Hartuję, ostrzę, wzmacniam pancerz — podejdź!'
  ],
  npc_karczmarz_kogut: [
    '„Pod Zdechłym Kogutem” zawsze ciepło, choć za oknem głusz!',
    'Kufel piwa na rozgrzewkę, wędrowcze?',
    'W Głuszcu każdy ma tajemnicę — najłatwiej ją usłyszeć przy szynkwasie.'
  ],
  npc_kramarz_gluszec: [
    'Towar zza przełęczy! Ostatnie zapasy przed jesienią!',
    'Odtrutki na bagienny jad — nie pożałujesz!'
  ],
  npc_zielarka_znachorka: [
    'Szara trzcina z bagien leczy gorączkę, ale topi nieostrożnych.',
    'Suszę bylicę i krwawnik... przydadzą się na rany.'
  ],
  npc_wartownik_gajowy: [
    'Kłusownicy rozpanoszyli się w borze jak u siebie.',
    'Na Wzgórzu Wartowniczym coś się szykuje — czuję to w kościach.'
  ],
  npc_kopacz_jerzy: [
    'Cmentarz w Głuszcu większy niż sama osada...',
    'Ziemia tu pamięta więcej, niż ludzie chcą przyznać.'
  ],
  npc_mlynarz_radosz: [
    'Długi trzeba spłacać, zanim spadnie pierwszy śnieg.',
    'Wiatr dziś kręci, jakby burza szła znad kopalni.'
  ],
  npc_zona_wdowa_jaga: [
    'Od kiedy spalili osadę za lasem, nikt tu nie śpi spokojnie.',
    'Uważaj na siebie na bagnach, młody.'
  ],
  npc_najemnik_kogut: [
    'Srebro płaci, stal odpowiada. Prosty układ.',
    'Cesarska obława nie żartuje — lepiej miej plan.'
  ],
  npc_soltys_gluszec: [
    'Spokój w osadzie najważniejszy — nie rób mi tu zamieszania.',
    'Kto pomaga Głuszcowi, ten zawsze znajdzie tu dach nad głową.'
  ]
};

const WEATHER_BARKS: Readonly<Record<string, readonly string[]>> = {
  night: [
    'Ciemno choć oko wykol — trzymaj się pochodni.',
    'Nocą na szlaku budzą się gorsze rzeczy niż wilki.'
  ],
  ulewa: [
    'Leje jak z cebra, błoto po same kostki!',
    'Przemoknąć do suchej nitki — oto cała nasza pogoda.'
  ],
  mgla_ciszy: [
    'Ta mgła tłumi nawet krzyk... nieswojo tu.',
    'W takiej mgle własnej dłoni nie widać.'
  ],
  burza_iskier: [
    'Iskry w powietrzu! Lepiej nie stawiać żelaza na sztorc.'
  ]
};

export function tryTriggerAmbientBark(params: AmbientBarkParams): AmbientBarkResult | null {
  const {
    sceneId,
    playerX,
    playerY,
    npcs,
    combatActive,
    modalOpen,
    timeOfDayId,
    phenomenonId,
    maxDistance = 11,
    durationSeconds = 4.2,
    lastNpcId = null,
    lastLine = null,
    randomFn = Math.random
  } = params;

  if (combatActive || modalOpen || !sceneId || !HUB_SCENES.has(sceneId)) {
    return null;
  }

  const candidates = npcs.filter((npc) => {
    if (npc.combat?.isHostile) return false;
    if (npc.combat && !npc.combat.isAlive) return false;
    // Never overwrite an active bark or a permanent quest marker bubble
    if (npc.speechBubbleText) return false;
    const pool = NPC_BARKS[npc.id];
    if (!pool || pool.length === 0) return false;
    const dist = Math.hypot(npc.tileX - playerX, npc.tileY - playerY);
    return dist <= maxDistance;
  });

  if (candidates.length === 0) return null;

  const preferred =
    candidates.length > 1 && lastNpcId
      ? candidates.filter((n) => n.id !== lastNpcId)
      : candidates;
  const pickPool = preferred.length > 0 ? preferred : candidates;
  const npc = pickPool[Math.floor(randomFn() * pickPool.length) % pickPool.length];

  const lines = [...(NPC_BARKS[npc.id] ?? [])];
  if (phenomenonId && WEATHER_BARKS[phenomenonId]) {
    lines.push(...WEATHER_BARKS[phenomenonId]);
  } else if (timeOfDayId === 'noc' && WEATHER_BARKS.night) {
    lines.push(...WEATHER_BARKS.night);
  }

  const filteredLines =
    lines.length > 1 && lastLine ? lines.filter((line) => line !== lastLine) : lines;
  const text = filteredLines[Math.floor(randomFn() * filteredLines.length) % filteredLines.length];
  if (!text) return null;

  npc.speechBubbleText = text;
  npc.speechBubbleTimer = durationSeconds;
  return { npcId: npc.id, text };
}
