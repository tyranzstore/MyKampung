# v2.0 — Bola Tampar Pantai 2v2 + Simulator Foto 3D

Both games keep the original entry points: the `volley` activity (place `volley`, Pantai Miami) and the `photo` activity (place `photo`). Rewards still go through the daily activity payout in `main.js` (RM25 + RM10 per star) and the RM wallet (`js/wallet.js`).

## New and changed files
| File | What |
|---|---|
| `js/heropose.js` | **New.** Procedural posing of the real TYRANZ `hero` GLB. The model has no skeleton, so the vertices are skinned in code (arms, elbows, legs, knees, torso, head). Contains 12 photo poses, 9 volleyball action poses, a running cycle and smooth pose blending. |
| `js/volley3d.js` | **New.** 2v2 beach volleyball scene (`volleyScene`). |
| `js/photo3d.js` | **New.** 3D photo simulator (`photoScene`), IndexedDB gallery and photo missions. |
| `js/minigames3d.js` | `volley` → `VolleyV2`, `photo` → `PhotoV2`, each wrapped in `futSafe`. The old `Volley3D` and `Photo3D` stay in the file for reference, and the 2D fallbacks are unchanged. |
| `js/minigames.js` | New tutorial cards for both games. |
| `js/main.js` | Result-screen lines for volleyball (score) and photos (number saved). |
| `js/activities.js` | Activity names. |
| `style.css` | New `.vb` and `.ph` sections at the end. |

## Bola Tampar Pantai 2v2
You play with an AI teammate against two AI opponents.

- **Rules**
  - Rally scoring to 7, 11 or 21, win by 2.
  - Maximum 3 contacts per side. A block counts as a touch (beach rule).
  - Faults: net, outside the antenna, and out of bounds (the ball is out when the last team to touch it hits it out).
  - The serve rotates between the two players of a team on every side-out.
- **Physics**
  - Fixed 1/120 s step with gravity and side-spin curve.
  - The net is tested with a swept plane crossing, so a fast spike cannot pass through it.
  - Ground contact and in/out judgement.
  - The landing marker is yellow on your side, white on theirs and red when the ball is going out. An optional trajectory preview shows dots along the path.
- **Controls**
  - Joystick on the left (or WASD).
  - One context button (Space or J): SERVIS → TERIMA → SET → REJAM.
  - BLOK (K) and SELAM/dive (L) — the dive button only appears when the ball is out of reach.
  - Camera button (C) cycles Dynamic, Fixed and Wide. Pause with P or Esc.
- **Serve:** hold to charge the meter, which goes up and down, then release. Above 85% is a jump serve; near 100% risks going out. Joystick left/right aims.
- **Receive/set:** a green circle shows where to stand, and the window is forgiving. Pressing early is buffered for 0.35 s.
- **Spike:** a timing bar appears when you are the attacker. Perfect gives slow-motion and camera shake. Joystick aims: up for deep, down for short, left/right for the line.
- **Beginner mode** (on by default):
  - walks you to the contact spot when you're not touching the stick
  - gives a bigger reach
  - times your spike jump when you press slightly early
- **AI levels:** Mudah, Biasa and Sukar differ in reaction time, speed, pass error, spike rate and blocking. Sukar also places spikes into gaps.
- **Environment and HUD**
  - Sand texture, footprints and landing craters, sand puffs, a meshed net, ocean and shore waves.
  - Palms, umbrellas, a cheering crowd on bleachers, the referee stand and sea ambience.
  - Scoreboard with serving team, match point, pause menu (assist and trajectory toggles), and end card with Play again.

## Simulator Foto 3D
- **Character:** the real hero with 12 poses (Peace, Lambai, Kuat, Hati, Bagus, Santai, Bercekak, Duduk, Lompat, Bahu, Lucu, Salam) and smooth transitions. ⟲ ⟳ (or arrow keys) rotate the hero on its own.
- **Camera:**
  - one-finger drag orbits, pinch or mouse wheel zooms, two fingers pan, tap focuses (a focus square appears and the camera re-centres on what you tapped)
  - vertical slider for camera height
  - modes: Penuh (full body), Selfie and Kawan (group with an NPC)
- **Locations:** Jambatan Angkat, Pantai Miami, Kampung, Gelanggang Voli, Damai City Mall, Taman Rekreasi and Jalan Bandar, each built the first time you visit. Time of day is Day, Sunset or Night; the mall is indoors.
- **Shooting:**
  - crop 9:16, 1:1 or 16:9 with a live frame
  - rule-of-thirds grid, timer 0/3/5/10 s, flash and shutter sound
- **Filters and frames:**
  - filters: Asli, Cerah, Hangat, Sejuk, H&P (black and white), Vintaj
  - adjustments: brightness, contrast and warm/cool
  - background blur that keeps the subject sharp
  - frames: none, Polaroid, Film, Batik
  - location text and the TYRANZ watermark can be switched on or off
- **Capture:**
  - the 3D canvas only (no UI)
  - cropped to the frame, then graded pixel by pixel so it works on every browser
  - saved as a JPEG of up to 1440 px
- **Preview:** Retake / Save / Share. Share uses the system share sheet where supported and downloads otherwise.
- **Gallery:**
  - stored in IndexedDB `mk_photos`, falling back to memory if storage is blocked
  - favourite, delete (tap twice to confirm), export (download) and share, with date and location shown
  - limited to 40 photos: the oldest non-favourites are removed first
- **Photo missions** (saved in `S.photoMissions`, paid once through `wallet.earn`):
  - Jambatan Angkat — RM40
  - 3 different poses — RM40
  - Pantai Miami at sunset — RM50
  - With a friend (NPC) — RM40
  - All 7 locations — RM150

## Testing
- **Local:** serve the folder (for example `npx serve .` or `python3 -m http.server`), open `http://localhost:…`, then go to Pantai Miami → Bola Tampar or Booth Foto.
- **Headless checks I ran** (Playwright with a Three.js stub, so the game logic is tested without the GPU or models):
  - **Volleyball:** full matches to 7 on Mudah (won 7–3), Biasa (won 7–3) and Sukar (lost 1–7).
    - Serves, receives, sets, spikes, blocks, outs, side-out rotation, win-by-2 end card and the result screen with payout all worked.
    - Pause, camera cycling and the keyboard worked.
  - **Photo:**
    - orbit, wheel and pinch zoom, tap focus, poses, hero rotation
    - time, aspect, filters, blur and Polaroid frame; countdown capture → preview → save
    - all 5 missions paid RM320 in total; gallery count, favourite and delete; finishing returned 3 stars
  - Switching world → volleyball → photo three times in a row left no leftover HUD or listeners and no page errors.
  - Regression runs of the mall, Bab 5, Jalan Drag and module loading still pass.
- **Not verified here:** how the poses and scenes look on a real GPU with the real models (my test browser has no WebGL models). Please check on a phone: the hero's poses, the dive, the size of characters on screen, and the frame rate.

## Deploy (GitHub / Netlify)
No build step and no new dependencies; it uses the same Three.js r170 CDN import map. Upload the whole folder (or this zip) to Netlify or push it to GitHub Pages. IndexedDB and `navigator.share` need HTTPS, which both services provide.
