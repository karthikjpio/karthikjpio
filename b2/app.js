/* Vokabel B2 — one adaptive session. Exercise type is driven by the word's box,
   not by a mode the user picks. Two axes per card:
     box  = passive/recognition mastery (flip, artikel, choice)
     abox = ACTIVE/productive mastery  (typing, produced in a Produktion task)
   A word only counts as fully mastered once it has been produced, not just recognised. */
(function(){
"use strict";
const DECK = window.DECK;
const LESSONS = Object.keys(DECK.lessons).map(Number).sort((a,b)=>a-b);
const DAY = 86400000;
const INTERVAL = {1:1,2:2,3:4,4:8};
const MASTER_BOX = 5;        // passive
const ACTIVE_MASTER = 2;     // produced correctly twice = active mastery
const SESSION_CAP = 15;      // a session you can actually finish
const NEW_PER_SESSION = 6;   // fresh words mixed into each session
const LOG_CAP = 4000;
const $ = s => document.querySelector(s);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- exam-format production prompts (Aufgabenerfüllung = the 4 bullets) ----------
const TASKS = {
1:{art:"Stellungnahme", q:"In einem Forum lesen Sie: „Allein lernen ist effektiver als in der Gruppe.“ Nehmen Sie Stellung.",
   pts:["Wie lernen Sie selbst am liebsten?","Ein Vorteil des Lernens in der Gruppe","Ein Nachteil des Lernens in der Gruppe","Ihr Fazit"]},
2:{art:"Kurzvortrag", q:"Halten Sie einen kurzen Vortrag: „Sollten Städte mehr Grünflächen schaffen?“",
   pts:["Die Situation in Großstädten heute","Ein konkretes Beispiel (z. B. Dachgarten)","Vor- und Nachteile","Ihre Meinung"]},
3:{art:"Beschwerde", q:"Sie haben eine Kamera bestellt. Zubehör fehlt und die Anleitung ist unvollständig. Schreiben Sie eine Beschwerde.",
   pts:["Grund des Schreibens (Bestellung, Datum)","Was genau fehlt bzw. defekt ist","Ihre Forderung","Frist und Schluss"]},
4:{art:"Erörterung", q:"Erörtern Sie: „Telemedizin ersetzt bald den Besuch beim Arzt.“",
   pts:["Was Telemedizin ermöglicht","Zwei Vorteile","Zwei Risiken (z. B. Daten)","Ihre abschließende Bewertung"]},
5:{art:"Stellungnahme", q:"In der Zeitung steht: „Gegen den Klimawandel kann der Einzelne nichts tun.“ Nehmen Sie Stellung.",
   pts:["Folgen des Klimawandels, die Sie kennen","Was der Einzelne tun kann","Was Politik/Industrie tun müssen","Ihr Fazit"]}
};

// ---------- storage ----------
const KEY = "vt_v1";
let store = load();
function fresh(){ return { v:2, cards:{}, log:[], daily:{}, streak:{count:0,last:null,best:0},
  sound:true, enDefault:false, theme:null, goal:20, seenIntro:false }; }
function load(){
  let s; try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if(!s) return fresh();
  s.log=s.log||[]; s.daily=s.daily||{}; s.cards=s.cards||{};
  s.streak=s.streak||{count:0,last:null,best:0};
  if(s.streak.best==null) s.streak.best=s.streak.count||0;
  if(s.goal==null) s.goal=20;
  if(s.v!==2) s = migrate(s);
  return s;
}
function migrate(s){
  const out={};
  Object.keys(s.cards).forEach(k=>{
    const m=/^(\d+)-(\d+)$/.exec(k);
    if(!m){ out[k]=s.cards[k]; return; }
    const L=DECK.lessons[+m[1]], c=L&&L.cards[+m[2]];
    if(c) out[cardId(+m[1],c)] = s.cards[k];
  });
  s.cards=out; s.v=2;
  try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
  return s;
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch(e){} }
function cardId(l,c){ return "L"+l+":"+c.sec+":"+c.w; }
function cidAt(l,i){ return cardId(l, DECK.lessons[l].cards[i]); }
function cst(l,i){ return Object.assign({box:0,due:0,seen:false,abox:0}, store.cards[cidAt(l,i)]||{}); }

// ---------- audio ----------
let actx=null, master=null;
function initAudio(){
  if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain(); master.gain.value=0.9; master.connect(actx.destination); }catch(e){} }
  if(actx && actx.state==="suspended") actx.resume().catch(()=>{});
}
function note(freq,start,dur,opt){
  if(!store.sound||!actx) return; opt=opt||{};
  const t=actx.currentTime+(start||0);
  const o=actx.createOscillator(), g=actx.createGain();
  o.type=opt.type||"sine"; o.frequency.setValueAtTime(freq,t);
  if(opt.glide) o.frequency.exponentialRampToValueAtTime(opt.glide,t+dur);
  let out=o;
  if(opt.filter){ const f=actx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=opt.filter; o.connect(f); out=f; }
  const peak=opt.peak==null?0.12:opt.peak;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+(opt.attack||0.012));
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  out.connect(g); g.connect(master||actx.destination); o.start(t); o.stop(t+dur+0.03);
}
const sKnow=()=>{ note(587.33,0,0.13,{type:"triangle",peak:0.13}); note(880,0.085,0.15,{type:"triangle",peak:0.13});
  note(1174.66,0.185,0.5,{type:"triangle",peak:0.15}); note(2349.32,0.185,0.42,{type:"sine",peak:0.035});
  note(587.33,0.185,0.5,{type:"sine",peak:0.05}); };
