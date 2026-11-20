# Damai City Mall v2.0: Supermarket Shopping Simulator (game v1.9)

## What changed
The 3D **Misi Beli-Belah** now runs in a walkable supermarket. It replaces the round room where you tapped displays.

The way you start it is unchanged:
- Damai City Mall on the map, or Menu → Aktiviti
- the Bab 5 "Beli barang pesta" mission
- Latihan (practice)

The 2D fallback version and the RM reward flow are also unchanged.

| Feature | Status (tested in a headless browser) |
|---|---|
| Store layout: entrance and exit doors with signs; a trolley bay; 4 rows of double-sided shelves with 3 aisles 2.5 m wide; wall shelves; chest and upright freezers; fruit and vegetable stands; fish and meat counters on ice; clothing racks, a mannequin and a table; gacha machines; 3 checkout counters with cashiers; plants and a promo stand | ✅ |
| 6 departments with hanging signs and aisle boards: Pasar Segar, Barangan Runcit, Fesyen, Mainan, Makanan Sejuk Beku, Barangan Rumah | ✅ |
| 20 products, each with a fixed department, aisle or shelf, shelf level and interaction point; shelves stocked with branded packs (one draw call per product type) | ✅ |
| Pushable trolley: **Ambil Troli** puts you behind the handle; up/down pushes or pulls; left/right steers; slower while turning; wheels roll; front casters swivel; collides with shelves and walls (no passing through); **Lepas troli** parks it where it stands, and you can take it again | ✅ (drove from the entrance through aisle 1, along the freezers, down the east side and into checkout lane 1 under joystick control) |
| Picking up items: near a listed item, its name, price and department appear and the button becomes **Ambil Barang**. The item flies from the shelf into the trolley basket, stays in the trolley, and is ticked off the list. A unit is taken from the shelf only when you collect it. Each spot holds several units (some lists need ×2). The trolley must be within 4.5 m | ✅ |
| Compact mission panel: title, timer, progress, trolley count; 📋 opens the list with ticks and departments; 🧭 toggles a ring on the floor and a beacon over the next item (then over the checkout lane) | ✅ |
| Checkout: park in **Kaunter 1** (green lane) and press **Bayar di Kaunter**. Items leave the trolley one by one, beep across the scanner and build an itemised receipt with a total; then **Bayar** (paid from the committee budget), mission complete, stars | ✅ |
| Rewards: RM is paid by the main game's wallet after the mission, as before (activity: RM25 + RM10 per ⭐ once a day; Bab 5 mission: RM60 + RM15 per ⭐) | ✅ (existing flow) |
| Difficulty (in `MALL_CFG`, `js/mall2.js`): Mudah 3 items / 3 min, Biasa 5 / 5 min (the existing 5-item rule), Sukar 8 / 7 min. Your choice is remembered. When time runs out you can choose Cuba lagi or Keluar | ✅ |
| Shoppers: 7 (4 on lower-end devices) walk between aisle waypoints, stop to look at shelves, carry baskets or push trolleys, queue at counters 2 and 3, and stop to give way to you and your trolley | ✅ (logic) |
| Camera: third-person follow; it swings behind the trolley when you push, and never goes outside the walls or into fixtures | ✅ |
| Adaptive quality: below about 26 FPS, shadows turn off and some shoppers are hidden | ✅ |

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Walk / push and steer the trolley | left joystick | WASD / arrow keys |
| Ambil Troli · Ambil Barang · Bayar | the big button at the bottom right | Space / E / Enter |
| Let go of the trolley | ✋ Lepas troli | Q |
| Shopping list | 📋 Senarai | L |
| Navigation ring and beacon | 🧭 | — |
| Pause / exit | ❚❚ | P / Esc |

## Files
- **Added:** `js/mall2.js` (the store, trolley, products, shoppers, checkout and HUD).
- **Changed:**
  - `js/minigames3d.js`: the 3D mall now uses `MallV2`. The old `Mall3D` code is still in the file for reference.
  - `style.css`: `.ml` styles.
  - `README.md` and `MALL.md`.
- **Unchanged:**
  - `js/activities.js`: the 2D mall and `MALL_ITEMS`.
  - `js/main.js`: rewards and the Bab 5 mission hook.
  - every other mini-game.

## Models used
These are existing packs, already in `assets/models2.json`:
- `shop/display-fruit`, `shop/freezers-standing`, `shop/clothing-rack`, `shop/clothing-table`, `shop/mannequin`, `shop/gacha-machine`, `shop/cash-register`
- `shop/character-employee` (the cashiers)
- `chars/*` (the shoppers)
- the TYRANZ `hero`

Shelves, counters, trolleys, product packs and signs are built in code, so the scene stays light.

## Testing
1. Serve the folder locally, for example with `npx serve .`. In Chrome, open DevTools → device toolbar → a phone in landscape.
2. Use Menu → Latihan → 🛍️ Beli-belah di Mall, choose a difficulty, then walk to the blue trolley bay on your left and press **Ambil Troli**.
3. Follow the 🧭 ring, collect everything, park in the green lane at Kaunter 1, press **Bayar di Kaunter**, then **Bayar**.

## Deploying
**GitHub:** upload the changed files to the same paths (Add file → Upload files) and commit. GitHub Pages redeploys on its own.

**Netlify:** drag the unzipped `MyKampung_v1.9` folder onto your site's **Deploys** page, or re-link the GitHub repository.

## Not checked yet
Visuals were not checked on real 3D hardware here. Please send a phone screenshot of the store and the trolley so I can tune the proportions, camera height and lighting.
