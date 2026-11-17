# CLAUDE.md — Memory Map (code repository)

Memory Map maps a person's life story across places and time: life events pinned to a map and laid out on a timeline, with memories and photos from the family. Read `README.md` for setup, deployment and tests.

## Non-negotiables

- Built for older, less technical users: large text, high contrast, big touch targets, plain language, tablet-friendly. Simplicity beats features.
- Tone is warm and respectful; the product deals with memory, ageing and grief, especially in memorial mode.
- Rough answers are valid, never errors: "Only roughly" addresses and dates like "early 1960s".
- One owner per map; invited contributors add memories and photos only, plus people and connections in the family tree and friends (decided 17 Nov 2026). This is enforced in the database, not just the interface.
- Private-only. Do not add public or community features without an explicit decision.

## How it is put together

- Static Vite app in plain JavaScript with Leaflet. No server of our own.
- `src/main.js` is the interface; `src/store.js` holds every Supabase call; `src/when.js` reads rough dates; `src/family.js` lays out the family tree and names relationships. Friends are `people` with `kind = 'friend'`: shown beside the tree, never in family links (enforced in `0005_friends.sql`). `src/paths.js` finds where two connected maps crossed (same place ≤ 1 km, nearby ≤ 25 km, years overlapping; each place paired once).
- Connected maps (`0006_map_connections.sql`): owner asks by email, the other owner accepts. Only the two owners see anything, and only places through `connected_places()` (title, category, dates, pin, town/state/country — never memories, photos, people or street). Invited family see nothing.
- Supabase (Sydney) provides sign-in, Postgres with row level security, and a private photo bucket. Schema and rules live in `supabase/migrations/`.
- Hosted on Vercel; every merge to `main` deploys to production, and every pull request gets its own preview link.

## Working rules

- Database changes go in a new numbered file under `supabase/migrations/`. Never edit an applied migration.
- `main` is protected: never push to it directly. Work on a branch, open a pull request, and merge once the **Tests** check (`.github/workflows/tests.yml`: `npm test` + `npm run test:e2e`) passes. Other chats may be working at the same time, so rebase on `main` before merging.
- Run `npm test` and `npm run test:e2e` locally too. Add a test with any change to access rules.
- Features are tracked as GitHub issues (`[MM-xx]` titles, matching the Google Sheet "Memory Map – Feature tracker", where Steph adds ideas). Labels: `status: …`, `area: …`, `priority: …`, `size: S/M/L`, `idea from Steph`. Put `Closes #N` in the pull request so the issue closes on merge, and copy new Sheet ideas into issues when they are picked up.
- Never commit the Supabase `service_role` key. The publishable key is public by design.
- If a new outside host is needed (map tiles, geocoder, fonts), add it to the Content-Security-Policy in `vercel.json`.
- When sign-in misbehaves, read the Supabase auth logs first.

## Status (17 Nov 2026, evening)

Deployed at https://memory-map-nine-sooty.vercel.app. Sign-in email goes through custom SMTP via Resend (`hello@memorymap.anuki.com.au`). Family tree, places and photos are not yet proven on a real signed-in map (issue #13).
