# -*- coding: utf-8 -*-
"""build_woningdossier.py -- het voorbeeldbeeld op /bouwdossier/, uit de bron.

Op /bouwdossier/ staat een beeld dat laat zien wat een woningdossier is: de
gescande pagina's uit het archief, en daarnaast de leeswijzer die wij erbij
schrijven. Dat beeld was met de hand samengesteld, en toen de leeswijzer op
2026-09-06 een opgemaakt document werd (zie tools/bouwdossier/leeswijzer_pdf.py)
liep het stil achter: op de site stond nog de oude opmaak terwijl de klant een
document met briefhoofd kreeg.

Daarom wordt het hier gebouwd uit dezelfde bronnen als het echte product:

* de pagina's komen uit `bouwdossiers/_voorbeeld/`, de vier vergunningen die
  het Regionaal Archief Nijmegen leverde;
* de leeswijzer komt uit `LEESWIJZER_voorbeeld.md` door het sjabloon van
  leeswijzer_pdf.py, dus letterlijk dezelfde opmaak als het stuk dat meegaat.

Verandert de opmaak van het document, dan verandert het beeld op de site mee.
Dat is dezelfde afspraak als bij build_tekeningfragment.py: de site mag nooit
stil afwijken van wat de klant krijgt.

Draaien:  python website/coxadvies.nl/build_woningdossier.py

Schrijft img/woningdossier.png.
"""
from __future__ import annotations

import base64
import io
import os
import subprocess
import sys
import tempfile

import fitz
from PIL import Image

HIER = os.path.dirname(os.path.abspath(__file__))
WORTEL = os.path.abspath(os.path.join(HIER, "..", ".."))
sys.path.insert(0, os.path.join(WORTEL, "tools", "bouwdossier"))

import leeswijzer_pdf as lw  # noqa: E402

VOORBEELD = os.path.join(WORTEL, "bouwdossiers", "_voorbeeld")
LEESWIJZER = os.path.join(VOORBEELD, "LEESWIJZER_voorbeeld.md")
DOEL = os.path.join(HIER, "img", "woningdossier.png")

#: De datum die in het document staat. Vast, en niet vandaag: het beeld hoort niet
#: te veranderen omdat iemand het script opnieuw draait.
OPVRAAGDATUM = "6 september 2026"

#: Maten van het beeld, in dezelfde eenheid als de css hieronder. Het bestand wordt
#: op tweevoudige schaal gerenderd en daarna teruggeschaald, zodat de tekst scherp is.
BREED, HOOG = 1560, 1000
KOLOM_LINKS, TUSSEN = 700, 44
KOLOMMEN, RIJEN = 7, 4


def paginas_van_het_dossier():
    """Elke pagina van elk stuk, in de volgorde waarin het dossier is geleverd."""
    pdfs = []
    for wortel, _, namen in os.walk(VOORBEELD):
        for naam in sorted(namen):
            if naam.lower().endswith(".pdf"):
                pdfs.append(os.path.join(wortel, naam))
    pdfs.sort()
    if not pdfs:
        raise SystemExit("geen pdf's in %s" % VOORBEELD)

    breed_css = (KOLOM_LINKS - (KOLOMMEN - 1) * 10) / KOLOMMEN
    uit = []
    for pad in pdfs:
        doc = fitz.open(pad)
        for pagina in doc:
            zoom = (breed_css * 2) / pagina.rect.width
            plaat = pagina.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            uit.append("data:image/png;base64,"
                       + base64.b64encode(plaat.tobytes("png")).decode())
        doc.close()
    return uit


def leeswijzer_als_beeld(breedte_css):
    """De eerste bladzijde van de leeswijzer, gerenderd zoals de klant hem krijgt."""
    tekst = io.open(LEESWIJZER, encoding="utf-8").read()
    if "\n---\n" not in tekst:
        raise SystemExit("de voorbeeldleeswijzer heeft geen streepregel; zonder die "
                         "scheiding gaan onze eigen aantekeningen mee het beeld in.")
    tekst = tekst.split("\n---\n", 1)[1].strip()
    regels = tekst.split("\n")
    titel = regels[0].lstrip("# ").strip()
    tekst = "\n".join(regels[1:]).strip()

    with open(lw.LOGO, "rb") as f:
        logo = "data:image/png;base64," + base64.b64encode(f.read()).decode()
    html = (lw.SJABLOON
            .replace("__LOGO__", logo)
            .replace("__TITEL__", lw.veilig(titel))
            .replace("__DATUM__", OPVRAAGDATUM)
            .replace("__KENMERK__", "")
            .replace("__LEESWIJZER__", lw.markdown_naar_html(tekst))
            .replace("__BRONNEN__", ""))

    with tempfile.TemporaryDirectory() as tijdelijk:
        pdf = os.path.join(tijdelijk, "leeswijzer.pdf")
        lw.schrijf_pdf(html, pdf)
        doc = fitz.open(pdf)
        pagina = doc[0]
        zoom = (breedte_css * 2) / pagina.rect.width
        plaat = pagina.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        beeld = "data:image/png;base64," + base64.b64encode(plaat.tobytes("png")).decode()
        doc.close()
    return beeld


