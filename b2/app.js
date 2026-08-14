/* Vokabel B2 — Learn phase. Vanilla JS, offline, localStorage. */
(function(){
"use strict";
const DECK = window.DECK, LESSONS = [1,2,3,4];
const DAY = 86400000;
const INTERVAL = {1:1,2:2,3:4,4:8}; // days until due after a "know" that lands in box b
const MASTER_BOX = 5;
const $ = s => document.querySelector(s);

// ---------- storage ----------
const KEY = "vt_v1";
let store = load();
function load(){
  try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); }
  catch(e){ return fresh(); }
}
function fresh(){ return { cards:{}, streak:{count:0,last:null}, sound:true, enDefault:false, theme:null }; }
function save(){ localStorage.setItem(KEY, JSON.stringify(store)); }
const cid = (l,i) => l+"-"+i;
function cst(l,i){ return store.cards[cid(l,i)] || {box:0, due:0, seen:false}; }

// ---------- theme ----------
if(store.theme) document.documentElement.setAttribute("data-theme", store.theme);

// ---------- audio ----------
let actx=null, master=null;
function initAudio(){
  if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value=0.9; master.connect(actx.destination);
  }catch(e){} }
  if(actx && actx.state==="suspended") actx.resume().catch(()=>{});
}
// one voice: freq (+ optional glide), envelope, optional lowpass for warmth
function note(freq,start,dur,opt){
  if(!store.sound || !actx) return;
  opt = opt||{};
  const t = actx.currentTime + (start||0);
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = opt.type||"sine";
  o.frequency.setValueAtTime(freq, t);
  if(opt.glide) o.frequency.exponentialRampToValueAtTime(opt.glide, t+dur);
  let out = o;
  if(opt.filter){ const f=actx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=opt.filter; o.connect(f); out=f; }
  const peak = opt.peak==null?0.12:opt.peak;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t+(opt.attack||0.012));
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  out.connect(g); g.connect(master||actx.destination);
  o.start(t); o.stop(t+dur+0.03);
}
// bright rewarding rise: D5 · A5 · D6 with a shimmer + warm body  (the "ta-da-DAA")
const sKnow = ()=>{
  note(587.33, 0.00, 0.13, {type:"triangle", peak:0.13});
  note(880.00, 0.085,0.15, {type:"triangle", peak:0.13});
  note(1174.66,0.185,0.5,  {type:"triangle", peak:0.15});
  note(2349.32,0.185,0.42, {type:"sine",     peak:0.035});      // sparkle an octave up
  note(587.33, 0.185,0.5,  {type:"sine",     peak:0.05});       // warm body underneath
};
// soft, gentle "not yet" — muffled two-note fall, never harsh (E4 → A3)
const sAgain = ()=>{
  note(329.63, 0.00, 0.15, {type:"triangle", peak:0.10, filter:900});
  note(220.00, 0.11, 0.26, {type:"triangle", peak:0.11, filter:800, attack:0.02});
};
const sFlip = ()=> note(660, 0, 0.06, {type:"triangle", peak:0.05, filter:2200});
// little fanfare on session finish: C E G C rising + sparkle
const sDone = ()=>{
  [523.25,659.25,783.99,1046.5].forEach((f,i)=> note(f, i*0.10, 0.5, {type:"triangle", peak:0.11}));
  note(2093, 0.30, 0.5, {type:"sine", peak:0.04});
};
function buzz(ms){ if(navigator.vibrate) try{navigator.vibrate(ms);}catch(e){} }

// ---------- speech ----------
let voiceDE=null;
function pickVoice(){
  const vs = speechSynthesis.getVoices();
  voiceDE = vs.find(v=>/de[-_]/i.test(v.lang) && /google|deutsch|german/i.test(v.name))
         || vs.find(v=>/de[-_]/i.test(v.lang)) || null;
}
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text){
  if(!("speechSynthesis" in window)) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang="de-DE"; if(voiceDE) u.voice=voiceDE; u.rate=0.92; u.pitch=1;
    speechSynthesis.speak(u);
  }catch(e){}
}

