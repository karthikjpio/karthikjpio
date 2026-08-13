/* ===========================================================================
   Karthik Javanappa. Portfolio interactions
   No dependencies. Progressive-enhancement only: the page is complete without
   any of this. JS adds a theme toggle, a mobile menu, scroll reveal and a
   mailto helper, and nothing you need to read the page.
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

  /* ---- Sticky nav background + back-to-top on scroll ------------------- */
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

  /* ---- Triad: click the circles, and auto-cycle until the visitor takes over --
     State, styling, keyboard and the no-JS case are all handled by the radio group
     in the markup. This only buys click-on-lobe and a gentle auto-rotation that
     stops for good on the first interaction. */
  const triad = $("#triad");
  triad?.addEventListener("click", (e) => {
    const id = e.target.closest?.("[data-for]")?.dataset.for;
    if (id) $("#" + id).click();
  });
  const triadAuto = $("#triadAuto"), triadBar = $("#triadBar");
  if (triad && triadAuto && triadBar && !prefersReduced) {
    /* cycle the radios themselves, so the diagram, pills and panel all follow from
       the one piece of state they already share */
    const radios = $$(".tr-in", triad);
    const order = ["t-f", "t-c", "t-e", "t-fde"].map((id) => radios.find((r) => r.id === id));
    let stopped = false;
    triadBar.addEventListener("animationiteration", () => {
      if (stopped) return;
      const at = order.findIndex((r) => r.checked);
      order[(at + 1) % order.length].checked = true;
    });
    /* a click means the visitor has taken over: stop for this visit, not persisted */
    const stop = () => {
      if (stopped) return;
      stopped = true;
      triadAuto.hidden = true;
    };
    triad.addEventListener("change", stop);
    triad.addEventListener("click", stop);
  }
})();
