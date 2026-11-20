# MyKampung — v2.0

## What's new in v2.0: Bola Tampar Pantai 2v2 + Simulator Foto 3D
- **Beach volleyball 2v2** at Pantai Miami:
  - you and an AI teammate against two AI opponents, with real rules (3 touches, block counts, rally scoring to 7/11/21, win by 2)
  - charged serves, spike timing, blocks and dives
  - three AI levels, beginner assist and three camera modes
- **3D photo simulator:**
  - your TYRANZ hero in 12 poses with an orbit camera
  - 7 locations and day/sunset/night
  - filters, frames and a gallery saved on the device
  - photo missions that pay RM
- New `js/heropose.js` poses the real hero model in code (no rig needed).
- Details, controls and the test log are in **VOLLEY_PHOTO.md**.

## What's new in v1.9: Damai City Mall v2.0
The 3D Misi Beli-Belah is now a supermarket simulator:
- 6 departments, real aisles and shelves stocked with 20 products.
- A pushable trolley with rolling wheels, swivelling front casters and collisions.
- Picking an item flies it into your trolley.
- A compact list with 🧭 navigation.
- Checkout with scanning and an itemised receipt.
- NPC shoppers who browse and queue.
- Easy, Normal and Hard difficulty.

See **MALL.md**.

## What's new in v1.8: Bab 5 · Pesta Kampung (Village Festival)
The village holds its first festival in twenty years at the **Balai Raya**, which is now unlocked.

**Missions:**
1. Talk to Tok Abah.
2. Meet Pak Ajis at the Balai Raya.
3. Buy festival supplies at Damai City Mall (the mall game).
4. Help Nek Ma cook for the feast (night-market stalls).
5. Sing **karaoke** at the Balai Raya.
6. Festival night with Tok Abah, ending in **fireworks**.

**Karaoke Balai Raya** is a new rhythm game:
- The song is "Kampung Kita", an original melody and lyrics written for the game, credited to Pak Ajis in the story.
- Notes fall in three lanes; tap them as they reach the line. Keyboard: A/S/D or J/K/L.
- Lyrics light up as you sing. The crowd and band react to how well you're doing.
- It works in both 2D and 3D.
- After Bab 5 it becomes a daily activity at the Balai Raya (🎤).

**On the map:**
- The Balai Raya gets bunting, pelita torches and a small stage with speakers.
- After the chapter, fireworks go off over the hall on festival nights (8 pm–1 am).

Saves that finished Bab 4 get the Bab 5 intro automatically. The next chapter teased is Bab 6 · Balik Raya.

## v1.7.4: mini-game screens
- **Header:** every mini-game now has a slim 44 px header over the game: ✕, title, a one-line instruction, a thin progress bar, %, timer and ?. The game fills the whole screen; the empty band at the bottom is gone. Tool buttons float at the bottom only when a game uses them.
- **Tebas Laman:** the machine-prep panel is smaller and sits at the top right, and Tok Abah's speech bubble is smaller at the bottom left, so the machine stays visible.
- **Tuai Padi:** the field camera is higher, so the bundles fill the screen. The threshing camera now looks from the side, so the bundle no longer blocks the tub.

## v1.7.3: cleaner screens
- **Home:**
  - One small status bar at the top left (RM, ⭐, rank, time, village spirit).
  - A one-line mission card: tap once to expand it, tap again to open the mission book.
  - **Tunjuk misi** and **Kerja** buttons sit at the bottom left; small icon buttons are on the right.
- **Map markers:** jobs show 💼 RM40/RM50 and activities show just their icon. Markers never overlap each other or the HUD, and place names only appear when you zoom in.
- **Jalan Drag:** the stats sit under the wallet, the side menu is slimmer, and the title moves over the free space when a menu is open.
- **Full screen:** you can add the game to your phone's home screen (Share → Add to Home Screen) to play it full screen without the browser bars.

## What's new in v1.7: Jalan Drag + RM economy
- Every reward now pays **Ringgit (RM)** through a single wallet (`js/wallet.js`). Old coins carry over 1:1.
- **Jalan Drag**, a drag racing game at Litar Drag: a 3D garage, 6 original cars and bikes, upgrades and customising paid in RM, and quick races against AI over ⅛, ¼ or ½ mile with burnout, start lights, launch, gear shifts and nitrous. See **DRAG.md**.


A 2D isometric village-revival game for phones and desktop. You drag and tap your way around the town map, follow mission cards, and play drag-based mini-games. It's plain HTML/CSS/JavaScript with no libraries and no image files. All art and sound are generated in code.