// ---------- helpers ----------
function mainWord(w){ return (w.split(/[\s,\/]/)[0]||w).replace(/[.,!?;:]$/,""); }
function boldTarget(sentence, w){
  const stem = mainWord(w).replace(/[^A-Za-zÄÖÜäöüß]/g,"");
  if(stem.length<4) return escapeHtml(sentence);
  const pre = stem.slice(0, Math.max(4, stem.length-3));
  const re = new RegExp("(\\b[A-Za-zÄÖÜäöüß]*"+escapeRe(pre)+"[A-Za-zÄÖÜäöüß]*)", "i");
  const esc = escapeHtml(sentence);
  return esc.replace(re, "<b>$1</b>");
}
function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function genderClass(a){ if(!a) return "none"; if(a.indexOf("die")===0) return "die"; if(a.indexOf("das")===0) return "das"; if(a.indexOf("der")===0) return "der"; return "none"; }
function today(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/DAY); }

// ---------- home ----------
function lessonStats(l){
  const cards = DECK.lessons[l].cards; let mastered=0, due=0, fresh=0; const now=Date.now();
  cards.forEach((c,i)=>{ const s=cst(l,i);
    if(s.box>=MASTER_BOX) mastered++;
    else if(!s.seen) fresh++;
    else if(s.due<=now) due++;
  });
  return {total:cards.length, mastered, due, fresh};
}
function renderHome(){
  const list = $("#lessonList"); list.innerHTML="";
  LESSONS.forEach(l=>{
    const L = DECK.lessons[l]; if(!L) return;
    const st = lessonStats(l);
    const pct = Math.round(st.mastered/st.total*100);
    const el = document.createElement("button");
    el.className="lesson";
    el.innerHTML =
      '<div class="ring" style="--p:'+pct+'"><b>'+pct+'%</b></div>'+
      '<div style="flex:1; min-width:0">'+
        '<div class="num">LEKTION '+l+'</div>'+
        '<div class="t">'+L.title+'</div>'+
        '<div class="d">'+L.subtitle+'</div>'+
        '<div class="meta">'+
          '<span class="pill">'+st.total+' Wörter</span>'+
          (st.fresh?'<span class="pill new">'+st.fresh+' neu</span>':'')+
          (st.due?'<span class="pill due">'+st.due+' fällig</span>':'')+
          (st.mastered?'<span>'+st.mastered+' gemeistert</span>':'')+
        '</div>'+
      '</div>';
    el.onclick = ()=>{ initAudio(); openLesson(l); };
    list.appendChild(el);
  });
  const soon = document.createElement("div");
  soon.className = "soon";
  soon.innerHTML = '<span>🚧</span> Weitere Lektionen kommen bald';
  list.appendChild(soon);
  $("#streakN").textContent = store.streak.count||0;
}

// choose due vs all
function openLesson(l){
  const st = lessonStats(l);
  const hasWork = st.fresh+st.due>0;
  startSession(l, hasWork ? "due" : "all");
}

// ---------- session ----------
let S = null; // {lesson, queue:[idx], total, i, know, again, master, history:[]}
function startSession(lesson, mode){
  const cards = DECK.lessons[lesson].cards; const now=Date.now();
  let idxs = cards.map((c,i)=>i);
  if(mode==="due"){
    idxs = idxs.filter(i=>{ const s=cst(lesson,i); return !s.seen || (s.box<MASTER_BOX && s.due<=now); });
  } else {
    idxs = idxs.filter(i=>cst(lesson,i).box<MASTER_BOX);
    if(idxs.length===0) idxs = cards.map((c,i)=>i); // all mastered -> full review
  }
  // order: unseen first, then lower box, then earlier due
  idxs.sort((a,b)=>{
    const sa=cst(lesson,a), sb=cst(lesson,b);
    if(sa.seen!==sb.seen) return sa.seen?1:-1;
    if(sa.box!==sb.box) return sa.box-sb.box;
    return sa.due-sb.due;
  });
  if(idxs.length===0){ toast("Nichts zu lernen 🎉"); return; }
  S = { lesson, queue:idxs, total:idxs.length, done:0, know:0, again:0, master:0, history:[] };
  show("study");
  renderStack();
  updateProgress();
}
function updateProgress(){
  $("#count").textContent = S.done+"/"+S.total;
  $("#progBar").style.width = (S.total? (S.done/S.total*100):0)+"%";
  $("#undoBtn").style.visibility = S.history.length? "visible":"hidden";
}

