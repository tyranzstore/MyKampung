# Simulator Pancing Laut — Sea Fishing Simulator (v0.3, game v1.6.3)

A Malaysian saltwater fishing activity added to MyKampung. It doesn't replace the existing Bab 3 fishing mission or the daily fishing job, and saves from v1.5.1 load unchanged. The simulator keeps its own data in a new `S.sea` slot.

## Where to find it
- **Jeti Nelayan** (map): after finishing Bab 3, tapping the jetty asks you to choose between **Kerja harian** (the old daily fishing job) and **🚤 Pancing Laut**.
- **Menu → 🎉 Aktiviti → 🎣 Pancing Laut**.
- **Menu → Latihan → 🚤 Pancing Laut** (practice mode: no coins and no Fish Book entries).
- The simulator runs only in 3D. In 2D mode, a "Perlukan grafik 3D" message tells you to switch graphics.

The game already had a coastline (the kampung jetty and Pantai Miami), so the map didn't need to grow. The simulator opens its own sea scene: the kampung shore and jetty at z = 18, with open sea to the south.

## What v0.1 contains
| Area | Status |
|---|---|
| Kampung shore, wooden jetty (TYRANZ `jeti_kayu.glb`, tiled), lamps | ✅ |
| Open sea: animated waves and shore breakers, a seabed mesh with real depth (shallows → reef → mid → deep, about 0.5–70 m), 3 islands, 4 coral reefs (coral and rock GLBs), buoys | ✅ |
| Day/night cycle (1 game hour = 30 s), weather (Cerah, Mendung, Hujan, Ribut) affecting light, fog, waves, rain and bite rate | ✅ |
| Boat (TYRANZ fishing boat): board, raise or drop the anchor (animated `sauh.glb` with rope), joystick throttle and steering, chase camera, collisions with islands and the jetty, wake, engine sound, rod holders, night lantern | ✅ |
| **Casting** (hold for power, joystick to aim) from the jetty or the anchored boat | ✅ |
| **Bottom fishing** (TURUN: bait drops straight to the seabed) | ✅ |
| Bite sequence: nibbles (rod-tip twitches) → the take (STRIKE window) → hook set. Striking too early scares the fish and may lose the bait | ✅ |
| Fight: fish pull against adjustable drag (line slips when pull > drag); reel and fast reel; line tension against the rod's breaking strain (snap); slack line (fish gets off); stamina; runs; jumps (hook thrown); reef fish diving into coral (line cut); spool limit | ✅ |
| Rod bending (the GLB rod's vertices are bent in code from tension) with pumping, run shudder and spring-back when the line goes | ✅ |
| Working spinning reel built in code: the handle cranks, the rotor spins at 5.2×, the spool slips backwards when the drag gives line, the bail opens for the cast, and the line on the spool shrinks as it runs out | ✅ |
| First-person hands: the right hand grips the rod and the left hand turns the reel handle | ✅ |
| Line drawn as a curve that sags when slack and pulls straight when tight | ✅ |
| Challenges: **line snap** (drag set above the line strength, or a shock load when a run starts), **cut off on the reef**, **hook thrown on a jump**, **slack line**, **fish too big** (warning on the hook, extra stamina, spool runs out), and a **gaff** for fish of 6 kg and over (press GANCO in time or the fish shakes free at the side). Each loss plays out: the broken line whips back, the rod springs, the camera kicks | ✅ |
| Landing animation: small fish are swung out of the water on the line; big ones are gaffed and then lifted, flapping, into your hands | ✅ |
| Fish swimming around the bait while you wait, drawn from the species that can bite at that spot; the biting fish swims in, pecks and takes the bait | ✅ |
| Underwater bait camera while waiting (on by default; 🤿 KAMERA switches to the rod view) | ✅ |
| **First-person fight** after the strike, like Ultimate Fishing Simulator: the rod bends in front of you, the line cuts the water and the view shakes under high tension; 🤿 switches to an underwater view of the fish | ✅ |
| Catch screen: 3D fish spinning beside a card with the Malay name, English name, length, weight, rarity, RM value, new-species / record tags, **Simpan & Jual** or **Lepas** | ✅ |
| Sonar fish finder (Sonar Asas / Pro upgrade) | ✅ |
| Upgrades (pause menu): 3 rods, 3 engines, 3 sonars, paid with coins | ✅ |
| **Jigging** (JIG button with the lure) | ⚙️ first version |
| **Trolling** (TUNDA: lure 22 m behind a moving boat, 3–7 m/s) | ⚙️ first version |

## Species (`SEA_FISH` in `js/seafish.js`)
Each species has zones, a depth range, bait preferences (udang, sotong, umpan hidup, gewang), technique multipliers (bottom, cast, jig, troll), time-of-day bonuses, behaviour (rock, heavy, run, jump, burst), strength, speed, a weight range, rarity, RM per kg and a length–weight factor.

Ikan Kerapu, Merah, Jenahak, Tenggiri, Gerepoh, Talang, Pari, Alu-Alu (barracuda), Tongkol and Layaran, plus four common saltwater species so the line isn't quiet: Kembung, Kerisi, Gelama and Jebong.

Examples of the habitat logic: Kerapu, Jenahak, Jebong and Gerepoh live on reefs and dive into coral. Merah are in deep water and bite at night. Tenggiri, Tongkol and Layaran are pelagic, take trolled lures, and ignore bait lying on the bottom in deep water.

## GLB assets
| Asset | Source |
|---|---|
| Fishing boat (`fboat`) | existing TYRANZ model |
| Jetty `sea/jeti_kayu` | TYRANZ Fishing GLB Starter (`jeti_kayu.glb`), re-oriented from Z-up to Y-up |
| Rod `sea/joran` | TYRANZ Fishing GLB Starter (`joran_pancing.glb`), re-oriented; it doubles as the reel and rod |
| Kerapu, Merah, Jenahak, Tenggiri, Talang, Pari, Alu-Alu, Tongkol, Kembung, Kerisi, Gelama, Jebong | existing TYRANZ sea-fish models |
| **Gerepoh** `fish_Gerepoh`, **Layaran** `fish_Layaran` | **new**: no model existed, so these were generated (`tools/gen/make_sea.py`) |
| **Anchor** `sea/sauh`, **coral** `sea/karang_cabang`, `sea/karang_otak`, `sea/kipas_laut`, **rock** `sea/batu_laut` | **new**, generated |

All of these are packed into `assets/models2.json`. The starter pack's freshwater fish (haruan, keli, sebarau, siakap, tilapia) are **not used or renamed**. The GLBs contain only geometry; all gameplay is in JavaScript.

**Still missing (good candidates for proper art):** a dedicated reel model, a sampan, hand-modelled Gerepoh and Layaran to replace the procedural ones, and a lure model.

## Files
- `js/seafish.js` (new): species data, world, boat, fishing state machine, fight physics, HUD and catch screen.
- `js/minigames3d.js`: registers the `seafish` game.
- `js/minigames.js`: adds Gerepoh and Layaran to `FISH`, plus the tutorial card.
- `js/fishskin.js`: adds palettes for Gerepoh and Layaran.
- `js/main.js`: adds the jetty choice, the Aktiviti and Latihan entries, the result screen and the 3D-only guard.
- `style.css`: adds the `.sf` HUD.
- `assets/models2.json`: adds 9 models.

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Aim the cast or steer the boat | left joystick | A/D (aim), WASD (drive) |
| Cast | hold **LEMPAR**, then release | hold Space or C |
| Drop the bait to the bottom | **TURUN** | X |
| Change bait | **UMPAN** | B |
| Strike | **SENTAP!** (flashes orange) | F |
| Reel or retrieve | hold **KARAU** | hold R |
| Fast reel | **LAJU** | — |
| Drag − / + | **DRAG −**, **DRAG +** | [ and ] |
| Jig (lure only) | **JIG** | J |
| Underwater camera | **KAMERA** 🤿 | U |
| Board, raise anchor, drop anchor, troll | context buttons | T (troll) |
| Pause, upgrades, exit | ❚❚ | P or Esc |

Fighting tips: keep the tension bar green or yellow. Red snaps the line. Grey means slack, and the fish gets off. When a big fish runs, the drag lets out line. Lower the drag for heavy fish on a light rod, and raise it to pull reef fish out of the coral.

## Rewards
Selling pays about 35% of the RM value in coins, up to **300 coins a day** from this activity. Releasing a fish gives +1 semangat. Catches go into the Fish Book (`S.fishLog`), and personal bests go into `S.sea.best`.

## Testing in a browser
1. Serve the folder over HTTP, for example with `npx serve` or `python3 -m http.server`, then open `index.html`. A `file://` URL can't fetch the model packs.
2. Use a save past Bab 3, or play through to it. Tap **Jeti Nelayan → 🚤 Pancing Laut**, or use Menu → Latihan → 🚤 Pancing Laut, which works from any save.
3. Test on the jetty: press **TURUN** and wait for twitches; when the button flashes, press **SENTAP!**; then hold **KARAU** and watch the tension bar until the catch card appears.
4. Test casting: hold **LEMPAR** to about 70%, release, and try **UMPAN → Gewang** with KARAU to retrieve the lure.
5. Test the boat: **NAIK BOT → ANGKAT SAUH**, drive to a red reef buoy or out past the yellow buoys (deep sea), then press **LABUH** and fish. Try **TUNDA** at 3–7 m/s in deep water for Tenggiri, Tongkol or Layaran.
6. For mobile, open the page on a phone in landscape. All controls are touch buttons and the joystick.

The automated checks (Playwright with a stubbed three.js, in `test/tsf.mjs`) covered the jetty prompt, a bottom-fishing bite, strike, fight, catch card, selling and the Fish Book entry, casting and retrieving, boarding, raising the anchor, driving, trolling, anchoring, the bite tables, the pause and upgrade menu, exiting and the result screen.

## Known limitations (v0.1)
- The angler doesn't walk between the jetty and the boat; boarding is instant.
- Jigging and trolling work but are simpler than casting and bottom fishing (no lure action, and there is one trolling line).
- The boat's pitch and roll are simple, not driven by the waves.
- Rendering was checked by calculation and headless tests; the remote Chrome screenshot tool kept timing out during development, so take a quick look on a real phone.