const sAgain=()=>{ note(329.63,0,0.15,{type:"triangle",peak:0.10,filter:900});
  note(220,0.11,0.26,{type:"triangle",peak:0.11,filter:800,attack:0.02}); };
const sFlip=()=>note(660,0,0.06,{type:"triangle",peak:0.05,filter:2200});
const sDone=()=>{ [523.25,659.25,783.99,1046.5].forEach((f,i)=>note(f,i*0.10,0.5,{type:"triangle",peak:0.11}));
  note(2093,0.30,0.5,{type:"sine",peak:0.04}); };
function buzz(ms){ if(navigator.vibrate) try{navigator.vibrate(ms);}catch(e){} }

// ---------- speech ----------
let voiceDE=null;
function pickVoice(){ const vs=speechSynthesis.getVoices();
  voiceDE = vs.find(v=>/de[-_]/i.test(v.lang)&&/google|deutsch|german/i.test(v.name)) || vs.find(v=>/de[-_]/i.test(v.lang)) || null; }
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; }
function speak(t){ if(!("speechSynthesis" in window))return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t);
    u.lang="de-DE"; if(voiceDE)u.voice=voiceDE; u.rate=0.92; speechSynthesis.speak(u); }catch(e){} }

// ---------- helpers ----------
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function mainWord(w){ return (w.split(/[\s,\/]/)[0]||w).replace(/[.,!?;:]$/,""); }
function stemOf(w){ const s=mainWord(w).replace(/[^A-Za-zÄÖÜäöüß]/g,""); return s.slice(0, Math.max(4, Math.ceil(s.length*0.65))); }
// Precision-first productive match: never credit a word the writer didn't produce.
// A token counts only if it is the target, the target + a noun inflection ending,
// or (for verbs) the verb stem + a regular conjugation ending. Avoids "Architektur"
// falsely matching "Architekt". Misses some irregular forms — acceptable, since a
// false credit corrupts active mastery while a missed credit is only mildly annoying.
const NOUN_SUF=["","e","en","er","es","em","n","s","ns","nen"];
const VERB_SUF=["en","n","e","st","t","et","te","ten","test","tet","tete","teten","ete","eten","etest","etet"];
function clean(w){ return mainWord(w).toLowerCase().replace(/[^a-zäöüß]/g,""); }
function tokenHits(tok, target){
  if(tok===target) return true;
  // noun-ish: target is the base, token = base + ending
  if(tok.length>target.length && tok.indexOf(target)===0 && NOUN_SUF.indexOf(tok.slice(target.length))>=0) return true;
  // reverse: token is the base, target = token + ending (e.g. wrote singular, target plural)
  if(target.length>tok.length && target.indexOf(tok)===0 && NOUN_SUF.indexOf(target.slice(tok.length))>=0 && tok.length>=4) return true;
  // verb: target infinitive -> stem, token = stem + conjugation
  if(/(en|n)$/.test(target)){
    const stem=target.replace(/e?n$/,"");
    if(stem.length>=4 && tok.indexOf(stem)===0 && VERB_SUF.indexOf(tok.slice(stem.length))>=0) return true;
  }
  return false;
}
function producedMatch(text, word){
  const target=clean(word);
  if(target.length<4) return false;
  const toks=text.toLowerCase().match(/[a-zäöüß]+/g)||[];
  for(const tk of toks){ if(tokenHits(tk,target)) return true; }
  return false;
}
function boldTarget(sentence,w){
  const stem=stemOf(w); const esc=escapeHtml(sentence);
  if(stem.length<4) return esc;
  return esc.replace(new RegExp("(\\b[A-Za-zÄÖÜäöüß]*"+escapeRe(stem)+"[A-Za-zÄÖÜäöüß]*)","i"),"<b>$1</b>");
}
function genderClass(a){ if(!a)return"none"; if(a.indexOf("die")===0)return"die"; if(a.indexOf("das")===0)return"das"; if(a.indexOf("der")===0)return"der"; return"none"; }
function norm(s){ return s.toLowerCase().trim().replace(/[.,!?;:]+$/,"")
  .replace(/ae/g,"ä").replace(/oe/g,"ö").replace(/ue/g,"ü").replace(/ss/g,"ß").replace(/\s+/g," "); }
