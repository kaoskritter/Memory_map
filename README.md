# Memory Map

A life story, told through its places. Homes, schools, jobs, favourite spots and life events are pinned to a map and laid out on a timeline, with memories and photos from the family.

This repository is the invite-only beta: a static web app (Vite, plain JavaScript, Leaflet) that talks straight to Supabase (sign-in, database, private photo storage). There is no server of our own to run.

## What is in the beta

- Map, Timeline, and the two side by side with cross-highlighting; Photos view; category filters
- Sectioned "Add or change places" page with fields that open in place
- Rough answers welcome: "I know the address / Only roughly" on every place, and dates like "early 1960s"
- Names over the years (birth name, nicknames, married names)
- Living and memorial modes (memorial adds farewell and resting places)
- One owner per map; invited family can add memories and photos but not change places
- Sign in by emailed link or 6-digit code, no passwords
- Invite-only: accounts are created only for emails on the beta list or invited by an owner
- Download a copy, delete a map, text size setting, a built-in example ("Peggy")

## Deploying (about 30 minutes, once)

### 1. Supabase

1. Create a project at supabase.com. **Choose the Sydney (ap-southeast-2) region**: the in-app privacy note tells people their stories are kept in Sydney.
2. SQL Editor: paste and run each file in `supabase/migrations/`, in order.
3. Add yourself to the beta list (SQL Editor):
   ```sql
   insert into public.beta_allowlist (email, note) values ('you@example.com', 'founder');
   ```
   Emails must be lower case. Add each person who may *start* a map. People who are only invited to add memories do not need to be on this list.
4. Authentication > URL Configuration: set **Site URL** to your Vercel address (step 2 below) and add it under **Redirect URLs** too (add `http://localhost:5173` for local work).
5. Authentication > Email Templates > **Magic Link**: include the code so people can sign in on a different device from the one their email is on. For example:
   ```html
   <h2>Sign in to Memory Map</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
   <p>Or type this code: <strong>{{ .Token }}</strong></p>
   ```
   Put the same wording in the **Confirm signup** template as well, so a person's very first email matches whichever template Supabase uses for new accounts.
6. **Set up your own email sender before inviting anyone** (Authentication > SMTP Settings, for example with Resend or Postmark). Supabase's built-in sender is for testing only: it sends about two emails an hour and only to members of your Supabase team, so invited family would never receive their sign-in email. With your own sender, raise the limit under Authentication > Rate Limits if needed.
7. Project Settings > API: copy the **Project URL** and the **anon / publishable key**.

### 2. Vercel

1. Import this GitHub repository at vercel.com. The framework is detected as Vite; `vercel.json` already sets the build and security headers.
2. Project > Settings > Environment Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.7, then redeploy.
3. Put the resulting address into Supabase (step 1.4).

The anon key is meant to be public. What protects the data is the row level security in the migration, which is covered by the tests below. Never put the `service_role` key in Vercel or in this repository.

### 3. Check it

Sign in with your own email, start a map, add a place with a photo, invite a second address you control and sign in as them in a private window.

## Working on it locally

```bash
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev
```

Without the Supabase values the app still runs and shows only the example.

## Tests

```bash
npm test            # date reader + access rules, run against the real migration in an in-process Postgres
npm run test:e2e    # the built app in Chrome against a mock Supabase (set CHROME_PATH if Chrome is elsewhere)
```

`npm test` proves the rules in `0001_init.sql`: strangers and signed-out visitors read nothing, contributors can add but not edit, uninvited emails cannot create accounts, deleting a map removes everything.

`npm run test:e2e` walks the whole journey (sign in, start a map, add a place, invite, contribute, memorial mode, delete) with the same security headers Vercel sends. It uses a stand-in for Supabase's HTTP API, so it does not replace step 3 above on the real thing.

## Before opening the beta wider

- **Map tiles.** The default is OpenStreetMap's public tile server, which is fine for a small private beta but is not meant for heavier use. Set `VITE_TILE_URL` and `VITE_TILE_ATTRIBUTION` to a provider with a key (MapTiler, Stadia, Mapbox) and add its host to `img-src` in `vercel.json`.
- **Address lookup.** "Find it for me" uses OpenStreetMap's Nominatim (at most one request a second, by policy). Set `VITE_GEOCODE_URL` to a paid geocoder and update `connect-src` in `vercel.json` when traffic grows.
- **Privacy policy and terms.** The in-app note ("How we look after your stories") is a plain-language summary, not a legal document. `PRIVACY-DRAFT.md` lists what a proper policy needs to cover under the Australian Privacy Principles; have it reviewed before open sign-up.
- **Backups.** Turn on Supabase point-in-time recovery or scheduled backups (paid plan). Photo files are not included in database backups.
- **Download a copy** exports places and memories as a file; photos are not in it yet.
- **Invitation emails** are not sent by the app: the owner copies a ready-made message. Sending them automatically needs a small server function and your email sender.

## How it fits together

| Path | What it is |
|---|---|
| `src/main.js` | The whole interface: sign-in, views, edit page, settings |
| `src/store.js` | All Supabase calls, plus the in-memory store behind the example |
| `src/when.js` | Reads rough dates ("early 1960s", "1958 to 1964", "since 2015") |
| `src/categories.js`, `src/sample.js` | Categories and the made-up example life |
| `supabase/migrations/0001_init.sql` | Tables, access rules, invite-only sign-up, private photo bucket |
| `tests/` | Access-rule tests, date tests, browser journey |

Rough dates sort by the earliest year they could mean; anything with no year sits under "Not sure when".
