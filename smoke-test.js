/* Smoke test, node smoke-test.js  (needs: npm i -D jsdom; optional: playwright)
   One runnable check behind the site. Two layers:
     - jsdom covers content, structure, the honesty invariants, WCAG AA contrast
       computed per theme, and the type/spacing discipline.
     - Chromium via playwright sweeps 320..1440px for layout overflow, because
       jsdom has no layout engine and cannot see a clipped or off-screen element.
   No framework. */
const { JSDOM } = require("jsdom");
const fs = require("fs");

/* The site is bilingual, two real pages. The 99 assertions below target the English
   content, so they load en/index.html (the English page, wording unchanged). A small
   German block at the end checks the German default page (root index.html). */
const EN = "en/index.html";
const dom = new JSDOM(fs.readFileSync(EN, "utf8"), {
  runScripts: "outside-only", pretendToBeVisual: true, url: "https://karthikjp.io/en/"
});
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.eval(fs.readFileSync("assets/js/main.js", "utf8"));

const $ = (s, ctx = window.document) => ctx.querySelector(s);
const $$ = (s, ctx = window.document) => Array.from(ctx.querySelectorAll(s));
const html = fs.readFileSync(EN, "utf8");
const js = fs.readFileSync("assets/js/main.js", "utf8");
const css = fs.readFileSync("assets/css/styles.css", "utf8");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const jsNoComments = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const pass = [], fail = [];
const t = (n, c) => { try { c() ? pass.push(n) : fail.push(n); } catch (e) { fail.push(`${n} threw: ${e.message}`); } };

/* ---- structure & identity ---- */
t("exactly one h1", () => (html.match(/<h1/g) || []).length === 1);
t("canonical points at the live domain", () => /canonical" href="https:\/\/karthikjp\.io/.test(html));
t("no reference to the old domain", () => !/karthikjavanappa\.com/.test(html));
t("only one photo file is referenced, and it exists once on disk", () =>
  new Set((html.match(/assets\/img\/[\w.-]+/g) || [])).size === 1 &&
  fs.readdirSync("assets/img").filter((f) => !f.startsWith(".")).length === 1);
t("structured data is Person and claims no current employer", () => {
  const ld = JSON.parse($('script[type="application/ld+json"]').textContent);
  return ld["@type"] === "Person" && !/"worksFor"/.test(html);
});
t("no third-party script or stylesheet other than the font CDN", () =>
  (html.match(/<script[^>]+src=/g) || []).every((s) => !/https?:/.test(s)) &&
  (html.match(/<script[^>]+src=/g) || []).length === 1);
t("every local href and src actually exists on disk", () => {
  const refs = [...html.matchAll(/(?:href|src)="(?!https?:|mailto:|tel:|data:|#)([^"]+)"/g)].map((m) => m[1]);
  /* refs are relative to the page's own folder (en/), so resolve from there */
  const missing = refs.filter((r) => !fs.existsSync(require("path").join("en", r.split("?")[0])));
  if (missing.length) console.log("    missing files:", missing);
  return missing.length === 0;
});
t("no em dashes anywhere in the shipped files", () =>
  ["index.html", "assets/css/styles.css", "assets/js/main.js"]
    .every((f) => !fs.readFileSync(f, "utf8").includes("—")));

/* ---- the interactions the report cut are actually gone ---- */
t("command palette, chat widget, gap scrubber and marquee are removed", () =>
  !$("#palette") && !$("#chat") && !$("#gap") && !$(".marquee") && !$(".statbar") &&
  !/CHAT_WEBHOOK_URL|gapRange|palOut|showModal/.test(js));
t("the nine-row registry is replaced by exactly three case studies", () =>
  $$(".sys").length === 0 && $$("#work .case").length === 3);
