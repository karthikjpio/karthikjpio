# karthikjp.io, build notes

How the site is built and checked. The profile-facing readme is [README.md](README.md);
this file is the engineering detail behind it.

Two HTML pages (German default + English), one shared stylesheet, one shared script. No
framework, no build step, no dependencies at runtime: open `index.html` and it works.

## Bilingual, two pages

The site ships in German and English as **two real pages**, not a JS toggle, so the language
switch survives with JavaScript off and each page stays inside the transfer budget on its own.

- **`index.html` (root)** is the **German** default that karthikjp.io serves. `<html lang="de">`,
  canonical `https://karthikjp.io/`.
- **`en/index.html`** is the **English** page. `<html lang="en">`, canonical
  `https://karthikjp.io/en/`. Its asset references are `../assets/...` (relative, so a `file://`
  open still works). Wording is the original English copy, unchanged.
- **Language switch:** a plain-anchor `DE | EN` control in the nav of both pages (in
  `.nav-actions`, inline-styled with the theme tokens, no CSS class rule, no JS). On the German
  page EN links to `en/`; on the English page DE links to `../`.
- **hreflang:** both pages carry `de`, `en` and `x-default` (→ root) `<link rel="alternate">` tags.
- **German CV:** the German page links `assets/Karthik_Javanappa_CV_DE.pdf` (a German CV PDF is
  dropped into `assets/` separately; the link is wired with a `<!-- TODO: German CV PDF pending -->`
  marker). The English page keeps `assets/Karthik_Javanappa_CV.pdf`.
- **Language level:** German page reads "Deutsch (B2, C1 in Arbeit)", English page "German (B2,
  C1 in progress)". Only English + German are listed (Kannada/Hindi stay off the site).
- **Shared CSS/JS:** both pages load the same `assets/css/styles.css` and `assets/js/main.js`. The
  nav-collapse breakpoint is 940px (was 820px) so the five links plus the switcher, and the wider
  German labels, never crowd the bar. `main.js` still holds two English-only form messages (submit
  + validation notices) that flash on the German page; left untranslated to avoid touching JS.

## Run it

```bash
python3 -m http.server 4174     # then open http://localhost:4174
```

A `file://` open works too. There is no runtime fetch, so nothing needs a server: the
server is only convenient for a realistic preview.

## Test it

```bash
npm i -D jsdom                                    # required
npm i -D playwright && npx playwright install chromium   # optional, for the layout pass
node smoke-test.js
```

99 assertions. Two layers, and the split matters:

- **jsdom** covers content and logic: the three case studies and their common structure,
  the interactive triad (radio-group state, auto-cycle, cleaned copy), the
  enterprise-readiness facts, the four testimonials in the horizontal scroll strip, the
  contact fallback, WCAG AA contrast computed per theme (dark, light and print), the type
  scale and 4px spacing ramp, the first-view transfer budget, and the honesty and
  location/language invariants.
- **Chromium via playwright** covers layout by sweeping 320 to 1440px, because jsdom has
  no layout engine. This layer exists because the suite was once green while the phone
  layout was broken: a fixed grid was clipped off the right edge on every phone, and a
  jsdom assertion cannot see that. It renders at the phone widths the report named
  (360, 390, 430) plus the desktop band, and skips, loudly, if playwright is not installed.

## Files

```
index.html               the German page (default served at the apex)
en/index.html            the English page (../assets paths)
assets/css/styles.css    design tokens, then components, then breakpoints (shared)
assets/js/main.js        progressive enhancement only, nothing structural (shared)
assets/Karthik_Javanappa_CV.pdf       English CV
assets/Karthik_Javanappa_CV_DE.pdf    German CV (pending drop-in)
assets/img/Portrait.jpeg
smoke-test.js            the runnable check
```

`smoke-test.js` loads `en/index.html` for its content assertions (English wording unchanged) and
adds a German block that checks the root page: `lang="de"`, native German section copy, the DE|EN
switcher wiring, the three hreflang alternates, the German CV link, and the B2/C1-in-Arbeit line.
The transfer-budget check now gates BOTH pages under 32 KB gzipped.

## Rules this repo keeps

**Every claim is defensible.** Client specifics are anonymised; only cleared numbers are
shown (the roughly-7,000-company reference set and the under-40-minutes result). Where a
number was never instrumented, the page says so rather than inventing one. The site shows
proof, not planned work: three real deployments with their architecture and constraints,
not a registry of things that have not shipped.

**First view stays under 32 KB gzipped** across HTML, CSS and JS summed. Removing the
command palette, chat widget, deployment scrubber, interactive triad and marquee dropped
the first view from ~43 KB to ~21 KB, so the budget has real headroom again. New features
are paid for by deletions, not by raising the ceiling.

**It works without JavaScript.** Nothing structural depends on the script. The triad is a
native radio group that defaults to the conclusion, so no-JS, print and reduced-motion land
on the answer rather than an empty diagram; the case studies, diagrams and readiness facts
are static markup; the testimonials are a plain horizontal scroll. JS only adds a theme
toggle, a mobile menu, scroll reveal, the triad auto-cycle, a mailto helper and
click-to-copy.

**Reduced motion, print and light theme are real targets**, not afterthoughts. Every
colour token has a print and a light override, and the contrast assertions run against all
three.

**No em dashes anywhere.**

## Deploy

karthikjp.io is served from Hostinger, so this repo is source control rather than the
deployment trigger: upload `index.html`, the `en/` folder and `assets/` to the web root. There
is no build, so what is in the repo is what ships. (Drop `Karthik_Javanappa_CV_DE.pdf` into
`assets/` when it exists so the German page's CV link resolves.)

**Bump the `?v=` token in BOTH `index.html` and `en/index.html` on every deploy** that touches
`styles.css` or `main.js` (keep the two files on the same token). The host sends `cache-control: public, max-age=604800` on those files with no
revalidation, so without a new URL a returning visitor keeps a week-old stylesheet. That
happened on 12 August 2026: a phone showed new markup with the pre-fix layout, which looked
exactly like the fix had failed when it was live and correct. `smoke-test.js` fails if the
two tokens are missing or disagree, but it cannot know whether you remembered to change
them, so that part is on you.

If it ever moves to GitHub Pages on the apex domain, add a `CNAME` file containing
`karthikjp.io`. On Vercel or Netlify set the domain in the dashboard and leave the repo
alone.