function cardHTML(l,idx,top){
  const c = DECK.lessons[l].cards[idx];
  const g = genderClass(c.a);
  const posName = {n:"Nomen",v:"Verb",adj:"Adjektiv",phr:"Ausdruck"}[c.pos]||"";
  const isNoun = c.pos==="n" && c.a;
  const artq = isNoun ? '<div class="artq">der · die · das ?</div>' : '';
  const front =
    '<div class="face front">'+
      '<div class="chiprow">'+
        '<span class="chip sec">'+c.sec+'</span>'+
        '<span class="chip pos-'+c.pos+'">'+posName+(c.g&&c.pos!=="n"?' · '+c.g:'')+'</span>'+
        '<button class="spk" data-say="'+encodeURIComponent(mainWord(c.w)+" "+(c.w.replace(mainWord(c.w),"")))+'">🔊</button>'+
      '</div>'+
      '<div class="frontmid">'+
        '<div class="word">'+escapeHtml(c.pos==="n"? c.w : c.w)+'</div>'+
        artq+
      '</div>'+
      '<div class="hinttap" style="text-align:center">'+(isNoun?"Artikel raten · tippen zum Umdrehen":"Tippen zum Umdrehen")+'</div>'+
    '</div>';
  const emo = (window.EMOJI && window.EMOJI[c.w]) ? '<div class="b-emoji">'+window.EMOJI[c.w]+'</div>' : '';
  const artHtml = c.a ? '<span class="b-art g-'+g+'">'+c.a+'</span>' : '';
  const plHtml = (c.pl && c.pl!=="—") ? '<span class="b-plural">Pl.: '+c.pl+'</span>' : (c.pl==="—"?'<span class="b-plural">kein Pl.</span>':'');
  const noteHtml = c.g && c.pos==="n" ? '<div class="b-note">'+c.g+'</div>' : '';
  const back =
    '<div class="face back">'+
      '<div class="chiprow">'+
        '<span class="chip pos-'+c.pos+'">'+posName+'</span>'+
        '<button class="spk" data-say="'+encodeURIComponent((c.a?c.a+" ":"")+c.w)+'">🔊</button>'+
      '</div>'+
      emo+
      '<div class="b-head">'+artHtml+'<span class="b-word g-'+(c.a?g:'none')+'">'+escapeHtml(c.w)+'</span>'+plHtml+'</div>'+
      noteHtml+
      '<div class="def" data-de="'+encodeURIComponent(c.de)+'" data-en="'+encodeURIComponent(c.en)+'">'+escapeHtml(store.enDefault?c.en:c.de)+'</div>'+
      '<button class="toggle" data-toggle>'+(store.enDefault?"Auf Deutsch":"Show English")+'</button>'+
      '<div class="sentence"><span>'+boldTarget(c.s,c.w)+'</span>'+
        '<button class="mini" data-say="'+encodeURIComponent(c.s)+'">🔊</button></div>'+
      (c.c? '<div class="colloc">💬 <b>'+escapeHtml(c.c)+'</b></div>':'')+
    '</div>';
  return '<div class="card '+(top?'top':'behind')+'" data-idx="'+idx+'">'+
      '<div class="glow"></div>'+
      '<div class="stamp know">KANN ICH</div><div class="stamp again">NOCHMAL</div>'+
      '<div class="card-inner">'+front+back+'</div>'+
    '</div>';
}

function renderStack(){
  const stage = $("#stage"); stage.innerHTML="";
  const l = S.lesson;
  if(S.queue.length>1) stage.insertAdjacentHTML("beforeend", cardHTML(l, S.queue[1], false));
  if(S.queue.length>0) stage.insertAdjacentHTML("beforeend", cardHTML(l, S.queue[0], true));
  bindTop();
}

