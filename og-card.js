/* Regenerates the 1200x630 social cards: node og-card.js
   Kept in the repo so the cards are reproducible instead of a mystery binary.
   Uses the playwright already in devDependencies, no new install. */
const { chromium } = require("playwright");
const fs = require("fs");

const card = (d) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:#08090c; color:#e7ebf2;
         font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; overflow:hidden; position:relative; }
  .grid { position:absolute; inset:0;
          background-image:linear-gradient(#151a22 1px,transparent 1px),linear-gradient(90deg,#151a22 1px,transparent 1px);
          background-size:48px 48px; opacity:.55; }
  .glow { position:absolute; right:-160px; top:-160px; width:640px; height:640px; border-radius:50%;
          background:radial-gradient(circle,rgba(74,222,128,.14),transparent 68%); }
  .in { position:relative; padding:72px 80px; height:100%; display:flex; flex-direction:column; }
  .brand { font-family:Menlo,monospace; font-size:26px; color:#4ade80; letter-spacing:.02em; }
  h1 { margin-top:44px; font-size:72px; line-height:1.1; letter-spacing:-.03em; font-weight:700;
       max-width:16ch; text-wrap:balance; }
  .sub { margin-top:20px; font-size:27px; line-height:1.35; color:#a8b2c1; max-width:30ch; }
  .proof { margin-top:auto; display:flex; gap:12px; flex-wrap:wrap; }
  .proof span { font-family:Menlo,monospace; font-size:21px; color:#c3ccda;
                border:1px solid #242c3a; background:#12161d; border-radius:10px; padding:12px 18px; }
  .proof b { color:#fff; font-weight:700; }
  .foot { margin-top:34px; display:flex; align-items:center; gap:14px;
          font-family:Menlo,monospace; font-size:20px; color:#8b95a6; }
  .dot { width:10px; height:10px; border-radius:50%; background:#4ade80; }
  .rule { height:4px; width:88px; background:#4ade80; border-radius:2px; margin-top:8px; }
</style></head><body>
  <div class="grid"></div><div class="glow"></div>
  <div class="in">
    <div class="brand">~/karthik</div>
    <div class="rule"></div>
    <h1>${d.h}</h1>
    <div class="sub">${d.sub}</div>
    <div class="proof">${d.proof.map((p) => `<span>${p}</span>`).join("")}</div>
    <div class="foot"><span class="dot"></span>${d.foot}</div>
  </div>
</body></html>`;

const CARDS = [
  { file: "assets/og/og-de.png", h: "Die Demo ist die einfache H&auml;lfte.",
    sub: "Die schwierige ist die Rahmenbedingung, die niemand aufgeschrieben hat.",
    proof: ["<b>4 Systeme</b> ausgeliefert", "<b>Strategie &amp; M&amp;A</b>", "Beratertage <b>&rarr; &lt;40 Min.</b>"],
    foot: "Karthik Javanappa &middot; Forward Deployed AI Engineer &middot; Aachen" },
  { file: "assets/og/og-en.png", h: "The demo is the easy half.",
    sub: "The difficult half is the constraint nobody wrote down.",
    proof: ["<b>4 systems</b> shipped", "<b>strategy &amp; M&amp;A</b>", "consultant-days <b>&rarr; &lt;40 min</b>"],
    foot: "Karthik Javanappa &middot; Forward Deployed AI Engineer &middot; Aachen" },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const c of CARDS) {
    await p.setContent(card(c), { waitUntil: "load" });
    await p.screenshot({ path: c.file });
    console.log(c.file, fs.statSync(c.file).size + "B");
  }
  await b.close();
})();
