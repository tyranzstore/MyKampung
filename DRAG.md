# TYRANZ: Jalan Drag (v0.2, game v1.7.1) and the RM economy

## 1. What changed for the whole game: everything pays in Ringgit (RM)
- Coins are now **RM**. Old saves carry over 1:1, so 1,250 🪙 becomes RM1,250. The HUD shows 💵 RM.
- `js/wallet.js` is the only place money moves:
  - `earn(amount, why)` pays the player.
  - `spend(amount, why, key)` charges the player.
  - Both reject amounts that aren't valid numbers. Spending is refused when the balance is too low, and a purchase `key` can only be bought once.
  - The last 60 transactions are logged in `S.ledger`, and owned items are recorded in `S.owned`.
- New reward amounts:
  - Story missions: RM60 + RM15 per ⭐.
  - Daily jobs: RM40–50 + RM10 per ⭐, plus RM60 when all three are done.
  - Chapters: RM150–300.
  - Activities: RM25 + RM10 per ⭐, once a day.
  - Futsal 3v3: RM80 for a win, RM40 for a draw, RM15 for a loss.
  - Selling rice: RM60.
  - Sea fishing: you get 60% of the fish's value, up to RM500 a day.
  - Jalan Drag: race prizes, listed below.
- ⭐ stars still count towards your title (rank), and each star now also pays RM.
- There is no backend, so the checks run in the browser. To move to a server later, replace the bodies of `earn` and `spend` with API calls; nothing that calls them needs to change.

## 2. Jalan Drag: what's in v0.1
| Feature | Status |
|---|---|
| Opening it from the **Litar Drag 402m** spot on the map (choose Jalan Drag or the original Klasik race); Menu → Aktiviti; Menu → Latihan (practice: no prize money) | ✅ |
| Exiting returns you to the drag strip on the map | ✅ |
| 3D garage: a turntable you rotate by dragging or leave to spin slowly, with vehicle stats (hp, kg, estimated ¼-mile time and finish speed) | ✅ |
| 6 original vehicles: **Tuah Mini** (hatchback, free), **Jebat 1.8** (sedan, RM2,800), **Lekiu GT** (coupe, RM7,500), **Kasturi RS** (AWD turbo sedan, RM14,500), **Kapcai 135** (underbone, free), **Lekir 250R** (sport bike, RM5,200) | ✅ |
| Upgrades, all paid in RM, with prices scaled to each vehicle's class: engine stages 1–3, turbo (small/big; cars only), exhaust, gearbox (sport/race), tyres (sport, drag radial, slicks), nitrous (35/75/125), rims, body kit and spoiler (cars), swingarm and wheelie bar (bikes), adjustable suspension, launch control | ✅ |
| Paint (12 colours, gloss RM120 or metallic RM220 per respray) and vinyls (stripes, flames, batik, race number, TYRANZ) | ✅ |
| Tuning: ride height (−6 to +4 cm, needs Suspensi Laras), final drive (needs the sport gearbox), gear spread (needs the race gearbox), launch rpm (needs Launch Control) | ✅ |
| Every part either shows on the vehicle or changes the physics; most do both (see the table below) | ✅ |
| Quick Race against AI over ⅛, ¼ or ½ mile; Easy, Medium or Hard opponent; manual or automatic gearbox; day or night track | ✅ |
| Race sequence: burnout box (hold BURNOUT + GAS to heat the tyres; tyre temperature changes grip) → roll to the line → start lights (pre-stage, stage, 3 ambers, green) → reaction time → launch → gear shifts → finish | ✅ |
| Physics: torque curve, rev limiter, clutch slip at the launch, gear ratios and final drive, shift time, grip limited by weight on the driven wheels and tyre temperature, wheelspin, nitrous, turbo lag and boost, air drag, rolling resistance, weight; wheelies on bikes | ✅ |
| AI: picks a vehicle and parts to match your build at the chosen difficulty, reacts in 0.10–0.42 s, eases the throttle to grip and shifts near the ideal point | ✅ |
| Results: reaction time, 60 ft, elapsed time, finish speed and total time for both racers, your shift grades, and prize money broken down | ✅ |
| Effects: tyre smoke, exhaust flames (sport and straight-pipe exhausts), purple nitrous flame, skid marks, spinning wheels, suspension squat, bike wheelies, crowd | ✅ |
| Cameras: starting line, chase and side (📷 or C cycles them), plus a slow orbit after the finish | ✅ |
| Adaptive quality: shadows and smoke are reduced when the frame rate drops below about 26 FPS; the physics runs at a fixed 240 steps a second, so speeds don't depend on frame rate | ✅ |
| Career, tournaments, multiplayer, leaderboards, pink slips | ❌ planned for later versions |