// ---------- top-card interaction ----------
let drag=null;
function bindTop(){
  const top = $("#stage .card.top"); if(!top) return;
  const inner = top.querySelector(".card-inner");
  // speak buttons
  top.querySelectorAll("[data-say]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); speak(decodeURIComponent(b.getAttribute("data-say")).trim());
  }));
  // toggle EN/DE
  const tg = top.querySelector("[data-toggle]");
  if(tg) tg.addEventListener("click",e=>{
    e.stopPropagation();
    store.enDefault = !store.enDefault; save();
    const def = top.querySelector(".def");
    def.textContent = decodeURIComponent(def.getAttribute(store.enDefault?"data-en":"data-de"));
    tg.textContent = store.enDefault?"Auf Deutsch":"Show English";
  });

  let startX,startY,moved,downT;
  const onDown=e=>{
    if(e.target.closest(".spk,.mini,.toggle")) return;
    const p=point(e); startX=p.x; startY=p.y; moved=false; downT=Date.now();
    drag={active:true}; top.style.transition="none";
    top.setPointerCapture&&e.pointerId!=null&&top.setPointerCapture(e.pointerId);
  };
  const onMove=e=>{
    if(!drag||!drag.active) return;
    const p=point(e); const dx=p.x-startX, dy=p.y-startY;
    if(Math.abs(dx)+Math.abs(dy)>8) moved=true;
    top.style.transform="translate("+dx+"px,"+dy*0.25+"px) rotate("+dx*0.05+"deg)";
    const k=Math.max(0,Math.min(1,dx/120)), a=Math.max(0,Math.min(1,-dx/120));
    top.querySelector(".stamp.know").style.opacity=k;
    top.querySelector(".stamp.again").style.opacity=a;
    const glow=top.querySelector(".glow");
    glow.style.opacity = Math.max(k,a)*0.5;
    glow.style.background = dx>0
      ? "radial-gradient(120% 90% at 100% 50%, color-mix(in srgb,var(--good) 55%,transparent), transparent)"
      : "radial-gradient(120% 90% at 0% 50%, color-mix(in srgb,var(--again) 55%,transparent), transparent)";
  };
  const onUp=e=>{
    if(!drag||!drag.active) return; drag.active=false;
    const p=point(e); const dx=p.x-startX, dy=p.y-startY;
    top.style.transition="";
    if(!moved || (Math.abs(dx)<10 && Math.abs(dy)<10 && Date.now()-downT<350)){
      flip(top); return;
    }
    if(dx>95){ fly(top,1); answer("know"); }
    else if(dx<-95){ fly(top,-1); answer("again"); }
    else { top.style.transform=""; top.querySelectorAll(".stamp").forEach(s=>s.style.opacity=0); top.querySelector(".glow").style.opacity=0; }
  };
  top.addEventListener("pointerdown",onDown);
  top.addEventListener("pointermove",onMove);
  top.addEventListener("pointerup",onUp);
  top.addEventListener("pointercancel",onUp);
}
function point(e){ return {x:e.clientX!=null?e.clientX:(e.touches&&e.touches[0].clientX), y:e.clientY!=null?e.clientY:(e.touches&&e.touches[0].clientY)}; }
function flip(top){ top.classList.toggle("flipped"); sFlip(); buzz(6); }
function fly(top,dir){
  top.style.transition="transform .32s ease-in";
  top.style.transform="translate("+dir*520+"px,-40px) rotate("+dir*18+"deg)";
}

// ---------- answer ----------
function answer(kind){
  const l=S.lesson, idx=S.queue[0];
  const prev = JSON.parse(JSON.stringify(store.cards[cid(l,idx)]||null));
  const s = Object.assign({box:0,due:0,seen:false}, store.cards[cid(l,idx)]||{});
  let mastered=false;
  if(kind==="know"){
    s.box = Math.min((s.box||0)+1, MASTER_BOX);
    s.seen=true;
    s.due = s.box>=MASTER_BOX ? Date.now()+INTERVAL[4]*DAY*2 : Date.now()+ (INTERVAL[s.box]||1)*DAY;
    if(s.box>=MASTER_BOX){ mastered=true; S.master++; }
    S.know++; sKnow(); buzz(12);
  } else {
    s.box=1; s.seen=true; s.due=Date.now();
    S.again++; sAgain(); buzz([8,20,8]);
  }
  store.cards[cid(l,idx)] = s;
  save();
  S.history.push({idx, prev});

  // update queue
  S.queue.shift();
  if(kind==="again"){
    const pos = Math.min(5, S.queue.length);
    S.queue.splice(pos,0,idx);   // comes back later this session
  } else {
    S.done++;
  }
  setTimeout(()=>{
    if(S.queue.length===0){ finish(); }
    else { renderStack(); updateProgress(); }
  }, kind==="again"?200:300);
  updateProgress();
}