const pad2=n=>(n<10?"0":"")+n;
function dayKey(ts){ const d=new Date(ts); return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function today(){ return dayKey(Date.now()); }
function daysBetween(a,b){ return Math.round((new Date(b+"T00:00")-new Date(a+"T00:00"))/DAY); }
function todayCount(){ return (store.daily[today()]||{}).n||0; }

// which exercise a word has earned
function modeFor(st, card){
  if(!st.seen || st.box<=1) return "flip";
  if(st.box<=3) return card.a && card.pos==="n" ? "artikel" : "choice";
  return "type";                       // production: feeds the active axis
}

// ---------- stats helpers ----------
function lessonStats(l){
  const cards=DECK.lessons[l].cards; let mastered=0,due=0,fresh_=0,active=0; const now=Date.now();
  cards.forEach((c,i)=>{ const s=cst(l,i);
    if(s.abox>=ACTIVE_MASTER) active++;
    if(s.box>=MASTER_BOX) mastered++;
    else if(!s.seen) fresh_++;
    else if(s.due<=now) due++;
  });
  return {total:cards.length, mastered, due, fresh:fresh_, active};
}

// ---------- home ----------
function renderHome(){
  const list=$("#lessonList"); list.innerHTML="";
  LESSONS.forEach(l=>{
    const L=DECK.lessons[l]; if(!L) return;
    const st=lessonStats(l);
    const pct=Math.round(st.mastered/st.total*100);
    const el=document.createElement("button");
    el.className="lesson";
    el.innerHTML =
      '<div class="ring" style="--p:'+pct+'"><b>'+pct+'%</b></div>'+
      '<div style="flex:1; min-width:0">'+
        '<div class="num">LEKTION '+l+'</div>'+
        '<div class="t">'+escapeHtml(L.title)+'</div>'+
        '<div class="d">'+escapeHtml(L.subtitle)+'</div>'+
        '<div class="meta">'+
          '<span class="pill">'+st.total+' Wörter</span>'+
          (st.fresh?'<span class="pill new">'+st.fresh+' neu</span>':'')+
          (st.due?'<span class="pill due">'+st.due+' fällig</span>':'')+
          (st.active?'<span class="pill act">'+st.active+' aktiv</span>':'')+
        '</div>'+
      '</div>';
    el.onclick=()=>{ initAudio(); startSession(l); };
    list.appendChild(el);
  });
  const soon=document.createElement("div");
  soon.className="soon";
  soon.innerHTML='<span>🚧</span> Weitere Lektionen kommen bald';
  list.appendChild(soon);
  // daily goal
  const n=todayCount(), goal=store.goal||20, gp=Math.min(100, Math.round(n/goal*100));
  $("#goalRing").style.setProperty("--p", gp);
  $("#goalN").textContent = n;
  $("#goalTxt").innerHTML = n>=goal
    ? '<b>Tagesziel geschafft!</b> 🎉<span>'+n+' von '+goal+' Karten</span>'
    : '<b>Heute: '+n+' / '+goal+'</b><span>'+(goal-n)+' Karten bis zum Ziel</span>';
  $("#streakN").textContent = store.streak.count||0;
}

// ---------- session ----------
let S=null;
function startSession(lesson){
  const cards=DECK.lessons[lesson].cards, now=Date.now();
  const due=[], fresh_=[];
  cards.forEach((c,i)=>{
    const s=cst(lesson,i);
    if(!s.seen) fresh_.push(i);
    else if(s.box<MASTER_BOX && s.due<=now) due.push(i);
    else if(s.box>=MASTER_BOX && s.abox<ACTIVE_MASTER && s.due<=now) due.push(i); // recognised but never produced
  });
  due.sort((a,b)=>cst(lesson,a).box-cst(lesson,b).box);
  let queue = due.slice(0, Math.max(0, SESSION_CAP-Math.min(NEW_PER_SESSION,fresh_.length)))
                 .concat(fresh_.slice(0, NEW_PER_SESSION));
  if(!queue.length) queue = fresh_.slice(0,SESSION_CAP);
  if(!queue.length){                        // nothing due: offer a light refresh round
    queue = cards.map((c,i)=>i).filter(i=>cst(lesson,i).abox<ACTIVE_MASTER).slice(0,SESSION_CAP);
  }
  if(!queue.length){ toast("Lektion komplett gemeistert 🏆"); return; }
  // interleave new words among reviews so a session never front-loads all the hard ones
  queue = queue.map((v,i)=>({v,k:(i*7919)%queue.length})).sort((a,b)=>a.k-b.k).map(o=>o.v);
  S={lesson, queue, total:queue.length, done:0, right:0, wrong:0, produced:0, history:[], usedWords:[]};
  show("study"); next();
}
function updateProgress(){
  const dots=[];
  for(let i=0;i<S.total;i++) dots.push('<i class="'+(i<S.done?"on":(i===S.done?"cur":""))+'"></i>');
  $("#dots").innerHTML=dots.join("");
  $("#count").textContent=S.done+"/"+S.total;
}
function next(){
  if(!S.queue.length) return finishSession();
  updateProgress();
  const l=S.lesson, idx=S.queue[0], c=DECK.lessons[l].cards[idx], st=cst(l,idx);
  const mode=modeFor(st,c);
  S.mode=mode;
  const stage=$("#stage"); stage.innerHTML="";
  if(mode==="flip") renderFlip(stage,l,idx,c);
  else if(mode==="artikel") renderArtikel(stage,l,idx,c);
  else if(mode==="choice") renderChoice(stage,l,idx,c);
  else renderType(stage,l,idx,c);
  $("#swipehints").classList.toggle("hidden", mode!=="flip");
  $("#flipActions").classList.toggle("hidden", mode!=="flip");
}

// --- exercise 1: flashcard (box 0-1) ---
function renderFlip(stage,l,idx,c){
  const g=genderClass(c.a), posName={n:"Nomen",v:"Verb",adj:"Adjektiv",phr:"Ausdruck",adv:"Adverb"}[c.pos]||"";
  const isNoun=c.pos==="n"&&c.a;
  const emo=(window.EMOJI&&window.EMOJI[c.w])?'<div class="b-emoji">'+window.EMOJI[c.w]+'</div>':'';
  const plHtml=(c.pl&&c.pl!=="—")?'<span class="b-plural">Pl.: '+escapeHtml(c.pl)+'</span>'
    :(c.pl==="—"?'<span class="b-plural">kein Pl.</span>':'');
  stage.innerHTML =
  '<div class="card top" data-idx="'+idx+'">'+
    '<div class="glow"></div>'+
    '<div class="stamp know">KANN ICH</div><div class="stamp again">NOCHMAL</div>'+
    '<div class="card-inner">'+
      '<div class="face front">'+
        '<div class="chiprow"><span class="chip sec">'+c.sec+'</span>'+
          '<span class="chip pos-'+c.pos+'">'+posName+'</span>'+
          '<button class="spk" data-say="'+encodeURIComponent(c.w)+'">🔊</button></div>'+
        '<div class="frontmid"><div class="word">'+escapeHtml(c.w)+'</div>'+
          (isNoun?'<div class="artq">der · die · das ?</div>':'')+'</div>'+
        '<div class="hinttap">'+(isNoun?"Artikel raten · tippen zum Umdrehen":"Tippen zum Umdrehen")+'</div>'+
      '</div>'+
      '<div class="face back">'+
        '<div class="chiprow"><span class="chip pos-'+c.pos+'">'+posName+'</span>'+
          '<button class="spk" data-say="'+encodeURIComponent((c.a?c.a+" ":"")+c.w)+'">🔊</button></div>'+
        emo+
        '<div class="b-head">'+(c.a?'<span class="b-art g-'+g+'">'+c.a+'</span>':'')+
          '<span class="b-word g-'+(c.a?g:'none')+'">'+escapeHtml(c.w)+'</span>'+plHtml+'</div>'+
        '<div class="sentence"><span>'+boldTarget(c.s,c.w)+'</span>'+
          '<button class="mini" data-say="'+encodeURIComponent(c.s)+'">🔊</button></div>'+
        '<div class="def" data-de="'+encodeURIComponent(c.de)+'" data-en="'+encodeURIComponent(c.en)+'">'+
          escapeHtml(store.enDefault?c.en:c.de)+'</div>'+
        '<button class="toggle" data-toggle>'+(store.enDefault?"Auf Deutsch":"Show English")+'</button>'+
        (c.c?'<div class="colloc">💬 <b>'+escapeHtml(c.c)+'</b></div>':'')+
      '</div>'+
    '</div>'+
  '</div>';
  bindCommon(stage);
  bindSwipe(stage.querySelector(".card"));
}

// --- exercise 2: tap the article (box 2-3, nouns) ---
function renderArtikel(stage,l,idx,c){
  stage.innerHTML =
  '<div class="card top ex"><div class="exwrap">'+
    '<div class="chiprow"><span class="chip sec">'+c.sec+'</span>'+
      '<span class="chip q">Artikel</span>'+
      '<button class="spk" data-say="'+encodeURIComponent(c.w)+'">🔊</button></div>'+
    '<div class="exmid"><div class="word">'+escapeHtml(c.w)+'</div>'+
      '<div class="exq">Welcher Artikel?</div></div>'+
    '<div class="opts three">'+
      ['der','die','das'].map(a=>'<button class="opt art-'+a+'" data-a="'+a+'">'+a+'</button>').join("")+
    '</div>'+
    '<div class="reveal"></div>'+
  '</div></div>';
  bindCommon(stage);
  const want=(c.a||"").split(" ")[0].trim();
  stage.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    const ok = b.dataset.a===want;
    stage.querySelectorAll(".opt").forEach(x=>{
      x.disabled=true;
      if(x.dataset.a===want) x.classList.add("right");
      else if(x===b) x.classList.add("wrong");
    });
    revealAnswer(stage,c,ok);
    grade(ok,false);
  });
}

