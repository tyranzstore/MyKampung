# Futsal redesign (MyKampung v1.5)

Both modes at the Gelanggang Futsal were rebuilt in place. The map location, the mode chooser, Bab 4 unlock, rewards and saved stats are unchanged.

## Files

| File | Status | What it holds |
|---|---|---|
| `js/futsal3d.js` | **new** | The 3D side of futsal:<br>- `makeFooty()` jointed footballer and `animFooty()` procedural animation<br>- `buildArena()` (the shared arena)<br>- `match()`, the 3v3 scene with the follow camera<br>- `penalty()`, the shootout with its own HUD and controls |
| `js/futsal3v3.js` | rewritten | The match engine, HUD, controls and settings:<br>- `matchCore()`: physics, possession, passing and through balls, charged and curved shots, timed tackles, AI<br>- `f3Controls()`: compact HUD, joystick, buttons, keyboard, pause with settings, results<br>- `f3Session()`<br>- `Futsal3v3()`: 2D fallback |
| `js/minigames3d.js` | changed | Old `Futsal3D` and `Futsal3v3_3D` removed; both now come from `futsal3d.js`. Cleans up the HUD if 3D fails while building. |
| `js/minigames.js` | changed | New how-to-play cards for both modes. |
| `js/main.js` | changed | Penalty result text shows the shootout score; quitting a match pays nothing. |
| `style.css` | changed | `.f3*` / `.pk*` HUD replaced. While a match runs (`#game.f3mode`), the game header and tool bar are hidden. |
| `index.html`, `js/activities.js`, `js/town3d.js` | unchanged | `futsalCore` stays in `activities.js` for the 2D penalty fallback. |

## 3v3 match

- **Camera:** a lower perspective camera follows a point between your player and the ball. It looks ahead in the attacking direction (and leans back when defending), pulls out a little when the ball is far from you, and tightens on goals.
  - Movement is smoothed, and the field of view is worked out from the distance so players stay a steady size on screen.
  - The near side of the cage has only low boards, so the camera never looks through a fence.
  - Pause → 📷 Kamera switches between Close, Medium and Far.
- **Players:** stylised footballers about 1.78 m tall, with hip, knee, shoulder and elbow joints, jersey numbers front and back, shorts, socks, boots and hair. Animations: idle breathing, walk, run, sprint, dribble lean, pass and shot (wind-up then strike), standing poke tackle, slide tackle, skill feint, leaning into turns, stumble, and two goal celebrations.
- **Ball and play:**
  - **Dribbling:** the ball is pushed ahead with each stride rather than glued to the foot.
  - **Passing:** tap PASS for a pass to feet; hold it for a through ball into space, and the receiver makes the run.
  - **Shooting:** hold SHOOT to charge. The joystick picks the corner and adds curve, and the ball leaves the foot on the strike frame of the animation.
  - **Ball physics:** it bounces, rebounds off walls, posts and crossbar, and can be deflected off bodies and intercepted.
  - **Tackles:** they only win the ball if the foot actually reaches it. Tackles from in front work better, and the skill move beats most tackles.
  - **Aim assist:** Off, Normal or Strong, in the pause menu.
- **AI:**
  - **Attacking:** one wide forward run and one support option, both stepping out of their marker's shadow, with team-mates kept 3 m apart.
  - **Carrier:** shoots when there's a clear lane or it is close, passes or plays a through ball under pressure, and sometimes uses a skill move.
  - **Defending:** one player presses (on your team that's you), one guards the goal, one marks while closing the passing lane.
  - **Loose ball:** only the nearest player chases it.
- **HUD:**
  - **Top:** MYKAMPUNG 0-0 LAWAN in the centre, the clock top right, a small pause button top left.
  - **Bottom left:** a translucent joystick that appears where you touch, with an adjustable dead zone.
  - **Bottom right:** four compact translucent buttons (PAS/TEKEL, TENDANG/TUKAR, LARI, SKIL/PECUT) with a power fill and a skill cooldown.
  - **Layout:** respects safe-area insets, and scales down on short landscape screens.
  - **Browser gestures:** pinch and scroll gestures are blocked during the match.
  - **Instructions:** only on the short how-to-play card before the first match.

## Penalty shootout

- **Your kick:** a third-person camera behind the taker shows the whole goal and keeper.
  - Drag anywhere to move the reticle (low, high, left, right, centre); arrow keys or WASD also work.
  - Hold TENDANG (or Space) to charge and release to kick. Too much power makes the shot wild; too little makes it slow. Aim assist narrows the error.
  - The taker runs up and strikes, and the camera follows the ball.
- **Their kick:** the camera moves behind your keeper. Tap KIRI / TENGAH / KANAN (or ←/↑/→) to dive; the dive height matches the shot automatically.
- **Keeper AI:** reads slower shots more often, sometimes guesses wrong, and dives along the line. A save is decided from the keeper's actual body position when the ball arrives.
- **Effects:** goal, save, post and miss each have their own effect: net bulge, confetti, the crowd jumping, and sounds.
- **Replay:** a short slow-motion replay from the side follows every kick; tap to skip.
- **Format:** 5 rounds that end early once one side can't catch up, then sudden death.
- **Results:** the scoreboard shows round dots for each side. The results screen offers MAIN LAGI and KEMBALI KE KAMPUNG.

## Arena (shared by both modes)

- **Court:** a sports surface with a TYRANZ centre logo and full futsal markings: centre circle, 6 m penalty areas, 6 m and 10 m spots, corner arcs and substitution marks.
- **Goals:** thick white frames with red bands and deep, slightly sagging nets.
- **Boards and fence:** LED ad boards (TYRANZ, MyKampung, Warung Nek Ma, Pok Wan Car Wash, Keropok Lekor Kak Long, Damai City Mall), and a chain-link cage on the far side and both ends.
- **Lighting:** four floodlights with glowing heads and a fill light. Shadows come from the main sun light.
- **Crowd:** an instanced crowd on the bleachers that cheers.
- **Surroundings:** stilt houses, palms, bunting and a TYRANZ banner.

## How to test (phone, landscape)

1. Tap the futsal court on the map, choose **Perlawanan 3v3**, and read the short card.
2. Check that the players are big and clear, the camera follows smoothly, and nothing covers the ball.
3. Try moving and sprinting at the same time with two thumbs. Try a tap pass, a held through ball, a charged shot with the stick to one side (it should curve), the skill move, a slide tackle while sprinting, and switching player.
4. Pause → change the camera and aim assist → resume.
5. Play to full time → MAIN LAGI → KEMBALI KE KAMPUNG.
6. Choose **Sepakan Penalti**: drag to aim, hold and release to shoot, then dive on their kick. Play to the end, including sudden death if level.
7. Back on the map, check that coins and the futsal record updated, and that other activities and missions still work.

## Known limitations

- I couldn't see the redesign on a real screen. Claude in Chrome would not return screenshots during this session, so camera framing, player size and lighting were checked by calculation and headless tests only. Please report anything that looks off.
- The players are procedural low-poly figures, not motion-captured rigs; there were no licensed footballer GLBs with the needed animations in the project.
- 3v3 still has no goalkeepers (as in v1.4), and no fouls or cards.
- In 2D graphics mode, the penalty game is still the old simple version. The 3v3 2D view is top-down and uses the new HUD.
- Performance should suit mid-range phones, but I haven't measured frame rates on real devices.
