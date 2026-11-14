"""Seria 2: portrety postaci (48x48). Generator ludzi z series_enemies (kadr 8-55), plus Istota z series_enemies_special.

Uruchom z tools/art:  python series_portraits.py [id ...]
"""
import sys

from series_enemies import npc, build_human, H
from toolkit import Canvas
from pilot_common import finish

WARM = (233, 234, 52, 94, 130)     # tlo przy ogniu / w karczmie
COLD = (233, 17, 18, 60, 24)       # tlo noca
GREY = (233, 234, 235, 237, 239)
GREEN = (233, 22, 22, 28, 64)

P = {
    # --- postacie z istniejących dialogów ---
    "portret_bogdan": ("Kowal Bogdan – łysy, potężna broda, fartuch", dict(skin="skin_dark", beard="full", cloth="leather", armor="pauldrons", armor_ramp="iron", mood="grim", extras=("scar2",), bg=WARM)),
    "portret_bolek": ("Furman Sieciech – słomiany kapelusz, szczerbaty uśmiech", dict(skin="skin_dark", hair="fur_brown", hat="straw", hat_ramp="wood", beard="stubble", cloth="cloth_brown", mood="kind", mouth="smirk")),
    "portret_brygida": ("Mechanik Brygida – rude długie włosy, gogle na czole", dict(skin="skin", hair="hair_red", hair_style="long", cloth="cloth_blue", mood="sly", female=True, extras=("goggles",), bg=WARM)),
    "portret_corka": ("Córka strażnika – młoda, dwa warkocze, ciekawski wzrok", dict(skin="skin", hair="hair_brown", hair_style="braid", cloth="cloth_green", mood="kind", female=True)),
    "portret_dobrawa": ("Znachorka Dobrawa – stara, siwe długie włosy, zielona chustka, łagodna", dict(skin="skin", hair="hair_silver", hair_style="long", hat="scarf", hat_ramp="cloth_green", cloth="cloth_brown", mood="kind", female=True, extras=("wrinkles",), bg=GREEN)),
    "portret_gajowy": ("Gajowy Radowit – zielony kaptur, siwa broda", dict(skin="skin_dark", hair="fur_grey", beard="full", beard_ramp="fur_grey", hat="hood", hat_ramp="cloth_green", cloth="cloth_green", mood="grim", bg=GREEN)),
    "portret_gnieworad": ("Mistrz Gnieworad – siwy, kozia bródka, złoty kołnierz", dict(skin="skin", hair="fur_grey", hair_style="long", beard="goatee", beard_ramp="fur_grey", cloth="cloth_blue", collar="gold", mood="sly", extras=("wrinkles",), bg=COLD)),
    "portret_halina": ("Siostra Halina – biały czepiec, spokój", dict(skin="skin", hat="wimple", hat_ramp="linen", cloth="cloth_grey", mood="kind", female=True, bg=COLD)),
    "portret_hieronim": ("Astronom Hieronim – dzika siwa czupryna, broda, zadumany wzrok", dict(skin="skin", hair="fur_grey", hair_style="wild", beard="full", beard_ramp="fur_grey", cloth="cloth_blue", mood="kind", extras=("wrinkles",), bg=COLD)),
    "portret_jaga": ("Wdowa Jaga – czarna chustka, siwe długie włosy, twarde spojrzenie", dict(skin="skin", hair="hair_silver", hair_style="long", hat="scarf", hat_ramp="cloth_black", cloth="cloth_black", mood="grim", female=True, extras=("wrinkles",))),
    "portret_kopacz": ("Kopacz Jerzy – czapka, kurz na twarzy, zmęczony", dict(skin="skin_dark", hat="cap", hat_ramp="cloth_grey", beard="stubble", cloth="cloth_brown", mood="grim", bg=GREY)),
    "portret_kowal": ("Kowal Zbych – łysy, wąsy, fartuch", dict(skin="skin_dark", beard="mustache", beard_ramp="fur_brown", cloth="leather", armor="pauldrons", armor_ramp="iron", mood="grim", bg=WARM)),
    "portret_kruk": ("Najemnik Kruk – hełm, blizny, drwiący uśmiech", dict(skin="skin_dark", hat="kettle", hat_ramp="iron", beard="stubble", armor="chain", cloth="cloth_grey", mood="angry", mouth="smirk", extras=("scar", "scar2"))),
    "portret_kurier": ("Cesarski kurier – czerwona czapka z piórem, złoty kołnierz", dict(skin="skin", hair="fur_brown", hat="cap", hat_ramp="cloth_red", cloth="cloth_red", collar="gold", mood="sly", extras=("feather",))),
    "portret_lesniczy": ("Leśniczy – zielona czapka, wąsy, rzeczowy", dict(skin="skin", hair="fur_brown", hat="cap", hat_ramp="cloth_green", beard="mustache", cloth="cloth_green", mood="grim", bg=GREEN)),
    "portret_mruk": ("Karczmarz Mruk – łysy, kozia bródka, bez słowa", dict(skin="skin", beard="goatee", cloth="cloth_brown", mood="grim", bg=WARM)),
    "portret_ostromir": ("Kupiec Ostromir – futrzana czapa, ruda broda, złoty kołnierz", dict(skin="skin", hair="fur_brown", hat="fur", hat_ramp="fur_brown", beard="full", cloth="cloth_blue", collar="gold", mood="sly", mouth="smirk", extras=("earring",))),
    "portret_pielgrzym": ("Pielgrzym z bukłakiem – szary kaptur, chytre oczy", dict(skin="skin_dark", hat="hood", hat_ramp="cloth_grey", beard="stubble", cloth="cloth_grey", mood="sly", mouth="smirk", extras=("straps",))),
    "portret_radosz": ("Młynarz Radosz – czapka, mąka na twarzy, dobroduszny", dict(skin="skin", hat="cap", hat_ramp="bone", cloth="cloth_grey", mood="kind", mouth="smirk", extras=("flour",))),
    "portret_ragnoslawa": ("Ragnosława – wojowniczka, jasne długie włosy, naramienniki, ostre spojrzenie", dict(skin="skin", hair="hair_blond", hair_style="long", cloth="cloth_brown", armor="pauldrons", armor_ramp="iron", mood="angry", female=True)),
    "portret_ranny": ("Ranny górnik – bandaż na czole, wzrok błędny", dict(skin="skin_dark", hat="cap", hat_ramp="cloth_grey", cloth="cloth_grey", mood="blank", extras=("bandage",))),
    "portret_skarimir": ("Skarimir – długie włosy, broda, kolczuga, blizna", dict(skin="skin", hair="fur_brown", hair_style="long", beard="full", armor="chain", cloth="cloth_grey", mood="grim", extras=("scar",), bg=COLD)),
    "portret_soltys": ("Sołtys Wawrzyn – futrzana czapa, siwa broda, złoty łańcuch", dict(skin="skin", hair="fur_grey", hat="fur", hat_ramp="fur_brown", beard="full", beard_ramp="fur_grey", cloth="cloth_green", collar="gold", mood="grim", extras=("wrinkles",))),
    "portret_stach": ("Kłusownik Stach – brązowy kaptur, szczecina, chytry", dict(skin="skin_dark", hat="hood", hat_ramp="cloth_brown", beard="stubble", cloth="cloth_brown", mood="sly", mouth="smirk", bg=GREEN)),
    "portret_stary_zolnierz": ("Stary żołnierz – hełm, siwe wąsy, blizna, zmarszczki", dict(skin="skin", hat="kettle", hat_ramp="iron", beard="mustache", beard_ramp="fur_grey", cloth="cloth_green", armor="pauldrons", armor_ramp="iron", mood="grim", extras=("scar", "wrinkles"))),
    "portret_szkarad": ("Ruszniczarz Szkarad – gogle, łysy, osmalony", dict(skin="skin_dark", cloth="leather", mood="sly", mouth="smirk", extras=("goggles", "scar2"), bg=WARM)),
    "portret_tomasz": ("Zwiadowca Tomasz – zielony kaptur, blizna, czujny", dict(skin="skin", hair="fur_brown", hat="hood", hat_ramp="cloth_green", cloth="cloth_green", mood="grim", extras=("scar2",), bg=GREEN)),
    "portret_wedrowiec": ("Głodny wędrowiec – słomkowy kapelusz, wychudzony", dict(skin="skin_dark", hat="straw", hat_ramp="wood", beard="stubble", cloth="cloth_brown", mood="blank", extras=("wrinkles",))),
    "portret_wincenty": ("Dozorca Wincenty – czapka, siwe wąsy, zmęczony", dict(skin="skin", hair="fur_grey", hat="cap", hat_ramp="cloth_grey", beard="mustache", beard_ramp="fur_grey", cloth="cloth_grey", mood="grim", extras=("wrinkles",), bg=GREY)),
    "portret_wojmir": ("Wojmir Cienki – chudy, chytry, kozia bródka", dict(skin="skin", hair="fur_brown", hat="bandana", hat_ramp="cloth_blue", beard="goatee", cloth="cloth_grey", mood="sly", mouth="smirk", extras=("earring",), bg=COLD)),
    "portret_wrzosek": ("Karczmarz Wrzosek – ruda broda, czerwony fartuch, serdeczny", dict(skin="skin", hair="fur_brown", beard="full", cloth="cloth_red", mood="kind", mouth="smirk", bg=WARM)),
    "portret_wszebor": ("Komendant Wszebor – hełm, siwe wąsy, kolczuga, złoty kołnierz", dict(skin="skin", hat="kettle", hat_ramp="metal", beard="mustache", beard_ramp="fur_grey", armor="chain", cloth="cloth_green", collar="gold", mood="grim", extras=("scar", "wrinkles"))),
    "portret_zona_borka": ("Żona Borka – brązowa chustka, jasne długie włosy, smutne oczy", dict(skin="skin", hair="hair_blond", hair_style="long", hat="scarf", hat_ramp="cloth_brown", cloth="cloth_brown", mood="kind", female=True)),
    "portret_zwiadowcy": ("Cesarscy zwiadowcy – hełm i kolczy kołnierz, czerwony płaszcz", dict(skin="skin", hair="fur_brown", hat="kettle", hat_ramp="iron", armor="chain", cloth="cloth_red", mood="grim", extras=("glint",))),
    # --- nowe portrety (dialogi dotąd bez portretu) ---
    "portret_hetman": ("Hetman Skjeldomir – siwy władca wyspy, futrzana czapa, złoty łańcuch", dict(skin="skin", hair="fur_grey", hat="fur", hat_ramp="fur_grey", beard="full", beard_ramp="fur_grey", cloth="cloth_blue", collar="gold", armor="pauldrons", armor_ramp="gold", mood="grim", extras=("scar", "wrinkles"), bg=COLD)),
    "portret_pelnomocnik": ("Pełnomocnik Rdzenia – urzędnik z kablami, zimny uśmiech", H["pelnomocnik"][1]),
    "portret_straznik_miejski": ("Strażnik miejski – żelazny kapelusz, czarne wąsy, bez pośpiechu", dict(skin="skin", hair="hair_black", hat="kettle", hat_ramp="iron", beard="mustache", cloth="cloth_grey", mood="sly", mouth="smirk", extras=("wrinkles",), bg=WARM)),
    "portret_hauk": ("Setnik Hauk – wyspiarz, niebieski kaftan, jasna broda, spokojny", dict(skin="skin", hair="hair_blond", hat="bandana", hat_ramp="cloth_blue", beard="full", beard_ramp="hair_blond", cloth="cloth_blue", mood="sly", mouth="smirk", extras=("earring", "scar2"), bg=WARM)),
    "portret_gniewosz": ("Sierżant Gniewosz – dezerter, zdarty kaftan, siwa szczecina, zmęczony", dict(skin="skin_dark", hair="fur_grey", hat="cap", hat_ramp="cloth_grey", beard="stubble", beard_ramp="fur_grey", cloth="cloth_brown", mood="grim", extras=("wrinkles", "scar2"), bg=WARM)),
    "portret_mszczuj": ("Szuler Mszczuj – czarna opaska, kozia bródka, chudy, chytry uśmiech", dict(skin="skin", hair="hair_black", hat="bandana", hat_ramp="cloth_red", beard="goatee", cloth="cloth_grey", mood="sly", mouth="smirk", extras=("earring",), bg=WARM)),
    "portret_kantynierka": ("Kantynierka Bronka – chustka, szeroka twarz, zmarszczki, rozbawiona", dict(skin="skin_dark", hair="fur_grey", hair_style="long", hat="scarf", hat_ramp="cloth_green", cloth="cloth_brown", mood="sly", mouth="smirk", female=True, extras=("wrinkles", "scar2"), bg=WARM)),
    "portret_zegota": ("Kapral Żegota – bandana, szczecina, blizna, zmęczony", dict(skin="skin", hair="fur_grey", hat="bandana", hat_ramp="cloth_grey", beard="stubble", cloth="cloth_grey", mood="grim", extras=("scar2", "wrinkles"), bg=WARM)),
    "portret_ziemowit": ("Druciarz Ziemowit – słomkowy kapelusz, siwa broda, poczciwy", dict(skin="skin", hat="straw", hat_ramp="wood", beard="full", beard_ramp="fur_grey", cloth="cloth_brown", mood="kind", mouth="smirk", extras=("wrinkles",), bg=WARM)),
    "portret_kapitan": ("Kapitan Bratosław – hełm, wąsy, blizna, surowy", dict(skin="skin", hat="kettle", hat_ramp="metal", beard="mustache", armor="pauldrons", armor_ramp="metal", cloth="cloth_green", mood="grim", extras=("scar",))),
    "portret_kapitan_przystani": ("Kapitan Wars – niebieska czapka, kozia bródka, morski wilk", dict(skin="skin_dark", hair="fur_grey", hat="cap", hat_ramp="cloth_blue", beard="goatee", beard_ramp="fur_grey", cloth="cloth_blue", collar="gold", mood="sly", extras=("wrinkles", "earring"), bg=COLD)),
    "portret_pisarz": ("Pisarz Atrament – wychudły, gogle zamiast okularów, szary kołnierz", dict(skin="skin", hair="fur_grey", cloth="cloth_grey", collar="cloth_grey", mood="sly", mouth="smirk", extras=("goggles", "wrinkles"), bg=GREY)),
    "portret_smyk": ("Smyk – chłopak z ulicy, czapka, chytry uśmiech", dict(skin="skin_dark", hair="fur_brown", hat="cap", hat_ramp="cloth_grey", cloth="cloth_brown", mood="sly", mouth="smirk", child=True, bg=GREY)),
    "portret_hjalmar": ("Hjalmar – łysy karczmarz, wąsy, polerowany kufel", dict(skin="skin", beard="mustache", beard_ramp="fur_brown", cloth="cloth_brown", mood="kind", mouth="smirk", bg=WARM)),
    "portret_siostra_jadwiga": ("Siostra Jadwiga – stara zakonnica, biały czepiec, bystre oczy", dict(skin="skin", hat="wimple", hat_ramp="linen", cloth="cloth_grey", mood="sly", female=True, extras=("wrinkles",), bg=COLD)),
    "portret_cesarz": ("Cesarz Ragnomir – złota korona, siwa broda, czerwony płaszcz", dict(skin="skin", hair="fur_grey", hat="kettle", hat_ramp="gold", beard="full", beard_ramp="fur_grey", cloth="cloth_red", collar="gold", armor="pauldrons", armor_ramp="gold", mood="grim", extras=("wrinkles", "glint"), bg=(233, 52, 88, 124, 52))),
    "portret_kwatermistrz_koszar": ("Kwatermistrz Burczymucha – gruby, czapka, wąsy, chytry", dict(skin="skin", hair="fur_brown", hat="cap", hat_ramp="cloth_green", beard="mustache", cloth="cloth_green", mood="sly", mouth="smirk", extras=("straps",), bg=WARM)),
    "portret_medyczka": ("Medyczka Dobromiła – biała przepaska, ciemne długie włosy, opanowana", dict(skin="skin", hair="hair_brown", hair_style="long", hat="band", hat_ramp="linen", cloth="cloth_green", mood="kind", female=True)),
    "portret_kowal_wyspy": ("Kowal Ragnar – łysy, ruda broda, tatuaże, kuźnia", dict(skin="skin", beard="full", beard_ramp="fur_brown", cloth="leather", armor="pauldrons", armor_ramp="iron", mood="angry", extras=("tattoo", "scar2"), bg=(233, 52, 124, 166, 208))),
    "portret_przekupka": ("Przekupka Rzepa – czerwona chustka, czarne długie włosy, chytre oczy", dict(skin="skin", hair="hair_black", hair_style="long", hat="scarf", hat_ramp="cloth_red", cloth="cloth_brown", mood="sly", mouth="smirk", female=True, extras=("wrinkles", "earring"), bg=WARM)),
}

