/* Bezoekersstatistiek.

   Eén bestand, want de site telt 57 pagina's en er komt er steeds een bij. Een
   tweede teller erbij zetten hoort dan één bestand te raken en niet zevenenvijftig.
   Elke pagina laadt dit met <script src="/js/tellen.js" async></script> vlak voor
   </body>; bij de gemeentepagina's staat die regel in het sjabloon van
   tools/website/genereer_gemeentepaginas.py, anders is hij na de eerste run weg.

   GoatCounter zet geen cookies, gebruikt geen vingerafdruk en bewaart geen
   persoonsgegevens, dus hiervoor is geen toestemming vooraf nodig. Dat is precies
   waarom het hier staat en niet iets anders. Komt Google Analytics er ooit bij, dan
   verandert dat: die zet wél cookies, en dan hoort er een cookiemelding te komen die
   pas na een klik laadt, plus een regel in de privacyverklaring. Zet zoiets dus niet
   zomaar in dit bestand erbij. */
window.goatcounter = {endpoint: "https://coxadvies.goatcounter.com/count"};

(function () {
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  document.head.appendChild(s);
})();

/* Klikken op bellen, mailen en WhatsApp tellen, met de pagina erbij.

   GoatCounter telt een klik op een link met data-goatcounter-click, maar zet
   als verwijzer de site waar de bezoeker vandaan kwam en niet de pagina waarop
   hij klikte. Hieronder komt die pagina erbij. Een link zonder naam krijgt een
   naam naar de plek waar hij staat: bel-kop, bel-voet, mail-contact of
   wa-tekst. Zo hoeft geen van de honderden links op de site met de hand een
   naam te krijgen, ook niet op de gegenereerde gemeentepagina's.

   Dezelfde logica staat in /js/klik.js op draagmuurkoning.nl en
   keukenvoorbereid.nl. Zet geen cookies en bewaart niets. */
(function () {
  function soort(h) {
    if (h.indexOf("tel:") === 0) return "bel";
    if (h.indexOf("mailto:") === 0) return "mail";
    if (/wa\.me\/|whatsapp\.com\//.test(h)) return "wa";
    return null;
  }
  function plek(a) {
    if (a.closest("header, nav")) return "kop";
    if (a.closest("footer")) return "voet";
    if (a.closest("form, #contact, .contact")) return "contact";
    return "tekst";
  }
  function titel(a) {
    var t = (a.textContent || "").replace(/\s+/g, " ").trim();
    return (t || a.getAttribute("aria-label") || "").slice(0, 100);
  }
  function klik(e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.hasAttribute("data-goatcounter-click")) {
      a.setAttribute("data-goatcounter-referrer", location.pathname);
      a.setAttribute("data-goatcounter-title", titel(a));
      return;
    }
    var s = soort(a.getAttribute("href") || "");
    if (!s || !window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({
      event: true,
      path: s + "-" + plek(a),
      title: titel(a),
      referrer: location.pathname
    });
  }
  document.addEventListener("click", klik, true);
  document.addEventListener("auxclick", klik, true);
})();