## What's new in v1.6: Simulator Pancing Laut (sea fishing)
Malaysian saltwater fishing from the kampung jetty or Pak Mat's boat: drive the boat, drop anchor, cast or bottom-fish, strike, and fight the fish with reel, drag and line tension. It has 10 sea species plus 4 everyday ones, an underwater camera, sonar, upgrades, day/night and weather, and a catch screen with the Malay name, length, weight and RM value. Open it from **Jeti Nelayan** (after Bab 3), **Menu → Aktiviti** or **Latihan**. The full guide is in **SEAFISH.md**.

## v1.5: futsal redesign
Both futsal modes were rebuilt: a low follow camera, bigger jointed footballers with animations, a compact HUD, better ball physics and AI, and a third-person penalty shootout with a diving keeper, 5 rounds, sudden death and replays. See FUTSAL.md.

## v1.4: Perlawanan 3v3 match mode

## What's new in v1.3: Bandar Baru & Damai City Mall
- **Bigger map**: a new town district, **Bandar Baru**, sits south of the kampung, reached from the kampung road and a new main avenue with traffic lights, a bus stop and street trees.
  - **Damai City Mall**: a purple-and-cream mall with a glass front that lights up at night, a cinema block, a fountain plaza and a car park. Tap it to play **Misi Beli-belah**: inside the mall, drag to look around, tap the right shelves to collect your shopping list, then pay at the checkout. It is a daily activity and also in Practice.
  - **Taman Rekreasi**: a playground (slide, swings, seesaw, merry-go-round, climbing frame, spring rider, sandbox), a duck pond, a gazebo, a fountain and picnic tables.
  - **SK Seri Damai**: a school with a flagpole, a school bus and a football field.
  - **Taman Luncur**: a skate park.
  - **Taman Ria**: a fun fair with a **Ferris wheel**, hot-dog and ice-cream stands.
  - Shop lots on the main road, with an ATM.
  - The **drag strip** moved to the south shore, which has a beach and waves of its own.
- **Life on the map**: animated shoppers walk the streets, the park and the skate park. Chickens, cats, a dog and goats wander in the kampung, ducks paddle in the park pond, and crabs and a turtle sit on Pantai Miami.
- **Upgraded activities**:
  - Futsal uses a real football model, with cones, a scoreboard and a trophy.
  - Volleyball uses a real volleyball, with crabs and an ice-cream cart on the sand.
  - The night market gets fruit stalls, food carts and lamp posts.
  - The drag strip gets grandstands, race flags and a banner.
  - The beach clean-up has 3D crabs.
- **Model pack 2** (`assets/models2.json`, about 7 MB) loads alongside the first pack.
  - Kenney textures are embedded, large textures are shrunk to 256 px, and the characters keep only their idle and walk animations.
  - Animated characters are cloned with SkeletonUtils so each one animates on its own.

## v1.2: activities, real waves, cleaner first person
- **Progress bar**:
  - Each step now fills to a full green **100%** and holds there for a moment before the next step or the result screen.
  - A percentage readout sits next to the bar.
- **No more first-person arms**: the hands and arms that followed the pointer in the 3D mini-games are gone.
- **Ocean** (`js/ocean.js`):
  - The sea is rebuilt as a lit wave surface. Gerstner swells (vertex displacement with matching normals) are calm near the beach and choppier offshore.
  - Ripples scroll across the surface, it reflects the sky at low angles, it gets darker in deep water, and foam forms on the wave crests.
  - Breaking-wave foam bands roll up the sand along the town beaches and in the beach, volleyball and photo scenes. The fishing and boat scenes get the same water.
- **New map activities** (from Bab 4). Tap them on the map or open Menu → Aktiviti. Each pays 10 coins + 3 per star, once a day, and they are all in Practice.
  - ⚽ **Gelanggang Futsal**: penalty shoot-out against a keeper who gets smarter with each goal. Aim, then hold for power and release in the green zone.
  - 🏐 **Bola Tampar Pantai**: on the sand at Pantai Miami. Move under the ball's shadow and tap when it is inside the green ring. Win with 10 returns.
  - 📸 **Booth Foto Jambatan Angkat**:
    - Choose a pose and day, sunset or night (the towers light up at night).
    - Frame the bridge inside the guide box and snap.
    - Each photo comes out as a framed print you can save.
  - 🏁 **Litar Drag 402m**: Christmas-tree start lights, reaction time, and gear changes in the green band. You race a red rival car from the driver's seat.
  - 🏮 **Pasar Malam**: play as **Peniaga** (seller) or **Pembeli** (buyer).
    - Seller: make up each order and give the exact change.
    - Buyer: buy your list from the stalls with the cash in your wallet, and bargain for RM1 off.

