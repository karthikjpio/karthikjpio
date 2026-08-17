# Vokabel B2 — Kompass DaF Lektion 1-5

A phone-first flashcard PWA for the **Learn** phase: swipe der/die/das vocabulary, flip for a
simplified German meaning + English gloss + a B2 example sentence, with German audio (TTS) and
sounds. Spaced repetition via a 5-box Leitner system.

- **Swipe right / ✓ / →** = "I know it" → the word comes back much less often (box +1).
- **Swipe left / ✗ / ←** = "again" → drops to box 1, comes back soon and repeats this session.
- **Tap card** (or ↻ / Space) = flip. **🔊** = hear the word / sentence.
- Back shows the **German meaning** by default; **Show English** toggles the gloss.
- der = blue · die = pink · das = green. Progress + streak saved on-device (localStorage).

712 words: L1 (140) · L2 (118) · L3 (141) · L4 (155) · L5 (158). Meanings, example sentences and audio are
generated (not in the book); der/die/das, plurals and collocations are taken from the Lektionswortschatz.

## Run it

Just open `index.html` in a browser to try it on the laptop.

For the full app on your **phone** (install to home screen, offline), serve the folder over http:

```bash
cd "Vokabeltrainer" && python3 -m http.server 8137
```

Then on your Mac open `http://localhost:8137`. To use it on your phone on the same Wi-Fi, open
`http://<your-mac-ip>:8137` and use "Add to Home Screen". (Or drag this folder onto app.netlify.com/drop
for a free hosted link.)

## Files
- `index.html` — UI + styles
- `app.js` — swipe, spaced repetition, audio, storage
- `deck_l1.js` … `deck_l5.js` — the vocabulary (one file per lesson)
- `emoji.js` — word → emoji anchors shown on the card back
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — PWA / offline

## Fortschritt (v1.2)
Tap **Fortschritt** (or the streak) for local stats: mastery ring, current/best streak, accuracy,
an activity heatmap, per-lesson mastery and the last active days. All computed on-device from a
review log — no account, no backend.

## Phase 2 (next)
**Practice** mode: article quiz (tap der/die/das), type-the-word, listening, and multiple choice —
drawing on the same deck and the same box/due data. Not built yet.
