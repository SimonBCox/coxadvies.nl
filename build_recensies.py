"""Genereert het recensieblok op coxadvies.nl uit bedrijfsdocumenten/recensies.json.

Gebruik na het toevoegen of wijzigen van een recensie:

    python website/coxadvies.nl/build_recensies.py

Het script vervangt alles tussen de RECENSIES-markers in de doelpagina's. Verder in de
pagina raakt het niets aan, dus je kunt het zo vaak draaien als je wilt.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
BRON = HIER.parent.parent / "bedrijfsdocumenten" / "recensies.json"
DOELEN = [HIER / "index.html"]

START = "<!-- RECENSIES:START (gegenereerd door build_recensies.py, niet met de hand wijzigen) -->"
EIND = "<!-- RECENSIES:EIND -->"


def esc(tekst: str) -> str:
    """HTML-veilig, en typografisch nette aanhalingstekens voor het citaat."""
    return html.escape(tekst, quote=False)


def kaart(r: dict) -> str:
    sterren = "&#9733;" * int(r.get("sterren", 5))
    wie = esc(r["naam"])
    if r.get("bedrijf"):
        wie += f" &middot; {esc(r['bedrijf'])}"
    elif r.get("plaats"):
        wie += f" &middot; {esc(r['plaats'])}"

    project = r.get("project", "").strip()
    klasse = "recensie" if project else "recensie geen-project"
    voet = f'\n          <p class="project">{esc(project)}</p>' if project else ""

    return f"""        <article class="{klasse}">
          <div class="recensie-top"><span class="sterren" aria-label="{r.get('sterren', 5)} van de 5 sterren">{sterren}</span><span class="bron">via Google</span></div>
          <blockquote>&ldquo;{esc(r['citaat'])}&rdquo;</blockquote>
          <p class="wie">{wie}</p>{voet}
        </article>"""


def bouw_blok(data: dict) -> str:
    zichtbaar = [r for r in data["recensies"] if r.get("tonen", True)]
    if not zichtbaar:
        raise SystemExit("Geen zichtbare recensies: zet minstens een keer 'tonen' op true.")

    kaarten = "\n\n".join(kaart(r) for r in zichtbaar)
    aantal = len(data["recensies"])
    leesurl = data.get("profiel_leesurl") or data["profiel_url"]

    return f"""{START}
  <section class="section" id="recensies">
    <div class="wrap">
      <div class="sec-head reveal">
        <p class="eyebrow">Wat klanten zeggen</p>
        <h2>Beoordeeld door de mensen voor wie ik rekende</h2>
        <p>Deze beoordelingen staan op mijn Google-profiel, dus u kunt ze daar nalezen.
          Waar het kan staat eronder wat ik op dat adres heb uitgerekend.</p>
      </div>
      <div class="recensies reveal">

{kaarten}

      </div>
      <p class="recensie-voet reveal">Alle {aantal} beoordelingen staan op
        <a href="{leesurl}" target="_blank" rel="noopener">mijn Google-profiel</a>.</p>
    </div>
  </section>
  {EIND}"""


def main() -> int:
    data = json.loads(BRON.read_text(encoding="utf-8"))

    onbevestigd = [r["naam"] for r in data["recensies"]
                   if r.get("project") and not r.get("bevestigd")]

    blok = bouw_blok(data)
    patroon = re.compile(re.escape(START) + r".*?" + re.escape(EIND), re.S)

    for doel in DOELEN:
        tekst = doel.read_text(encoding="utf-8")
        if not patroon.search(tekst):
            print(f"  OVERGESLAGEN {doel.name}: geen RECENSIES-markers gevonden")
            continue
        doel.write_text(patroon.sub(lambda _: blok, tekst), encoding="utf-8")
        zichtbaar = sum(1 for r in data["recensies"] if r.get("tonen", True))
        print(f"  {doel.name}: {zichtbaar} van {len(data['recensies'])} recensies geplaatst")

    if onbevestigd:
        print("\n  LET OP, projectkoppeling nog niet bevestigd voor: " + ", ".join(onbevestigd))
        print("  Zet 'bevestigd' op true in recensies.json zodra je ze hebt nagekeken.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
