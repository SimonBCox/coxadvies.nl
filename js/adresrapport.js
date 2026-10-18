/* Adreskeuze in het bestelformulier van het adresrapport (trap 1).
   Trap 1 wordt per adres door een script samengesteld en als concept klaargezet, dus het
   adres moet een BAG-adres zijn en geen vrije tekst: bij een appartement zijn 40-H en
   40-1 twee verschillende woningen.
   Het formulier gaat daarom pas weg als er een adres uit de lijst is gekozen; het
   verblijfsobject-id gaat mee in het verborgen veld adres_id.

   Dit is alleen de suggestielijst van de Locatieserver. De loketbepaling, de kaart en
   het aanbod per route staan in bouwdossier.js en horen daar te blijven; trap 2 en 3
   bestel je op /bouwdossier/ en /en/building-file/, waar die controle draait. */
(function () {
  "use strict";

  var LS = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/";
  var NL = (document.documentElement.lang || "nl").slice(0, 2) !== "en";
  var kiesMelding = NL ? "Kies het adres uit de lijst die verschijnt als u typt."
                : "Pick the address from the list that appears as you type.";

  var invoer = document.getElementById("f-adres");
  var suglijst = document.getElementById("sug");
  var adresId = document.getElementById("f-adres-id");
  var form = document.getElementById("bestel");
  if (!invoer || !suglijst || !adresId || !form) return;

  var wacht = null, gekozen = "";

  function json(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " gaf " + r.status);
      return r.json();
    });
  }

  function toon(docs) {
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
    if (q.trim().length < 4) { toon([]); return; }
    json(LS + "suggest?q=" + encodeURIComponent(q) + "&fq=type%3Aadres&rows=8")
      .then(function (d) {
        var docs = (d.response && d.response.docs) || [];
        var gezien = {}, uniek = [];
        docs.forEach(function (x) {
          if (!gezien[x.weergavenaam]) { gezien[x.weergavenaam] = 1; uniek.push(x); }
        });
        toon(uniek.slice(0, 6));
      })
      .catch(function () { toon([]); });
  }

  function kies(doc) {
    invoer.value = doc.weergavenaam;
    gekozen = doc.weergavenaam;
    invoer.setCustomValidity("");
    toon([]);
    json(LS + "lookup?id=" + encodeURIComponent(doc.id) + "&fl=adresseerbaarobject_id")
      .then(function (d) {
        var rec = d.response && d.response.docs && d.response.docs[0];
        adresId.value = (rec && rec.adresseerbaarobject_id) || doc.id;
      })
      .catch(function () { adresId.value = doc.id; });
  }

  invoer.addEventListener("input", function () {
    var q = invoer.value;
    if (q !== gekozen) { gekozen = ""; adresId.value = ""; }
    clearTimeout(wacht);
    wacht = setTimeout(function () { zoek(q); }, 220);
  });
  invoer.addEventListener("blur", function () {
    setTimeout(function () { toon([]); }, 120);
  });
  invoer.addEventListener("keydown", function (e) {
    if (e.key === "Escape") toon([]);
  });

  form.addEventListener("submit", function (e) {
    if (!gekozen) {
      e.preventDefault();
      invoer.setCustomValidity(kiesMelding);
      invoer.reportValidity();
    }
  });
})();
