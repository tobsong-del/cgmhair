/* CGM HAIR NEWS – page viewer on article pages, search/sort on the list page. Content is pre-built as HTML by _build/build.js. */
(function(){
  var lang=(document.documentElement.lang||'ko').slice(0,2);
  var COPIED={ko:'링크를 복사했어요.',en:'Link copied.',es:'Enlace copiado.'}[lang]||'Link copied.';
  /* viewer */
  document.querySelectorAll('.issue').forEach(function(a){
    var tr=a.querySelector('.track'); if(!tr) return;
    var sl=a.querySelectorAll('.slide'),n=sl.length,cnt=a.querySelector('.v-count b'),pv=a.querySelector('.v-prev'),nx=a.querySelector('.v-next'),th=a.querySelectorAll('.thumb'),cur=0;
    function go(i){i=Math.max(0,Math.min(n-1,i));tr.scrollTo({left:i*tr.clientWidth,behavior:'smooth'});}
    function upd(){cur=Math.round(tr.scrollLeft/tr.clientWidth);cnt.textContent=cur+1;pv.disabled=cur===0;nx.disabled=cur===n-1;th.forEach(function(t,j){t.setAttribute('aria-current',j===cur?'true':'false');});}
    tr.addEventListener('scroll',function(){window.requestAnimationFrame(upd);});
    pv.addEventListener('click',function(){go(cur-1);});nx.addEventListener('click',function(){go(cur+1);});
    tr.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){go(cur+1);e.preventDefault();}if(e.key==='ArrowLeft'){go(cur-1);e.preventDefault();}});
    th.forEach(function(t){t.addEventListener('click',function(){go(+t.getAttribute('data-go'));});});
    function zoom(){var im=sl[cur].querySelector('img'),z=document.getElementById('zoom'),zi=document.getElementById('zImg');if(!z)return;zi.src=im.src;zi.alt=im.alt;z.hidden=false;document.getElementById('zClose').focus();}
    var zb=a.querySelector('.v-zoom'); if(zb) zb.addEventListener('click',zoom);
    sl.forEach(function(s){s.querySelector('img').addEventListener('click',zoom);});
    var sh=a.querySelector('.share'); if(sh) sh.addEventListener('click',function(){var url=location.href.split('#')[0],msg=a.querySelector('.copied');try{navigator.clipboard.writeText(url).then(function(){msg.textContent=COPIED;},function(){msg.textContent=url;});}catch(e){msg.textContent=url;}});
    upd();
  });
  var z=document.getElementById('zoom');
  if(z){document.getElementById('zClose').addEventListener('click',function(){z.hidden=true;});
    z.addEventListener('click',function(e){if(e.target===z)z.hidden=true;});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!z.hidden)z.hidden=true;});}
  /* list: search + sort */
  var box=document.querySelector('.ncards'),q=document.getElementById('q'),so=document.getElementById('sort'),nr=document.getElementById('noResult');
  if(box&&q){
    q.addEventListener('input',function(){var v=q.value.trim().toLowerCase(),shown=0;box.querySelectorAll('.ncard').forEach(function(c){var ok=!v||c.getAttribute('data-text').toLowerCase().indexOf(v)>-1;c.hidden=!ok;if(ok)shown++;});if(nr)nr.hidden=shown>0;});
    if(so) so.addEventListener('change',function(){var arr=[].slice.call(box.querySelectorAll('.ncard'));arr.sort(function(x,y){var a=x.getAttribute('data-date'),b=y.getAttribute('data-date');return so.value==='new'?(a<b?1:-1):(a>b?1:-1);});arr.forEach(function(el){box.appendChild(el);});});
  }
})();