SJABLOON = """<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Hanken+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#1c2430; --muted:#5c6675; --bg:#f7f5f0; --line:#e3e0d8;
          --navy:#0c3a64; --accent:#004e92; }
  * { box-sizing:border-box; }
  body { margin:0; width:__BREED__px; height:__HOOG__px; background:var(--bg);
         font-family:"Hanken Grotesk","Segoe UI",Arial,sans-serif; color:var(--ink);
         padding:34px; display:flex; gap:__TUSSEN__px; }
  .eyebrow { font-size:11px; font-weight:700; letter-spacing:.14em;
             text-transform:uppercase; color:var(--muted); margin:0 0 10px; }
  .links { width:__LINKS__px; display:flex; flex-direction:column; }
  .links h2 { font-family:Lora,Georgia,serif; font-weight:600; font-size:20px;
              color:var(--navy); margin:0 0 18px; }
  .raster { display:grid; grid-template-columns:repeat(__KOLOMMEN__,1fr); gap:10px; }
  .blad { background:#fff; border:1px solid var(--line); border-radius:3px;
          box-shadow:0 2px 6px -3px rgba(28,36,48,.28); overflow:hidden;
          aspect-ratio:1/1.414; }
  .blad img { display:block; width:100%; height:100%; object-fit:cover;
              object-position:top center; }
  .voet { margin-top:auto; padding-top:16px; border-top:1px solid var(--line);
          font-size:12.5px; color:var(--muted); line-height:1.9; }
  .voet b { color:var(--navy); }
  /* De rechterkolom toont het document zelf. Het loopt onderaan uit beeld: dat zegt
     dat er meer is, zonder dat er een afgesneden regel als een fout oogt. */
  .rechts { flex:1; display:flex; flex-direction:column; min-width:0; }
  .stuk { position:relative; flex:1; overflow:hidden; border-radius:3px; }
  .stuk img { display:block; width:100%; height:auto;
              border:1px solid var(--line); border-radius:3px;
              box-shadow:0 14px 30px -18px rgba(28,36,48,.45); }
  .stuk::after { content:""; position:absolute; left:0; right:0; bottom:0; height:150px;
                 background:linear-gradient(to bottom,rgba(247,245,240,0),var(--bg)); }
</style></head><body>
<div class="links">
  <p class="eyebrow">Wat er in het dossier zat</p>
  <h2>__KOP__</h2>
  <div class="raster">__BLADEN__</div>
  <div class="voet">
    <b>Uit het archief:</b> tekeningen, vergunningen, berekeningen<br>
    <b>Uit de openbare bronnen:</b> bouwjaar, perceel, bodem, sonderingen,
    funderingsbeeld, luchtfoto's per jaar<br>
    <b>Van mij:</b> de leeswijzer
  </div>
</div>
<div class="rechts">
  <p class="eyebrow">En de leeswijzer erbij</p>
  <div class="stuk"><img src="__STUK__" alt=""></div>
</div>
</body></html>"""


def telwoord(n):
    woorden = {13: "dertien", 27: "zevenentwintig", 28: "achtentwintig",
               29: "negenentwintig", 30: "dertig"}
    return woorden.get(n, str(n))


def bouw_html(bladen, stuk, aantal_stukken):
    kop = ("Vier vergunningen, %s documenten, %s pagina's"
           % (telwoord(aantal_stukken), telwoord(len(bladen))))
    return (SJABLOON
            .replace("__BREED__", str(BREED))
            .replace("__HOOG__", str(HOOG))
            .replace("__TUSSEN__", str(TUSSEN))
            .replace("__LINKS__", str(KOLOM_LINKS))
            .replace("__KOLOMMEN__", str(KOLOMMEN))
            .replace("__KOP__", kop)
            .replace("__BLADEN__",
                     "".join('<div class="blad"><img src="%s" alt=""></div>' % b
                             for b in bladen))
            .replace("__STUK__", stuk))


def schiet_plaatje(html, doel):
    """Chrome maakt de opname, op dubbele schaal voor scherpe tekst."""
    if not os.path.exists(lw.CHROME):
        raise SystemExit("Chrome staat niet op %s" % lw.CHROME)
    with tempfile.TemporaryDirectory() as tijdelijk:
        bron = os.path.join(tijdelijk, "beeld.html")
        ruw = os.path.join(tijdelijk, "ruw.png")
        io.open(bron, "w", encoding="utf-8").write(html)
        subprocess.run(
            [lw.CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=2",
             "--window-size=%d,%d" % (BREED, HOOG),
             "--screenshot=" + ruw,
             "--virtual-time-budget=6000",
             "file:///" + bron.replace("\\", "/")],
            check=True, capture_output=True, timeout=180)
        if not os.path.exists(ruw):
            raise SystemExit("Chrome heeft geen opname geschreven")
        # Op tweevoudige schaal is het bestand ruim een megabyte. Anderhalf keer de
        # weergavemaat is scherp genoeg op een goed scherm en scheelt de helft.
        beeld = Image.open(ruw).convert("RGB")
        beeld = beeld.resize((int(BREED * 1.5), int(HOOG * 1.5)), Image.LANCZOS)
        beeld.save(doel, "PNG", optimize=True)


def hoofd():
    stukken = sum(1 for w, _, n in os.walk(VOORBEELD)
                  for b in n if b.lower().endswith(".pdf"))
    bladen = paginas_van_het_dossier()
    stuk = leeswijzer_als_beeld(BREED - 68 - KOLOM_LINKS - TUSSEN)
    schiet_plaatje(bouw_html(bladen, stuk, stukken), DOEL)
    print("%s: %d pagina's uit %d stukken, %.0f kB"
          % (os.path.relpath(DOEL, WORTEL), len(bladen), stukken,
             os.path.getsize(DOEL) / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(hoofd())
