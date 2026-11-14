# Dialogi, Narracja i Przykłady – Ostrze Gwiazd (Zaktualizowane)

Zaktualizowany zestaw dialogów, narracji i struktur uwzględniający nową rolę bohatera: nie jest on dezerterem, lecz ocalałym z żywej daniny, którego oficjalnie uznano za martwego. Cesarskie patrole i zwiadowcy nie szukają go z imienia, ale przeczesują pogranicze, by zatrzeć ślady ataku upiorów i zlikwidować każdego potencjalnego świadka.

---

## 1. Wytyczne stylistyczne i językowe

### Ton i klimat
* **Słowiańska rubaszność + nordycka surowość:** Ludzie są twardzi, opryskliwi, ale barwni. Zamiast wyszukanych metafor używają porównań do chleba, błota, gorzałki, wieprzy, kapusty, zimnej kaszy i zepsutej mięsności.
* **Prostacki, karczemny humor:** Docinki o gębie, pyskach, głupocie i posturze rozmówcy mają rozładowywać ponury świat. Im groźniejsza sytuacja lub silniejszy wróg, tym żarty stają się krótsze i bardziej opryskliwe.
* **Archaizacja lekka i czytelna:** Używamy zwrotów takich jak *waść*, *juści*, *bywaj*, *pachołek*, *gęba*, *chaszcze*, *cap*, *wiocha*, *kram*, *pistolet*, *rusznica*, ale zachowujemy współczesną, płynną składnię, aby tekst czytało się szybko w terminalu.
* **Słowiańsko-nordyckie nazewnictwo:** Łączenie rdzeni nordyckich ze słowiańskimi końcówkami (*Thorgniew*, *Ragnosław*, *Hjalmirad*, *Skjeldowo*, *Ulfgród*).

### Atmosfera osaczenia
* Bohater ma status „ducha” – oficjalne listy gończe go nie obejmują, bo urzędnicy w stolicy uznali delegację za zjedzoną przez wilki lub ubitego przez bandytów.
* Zwiadowcy cesarscy pojawiają się na pograniczu z rozkazem bezwzględnego milczenia: przesłuchują karczmarzy, pacyfikują osady i polują na każdego, kto wykaże zbyt dużą wiedzę o „dziwnych światłach na szlaku”.
* Bohater musi ukrywać pancerz ze szkoły i insygnia delegacji, lawirując między nieufnymi mieszkańcami a cesarskimi węszycielami.

---

## 2. Przykłady zaktualizowanych scen narracyjnych i dialogowych

### Scena 1: Świt na pobojowisku (Przeszukanie ciał)

**[NARRACJA]**  
Świt wstaje wolno, lepiąc się do powiek jak zimna osocza. Śnieg wokół wozu poryty jest głębokimi, czarnymi bruzdami. Wokół leżą szczątki cesarskiej eskorty i twoich towarzyszy niedoli. Dla świata w stolicy wszyscy jesteście już tylko martwą pozycją w rejestrze danin, mięsem zjedzonym przez nocne widma.

Obok leży Skarimir. W jego piersi tkwi kawałek uszczerbionego, mosiężnego drutu, który wciąż cicho syczy i śmierdzi spalonym pierzem.

**Opcje wyboru:**
1. Przeszukaj jego kaletę i zabierz zapas prowiantu.
2. Zabierz jego parę krótkich włóczni.
3. Schowaj cesarskie dokumenty delegacji (cesarz oficjalnie nie wie, kto zginął).

---

### Scena 2: Podejrzliwy karczmarz i cesarscy zwiadowcy

**[KARCZMARZ BRATOMIŁ]**  
— Oho! Kolejny włóczęga z gościńca. Wyglądasz, jakbyś przez całą noc uciekał przed wilkami... albo przed czymś gorszym. Wczoraj byli tu cesarscy zwiadowcy. Pytały o ten rozbity orszak z prowincji. Szukają świadków, czy licho wie czego... Podobno mają rozkaz zetrzeć z mapy każdego, kto widział za dużo. Trzymaj gębę na kłódkę, pachołku, jeśli chcesz pożyć.