### What each part does
| Part | Physics | What you see |
|---|---|---|
| Engine stages | +12/25/42% torque, higher rev limit | Stage 3 adds a hood bulge |
| Turbo | Boost that builds with rpm, with lag | Hood scoop and intercooler |
| Exhaust | +4/8% torque, less weight | Bigger tips (twin on the straight pipe), flames on shifts and at the limiter |
| Gearbox | Shift time 0.36 → 0.20 → 0.09 s; unlocks tuning | — |
| Tyres | Grip ×1.12, 1.30, 1.45 | Wider, larger tyres on the driven wheels |
| Nitrous | +25/45/70% torque for 4–5 s | NOS decal (bikes get a bottle); purple flame |
| Rims | −4 to −10 kg | 5-spoke, mesh or drag wheels |
| Body kit | −3% or −5% drag, small weight increase | Splitter, skirts, wide fender flares |
| Spoiler | Lip −1% drag; GT wing +3% drag but rear downforce | Lip or GT wing |
| Swingarm / wheelie bar | Longer wheelbase, so less wheelie | Longer swingarm; bar with small wheels |
| Suspension | Lower: less drag but higher centre of gravity changes; higher: more weight transfer | Ride height |
| Launch control | Holds your chosen rpm on the line | — |
| Paint / vinyl | — | Colour, metallic finish, decals on both sides (stripes also go on the bonnet) |

### Prize money (RM)
- **Win:** ⅛ mile RM80, ¼ mile RM140, ½ mile RM220. Multiplied by difficulty: Easy ×0.7, Medium ×1, Hard ×1.6.
- **Loss:** 15% of the win prize.
- **Bonuses:** reaction under 0.100 s +RM25, under 0.200 s +RM10; each perfect shift +RM5; a new personal best +RM30.
- **Red light** (launching before green): no money.

## 3. Controls
| Action | Touch | Keyboard |
|---|---|---|
| Throttle | Hold the big **GAS** pedal; lower on the pedal = more throttle | W / ↑ |
| Launch | Hold the big left button (**LANCAR**) with GAS, **release on green** | hold Space, release on green |
| Shift up | Same big left button (**GEAR ▲**); it glows green at the shift point | Space / → / E |
| Shift down | **▼** | ← / Q |
| Nitrous | **NITRO** | N |
| Burnout | In the burnout box the big left button is **BURNOUT**: hold it + GAS | B + W |
| Roll to the line | **KE GARISAN** | Enter |
| Camera | 📷 | C |
| Pause / exit | ❚❚ | P / Esc |

Tips:
- In manual, shift when the blue lights flash on the rev counter.
- If the wheels spin badly ("PUSING RODA!"), launch at lower rpm, heat the tyres in the burnout box, or fit better tyres.

### v0.2 layout (after the first phone test)
- **Garage:** the car stays in the middle, shown from a ¾ front angle in a dark showroom with soft lights and reflective paint.
  - Top: wallet, vehicle name, and a Car/Bike switch.
  - Bottom left: a dock with Prestasi (upgrades), Gaya (customise), Tala (tuning), Pengedar (dealer) and Keluar (exit). A big **LUMBA** button sits bottom right.
  - Each section opens one drawer on the right. The camera moves the car into the free space on the left so the drawer doesn't cover it.
- **Race:**
  - A thin progress bar and a small start-light strip at the top.
  - A compact rev counter in the middle at the bottom.
  - One big context button on the left (BURNOUT → LANCAR → GEAR ▲), with NITRO and ▼ beside it.
  - The GAS pedal on the right.
  - Messages are short and appear low on the screen.