// --- exercise 3: meaning -> word (box 2-3, non-nouns) ---
function renderChoice(stage,l,idx,c){
  const pool=DECK.lessons[l].cards.filter(x=>x.w!==c.w && x.pos===c.pos);
  const picks=[]; const used={};
  while(picks.length<3 && pool.length){
    const k=(idx*31+picks.length*17+picks.length*picks.length)%pool.length;
    const cand=pool[k];
    if(!used[cand.w]){ used[cand.w]=1; picks.push(cand); }
    else pool.splice(k,1);
  }
  const opts=picks.map(p=>p.w).concat([c.w]);
  for(let i=opts.length-1;i>0;i--){ const j=(idx+i*7)%(i+1); const t=opts[i]; opts[i]=opts[j]; opts[j]=t; }
  stage.innerHTML =
  '<div class="card top ex"><div class="exwrap">'+
    '<div class="chiprow"><span class="chip sec">'+c.sec+'</span><span class="chip q">Bedeutung</span></div>'+
    '<div class="exmid"><div class="exdef">'+escapeHtml(c.de)+'</div>'+
      '<div class="exq">Welches Wort passt?</div></div>'+
    '<div class="opts">'+opts.map(o=>'<button class="opt" data-w="'+escapeHtml(o)+'">'+escapeHtml(o)+'</button>').join("")+'</div>'+
    '<div class="reveal"></div>'+
  '</div></div>';
  bindCommon(stage);
  stage.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    const ok=b.dataset.w===c.w;
    stage.querySelectorAll(".opt").forEach(x=>{ x.disabled=true;
      if(x.dataset.w===c.w) x.classList.add("right"); else if(x===b) x.classList.add("wrong"); });
    revealAnswer(stage,c,ok);
    grade(ok,false);
  });
}

