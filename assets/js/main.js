/* ===========================================================================
   Karthik Javanappa. Portfolio interactions
   No dependencies. Progressive-enhancement only.
   =========================================================================== */
(function () {
  "use strict";

  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Theme toggle (persisted) ---------------------------------------- */
  const root = document.documentElement;
  const themeToggle = $("#themeToggle");
  let stored = null;
  try { stored = localStorage.getItem("kj-theme"); } catch (_) { /* storage blocked */ }
  if (stored) root.setAttribute("data-theme", stored);

  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("kj-theme", next); } catch (_) { /* storage blocked */ }
  });

  /* ---- Sticky nav background on scroll ---------------------------------- */
  const nav = $("#nav");
  const toTop = $("#toTop");
  const onScroll = () => {
    const y = window.scrollY;
    nav?.classList.toggle("scrolled", y > 24);
    toTop?.classList.toggle("show", y > 700);   /* a throw here would leave every .reveal at opacity 0 */
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ------------------------------------------------------ */
  const navToggle = $("#navToggle");
  const navLinks = $("#navLinks");
  const closeMenu = () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  };
  navToggle?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    /* the toggle sits after the links in DOM order, so without this Tab leaves
       the menu and the links are only reachable by shift-Tab. */
    if (open) navLinks.querySelector("a")?.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks?.classList.contains("open")) { closeMenu(); navToggle.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (navLinks?.classList.contains("open") && !e.target.closest(".nav-inner")) closeMenu();
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", closeMenu));

  /* ---- Active link highlight (scroll spy) ------------------------------- */
  const sections = $$("main section[id]");
  const linkFor = (id) => $(`#navLinks a[href="#${id}"]`);
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && linkFor(e.target.id)) {
            $$("#navLinks a").forEach((a) => a.classList.remove("active"));
            linkFor(e.target.id).classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---- Scroll reveal ---------------------------------------------------- */
  const reveals = $$(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---- Contact form → mailto ------------------------------------------- */
  const form = $("#contactForm");
  const note = $("#formNote");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#cf-name").value.trim();
    const email = $("#cf-email").value.trim();
    const msg = $("#cf-msg").value.trim();
    const fields = [["#cf-name", name], ["#cf-email", email], ["#cf-msg", msg]];
    fields.forEach(([s]) => $(s).removeAttribute("aria-invalid"));   /* clear first, every time */
    const empty = fields.filter(([, v]) => !v);
    if (empty.length) {
      note.textContent = "Please fill in every field before sending.";
      note.style.color = "var(--warn)";
      empty.forEach(([s]) => $(s).setAttribute("aria-invalid", "true"));
      $(empty[0][0]).focus();   /* an error nobody is sent to is not feedback */
      return;
    }
    const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
    const body = encodeURIComponent(`${msg}\n\n${name}\n${email}`);
    window.location.href = `mailto:kjavanappa@gmail.com?subject=${subject}&body=${body}`;
    note.textContent = "Opening your email app… if nothing happens, write to kjavanappa@gmail.com. I usually reply within a day.";
    note.style.color = "var(--muted)";
  });

  /* ---- Footer year ------------------------------------------------------ */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Systems registry accordion ---------------------------------------
     <details name="registry"> gives native single-open behaviour in modern
     browsers; this closes siblings manually where `name` isn't supported. */
  const sysEntries = $$(".sys");
  if (sysEntries.length && !("name" in document.createElement("details"))) {
    sysEntries.forEach((d) => {
      d.addEventListener("toggle", () => {
        if (d.open) sysEntries.forEach((o) => { if (o !== d) o.open = false; });
      });
    });
  }

  /* ---- Print: open every registry row -----------------------------------
     display:block on a closed <details> does not reveal its body, and
     ::details-content is Chrome-only, so the deployment log would print as
     nine one-line summaries. Restore state afterwards. */
  let printOpened = [];
  window.addEventListener("beforeprint", () => {
    printOpened = $$(".sys, .gap-wrap").filter((d) => !d.open);
    /* drop `name` first: exclusive-accordion semantics close each previous row as
       the loop opens the next, so without this exactly one row would print open,
       and the row the user had open would be closed by the cascade. */
    $$(".sys").forEach((d) => d.removeAttribute("name"));
    printOpened.forEach((d) => { d.open = true; });
  });
  window.addEventListener("afterprint", () => {
    printOpened.forEach((d) => { d.open = false; });
    $$(".sys").forEach((d) => d.setAttribute("name", "registry"));
    printOpened = [];
  });

  /* ---- Click-to-copy email ---------------------------------------------- */
  const copyBtn = $("#copyEmail");
  copyBtn?.addEventListener("click", async () => {
    const text = copyBtn.dataset.copy || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* noop */ }
      ta.remove();
    }
    copyBtn.classList.add("copied");
    clearTimeout(copyBtn._t);
    copyBtn._t = setTimeout(() => copyBtn.classList.remove("copied"), 1800);
  });

  /* =========================================================================
     Ask my AI, mini chat widget
     Set CHAT_WEBHOOK_URL to the n8n webhook endpoint to go live. It receives
     POST {"message": ".."} and must respond {"reply": ".."}. While the URL
     is empty (or the call fails), a keyword-matched FAQ over the knowledge
     base below answers instead, so the widget works without a backend.
     ========================================================================= */
  const CHAT_WEBHOOK_URL = ""; // e.g. "https://your-n8n-host/webhook/ask-karthik"

  /* Knowledge base lives in assets/kb.json and is fetched on first open, so the
     ~9KB of answer text is not in the critical path for the 95% who never open
     the chat. Trade-off: the chat needs http, so it is inert on a file:// open.
     ponytail: no cache-busting. Add a hash to the URL if it ever goes stale. */
  let KB = null;
  const loadKB = () => fetch("assets/kb.json").then((r) => r.json()).then((d) => (KB = d));

  const chatFab = $("#chatFab");
  const chatPanel = $("#chatPanel");
  const chatClose = $("#chatClose");
  const chatLog = $("#chatLog");
  const chatForm = $("#chatForm");
  const chatInput = $("#chatInput");
  const chatChips = $("#chatChips");

  if (chatFab && chatPanel) {
    let greeted = false;

    const addMsg = (text, who) => {
      const div = document.createElement("div");
      div.className = `chat-msg ${who}`;
      div.textContent = text;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
      return div;
    };

    /* render contextual suggestion chips */
    const renderChips = (list) => {
      chatChips.textContent = "";
      if (!list || !list.length) { chatChips.hidden = true; return; }
      chatChips.hidden = false;
      list.forEach((q) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.q = q;
        b.textContent = q;
        chatChips.appendChild(b);
      });
    };

    /* typo tolerance, small edit distance for near-miss words */
    const editDistance = (a, b) => {
      const m = a.length, n = b.length;
      if (!m) return n;
      if (!n) return m;
      let prev = Array.from({ length: n + 1 }, (_, i) => i);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
          cur[j] = a[i - 1] === b[j - 1]
            ? prev[j - 1]
            : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        }
        prev = cur;
      }
      return prev[n];
    };
    const fuzzyHit = (token, kw) => {
      if (token === kw) return true;
      const len = Math.max(token.length, kw.length);
      if (len < 4) return false;
      const tol = len <= 5 ? 1 : len <= 8 ? 2 : 3;
      return editDistance(token, kw) <= tol;
    };
    /* common filler words skip the fuzzy path (e.g. "there" ≈ "where") */
    const STOP = new Set([
      "the", "this", "that", "these", "those", "there", "their", "they", "them", "then",
      "what", "when", "where", "which", "while", "with", "your", "you", "have", "has",
      "his", "him", "her", "and", "are", "was", "were", "for", "from", "here", "good",
      "about", "tell", "does", "did", "how", "who", "why", "into", "over", "some", "more"
    ]);

    /* score topics by keyword overlap, tolerant of typos and word boundaries */
    const matchTopic = (question) => {
      const q = question.toLowerCase();
      const tokens = q.replace(/[^a-z0-9&+ ]/g, " ").split(/\s+/).filter(Boolean);
      const fuzzyTokens = tokens.filter((t) => !STOP.has(t));
      let best = null, bestScore = 0;
      KB.topics.forEach((topic) => {
        let score = 0;
        topic.keywords.forEach((kw) => {
          if (kw.includes(" ")) {                                   // multi-word phrase
            if (q.includes(kw)) score += 3;
          } else if (kw.length <= 3) {                              // short word, whole-token only
            if (tokens.includes(kw)) score += 2;
          } else if (tokens.includes(kw) || q.includes(kw)) {       // exact
            score += 2;
          } else if (fuzzyTokens.some((t) => fuzzyHit(t, kw))) {    // near-miss / typo
            score += 1;
          }
        });
        if (score > bestScore) { bestScore = score; best = topic; }
      });
      return best;
    };

    const callWebhook = async (question) => {
      try {
        const res = await fetch(CHAT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.reply === "string" && data.reply.trim()) return data.reply;
        }
      } catch (_) { /* fall through to local FAQ */ }
      return null;
    };

    const ask = async (question) => {
      addMsg(question, "user");
      renderChips([]);
      if (!KB) { try { await loadKB(); } catch (_) {
        addMsg("My knowledge base isn't reachable right now. Email kjavanappa@gmail.com and you'll get a human answer faster anyway.", "bot");
        return;
      } }

      const topic = matchTopic(question);               // also drives follow-up chips
      let reply = topic ? topic.answer : KB.fallback;
      if (CHAT_WEBHOOK_URL) {
        const remote = await callWebhook(question);
        if (remote) reply = remote;
      }

      /* no artificial delay: the local tier is a keyword match and it is instant.
         Faking latency to look like an LLM is the one thing this page does not do. */
      addMsg(reply, "bot");
      renderChips((topic && KB.followups[topic.id]) || KB.followups.default);
    };

    const openChat = async () => {
      chatPanel.hidden = false;
      chatFab.setAttribute("aria-expanded", "true");
      chatInput.focus();
      if (greeted) return;
      greeted = true;
      try {
        if (!KB) await loadKB();
        addMsg(KB.greeting, "bot");
        renderChips(KB.followups.default);
      } catch (_) {
        addMsg("I can't reach my knowledge base from here. That happens when the page is opened as a local file rather than over the web. Everything it knows is on this page anyway, or email kjavanappa@gmail.com.", "bot");
      }
    };
    const closeChat = () => {
      chatPanel.hidden = true;
      chatFab.setAttribute("aria-expanded", "false");
      chatFab.focus();
    };

    chatFab.addEventListener("click", () => (chatPanel.hidden ? openChat() : closeChat()));
    chatClose.addEventListener("click", closeChat);
    chatPanel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeChat();
    });

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = chatInput.value.trim();
      if (!q) return;
      chatInput.value = "";
      ask(q);
    });

    chatChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-q]");
      if (btn) ask(btn.dataset.q);
    });
  }

  /* =========================================================================
     THE GAP, hero scrubber
     The range input holds the state; CSS reads data-stage off the figure and
     does everything else. All this does is copy one number and swap a caption.
     ====================================================================== */
  const gap = $("#gap");
  const gapRange = $("#gapRange");
  if (gap && gapRange) {
    const STAGES = [
      ["demo", "Four nodes, a clean happy path, a room full of people nodding. Every enterprise AI demo works. That is what demos are for."],
      ["pilot", "Then it meets the actual documents and the actual permissions. Retrieval breaks on scanned pages, the model answers anyway, and nobody can tell which answers to trust. This is where most projects quietly stop."],
      ["production", "What closes the gap is not a better model. It is citations you can check, a system that refuses instead of guessing, and a human at the gate, built to the constraints rather than around them."]
    ];
    const stageEl = $("#gapStage"), capEl = $("#gapCap");
    /* The range is 0..200 rather than 0..2 so the thumb and the fill move
       continuously under the finger; the stage is the nearest of three stops.
       Arrow keys still step 1/200th, so Home/End and page keys do the useful
       jumps and a drag feels like a drag.
       ponytail: the 100-unit granularity is arbitrary but it is one number. */
    const paint = (force) => {
      const raw = +gapRange.value / +gapRange.max;        /* 0..1, continuous */
      const i = Math.round(raw * (STAGES.length - 1));    /* nearest stop */
      gapRange.style.setProperty("--p", raw);
      if (force || gap.dataset.stage !== String(i)) {
        gap.dataset.stage = String(i);
        stageEl.textContent = STAGES[i][0];
        capEl.textContent = STAGES[i][1];
        gapRange.setAttribute("aria-valuetext", STAGES[i][0]);
      }
    };
    /* snap to the nearest stop when the finger lifts, so it always rests on a stage */
    const settle = () => {
      const i = Math.round((+gapRange.value / +gapRange.max) * (STAGES.length - 1));
      gapRange.value = String((i / (STAGES.length - 1)) * +gapRange.max);
      paint();
    };
    gapRange.addEventListener("input", paint);
    gapRange.addEventListener("change", settle);
    gapRange.addEventListener("keyup", settle);
    paint(true);   /* force: the markup default and the computed stage must agree */
  }

  /* ---- Triad: click the circles, and hint once ---------------------------
     ponytail: state, styling, keyboard and the no-JS case are all handled by
     the radio group in the markup. This only buys click-on-lobe plus a nudge
     that a returning visitor never sees again. */
  const triad = $("#triad");
  triad?.addEventListener("click", (e) => {
    const id = e.target.closest?.("[data-for]")?.dataset.for;
    if (id) $("#" + id).click();
  });
  const triadAuto = $("#triadAuto"), triadBar = $("#triadBar");
  if (triad && triadAuto && triadBar && !prefersReduced) {
    /* cycle the radios themselves, so the diagram, the pills and the panel all
       follow from the one piece of state they already share */
    const radios = $$(".tr-in", triad);
    const order = ["t-f", "t-c", "t-e", "t-fde"].map((id) => radios.find((r) => r.id === id));
    let stopped = false;
    triadBar.addEventListener("animationiteration", () => {
      if (stopped) return;
      const at = order.findIndex((r) => r.checked);
      order[(at + 1) % order.length].checked = true;
    });
    /* a click means the visitor has taken over: stop for this visit. Deliberately
       not persisted. The previous version wrote kj-triad-seen, which the older
       one-time hint had already set, so every returning visitor arrived stopped
       and the thing never rotated at all. */
    const stop = () => {
      if (stopped) return;
      stopped = true;
      triad.classList.add("triad-stopped");
      triadAuto.hidden = true;
    };
    triad.addEventListener("change", stop);
    triad.addEventListener("click", stop);
  }

  /* ---- the first registry row says it opens, until one does ---------------- */
  const registry = $(".registry");
  registry?.addEventListener("toggle", () => registry.classList.add("poked"), { capture: true, once: true });

  /* ---- Command palette: name the modifier the visitor actually has --------
     The chip said Cmd+K to everyone, including Windows and Linux readers. */
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const palKey = $("#palKey");
  if (palKey && isApple) palKey.textContent = "\u2318";

  /* =========================================================================
     COMMAND PALETTE + TERMINAL, one <dialog>, two doors
     Native dialog gives focus trap, Esc and ::backdrop for free. The command
     output reads the page, so it cannot drift out of sync with the content.
     ====================================================================== */
  const pal = $("#palette");
  if (pal) {
    const palIn = $("#palInput"), palOut = $("#palOut");

    /* the nav already lists every section; reading it here means one source of
       truth and no table to keep in step when a section is renamed. */
    const jumps = $$("#navLinks a").map((a) => [a.textContent.trim(), a.hash, "jump to " + a.textContent.trim()])
      .concat([
        ["triad", "#about", "founder / consultant / engineer, and the intersection"],
        ["cv", "assets/Karthik_Javanappa_CV.pdf", "download the CV as PDF"],
        ["linkedin", "https://www.linkedin.com/in/karthikjp/", "open my LinkedIn"]
      ]);

    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const append = (html) => { palOut.insertAdjacentHTML("beforeend", html); palOut.scrollTop = palOut.scrollHeight; };

    /* read the registry out of the DOM: one source of truth, always current */
    const lsDeployments = () =>
      $$(".sys").map((d) => {
        const id = $(".sys-id", d).textContent.trim();
        const name = $(".sys-name b", d).textContent.trim();
        const st = $(".sys-status", d).textContent.trim();
        const env = $(".sys-env", d).textContent.trim();
        return `  ${id}  ${name.padEnd(22)}${st.padEnd(10)}${env}`;
      }).join("\n");

    const COMMANDS = {
      help: () =>
        "  ls deployments   every system and its real status\n" +
        "  cat triad        the three-lobe claim, in text\n" +
        "  guardrails       how I keep an agent from going rogue\n" +
        "  whoami           the short version\n" +
        "  hire             availability, work authorisation, languages\n" +
        "  clear            clear this output\n\n" +
        "  Anything else is treated as a jump: try `contact` or `cv`.",
      whoami: () =>
        "  Karthik Javanappa, forward deployed AI engineer.\n" +
        "  Founder who owned a P&L. Consultant who held the room.\n" +
        "  Engineer who shipped the code. The intersection is the job.",
      "cat triad": () =>
        "  founder      + consultant  = advisor\n" +
        "  consultant   + engineer    = solution architect\n" +
        "  founder      + engineer    = technical founder\n" +
        "  ---------------------------------------------\n" +
        "  all three, in a regulated enterprise, in English\n" +
        "                             = forward deployed",
      "ls deployments": lsDeployments,
      guardrails: () =>
        "  page-level citations on every claim\n" +
        "  refusal over guessing, 'not in the documents' is a valid answer\n" +
        "  deterministic rules wherever consistency beats cleverness\n" +
        "  batch progress visible in the tool the team already uses\n" +
        "  human review at the gate, always\n\n" +
        "  Honest note: formal eval harnesses are the newest thing in my\n" +
        "  toolkit, not the oldest. That gap is what I am closing next.",
      hire: () =>
        "  status   open to forward-deployed / AI consulting roles\n" +
        "  based    Germany\n" +
        "  onsite   comfortable 2–3 days/week across DACH\n" +
        "  auth     German residence, no sponsorship required\n" +
        "  langs    English C1 · German B2\n" +
        "  reply    usually within a day → kjavanappa@gmail.com"
    };

    const run = (raw) => {
      const q = raw.trim().toLowerCase();
      if (!q) return;
      const echo = `<p class="pal-echo"><span>$</span> ${esc(raw)}</p>`;
      if (q === "clear") { palOut.textContent = ""; return; }

      const cmd = COMMANDS[q.replace(/\s+/g, " ")];
      if (cmd) { append(echo + `<pre>${esc(cmd())}</pre>`); return; }

      const hit = jumps.find(([k]) => k.startsWith(q) || q.startsWith(k));
      if (hit) {
        append(echo + `<pre>  → ${esc(hit[2])}</pre>`);
        pal.close();
        if (hit[1].startsWith("#")) { location.hash = hit[1]; }
        else { window.open(hit[1], "_blank", "noopener"); }
        return;
      }
      append(echo + `<pre>  command not found: ${esc(q)}\n  try \`help\`</pre>`);
    };

    const open = () => {
      const wasOpen = pal.open;
      if (!wasOpen) { pal.showModal(); palIn.value = ""; }
      if (!palOut.innerHTML) run("help");
      palIn.focus();                       /* re-triggering must not eat a half-typed command */
    };

    $("#paletteOpen")?.addEventListener("click", open);
    document.addEventListener("keydown", (e) => {
      if (/^(input|textarea)$/i.test(e.target.tagName) && e.target !== palIn) return;
      /* accept both modifiers on every platform: a Mac user on an external PC
         keyboard, and a Windows user who read the chip, both get in. */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    });
    $("#palForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = palIn.value; palIn.value = ""; run(v);
    });
    $$("#palette [data-cmd]").forEach((b) =>
      b.addEventListener("click", () => { run(b.dataset.cmd); palIn.focus(); }));
    /* click the backdrop to dismiss: the dialog element itself is the backdrop */
    pal.addEventListener("mousedown", (e) => { if (e.target === pal) pal.close(); });
  }
})();
