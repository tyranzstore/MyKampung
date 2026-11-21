# Online foundation: sign-in, cloud save, rooms

Status: **client code and database schema are in the repository. Nothing is deployed.** Until
`js/online-config.js` is filled in, the Online menu only says "Belum disediakan" and nothing connects.

## What is implemented

| Part | Where | Tested |
|---|---|---|
| Email magic-link sign-in (no passwords) | `js/online.js` `signIn`, `currentUser`, `signOut` | fake client only |
| Cloud save upload, newer wins on the server | `pushCloud` + `put_save()` in `backend/supabase/schema.sql` | fake client; SQL on Postgres 16 with stubbed `auth`/`realtime` |
| Cloud restore, only after the player confirms | Menu → Online → Restore; uses `parseSave` + `importSave` (old save kept as `tkh_town_v1_preimport`, then reload) | not against a real backend |
| Background upload every 2 min while signed in | `startCloudSync` in `js/main.js` | not against a real backend |
| Rooms: join by code, live member list (name, chapter, stars, current mission place) | `joinRoom` (Realtime private channel `room:<CODE>` + presence) | fake client only |
| Row Level Security: a player can only read and write their own save; only signed-in players can use rooms | `schema.sql` | SQL checks on Postgres 16 (stubs) |

Save safety is unchanged: the local save is still the source of truth. An outdated tab never uploads
(`isStale()`), a fresh install never uploads over a cloud game, and a cloud save never replaces the local
one without the player pressing "Ya, ganti". Presence from other players is sanitised and rendered as text.

## Not implemented yet

- Other players are not drawn in the 3D village (only listed in the room pop-up).
- No shared mini-games, chat, friends list, leaderboards or anti-cheat. Coins and stars are client-side,
  so a player can edit their own save; do not attach real money or prizes to them.
- No account deletion button (deleting the user in Supabase removes their save via `on delete cascade`).

## What you need to configure

1. Create a Supabase project (free tier is enough to start).
2. SQL editor → run `backend/supabase/schema.sql`.
3. Authentication → Providers → Email: enabled (magic link). Authentication → URL Configuration:
   set Site URL and add your game URL (for example your GitHub Pages URL) to Redirect URLs.
4. For real use, set up custom SMTP (Authentication → Emails); the built-in sender is heavily rate limited.
5. Realtime → Settings: turn off "Allow public access" so the room policies in `schema.sql` apply.
6. Put the Project URL and the **anon public** key in `js/online-config.js`. Never use the `service_role` key.
7. Test with two devices: sign in on both, upload on one, restore on the other, join the same room code.

The client loads `@supabase/supabase-js@2.45.4` from cdn.jsdelivr.net only when online is configured.