// --- exercise 4: type it (box 4+) -> ACTIVE axis ---
function renderType(stage,l,idx,c){
  const isNoun=c.pos==="n"&&c.a;
  stage.innerHTML =
  '<div class="card top ex"><div class="exwrap">'+
    '<div class="chiprow"><span class="chip sec">'+c.sec+'</span><span class="chip q prod">Produktion</span></div>'+
    '<div class="exmid"><div class="exdef">'+escapeHtml(c.de)+'</div>'+
      '<div class="exhint">'+escapeHtml(c.en)+'</div>'+
      '<div class="exq">'+(isNoun?"Mit Artikel schreiben":"Wort schreiben")+'</div></div>'+
    '<form class="typerow" autocomplete="off"><input class="tin" type="text" '+
      'autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="'+(isNoun?"z. B. der …":"…")+'">'+
      '<button class="tgo" type="submit">✓</button></form>'+
    '<button class="skip" data-skip>Weiß ich nicht</button>'+
    '<div class="reveal"></div>'+
  '</div></div>';
  bindCommon(stage);
  const inp=stage.querySelector(".tin");
  setTimeout(()=>{ try{inp.focus();}catch(e){} },80);
  stage.querySelector("[data-skip]").onclick=()=>{ showTyped(stage,c,false,false); grade(false,true); };
  stage.querySelector(".typerow").onsubmit=e=>{
    e.preventDefault();
    const v=norm(inp.value); if(!v) return;
    const wordOk = norm(mainWord(c.w))===v || v.endsWith(" "+norm(mainWord(c.w))) || norm(c.w)===v;
    let artOk=true;
    if(isNoun){ const want=norm((c.a||"").split(" ")[0]); artOk = v.indexOf(want+" ")===0; }
    showTyped(stage,c,wordOk,artOk);
    grade(wordOk,true,{artOk});
  };
}
function showTyped(stage,c,ok,artOk){
  stage.querySelector(".typerow").classList.add(ok?"ok":"bad");
  stage.querySelector(".tin").disabled=true;
  const s=stage.querySelector("[data-skip]"); if(s) s.style.display="none";
  revealAnswer(stage,c,ok, ok&&!artOk?"Wort richtig, Artikel prüfen:":null);
}
function revealAnswer(stage,c,ok,extra){
  const g=genderClass(c.a);
  const emo=(window.EMOJI&&window.EMOJI[c.w])?window.EMOJI[c.w]+" ":"";
  stage.querySelector(".reveal").innerHTML =
    '<div class="rv '+(ok?"ok":"bad")+'">'+
      (extra?'<div class="rvnote">'+escapeHtml(extra)+'</div>':'')+
      '<div class="rvw">'+emo+(c.a?'<span class="g-'+g+'">'+c.a+'</span> ':'')+escapeHtml(c.w)+'</div>'+
      '<div class="rvs">'+boldTarget(c.s,c.w)+'</div>'+
      '<button class="rvspk" data-say="'+encodeURIComponent(c.s)+'">🔊 anhören</button>'+
      '<button class="rvnext">Weiter →</button>'+
    '</div>';
  stage.querySelectorAll("[data-say]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); speak(decodeURIComponent(b.dataset.say)); });
  const nx=stage.querySelector(".rvnext");
  nx.onclick=()=>advance();
  setTimeout(()=>{ try{nx.focus();}catch(e){} },50);
}
function bindCommon(stage){
  stage.querySelectorAll("[data-say]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); speak(decodeURIComponent(b.dataset.say)); });
  const tg=stage.querySelector("[data-toggle]");
  if(tg) tg.onclick=e=>{ e.stopPropagation();
    store.enDefault=!store.enDefault; save();
    const d=stage.querySelector(".def");
    d.textContent=decodeURIComponent(d.getAttribute(store.enDefault?"data-en":"data-de"));
    tg.textContent=store.enDefault?"Auf Deutsch":"Show English"; };
}

// ---------- swipe (flip mode only) ----------
function bindSwipe(card){
  if(!card) return;
  let sx,sy,moved,t0,active=false;
  card.addEventListener("pointerdown",e=>{
    if(e.target.closest(".spk,.mini,.toggle")) return;
    sx=e.clientX; sy=e.clientY; moved=false; t0=Date.now(); active=true; card.style.transition="none";
  });
  card.addEventListener("pointermove",e=>{
    if(!active) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>8) moved=true;
    card.style.transform="translate("+dx+"px,"+dy*0.25+"px) rotate("+dx*0.05+"deg)";
    const k=Math.max(0,Math.min(1,dx/120)), a=Math.max(0,Math.min(1,-dx/120));
    card.querySelector(".stamp.know").style.opacity=k;
    card.querySelector(".stamp.again").style.opacity=a;
    const gl=card.querySelector(".glow");
    gl.style.opacity=Math.max(k,a)*0.5;
    gl.style.background = dx>0
      ? "radial-gradient(120% 90% at 100% 50%, color-mix(in srgb,var(--good) 55%,transparent), transparent)"
      : "radial-gradient(120% 90% at 0% 50%, color-mix(in srgb,var(--again) 55%,transparent), transparent)";
  });
  const end=e=>{
    if(!active) return; active=false;
    const dx=(e.clientX||sx)-sx, dy=(e.clientY||sy)-sy;
    card.style.transition="";
    if(!moved || (Math.abs(dx)<10&&Math.abs(dy)<10&&Date.now()-t0<350)){ flip(card); return; }
    if(dx>95){ fly(card,1); grade(true,false); }
    else if(dx<-95){ fly(card,-1); grade(false,false); }
    else { card.style.transform=""; card.querySelectorAll(".stamp").forEach(s=>s.style.opacity=0); card.querySelector(".glow").style.opacity=0; }
  };
  card.addEventListener("pointerup",end); card.addEventListener("pointercancel",end);
}
function flip(card){ card.classList.toggle("flipped"); sFlip(); buzz(6); }
function fly(card,dir){
  if(REDUCED){ card.style.opacity=0; return; }
  card.style.transition="transform .32s ease-in";
  card.style.transform="translate("+dir*520+"px,-40px) rotate("+dir*18+"deg)";
}

// ---------- grading ----------
// productive=true means the answer required producing the word -> active axis
function grade(ok, productive, opt){
  opt=opt||{};
  const l=S.lesson, idx=S.queue[0], id=cidAt(l,idx);
  const prev=JSON.parse(JSON.stringify(store.cards[id]||null));
  const s=Object.assign({box:0,due:0,seen:false,abox:0}, store.cards[id]||{});
  if(ok){
    s.box=Math.min((s.box||0)+1,MASTER_BOX); s.seen=true;
    s.due = s.box>=MASTER_BOX ? Date.now()+INTERVAL[4]*DAY*2 : Date.now()+(INTERVAL[s.box]||1)*DAY;
    if(productive && opt.artOk!==false){ s.abox=(s.abox||0)+1; S.produced++; }
    S.right++; sKnow(); buzz(12);
  } else {
    s.box=1; s.seen=true; s.due=Date.now();
    if(productive) s.abox=Math.max(0,(s.abox||0)-1);
    S.wrong++; sAgain(); buzz([8,20,8]);
  }
  store.cards[id]=s;
  logReview(id, ok);
  save();
  S.history.push({idx,prev});
  S.lastWord = DECK.lessons[l].cards[idx].w;
  if(S.mode==="flip") setTimeout(advance, ok?300:200);
}
function advance(){
  const l=S.lesson, idx=S.queue.shift();
  const st=cst(l,idx);
  // a missed word comes back later in the same session
  if(st.box<=1 && S.queue.length){ S.queue.splice(Math.min(4,S.queue.length),0,idx); }
  else S.done++;
  if(S.mode!=="flip") showUndoToast();
  if(!S.queue.length) finishSession(); else next();
}

// ---------- history ----------
function logReview(id, ok){
  const d=today();
  store.log.push({i:id,r:ok?1:0,t:Date.now()});
  if(store.log.length>LOG_CAP) store.log.splice(0,store.log.length-LOG_CAP);
  const day=store.daily[d]||(store.daily[d]={n:0,k:0,a:0,m:0});
  day.n++; ok?day.k++:day.a++;
}
function undo(){
  if(!S||!S.history.length) return;
  const h=S.history.pop(), id=cidAt(S.lesson,h.idx);
  if(h.prev===null) delete store.cards[id]; else store.cards[id]=h.prev;
  for(let i=store.log.length-1;i>=0;i--){
    if(store.log[i].i===id){
      const e=store.log.splice(i,1)[0], k=dayKey(e.t), day=store.daily[k];
      if(day){ day.n--; e.r?day.k--:day.a--; if(day.n<=0) delete store.daily[k]; }
      break;
    }
  }
  const at=S.queue.lastIndexOf(h.idx);
  if(at>0) S.queue.splice(at,1); else if(S.done>0) S.done--;
  S.queue.unshift(h.idx);
  save(); next(); toast("Rückgängig");
}
let toastT=null;
function showUndoToast(){
  const t=$("#toast");
  t.innerHTML='<span>'+escapeHtml(S.lastWord||"")+'</span><button id="undoT">Rückgängig</button>';
  t.classList.add("show","act");
  $("#undoT").onclick=()=>{ t.classList.remove("show","act"); undo(); };
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show","act"),2600);
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show"); t.classList.remove("act");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1600);
}

// ---------- finish + Produktion capstone ----------
function finishSession(){
  bumpStreak();
  const st=lessonStats(S.lesson);
  $("#stRight").textContent=S.right;
  $("#stWrong").textContent=S.wrong;
  $("#stProd").textContent=S.produced;
  $("#doneTitle").textContent = st.mastered===st.total ? "Lektion gemeistert! 🏆" : "Runde fertig!";
  $("#doneSub").textContent = st.mastered+" von "+st.total+" Wörtern erkannt · "+st.active+" aktiv beherrscht";
  const n=todayCount(), goal=store.goal||20;
  $("#doneGoal").innerHTML = n>=goal
    ? '<div class="goalhit">🎯 Tagesziel erreicht ('+n+'/'+goal+')</div>'
    : '<div class="goalbar"><i style="width:'+Math.min(100,n/goal*100)+'%"></i></div><span>'+n+' / '+goal+' heute</span>';
  sDone(); show("done");
}
function bumpStreak(){
  const t=today(), last=store.streak.last;
  if(last===t){} else if(last && daysBetween(last,t)===1) store.streak.count++; else store.streak.count=1;
  store.streak.last=t;
  if(store.streak.count>(store.streak.best||0)) store.streak.best=store.streak.count;
  save();
}

// Produktion: exam-format task. Target words are auto-detected in what you write,
// so producing them credits the ACTIVE axis with no backend and no self-scoring.
let P=null;
function startProduktion(lesson){
  const T=TASKS[lesson]; if(!T){ toast("Keine Aufgabe für diese Lektion"); return; }
  const cards=DECK.lessons[lesson].cards;
  // target words: ones you recognise but have not produced yet
  const targets=[];
  cards.forEach((c,i)=>{ const s=cst(lesson,i);
    if(s.seen && s.abox<ACTIVE_MASTER) targets.push({i,c,box:s.box}); });
  targets.sort((a,b)=>b.box-a.box);
  const pick=targets.slice(0,6);
  if(!pick.length){ toast("Lerne erst ein paar Wörter 🙂"); return; }
  P={lesson, targets:pick, start:Date.now()};
  $("#pTaskType").textContent=T.art;
  $("#pQ").textContent=T.q;
  $("#pPts").innerHTML=T.pts.map(p=>'<li>'+escapeHtml(p)+'</li>').join("");
  $("#pWords").innerHTML=pick.map(t=>'<span class="tw" data-w="'+escapeHtml(t.c.w)+'">'+
      ((window.EMOJI&&window.EMOJI[t.c.w])?window.EMOJI[t.c.w]+" ":"")+
      (t.c.a?'<i>'+t.c.a+'</i> ':'')+escapeHtml(t.c.w)+'</span>').join("");
  $("#pText").value=""; $("#pText").disabled=false;
  $("#pResult").innerHTML=""; $("#pGo").classList.remove("hidden"); $("#pWc").textContent="0 Wörter";
  show("prod");
  setTimeout(()=>{ try{$("#pText").focus();}catch(e){} },120);
}
function checkProduktion(){
  const txt=$("#pText").value;
  let hit=0;
  P.targets.forEach(t=>{
    const found = producedMatch(txt, t.c.w);
    const el=$("#pWords").querySelector('[data-w="'+CSS.escape(t.c.w)+'"]');
    if(el) el.classList.add(found?"used":"missed");
    if(found){
      hit++;
      const id=cardId(P.lesson,t.c);
      const s=Object.assign({box:0,due:0,seen:false,abox:0}, store.cards[id]||{});
      s.abox=(s.abox||0)+1; s.seen=true;
      s.box=Math.max(s.box, 4);            // producing it proves recognition too
      store.cards[id]=s;
    }
  });
  const words=(txt.trim().match(/\S+/g)||[]).length;
  save();
  $("#pText").disabled=true; $("#pGo").classList.add("hidden");
  const missed=P.targets.length-hit;
  $("#pResult").innerHTML =
    '<div class="pres">'+
      '<div class="presn"><b>'+hit+'</b> von '+P.targets.length+' Zielwörtern benutzt · '+words+' Wörter geschrieben</div>'+
      (missed? '<div class="presm">Diese kanntest du, hast sie aber nicht benutzt. Genau da sitzt die Lücke zwischen Verstehen und Sprechen.</div>'
             : '<div class="presg">Alle Zielwörter aktiv benutzt. Genau so wächst aktiver Wortschatz. 🎉</div>')+
      '<div class="prestips"><b>Denk an die Bewertung:</b> alle vier Stichpunkte abdecken (Aufgabenerfüllung) und mit Konnektoren verbinden (Kohärenz). Daran scheitern die meisten, nicht am Wortschatz.</div>'+
      '<button class="btn-primary" id="pDone">Fertig</button>'+
    '</div>';
  if(hit) sDone();
  $("#pDone").onclick=()=>show("home");
}

// ---------- stats ----------
function overallStats(){
  let total=0,mastered=0,learning=0,fresh_=0,due=0,active=0; const per=[];
  LESSONS.forEach(l=>{ const st=lessonStats(l);
    total+=st.total; mastered+=st.mastered; fresh_+=st.fresh; due+=st.due; active+=st.active;
    learning+=st.total-st.mastered-st.fresh;
    per.push(Object.assign({l,title:DECK.lessons[l].title},st));
  });
  let k=0,a=0,n=0;
  Object.keys(store.daily).forEach(d=>{const x=store.daily[d]; n+=x.n; k+=x.k; a+=x.a;});
  return {total,mastered,learning,fresh:fresh_,due,active,per,reviews:n,know:k,again:a,
    acc:n?Math.round(k/n*100):0, days:Object.keys(store.daily).length};
}
function heatmapDays(weeks){
  const out=[], now=new Date(); now.setHours(12,0,0,0);
  const end=new Date(now); end.setDate(end.getDate()+(6-((end.getDay()+6)%7)));
  const start=new Date(end); start.setDate(start.getDate()-(weeks*7-1));
  for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1))
    out.push({key:dayKey(d.getTime()), n:(store.daily[dayKey(d.getTime())]||{}).n||0, future:d>now});
  return out;
}
function renderStats(){
  const s=overallStats();
  $("#stStreak").textContent=store.streak.count||0;
  $("#stBest").textContent=store.streak.best||0;
  $("#stMastered").textContent=s.mastered;
  $("#stTotalW").textContent=s.total;
  $("#stReviews").textContent=s.reviews;
  $("#stAcc").textContent=s.acc+"%";
  $("#stDays").textContent=s.days;
  $("#stActive").textContent=s.active;
  const pct=s.total?Math.round(s.mastered/s.total*100):0;
  $("#stRing").style.setProperty("--p",pct);
  $("#stRingN").textContent=pct+"%";
  const apct=s.total?Math.round(s.active/s.total*100):0;
  $("#stBreak").innerHTML=
    '<div class="axis"><span>Passiv (erkennen)</span><b>'+pct+'%</b></div>'+
    '<div class="bar"><i class="seg mastered" style="width:'+pct+'%"></i></div>'+
    '<div class="axis"><span>Aktiv (produzieren)</span><b>'+apct+'%</b></div>'+
    '<div class="bar"><i class="seg active" style="width:'+apct+'%"></i></div>'+
    '<div class="axisnote">Aktiv zählt nur, was du selbst geschrieben hast.</div>';
  const days=heatmapDays(18), max=Math.max(4,...days.map(d=>d.n));
  $("#stHeat").innerHTML=days.map(d=>{
    if(d.future) return '<i class="hc future"></i>';
    const lvl=d.n===0?0:d.n<=max*0.25?1:d.n<=max*0.5?2:d.n<=max*0.75?3:4;
    return '<i class="hc l'+lvl+'" title="'+d.key+': '+d.n+'"></i>';
  }).join("");
  $("#stLessons").innerHTML=s.per.map(p=>{
    const pc=Math.round(p.mastered/p.total*100), ac=Math.round(p.active/p.total*100);
    return '<div class="lrow"><div class="lrow-t"><span>L'+p.l+' · '+escapeHtml(p.title)+'</span><b>'+pc+'% / '+ac+'%</b></div>'+
      '<div class="bar"><i class="seg mastered" style="width:'+pc+'%"></i></div>'+
      '<div class="bar thin"><i class="seg active" style="width:'+ac+'%"></i></div></div>';
  }).join("");
  const recent=Object.keys(store.daily).sort().reverse().slice(0,7);
  $("#stRecent").innerHTML = recent.length? recent.map(d=>{
    const x=store.daily[d];
    return '<div class="rrow"><span>'+fmtDay(d)+'</span><b>'+x.n+' Karten</b>'+
      '<span class="rk">'+x.k+' ✓</span><span class="ra">'+x.a+' ✗</span></div>';
  }).join("") : '<div class="empty">Noch keine Aktivität — leg los! 🚀</div>';
}
function fmtDay(key){
  const t=today(); if(key===t) return "Heute";
  if(daysBetween(key,t)===1) return "Gestern";
  return new Date(key+"T00:00").toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});
}

