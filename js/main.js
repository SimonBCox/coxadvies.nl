// sticky header
var nav=document.getElementById('navbar');
var onScroll=function(){nav.classList.toggle('scrolled',window.scrollY>12)};
onScroll();window.addEventListener('scroll',onScroll,{passive:true});

// before/after slider
(function(){
  var ba=document.getElementById('ba');if(!ba)return;
  var range=document.getElementById('ba-range');
  var imgVoor=document.getElementById('ba-voor');
  var imgNa=document.getElementById('ba-na');
  var set=function(){ba.style.setProperty('--pos',range.value+'%')};
  set();
  range.addEventListener('input',set);
  var tabs=document.querySelectorAll('.ba-tab');
  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      tabs.forEach(function(t){t.classList.remove('active')});
      tab.classList.add('active');
      imgVoor.src=tab.dataset.voor;
      imgNa.src=tab.dataset.na;
      range.value=50;set();
    });
  });
})();

// scroll reveal
(function(){
  var els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver'in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    els.forEach(function(e){e.classList.add('in')});return;
  }
  var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12});
  els.forEach(function(e){io.observe(e)});
})();