## v1.1: Bab 4 · Pantai Miami
- **Bigger map**: the 3D town now extends east to a Pantai Miami beach (modelled on Pantai Seberang Takir, Kuala Nerus) with palms, wakaf, beach umbrellas, a PANTAI MIAMI sign, wau kites, a river mouth, a city skyline across the river, and a coastal road.
- **Jambatan Angkat**: a bascule drawbridge with four tall towers, skybridges joining each pair, gold bands and teal roofs. The towers light up at night. It lifts on its own every so often to let a boat through.
- **New NPC**: Kak Long, at her keropok lekor stall on the beach.
- **Bab 4 · Pantai Miami** (5 missions):
  1. Tok Abah.
  2. Meet Kak Long.
  3. Clean the beach.
  4. Watch the drawbridge lift as Pak Mat's boat sails under it.
  5. Back to Kak Long.
- **New mini-game Bersih Pantai** (3D first person + 2D):
  - Drag rubbish into the right bin: blue KITAR SEMULA for bottles, cans and glass; green SAMPAH AM for bags, straws, styrofoam and wrappers.
  - Rubbish put in the wrong bin bounces back.
  - The drawbridge stands in the background, and crabs scuttle across the sand.
- **New daily job**: Bersih pantai (+25).
- **Renames**: Cikgu Aqilah, Nek Ma (Warung Nek Ma), Pok Wan (Pok Wan Car Wash), Pak Ajis. Balai Raya now opens in Bab 5.

## Earlier updates (v1.0.x)
- Fishing: the camera follows the bait underwater (seabed per spot, light rays, real 3D fish) — watch the nibbles, tap when the fish takes the bait, see the hook set, then fight from the boat.
- `js/fishskin.js`: painted, species-specific skins for all 30 fish (countershading, scales, lateral line, markings from FishBase/FAO descriptions), translucent fins, glossy eyes.
- Clearer first-person fishing view (net-hauler arm hidden, rod and arms tucked bottom-right).
- Sound: procedural fishing-boat engine (exhaust pulse train through hull/muffler resonances, prop wash, hull slaps) and sea ambience; original background music ("Petang di Kampung" for the village, "Angin Laut" at sea) played live by a WebAudio synth band (gambus-style pluck, bonang chimes, bass, kompang). Toggle in Menu → Muzik.
- Brush-cutter start-up close-up (fuel, primer, choke, pull cord, open choke); how-to-play signs for every mini-game.

## What's new in v1.0: first-person mini-games + TYRANZ hero
- **All 3D mini-games are first person**: the camera is the player's eyes and the player's own arms (black sleeves, skin-tone hands) reach out to whatever they hold — scraper, roller, hose, sponge, sickle, padi bundle, wooden patch, fishing rod.
- **Tebas Laman** uses the **TYRANZ backpack brush cutter**: start it on the grass (fuel, primer, pull cord), then hold its handlebar in first person — drag and you walk with the blade.
- **Main character**: the TYRANZ hero (`assets/tyranz/Hero.glb`, texture reduced to 1024 px) stands beside your current mission on the town map and poses with your catch in the fishing game.

## What was new in v0.9: fishing simulator on Pak Mat's boat
- **TYRANZ models** packed into `assets/models.json`: Fishing_Boat, Passenger_Bus, Airliner and 30 Malaysian sea fish (originals in `assets/tyranz/` and `assets/fish/`).
- **Memancing (3D)** is now a boat trip: pick a spot (Pantai, Terumbu Karang, Laut Dalam), watch the boat sail out from the jetty, then fish from the deck.
  - Cast: press & hold for power (aim ring shows where it lands), drag left/right to aim, release to throw.
  - Bite: tap when the float sinks; rarer fish give you less time.
  - Fight: hold to reel, watch the tension bar (red = line snaps) and the fish stamina bar; when the fish runs, drag the opposite way. Big fish may leap out of the water.
  - Catch: the angler poses holding the 3D fish, with a card on the right: name (BM + English), weight, estimated price (RM) and rarity (Biasa, Luar Biasa, Jarang, Epik, Legenda).
