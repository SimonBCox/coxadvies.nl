/* Bouwdossier-zoeker.
   Alles gebeurt in de browser van de bezoeker. Het adres gaat naar de open diensten van
   het Kadaster en verder nergens heen; er wordt niets opgeslagen en niets gelogd.

   Vier open bronnen, alle vier zonder sleutel en met Access-Control-Allow-Origin: *
     1. Locatieserver, suggest en lookup -> adres, gemeente, gemeentecode, coordinaten
     2. BAG WFS, bag:verblijfsobject     -> het bouwjaar van dit adres
     3. OGC API Features                 -> de gemeentegrens, alleen die ene gemeente
     4. BRT-achtergrondkaart             -> de kaarttegels

   De loketten komen uit /data/bouwdossier-loketten.json, dat door
   tools/website/genereer_loketten.py wordt afgeleid uit
   documentatie/kennis/bestaande_bouw/gebouwendossiers.md. Die markdown blijft de bron;
   wijzig de json niet met de hand.

   Het bouwjaar is NIET hetzelfde als het vergunningjaar. Het geeft het dossier van de
   oorspronkelijke bouw; wie een latere verbouwing zoekt heeft het jaar van die
   vergunning nodig. Daarom staan de andere periodes er altijd bij, achter een uitklap
   die die vraag letterlijk stelt.

   Twee talen, een bestand. Dit script bedient /bouwdossier/ en /en/building-file/ en
   kiest de taal op het lang-attribuut van de pagina. Stond het tweemaal, dan liep de
   Engelse versie achter zodra er aan de Nederlandse iets veranderde; precies dat is met
   de prijs op de Engelse pagina gebeurd. De registerteksten zelf blijven Nederlands:
   die gaan over Nederlandse loketten die in het Nederlands werken, en ze staan op de
   Engelse pagina met een regel erboven die dat zegt. */