# dialog -> portret (nowe portrety dopisywane w danych)
NEW_PORTRAITS = {
    "hetman": "portret_hetman", "pelnomocnik": "portret_pelnomocnik", "kapitan": "portret_kapitan",
    "kapitan_przystani": "portret_kapitan_przystani", "pisarz": "portret_pisarz", "smyk": "portret_smyk",
    "hjalmar": "portret_hjalmar", "siostra_domu_ciszy": "portret_siostra_jadwiga", "cesarz": "portret_cesarz",
    "kwatermistrz_koszar": "portret_kwatermistrz_koszar", "medyczka": "portret_medyczka",
    "kowal_wyspy": "portret_kowal_wyspy", "przekupka": "portret_przekupka",
}


def istota_portrait():
    from series_enemies_special import entity
    import pilot_common
    # rysuj Istote jako wroga do pamieci i przytnij do 48x48
    saved = pilot_common.finish
    holder = {}
    import series_enemies_special as sp
    sp.finish = lambda c, name, comment, kind: holder.update(c=c)
    entity()
    sp.finish = saved
    full = holder["c"]
    c = Canvas(48, 48)
    for y in range(48):
        for x in range(48):
            c.grid[y][x] = full.grid[y][x + 8]
    finish(c, "portret_istota", "Istota – twarz z czarnego szkła, w której świecą gwiazdy (portret w rozmowach)", "portrait")


def main(names):
    jobs = {k: (lambda k=k: npc(k, *P[k])) for k in P}
    jobs["portret_istota"] = istota_portrait
    for n in names or jobs:
        jobs[n]()
        print("ok", n)


if __name__ == "__main__":
    main(sys.argv[1:])
