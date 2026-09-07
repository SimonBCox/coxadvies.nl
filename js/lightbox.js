// Projectkaarten met lightbox. Zie css/lightbox.css.
// Lightbox bij de projectkaarten: per dialog is er telkens een figure zichtbaar.
  document.querySelectorAll(".lightbox").forEach(function (d) {
    var fig = d.querySelectorAll(".lb-beeld figure"), stippen = d.querySelector(".lb-stippen"), nu = 0;
    fig.forEach(function (_, i) {
      var s = document.createElement("span");
      if (i === 0) s.className = "aan";
      stippen.appendChild(s);
    });
    function toon(i) {
      nu = (i + fig.length) % fig.length;
      fig.forEach(function (f, k) { f.classList.toggle("aan", k === nu); });
      stippen.querySelectorAll("span").forEach(function (s, k) { s.classList.toggle("aan", k === nu); });
    }
    d.querySelector(".lb-volgende").addEventListener("click", function () { toon(nu + 1); });
    d.querySelector(".lb-vorige").addEventListener("click", function () { toon(nu - 1); });
    d.querySelector(".lb-sluit").addEventListener("click", function () { d.close(); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") toon(nu + 1);
      if (e.key === "ArrowLeft") toon(nu - 1);
    });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });
  document.querySelectorAll(".omslag").forEach(function (b) {
    b.addEventListener("click", function () { document.getElementById(b.dataset.lb).showModal(); });
  });
