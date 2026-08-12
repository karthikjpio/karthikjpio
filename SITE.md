# karthikjp.io, build notes

How the site is built and checked. The profile-facing readme is [README.md](README.md);
this file is the engineering detail behind it.

One HTML file, one stylesheet, one script. No framework, no build step, no dependencies at
runtime: open `index.html` and it works.

## Run it

```bash
python3 -m http.server 4174     # then open http://localhost:4174
```

A file:// open works too. The only reason to use a server is that `assets/kb.json`
is fetched by the chat widget, and `fetch` on `file://` is blocked in some browsers.

## Test it

```bash
npm i -D jsdom                                    # required
npm i -D playwright && npx playwright install chromium   # optional, for the layout pass
node smoke-test.js
```

194 assertions. Two layers, and the split matters:

- **jsdom** covers logic and content: the scrubber state machine, the triad radio
  group, the command palette, WCAG AA contrast computed per theme (dark, light and
  print), the type scale and spacing ramp, the first-view transfer budget, and the
  honesty invariants below.
- **Chromium via playwright** covers layout by sweeping 320 to 1440px, because
  jsdom has no layout engine. It opens every `<details>` first, since a closed one
  is not laid out. This layer exists because the suite was green at 149 assertions
  while the phone layout was broken: the proof strip was four fixed columns inside
  `overflow: hidden` at every width, so half of it was clipped off the right edge
  on every phone. A jsdom assertion cannot see that. Skipped, loudly, if playwright
  is not installed.

## Files

```
index.html               the page
assets/css/styles.css    design tokens, then components, then breakpoints
assets/js/main.js        progressive enhancement only, nothing structural
assets/kb.json           answers for the on-page chat widget
assets/Karthik_Javanappa_CV.pdf
assets/img/Portrait.jpeg
smoke-test.js            the runnable check
```

## Rules this repo keeps

**Every status is true.** The deployment registry marks each system `shipped`,
`live`, `planned` or `local`, and those words track reality rather than ambition.
The chat widget says `local` because it answers from a keyword match over
`kb.json`, not from a model. If a claim cannot be verified it does not go on the
page. This is the whole differentiator, so the test suite asserts it.

**First view stays under 43 KB gzipped** across HTML, CSS and JS summed. New
features are paid for by deletions, not by raising the ceiling. The one raise so
far, from 43,008 to 44,032 on 12 August 2026, bought the GitHub and X links and is
recorded in the assertion itself. Currently 43,298 bytes of 44,032.

**It works without JavaScript.** Every interactive component rests on its
conclusion: the scrubber sits at production, the triad shows the intersection
panel, the registry rows are `<details>`. JS adds auto-cycling and the palette and
nothing you need.

**Reduced motion, print and light theme are real targets**, not afterthoughts.
Every colour token has a print and a light override, and the contrast assertions
run against all three.

**No em dashes anywhere.**

## Deploy

karthikjp.io is served from Hostinger, so this repo is source control rather than
the deployment trigger: upload `index.html` and `assets/` to the web root, or point
a deploy step at them. There is no build, so what is in the repo is what ships.

**Bump the `?v=` token in `index.html` on every deploy** that touches
`styles.css`, `main.js` or `kb.json`, and keep the one in `main.js` for `kb.json` in
step. The host sends `cache-control: public, max-age=604800` on those files with no
revalidation, so without a new URL a returning visitor keeps a week-old stylesheet.
That happened on 12 August 2026: a phone showed the new markup with the pre-fix
layout, which looked exactly like the fix had failed when it was live and correct.
`smoke-test.js` fails if the three tokens are missing or disagree, but it cannot
know whether you remembered to change them, so that part is on you.

If it ever moves to GitHub Pages on the apex domain, add a `CNAME` file containing
`karthikjp.io`. On Vercel or Netlify set the domain in the dashboard and leave the
repo alone.
