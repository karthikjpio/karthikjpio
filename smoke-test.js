/* Smoke test, node smoke-test.js  (needs: npm i jsdom)
   One runnable check behind the interactive work. Covers the three components
   with real logic (gap scrubber, triad state, command palette) plus the
   honesty invariants that are the whole point of the page. No framework. */
const { JSDOM } = require("jsdom");
const fs = require("fs");

const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
  runScripts: "outside-only", pretendToBeVisual: true, url: "https://karthikjp.io/"
});
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.eval(fs.readFileSync("assets/js/main.js", "utf8"));

const $ = (s, ctx = window.document) => ctx.querySelector(s);
const $$ = (s, ctx = window.document) => Array.from(ctx.querySelectorAll(s));
const html = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("assets/js/main.js", "utf8");
const css = fs.readFileSync("assets/css/styles.css", "utf8");
/* comments have to go first, or the rule that documents this bug trips the check */
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const jsNoComments = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const pass = [], fail = [];
const t = (n, c) => { try { c() ? pass.push(n) : fail.push(n); } catch (e) { fail.push(`${n} threw: ${e.message}`); } };

/* ---- the gap scrubber ---- */
/* the scrubber rests on its conclusion, the same rule the triad follows: no-JS,
   print, reduced-motion and the OG screenshot all get the answer, and the
   interaction is optional archaeology rather than mandatory homework. */
t("gap rests on production, not on an empty demo state", () =>
  $("#gap").dataset.stage === "2" && $("#gapStage").textContent === "production" &&
  +$("#gapRange").value === +$("#gapRange").max &&
  /citations you can check/.test($("#gapCap").textContent));