// ---------- views ----------
function show(v){
  ["home","study","done","stats","prod"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==v));
  if(v==="home") renderHome();
  if(v==="stats") renderStats();
}

// ---------- wiring ----------
$("#backBtn").onclick=()=>show("home");
$("#flipBtn").onclick=()=>{ const c=$("#stage .card"); if(c&&S.mode==="flip") flip(c); };
$("#knowBtn").onclick=()=>{ const c=$("#stage .card"); if(c&&S.mode==="flip"){ if(!c.classList.contains("flipped"))flip(c); fly(c,1); grade(true,false);} };
$("#againBtn").onclick=()=>{ const c=$("#stage .card"); if(c&&S.mode==="flip"){ if(!c.classList.contains("flipped"))flip(c); fly(c,-1); grade(false,false);} };
$("#soundBtn").onclick=()=>{ store.sound=!store.sound; save(); $("#soundBtn").textContent=store.sound?"🔊":"🔇"; if(store.sound){initAudio(); sFlip();} };
$("#doneHome").onclick=()=>show("home");
$("#doneProd").onclick=()=>startProduktion(S.lesson);
$("#doneAgain").onclick=()=>startSession(S.lesson);
$("#pBack").onclick=()=>show("home");
$("#pGo").onclick=checkProduktion;
$("#pText").addEventListener("input",e=>{
  const n=(e.target.value.trim().match(/\S+/g)||[]).length;
  $("#pWc").textContent=n+" Wörter";
  $("#pWc").className = n>=60?"ok":"";
});
$("#statsBtn").onclick=()=>show("stats");
$("#statsBack").onclick=()=>show("home");
$("#streak").onclick=()=>show("stats");
$("#themeBtn").onclick=()=>{
  const cur=document.documentElement.getAttribute("data-theme");
  const nx=cur==="dark"?"light":cur==="light"?null:"dark";
  if(nx) document.documentElement.setAttribute("data-theme",nx); else document.documentElement.removeAttribute("data-theme");
  store.theme=nx; save();
};
$("#resetBtn").onclick=()=>{
  if(confirm("Gesamten Lernfortschritt zurücksetzen?")){ store=fresh(); save(); renderHome(); toast("Zurückgesetzt"); }
};
document.addEventListener("keydown",e=>{
  if($("#study").classList.contains("hidden")) return;
  if(S && S.mode!=="flip") return;
  const c=$("#stage .card"); if(!c) return;
  if(e.key==="ArrowRight"){ if(!c.classList.contains("flipped"))flip(c); fly(c,1); grade(true,false); }
  else if(e.key==="ArrowLeft"){ if(!c.classList.contains("flipped"))flip(c); fly(c,-1); grade(false,false); }
  else if(e.key===" "||e.key==="ArrowUp"){ e.preventDefault(); flip(c); }
});

if(store.theme) document.documentElement.setAttribute("data-theme",store.theme);
$("#soundBtn").textContent=store.sound?"🔊":"🔇";
show("home");
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
