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


MAANDEN = {"01": "januari", "02": "februari", "03": "maart", "04": "april", "05": "mei",
           "06": "juni", "07": "juli", "08": "augustus", "09": "september",
           "10": "oktober", "11": "november", "12": "december"}

GOOGLE_G = (
    '<svg viewBox="0 0 48 48" aria-hidden="true">'
    '<path fill="#4285F4" d="M45 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12c-.2 1.9-1.5 4.8-4.4 6.8l6.7 5.2c4-3.7 6.7-9.1 6.7-15.3z"/>'
    '<path fill="#34A853" d="M24 46c5.8 0 10.6-1.9 14.2-5.2l-6.7-5.2c-1.8 1.3-4.3 2.2-7.5 2.2-5.7 0-10.6-3.8-12.3-9l-7 5.4C8.2 41.1 15.5 46 24 46z"/>'
    '<path fill="#FBBC05" d="M11.7 28.8c-.5-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3l-7-5.4C3.6 17.6 3 20.7 3 24s.6 6.4 1.7 9.2l7-5.4z"/>'
    '<path fill="#EA4335" d="M24 10.5c4 0 6.8 1.7 8.4 3.2l6-5.9C34.6 4.4 29.8 2 24 2 15.5 2 8.2 6.9 4.7 14.2l7 5.4c1.7-5.2 6.6-9.1 12.3-9.1z"/>'
    "</svg>"
)


def datum_nl(waarde: str) -> str:
    """'2026-07' -> 'juli 2026'."""
    if not waarde or "-" not in waarde:
        return ""
    jaar, maand = waarde.split("-")[:2]
    return f"{MAANDEN.get(maand, '')} {jaar}".strip()


def initiaal(naam: str) -> str:
    return naam.strip()[:1].upper() or "?"


def kaart(r: dict) -> str:
    sterren = "&#9733;" * int(r.get("sterren", 5))
    regel2 = r.get("bedrijf") or r.get("plaats") or ""
    datum = datum_nl(r.get("datum", ""))
    meta = " &middot; ".join(x for x in (esc(regel2), datum) if x)

    project = r.get("project", "").strip()
    klasse = "recensie" if project else "recensie geen-project"
    voet = f'\n          <p class="project">{esc(project)}</p>' if project else ""

    return f"""        <article class="{klasse}">
          <div class="rec-hoofd">
            <span class="avatar" aria-hidden="true">{initiaal(r['naam'])}</span>
            <span class="rec-wie">
              <span class="naam">{esc(r['naam'])}</span>
              <span class="meta">{meta}</span>
            </span>
          </div>
          <div class="recensie-top"><span class="sterren" aria-label="{r.get('sterren', 5)} van de 5 sterren">{sterren}</span><span class="g-mark">{GOOGLE_G}Google</span></div>
          <blockquote>&ldquo;{esc(r['citaat'])}&rdquo;</blockquote>{voet}
        </article>"""


def bouw_blok(data: dict) -> str:
    zichtbaar = [r for r in data["recensies"] if r.get("tonen", True)]
    if not zichtbaar:
        raise SystemExit("Geen zichtbare recensies: zet minstens een keer 'tonen' op true.")

    kaarten = "\n\n".join(kaart(r) for r in zichtbaar)
    aantal = len(data["recensies"])
    leesurl = data.get("profiel_leesurl") or data["profiel_url"]
    scores = [r.get("sterren", 5) for r in data["recensies"]]
    cijfer = f"{sum(scores) / len(scores):.1f}".replace(".", ",")

    return f"""{START}
  <section class="section" id="recensies">
    <div class="wrap">
      <div class="sec-head reveal">
        <p class="eyebrow">Beoordelingen</p>
        <h2>Wat klanten zeggen</h2>
      </div>
      <div class="rec-kop reveal">
        <span class="rec-cijfer">{cijfer}</span>
        <span class="sterren" aria-label="{cijfer} van de 5">{"&#9733;" * 5}</span>
        <span class="rec-kop-tekst"><b>{aantal} beoordelingen</b><br>op Google</span>
        <a href="{leesurl}" target="_blank" rel="noopener">Bekijk op Google</a>
      </div>
      <div class="recensies reveal">

{kaarten}

      </div>
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