- **30 species** with real names, weights, market prices and habitats (`FISH` in `js/minigames.js`). Deep sea has the rarest fish, including the legendary Ikan Tuna Sirip Kuning.
- **Buku Ikan (Fish book)** in the menu: species caught, count and personal best weight.
- Nek Ma and the daily job pay from the estimated price of your catch.
- Town: Pak Mat's repaired boat is now the TYRANZ fishing boat; a TYRANZ bus runs on the main road and stops at the bus shelter; an airliner flies over now and then.
- 2D fallback uses the same fishing rules (top view).

## What was new in v0.8: Bab 3 · Turun ke Laut (Out to Sea)
- **Mini-game finish fix**: tasks now need 96% (was 90–94%), and when a step completes, whatever is left on screen gets cleared (dust, foam, water spots, mud, paint gaps), so the screen matches the progress bar. Tuai Padi threshing now needs 8 *good* hits to fill the tub; misses only lower the stars.
- **Bab 3** (6 missions): Tok Abah → meet Pak Mat at the jetty → fix his boat → go fishing → sell the catch to Nek Ma → back to Pak Mat.
- **New villager**: Pak Mat, the fisherman (on the sand by the jetty). The jetty is unlocked; his boat sits upturned on the sand until you fix it, then floats by the jetty in the colour you painted.
- **New mini-game Baiki Bot** (3D + 2D): scrape barnacles, drag wooden patches onto 3 holes, then paint the hull a colour of your choice.
- **New mini-game Memancing** (3D + 2D) — upgraded in v0.9 (see above).
- **New daily job**: fishing at the jetty (+25 coins, 4 fish), unlocked after Bab 3. Both games are also in Practice.
- Saves that finished Bab 2 before this update get the Bab 3 intro screen. Next: Bab 4 · Pesta Kampung (balai raya).

## What was new in v0.7: Bab 2 · Musim Menuai (Harvest Season)
- **Chapter system**: `CHAPTERS` in `js/main.js`. Saves that finished Bab 1 move straight into Bab 2 with a "new chapter" screen.
- **6 new missions**: Tok Abah → meet Pak Hassan → *Tuai Padi* → sell the rice to Uncle Lim → invite Amin, Cikgu Aqilah and Pak Ajis to the feast → *kenduri kesyukuran* at the padi field
- **New mini-game, Tuai Padi** (3D, with a 2D fallback): swipe the sabit across the ripe clumps → tap the bundles to gather them on the tikar → tap in time to *banting* (thresh) the padi into the wooden tub
- **4 new villagers**: Pak Hassan (padi farmer), Uncle Lim (kedai runcit), Cikgu Aqilah and Pak Ajis. They appear from Bab 2.
- **The padi field changes**: green → ripe gold → harvested stubble, and it ripens again the next day
- **New daily job**: harvest padi at Pak Hassan's field (+25 coins), unlocked after Bab 2
- A new title, *Ketua Belia* (70 stars), and Tuai Padi in Practice mode
- **Next**: Bab 3 · Turun ke Laut (jetty, fishing, boats)

## What was new in v0.4–0.5
- Real 3D models in the village: Kenney cars, lamps, fences and brick houses; Quaternius palms and trees; KayKit grass, bushes, rocks, a water tower, traffic lights, benches, bins and a hydrant; HHG scooters and bicycles
- The mini-games use KayKit tools: the hammer on the roof, plus buckets and tools around each scene
- All models are packed into `assets/models.json` (base64 GLB) and loaded through `js/models.js`. To add a model, convert it to GLB, add it to `MODEL_FILES`, and rebuild the pack with `tools/build_models.py`

## What was new in v0.3
- **The town map is now real 3D** (Three.js, isometric orthographic camera): stilt houses with verandahs, stairs and zinc, clay-tile or attap roofs; a shophouse row with signboards, awnings, louvred shutters and parked scooters; a warung, a car wash, a surau with a minaret, the balai raya, a padi field, a beach, a jetty with boats, palms and trees, street lamps, walking villagers and traffic (including a police car)
- Lighting uses ACES tone mapping and soft shadows, follows real time with warm evenings, and at night the windows and street lamps glow
- The static scenery is merged into a handful of draw calls, so it stays smooth on phones
- Labels and markers are drawn by the page, so they stay crisp on every screen
- The 2D map remains as a fallback: it's used automatically if 3D fails, and players can choose it in the menu (*Grafik: 2D*)
- `js/town3d.js` is the 3D town. CC0 model packs (Kenney, Quaternius) will plug into it next.