**Bohater:**  
— Nie znam żadnego orszaku. Szukam tylko kąta do spania i miski ciepłej kaszy.

**[KARCZMARZ BRATOMIŁ]**  
— Kasza się znajdzie, ale pancerz to ty schowaj pod derką, bo jak cię węszycie zwiadowcy w takich pasach zobaczą, to uznają za żywy dowód, że ktoś z tej rzezi uciekł. A wtedy lufa rusznicy przemówi szybciej, niż zdążysz zapłacić miedziakiem!

---

### Scena 3: Nadejście Istoty (Nocna interwencja)

**[NARRACJA]**  
Połamaną kość przedramienia ścina nagły, parzący chłód. Nie ma krwi – jest tylko niebieskawy, gęsty opad, który wnika w rozdartą skórę. Nad tobą stoi postać. Nie ma gęby, nie ma oczu, jakie znasz u ludzi. Jej twarz to nieruchoma płyta z czarnego, matowego szkła, pod którą tli się drobna, mosiężna siatka.

**[ISTOTA Z GWIAZD]**  
— Tkanka zrośnięta. Rdzeń sprawny. Dług zaciągnięty. Zniszcz to, co zbudowano na tej ziemi.

W głosie nie ma ani gniewu, ani litości. Dla świata w stolicy nie istniejesz – dla tego obcego bytu jesteś po prostu tanim narzędziem do wykonania brudnej roboty.

---

### Scena 4: Stary ruszniczarz (Szkarad) o cesarskich zakazach

**[SZKARAD]**  
— Proch chcesz kupić? Ostrożnie z tym, pachołku. Cesarskie psy gończe trzęsą teraz całym traktem. Szukają ocalałych z tej rzezi na północy, co to z ich powodu cesarz ma teraz nocne Mary. Jak u ciebie w torbie powąchają siarkę z wyspy rzemieślników, to od razu wsadzą ci kula w łeb pod pretekstem bandytyzmu.

**Opcje dialogowe:**
* **[Wymowa 35]** „Mniej gadania, Szkarad, a więcej towaru. Skoro szukają ocalałych, to tym bardziej muszę się czymś bronić.”
* „Daj zwykłe kulki i nie wnikaj, komu patrzę w oczy.”
* „Bywaj.”

---

## 5. Przykładowy plik JSON dla zaktualizowanego dialogu

Format zgodny z silnikiem gry (`data/dialogues/karczmarz_ostrzezenie.json`):

```json
{
  "id": "karczmarz_ostrzezenie",
  "start": "start_01",
  "nodes": {
    "start_01": {
      "speaker": "Karczmarz Bratomił",
      "text": "Oho, z gościńca! Wyglądasz blado, jakbyś widział upiora. Wczoraj w nocy byli tu cesarscy zwiadowcy. Pytały o ocalałych z tej zniszczonej delegacji. Podobno mają rozkaz czyścić trakt ze świadków, żeby żaden wieść nie niósł do stolicy.",
      "options": [
        {
          "id": "opt_pytanie",
          "text": "Cesarscy? Przecież oficjalnie cała delegacja zginęła od bestii.",
          "goto": "dialog_zwiadowcy"
        },
        {
          "id": "opt_ukrycie",
          "text": "Dzięki za ostrzeżenie. Schowam sprzęt i nie wychylam się.",
          "goto": "end",
          "actions": { "setFlag": "ostrzezony_przez_karczmarza" }
        }
      ]
    },
    "dialog_zwiadowcy": {
      "speaker": "Karczmarz Bratomił",
      "text": "Tja, oficjalnie to wrona krukowi oka nie wykole. Ale cesarz wie swoje – ktoś musiał przeżyć, skoro rozkazy z zatarcia śladów poszły na całe pogranicze. Lepiej zmień miano i nie świeć tym pancerzem ze szkoły!",
      "options": [
        {
          "text": "Rozumiem. Masz kąt na nocleg?",
          "goto": "end",
          "actions": { "setFlag": "wie_o_zwiadowcach" }
        }
      ]
    }
  }
}
```