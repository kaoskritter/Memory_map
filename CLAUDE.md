# CLAUDE.md — Memory Map (code repository)

Memory Map maps a person's life story across places and time: life events pinned to a map and laid out on a timeline, with memories and photos from the family. Read `README.md` for setup, deployment and tests.

## Non-negotiables

- Built for older, less technical users: large text, high contrast, big touch targets, plain language, tablet-friendly. Simplicity beats features.
- Tone is warm and respectful; the product deals with memory, ageing and grief, especially in memorial mode.
- Rough answers are valid, never errors: "Only roughly" addresses and dates like "early 1960s".
- One owner per map; invited contributors add memories and photos only. This is enforced in the database, not just the interface.
- Private-only. Do not add public or community features without an explicit decision.

## How it is put together

- Static Vite app in plain JavaScript with Leaflet. No server of our own.
- `src/main.js` is the interface; `src/store.js` holds every Supabase call; `src/when.js` reads rough dates.
- Supabase (Sydney) provides sign-in, Postgres with row level security, and a private photo bucket. Schema and rules live in `supabase/migrations/`.
- Hosted on Vercel; every push to `main` deploys to production.

## Working rules

- Database changes go in a new numbered file under `supabase/migrations/`. Never edit an applied migration.
- Run `npm test` and `npm run test:e2e` before pushing. Add a test with any change to access rules.
- Never commit the Supabase `service_role` key. The publishable key is public by design.
- If a new outside host is needed (map tiles, geocoder, fonts), add it to the Content-Security-Policy in `vercel.json`.
- When sign-in misbehaves, read the Supabase auth logs first.

## Status (17 Nov 2026)

Deployed at https://memory-map-nine-sooty.vercel.app. A full real sign-in has not yet been completed. Email uses Supabase's built-in sender (about two emails an hour, default template); a sending domain with custom SMTP is the outstanding fix before inviting family.