## What was new in v0.2
- The project is renamed to **MyKampung**
- All 3 mini-games are now **3D** (Three.js r170): an instanced 3D grass field with a working brush cutter, a 3D stilt house with a paintable wall and nail-in zinc roof, and a 3D car in a car-wash bay with water, foam and a finishing spin
- The camera framing adapts to phone portrait, phone landscape and desktop
- The menu has a 3D/2D graphics toggle, and the game falls back to 2D on its own when 3D isn't available

## What's in this build
- **Kampung Seri Damai map**: stilt houses, a warung, a car wash, a surau, a sundry shop, a balai raya, a padi field, a beach, a jetty and a boat, palm trees, walking villagers and moving cars
- **Map controls**: drag to pan · pinch, mouse wheel or the + − buttons to zoom · tap people and places
- **Chapter 1 · Pulang ke Kampung** (6 missions) with a mission card, the Mission Book, and **➤ Tunjuk tempat**, which pans the map to the mission
- **3 mini-games**, each scored with 1–3 stars and replayable:
  - *Tebas Laman*: fill the fuel → press the primer 3× → yank the cord → drag to cut → drag the piles into the bag → tie it
  - *Baiki Rumah*: scrape the old paint → pick a colour and paint (the house on the map changes to it) → drag zinc sheets over the holes → tap each nail when the ring turns green
  - *Cuci Kereta*: rinse → soap → scrub the mud spots → rinse → dry
- **Daily jobs**: 3 per day (neighbours' yards and the car wash), 20 coins each, +25 for finishing all three. They reset at midnight on your device.
- Coins, stars and titles (Budak Baru → Anak Kampung → Geng Kampung → Wira Kampung), plus the "village spirit" bar
- The real clock drives morning, evening and night lighting, with lamps and windows glowing at night. The menu has an "always daytime" option.
- Locked teasers for Chapter 2 (padi), Chapter 3 (jetty and fishing) and Chapter 4 (balai raya)
- Bilingual BM/EN text, synthesised sound effects, and saving in localStorage (`tkh_town_v1`)

## Run / deploy
Serve the folder over HTTP (`python -m http.server 8000`), or drag the unzipped folder onto Netlify Drop. It needs no build step. The game needs internet access for the Three.js CDN (the 3D mini-games) and Google Fonts. Without them it falls back to the 2D mini-games and system fonts.

## Code map
- `js/core.js`: save data, the WebAudio synth, toast, dialogue and modal UI
- `js/town.js`: isometric renderer (tiles, buildings, people), camera and gestures, tap detection, day/night
- `js/minigames3d.js`: the **3D mini-games** (Three.js). Taps and drags are raycast onto the 3D scene, so they work with mouse and touch alike.
- `js/minigames.js`: the 2D versions of the same games. They're used automatically if the device can't run WebGL, or if the player picks *Grafik mini game: 2D* in the menu.
- `js/main.js`: the story (MISSIONS / LINES), daily jobs, rewards, HUD and menus

### Adding things
- **New mission**: append to `MISSIONS` in main.js and handle its target in `onTap()`/`talk()`
- **New building**: add an entry to `OBJ` in town.js (`kind: house | shop | warung | carwash | surau | balai`)
- **New mini-game**: write a function like `Grass(api, opts)` returning `{down, move, up, update, draw}` and register it in `runGame`

## Not yet built (next steps)
Chapter 4 (futsal, karaoke, village festival), jet ski, snooker, shops and spending coins, house decoration, character customisation, accounts and cloud save, online player counts, leaderboards and multiplayer. The online features need a backend (for example Supabase or Firebase).

## Credits (required for the HHG models)
- 3D models: Kenney — City Kit (Suburban), City Kit (Roads), Car Kit (CC0), kenney.nl
- Nature models: Ultimate Nature Pack by Quaternius (CC0), converted from OBJ to GLB
- Props, nature and tools: KayKit City Builder Bits, Forest Nature Pack, RPG Tools Bits, Furniture Bits and Restaurant Bits by Kay Lousberg (CC0), kaylousberg.com
- Rowboats: Low Poly Sea Assets by Atomic Realm (atomicrealm.itch.io). Free for commercial use, but the assets must not be repackaged, resold or redistributed on their own. The licence is in `assets/sea/LICENSE.png`.
- **HHG Game Development 3D Models Kit by Hyper Hollow Games (hyperhollowgames.net/3d-models-kit)**: scooter, bicycle and small car. Free for use in games (including commercial ones), but the credit is required and the models must not be resold or re-uploaded on their own. The licence is in `assets/hhg/LICENSE.txt`.
- three.js (MIT)
