// Projectenkaart op /projecten/, met css/projectenkaart.css en D3 7.9.0.
// De data komt uit /data/projectenkaart.json en wordt in de werkmap gemaakt met
// tools/website/projectenkaart.py. Elk project staat op het midden van de woonplaats,
// nooit op het adres, en er staat geen nummer, naam of jaartal in.
(function () {
  'use strict';
  const stage = document.getElementById('pk-stage');
  if (!stage) return;

  const W = 1000, H = 1120;
  const GROEPEN = [
    {id: 'doorbraak', naam: 'Doorbraak'},
    {id: 'uitbreiding', naam: 'Uitbreiding en nieuwbouw'},
    {id: 'vloer', naam: 'Vloer en trapgat'},
    {id: 'advies', naam: 'Advies en toetsing'}];
  const ORDE = {doorbraak: 0, uitbreiding: 1, vloer: 2, advies: 3};
  // op de donkere kaart lichtere tinten dan in de lijst eronder
  const GLOED = {doorbraak: '#FF8C5A', uitbreiding: '#3DDCCB', vloer: '#FFD166', advies: '#B79CFF'};
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GROF = window.matchMedia('(pointer: coarse)').matches;
  const SMAL = window.matchMedia('(max-width: 980px)');
  const TELWOORD = ['geen', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien'];
  const state = {aan: new Set(GROEPEN.map(g => g.id)), loopt: false, gekozen: null, vast: false,
                 view: null, gespeeld: REDUCE, inBeeld: false};
  let P = [], G = null, PL = {}, kaart = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const meervoud = n => n === 1 ? '1 project' : n + ' projecten';
  const telwoord = n => TELWOORD[n] || String(n);
  const metFotos = p => p.fotos && p.fotos.length;
  // lopend werk eerst, dan per soort, en binnen een soort het nieuwste bovenaan
  const volgorde = (a, b) => (b.loopt ? 1 : 0) - (a.loopt ? 1 : 0) || (metFotos(b) ? 1 : 0) - (metFotos(a) ? 1 : 0) ||
    ORDE[a.groep] - ORDE[b.groep] || b.i - a.i;
  const zicht = () => P.filter(p => state.aan.has(p.groep));

  function plaatsen(lijst) {
    const m = new Map();
    lijst.forEach(p => { if (!m.has(p.plaats)) m.set(p.plaats, []); m.get(p.plaats).push(p); });
    return Array.from(m, ([naam, ps]) => ({naam, ll: PL[naam], ps: ps.slice().sort(volgorde)}))
      .filter(t => t.ll).sort((a, b) => b.ps.length - a.ps.length || a.naam.localeCompare(b.naam, 'nl'));
  }

  // de symbolen van de bouwtekening: profiel, huis, vloerveld en cirkel
  function symbool(g, s) {
    if (g === 'advies') return `M${-s},0a${s},${s} 0 1,0 ${2 * s},0a${s},${s} 0 1,0 ${-2 * s},0Z`;
    if (g === 'vloer') return `M${-s * .9},${-s * .9}H${s * .9}V${s * .9}H${-s * .9}Z`;
    if (g === 'uitbreiding') return `M${-s},${-s * .05}L0,${-s * 1.1}L${s},${-s * .05}V${s}H${-s}Z`;
    const t = s * .38, w = s * .2;
    return `M${-s},${-s}H${s}V${-s + t}H${w}V${s - t}H${s}V${s}H${-s}V${s - t}H${-w}V${-s + t}H${-s}Z`;
  }
  const symSvg = g => `<svg class="pk-sym" viewBox="-9 -9 18 18" aria-hidden="true"><path d="${symbool(g, 7)}" fill="var(--pk-${g})"/></svg>`;
  function spiraal(n, c, o) {
    const uit = [];
    for (let i = 0; i < n; i++) { const r = c * Math.sqrt(i + o), a = i * 2.39996; uit.push([r * Math.cos(a), r * Math.sin(a)]); }
    return uit;
  }

  // Namen: probeer acht richtingen op oplopende afstand en neem de eerste die vrij ligt.
  // Op een smal scherm vervalt een naam die nergens past, anders komt hij over een buur.
  function plaatsLabels(items, obst, sc, verberg) {
    const vrij = r => !obst.some(o => o.id !== r.id && r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
    const richt = [[1, 0], [-1, 0], [0, -1], [0, 1], [.72, -.72], [-.72, -.72], [.72, .72], [-.72, .72]];
    for (const it of items) {
      let k = null;
      // op een smal scherm blijft een naam dicht bij zijn plaats, anders leest hij als die van een buur
      zoek: for (const e0 of verberg ? [3, 9] : [3, 9, 18, 30]) for (const [dx, dy] of richt) {
        const e = e0 * sc, ax = it.x + dx * (it.r + e), ay = it.y + dy * (it.r + e);
        const x0 = dx > .1 ? ax : dx < -.1 ? ax - it.w : ax - it.w / 2;
        const y0 = dy > .1 ? ay : dy < -.1 ? ay - it.h : ay - it.h / 2;
        const r = {id: it.id, x0, y0, x1: x0 + it.w, y1: y0 + it.h};
        if (vrij(r)) { k = Object.assign(r, {e, ax, ay, dx, dy}); break zoek; }
      }
      if (!k && verberg) { it.lab = null; continue; }
      if (!k) { const e = 3 * sc, ax = it.x + it.r + e; k = {id: it.id, x0: ax, y0: it.y - it.h / 2, x1: ax + it.w, y1: it.y + it.h / 2, e, ax, ay: it.y, dx: 1, dy: 0}; }
      it.lab = k;
      obst.push(Object.assign({}, k, {id: 'lab_' + it.id}));
    }
  }

  /* ---------------- De kaart ---------------- */
  function tekenKaart(lijst) {
    if (kaart) kaart.opruimen();
    const svg = d3.select('#pk-kaart'), overlay = d3.select('#pk-overlay');
    svg.selectAll('*').remove(); svg.on('click', null); overlay.html('');
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
    const box = stage.getBoundingClientRect();
    const schaal = Math.min(box.width / W, box.height / H) || .6;
    // symbolen en namen groeien mee als de kaart klein op het scherm staat
    const ss = Math.max(1, Math.min(1.8, .75 / schaal)), ls = Math.max(1, Math.min(2.3, .9 / schaal));
    const verberg = ls > 1.35, C = GLOED;

    const defs = svg.append('defs');
    const rg = defs.append('radialGradient').attr('id', 'pkBg').attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', 520).attr('cy', 515).attr('r', 840);
    [[0, '#10264a'], [.55, '#08121f'], [1, '#03060b']].forEach(([o, c]) => rg.append('stop').attr('offset', o).attr('stop-color', c));
    // symbolen krijgen een smalle gloed, anders vervloeit de vorm
    const fs = defs.append('filter').attr('id', 'pkGloed').attr('x', '-200%').attr('y', '-200%').attr('width', '500%').attr('height', '500%');
    fs.append('feGaussianBlur').attr('stdDeviation', 1.3).attr('result', 'b');
    const fsm = fs.append('feMerge'); fsm.append('feMergeNode').attr('in', 'b'); fsm.append('feMergeNode').attr('in', 'SourceGraphic');
    const hg = defs.append('radialGradient').attr('id', 'pkHalo');
    hg.append('stop').attr('offset', 0).attr('stop-color', 'rgba(150,195,255,.32)');
    hg.append('stop').attr('offset', 1).attr('stop-color', 'rgba(150,195,255,0)');

    const proj = d3.geoMercator().fitExtent([[60, 70], [940, 1060]], G.land), path = d3.geoPath(proj);
    // de achtergrond loopt door buiten het kader, zodat een brede kaart geen naad krijgt
    svg.append('rect').attr('x', -2000).attr('y', -2000).attr('width', 5000).attr('height', 5000).attr('fill', 'url(#pkBg)');
    const g = svg.append('g');
    const landD = path(G.land);
    g.append('path').attr('d', landD).attr('fill', 'none').attr('stroke', 'rgba(80,140,255,.14)').attr('stroke-width', 8).attr('vector-effect', 'non-scaling-stroke');
    g.append('path').attr('d', landD).attr('fill', '#0a1729').attr('stroke', 'rgba(140,185,255,.42)').attr('stroke-width', .9).attr('vector-effect', 'non-scaling-stroke');
    g.append('g').selectAll('path').data(G.provgrens.features).join('path').attr('d', path).attr('fill', 'none')
      .attr('stroke', 'rgba(140,185,255,.13)').attr('stroke-width', .7).attr('vector-effect', 'non-scaling-stroke');
    // gemeentegrenzen alleen rond Nijmegen, en pas bij inzoomen; de randen vloeien weg
    const [gx0, gy0] = proj([5.55, 52.08]), [gx1, gy1] = proj([6.25, 51.66]);
    const fade = defs.append('radialGradient').attr('id', 'pkVak').attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', (gx0 + gx1) / 2).attr('cy', (gy0 + gy1) / 2).attr('r', Math.min(gx1 - gx0, gy1 - gy0) / 2);
    [[0, '#fff'], [.7, '#fff'], [1, '#000']].forEach(([o, c]) => fade.append('stop').attr('offset', o).attr('stop-color', c));
    defs.append('mask').attr('id', 'pkVakMask').attr('maskUnits', 'userSpaceOnUse').attr('x', gx0).attr('y', gy0).attr('width', gx1 - gx0).attr('height', gy1 - gy0)
      .append('rect').attr('x', gx0).attr('y', gy0).attr('width', gx1 - gx0).attr('height', gy1 - gy0).attr('fill', 'url(#pkVak)');
    const gem = g.append('path').attr('d', path(G.gemgrens)).attr('mask', 'url(#pkVakMask)').attr('fill', 'none')
      .attr('stroke', 'rgba(140,185,255,.2)').attr('stroke-width', .6).attr('vector-effect', 'non-scaling-stroke').attr('opacity', 0);

    const torens = plaatsen(lijst), c = 6.2 * ss, r0 = 5 * ss, rRing = r0 * 1.55;
    const halos = g.append('g'), pg = g.append('g'), lb = g.append('g').attr('pointer-events', 'none');
    const flits = g.append('g').attr('pointer-events', 'none');
    const punten = [];
    torens.forEach(t => {
      const xy = proj(t.ll); t.xy = xy;
      // de spiraal begint iets van het midden, anders vallen de eerste twee symbolen over elkaar
      const o = t.ps.length > 1 ? .5 : 0;
      t.r = c * Math.sqrt(Math.max(0, t.ps.length - 1 + o)) + r0;
      halos.append('circle').datum(t).attr('cx', xy[0]).attr('cy', xy[1]).attr('fill', 'url(#pkHalo)');
      const tg = pg.append('g').datum(t).attr('class', 'pk-pl');
      tg.append('circle').attr('class', 'pk-hit').attr('cx', xy[0]).attr('cy', xy[1]).attr('r', t.r + 6).attr('fill', 'transparent');
      tg.append('circle').attr('class', 'pk-sel').attr('cx', xy[0]).attr('cy', xy[1]).attr('r', t.r + 4 * ss).attr('fill', 'none')
        .attr('stroke', 'rgba(235,243,255,.85)').attr('stroke-width', 1.2).attr('stroke-dasharray', '3 2.5').attr('vector-effect', 'non-scaling-stroke');
      spiraal(t.ps.length, c, o).forEach(([dx, dy], i) => punten.push({p: t.ps[i], t, x: xy[0] + dx, y: xy[1] + dy, g: tg}));
    });
    punten.forEach(d => {
      if (state.loopt && d.p.loopt) d.g.append('circle').attr('class', 'pk-puls pk-ring').attr('cx', d.x).attr('cy', d.y).attr('r', rRing)
        .attr('fill', 'none').attr('stroke', C[d.p.groep]).attr('stroke-width', 1.2).attr('vector-effect', 'non-scaling-stroke');
      d.el = d.g.append('path').attr('class', 'pk-dot').attr('d', symbool(d.p.groep, r0)).attr('transform', `translate(${d.x},${d.y})`)
        .attr('fill', C[d.p.groep]).attr('filter', 'url(#pkGloed)');
    });

    // namen bij plaatsen met twee of meer projecten, per zoomniveau in schermmaat geplaatst
    const items = torens.filter(t => t.ps.length >= 2).map(t => ({id: t.naam, t, tekst: t.naam, w: t.naam.length * 11 * .56 * ls, h: 12 * ls}));
    function plaatsVoor(k, f) {
      // ingezoomd houdt een marge een naam weg van het symbool van een buurplaats; landelijk is daar geen ruimte voor
      const m = k > 1.6 ? 9 : 0;
      const obst = torens.map(t => { const x = t.xy[0] * k, y = t.xy[1] * k, r = t.r * f * k + m; return {id: t.naam, x0: x - r, y0: y - r, x1: x + r, y1: y + r}; });
      if (k > 1.6) torens.filter(t => t.ps.length === 1).forEach(t => {
        const x0 = t.xy[0] * k + r0 * f * k + 5;
        obst.push({id: 'een_' + t.naam, x0, y0: t.xy[1] * k - 6 * ls, x1: x0 + t.naam.length * 10 * .56 * ls, y1: t.xy[1] * k + 6 * ls});
      });
      items.forEach(it => { it.x = it.t.xy[0] * k; it.y = it.t.xy[1] * k; it.r = it.t.r * f * k; });
      plaatsLabels(items.slice().sort((a, b) => a.y - b.y), obst, ls, verberg);
    }
    const labs = lb.selectAll('text').data(items).join('text').attr('class', 'pk-lab')
      .attr('fill', 'rgba(220,232,255,.86)').attr('font-weight', 500).attr('letter-spacing', '.02em').text(it => it.tekst);
    function zetLabels(k, f) {
      labs.attr('display', it => it.lab ? null : 'none').filter(it => it.lab)
        .attr('text-anchor', it => it.lab.dx > .1 ? 'start' : it.lab.dx < -.1 ? 'end' : 'middle')
        .attr('dominant-baseline', it => it.lab.dy > .1 ? 'hanging' : it.lab.dy < -.1 ? 'alphabetic' : 'central')
        .attr('x', it => it.t.xy[0] + it.lab.dx * (it.t.r * f + it.lab.e / k))
        .attr('y', it => it.t.xy[1] + it.lab.dy * (it.t.r * f + it.lab.e / k))
        .attr('font-size', 11 * ls / k);
    }
    // plaatsen met één project krijgen pas een naam als je inzoomt
    const lbEen = g.append('g').attr('pointer-events', 'none').attr('opacity', 0);
    const eenNamen = lbEen.selectAll('text').data(torens.filter(t => t.ps.length === 1)).join('text')
      .attr('dominant-baseline', 'central').attr('fill', 'rgba(200,218,255,.72)').attr('font-weight', 500).text(t => t.naam);

    pg.selectAll('.pk-pl').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', d => `${d.naam}, ${meervoud(d.ps.length)}`)
      .on('mouseenter', (e, d) => { if (!GROF) kies(d.naam); })
      .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); klik(d.naam, false); } });

    const rond = (x, y, f) => `translate(${x},${y}) scale(${f}) translate(${-x},${-y})`;
    let huidig = state.view || [W / 2, H / 2, W], fNu = 1;
    const ringen = pg.selectAll('.pk-ring'), dots = pg.selectAll('.pk-dot');
    function pasToe(v) {
      const k = W / v[2], f = Math.pow(k, -.62);
      state.view = v; fNu = f;
      g.attr('transform', `translate(${W / 2 - v[0] * k},${H / 2 - v[1] * k}) scale(${k})`);
      // een groepje schaalt om zijn eigen plaats, zodat het bij inzoomen niet over de buren heen groeit
      pg.selectAll('.pk-pl').attr('transform', t => rond(t.xy[0], t.xy[1], f));
      zetLabels(k, f);
      halos.selectAll('circle').attr('r', t => (9 + 6 * Math.sqrt(t.ps.length)) * ss * Math.pow(k, -.3));
      const zichtbaar = Math.max(0, Math.min(1, (k - 1.6) / 1.5));
      gem.attr('opacity', zichtbaar);
      lbEen.attr('opacity', zichtbaar);
      eenNamen.attr('x', t => t.xy[0] + r0 * f + 5 / k).attr('y', t => t.xy[1]).attr('font-size', 10 * ls / k);
    }
    // bij het zoomen dimmen de namen halverwege en springen ze daar naar de plaatsing van het eindbeeld
    const kf = v => { const k = W / v[2]; return [k, Math.pow(k, -.62)]; };
    function zoom(doel) {
      const i = d3.interpolateZoom(huidig, doel);
      let om = false;
      svg.transition('zoom').duration(REDUCE ? 0 : Math.min(1600, i.duration * .8)).ease(d3.easeCubicInOut)
        .tween('zoom', () => t => {
          if (!om && t >= .5) { om = true; plaatsVoor(...kf(doel)); }
          labs.attr('opacity', Math.min(1, Math.abs(t - .5) * 4));
          huidig = i(t); pasToe(huidig);
        })
        .on('end interrupt', () => { labs.attr('opacity', 1); if (!om) plaatsVoor(...kf(huidig)); });
    }

    // aanklikken: de dichtstbijzijnde plaats binnen vingerbereik, ook als je net naast een symbool tikt
    svg.on('click', e => {
      const [x, y] = d3.pointer(e, g.node()), k = W / huidig[2], pxPerEenheid = schaal * k;
      let best = null, bd = Infinity;
      torens.forEach(t => { const d = Math.hypot(x - t.xy[0], y - t.xy[1]) - t.r * fNu; if (d < bd) { bd = d; best = t; } });
      if (best && bd * pxPerEenheid < (GROF ? 22 : 8)) klik(best.naam);
      else if (state.vast) { state.vast = false; paneel(); }
    });

    const mid = proj([5.875, 51.87]);
    let timer = null;
    const teller = () => overlay.select('.pk-teller');
    function speel() {
      state.gespeeld = true;
      if (timer) timer.stop();
      const volg = punten.slice().sort((a, b) => a.p.i - b.p.i);
      if (!volg.length) return;
      const stap = 2600 / volg.length, eerst = new Map();
      volg.forEach((d, i) => { d.i = i; if (!eerst.has(d.t.naam)) eerst.set(d.t.naam, i); });
      if (REDUCE) return;
      dots.interrupt().attr('opacity', 0); ringen.interrupt().attr('opacity', 0);
      halos.selectAll('circle').interrupt().attr('opacity', 0); lb.interrupt().attr('opacity', 0);
      volg.forEach(d => {
        d.el.transition().delay(400 + d.i * stap).duration(260).attr('opacity', 1)
          .on('start', () => {
            const k = W / huidig[2];
            flits.append('circle').attr('cx', d.t.xy[0] + (d.x - d.t.xy[0]) * fNu).attr('cy', d.t.xy[1] + (d.y - d.t.xy[1]) * fNu)
              .attr('r', 1).attr('fill', 'none').attr('stroke', C[d.p.groep]).attr('stroke-width', 1.4).attr('vector-effect', 'non-scaling-stroke')
              .transition().duration(700).attr('r', 18 * ss / k).attr('opacity', 0).remove();
          });
      });
      halos.selectAll('circle').transition().delay(t => 400 + eerst.get(t.naam) * stap).duration(600).attr('opacity', 1);
      ringen.transition().delay(400 + volg.length * stap).duration(400).attr('opacity', 1);
      lb.transition().delay(400 + volg.length * stap).duration(500).attr('opacity', 1);
      timer = d3.timer(e => {
        const n = Math.max(0, Math.min(volg.length, Math.floor((e - 400) / stap) + 1));
        teller().html(`<b>${n}</b> van ${volg.length}`);
        if (n >= volg.length) { timer.stop(); timer = null; teller().html(`<b>${volg.length}</b> ${volg.length === 1 ? 'project' : 'projecten'}`); }
      });
    }

    const ingezoomd = huidig[2] < W * .9;
    overlay.html(`<div class="pk-ov pk-ov-tl"><button type="button" class="pk-ovk" data-a="speel">Afspelen</button>` +
      `<button type="button" class="pk-ovk" data-a="nl" aria-pressed="${!ingezoomd}">Heel Nederland</button>` +
      `<button type="button" class="pk-ovk" data-a="regio" aria-pressed="${ingezoomd}">Rond Nijmegen</button></div>` +
      `<div class="pk-ov pk-ov-bl"><span class="pk-teller"><b>${punten.length}</b> ${punten.length === 1 ? 'project' : 'projecten'}</span></div>`);
    overlay.selectAll('.pk-ovk').on('click', function () {
      const a = this.dataset.a;
      if (a === 'speel') return speel();
      overlay.selectAll('[data-a=nl],[data-a=regio]').attr('aria-pressed', function () { return String(this.dataset.a === a); });
      zoom(a === 'nl' ? [W / 2, H / 2, W] : [mid[0], mid[1], 215]);
    });

    plaatsVoor(...kf(huidig));
    pasToe(huidig);
    // tot de kaart in beeld komt staan de projecten uit; daarna gaan ze een voor een aan
    if (!state.gespeeld) {
      dots.attr('opacity', 0); ringen.attr('opacity', 0); halos.selectAll('circle').attr('opacity', 0); lb.attr('opacity', 0);
    }
    kaart = {
      schaal, speel,
      markeer: () => pg.selectAll('.pk-pl').classed('actief', d => d.naam === state.gekozen),
      opruimen: () => { if (timer) timer.stop(); svg.interrupt('zoom'); svg.selectAll('*').interrupt(); }
    };
    if (!state.gespeeld && state.inBeeld) speel();
  }

  /* ---------------- Paneel, filters en lijst ---------------- */
  function kies(naam) {
    if (state.vast) return;
    state.gekozen = naam;
    markeer(); paneel();
  }
  function klik(naam, scroll) {
    if (state.vast && state.gekozen === naam) state.vast = false;
    else { state.gekozen = naam; state.vast = true; }
    markeer(); paneel();
    if (scroll !== false && SMAL.matches) naarPaneel();
  }
  function naarPaneel() {
    const r = $('pk-paneel').getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * .7) window.scrollTo({top: window.scrollY + r.top - 86, behavior: REDUCE ? 'auto' : 'smooth'});
  }
  function markeer() {
    if (kaart) kaart.markeer();
    document.querySelectorAll('.pk-plchip').forEach(b => b.classList.toggle('actief', b.dataset.p === state.gekozen));
  }
  function projectHtml(p) {
    const titel = p.titel || p.type;
    const sub = p.titel ? [p.type, p.type2].filter(Boolean).join(' · ') : (p.type2 || '');
    let h = `<article class="pk-proj"><div class="pk-pkop">${symSvg(p.groep)}<div class="pk-ptekst"><div class="pk-ptitel">${esc(titel)}</div>` +
      (sub ? `<div class="pk-psub">${esc(sub)}</div>` : '') + `</div>${p.loopt ? '<span class="pk-badge">Loopt nu</span>' : ''}</div>`;
    if (metFotos(p)) {
      h += `<div class="pk-fotos">${p.fotos.map(f => `<figure><img src="${esc(f.src)}" alt="" loading="lazy"><figcaption>${esc(f.bij)}</figcaption></figure>`).join('')}</div>`;
      if (p.lb) h += `<button type="button" class="pk-link" data-lb="${esc(p.lb)}">Bekijk de foto's groot</button>`;
      else if (p.anker) h += `<a class="pk-link" href="#${esc(p.anker)}">Lees het hele verhaal</a>`;
    } else h += `<p class="pk-geen">Geen foto's</p>`;
    return h + '</article>';
  }
  function paneel() {
    const el = $('pk-paneel'), naam = state.gekozen;
    if (!naam) {
      const met = P.filter(metFotos);
      el.innerHTML = `<h3>Met foto's</h3><p class="pk-leeg">Wijs een plaats aan op de kaart om te zien wat ik daar heb gedaan. Van deze ${telwoord(met.length)} projecten zijn foto's.</p>` +
        `<div class="pk-kaartjes">${met.map(p => `<button type="button" class="pk-kaartje" data-p="${esc(p.plaats)}"><img src="${esc(p.fotos[0].src)}" alt="" loading="lazy">` +
        `<span><b>${esc(p.titel || p.type)}</b><span>${esc(p.plaats)} · ${p.fotos.length} foto's</span></span></button>`).join('')}</div>`;
      return;
    }
    const alle = P.filter(p => p.plaats === naam), ps = alle.filter(p => state.aan.has(p.groep)).sort(volgorde);
    const weg = alle.length - ps.length;
    el.innerHTML = `<div class="pk-pkopregel"><h3>${esc(naam)}</h3><button type="button" class="pk-terug">Overzicht</button></div>` +
      `<p class="pk-ondert">${meervoud(ps.length)}${weg ? `, ${weg} weggefilterd` : ''}</p>` +
      (ps.length ? ps.map(projectHtml).join('') : '<p class="pk-leeg">Geen projecten in deze selectie.</p>');
  }
  $('pk-paneel').addEventListener('click', e => {
    const lbk = e.target.closest('[data-lb]'), pl = e.target.closest('[data-p]'), terug = e.target.closest('.pk-terug');
    if (lbk) { const d = $(lbk.dataset.lb); if (d && d.showModal) d.showModal(); }
    else if (pl) klik(pl.dataset.p);
    else if (terug) { state.gekozen = null; state.vast = false; markeer(); paneel(); }
  });

  function filters() {
    const f = $('pk-filters');
    f.innerHTML = GROEPEN.map(g => `<button type="button" class="pk-chip" data-g="${g.id}" aria-pressed="${state.aan.has(g.id)}">${symSvg(g.id)}${g.naam}<span class="pk-n">${P.filter(p => p.groep === g.id).length}</span></button>`).join('') +
      `<span class="pk-sep" aria-hidden="true"></span><button type="button" class="pk-chip pk-loopt" aria-pressed="${state.loopt}">` +
      `<svg class="pk-sym" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 1.8"/></svg>` +
      `Lopend werk uitlichten<span class="pk-n">${P.filter(p => p.loopt).length}</span></button>`;
  }
  $('pk-filters').addEventListener('click', e => {
    const b = e.target.closest('.pk-chip');
    if (!b) return;
    if (b.classList.contains('pk-loopt')) state.loopt = !state.loopt;
    else {
      const id = b.dataset.g;
      // er blijft altijd een soort aan, anders is de kaart leeg
      if (state.aan.has(id)) { if (state.aan.size > 1) state.aan.delete(id); } else state.aan.add(id);
    }
    filters(); teken(); paneel();
  });
  function plaatslijst() {
    $('pk-plchips').innerHTML = plaatsen(zicht()).map(t => `<button type="button" class="pk-plchip" data-p="${esc(t.naam)}">${esc(t.naam)}` +
      `<span class="pk-dots" aria-hidden="true">${t.ps.map(p => `<i style="background:var(--pk-${p.groep})"></i>`).join('')}</span><span class="pk-n">${t.ps.length}</span></button>`).join('');
  }
  $('pk-plchips').addEventListener('click', e => { const b = e.target.closest('.pk-plchip'); if (b) klik(b.dataset.p); });

  function melding(tekst) { $('pk-overlay').innerHTML = `<p class="pk-melding">${esc(tekst)}</p>`; }
  function teken() {
    if (window.d3) tekenKaart(zicht());
    else melding('De kaart kon niet worden geladen. De plaatsen staan hieronder.');
    plaatslijst(); markeer();
  }
  function tellers() {
    const n = {aantal: P.length, plaatsen: new Set(P.map(p => p.plaats)).size, foto: P.filter(metFotos).length};
    document.querySelectorAll('[data-pk]').forEach(s => { const v = n[s.dataset.pk]; if (v != null) s.textContent = s.dataset.pk === 'foto' ? telwoord(v) : v; });
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      state.inBeeld = true; io.disconnect();
      if (kaart && !state.gespeeld) kaart.speel();
    }), {threshold: .35});
    io.observe(stage);
  } else state.inBeeld = true;

  let rsTimer = null;
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(() => {
      if (!kaart) return;
      const b = stage.getBoundingClientRect(), s = Math.min(b.width / W, b.height / H);
      if (s && Math.abs(s - kaart.schaal) / kaart.schaal > .08) teken();
    }, 250);
  }).observe(stage);

  fetch('/data/projectenkaart.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      P = d.projecten.map((p, i) => Object.assign({i}, p)); G = d.geo; PL = d.plaatsen;
      tellers(); filters(); teken(); paneel();
    })
    .catch(() => melding('De kaart kon niet worden geladen.'));
})();
