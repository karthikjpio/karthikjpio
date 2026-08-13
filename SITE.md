# karthikjp.io, build notes

How the site is built and checked. The profile-facing readme is [README.md](README.md);
this file is the engineering detail behind it.

One HTML file, one stylesheet, one script. No framework, no build step, no dependencies at
runtime: open `index.html` and it works.

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

94 assertions. Two layers, and the split matters:

- **jsdom** covers content and logic: the three case studies and their common structure,
  the static overlap block, the enterprise-readiness facts, the two testimonials, the
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
index.html               the page
assets/css/styles.css    design tokens, then components, then breakpoints
assets/js/main.js        progressive enhancement only, nothing structural
assets/Karthik_Javanappa_CV.pdf
assets/img/Portrait.jpeg
smoke-test.js            the runnable check
```

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

**It works without JavaScript.** Nothing structural depends on the script: the case
studies, diagrams, overlap block and readiness facts are all static markup. JS adds a
theme toggle, a mobile menu, scroll reveal, a mailto helper and click-to-copy, and nothing
you need to read the page.

**Reduced motion, print and light theme are real targets**, not afterthoughts. Every
colour token has a print and a light override, and the contrast assertions run against all
three.

**No em dashes anywhere.**

## Deploy

karthikjp.io is served from Hostinger, so this repo is source control rather than the
deployment trigger: upload `index.html` and `assets/` to the web root. There is no build,
so what is in the repo is what ships.

**Bump the `?v=` token in `index.html` on every deploy** that touches `styles.css` or
`main.js`. The host sends `cache-control: public, max-age=604800` on those files with no
revalidation, so without a new URL a returning visitor keeps a week-old stylesheet. That
happened on 12 August 2026: a phone showed new markup with the pre-fix layout, which looked
exactly like the fix had failed when it was live and correct. `smoke-test.js` fails if the
two tokens are missing or disagree, but it cannot know whether you remembered to change
them, so that part is on you.

If it ever moves to GitHub Pages on the apex domain, add a `CNAME` file containing
`karthikjp.io`. On Vercel or Netlify set the domain in the dashboard and leave the repo
alone.