t("kb.json is gone and nothing still fetches it", () =>
  !fs.existsSync("assets/kb.json") && !/kb\.json/.test(js) && !/fetch\(/.test(js));
t("no planned/undated systems and no self-disqualifying copy", () => {
  const body = $("main").textContent;
  return !/\bplanned\b/i.test(body) && !/public code surface is thin/i.test(body) &&
    !/Anthropic/i.test(html);
});

/* ---- hero: proof-first, one filled action ---- */
t("the hero primary action is 'View deployed systems' and points at #work", () => {
  const primary = $(".hero .btn-primary");
  return primary && /View deployed systems/.test(primary.textContent) &&
    primary.getAttribute("href") === "#work";
});
t("the hero offers exactly one button, with the CV as a utility link beside it", () => {
  const buttons = $$(".hero .btn"), cv = $(".hero .hero-cv");
  return buttons.length === 1 && buttons[0].classList.contains("btn-primary") &&
    cv && /Karthik_Javanappa_CV\.pdf/.test(cv.getAttribute("href")) && cv.hasAttribute("download");
});
t("exactly one filled accent button above the fold", () => {
  const above = [...$$(".nav .btn-primary"), ...$$(".hero .btn-primary")];
  return above.length === 1;
});
/* the biography line told a recruiter who Karthik is; the slot now says what he shipped */
t("the hero carries hard proof on one line, not a biography line", () => {
  const hero = $(".hero").textContent;
  const proof = $(".hero .hero-proof");
  return proof && proof.tagName === "P" &&
    /4 systems shipped/.test(proof.textContent) && /EY-Parthenon/.test(proof.textContent) &&
    !/Founder\. Consultant\. Engineer\./.test(hero) &&
    !/overlap between AI engineering and strategy consulting/.test(hero);
});
t("the portrait carries no joke filename caption competing with the proof strip", () =>
  !$(".hero .frame-tag") && !/human_in_the_loop/.test(html));
/* the hero headline was lifted out of the consultant triad panel, which then read as
   a duplicate. The page should make this argument once, at the top. */
t("the hero thesis appears once, not echoed verbatim further down", () => {
  const body = $("main").textContent;
  const hits = (body.match(/easy half/gi) || []).length;
  const deDoc = fs.readFileSync("index.html", "utf8");   /* `de` is declared further down */
  const deMain = deDoc.slice(deDoc.indexOf("<main>"), deDoc.indexOf("</main>"));
  const deHits = (deMain.match(/einfache Hälfte|leichte Hälfte/g) || []).length;
  if (hits !== 1 || deHits !== 1) console.log("    en=" + hits + " de=" + deHits);
  return hits === 1 && deHits === 1;
});
t("employer names survive as a quiet static credit line, not a marquee", () => {
  const credit = $(".hero .credit");
  return credit && /EY-Parthenon/.test(credit.textContent) && /Schaeffler/.test(credit.textContent) &&
    !/marquee/i.test(cssNoComments);
});

/* ---- the three case studies each carry the common structure ---- */
t("every case has a problem, a role, a diagram and a result", () =>
  $$("#work .case").every((c) => {
    const facts = $$(".case-facts dt", c).map((d) => d.textContent.trim());
    return facts.includes("Problem") && facts.includes("My role") &&
      !!$(".diag", c) && !!$(".case-result", c) && !!$(".learned", c);
  }));
t("case 01 shows the cleared due-diligence funnel 7,000 -> 5", () => {
  const c1 = $$("#work .case")[0];
  const nums = $$(".funnel li b", c1).map((b) => b.textContent.trim());
  return /due-diligence/i.test(c1.textContent) && nums[0].includes("7,000") &&
    nums[nums.length - 1] === "5" && /under 40 min/i.test(c1.textContent);
});
t("case 02 shows the four-stage entity pipeline and a synthetic table", () => {
  const c2 = $$("#work .case")[1];
  return /entity-resolution/i.test(c2.textContent) &&
    $$(".pipe-diag li", c2).length === 4 && !!$(".er-table table", c2) &&
    /synthetic/i.test(c2.textContent);
});
t("case 03 shows the document-QA flow and keeps the constraint ledger", () => {
  const c3 = $$("#work .case")[2];
  return /Document Q&A|Document Q&amp;A/i.test(c3.innerHTML) &&
    !!$(".flow-diag", c3) && !!$(".ledger .led-no", c3) && !!$(".ledger .led-yes", c3);
});
t("only cleared claims: ~7,000-company set and under-40-minutes are both present", () => {
  const body = $("#work").textContent;
  return /7,000/.test(body) && /under 40 minutes/i.test(body);
});
t("the constraint ledger (the strongest evidence) survives in cases 01 and 03", () =>
  $$("#work .ledger").length >= 2 &&
  $$("#work .ledger").every((l) => $(".led-no", l) && $(".led-yes", l)));
t("the 'also shipped' line is present and quiet, not a fourth case", () => {
  const also = $("#work .also");
  return also && /proposal knowledge retrieval/.test(also.textContent) &&
    /Swift 6/.test(also.textContent) && $$("#work .case").length === 3;
});

/* ---- the overlap is the interactive triad (brought back on request) ---- */
t("the overlap is the interactive triad, defaulting to the FDE conclusion", () =>
  !!$("#overlap #triad") && $("#t-fde").checked &&
  $$("#overlap .tp").length === 4 && $$("#overlap .tr-in").length === 4);
t("every triad pill points at a real radio", () =>
  $$("#overlap .triad-pills label").length === 4 &&
  $$("#overlap .triad-pills label").every((l) => !!$("#" + l.htmlFor)));
t("the triad auto-cycles on animationiteration, with no timer", () =>
  /addEventListener\("animationiteration"/.test(js) &&
  !/setInterval|requestAnimationFrame/.test(js));
t("the triad panels carry cleaned copy, with no self-disqualifying line", () => {
  const body = $("#overlap").textContent;
  return /I own the outcome/.test(body) && /I hold the room/.test(body) && /I write what ships/.test(body) &&
    !/public code surface is thin/.test(body) && !/Anthropic/.test(body);
});
t("clicking a lobe checks its radio (this mutates state, so it runs last)", () => {
  $("#overlap .lobe-f").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  return $("#t-f").checked && !$("#t-fde").checked;
});
t("the overlap closes on the intersection line", () =>
  /scope it in the room, build it against real constraints, and stay when adoption stalls/
    .test($("#overlap .overlap-close").textContent));

/* ---- enterprise readiness closes both hiring objections ---- */
/* readiness and the references are no longer top-level sections: they fold into
   #overlap and #experience so the nav stays at four items. */
t("readiness shows production judgment and deployment facts", () => {
  const r = $("#overlap");
  return /Source-linked outputs/.test(r.textContent) && /Refusal over guessing/.test(r.textContent) &&
    /Human review at the decision gates/.test(r.textContent) &&
    /German resident/.test(r.textContent);
});
t("the no-sponsorship signal still lives in the contact block", () =>
  /no sponsorship/i.test($("#contact").textContent));
t("readiness does not overclaim mature eval expertise", () =>
  !/mature eval|expert in evaluation|world-class eval/i.test($("#overlap").textContent));

/* ---- experience is trimmed, Xtrawrkx is one line ---- */
t("six roles remain and every one of them names its employer the same way", () => {
  const jobs = $$("#experience .job");
  return jobs.length === 6 && jobs.every((j) => {
    const org = $(".job-org", j);
    if (!org || !org.textContent.trim()) return false;
    /* a role may carry a qualifier span ("master's thesis engagement"), but never the
       employer: Xtrawrkx shipped as "Chief of Staff<span>, Xtrawrkx</span>" while every
       other row used .job-org, and it read as a bug. */
    const qual = $(".job-role span", j);
    return !qual || !qual.textContent.includes(org.textContent.trim());
  });
});
/* the registry shipped with Xtrawrkx (Jan 2023) sitting below Micelio (Sep 2018),
   which reads as carelessness on the one section a recruiter scans for a timeline. */
t("the career list runs strictly reverse-chronological by end date", () => {
  const MON = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
  const ends = $$("#experience .job .job-date").map((d) => {
    const m = d.textContent.split("–")[1].trim().match(/(\w+)\s+(\d{4})/);
    return +m[2] * 12 + MON[m[1]];
  });
  const ok = ends.every((v, i) => i === 0 || v <= ends[i - 1]);
  if (!ok) console.log("    out of order: " + $$("#experience .job .job-date").map((d) => d.textContent).join(" | "));
  return ok;
});
t("awards are trimmed to three and keep HackAIVerse", () => {
  const awards = $$("#experience .award");
  return awards.length === 3 && /HackAIVerse/.test($("#experience .awards-list").textContent);
});

/* ---- trust: four testimonials in a horizontal scroll strip, Ivan featured ---- */
/* Hiten and Anand vouch for the pre-AI career; on a page selling AI delivery they cost
   length and a horizontal scroll without moving the hiring decision. They live in the CV. */
t("two testimonials remain, the two that speak to AI delivery and strategy", () =>
  !!$("#experience .quote-scroll") &&
  JSON.stringify($$("#experience .quote-who b").map((n) => n.textContent.trim().split(" ")[0])) ===
  JSON.stringify(["Ivan", "Katharina"]));
t("the strip actually scrolls horizontally and snaps", () => {
  const rule = cssNoComments.match(/\.quote-scroll \{([^}]*)\}/);
  return !!rule && /overflow-x: auto/.test(rule[1]) && /scroll-snap-type/.test(rule[1]);
});
t("the direct-manager quote is first and featured", () => {
  const first = $("#experience .quote-card");
  return first.classList.contains("quote-feature") && /Ivan/.test(first.textContent) &&
    /direct manager/.test(first.textContent);
});
t("every avatar initial matches its name", () => {
  const who = $$("#experience .quote-who");
  return who.length === 2 &&
    who.every((w) => $(".av", w).textContent.trim() === $("b", w).textContent.trim()[0]);
});

/* ---- contact: hiring CTA primary, consulting floor quiet, no 3-step ---- */
t("the contact heading leads with the hiring ask", () =>
  /Hiring for a forward-deployed or AI strategy role\? Let's talk\./.test($("#contact h2").textContent));
t("the three-step explainer is gone", () => !$("#contact .steps"));
t("the consulting floor is present, concrete and below the hiring path", () => {
  const aside = $("#contact .ci-aside");
  const svc = $$("#contact .svc li").map((l) => l.textContent.trim());
  return aside && /Scope a project/.test(aside.textContent) &&
    svc.includes("AI workflow diagnostic") && svc.includes("EU AI Act readiness review") &&
    (($("#contact .contact-info").compareDocumentPosition(aside) & window.Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0);
});
/* the old form had no endpoint: it checked for empty strings, then opened a mailto.
   Two honest links do the same job and stop promising a submission that never happened. */
t("the faux form is gone: two direct mailto routes and no dead validation JS", () => {
  const rows = $$("#contact .cd-row");
  return rows.length === 2 &&
    rows.every((r) => r.getAttribute("href").startsWith("mailto:kjavanappa@gmail.com")) &&
    /hiring for a role/i.test(rows[0].textContent) &&
    /not reaching production/i.test(rows[1].textContent) &&
    !$("#contactForm") && !$("#formNote") &&
    !/cf-name|contactForm|aria-invalid/.test(js);
});

/* ---- location & language policy ---- */
t("no city locates him outside the job-history rows", () => {
  const jobLocs = new Set($$(".job-loc").map((n) => n.textContent.trim()));
  const strip = (s) => [...jobLocs].reduce((acc, l) => acc.split(l).join(""), s);
  const selfLocating = [
    $("title").textContent,
    $('meta[name="description"]').content,
    $('meta[property="og:title"]').content,
    $('meta[property="og:description"]').content,
    $(".hero-avail").textContent,
    $(".footer-brand p").textContent
  ].join(" ");
  const body = strip($("main").textContent) + " " + strip(js);
  return !/Frankfurt/.test(selfLocating) && !/Frankfurt/.test(body);
});
t("the only city in the contact block and schema is Aachen", () => {
  const ld = JSON.parse($('script[type="application/ld+json"]').textContent);
  return ld.address.addressLocality === "Aachen" &&
         /Aachen, Germany/.test($("#contact").textContent) &&
         !/Frankfurt/.test($("#contact").textContent);
});
t("availability now names the target regions the report asked for", () => {
  const avail = $(".hero-avail").textContent;
  return /forward-deployed/.test(avail) && /NRW/.test(avail) && /Rhine-Main/.test(avail) &&
    !/Frankfurt/.test(avail);
});
t("German is stated as B2 with no extra qualifier, Kannada and Hindi stay dropped", () => {
  const all = $("main").textContent;
  return !/German\s*[·(]?\s*B1/.test(all) && /German\s*[·(]?\s*B2/.test(all) &&
         !/C1 in progress/.test(all) &&
         !/Kannada/.test(all) && !/Hindi/.test(all);
});

const PAGES_NAV = {
  "index.html": fs.readFileSync("index.html", "utf8"),
  "en/index.html": fs.readFileSync("en/index.html", "utf8"),
  "projekte.html": fs.readFileSync("projekte.html", "utf8"),
  "en/projekte.html": fs.readFileSync("en/projekte.html", "utf8"),
  "wall-of-love.html": fs.readFileSync("wall-of-love.html", "utf8"),
  "en/wall-of-love.html": fs.readFileSync("en/wall-of-love.html", "utf8"),
};

/* ---- headings & sections ---- */
t("no h1/h2 heading text is duplicated inside one section", () => {
  const norm = (s) => s.replace(/[^a-z]/gi, "").toLowerCase();
  return $$("main section").every((sec) => {
    const hs = $$("h1,h2", sec).map((h) => norm(h.textContent));
    return new Set(hs).size === hs.length;
  });
});
t("no heading level is skipped inside any section", () =>
  $$("main section").every((sec) => {
    const lv = $$("h1,h2,h3,h4", sec).map((h) => +h.tagName[1]);
    return lv.every((v, i) => i === 0 || v <= lv[i - 1] + 1);
  }));
t("about/work/overlap ordering: systems come right after the hero", () => {
  const ids = $$("main > section").map((s) => s.id);
  return ids[0] === "home" && ids[1] === "work" && ids[2] === "overlap";
});
t("adjacent content sections alternate their background", () => {
  const secs = $$("main > section.section");
  return secs.every((s, i) => s.classList.contains("alt") === (i % 2 === 1));
});
t("every nav link points at a section that exists", () =>
  $$("#navLinks a").every((a) => !!$(a.getAttribute("href"))));
/* five nav items is more than a recruiter scans. Readiness folded into the overlap
   section and the references into the career section, which cost nothing structurally. */
t("the nav stays at four items or fewer, on every page", () => {
  const counts = Object.entries(PAGES_NAV).map(([n, doc]) => {
    const nav = doc.slice(doc.indexOf('id="navLinks"'), doc.indexOf("</nav>"));
    return [n, (nav.match(/<a /g) || []).length];
  });
  const bad = counts.filter(([, c]) => c > 4);
  if (bad.length) console.log("    too many nav links: " + bad.map((b) => b.join("=")).join(", "));
  return bad.length === 0;
});

/* ---- back-to-top and mobile menu behaviour ---- */
t("back-to-top is not focusable while invisible", () => {
  const base = cssNoComments.match(/\.to-top\s*\{([^}]*)\}/)[1];
  return /visibility:\s*hidden/.test(base) && /\.to-top\.show \{ visibility: visible/.test(cssNoComments);
});
t("mobile menu closes on Escape and outside click, and announces what it controls", () =>
  /aria-controls="navLinks"/.test(html) && /Escape" && navLinks/.test(js) && /closest\("\.nav-inner"\)/.test(js));
t("scroll handler cannot throw and strand every reveal at opacity 0", () =>
  /nav\?\.classList/.test(js) && /toTop\?\.classList/.test(js));
t("localStorage access cannot kill the whole script", () =>
  /try \{ stored = localStorage/.test(js));
t("theme is applied before first paint", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  return /localStorage\.getItem\("kj-theme"\)/.test(head);
});

/* ---- reveal / print ---- */
t("a print stylesheet exists and un-hides the revealed content", () =>
  /@media print/.test(css) && /\.reveal \{ opacity: 1/.test(css));
t("print swaps the tokens, not just body colour", () => {
  const pr = css.slice(css.indexOf("@media print"));
  return /--text: #111/.test(pr) && /--bg: #fff/.test(pr) && /--live:/.test(pr) && /--build:/.test(pr);
});

/* ---- cache busting ----
   The host serves CSS and JS with max-age=604800 and no revalidation, so without a
   version in the URL a returning visitor keeps a week-old stylesheet. This is not
   hypothetical: it shipped a phone showing fresh HTML with the pre-fix layout, and
   it looked like the fix had failed when the fix was live and correct. */
t("the CSS and JS carry the same cache-busting version", () => {
  const c = html.match(/styles\.css\?v=([\w.-]+)/);
  const j = html.match(/main\.js\?v=([\w.-]+)/);
  if (!c || !j) { console.log("    missing version token"); return false; }
  if (c[1] !== j[1]) { console.log("    versions disagree: css=" + c[1] + " js=" + j[1]); return false; }
  return true;
});

/* ---- transfer budget ----
   Gate the compressed first-view transfer, summed across the three files, which is
   what a visitor actually downloads for the first screen. Removing the palette,
   chat, scrubber, triad and marquee dropped this by roughly half. */
t("first view stays well under 32KB gzipped, all three files (both languages)", () => {
  const gz = (f) => require("zlib").gzipSync(fs.readFileSync(f), { level: 9 }).length;
  const shared = gz("assets/css/styles.css") + gz("assets/js/main.js");
  const en = gz(EN) + shared, de = gz("index.html") + shared;
  if (en >= 32768 || de >= 32768) console.log("    first view: en=" + en + "B de=" + de + "B gzipped");
  return en < 32768 && de < 32768;
});

/* ---- CSS discipline ---- */
t("no hardcoded hex outside the token blocks except print and traffic tokens", () => {
  const body = cssNoComments
    .replace(/:root\s*\{[^}]*\}/g, "")
    .replace(/\[data-theme="light"\]\s*\{[^}]*\}/, "");
  const hexes = (body.match(/#[0-9a-f]{3,6}\b/gi) || []).map((h) => h.toLowerCase());
  const allowed = ["#fff", "#111", "#333", "#555", "#bbb", "#ddd",
                   "#0a5c28", "#0b4a6f", "#7a4a06", "#8a1c1c",
                   "#000"];   /* a mask-image stop: only its alpha is used, never painted */
  const bad = [...new Set(hexes.filter((h) => !allowed.includes(h)))];
  if (bad.length) console.log("    untokenised colours:", bad.join(", "));
  return bad.length === 0;
});
t("literal font sizes snap to the six-step scale (clamp display sizes exempt)", () => {
  const sizes = new Set();
  for (const m of cssNoComments.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) sizes.add(+m[1]);
  for (const m of cssNoComments.matchAll(/font:\s*[^;{}]*?\b(\d+(?:\.\d+)?)px[/\s]/g)) sizes.add(+m[1]);
  const scale = [12, 13, 15, 17, 21, 26];
  const off = [...sizes].filter((s) => !scale.includes(s));
  if (off.length) console.log("    off-scale sizes:", off.join(", "));
  return off.length === 0;
});
t("spacing snaps to a 4px ramp", () => {
  const ramp = new Set([0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
  const off = new Set();
  for (const m of cssNoComments.matchAll(/\b(?:margin|padding|gap|row-gap|column-gap)[a-z-]*:\s*([^;{}]+)/g)) {
    if (/calc\(|var\(|%|auto/.test(m[1])) continue;
    for (const v of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) if (!ramp.has(+v[1])) off.add(+v[1]);
  }
  if (off.size) console.log("    off-ramp spacing:", [...off].join(", "));
  return off.size === 0;
});
t("no dead CSS: every class the stylesheet targets is used or runtime-known", () => {
  const classes = [...cssNoComments.matchAll(/(^|[\s,>+~])\.([a-z][a-z0-9-]{3,})(?=[\s,:{\[.])/gim)].map((m) => m[2]);
  const used = new Set();
  html.replace(/class="([^"]+)"/g, (_, c) => c.split(/\s+/).forEach((x) => used.add(x)));
  const known = new Set(["sr-only", "scrolled", "show", "open", "active", "copied", "reveal"]);
  const orphans = [...new Set(classes)].filter((c) => !used.has(c) && !known.has(c));
  if (orphans.length) console.log("    orphaned CSS classes:", orphans.join(", "));
  return orphans.length === 0;
});

/* ---- computed WCAG contrast over the token pairs the page actually uses ------
   Exact arithmetic on values parsed from the file, needs no layout. This is the
   one defect class a jsdom suite can verify precisely rather than approximately. */
const tokens = (block) => {
  const m = css.match(new RegExp(block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
  const out = {};
  for (const [, k, v] of (m ? m[1] : "").matchAll(/--([\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
};
const srgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const [r, g, b] = srgb(hex).map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};
const over = (rgba, bg) => {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
  const base = srgb(bg);
  const mix = [r, g, b].map((c, i) => Math.round(+c * +a + base[i] * (1 - +a)));
  return "#" + mix.map((c) => c.toString(16).padStart(2, "0")).join("");
};

const PAIRS = [
  ["faint", "card-2", 11], ["faint", "card", 11], ["faint", "bg-2", 11], ["faint", "bg", 11],
  ["muted", "card", 12.5], ["muted", "bg-2", 13], ["muted", "card-2", 12.5],
  ["text", "card", 14], ["text", "bg", 16.5], ["text", "card-2", 14],
  ["accent", "bg-2", 13], ["accent", "card", 12], ["accent", "bg", 12.5],
  ["live", "bg-2", 13], ["live", "card", 12], ["build", "card", 12],
];
const DIM_PAIRS = [["accent", "accent-dim", 13], ["live", "live-dim", 12], ["build", "build-dim", 12]];

[["dark", ":root"], ["light", '[data-theme="light"]'], ["print", "@media print"]].forEach(([name, block]) => {
  const T = name === "print"
    ? Object.assign({}, tokens(":root"), tokens(':root, [data-theme="dark"], [data-theme="light"]'))
    : Object.assign({}, tokens(":root"), tokens(block));
  const fails = [];
  PAIRS.forEach(([fg, bg, px]) => {
    if (!T[fg] || !T[bg] || !T[fg].startsWith("#") || !T[bg].startsWith("#")) return;
    const r = ratio(T[fg], T[bg]);
    if (r < 4.5) fails.push(`--${fg} on --${bg} = ${r.toFixed(2)} at ${px}px`);
  });
  DIM_PAIRS.forEach(([fg, dim, px]) => {
    if (!T[fg] || !T[dim]) return;
    const surface = over(T[dim], T["card-2"]);
    const r = ratio(T[fg], surface);
    if (r < 4.5) fails.push(`--${fg} on --${dim} over --card-2 = ${r.toFixed(2)} at ${px}px`);
  });
  t(`${name} theme: every token pair clears AA 4.5:1 at its smallest use`, () => {
    if (fails.length) console.log("    " + name + " contrast failures:\n      " + fails.join("\n      "));
    return fails.length === 0;
  });
});
t("the er-table 'flag' tint keeps its text AA in both themes", () => {
  const check = (block) => {
    const T = Object.assign({}, tokens(":root"), tokens(block));
    return ratio(T["build"], over(T["build-dim"], T["card"])) >= 4.5;
  };
  return check(":root") && check('[data-theme="light"]');
});

/* ---- German default page (root index.html) + bilingual wiring ---- */
const de = fs.readFileSync("index.html", "utf8");
t("root index.html is the German page (lang=de) and stays canonical at the apex", () =>
  /<html lang="de"/.test(de) && /canonical" href="https:\/\/karthikjp\.io\/"/.test(de));
t("the German page carries native German section copy, not leftover English", () =>
  /Die Demo ist die einfache Hälfte/.test(de) && /Drei Systeme/.test(de) &&
  /Eine <em[^>]*>Schnittstelle/.test(de) && /Gebaut für ein/.test(de) &&
  !/The demo is the easy half/.test(de) && !/Three systems, in/.test(de));
t("the German page states Deutsch B2 with no qualifier, never B1", () =>
  /Deutsch\s*[·(]?\s*B2/.test(de) && !/C1 in Arbeit/.test(de) && !/\bB1\b/.test(de) &&
  !/Kannada/.test(de) && !/Hindi/.test(de));
t("the German CV link points at the German PDF, with no TODO left in production HTML", () =>
  /assets\/Karthik_Javanappa_CV_DE\.pdf/.test(de) && !/TODO/.test(de));
t("both pages carry the DE|EN switcher as plain anchors (no JS toggle)", () => {
  const sw = (doc) => { const i = doc.indexOf('class="lang-switch"'); return i < 0 ? "" : doc.slice(i, i + 400); };
  return /href="en\/"/.test(sw(de)) &&      // German page: EN links into en/
         /href="\.\.\/"/.test(sw(html));    // English page: DE links back to root
});
t("both pages declare the three hreflang alternates", () =>
  [de, html].every((doc) =>
    /hreflang="de" href="https:\/\/karthikjp\.io\/"/.test(doc) &&
    /hreflang="en" href="https:\/\/karthikjp\.io\/en\/"/.test(doc) &&
    /hreflang="x-default" href="https:\/\/karthikjp\.io\/"/.test(doc)));
t("the English page is canonical at /en/ and lang=en", () =>
  /<html lang="en"/.test(html) && /canonical" href="https:\/\/karthikjp\.io\/en\/"/.test(html));
t("no em dashes on the German page", () => !de.includes("—"));

/* ---- the claim gate ----------------------------------------------------------
   Six live wordings outran the evidence record. Each fix was one string, and a string
   is exactly what comes back through a copy-paste from an old draft. These assert the
   old wording is absent from every shipped page in both languages, so it cannot return
   quietly. A claim gate that is not executable is a claim gate nobody runs. */
const PAGES = {
  "index.html": de,
  "en/index.html": html,
  "projekte.html": fs.readFileSync("projekte.html", "utf8"),
  "en/projekte.html": fs.readFileSync("en/projekte.html", "utf8"),
  "wall-of-love.html": fs.readFileSync("wall-of-love.html", "utf8"),
  "en/wall-of-love.html": fs.readFileSync("en/wall-of-love.html", "utf8"),
};
const noneOf = (label, patterns) =>
  t(label, () => {
    const hits = [];
    for (const [name, doc] of Object.entries(PAGES))
      for (const p of patterns) if (p.test(doc)) hits.push(name + ": " + p);
    if (hits.length) console.log("    " + hits.join("\n    "));
    return hits.length === 0;
  });

noneOf("claim gate: no C1 qualifier hangs off the German level anywhere",
  [/C1 in Arbeit/, /C1 in progress/]);
noneOf("claim gate: the 40-minute result is never attributed to peer analysis alone",
  [/Beratertage Peer-Analyse/, /Berater-Tage Peer-Analyse/, /consultant-days of peer analysis/]);
noneOf("claim gate: no eval-maturity overclaim",
  [/nicht nach Bauchgefühl/, /not on vibes/, /Zitationsgenauigkeit/]);
noneOf("claim gate: adoption is never claimed in the present tense",
  [/täglich im Einsatz/, /im täglichen Einsatz/, /in daily use/]);
noneOf("claim gate: the hero credit claims experience, not delivery, at all three orgs",
  [/ausgeliefert bei<\/span>/, /shipped at<\/span>/]);
noneOf("claim gate: the phone number is published on no page",
  [/\+49 176 8794 9009/, /tel:\+49/, /"telephone"/]);
/* the registry argues that its statuses track reality. It shipped pointing readers at
   a chat widget in the corner of the home page that no longer exists there. The claim
   and the reality have to agree in BOTH directions, so this also fails if the widget
   comes back and the row still says planned. */
t("the registry never points at a chat widget the home page does not have", () => {
  const widget = !!$("#chat") || /chatWidget|CHAT_WEBHOOK_URL/.test(js);
  const claimed = [PAGES["projekte.html"], PAGES["en/projekte.html"]].some((doc) =>
    /bottom-right corner|unten rechts auf der Startseite|Running the local tier|Läuft gerade auf der lokalen|s-local/.test(doc));
  if (widget !== claimed) console.log("    widget present=" + widget + " but registry claims it=" + claimed);
  return widget === claimed;
});
t("the 40-minute result names both halves of the pipeline, in both languages", () =>
  /Unternehmensrecherche-Pipeline und Peer-Finder/.test(de) &&
  /company-research pipeline and the peer finder/.test(html));

/* ---- accessibility floor ---- */
t("a skip link is the first focusable thing on the page", () => {
  const skip = $("body > a.skip-link");
  return !!skip && skip.getAttribute("href") === "#home" && !!$("#home");
});
t("one global focus-visible ring covers the whole page, not three scoped ones", () =>
  /\n:focus-visible \{[^}]*outline: 2px solid var\(--accent\)/.test(cssNoComments));
t("the nav icon buttons meet the 44px touch minimum", () => {
  const r = cssNoComments.match(/\.icon-btn \{([^}]*)\}/)[1];
  return /width: 44px/.test(r) && /height: 44px/.test(r);
});
t("every case ships collapsed, and only the first one signals to be opened", () => {
  const cases = $$("#work .case");
  const allShut = cases.every((c) => !c.hasAttribute("open"));
  const scoped = /\.case:first-of-type:not\(\[open\]\) > summary\.case-head::after \{ animation: case-chev-bounce/
    .test(cssNoComments) &&
    /\.case:first-of-type:not\(\[open\]\) > summary\.case-head \.case-num \{/.test(cssNoComments) &&
    !/\n\.case:not\(\[open\]\) > summary\.case-head::after \{ animation/.test(cssNoComments);
  const reducedMotion = /prefers-reduced-motion: reduce\)\s*\{[^}]*case-num[^}]*animation: none/.test(
    cssNoComments.replace(/\n/g, " "));
  return allShut && scoped && reducedMotion;
});

/* ---- distribution ---- */
t("robots.txt and sitemap.xml exist and agree on all four URLs", () => {
  if (!fs.existsSync("robots.txt") || !fs.existsSync("sitemap.xml")) return false;
  const r = fs.readFileSync("robots.txt", "utf8"), sm = fs.readFileSync("sitemap.xml", "utf8");
  return /Sitemap: https:\/\/karthikjp\.io\/sitemap\.xml/.test(r) &&
    ["https://karthikjp.io/", "https://karthikjp.io/en/",
     "https://karthikjp.io/projekte.html", "https://karthikjp.io/en/projekte.html"]
      .every((u) => sm.includes("<loc>" + u + "</loc>"));
});
t("every page shares a dedicated 1200x630 card, not the tall portrait", () =>
  Object.values(PAGES).every((doc) => {
    const m = doc.match(/og:image" content="https:\/\/karthikjp\.io\/(assets\/og\/og-(?:de|en)\.png)"/);
    return m && fs.existsSync(m[1]) &&
      /og:image:width" content="1200"/.test(doc) && /og:image:height" content="630"/.test(doc);
  }));
t("all four pages share one cache-busting token", () => {
  const tokens = new Set();
  for (const doc of Object.values(PAGES))
    for (const m of doc.matchAll(/\?v=([\w.-]+)/g)) tokens.add(m[1]);
  if (tokens.size !== 1) console.log("    tokens in play: " + [...tokens].join(", "));
  return tokens.size === 1;
});
/* the home page keeps the two references that speak to AI delivery. The other two are
   real and should be readable, just not at the cost of a horizontal scroll on a phone. */
t("the wall-of-love page holds all four references and both languages link to it", () => {
  const wallDe = PAGES["wall-of-love.html"], wallEn = PAGES["en/wall-of-love.html"];
  const names = ["Ivan", "Katharina", "Hiten", "Anand"];
  const holdsAll = [wallDe, wallEn].every((w) =>
    (w.match(/class="quote-card/g) || []).length === 4 && names.every((n) => w.includes(n)));
  const linked = /href="wall-of-love\.html"/.test(de) && /href="wall-of-love\.html"/.test(html);
  const notOnHome = !/Hiten|Anand/.test($("main").textContent);
  return holdsAll && linked && notOnHome;
});
t("the scroll hint is a real link now, not a dead arrow", () => {
  const hint = $("#experience .scroll-hint a");
  return !!hint && hint.getAttribute("href") === "wall-of-love.html";
});
/* the repo description, homepage field and README all say "learnvokabeln.com", which
   does not resolve. The domain is lernvokabeln.com (German lernen, no "a"). The site
   must not repeat the typo, so this fails if the dead spelling ever appears. */
t("the registry links the live Lernvokabeln domain, never the dead spelling", () => {
  const reg = [PAGES["projekte.html"], PAGES["en/projekte.html"]];
  const rowOk = reg.every((doc) =>
    /<b>lernvokabeln<\/b>/.test(doc) &&
    /sys-status s-live"><i><\/i>live/.test(doc.slice(doc.indexOf("<b>lernvokabeln</b>") - 400, doc.indexOf("<b>lernvokabeln</b>") + 400)) &&
    /https:\/\/lernvokabeln\.com/.test(doc) &&
    /github\.com\/karthikjpio\/Lernvokabeln/.test(doc));
  const noTypo = Object.values(PAGES).every((doc) => !/learnvokabeln/i.test(doc));
  if (!noTypo) console.log("    dead domain spelling present on a page");
  return rowOk && noTypo;
});
t("no em dashes on any shipped page", () =>
  Object.values(PAGES).every((doc) => !doc.includes("—")));

const report = () => {
  pass.forEach((p) => console.log("  ✓ " + p));
  if (fail.length) { console.log("\nFAIL:"); fail.forEach((f) => console.log("  ✗ " + f)); }
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
};

/* ---- real layout, in a real engine ----
   jsdom has no layout engine: it cannot see an element clipped off the right edge
   or a headline pushed below the fold, which is exactly how a green suite once
   shipped a broken phone layout. This pass renders the page in Chromium across the
   phone widths the report named (360, 390, 430) plus the desktop band, and fails
   on any horizontal overflow. It skips, loudly, when playwright is absent. */
(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (e) { /* optional */ }
  if (!chromium) {
    console.log("\n  ! layout pass SKIPPED: no playwright.");
    console.log("    npm i -D playwright && npx playwright install chromium");
    return report();
  }
  const url = "file://" + require("path").resolve(EN);
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const listed = (arr, label) => {
    if (arr.length) console.log("      " + label + ": " + [...new Set(arr)].slice(0, 6).join(", "));
    return arr.length === 0;
  };
  for (const w of [320, 360, 390, 430, 768, 820, 1024, 1440]) {
    const touch = w < 700;
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => {
      document.querySelectorAll(".reveal").forEach((e) => { e.style.opacity = 1; e.style.transform = "none"; });
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate((vw) => {
      const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "");
      const out = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, past: [], clipped: [] };
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("sr-only")) continue;
        if (el.closest(".quote-scroll")) continue;   /* a horizontal scroll region is meant to run off the right edge */
        const b = el.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        if (b.right > vw + 1 || b.left < -1) out.past.push(name(el));
        if (el.scrollWidth > el.clientWidth + 4 && cs.overflowX === "hidden") out.clipped.push(name(el));
      }
      const nav = document.querySelector(".nav-inner");
      out.navFits = !nav || nav.scrollWidth <= nav.clientWidth + 1;
      return out;
    }, w);
    t(`${w}px: no horizontal scroll`, () => r.sw <= r.cw + 1);
    t(`${w}px: nothing past the viewport edge`, () => listed(r.past, "past"));
    t(`${w}px: nothing clipped by overflow:hidden`, () => listed(r.clipped, "clipped"));
    if (w >= 700) t(`${w}px: the nav bar fits its own width`, () => r.navFits);
    await ctx.close();
  }
  /* sweep the whole range: a nav that fits at 1024 and 1440 can still not fit at
     1000, and phone spot-checks miss narrow bands. */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  const bad = [];
  for (let w = 320; w <= 1440; w += 20) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(30);
    const r = await page.evaluate(() => {
      const nav = document.querySelector(".nav-inner");
      return {
        nav: nav.scrollWidth - nav.clientWidth,
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (r.nav > 1 || r.doc > 1) bad.push(`${w}(nav+${r.nav},doc+${r.doc})`);
  }
  t("no width from 320 to 1440 overflows the nav or the document", () => {
    if (bad.length) console.log("      overflowing widths: " + bad.slice(0, 12).join(" "));
    return bad.length === 0;
  });
  await ctx.close();
  await browser.close();
  report();
})();