- **Car models:**
  - Wheel arches cut into the body, and a narrower cabin above the body line, as on real cars.
  - Rounded edges, clear-coat paint, door shut lines, B-pillars, door handles, mirrors, a grille, lights and number plates.
  - Rounded tyres, deep rims and red brake callipers.
- **Underglow:** a neon underglow kit (RM380, six colours) is now in the Gaya drawer.
- **Try before you buy (v1.7.2):** tap any part, colour, decal or neon you don't own and it appears on the car straight away.
  - The stats show how much it changes power, weight, ¼-mile time and top speed (▲ / ▼).
  - A **BELI RMxxx** bar appears at the bottom of the menu. Tap it, or tap the item again, to buy and fit it for good.
  - Closing the menu, switching tabs or tapping ✕ removes the preview. Nothing is saved or charged until you buy.
  - One item is previewed at a time.

## 4. Files
**Added**
- `js/wallet.js`: the RM wallet.
- `js/dragphys.js`: vehicle physics and the AI driver. It has no DOM code, so it can be tested in Node.
- `js/dragdata.js`: vehicles, parts, prices, the garage save, purchases, AI opponents and prize money.
- `js/dragcars.js`: low-poly cars and bikes built in code. To use production GLB models later, add keys to `VEHICLE_GLB`.
- `js/jalandrag.js`: the game itself (garage, race, HUD and controls).
- `DRAG.md`: this guide.

**Changed**
- `js/main.js`: RM rewards through the wallet, the Litar Drag choice screen, Aktiviti and Latihan entries, `jalanDrag()`.
- `js/minigames3d.js`: registers `jalandrag`.
- `js/minigames.js`: tutorial card.
- `js/seafish.js`: selling and upgrades go through the wallet in RM.
- `index.html`: HUD shows RM.
- `style.css`: `.jd` styles.

Saves:
- The garage is stored in `S.drag`.
- Wallet data is in `S.coins`, `S.owned` and `S.ledger`.
- Nothing else in the save changed.

## 5. How it connects to the game
- `main.js` → `activity('drag')` shows the choice screen, then `jalanDrag()` → `playGame('jalandrag')`.
- `minigames3d.js` (`runGame3D`) → `JalanDrag3D` → `jalanDragScene(...)`. It uses the same renderer, loop and `api.finish()` as the other mini-games.
- On exit, `town.focus('drag')` returns the camera to the drag strip.
- All money goes through `wallet.js`. The game reads `S` and `save()` from `core.js`.

## 6. Testing in Chrome
1. Serve the folder, for example with `npx serve .` or `python3 -m http.server 8080`, then open `http://localhost:8080`.
2. Use a save that has reached Bab 4, or use Menu → Latihan → 🏎️ Jalan Drag, which works from any save.
3. To test on a phone layout: DevTools → Toggle device toolbar → choose a phone → landscape.
4. To check physics without the UI, run `node test/drag/t1.mjs` (all vehicles, upgrade effects, purchases, AI matching).
5. To give yourself money for testing, run this in the DevTools console: `const s = JSON.parse(localStorage.tkh_town_v1); s.coins = 20000; localStorage.tkh_town_v1 = JSON.stringify(s); location.reload();`

## 7. Deploying with GitHub in the browser
1. On github.com, create a repository, for example `tyranz-kampung`, and choose **Add file → Upload files**.
2. Unzip `MyKampung_v1.7.zip` on your computer and drag the **contents** of the `MyKampung_v1.7` folder into the upload area. `index.html` must be at the top level. Commit.
3. Go to **Settings → Pages → Build and deployment**, set Source to **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. After about a minute the game is live at `https://<your-username>.github.io/tyranz-kampung/`.
5. To update it, upload the changed files again (same paths) and commit. Pages redeploys automatically.
6. Netlify also works: link the repository, or drag the folder onto Netlify's deploy page.

## 8. Known limitations
- Purchases are checked only in the browser (there is no server). A player could edit their save.
- The vehicles are built in code until production GLB models are supplied.
- There is one engine sound, for your own vehicle; the opponent is silent.
- The physics is simplified to straight-line driving (no steering), which is all drag racing needs.
- The 3D graphics were tested only in a headless browser with simplified 3D; please check how it looks on a real phone.
