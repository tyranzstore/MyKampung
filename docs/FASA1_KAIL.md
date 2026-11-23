# Fasa 1 — Jelajah Kail

A fishing journey added to MyKampung. Nothing existing was removed: the Bab 3 mission, the daily fishing job and Simulator Pancing Laut work as before, and old saves load unchanged.

## Where to find it
- Jeti Nelayan (after Bab 3) → **Jelajah Kail**
- Menu → Aktiviti → **Jelajah Kail**
- Menu → Latihan → **Jelajah Kail** (practice: all spots open, no RM, nothing saved, shop closed)
- 3D only.

## Loop
1. Set the depth (− +) and bait, press **LABUH**. Bait costs RM1–4 per cast; the lure is free.
2. The inset shows the water column, your bait and the fish coming in.
3. A ring shrinks; press **SENTAP!** inside the window. Too early scares the fish, too late loses it. A perfect strike tires the fish at once.
4. Hold **KARAU**. Keep the tension bar green or yellow. Red snaps the line; grey (slack, not reeling) lets the fish go.
5. Catch card: **Simpan** (cooler, limited) or **Lepas** (ranking points, +1 semangat).
6. ☰ → sell the cooler, map, species log, tackle shop.

## Spots (original names)
| Spot | Water | Max depth | Opens when |
|---|---|---|---|
| Tasik Tenang | fresh | 12 m | start |
| Sungai Lembayung | fresh | 9 m | 4 species logged at Tasik Tenang |
| Terumbu Mentari | salt | 35 m | 4 species logged at Sungai Lembayung |
| Perairan Dalam | salt | 70 m | 4 species logged at Terumbu Mentari |

14 species; each has spots, a depth range, bait preferences, time-of-day and weather bonuses.

## Tackle shop
Four shelves, one camera each: rod (line strength, reel speed), line (strength multiplier), hook (strike window), cooler (capacity). Three tiers, paid with RM through `wallet.spend()` with a one-time key. No real money, no auctions, no loot boxes.

## Money
Selling pays RM by weight × species price × spot bonus. Full price up to RM800 a day from this activity, 20% above that.

## Files
- `js/fishrules.js` — pure rules, seeded randomness, no THREE/DOM. Tests: `node test/fish/fishrules.test.mjs` (24).
- `js/kail.js` — scene, HUD, panels. Reads rule state only.
- `js/minigames3d.js`, `js/main.js`, `js/minigames.js` — registration, three entry points, tutorial card.
- `js/fishskin.js` — skins for Tilapia, Keli, Haruan, Sebarau.
- `style.css` (`.kl`), `sw.js` (cache v2), `docs/kail_style.json` (style lock).

## Save
New slice `S.sea.kail`, created on first use by `kailSave()`; missing or broken fields are filled, nothing else is touched. `SAVE_VERSION` stays 2 because no migration is needed. Catches also go to `S.fishLog`.

## Controls
Touch: buttons. Keyboard: Space/Enter/R = action or reel, ↑ ↓ = depth, B = bait, Esc = menu.

## Known limits
- No freshwater GLBs exist in the repo: Tilapia, Keli, Haruan and Sebarau reuse existing fish bodies with their own painted skins. Proper models are wanted.
- Weather and time are per real day/clock, shared by all spots.
- The angler is a simple figure, not the hero model.
- Checked in headless Chrome (software GL) with a full real-input session; not yet checked on a real phone: frame rate, heat, touch feel of the ring and reel button, text size in sunlight, audio delay.
