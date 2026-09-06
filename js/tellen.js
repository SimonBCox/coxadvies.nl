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