(function () {
  "use strict";

  var LS = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/";
  var BAG = "https://service.pdok.nl/lv/bag/wfs/v2_0";
  var GRENS = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items";
  var TEGELS = "https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png";

  var TAAL = /^en/i.test(document.documentElement.lang || "nl") ? "en" : "nl";

  /* Alle tekst die deze zoeker zelf schrijft, in beide talen naast elkaar. Wat uit het
     register komt staat hier niet: dat is inhoud en geen bediening. */
  var WOORDEN = {
    nl: {
      maanden: ["januari", "februari", "maart", "april", "mei", "juni", "juli",
                "augustus", "september", "oktober", "november", "december"],
      bezig: "Bezig met opzoeken.",
      gevonden: function (adres) { return "Antwoord gevonden voor " + adres + "."; },
      nietUitgezocht: function (g) { return g + " is nog niet uitgezocht."; },
      mislukt: "Het opzoeken lukte niet.",
      bedanktWel: "https://www.coxadvies.nl/bedankt-bouwdossier/",
      bedanktNiet: "https://www.coxadvies.nl/bedankt/",
      route: {
        duur: "Dit archief levert wel aan mij, maar rekent meer dan de tien euro die in " +
              "het bedrag zit. Vraagt u dit aan, dan bel ik u eerst over wat het archief kost.",
        digid: "Dit archief levert alleen aan de eigenaar zelf, na inloggen met uw eigen DigiD.",
        balie: "Dit archief laat de stukken alleen ter plaatse inzien, dus er valt niets op " +
               "afstand op te vragen.",
        onbekend: "Voor deze periode heb ik nog niet nagekeken of het archief ook aan mij levert.",
        geen: "Van deze jaren is er geen dossier meer, dus er valt niets op te vragen."
      },
      bouwjaar: function (j) { return "Bouwjaar " + j; },
      bouwjaarOnbekend: "Bouwjaar onbekend",
      valtOnder: function (g) { return " &middot; valt onder gemeente " + g; },
      onbekendKop: "Deze gemeente heb ik nog niet uitgezocht",
      onbekendZin: function (g) {
        return "Ik zoek een gemeente uit zodra ik er werk heb. Voor " + g + " is dat nog " +
               "niet gebeurd, en dan schrijf ik liever niets op dan iets wat ik niet heb " +
               "nagekeken.";
      },
      onbekendBody: "De algemene route werkt vrijwel overal wel zo. Begin bij de gemeente en " +
        "vraag naar het opvragen van een bouw- of sloopdossier, met het jaartal erbij. " +
        "Dossiers van de laatste jaren liggen daar of bij de regionale omgevingsdienst; " +
        "oudere dossiers bij het regionaal archief of streekarchief van die streek.",
      onbekendKnop: "Vraag het mij",
      onbekendFijn: "Uitzoeken kost u niets: u hoort binnen een werkdag bij welk loket het " +
        "ligt. Daarna staat het hier voor de volgende die zoekt.",
      zonderLoket: "Uw bouwjaar valt in deze periode. Hieronder staat waar het dossier ligt.",
      geenPeriodeMetJaar: "Het bouwjaar valt niet in een van de periodes die ik voor deze " +
        "gemeente heb vastgelegd, dus staan ze er alle bij.",
      geenPeriodeZonderJaar: "Het bouwjaar van dit pand is niet uit de basisregistratie te " +
        "halen, dus staan alle periodes er hieronder bij.",
      letopGemeente: "Let op bij deze gemeente.",
      letopKernKop: "Controleer dit zelf even.",
      letopKern: function (geldt, plaats) {
        return "Deze periode geldt volgens mijn aantekening voor " + geldt + ", en uw adres " +
               "ligt in " + plaats + ". Binnen deze gemeente lopen de periodegrenzen per kern " +
               "uiteen; bel het archief als u twijfelt.";
      },
      anderePlaats: "een andere kern",
      gecheckt: function (d) { return "Laatst gecontroleerd op " + d + "."; },
      algemeen: "Algemeen",
      verbouwingKop: "Zoekt u een dakkapel, uitbouw of andere verbouwing?",
      verbouwingTekst: "Dan telt het jaar van d&iacute;e vergunning en niet het bouwjaar van " +
        "de woning. Voor deze gemeente zijn dat de volgende periodes.",
      aanbod: 'Liever niet zelf uitzoeken en aanvragen? <a href="#contact">Ik vraag het ' +
        'dossier voor u op voor &euro; 150.</a>',
      aanbodZonderJaar: " Valt het bouwjaar buiten de periodes die ik heb vastgelegd, of is " +
        "het onbekend, dan weet ik pas na het opzoeken zeker welk loket het is; blijkt het " +
        "dossier daar niet op te vragen, dan krijgt u het bedrag terug.",
      aanbodNee: ' Aanvragen kan ik dit dus niet voor u, maar <a href="#contact">stel uw vraag ' +
        'gerust</a>, dan kijk ik mee.',
      nlTekst: "",
      kaartKop: "Toon dit adres op de kaart",
      kaartUitleg: "De omlijnde vlek is de gemeente waar uw adres onder valt, de speld staat " +
        "op het adres zelf. Zet u <b>Perceelgrenzen</b> aan, dan zoomt de kaart in op uw " +
        "woning, komen de kadastrale grenzen met de perceelnummers in beeld en licht uw eigen " +
        "perceel oranje op, desgewenst over de luchtfoto. Let op: een kadastrale grens is een " +
        "eigendomsgrens en geen bouwkundige. Kadastrale kaart en luchtfoto: Kadaster en PDOK.",
      kaartLagen: { kaart: "Kaart", lucht: "Luchtfoto", percelen: "Perceelgrenzen" },
      tlKop: "Wanneer is er aan dit huis iets veranderd?",
      tlTekst: "Hieronder staat hetzelfde adres per jaargang luchtfoto. Ziet u tussen twee " +
        "jaren een aanbouw, een dakkapel of een nieuw dak verschijnen, dan is dat het jaar " +
        "waarvan u het dossier nodig heeft. Klik op een jaar om te zien welk loket daarbij hoort.",
      tlFijn: "Luchtfoto&rsquo;s: Kadaster en PDOK, CC BY 4.0. De reeks begint bij 2016. " +
        "Zoekt u een verandering van eerder, dan staan de oude topografische kaarten op " +
        '<a href="https://www.topotijdreis.nl" target="_blank" rel="noopener">topotijdreis.nl</a>. ' +
        "Daarop ziet u geen dakkapel, maar wel wanneer het huis of een grote uitbouw er kwam.",
      tlJaar: function (j) { return "Luchtfoto van " + j; },
      tlMeer: function (n) { return "Toon alle<br>" + n + " jaren"; },
      tlFout: "De luchtfotodienst van PDOK reageert nu niet. Probeer het later nog eens.",
      paalrotKop: "Let op de fundering in deze buurt.",
      paalrotKlassen: { zeerlaag: "zeer laag", laag: "laag", matig: "matig", hoog: "hoog",
                        zeerhoog: "zeer hoog" },
      paalrotZin: function (buurt, klasse) {
        return "Het risico op paalrot is in " + buurt + " volgens de Klimaateffectatlas " +
               klasse + ". Dat cijfer geldt voor de hele buurt en zegt niets over dit ene huis. ";
      },
      paalrotBuurt: "deze buurt",
      paalrotOud: "Woningen van voor 1975 staan hier vaak op houten palen. ",
      paalrotSlot: "Hoe uw woning is gefundeerd staat in het bouwdossier, op de " +
        "funderingstekening en soms in de constructieberekening. Bron: Klimaateffectatlas, " +
        "CC BY 4.0.",
      foutKop: "Het opzoeken lukte niet",
      foutZin: "Dat ligt vrijwel altijd aan de kaartdienst van het Kadaster en niet aan uw " +
        "adres. Probeer het zo nog eens."
    },
    en: {
      maanden: ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"],
      bezig: "Looking it up.",
      gevonden: function (adres) { return "Answer found for " + adres + "."; },
      nietUitgezocht: function (g) { return "I have not looked into " + g + " yet."; },
      mislukt: "The lookup failed.",
      bedanktWel: "https://www.coxadvies.nl/en/thank-you/",
      bedanktNiet: "https://www.coxadvies.nl/en/question-received/",
      route: {
        duur: "This archive does supply me, but it charges more than the ten euros included " +
              "in the price. If you request it, I will call you first about what the archive " +
              "will charge.",
        digid: "This archive only supplies the owner in person, after logging in with a Dutch " +
               "DigiD. I cannot do that for you.",
        balie: "This archive only lets you view the documents on the premises, so there is " +
               "nothing to request remotely.",
        onbekend: "For this period I have not yet checked whether the archive also supplies me.",
        geen: "No file survives from these years, so there is nothing to request."
      },
      bouwjaar: function (j) { return "Built in " + j; },
      bouwjaarOnbekend: "Year of construction unknown",
      valtOnder: function (g) { return " &middot; part of the municipality of " + g; },
      onbekendKop: "I have not looked into this municipality yet",
      onbekendZin: function (g) {
        return "I work a municipality out once I have a job there. For " + g + " that has not " +
               "happened yet, and I would rather write nothing down than something I have not " +
               "checked.";
      },
      onbekendBody: "The general route works much the same almost everywhere. Start at the " +
        "municipality and ask for a building or demolition file, giving the year. Files from " +
        "recent years sit there or at the regional environmental service; older files sit at " +
        "the regional or district archive.",
      onbekendKnop: "Ask me",
      onbekendFijn: "Working it out costs you nothing: you hear within one working day which " +
        "counter holds it. After that it stands here for the next person who searches.",
      zonderLoket: "Your year of construction falls in this period. Below is where the file sits.",
      geenPeriodeMetJaar: "The year of construction does not fall in any of the periods I have " +
        "recorded for this municipality, so all of them are listed.",
      geenPeriodeZonderJaar: "The year of construction is not in the national building register " +
        "for this address, so all periods are listed below.",
      letopGemeente: "Worth knowing about this municipality.",
      letopKernKop: "Please check this yourself.",
      letopKern: function (geldt, plaats) {
        return "According to my note this period applies to " + geldt + ", and your address is " +
               "in " + plaats + ". Within this municipality the period boundaries differ per " +
               "village; call the archive if you are unsure.";
      },
      anderePlaats: "another village",
      gecheckt: function (d) { return "Last checked on " + d + "."; },
      algemeen: "General",
      verbouwingKop: "Looking for a dormer, an extension or another alteration?",
      verbouwingTekst: "Then the year of <em>that</em> permit counts, not the year the house " +
        "was built. For this municipality those are the periods below.",
      aanbod: 'Rather not do this yourself? <a href="#contact">I will request the file for ' +
        'you for &euro; 150.</a>',
      aanbodZonderJaar: " If the year falls outside the periods I have recorded, or is not " +
        "known, I only know for certain which counter it is once I start looking; if the file " +
        "turns out not to be available there, you get your money back.",
      aanbodNee: ' So this is one I cannot request for you, but <a href="#contact">ask me ' +
        'anyway</a> and I will look with you.',
      nlTekst: "The archive works in Dutch, and so do my notes on it. Here they are, with the " +
        "links and the exact terms you will need on their website.",
      kaartKop: "Show this address on the map",
      kaartUitleg: "The outlined area is the municipality your address belongs to, the pin is " +
        "on the address itself. Switch on <b>Plot boundaries</b> and the map zooms in on your " +
        "house, the cadastral boundaries appear with their plot numbers and your own plot " +
        "lights up in orange, over the aerial photo if you like. Note that a cadastral " +
        "boundary is a boundary of ownership, not of the structure. Cadastral map and aerial " +
        "photo: Kadaster and PDOK.",
      kaartLagen: { kaart: "Map", lucht: "Aerial photo", percelen: "Plot boundaries" },
      tlKop: "When was this house altered?",
      tlTekst: "Below is the same address in each year of aerial photography. If an extension, " +
        "a dormer or a new roof appears between two years, that is the year whose file you " +
        "need. Click a year to see which counter belongs to it.",
      tlFijn: "Aerial photos: Kadaster and PDOK, CC BY 4.0. The series starts in 2016. For a " +
        "change from before that, the old topographic maps are on " +
        '<a href="https://www.topotijdreis.nl" target="_blank" rel="noopener">topotijdreis.nl</a>. ' +
        "They will not show you a dormer, but they do show when the house or a large extension " +
        "appeared.",
      tlJaar: function (j) { return "Aerial photo from " + j; },
      tlMeer: function (n) { return "Show all<br>" + n + " years"; },
      tlFout: "The PDOK aerial photo service is not responding. Please try again later.",
      paalrotKop: "Worth knowing about foundations in this neighbourhood.",
      paalrotKlassen: { zeerlaag: "very low", laag: "low", matig: "moderate", hoog: "high",
                        zeerhoog: "very high" },
      paalrotZin: function (buurt, klasse) {
        return "According to the national climate atlas, the risk of pile rot in " + buurt +
               " is " + klasse + ". That figure applies to the whole neighbourhood and says " +
               "nothing about this one house. ";
      },
      paalrotBuurt: "this neighbourhood",
      paalrotOud: "Houses from before 1975 here often stand on timber piles. ",
      paalrotSlot: "How your house is founded is in the building file, on the foundation " +
        "drawing and sometimes in the structural calculation. Source: Klimaateffectatlas, " +
        "CC BY 4.0.",
      foutKop: "The lookup failed",
      foutZin: "That is almost always the Kadaster map service and not your address. Please " +
        "try again in a moment."
    }
  };

  var T = WOORDEN[TAAL];

  var invoer = document.getElementById("adres");
  var suglijst = document.getElementById("sug");
  var uitslag = document.getElementById("uitslag");
  var melding = document.getElementById("melding");
  var formAdres = document.getElementById("f-adres");
  var formJaar = document.getElementById("f-jaar");
  var formLoket = document.getElementById("f-loket");
  var formRoute = document.getElementById("f-route");
  var formRedirect = document.getElementById("f-redirect");

  if (!invoer || !uitslag) return;

  /* Wie de aanvraag mag doen, staat per periode in het register. Alleen bij een route
     die met "wij-" begint bied ik het aan; bij DigiD levert het loket alleen aan de
     eigenaar zelf, bij een balie-archief valt er niets op afstand te leveren, en bij
     "onbekend" heb ik het simpelweg nog niet nagekeken. Iets aanbieden wat daarna niet
     kan, betekent geld terugstorten en dat is de duurste fout op deze pagina. */
  function zetAanbod(route) {
    var kan = route && route.indexOf("wij-") === 0;
    var ja = document.getElementById("aanbod");
    var nee = document.getElementById("aanbod-nee");
    var kort = document.getElementById("aanbod-kort");
    if (!ja || !nee) return;
    ja.hidden = !kan;
    nee.hidden = !!kan;
    /* Het korte aanbodblok bovenaan noemt dezelfde prijs, dus dat gaat mee. Blijft het
       staan bij een loket dat niet levert, dan leest de bezoeker een aanbod dat ik niet
       waar kan maken, en dat is precies de fout die hierboven beschreven staat. */
    if (kort) kort.hidden = !kan;
    document.getElementById("aanbod-nee-zin").textContent = T.route[route] || T.route.onbekend;
    if (formRoute) formRoute.value = route || "";
    if (formRedirect) formRedirect.value = kan ? T.bedanktWel : T.bedanktNiet;
  }

  /* Het laatst opgezochte adres en de funderingsgegevens erbij. Klikt de bezoeker
     daarna in de tijdlijn op een jaar, dan wordt het antwoord voor dat jaar opnieuw
     opgebouwd zonder dat het adres nog een keer wordt opgezocht. */
  var laatsteRec = null, laatstePaalrot = null, laatsteJaar = null;
  /* Klapte de bezoeker de reeks open, dan blijft hij open als hij daarna op een jaar
     klikt. Anders krimpt de strook onder zijn handen weer terug naar vier. */
  var tijdlijnAlle = false;

  var kaart = null, laagGrens = null, marker = null;
  var loketten = null, wacht = null, bezig = false;

  function zeg(t) { if (melding) melding.textContent = t; }

  /* 2026-09-01 leest als een bestandsnaam. Op een klantpagina hoort 1 september 2026. */
  function datum(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    return parseInt(m[3], 10) + " " + T.maanden[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  function veilig(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function puntUitWkt(wkt) {
    var m = /POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/.exec(wkt || "");
    return m ? [parseFloat(m[2]), parseFloat(m[1])] : null;
  }

  function json(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " gaf " + r.status);
      return r.json();
    });
  }

  function haalLoketten() {
    if (loketten) return Promise.resolve(loketten);
    return json("/data/bouwdossier-loketten.json").then(function (d) {
      loketten = d;
      return d;
    });
  }

  /* Bouwjaar uit de BAG. Mislukt dit, dan is dat geen fout maar een onbekend jaar:
     de kaart werkt dan zonder, met alle periodes zichtbaar. */
  function haalBouwjaar(vboId) {
    if (!vboId) return Promise.resolve(null);
    var filter = '<Filter xmlns="http://www.opengis.net/fes/2.0"><PropertyIsEqualTo>' +
      '<ValueReference>identificatie</ValueReference><Literal>' + vboId +
      '</Literal></PropertyIsEqualTo></Filter>';
    var u = BAG + "?service=WFS&version=2.0.0&request=GetFeature" +
      "&typeNames=bag:verblijfsobject&outputFormat=application/json&count=1" +
      "&filter=" + encodeURIComponent(filter);
    return json(u).then(function (d) {
      var f = d.features && d.features[0];
      var j = f && f.properties && f.properties.bouwjaar;
      return typeof j === "number" ? j : null;
    }).catch(function () { return null; });
  }

  function toonSuggesties(docs) {
    suglijst.innerHTML = "";
    invoer.setAttribute("aria-expanded", docs.length ? "true" : "false");
    docs.forEach(function (d) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.textContent = d.weergavenaam;
      li.addEventListener("mousedown", function (e) { e.preventDefault(); kies(d); });
      suglijst.appendChild(li);
    });
  }

  function zoek(q) {
    if (q.trim().length < 4) { toonSuggesties([]); return; }
    json(LS + "suggest?q=" + encodeURIComponent(q) + "&fq=type%3Aadres&rows=8")
      .then(function (d) {
        var docs = (d.response && d.response.docs) || [];
        var gezien = {}, uniek = [];
        docs.forEach(function (x) {           // PDOK geeft soms hetzelfde adres twee keer
          if (!gezien[x.weergavenaam]) { gezien[x.weergavenaam] = 1; uniek.push(x); }
        });
        toonSuggesties(uniek.slice(0, 6));
      })
      .catch(function () { toonSuggesties([]); });
  }

  function kies(doc) {
    if (bezig) return;
    bezig = true;
    invoer.value = doc.weergavenaam;
    toonSuggesties([]);
    zeg(T.bezig);

    var rec = null;
    laatstePaalrot = null;
    tijdlijnAlle = false;
    json(LS + "lookup?id=" + encodeURIComponent(doc.id) +
         "&fl=weergavenaam,gemeentenaam,gemeentecode,woonplaatsnaam,adresseerbaarobject_id,centroide_ll")
      .then(function (d) {
        rec = d.response && d.response.docs && d.response.docs[0];
        if (!rec) throw new Error("adres niet gevonden");
        return Promise.all([haalLoketten(), haalBouwjaar(rec.adresseerbaarobject_id),
                            haalPaalrot(puntUitWkt(rec.centroide_ll))]);
      })
      .then(function (res) {
        laatstePaalrot = res[2];
        toon(rec, res[1]);
        return tekenKaart(puntUitWkt(rec.centroide_ll), rec.gemeentecode, rec.gemeentenaam);
      })
      .catch(toonFout)
      .then(function () { bezig = false; });
  }

  /* PDOK noemt een gemeente soms anders dan wij: "Nuenen, Gerwen en Nederwetten" en
     "Bergen (L)". Matcht de koptekst niet, dan kijken we naar de pdok-aliassen uit het
     register. Zonder die stap krijgt de bezoeker "nog niet uitgezocht" terwijl het blok
     er gewoon is. */
  function gemeenteUitRegister(naam) {
    if (!loketten) return null;
    var zoek = String(naam).toLowerCase(), g = null;
    loketten.gemeenten.forEach(function (x) {
      if (g) return;
      if (x.gemeente.toLowerCase() === zoek) g = x;
      else if (x.pdok) {
        x.pdok.forEach(function (a) {
          if (!g && String(a).toLowerCase() === zoek) g = x;
        });
      }
    });
    return g;
  }

  /* De periode waar dit bouwjaar in valt. Regels zonder jaartal horen bij geen enkel
     jaar; dat zijn algemene opmerkingen en die komen apart terug. */
  function kiesPeriode(g, jaar) {
    if (jaar == null) return null;
    var gevonden = null;
    g.perioden.forEach(function (p) {
      if (p.van == null && p.tot == null) return;
      if ((p.van == null || jaar >= p.van) && (p.tot == null || jaar <= p.tot)) {
        if (!gevonden) gevonden = p;
      }
    });
    return gevonden;
  }

  /* De kop van een periode. In het Engels staat er de vertaalde vorm uit het register;
     die wordt daar gemaakt en niet hier, zodat de gemeentepagina's en deze zoeker
     dezelfde regel tonen. */
  function kopVan(p) {
    return (TAAL === "en" ? (p.kop_en || p.kop) : p.kop) || "";
  }

  /* De lopende tekst bij een periode of een gemeente. Het register is Nederlands en
     blijft dat: het beschrijft loketten die in het Nederlands werken, met de zoektermen
     die de bezoeker op hun site nodig heeft. Op de Engelse pagina komt er de Engelse
     tekst boven als die in het register staat, plus een regel die zegt wat er volgt. */
  function lijfVan(html, enHtml) {
    if (TAAL !== "en") return html;
    var uit = enHtml || "";
    if (html) {
      uit += '<p class="aw-nl-kop">' + T.nlTekst + "</p>" +
             '<div class="aw-nl" lang="nl">' + html + "</div>";
    }
    return uit;
  }

  function periodeHtml(p) {
    return '<li class="aw-periode"><p class="aw-jaren">' + veilig(kopVan(p) || T.algemeen) +
      '</p><div class="aw-body">' + lijfVan(p.html, p.en_html) + '</div></li>';
  }

  function kaartblok() {
    return '<details class="aw-meer" id="kaartblok"><summary>' + T.kaartKop + '</summary>' +
      '<div class="aw-inhoud"><div class="aw-kaart" id="kaart"></div>' +
      '<p class="aw-fijn">' + T.kaartUitleg + '</p></div></details>';
  }

  /* ---- Wanneer is er aan dit huis iets veranderd -------------------------
     De luchtfoto's van PDOK staan per jaargang als eigen laag in dezelfde WMS,
     open en zonder sleutel. Welke jaargangen er zijn wordt uit de capabilities
     gelezen en staat niet hier: er komt elk jaar een jaargang bij, en een lijst
     in deze pagina zou stil verouderen zonder dat iemand het merkt.
     De beelden worden pas opgehaald als de bezoeker het blok openklapt. Het zijn
     een stuk of tien verzoeken per adres, en PDOK mag de dienst afknijpen bij te
     zwaar gebruik; dat willen we niet over ons afroepen voor plaatjes die de
     helft van de bezoekers niet opent. */
  var LUCHTFOTO = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0";
  var LUCHTFOTO_VOORKEUR = ["orthoHR", "ortho25", "quickorthoHR", "quickortho25"];
  var KADASTRALEKAART = "https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0";
  var jaargangen = null;

  function haalJaargangen() {
    if (jaargangen) return Promise.resolve(jaargangen);
    return fetch(LUCHTFOTO + "?service=WMS&version=1.3.0&request=GetCapabilities")
      .then(function (r) {
        if (!r.ok) throw new Error("luchtfotodienst gaf " + r.status);
        return r.text();
      })
      .then(function (xml) {
        var perJaar = {};
        var re = /<Name>(\d{4})_(orthoHR|ortho25|quickorthoHR|quickortho25)<\/Name>/g;
        var m;
        while ((m = re.exec(xml))) {
          var nu = perJaar[m[1]];
          if (!nu || LUCHTFOTO_VOORKEUR.indexOf(m[2]) < LUCHTFOTO_VOORKEUR.indexOf(nu)) {
            perJaar[m[1]] = m[2];
          }
        }
        jaargangen = Object.keys(perJaar).sort().map(function (j) {
          return { jaar: j, laag: j + "_" + perJaar[j] };
        });
        if (!jaargangen.length) throw new Error("geen jaargangen in de capabilities");
        return jaargangen;
      });
  }

  /* Een kader van ongeveer 50 bij 67 meter om het adres: het huis, de buren en de
     tuin erachter. Groot genoeg om een aanbouw te zien verschijnen, klein genoeg
     om te weten welk huis het is. WMS 1.3.0 met EPSG:4326 wil de hoeken in de
     volgorde breedtegraad, lengtegraad. */
  function luchtfotoUrl(laag, punt, breed, hoog) {
    var halveHoogte = 25 / 111320;
    var halveBreedte = halveHoogte * (breed / hoog) / Math.cos(punt[0] * Math.PI / 180);
    var vak = [punt[0] - halveHoogte, punt[1] - halveBreedte,
               punt[0] + halveHoogte, punt[1] + halveBreedte];
    return LUCHTFOTO + "?service=WMS&version=1.3.0&request=GetMap&styles=" +
      "&format=image/jpeg&crs=EPSG:4326&layers=" + encodeURIComponent(laag) +
      "&bbox=" + vak.join(",") + "&width=" + breed + "&height=" + hoog;
  }

  function tijdlijnHtml() {
    return '<details class="aw-meer" id="tijdlijnblok"><summary>' + T.tlKop +
      '</summary><div class="aw-inhoud"><p>' + T.tlTekst + '</p><div class="tl" id="tijdlijn"></div>' +
      '<p class="aw-fijn">' + T.tlFijn + '</p></div></details>';
  }

  /* Vier jaargangen laten zien is genoeg om een verandering op te merken en scheelt
     PDOK zeven verzoeken per opzoeking. De oudste en de nieuwste horen er altijd bij,
     de twee ertussen worden gelijkmatig over de reeks verdeeld. Wie meer wil, klikt. */
  function spreid(jr, aantal) {
    if (jr.length <= aantal) return jr;
    var uit = [];
    for (var i = 0; i < aantal; i++) {
      uit.push(jr[Math.round(i * (jr.length - 1) / (aantal - 1))]);
    }
    return uit;
  }

  function vulTijdlijn(punt, jaar, alle) {
    var vak = document.getElementById("tijdlijn");
    var stand = alle ? "alle" : "deel";
    if (!vak || !punt || vak.getAttribute("data-gevuld") === stand) return;
    if (vak.getAttribute("data-gevuld") === "alle") return;
    vak.setAttribute("data-gevuld", stand);
    haalJaargangen().then(function (jr) {
      var tonen = alle ? jr : spreid(jr, 4);
      vak.innerHTML = tonen.map(function (j) {
        return '<button type="button" class="tl-jaar" data-jaar="' + j.jaar + '"' +
          (String(jaar) === j.jaar ? ' aria-current="true"' : '') +
          '><img loading="lazy" width="180" height="135" alt="' + T.tlJaar(j.jaar) +
          '" src="' + luchtfotoUrl(j.laag, punt, 240, 180) + '"><span>' + j.jaar +
          '</span></button>';
      }).join("") + (tonen.length < jr.length
        ? '<button type="button" class="tl-meer">' + T.tlMeer(jr.length) + '</button>'
        : "");
    }).catch(function (e) {
      vak.innerHTML = '<p class="aw-fijn">' + T.tlFout + '</p>';
      if (window.console) console.warn("luchtfoto:", e);
    });
  }

  /* ---- Fundering in deze buurt -------------------------------------------
     De Klimaateffectatlas publiceert het risico op paalrot per buurt en niet per
     adres. Dat is genoeg om te zeggen waar in het dossier op te letten, en te
     weinig om iets over dit ene huis te beweren; zo staat het er ook.
     De klassegrenzen komen uit de stijl van de laag zelf, opgehaald met
     GetStyles op 2026-09-05. Het getal is het percentage panden in de buurt. */
  var KEA = "https://cas.cloud.sogelink.com/public/data/org/gws/YWFMLMWERURF/kea_public/wms";
  var PAALROT_KLASSEN = [[0.8, "zeerlaag"], [3, "laag"], [6, "matig"], [15, "hoog"]];

  /* Het perceel waarin dit adres ligt, als vorm. De laag antwoordt niet boven ongeveer
     1:6000, dus het bevraagde venster moet klein genoeg zijn; 101 bij 101 beeldpunten over
     veertig meter zit daar ruim onder. */
  function haalPerceel(punt) {
    if (!punt) return Promise.resolve(null);
    var d = 0.0002;
    var vraag = "service=WMS&version=1.3.0&request=GetFeatureInfo" +
      "&info_format=application/json&layers=Perceelvlak&query_layers=Perceelvlak" +
      "&crs=EPSG:4326&styles=&width=101&height=101&i=50&j=50&feature_count=1&bbox=" +
      [punt[0] - d, punt[1] - d, punt[0] + d, punt[1] + d].join(",");
    return json(KADASTRALEKAART + "?" + vraag).then(function (d2) {
      var f = d2 && d2.features && d2.features[0];
      return f && f.geometry ? f : null;
    }).catch(function (e) {
      // Zonder vorm blijft de kaart bruikbaar, alleen zonder oplichting.
      if (window.console) console.warn("perceel:", e);
      return null;
    });
  }

  function haalPaalrot(punt) {
    if (!punt) return Promise.resolve(null);
    var d = 0.0004;
    var vraag = "service=WMS&version=1.3.0&request=GetFeatureInfo" +
      "&info_format=application/json&layers=risicopaalrot_huidig" +
      "&query_layers=risicopaalrot_huidig&crs=EPSG:4326&styles=" +
      "&width=11&height=11&i=5&j=5&feature_count=1&bbox=" +
      [punt[0] - d, punt[1] - d, punt[0] + d, punt[1] + d].join(",");
    return json(KEA + "?" + vraag).then(function (d2) {
      var f = d2 && d2.features && d2.features[0];
      var w = f && f.properties && f.properties.no_cc_risi;
      if (typeof w !== "number") return null;
      var klasse = "zeerhoog";
      for (var i = 0; i < PAALROT_KLASSEN.length; i++) {
        if (w <= PAALROT_KLASSEN[i][0]) { klasse = PAALROT_KLASSEN[i][1]; break; }
      }
      return { buurt: f.properties.buurtnaam || "", klasse: klasse };
    }).catch(function (e) {
      // Zonder deze laag mist er een alinea, meer niet. Wel melden, niet stilvallen.
      if (window.console) console.warn("funderingskaart:", e);
      return null;
    });
  }

  /* Alleen tonen als het iets zegt. In het rivierengebied en op de zandgronden
     staat vrijwel elke buurt op "zeer laag", en een alinea die overal hetzelfde
     meldt leert de lezer het hele blok over te slaan. */
  function funderingHtml(pr, jaar) {
    if (!pr) return "";
    var zwaar = pr.klasse === "matig" || pr.klasse === "hoog" || pr.klasse === "zeerhoog";
    var oud = jaar && jaar < 1975;
    if (!zwaar && !(oud && pr.klasse === "laag")) return "";
    return '<div class="aw-letop"><b>' + T.paalrotKop + '</b> ' +
      T.paalrotZin(veilig(pr.buurt || T.paalrotBuurt), T.paalrotKlassen[pr.klasse]) +
      (oud ? T.paalrotOud : "") + T.paalrotSlot + '</div>';
  }

  function toon(rec, jaar) {
    var g = gemeenteUitRegister(rec.gemeentenaam);
    var jaarregel = jaar ? T.bouwjaar(jaar) : T.bouwjaarOnbekend;
    var plaatsregel = veilig(rec.weergavenaam);
    if (g && rec.woonplaatsnaam &&
        rec.woonplaatsnaam.toLowerCase() !== String(rec.gemeentenaam).toLowerCase()) {
      plaatsregel += T.valtOnder(veilig(rec.gemeentenaam));
    }

    if (formAdres) formAdres.value = rec.weergavenaam;
    if (formJaar && jaar && !formJaar.value) formJaar.value = String(jaar);

    var h = "";

    if (!g) {
      h += '<article class="aw aw--onzeker">';
      h += '<header class="aw-hoofd"><p class="aw-adres">' + plaatsregel + '</p>' +
           '<p class="aw-jaar">' + veilig(jaarregel) + '</p>' +
           '<h2 class="aw-kop">' + T.onbekendKop + '</h2>' +
           '<p class="aw-zin">' + T.onbekendZin(veilig(rec.gemeentenaam)) + '</p></header>';
      h += '<div class="aw-doen"><p>' + T.onbekendBody + '</p>' +
           '<p class="aw-actie"><a class="btn" href="#contact">' + T.onbekendKnop + '</a></p>' +
           '<p class="aw-fijn">' + T.onbekendFijn + '</p>' +
           funderingHtml(laatstePaalrot, jaar) + '</div>';
      h += tijdlijnHtml();
      h += kaartblok();
      h += '</article>';
      uitslag.innerHTML = h;
      uitslag.hidden = false;
      laatsteRec = rec; laatsteJaar = jaar;
      hangTijdlijnOp(puntUitWkt(rec.centroide_ll), jaar);
      if (formLoket) formLoket.value = rec.gemeentenaam + " (nog niet uitgezocht)";
      zetAanbod("onbekend");
      zeg(T.nietUitgezocht(rec.gemeentenaam));
      return;
    }

    var p = kiesPeriode(g, jaar);
    var algemeen = g.perioden.filter(function (x) {
      return x.van == null && x.tot == null;
    });
    var overig = g.perioden.filter(function (x) {
      return x !== p && (x.van != null || x.tot != null);
    });

    h += '<article class="aw' + (p ? "" : " aw--onzeker") + '">';
    h += '<header class="aw-hoofd"><p class="aw-adres">' + plaatsregel + '</p>' +
         '<p class="aw-jaar">' + veilig(jaarregel) + '</p>';
    if (p) {
      // Het loket is het antwoord en hoort dus de kop te zijn. Staat het niet als
      // zodanig in het register, dan valt de kop terug op gemeente plus periode;
      // liever dat dan een naam die uit de zin geraden is.
      h += '<h2 class="aw-kop">' + veilig(p.loket || (g.gemeente + ", " + kopVan(p))) + '</h2>';
      /* De periode zoals het register hem schrijft, zonder er een zin omheen te bouwen.
         Die aanhef verschilt per gemeente ("t/m 2000", "Bouwvergunningen t/m september
         2010", "vanaf 2015"), dus elke vaste formulering eromheen loopt ergens stuk. */
      h += '<p class="aw-zin">' + (p.loket ? veilig(kopVan(p)) : T.zonderLoket) + '</p>';
    } else {
      h += '<h2 class="aw-kop">' + veilig(g.gemeente) + '</h2>' +
           '<p class="aw-zin">' + (jaar ? T.geenPeriodeMetJaar : T.geenPeriodeZonderJaar) +
           '</p>';
    }
    h += '</header>';

    h += '<div class="aw-doen">';
    if (g.voorbehoud) {
      var vb = g.voorbehoud.charAt(0).toUpperCase() + g.voorbehoud.slice(1);
      h += '<div class="aw-letop"><b>' + T.letopGemeente + '</b> <span lang="nl">' +
           veilig(vb) + '</span></div>';
    }
    if (p && p.geldt_voor &&
        String(p.geldt_voor).toLowerCase() !== String(rec.woonplaatsnaam || "").toLowerCase()) {
      h += '<div class="aw-letop"><b>' + T.letopKernKop + '</b> ' +
           T.letopKern(veilig(p.geldt_voor), veilig(rec.woonplaatsnaam || T.anderePlaats)) +
           '</div>';
    }
    if (p) {
      // De loketnaam staat al als kop; hem er meteen onder nog eens bij zetten leest
      // als een hapering. Alleen weghalen als hij er letterlijk staat.
      var body = p.html;
      if (p.loket) {
        var kaal = p.loket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // De punt hoorde hier ook bij. Zonder hem bleef bij "**Het Utrechts Archief**.
        // Alle bouwdossiers staan online" een losse punt vooraan de zin staan.
        body = body.replace(new RegExp("^<p><strong>" + kaal + "</strong>[,.:]?\\s*"), "<p>");
      }
      h += '<div class="aw-body">' + lijfVan(body, p.en_html) + '</div>';
    } else {
      h += '<ul class="aw-periodes">' + g.perioden.map(periodeHtml).join("") + '</ul>';
    }
    h += funderingHtml(laatstePaalrot, jaar);
    var staart = lijfVan(g.intro_html, g.en_html);
    if (staart) h += '<div class="aw-fijn">' + staart + '</div>';
    algemeen.forEach(function (a) {
      // Een regel die alleen een interne notitie bevatte, houdt hier niets over. Zonder
      // deze controle stond er een leeg kader onder het antwoord.
      var tekst = lijfVan(a.html, a.en_html);
      if (tekst) h += '<div class="aw-fijn">' + tekst + '</div>';
    });
    h += '<p class="aw-gecheckt">' + T.gecheckt(veilig(datum(g.gecheckt))) + '</p>';
    h += '</div>';

    if (p && overig.length) {
      h += '<details class="aw-meer"><summary>' + T.verbouwingKop + '</summary>' +
           '<div class="aw-inhoud"><p>' + T.verbouwingTekst + '</p>' +
           '<ul class="aw-periodes">' + overig.map(periodeHtml).join("") + '</ul></div></details>';
    }
    /* Zonder gevonden periode weet ik de route niet zeker. Alle periodes van deze
       gemeente afwijzen zou te streng zijn en alles aanbieden te ruim; is er ten minste
       een periode die het aan mij levert, dan bied ik het aan met dat voorbehoud erbij. */
    var route;
    if (p) {
      route = p.route;
    } else if (g.perioden.some(function (x) {
      return (x.van != null || x.tot != null) && x.wij;
    })) {
      route = g.route;
    } else if (g.route && g.route.indexOf("wij-") !== 0) {
      /* Levert geen enkele periode aan mij, dan is de route van de gemeente zelf het
         eerlijkste antwoord: in Den Haag is dat een balie-archief, en "dat heb ik nog
         niet nagekeken" zou dan onwaar zijn. Alleen een wij-route mag hier niet
         doorglippen, want die belooft iets wat geen enkele periode waarmaakt. */
      route = g.route;
    } else {
      route = "onbekend";
    }
    zetAanbod(route);

    if (route.indexOf("wij-") === 0) {
      h += '<p class="aw-uit">' + T.aanbod + (p ? "" : T.aanbodZonderJaar) + '</p>';
    } else {
      h += '<p class="aw-uit">' + veilig(T.route[route] || T.route.onbekend) +
           T.aanbodNee + '</p>';
    }

    h += tijdlijnHtml();
    h += kaartblok();

    h += '</article>';

    uitslag.innerHTML = h;
    uitslag.hidden = false;
    laatsteRec = rec; laatsteJaar = jaar;
    hangTijdlijnOp(puntUitWkt(rec.centroide_ll), jaar);
    // Deze regel gaat als verborgen veld mee in de aanvraagmail en wordt door mij
    // gelezen, niet door de bezoeker. Dus altijd de Nederlandse periodekop.
    if (formLoket) {
      formLoket.value = g.gemeente + (p ? " / " + p.kop : "") +
        " (gecontroleerd " + g.gecheckt + ")";
    }
    zeg(T.gevonden(rec.weergavenaam));
  }

  /* Het uitklapblok wordt bij elk antwoord opnieuw opgebouwd, dus de luisteraar gaat er
     hier elke keer weer aan. Het staat meteen open: die luchtfoto's zijn het enige beeld
     op deze pagina, en ze beantwoorden de vraag waar de pagina om draait, namelijk in
     welk jaar er iets aan het huis is veranderd. */
  function hangTijdlijnOp(punt, jaar) {
    var blok = document.getElementById("tijdlijnblok");
    if (!blok || !punt) return;
    blok.addEventListener("toggle", function () {
      if (blok.open) vulTijdlijn(punt, jaar, tijdlijnAlle);
    });
    blok.open = true;
    vulTijdlijn(punt, jaar, tijdlijnAlle);
  }

  uitslag.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest || !laatsteRec) return;
    if (e.target.closest(".tl-meer")) {
      tijdlijnAlle = true;
      vulTijdlijn(puntUitWkt(laatsteRec.centroide_ll), laatsteJaar, true);
      return;
    }
    var knop = e.target.closest(".tl-jaar");
    if (!knop) return;
    var jaar = parseInt(knop.getAttribute("data-jaar"), 10);
    if (formJaar) formJaar.value = String(jaar);
    toon(laatsteRec, jaar);
  });

  function toonFout(e) {
    uitslag.innerHTML = '<article class="aw aw--onzeker"><header class="aw-hoofd">' +
      '<h2 class="aw-kop">' + T.foutKop + '</h2><p class="aw-zin">' + T.foutZin +
      '</p></header><div class="aw-doen"><p class="aw-actie">' +
      '<a class="btn" href="#contact">' + T.onbekendKnop + '</a></p></div></article>';
    uitslag.hidden = false;
    zeg(T.mislukt);
    if (window.console) console.warn("bouwdossier-zoeker:", e);
  }

  /* De kaart zit in een uitklap en wordt pas opgebouwd als die opengaat; Leaflet meet
     anders een vak van nul hoog en tekent grijs. */
  function tekenKaart(punt, gemeentecode, gemeentenaam) {
    var blok = document.getElementById("kaartblok");
    var vak = document.getElementById("kaart");
    if (!blok || !vak || !punt) return Promise.resolve();
    kaart = null; laagGrens = null; marker = null;

    var bouw = function () {
      if (kaart) { kaart.invalidateSize(); return; }
      kaart = L.map(vak, { scrollWheelZoom: false });
      var basis = L.tileLayer(TEGELS, {
        maxZoom: 19,
        attribution: 'Kaart &copy; <a href="https://www.kadaster.nl" target="_blank" rel="noopener">Kadaster</a> / PDOK'
      }).addTo(kaart);

      /* De luchtfoto en de kadastrale kaart komen van dezelfde open diensten van PDOK
         als de rest van deze pagina, zonder sleutel. De perceelgrens met het
         perceelnummer over de luchtfoto is het beeld dat mensen van hun eigen koopakte
         kennen, en het zegt iets over hun grond dat de gemeentegrens niet zegt. */
      var lucht = L.tileLayer.wms(LUCHTFOTO, {
        layers: "Actueel_orthoHR", format: "image/jpeg", maxZoom: 21,
        attribution: 'Luchtfoto &copy; Kadaster / PDOK, CC BY 4.0'
      });
      var perceelkaart = L.tileLayer.wms(KADASTRALEKAART, {
        layers: "Perceel", format: "image/png", transparent: true, maxZoom: 21,
        attribution: 'Kadastrale kaart &copy; Kadaster / PDOK'
      });
      /* De kadastrale kaart tekent alle grenzen even zwart. Welk van die vlakken bij dit
         adres hoort weet de bezoeker niet, dus dat lichten we op in de warme huiskleur. */
      var eigenPerceel = L.geoJSON(null, {
        style: { color: "#e39a4e", weight: 2, fillColor: "#e39a4e", fillOpacity: .3 }
      });
      var percelen = L.layerGroup([perceelkaart, eigenPerceel]);
      haalPerceel(punt).then(function (vorm) { if (vorm) eigenPerceel.addData(vorm); });
      var basisLagen = {}, overlays = {};
      basisLagen[T.kaartLagen.kaart] = basis;
      basisLagen[T.kaartLagen.lucht] = lucht;
      overlays[T.kaartLagen.percelen] = percelen;
      L.control.layers(basisLagen, overlays, { collapsed: false }).addTo(kaart);

      /* De kadastrale kaart tekent pas onder ongeveer 1:6000. Zet je hem aan terwijl de
         kaart nog de hele gemeente toont, dan gebeurt er niets zichtbaars en denkt de
         bezoeker dat de laag stuk is. Dus vliegen we naar het adres toe. */
      kaart.on("overlayadd", function (e) {
        if (e.layer !== percelen || kaart.getZoom() >= 17) return;
        if (eigenPerceel.getLayers().length) {
          kaart.flyToBounds(eigenPerceel.getBounds(), { padding: [26, 26], maxZoom: 20 });
        } else {
          kaart.flyTo(punt, 19);
        }
      });

      marker = L.marker(punt).addTo(kaart).bindPopup(veilig(gemeentenaam));
      kaart.setView(punt, 14);
      if (laagGrens) pas();
    };

    var geo = null;
    var pas = function () {
      if (!kaart || !geo) return;
      laagGrens = L.geoJSON(geo, {
        style: { color: "#004e92", weight: 2, opacity: .9, fillColor: "#004e92", fillOpacity: .07 }
      }).addTo(kaart);
      kaart.fitBounds(laagGrens.getBounds(), { padding: [14, 14] });
    };

    blok.addEventListener("toggle", function () { if (blok.open) bouw(); });

    if (!gemeentecode) return Promise.resolve();
    return json(GRENS + "?f=json&identificatie=GM" + encodeURIComponent(gemeentecode) + "&limit=1")
      .then(function (d) {
        if (d && d.features && d.features.length) { geo = d; laagGrens = null; if (kaart) pas(); }
      })
      .catch(function () { /* zonder grens is de kaart nog steeds bruikbaar */ });
  }

  invoer.addEventListener("input", function () {
    var q = invoer.value;
    clearTimeout(wacht);
    wacht = setTimeout(function () { zoek(q); }, 220);
  });
  invoer.addEventListener("blur", function () {
    setTimeout(function () { toonSuggesties([]); }, 120);
  });
  invoer.addEventListener("keydown", function (e) {
    if (e.key === "Escape") toonSuggesties([]);
  });

  haalLoketten().catch(function (e) {
    if (window.console) console.warn("loketten laden mislukt:", e);
  });
})();
