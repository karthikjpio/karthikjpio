# 🐝 Lernvokabeln

A phone-first flashcard PWA for learning **German B2 vocabulary** from *Kompass DaF B2.1*
(Lektion 1–5). Swipe der/die/das cards, and as you get a word right it gets harder — from
recognising it, to tapping its article, to typing it, to producing it in an exam-style task.

**Live:** [learnvokabeln.com](https://learnvokabeln.com) · built by [karthikjp.io](https://karthikjp.io)

![version](https://img.shields.io/badge/version-1.3-blue) ![words](https://img.shields.io/badge/words-712-green) ![no%20backend](https://img.shields.io/badge/backend-none-lightgrey)

## What it does

- **One adaptive session.** No "Learn vs Practice" toggle — the exercise a word gives you is
  decided by how well you know it (a 5-box Leitner system):
  - new → **flashcard** (swipe right = *know it*, left = *again*)
  - recognising → **tap the article** (nouns) or **meaning → word** multiple choice
  - nearly there → **type the word** (with its article)
- **Two mastery axes per word:** *passiv* (recognise) and **aktiv** (produce). A word is only
  fully learned once you've written it yourself — the gap that keeps learners stuck at B2.
- **Produktion capstone.** An optional 2-minute exam-format task (Stellungnahme, Kurzvortrag,
  Beschwerde, Erörterung) with the four scored bullet points and target words to deploy. Your text
  is scanned for the words you actually used, so it shows which words you *knew but didn't use*.
- **der = blue · die = pink · das = green** gender colour-coding, guess the article before you flip.
- German audio (TTS), satisfying swipe sounds, emoji anchors, streak, daily goal, and a
  **Fortschritt** screen (mastery ring, activity heatmap, passive/active split per lesson).
- **Offline PWA**, installable to the home screen. All progress stored on-device (localStorage) —
  no account, no backend, no tracking.

712 words: L1 (140) · L2 (118) · L3 (141) · L4 (155) · L5 (158). Articles, plurals and the book's
collocations come from the *Lektionswortschatz*; the meanings, example sentences and audio are
generated at B2 level.

## Run locally

Open `index.html` in a browser to try it on a laptop. For the full PWA on your phone, serve over http:

```bash
python3 -m http.server 8137
```

Then open `http://localhost:8137` (or `http://<your-ip>:8137` on your phone, same Wi-Fi) and use
**Add to Home Screen**.

## Deploy

It's a static site — host the folder anywhere (Hostinger, Netlify, GitHub Pages, Vercel). All paths
are relative, so it works at a domain root or a sub-path. Asset URLs are versioned (`?v=N`); bump the
number in `index.html` **and** the `VERSION` string in `sw.js` on each deploy so caches refresh.

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI + styles |
| `app.js` | session engine, spaced repetition, exercises, audio, storage, stats |
| `deck_l1.js` … `deck_l5.js` | the vocabulary, one file per lesson |
| `emoji.js` | word → emoji anchor shown on the card back |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA / offline / install |
| `CHANGELOG.md` | version history |

## Roadmap

- Cross-device sync + profiles (optional account)
- More lessons (B2.2, Lektion 6–10)
- Picture/animation card visuals beyond emoji

---

Made with 🐝 for a real B2 exam. Vocabulary © Ernst Klett Sprachen (*Kompass DaF B2.1*); this is a
personal study tool.
