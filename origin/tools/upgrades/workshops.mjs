// The smiths' offer and voices: which stages of which kinds each workshop does, and the lines of its dialogue.
// `en` holds the English of the same lines (the generator writes it to data/lang/en/dialogues/); the speaker
// follows the glossary: profession after the name, capitalised in the speaker field.
// `zrobione` is said over a weapon (taken in hand), `zrobionePancerz` over armour (put on).

/** `stages[kind]` = highest stage the workshop does (a kind that is missing is not done there). */
export const WORKSHOPS = {
  zbych: {
    stages: { biala: 1, pancerz: 1 },
    speaker: "Kowal Zbych",
    portrait: "portret_kowal",
    warsztat: "Zbych wyciera ręce o fartuch. „Pokaż, co masz. Cudów z tego nie zrobię, ale uchwyt wymienić albo podszyć kaftan, to i ślepy potrafi. Płacisz z góry.”",
    zrobione: "Zbych podaje ci robotę, jeszcze ciepłą. „Masz. Tylko weź to do ręki, zanim ktoś ci da w łeb.”",
    zrobionePancerz: "Zbych podaje ci robotę, jeszcze ciepłą. „Masz. Tylko załóż, zanim ktoś ci da w łeb.”",
    bezGroszy: "Zbych nawet nie podnosi młota. „Za tyle to ci najwyżej pokażę, gdzie stoi kowadło. Przyjdź z całą sumą.”",
    wyjscie: "Innym razem.",
    en: {
      speaker: "Zbych the Smith",
      warsztat: "Zbych wipes his hands on his apron. \"Let's see what you've got. I don't work wonders, but a new grip or a fresh lining for a jacket, any blind man could manage that. Coin up front.\"",
      zrobione: "Zbych hands it over, still warm. \"There. Get it in your hand before somebody knocks your head in.\"",
      zrobionePancerz: "Zbych hands it over, still warm. \"There. Just get it on before somebody knocks your head in.\"",
      bezGroszy: "Zbych doesn't even reach for his hammer. \"For that much I'll show you where the anvil stands, and no more. Come with the full sum in hard coin.\"",
      wyjscie: "Another time.",
    },
  },
  bogdan: {
    stages: { biala: 1, pancerz: 1 },
    speaker: "Kowal Bogdan",
    portrait: "portret_bogdan",
    warsztat: "Bogdan odkłada młot na kowadło i zerka na drzwi. „Mieczy nie kuję, ale cudze poprawić, to co innego. Cesarz o tym nie wie, i niech tak zostanie. Co dajesz?”",
    zrobione: "Bogdan dmucha na robotę i oddaje ci ją. „Gotowe. Trzymaj to w garści, bo w torbie ci się nie przyda.”",
    zrobionePancerz: "Bogdan dmucha na robotę i oddaje ci ją. „Gotowe. Załóż to na siebie, bo w torbie ci się nie przyda.”",
    bezGroszy: "Bogdan patrzy na twoją sakiewkę, potem na ciebie. „Na kredyt to ja tylko żonie wierzę. Zbierz resztę i wróć.”",
    wyjscie: "Innym razem.",
    en: {
      speaker: "Bogdan the Smith",
      warsztat: "Bogdan lays his hammer on the anvil and glances at the door. \"I don't forge swords. Mending other men's, that's another matter. The Emperor doesn't know, and let's keep it that way. What have you brought?\"",
      zrobione: "Bogdan blows on it and hands it back. \"Done. Keep it in your fist. It's no use to you at the bottom of a bag.\"",
      zrobionePancerz: "Bogdan blows on it and hands it back. \"Done. Get it on your back. It's no use to you at the bottom of a bag.\"",
      bezGroszy: "Bogdan eyes your purse, then you. \"The only one I give credit to is my wife. Scrape up the rest and come back.\"",
      wyjscie: "Another time.",
    },
  },
  polowa: {
    stages: { biala: 2, pancerz: 2, kusza: 2, palna: 1 },
    speaker: "Kowal polowy",
    warsztat: "Przy palenisku z dwóch kamieni i dziurawym miechu stoi chłop w kolczym kapturze i skórzanym fartuchu. „Kapitan nie płaci za prywatne graty, więc płacisz ty. Dorobię, co trzeba, tylko szybko, bo mam jeszcze pół obozu do łatania.”",
    zrobione: "Kowal polowy rzuca ci robotę i już sięga po następną. „Masz. Bierz do ręki, bo w torbie ci życia nie uratuje.”",
    zrobionePancerz: "Kowal polowy rzuca ci robotę i już sięga po następną. „Masz. Załóż, bo w torbie ci życia nie uratuje.”",
    bezGroszy: "„Z kapitanem się kłóć o żołd. Ja biorę tyle, ile powiedziałem, i ani grosza mniej.”",
    zrobioneBelty: "Kowal polowy wciska ci w garść pęk bełtów. „Dziesięć. Policz sam, ja nie mam kiedy.”",
    zaCiezko: "Kowal polowy patrzy na twój tobół i kręci głową. „Toż ty już dźwigasz jak muł. Zrzuć coś z grzbietu, to pogadamy.”",
    wyjscie: "Innym razem.",
    en: {
      speaker: "Field Smith",
      warsztat: "A fellow in a mail coif and a leather apron stands at a fire laid between two stones, by a bellows with a hole in it. \"The captain doesn't pay for your private gear, so you do. I'll do what's needed, only let's be quick. I've half the camp still to patch.\"",
      zrobione: "The field smith tosses it over and is already reaching for the next job. \"There. Take it in hand. It won't save your neck from the bottom of a bag.\"",
      zrobionePancerz: "The field smith tosses it over and is already reaching for the next job. \"There. Get it on. It won't save your neck from the bottom of a bag.\"",
      bezGroszy: "\"Haggle over your pay with the captain. My price is my price, and not a groat less.\"",
      zrobioneBelty: "The field smith shoves a sheaf of bolts into your fist. \"Ten. Count them yourself, I've no time for it.\"",
      zaCiezko: "The field smith looks at your load and shakes his head. \"You're hauling like a mule already. Shift some of that off your back, then we'll talk.\"",
      wyjscie: "Another time.",
    },
  },
  brygida: {
    stages: { biala: 2, pancerz: 2, kusza: 2 },
    speaker: "Mechanik Brygida",
    portrait: "portret_brygida",
    warsztat: "Brygida wyłazi spod blachy z kluczem w garści. „Niech zgadnę, coś ci się nie podoba w tym, jak to działa. Pokaż. Ale robota kosztuje, bo smar i czas nie biorą się z powietrza.”",
    zrobione: "Brygida wciska ci robotę w ręce. „Gotowe. Bierz i nie wracaj, dopóki się nie zepsuje. A jak się zepsuje, to nie moja wina.”",
    zrobionePancerz: "Brygida wciska ci robotę w ręce. „Gotowe. Załóż i nie wracaj, dopóki się nie zepsuje. A jak się zepsuje, to nie moja wina.”",
    bezGroszy: "„Z pustymi kieszeniami to mi tu najwyżej latarnię potrzymasz. Przynieś resztę.”",
    zrobioneBelty: "Brygida odlicza bełty na blacie i zgarnia je do ciebie kluczem. „Dziesięć. Jak któryś pęknie, to wina twojej kuszy, nie moja.”",
    zaCiezko: "Brygida podnosi twoją torbę i od razu ją odstawia. „Tu już nawet śrubki nie wcisnę. Wyrzuć jakiś złom i wróć.”",
    wyjscie: "Innym razem.",
    en: {
      speaker: "Brygida the Handywoman",
      warsztat: "Brygida crawls out from under a sheet of metal, spanner in hand. \"Let me guess. Something about the way it works doesn't suit you. Show me. But it'll cost you. Grease and time don't come from nowhere.\"",
      zrobione: "Brygida shoves it into your hands. \"Done. Take it and don't come back till it breaks. And when it breaks, it's not my fault.\"",
      zrobionePancerz: "Brygida shoves it into your hands. \"Done. Put it on and don't come back till it breaks. And when it breaks, it's not my fault.\"",
      bezGroszy: "\"Empty pockets get you one job here: holding the lantern. Bring the rest.\"",
      zrobioneBelty: "Brygida counts the bolts out on the bench and sweeps them over to you with her spanner. \"Ten. If one cracks, blame your crossbow, not me.\"",
      zaCiezko: "Brygida hefts your bag and sets it straight back down. \"I couldn't fit another screw in there. Throw out some scrap and come back.\"",
      wyjscie: "Another time.",
    },
  },
  szkarad: {
    stages: { palna: 2 },
    speaker: "Rusznikarz Szkarad",
    portrait: "portret_szkarad",
    warsztat: "Szkarad przeżuwa słomkę i obraca w rękach czyjąś rusznicę. „Muszka, spust. Naprawię, co trzeba, ale nie za darmo, pachołku.”",
    zrobione: "Szkarad rzuca ci broń przez kontuar. „Teraz to się nawet nie wstydzi. Bierz, zanim ktoś strzeli ci w plecy, a ty nie będziesz miał czym oddać.”",
    bezGroszy: "„Jak nie masz grosza, to się nie rozglądaj. Mówiłem ci to na wejściu.”",
    wyjscie: "Innym razem.",
    en: {
      speaker: "Szkarad the Gunsmith",
      warsztat: "Szkarad chews a straw and turns somebody's handgun over in his hands. \"Sight, trigger. I'll fix what needs fixing, but not for free, boy.\"",
      zrobione: "Szkarad slings the gun across the counter. \"Now it's got nothing to be ashamed of. Take it, before somebody puts a ball in your back and you've nothing to answer with.\"",
      bezGroszy: "\"No coin, no gawking. I told you that at the door.\"",
      wyjscie: "Another time.",
    },
  },
};

/** The player's replies shared by every workshop. */
export const REPLIES = {
  dobra: { pl: "Dobra.", en: "Right." },
  wroce: { pl: "Wrócę z całością.", en: "I'll be back with the rest." },
  miejsce: { pl: "Dobra, zrobię miejsce.", en: "Right, I'll make room." },
};