t("the slider is continuous, and settles onto a stage when released", () =>
  +$("#gapRange").max >= 100 && /Math\.round\(raw \*/.test(js) &&
  /addEventListener\("change", settle\)/.test(js) && /addEventListener\("keyup", settle\)/.test(js));
const range = $("#gapRange");
/* the range is 0..200 so the thumb moves continuously; drag(stage) converts a
   stage index into that space, and settle() snaps it on release. */
const drag = (stage) => {
  range.value = String((stage / 2) * +range.max);
  range.dispatchEvent(new window.Event("input"));
  range.dispatchEvent(new window.Event("change"));
};
drag(1);
t("gap -> pilot swaps stage and caption", () => $("#gap").dataset.stage === "1" && /quietly stop/.test($("#gapCap").textContent));
drag(2);
t("gap -> production", () => $("#gap").dataset.stage === "2" && $("#gapStage").textContent === "production");
drag(0);
t("gap is reversible all the way back to demo", () =>
  $("#gap").dataset.stage === "0" && /That is what demos are for/.test($("#gapCap").textContent));
drag(2);

/* ---- triad ---- */
t("triad defaults to the conclusion, not an empty diagram", () => $("#t-fde").checked);
$(".lobe-f").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
t("clicking a lobe checks its radio", () => $("#t-f").checked && !$("#t-fde").checked);
t("one panel per state", () => $$(".triad-panels .tp").length === 4 && $$(".triad .tr-in").length === 4);
t("every pill points at a real radio", () => $$(".triad-pills label").every((l) => $("#" + l.htmlFor)));

/* ---- command palette ---- */
$("#paletteOpen").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
t("palette opens showing help", () => $("#palette").open && /ls deployments/.test($("#palOut").textContent));
const run = (v) => { $("#palInput").value = v; $("#palForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); };
run("ls deployments");
t("ls reads the live registry out of the DOM", () => {
  const o = $("#palOut").textContent;
  return /due-diligence-agents/.test(o) && /ask-my-ai/.test(o) && /planned/.test(o) && !/in build/.test(o);
});
run("hire");
t("hire states work authorisation", () => /no sponsorship required/.test($("#palOut").textContent));
run("guardrails");
t("guardrails admits the eval gap rather than hiding it", () => /eval harnesses are the newest/.test($("#palOut").textContent));
run("  LS   DEPLOYMENTS  ");
t("matching is case- and whitespace-tolerant", () => /due-diligence-agents/.test($("#palOut").textContent));
run("nonsense-xyz");
t("unknown command fails gracefully", () => /command not found/.test($("#palOut").textContent));
run("clear");
t("clear empties the output", () => $("#palOut").innerHTML === "");
run('<img src=x onerror=alert(1)>');
t("user input is escaped, never injected", () => !$("#palOut").querySelector("img") && /&lt;img/.test($("#palOut").innerHTML));

/* ---- honesty invariants: the page's whole differentiator ---- */
const statusOf = (name) => {
  const row = $$(".sys").find((d) => $(".sys-name b", d).textContent.trim() === name);
  return row ? $(".sys-status", row).textContent.trim() : null;
};
t("ask-my-ai is labelled local, because the webhook is empty", () => {
  const webhookSet = !/const CHAT_WEBHOOK_URL = ""/.test(fs.readFileSync("assets/js/main.js", "utf8"));
  return statusOf("ask-my-ai") === (webhookSet ? "live" : "local");
});
t("the three unstarted repos say planned", () =>
  ["peerbench", "dataroom-qa", "market-sizer"].every((n) => statusOf(n) === "planned"));
t("no planned entry carries a shipping date", () =>
  $$(".sys").filter((d) => $(".sys-status", d).textContent.trim() === "planned")
    .every((d) => !/(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d/
      .test($(".sys-body", d).textContent)));
t("canonical points at the live domain", () => /canonical" href="https:\/\/karthikjp\.io/.test(html));
t("no reference to the old domain", () => !/karthikjavanappa\.com/.test(html));
t("exactly one h1", () => (html.match(/<h1/g) || []).length === 1);
t("only one photo file is referenced", () =>
  new Set((html.match(/assets\/img\/[\w.-]+/g) || [])).size === 1 &&
  fs.readdirSync("assets/img").filter((f) => !f.startsWith(".")).length === 1);
t("structured data claims no current employer", () => !/"worksFor"/.test(html));

/* ---- the chat knowledge base was extracted, not lost ---- */
const kb = JSON.parse(fs.readFileSync("assets/kb.json", "utf8"));
t("kb.json carries every topic", () => kb.topics.length === 18 && !!kb.greeting && !!kb.fallback);
t("kb is no longer inlined in the JS bundle", () => !/const KB = \{/.test(js));
t("chat degrades with a message instead of throwing when kb is unreachable", () =>
  /catch \(_\)/.test(js) && /knowledge base/i.test(js));
/* Budget is on the compressed transfer, not the raw file. The plan also
   requires readable un-minified source ("view source and check"), and those two
   constraints fight: raw bytes are inflated by comments and formatting that cost
   almost nothing after compression. Gate the thing the visitor actually pays for. */
/* The gate that matters is what the visitor downloads for the first screen, not
   any one file. Per-file ceilings kept getting raised feature by feature, which
   is how budgets die; this one is the sum and it is the number worth defending. */
/* Raised from 43008 to 44032 on 12 August 2026, on Karthik's explicit call, to pay
   for the GitHub and X links: two icon paths plus a fourth contact row, 290 bytes
   gzipped. Recording it because the standing rule is that features are paid for by
   deletions and the ceiling holds, and a raise nobody wrote down is how a budget
   quietly stops meaning anything. This was the exception, not the new habit. */
t("first view stays under 43KB gzipped, all three files", () => {
  const gz = (f) => require("zlib").gzipSync(fs.readFileSync(f), { level: 9 }).length;
  const total = gz("index.html") + gz("assets/css/styles.css") + gz("assets/js/main.js");
  if (total >= 44032) console.log("    first view is " + total + " B gzipped");
  return total < 44032;
});
/* There was a per-file JS ceiling here too. It got raised three times in three
   passes, which is a gate that is not gating anything, and it measured a subset of
   the number above. Deleted rather than raised a fourth time. What was paid for
   along the way, in real deletions: the chat's fake 480ms typing indicator (it
   made a keyword matcher look like an LLM), the rotator's redundant focus
   handlers, and the palette's duplicate jump table. */
t("no third-party script or stylesheet other than the font CDN", () =>
  (html.match(/<script[^>]+src=/g) || []).every((s) => !/https?:/.test(s)));


/* ---- regressions found in review, each pinned so they cannot come back ---- */
t("no selector list mixes -webkit- and -moz- pseudo-elements", () =>
  !cssNoComments.split("}").some((rule) => {
    const sel = rule.split("{")[0] || "";
    return /-webkit-/.test(sel) && /-moz-/.test(sel);
  }));
t("range track is styled for both engines", () =>
  /::-webkit-slider-runnable-track/.test(css) && /::-moz-range-track/.test(css));
t("empty ledger columns have an explicit empty state", () =>
  $$(".gap-col").every((c) => $(".led-empty", c)));
t("portrait is back in the hero and only there", () =>
  !!$(".hero .hero-photo img") && $$("img[src*='Portrait']").length === 1);
t("eligibility facts moved out of the hero into contact", () =>
  !$(".hero-elig") && !!$("#contact .elig") && /No sponsorship required/.test($("#contact .elig").textContent));
t("no em dashes anywhere in the shipped files", () =>
  ["index.html", "assets/css/styles.css", "assets/js/main.js", "assets/kb.json"]
    .every((f) => !fs.readFileSync(f, "utf8").includes("\u2014")));


/* ---- defects found by the hostile review, each pinned ---- */
t("the slider fill is actually written by JS, not just declared in CSS", () =>
  /setProperty\("--p"/.test(js) && /--p:/.test(css));
t("the range announces its value as words", () => /aria-valuetext/.test(js));
t("webkit thumb has box-sizing, or its margin-top offset is wrong by 4px", () => {
  /* cssNoComments, because the comment explaining this bug contains braces */
  const m = cssNoComments.match(/::-webkit-slider-thumb\s*\{([^}]*)\}/);
  return !!m && /box-sizing:\s*border-box/.test(m[1]);
});
t("contact form body has no stray leading punctuation", () =>
  /\$\{msg\}\\n\\n\$\{name\}/.test(js));
t("no heading text is duplicated inside one section", () => {
  const norm = (s) => s.replace(/[^a-z]/gi, "").toLowerCase();
  return $$("main section").every((sec) => {
    /* h1/h2 only: two registry rows legitimately share their h3 column titles */
    const hs = $$("h1,h2", sec).map((h) => norm(h.textContent));
    return new Set(hs).size === hs.length;
  });
});
t("every triad target is clickable, including the centre and the labels", () =>
  $$("#triad [data-for]").length === 7 &&
  /closest\?\.\("\[data-for\]"\)/.test(js));
t("no role=region without an accessible name", () =>
  $$("[role=region]").every((r) => r.getAttribute("aria-label") || r.getAttribute("aria-labelledby")));
t("the caption is not a live region as well as a description", () =>
  !$("#gapCap").hasAttribute("aria-live"));
t("palette appends output instead of replacing the live region", () =>
  /insertAdjacentHTML\("beforeend"/.test(js) && !/palOut\.innerHTML \+ echo/.test(js));
t("localStorage access cannot kill the whole script", () =>
  /try \{ stored = localStorage/.test(js));
t("Cmd+K does not steal Ctrl+K from a text field", () =>
  /\^\(input\|textarea\)\$/.test(js));
t("a print stylesheet exists and un-hides the revealed content", () =>
  /@media print/.test(css) && /\.reveal \{ opacity: 1/.test(css));
t("no hardcoded hex outside the token blocks except traffic lights and print", () => {
  /* drop the two token blocks by name; slicing on a comment marker does not work
     here because cssNoComments has already removed the markers. */
  const body = cssNoComments
    .replace(/:root\s*\{[^}]*\}/, "")
    .replace(/\[data-theme="light"\]\s*\{[^}]*\}/, "");
  const hexes = (body.match(/#[0-9a-f]{3,6}\b/gi) || []).map((h) => h.toLowerCase());
  /* the three window dots, plus the print block, which must not use dark tokens */
  const allowed = ["#ff5f57", "#febc2e", "#28c840",
                   "#fff", "#111", "#333", "#555", "#bbb", "#ddd",
                   "#0a5c28", "#0b4a6f", "#7a4a06", "#8a1c1c",   /* print-only tokens */
                   "#000"];   /* a mask-image stop: only its alpha is used, never painted */
  const bad = [...new Set(hexes.filter((h) => !allowed.includes(h)))];
  if (bad.length) console.log("    untokenised colours:", bad.join(", "));
  return bad.length === 0;
});
t("every local href and src actually exists on disk", () => {
  const refs = [...html.matchAll(/(?:href|src)="(?!https?:|mailto:|tel:|data:|#)([^"]+)"/g)].map((m) => m[1]);
  const missing = refs.filter((r) => !fs.existsSync(r.split("?")[0]));
  if (missing.length) console.log("    missing files:", missing);
  return missing.length === 0;
});
t("dead CSS for removed markup is gone", () =>
  !/\.tline|\.type-caret|\.about-grid\b|\.about-photo/.test(css) &&
  /\.term-bar/.test(css));


/* ---- round two: the fixes that broke things, and their pins ---- */
t("the closed dialog does not render: display must be scoped to [open]", () => {
  const bare = cssNoComments.match(/(^|\n)\.pal\s*\{([^}]*)\}/);
  return !!bare && !/display\s*:/.test(bare[2]) && /\.pal\[open\]\s*\{[^}]*display:\s*flex/.test(cssNoComments);
});
t("no rendered text has a space before its punctuation", () => {
  /* the punctuation must be followed by a space or end, so `$ ./deploy` and
     `~/karthik` do not count as sentence punctuation. */
  const txt = $("main").textContent.replace(/\s+/g, " ");
  const hit = txt.match(/.{0,40} [:;,.!?](?=\s|$)/);
  if (hit) console.log("    space before punctuation:", JSON.stringify(hit[0]));
  return !hit;
});
t("triad labels fit inside the viewBox, allowing for their anchors", () => {
  const vb = $(".triad-svg").getAttribute("viewBox").split(" ").map(Number);
  const W = 78;   /* CONSULTANT at 12px mono with .08em tracking */
  return $$(".triad-svg .tl").every((n) => {
    const x = +n.getAttribute("x"), a = n.getAttribute("text-anchor");
    const l = a === "end" ? x - W : a === "middle" ? x - W / 2 : x;
    return l >= vb[0] && l + W <= vb[0] + vb[2];
  });
});
t("the portrait comes after the availability pill in DOM order", () => {
  const kids = Array.from($(".hero-top").children).map((n) => n.className);
  return kids.indexOf("hero-avail") < kids.indexOf("hero-photo");
});
t("the hero image is not fetchpriority high (it is not the LCP element)", () =>
  !/fetchpriority/.test(html));
t("form errors are announced, coloured as errors, and focused", () =>
  $("#formNote").getAttribute("aria-live") === "polite" &&
  /var\(--warn\)/.test(js) && /aria-invalid/.test(js) && /\$\(empty\[0\]\[0\]\)\.focus/.test(js));
t("theme is applied before first paint", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  return /localStorage\.getItem\("kj-theme"\)/.test(head);
});
t("color-scheme is declared for both themes", () =>
  /:root \{ color-scheme: dark/.test(css) && /color-scheme: light/.test(css));
t("print swaps the tokens, not just body colour", () => {
  const pr = css.slice(css.indexOf("@media print"));
  return /--text: #111/.test(pr) && /--bg: #fff/.test(pr);
});
t("details rows are opened for printing, since CSS cannot", () =>
  /beforeprint/.test(js) && /afterprint/.test(js));
t("reopening the palette does not wipe a half-typed command", () =>
  /const wasOpen = pal\.open/.test(js));
t("no element opacity is used to dim text (it undoes the contrast pass)", () => {
  const bad = [".s-local", ".n-warn"];
  return bad.every((sel) => {
    const m = cssNoComments.match(new RegExp("\\" + sel + "[^{]*\\{([^}]*)\\}"));
    return !m || !/(^|;|\s)opacity\s*:/.test(m[1]);
  });
});
t("dead CSS check is general, not a hardcoded list", () => {
  const classes = [...cssNoComments.matchAll(/(^|[\s,>+~])\.([a-z][a-z0-9-]{3,})(?=[\s,:{\[.])/gim)]
    .map((m) => m[2]);
  const used = new Set();
  html.replace(/class="([^"]+)"/g, (_, c) => c.split(/\s+/).forEach((x) => used.add(x)));
  /* classes added by JS at runtime, so they are never in the static markup */
  const known = new Set(["sr-only", "in", "open", "active", "scrolled", "show", "copied",
    "chat-msg", "chat-typing", "bot", "user", "pal-echo", "gap-col-label", "led-empty",
    "triad-stopped", "poked"]);
  const orphans = [...new Set(classes)].filter((c) => !used.has(c) && !known.has(c));
  if (orphans.length) console.log("    orphaned CSS classes:", orphans.join(", "));
  return orphans.length === 0;
});


/* ---- computed WCAG contrast over the token pairs the page actually uses ------
   Hand-computed contrast was wrong in two consecutive review rounds (a token was
   darkened "to 4.5" and was actually 4.19). This is exact arithmetic on values
   already parsed from the file, needs no layout, and is the only defect class in
   this codebase a jsdom suite can verify precisely rather than approximately. */
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
/* composite an rgba tint over an opaque surface, for the *-dim pill backgrounds */
const over = (rgba, bg) => {
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
  const base = srgb(bg);
  const mix = [r, g, b].map((c, i) => Math.round(+c * +a + base[i] * (1 - +a)));
  return "#" + mix.map((c) => c.toString(16).padStart(2, "0")).join("");
};

/* [foreground token, surface, smallest px it is used at] */
const PAIRS = [
  ["faint", "card-2", 11], ["faint", "card", 11], ["faint", "bg-2", 11], ["faint", "bg", 11],
  ["muted", "card", 12.5], ["muted", "bg-2", 13], ["muted", "card-2", 12.5],
  ["text", "card", 14], ["text", "bg", 16.5], ["text", "card-2", 14],
  ["accent", "bg-2", 13], ["accent", "card", 12], ["accent", "bg", 12.5],
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

/* ---- round three ---- */
t("the caption sits after the control, so its height cannot move the thumb", () => {
  const kids = Array.from($("#gap").children).map((n) => n.className || n.tagName.toLowerCase());
  return kids.indexOf("gap-slider") < kids.indexOf("gap-cap") && !/min-height/.test(
    (cssNoComments.match(/\.gap-cap\s*\{([^}]*)\}/) || ["", ""])[1]);
});
t("print un-names the details rows, or exclusivity leaves one row open", () =>
  /removeAttribute\("name"\)/.test(js) && /setAttribute\("name", "registry"\)/.test(js));
t("print swaps the status-colour tokens too", () => {
  const pr = cssNoComments.slice(cssNoComments.indexOf("@media print"));
  return /--live:/.test(pr) && /--build:/.test(pr) && /--warn:/.test(pr);
});
t("back-to-top is not focusable while invisible", () => {
  const base = cssNoComments.match(/\.to-top\s*\{([^}]*)\}/)[1];
  return /visibility:\s*hidden/.test(base) && /\.to-top\.show\s*\{[^}]*visibility:\s*visible/.test(cssNoComments);
});
t("mobile menu closes on Escape and outside click, and announces what it controls", () =>
  /aria-controls="navLinks"/.test(html) && /Escape" && navLinks/.test(js) && /closest\("\.nav-inner"\)/.test(js));
t("the chat button toggles, as its aria-expanded claims", () =>
  /chatPanel\.hidden \? openChat\(\) : closeChat\(\)/.test(js));
t("every empty field is flagged, and flags are cleared on every submit", () => {
  const h = js.slice(js.indexOf("#contactForm"), js.indexOf("Footer year"));
  return /fields\.forEach\(\(\[s\]\) => \$\(s\)\.removeAttribute\("aria-invalid"\)\)/.test(h) &&
         /empty\.forEach/.test(h);
});
t("no heading level is skipped inside any section", () =>
  $$("main section").every((sec) => {
    const lv = $$("h1,h2,h3,h4", sec).map((h2) => +h2.tagName[1]);
    return lv.every((v, i) => i === 0 || v <= lv[i - 1] + 1);
  }));
t("scroll handler cannot throw and strand every reveal at opacity 0", () =>
  /nav\?\.classList/.test(js) && /toTop\?\.classList/.test(js));
t("no empty media query blocks", () => !/@media[^{]*\{\s*\}/.test(cssNoComments));
t("triad pills are not a bogus navigation landmark", () => !$(".triad-pills[class]").matches("nav"));


/* the tinted-surface pairs the PAIRS table cannot express, computed the same way */
t("faint text stays AA on the stage-1 warning tint, in both themes", () => {
  const pct = +(cssNoComments.match(/var\(--warn\) (\d+)%, var\(--card-2\)/) || [0, 99])[1] / 100;
  const check = (block) => {
    const T = Object.assign({}, tokens(":root"), tokens(block));
    const w = srgb(T["warn"]), base = srgb(T["card-2"]);
    const tint = "#" + w.map((c, i) => Math.round(c * pct + base[i] * (1 - pct)).toString(16).padStart(2, "0")).join("");
    return ratio(T["faint"], tint) >= 4.5;
  };
  return check(":root") && check('[data-theme="light"]');
});
t("the strike-through is visible against the row it sits on (3:1 non-text)", () => {
  const check = (block) => {
    const T = Object.assign({}, tokens(":root"), tokens(block));
    return ratio(T["warn"], T["card-2"]) >= 3;
  };
  return check(":root") && check('[data-theme="light"]');
});
t("aria-describedby still resolves after the caption moved", () =>
  !!$("#" + $("#gapRange").getAttribute("aria-describedby")));
t("gap reads in a sensible order: control, then ticks, then caption", () => {
  const k = Array.from($("#gap").children).map((n) => n.className);
  return k.indexOf("gap-head") < k.indexOf("gap-slider") &&
         k.indexOf("gap-slider") < k.indexOf("gap-cap") &&
         k.indexOf("gap-cap") < k.indexOf("pipe");
});
t("every heading class the HTML uses is styled", () =>
  [".block-title", ".led-title", ".steps b", ".edu-item h3"]
    .every((s) => cssNoComments.includes(s)));
t("outside-click and Escape handlers cannot throw on a non-element target", () =>
  /e\.target\.closest\("\.nav-inner"\)/.test(js) && /navLinks\?\./.test(js));


/* ---- location and language policy ------------------------------------------
   Frankfurt is allowed only as a past employer's location in the experience log.
   It must not appear anywhere that locates him now, or that scopes what he is
   open to. Aachen appears in the contact block and the schema address only. */
t("no city locates him outside the job-history rows", () => {
  const jobLocs = new Set($$(".job-loc").map((n) => n.textContent.trim()));
  const strip = (s) => [...jobLocs].reduce((acc, l) => acc.split(l).join(""), s);
  const selfLocating = [
    $("title").textContent,
    $('meta[name="description"]').content,
    $('meta[property="og:title"]').content,
    $('meta[property="og:description"]').content,
    $(".hero-avail").textContent,
    $(".footer-brand p").textContent,
    $(".term-title").textContent
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
t("availability is role-scoped, not geography-scoped", () =>
  /open to forward-deployed \/ AI consulting roles/.test($(".hero-avail").textContent) &&
  !/EU-remote|Rhine-Main|NRW/.test(html + js + JSON.stringify(kb)));
t("German is B2 everywhere, and Hindi is untouched at B1", () => {
  const all = $("main").textContent + js + JSON.stringify(kb);
  return !/German\s*[·(]?\s*B1/.test(all) && /German\s*[·(]?\s*B2/.test(all) &&
         /Hindi\s*[·(]?\s*B1/.test($("main").textContent);
});


/* ---- testimonials ---- */
t("testimonials read Ivan, Katharina, Hiten, Anand", () =>
  JSON.stringify($$("#testimonials .quote-who b").map((n) => n.textContent.trim().split(" ")[0])) ===
  JSON.stringify(["Ivan", "Katharina", "Hiten", "Anand"]));
t("the direct-manager quote is the featured one and spans the row", () => {
  const first = $("#testimonials .quote-card");
  return first.classList.contains("quote-feature") &&
    /Ivan/.test(first.textContent) && /direct manager/.test(first.textContent) &&
    /\.quote-feature \{ grid-column: 1 \/ -1/.test(cssNoComments);
});
t("only the first paragraph of a quote gets an opening quote mark", () =>
  /p:first-child::before/.test(cssNoComments) &&
  !/blockquote p::before/.test(cssNoComments));
t("every avatar initial matches its name", () =>
  $$("#testimonials .quote-who").every((w) =>
    $(".av", w).textContent.trim() === $("b", w).textContent.trim()[0]));


/* ---- hero status bar ---- */
t("the legend sits in the deployments section, immediately above the log", () => {
  const sb = $(".statbar"), reg = $(".registry");
  return $("#systems").contains(sb) && !$(".hero").contains(sb) &&
    (sb.compareDocumentPosition(reg) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    sb.nextElementSibling === reg;
});
t("the section intro no longer repeats what the legend now shows", () => {
  const intro = $("#systems .section-head p").textContent;
  return !/<b>|Shipped<\/b>/.test(intro) && intro.length < 160 &&
         !/Local means|Planned means/i.test(intro);
});
t("the hero lead is one sentence, not a paragraph of explanation", () => {
  const lead = $(".hero-lead").textContent.trim();
  return lead.split(/(?<=\.)\s+/).length === 1 && lead.length < 90 &&
         !/40 minutes|defend the output/.test(lead);
});
t("statbar counts match the real registry, so the legend cannot drift", () => {
  const actual = {};
  $$(".sys .sys-status").forEach((s) => {
    const k = s.textContent.trim();
    actual[k] = (actual[k] || 0) + 1;
  });
  const claimed = {};
  $$(".statkey li").forEach((li) => {
    claimed[li.textContent.trim().split(/\s+/)[1]] = +$("b", li).textContent;
  });
  const same = JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(claimed).sort());
  if (!same) console.log("    registry:", JSON.stringify(actual), "legend:", JSON.stringify(claimed));
  return same;
});
t("the bar segments are proportional to the same counts", () => {
  const bars = $$(".statbar-track .sb").map((s) => +s.style.getPropertyValue("--n"));
  const keys = $$(".statkey b").map((b) => +b.textContent);
  return JSON.stringify(bars) === JSON.stringify(keys) &&
         bars.reduce((a, b) => a + b, 0) === $$(".sys").length;
});
t("the statbar reuses the deployment log's status colours", () =>
  ["s-shipped", "s-live", "s-local", "s-planned"].every((c) => !!$(".statbar-track ." + c)));
t("the decorative bar is hidden from AT and the caption is not", () =>
  $(".statbar-track").getAttribute("aria-hidden") === "true" &&
  /four shipped, one live/i.test($(".statbar figcaption").textContent));


t("the evidence cut from the hero survives somewhere on the page", () => {
  /* trimming the hero must not delete facts. These three are the strongest
     unfakeable claims available and they now live in deployment 01. */
  const body = $("main").textContent;
  return ["repeatable and explainable", "defend the output", "40 minutes"]
    .every((claim) => body.includes(claim));
});


/* ---- UX pass ---- */
t("exactly one filled accent button above the fold", () => {
  const above = [...$$(".nav .btn-primary"), ...$$(".hero .btn-primary")];
  return above.length === 1 && /Download CV/.test(above[0].textContent);
});
t("the hero primary action is the CV, not a scroll", () =>
  /Karthik_Javanappa_CV\.pdf/.test($(".hero .btn-primary").getAttribute("href")));
t("the palette door lives in the nav, where every app puts it", () =>
  $(".nav").contains($("#paletteOpen")) && !$(".hero").contains($("#paletteOpen")));
t("the palette reads its jump targets from the nav, not a second list", () =>
  /\$\$\("#navLinks a"\)\.map/.test(js));
t("the triad is driven by animationiteration on a real element, not a timer", () =>
  (js.match(/addEventListener\("animationiteration"/g) || []).length === 1 &&
  !/setInterval/.test(js) && !/requestAnimationFrame/.test(js) &&
  $("#triadBar").tagName === "I" && /\.ship-bar i \{/.test(cssNoComments));
t("the triad bar is slow enough to read a panel", () => {
  const m = cssNoComments.match(/\.triad-auto \.ship-bar i \{[^}]*animation-duration: ([\d.]+)s/);
  return !!m && +m[1] >= 6;
});
t("the panel column has a floor, so nothing below it moves as roles cycle", () =>
  /\.triad-panels \{ min-height: \d+px/.test(cssNoComments));
t("the controls sit below the stage, not beside the diagram", () => {
  const stage = $(".triad-stage"), ctl = $(".triad-controls");
  return !!ctl && !stage.contains(ctl) && stage.contains($(".triad-panels")) &&
    (stage.compareDocumentPosition(ctl) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
});
t("no triad label crosses its own arc", () => {
  /* each label sits on its lobe's outward radial from the centroid at r=150; the
     arc at that height is ~20px inside it. Inside the circles they crossed. */
  const C = { f: [180, 113], c: [132, 196], e: [228, 196] };
  return Object.entries(C).every(([k, [cx, cy]]) => {
    const el = $(".tl-" + k);
    const x = +el.getAttribute("x"), y = +el.getAttribute("y");
    return Math.hypot(x - cx, y - cy) > 76;
  });
});
t("the triad cycles all four roles and stops on a click, without persisting", () => {
  const block = js.slice(js.indexOf("triadAuto"));
  /* it used to write kj-triad-seen, the key the older one-time hint already set,
     so returning visitors arrived stopped and it never rotated. */
  return /"t-f", "t-c", "t-e", "t-fde"/.test(block) &&
    /stopped = true/.test(block) && /addEventListener\("click", stop\)/.test(block) &&
    !/kj-triad-seen/.test(jsNoComments);
});
t("the first registry row invites a click, and stops once one lands", () =>
  $$(".sys-poke").length === 1 && $(".sys").contains($(".sys-poke")) &&
  /registry\.classList\.add\("poked"\)/.test(js) &&
  /\.registry\.poked \.sys-poke \{ display: none/.test(cssNoComments));
t("hover lifts, and does not scale or recolour", () => {
  const fams = [".job", ".edu-item", ".award", ".quote-card", ".steps li"];
  const hover = cssNoComments.match(/\.job:hover[^{]*\{([^}]*)\}/)[1];
  /* a scale resampled the text; the recolours read as too much. Both gone. */
  const gone = ![".job:hover .job-role", ".edu-item:hover h3", ".quote-card:hover { background"]
    .some((sel) => cssNoComments.includes(sel));
  return fams.every((f) => cssNoComments.includes(f + ":hover")) &&
    /translateY\(-2px\)/.test(hover) && !/scale\(/.test(hover) &&
    /@media \(hover: none\)/.test(cssNoComments) && gone;
});
t("the proof strip supports the log instead of crowding the hero", () => {
  const proof = $(".proof");
  return $("#systems").contains(proof) && !$(".hero").contains(proof) &&
    (proof.compareDocumentPosition($(".statbar")) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
});
t("about comes before deployments, in the page and in the nav", () => {
  const ids = $$("main > section").map((s) => s.id);
  const nav = $$("#navLinks a").map((a) => a.hash);
  return ids[1] === "about" && ids[2] === "systems" &&
    nav.indexOf("#about") < nav.indexOf("#systems");
});
t("adjacent sections still alternate their background", () => {
  const secs = $$("main > section.section");
  return secs.every((s, i) => s.classList.contains("alt") === (i % 2 === 1));
});
t("the palette chip names the platform modifier and has a visible label", () =>
  !!$("#palKey") && !!$(".kbd-label") && /isApple/.test(js) &&
  $("#paletteOpen").getAttribute("aria-keyshortcuts") === "Meta+K Control+K");
t("the triad says it is cycling and how to stop it", () =>
  !!$("#triadHint") && /Click any lobe to stop/.test($("#triadHint").textContent));
t("each triad panel has its own glyph", () =>
  $$(".triad-panels .tp .tp-glyph").length === 4);
t("section labels are no longer filled green pills", () => {
  const eb = cssNoComments.match(/\.eyebrow \{([^}]*)\}/)[1];
  return !/background:\s*var\(--accent-dim\)/.test(eb) && /var\(--faint\)/.test(eb);
});
/* a raw count needed bumping every time a UI micro-label was added, which is not
   what the rule is about. Check the prose rules by name instead. */
t("running prose is Inter; mono is only on labels, ids, dates and the terminal", () => {
  const prose = [".elig dd", ".adopt", ".led-col li", ".statkey span", ".chat-note",
                 ".footer-bottom p", ".tp-why", ".rot-list span", ".steps span:last-child"];
  const bad = prose.filter((sel) => {
    const m = cssNoComments.match(new RegExp(sel.replace(/[.:]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
    return m && /var\(--font-mono\)/.test(m[1]);
  });
  if (bad.length) console.log("    mono in prose:", bad.join(", "));
  return bad.length === 0 && (cssNoComments.match(/var\(--font-body\)/g) || []).length >= 12;
});
/* cap the text elements, not the padded box: .sys-body carries 126px of padding,
   so a max-width there is not the measure the reader sees. */
t("long-form text has a capped measure, on the text and not on its padded box", () =>
  [".pc-pai dd", ".sys-more", ".tp ", ".section-head", ".gap-cap"].every((sel) =>
    new RegExp(sel.trim().replace(/\./g, "\\.").replace(/ /g, "\\s") + "[^{]*\\{[^}]*max-width").test(cssNoComments)));
t("the caption cap is not overridden by a later duplicate rule", () =>
  (cssNoComments.match(/\.gap-cap\s*\{/g) || []).length === 1);
t("the contact section explains what happens after you write, after the ask", () => {
  const steps = $$("#contact .steps li"), grid = $("#contact .contact-grid");
  return steps.length === 3 && /You write/.test(steps[0].textContent) &&
    /if it does not I will say that too/.test(steps[2].textContent) &&
    (grid.compareDocumentPosition($(".steps")) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
});
t("the display sizes are set deliberately, and the rest snap to a six-step scale", () => {
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
t("nothing animates purely to attract attention", () =>
  !/animation: nudge/.test(cssNoComments) && !/\.brand \.caret \{[^}]*animation/.test(cssNoComments));
t("exactly one element is foreground; the rest are hairline-lit", () => {
  const hero = (cssNoComments.match(/var\(--shadow-hero\)/g) || []).length;
  const edgeOnly = (cssNoComments.match(/box-shadow: var\(--edge\);/g) || []).length;
  return /--shadow-hero:/.test(css) && hero === 1 && edgeOnly >= 4;
});
t("the foreground surface has a lit gradient, not a flat fill", () =>
  /--surface-hero: linear-gradient/.test(css) &&
  /\.gap \{[^}]*background: var\(--surface-hero\)/s.test(cssNoComments));


/* ---- narrow widths: audited breakpoint by breakpoint ---- */
t("every wrapping component has an explicit narrow rule", () => {
  const bp = {};
  for (const m of cssNoComments.matchAll(/@media \(max-width: (\d+)px\) \{/g)) {
    const w = +m[1];
    let i = m.index + m[0].length, depth = 1;
    while (depth && i < cssNoComments.length) {
      if (cssNoComments[i] === "{") depth++;
      else if (cssNoComments[i] === "}") depth--;
      i++;
    }
    bp[w] = (bp[w] || "") + cssNoComments.slice(m.index, i);
  }
  const all = Object.values(bp).join("");
  const need = ["pipe", "marquee-track", "hero-cta", "footer-top", "footer-cols",
                "awards-list", "tag-row", "contact-grid", "triad-stage",
                "gap-cols", "ledger", "steps", "elig", "quote-grid", "statkey"];
  const missing = need.filter((c) => !all.includes("." + c));
  if (missing.length) console.log("    no narrow rule for:", missing.join(", "));
  return missing.length === 0;
});
t("the nav controls are the same height", () => {
  const chip = cssNoComments.match(/\.kbd-chip \{([^}]*)\}/)[1];
  const icon = cssNoComments.match(/\.icon-btn \{([^}]*)\}/)[1];
  const h = (s) => (s.match(/height:\s*(\d+)px/) || [])[1];
  return h(chip) === h(icon);
});
t("the gutter tightens on a phone rather than eating the content", () =>
  /@media \(max-width: 860px\) \{\s*\.container \{ width: min\(1080px, 100% - 32px\)/.test(cssNoComments));


/* ---- animated icons, without an icon runtime ----
   Lordicon needs its player, animate-ui needs React plus Motion, IconScout's
   Lottie needs lottie-web. Any of the three is multiples of this page's whole
   transfer budget for a handful of 32px glyphs, so the look is reproduced with
   pathLength and stroke-dashoffset instead. This test is the thing that keeps
   that decision from quietly reversing. */
t("no icon or animation runtime was added", () => {
  /* comment-stripped: the CSS comment that explains this decision names the
     libraries it rejected, and would otherwise trip its own test. */
  const banned = /lottie|lordicon|framer-motion|motion\/react|gsap|animejs|@lottiefiles/i;
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, "");
  return !banned.test(htmlNoComments) && !banned.test(jsNoComments) && !banned.test(cssNoComments) &&
    (html.match(/<script[^>]+src=/g) || []).length === 1;
});
t("the glyphs draw themselves with pathLength, so no path is measured in JS", () => {
  const glyphs = $$(".tp-glyph");
  return glyphs.length === 4 &&
    glyphs.every((g) => $$("path,circle", g).every((n) => n.getAttribute("pathLength") === "1")) &&
    /stroke-dasharray: 1;/.test(cssNoComments) && /@keyframes draw/.test(cssNoComments) &&
    !/getTotalLength/.test(js);
});


t("the four panels are close enough in length not to jolt the layout", () => {
  const words = $$(".triad-panels .tp").map((a) => a.textContent.trim().split(/\s+/).length);
  const spread = Math.max(...words) - Math.min(...words);
  if (spread > 12) console.log("    panel word counts: " + words.join(", "));
  return spread <= 12 && Math.max(...words) <= 72;
});
t("the diagram is the largest thing in the section, not the text rule", () => {
  const col = cssNoComments.match(/\.triad-stage \{[^}]*grid-template-columns: minmax\(0, (\d+)px\)/);
  const rule = cssNoComments.match(/\.tp \{[^}]*border-left: (\d+)px solid var\(--([\w-]+)\)/s);
  return +col[1] >= 460 && +rule[1] === 1 && rule[2] !== "accent";
});


/* ---- shipped at: a CSS-only marquee ---- */
t("the marquee is two identical tracks, the duplicate hidden from AT", () => {
  const tracks = $$("#rot .marquee-track");
  return tracks.length === 2 &&
    tracks[0].textContent.trim() === tracks[1].textContent.trim() &&
    tracks[1].getAttribute("aria-hidden") === "true" &&
    !tracks[0].hasAttribute("aria-hidden");
});
t("every company is named once per track", () => {
  const names = $$("#rot .marquee-track:first-child li").map((n) => n.textContent.trim());
  return names.length >= 6 && new Set(names).size === names.length &&
    names.includes("EY-Parthenon") && names.includes("Schaeffler");
});
t("the marquee needs no JS at all", () =>
  /@keyframes marquee/.test(cssNoComments) &&
  /\.marquee:hover \.marquee-track \{[^}]*paused/.test(cssNoComments) &&
  !/marquee/i.test(jsNoComments));
t("it fades at both ends rather than cutting off", () => {
  const m = cssNoComments.match(/\.marquee \{([^}]*)\}/)[1];
  return /mask-image: linear-gradient\(90deg, transparent/.test(m) &&
    /-webkit-mask-image/.test(m) && /overflow: hidden/.test(m);
});
t("reduced motion gets a plain wrapped list, not a frozen strip", () => {
  const i = cssNoComments.indexOf("@media (prefers-reduced-motion: reduce) {\n  .marquee");
  const rm = cssNoComments.slice(i, i + 400);
  return i > 0 && /animation: none/.test(rm) && /flex-wrap: wrap/.test(rm) &&
    /\.marquee-track \+ \.marquee-track \{ display: none/.test(rm);
});
t("the scrubber now opens the deployments section instead of padding the hero", () => {
  const gap = $("#gap");
  return $("#systems").contains(gap) && !$(".hero").contains(gap) &&
    (gap.compareDocumentPosition($(".registry")) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
});
t("the label reads 'shipped at'", () =>
  $("#rot .dep-label").textContent.trim() === "// shipped at");


/* ---- this round ---- */
t("the shipped-at label is styled like every other eyebrow", () => {
  const dep = cssNoComments.match(/\.dep-label \{([^}]*)\}/);
  const eye = cssNoComments.match(/\.eyebrow \{([^}]*)\}/)[1];
  const px = (s) => (s.match(/(\d+)px/) || [])[1];
  /* it had no rule at all after the deploy-log block was deleted, so it rendered
     as unstyled 17px body text and stood out from every other section label. */
  return !!dep && px(dep[1]) === px(eye) &&
    /var\(--font-mono\)/.test(dep[1]) && /var\(--faint\)/.test(dep[1]);
});
t("the marquee has room above it", () => {
  const m = cssNoComments.match(/\.rot \{ margin: (\d+)px/);
  return !!m && +m[1] >= 48;
});
t("the H1 is smaller than it was, and still a display size", () => {
  const m = cssNoComments.match(/\.hero-h1 \{[^}]*font-size: clamp\((\d+)px, [\d.]+vw, (\d+)px\)/s);
  return !!m && +m[2] <= 56 && +m[2] >= 44;
});
t("every marquee name links to the row it refers to, and the target exists", () => {
  const links = $$("#rot .marquee-track:first-child a");
  return links.length === 7 && links.every((a) => {
    const target = window.document.getElementById(a.hash.slice(1));
    return !!target && target.textContent.includes(a.textContent.trim().split(" ")[0]);
  });
});
/* aria-hidden on a container does NOT remove its links from the tab order, so the
   duplicate was six phantom stops reading the same names. The earlier version of
   this assertion had `|| true` in it and therefore checked nothing. */
t("the duplicate marquee track is not in the tab order", () =>
  $$("#rot .marquee-track").length === 2 &&
  $$('#rot .marquee-track[aria-hidden="true"] a').length === 7 &&
  $$('#rot .marquee-track[aria-hidden="true"] a').every((a) => a.getAttribute("tabindex") === "-1") &&
  $$('#rot .marquee-track:first-child a').every((a) => !a.hasAttribute("tabindex")));
t("anchor targets clear the sticky nav", () =>
  /main section\[id\], \.job\[id\] \{ scroll-margin-top: (\d+)px/.test(cssNoComments) &&
  +cssNoComments.match(/scroll-margin-top: (\d+)px/)[1] >= 64);
t("the scrubber is collapsed, and print opens it with the registry", () => {
  const d = $("#gapWrap");
  return !!d && d.tagName === "DETAILS" && !d.open && d.contains($("#gap")) &&
    /\$\$\("\.sys, \.gap-wrap"\)/.test(js) &&
    /gap-wrap > summary/.test(cssNoComments);
});

/* ---- mobile rules, pinned ----
   These four rules are the fix for four real defects found on a phone. Pinning
   them here is cheap; it is not a substitute for the layout pass below. */
t("the triad diagram is never display:none", () =>
  !/\.triad-svg \{[^}]*display:\s*none/.test(cssNoComments));
t("the proof strip drops to two columns and then one", () => {
  const two = /max-width: 7\d\dpx\) \{ \.proof \{ grid-template-columns: 1fr 1fr/.test(cssNoComments);
  const one = /max-width: 4\d\dpx\) \{ \.proof \{ grid-template-columns: 1fr;/.test(cssNoComments);
  return two && one;
});
/* a flex item sizes to max-content, and one child of .hero-top is a 2000px
   marquee: without this cap it sets the width of the whole document */
t("the mobile hero caps its flex children", () =>
  /\.hero-top > \* \{ max-width: 100%; min-width: 0; \}/.test(cssNoComments));
t("the chat pill becomes a corner circle on a phone", () =>
  /\.chat-fab \{ width: 52px; height: 52px;[^}]*border-radius: 50%/.test(cssNoComments));

const report = () => {
  pass.forEach((p) => console.log("  ✓ " + p));
  if (fail.length) { console.log("\nFAIL:"); fail.forEach((f) => console.log("  ✗ " + f)); }
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
};

/* ---- real layout, in a real engine ----
   Everything above this line runs in jsdom, which has no layout engine. It cannot
   see a grid column clipped off the right edge or a headline pushed below the
   fold, which is precisely how a green suite shipped a broken phone layout: the
   proof strip was four fixed columns inside overflow:hidden at every width, so
   half of it was invisible on every phone ever made. This pass renders the page
   in Chromium at four widths and fails on overflow. It skips, loudly, when
   playwright is absent, so the suite still runs with jsdom alone. */
(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (e) { /* optional */ }
  if (!chromium) {
    console.log("\n  ! layout pass SKIPPED: no playwright.");
    console.log("    npm i -D playwright && npx playwright install chromium");
    return report();
  }
  const url = "file://" + require("path").resolve("index.html");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const listed = (arr, label) => {
    if (arr.length) console.log("      " + label + ": " + [...new Set(arr)].slice(0, 6).join(", "));
    return arr.length === 0;
  };
  /* 861 and 1024 are in this list because the range between the mobile-nav
     breakpoint and about 1090 had a horizontal scrollbar and nobody had looked:
     the nav was 1042px of content in a 976px bar. Phone widths alone would not
     have found it. */
  for (const w of [320, 360, 390, 430, 768, 861, 1024, 1440]) {
    const touch = w < 700;
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" });
    /* open every disclosure: a closed <details> is not laid out, so leaving them
       shut hides most of the page from this check */
    await page.evaluate(() => {
      document.querySelectorAll("details").forEach((d) => { d.removeAttribute("name"); d.open = true; });
      document.querySelectorAll(".reveal").forEach((e) => { e.style.opacity = 1; e.style.transform = "none"; });
    });
    await page.waitForTimeout(400);
    const r = await page.evaluate((vw) => {
      const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "");
      const out = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, past: [], clipped: [], proofOut: 0, svg: 0 };
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("sr-only")) continue;
        if (el.closest(".marquee")) continue;          /* a marquee is meant to run off both edges */
        const b = el.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        if (b.right > vw + 1 || b.left < -1) out.past.push(name(el));
        if (el.scrollWidth > el.clientWidth + 4 && cs.overflowX === "hidden") out.clipped.push(name(el));
      }
      out.proofOut = [...document.querySelectorAll(".pf")].filter((el) => el.getBoundingClientRect().right > vw + 1).length;
      const svg = document.querySelector(".triad-svg");
      out.svg = svg ? Math.round(svg.getBoundingClientRect().width) : 0;
      const nav = document.querySelector(".nav-inner");
      out.navFits = !nav || nav.scrollWidth <= nav.clientWidth + 1;
      return out;
    }, w);
    t(`${w}px: no horizontal scroll`, () => r.sw <= r.cw + 1);
    t(`${w}px: nothing past the viewport edge`, () => listed(r.past, "past"));
    t(`${w}px: nothing clipped by overflow:hidden`, () => listed(r.clipped, "clipped"));
    t(`${w}px: all four proof items are on screen`, () => r.proofOut === 0);
    if (w >= 700) t(`${w}px: the nav bar fits its own width`, () => r.navFits);
    if (w < 700) t(`${w}px: the triad diagram is actually rendered`, () => r.svg > 200);
    await ctx.close();
  }
  /* A nav that fits at 1024 and at 1440 can still not fit at 1000. Spot checks
     miss narrow bands, and there were two: 861 to 879, and 961 to 1001 where the
     "Search ⌘K" label appeared before the bar had room for it. Sweeping is cheap
     on one page with setViewportSize, so sweep. */
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