function undo(){
  if(!S.history.length) return;
  const h = S.history.pop();
  // restore card state
  if(h.prev===null) delete store.cards[cid(S.lesson,h.idx)];
  else store.cards[cid(S.lesson,h.idx)] = h.prev;
  save();
  // remove one occurrence of idx if it was requeued, then put back on top
  const at = S.queue.lastIndexOf(h.idx);
  if(at>0) S.queue.splice(at,1);
  else if(S.done>0) S.done--; // was a "know"
  S.queue.unshift(h.idx);
  // recompute counters loosely
  renderStack(); updateProgress();
  toast("Rückgängig");
}

// ---------- finish ----------
function finish(){
  bumpStreak();
  $("#stKnow").textContent=S.know;
  $("#stAgain").textContent=S.again;
  $("#stMaster").textContent=S.master;
  const st=lessonStats(S.lesson);
  $("#doneTitle").textContent = st.mastered===st.total? "Lektion gemeistert! 🏆" : "Runde fertig!";
  $("#doneSub").textContent = st.mastered+" von "+st.total+" Wörtern gemeistert.";
  sDone();
  show("done");
}
function bumpStreak(){
  const t=today(), last=store.streak.last;
  if(last===t) {}
  else if(last && daysBetween(last,t)===1) store.streak.count++;
  else store.streak.count=1;
  store.streak.last=t; save();
}

// ---------- view switch ----------
function show(v){
  ["home","study","done"].forEach(x=>$("#"+x).classList.toggle("hidden", x!==v));
  if(v==="home") renderHome();
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),1600);
}

// ---------- buttons ----------
$("#backBtn").onclick = ()=>show("home");
$("#flipBtn").onclick = ()=>{ const top=$("#stage .card.top"); if(top) flip(top); };
$("#knowBtn").onclick = ()=>{ const top=$("#stage .card.top"); if(top){ if(!top.classList.contains("flipped")) flip(top); fly(top,1); answer("know"); } };
$("#againBtn").onclick= ()=>{ const top=$("#stage .card.top"); if(top){ if(!top.classList.contains("flipped")) flip(top); fly(top,-1); answer("again"); } };
$("#undoBtn").onclick = undo;
$("#soundBtn").onclick= ()=>{ store.sound=!store.sound; save(); $("#soundBtn").textContent=store.sound?"🔊":"🔇"; if(store.sound){initAudio(); sFlip();} };
$("#doneHome").onclick= ()=>show("home");
$("#doneAgain").onclick=()=>{ const l=S.lesson; startSession(l, lessonStats(l).fresh+lessonStats(l).due>0?"due":"all"); };
$("#themeBtn").onclick = ()=>{
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur==="dark"?"light":cur==="light"?null:"dark";
  if(next) document.documentElement.setAttribute("data-theme",next);
  else document.documentElement.removeAttribute("data-theme");
  store.theme=next; save();
};
$("#resetBtn").onclick = ()=>{
  if(confirm("Gesamten Lernfortschritt zurücksetzen?")){ store=fresh(); save(); renderHome(); toast("Zurückgesetzt"); }
};

// keyboard (desktop)
document.addEventListener("keydown",e=>{
  if($("#study").classList.contains("hidden")) return;
  const top=$("#stage .card.top"); if(!top) return;
  if(e.key==="ArrowRight"){ if(!top.classList.contains("flipped"))flip(top); fly(top,1); answer("know"); }
  else if(e.key==="ArrowLeft"){ if(!top.classList.contains("flipped"))flip(top); fly(top,-1); answer("again"); }
  else if(e.key===" "||e.key==="ArrowUp"){ e.preventDefault(); flip(top); }
});

$("#soundBtn").textContent = store.sound?"🔊":"🔇";
renderHome();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
})();
