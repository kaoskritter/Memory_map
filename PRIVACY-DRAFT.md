# Privacy policy: working notes (not a finished policy)

This is a checklist for whoever writes the real policy. It is not legal advice and has not been reviewed by a lawyer.

## What the beta actually does today

- Collects: email address (sign-in), names people type, places and addresses (some approximate), dates, written memories, photos, and who invited whom.
- Much of this is about a third person (the subject of the map) and other family members named in memories, who may not have an account. Some of it can be sensitive (health, religion, family circumstances mentioned in a memory; places of worship; end-of-life details).
- Stored with Supabase (database and private photo storage, Sydney region if set up as the README says). Site served by Vercel. Fonts load from Google Fonts. Map images load from OpenStreetMap, which sees the viewer's IP address and which map areas are viewed. "Find it for me" sends the typed address to OpenStreetMap's Nominatim service.
- Access: the map's owner and the people they invite. Project administrators with Supabase dashboard access can technically read everything.
- People can download a copy (places and memories) and delete a whole map. Deleting an account itself is currently a manual request.
- No analytics, advertising or tracking cookies. Sign-in state is kept in the browser's local storage.

## Things the policy needs to decide and say

- Who the operator is (legal entity, contact address) and how to make a privacy request or complaint.
- Consent and expectations for information about people other than the account holder, including living third parties named in someone else's memory.
- What happens to a living-mode map when its subject dies, and to any map when its owner dies or stops responding.
- Retention: how long data is kept after deletion (backups), and after an account goes quiet.
- Overseas disclosure: Vercel, Google Fonts and OpenStreetMap serve from outside Australia.
- Children: memories and photos will include children.
- Data breach response (Notifiable Data Breaches scheme) if the operator is covered by the Privacy Act.
- Whether self-hosting fonts and switching to a contracted map provider is preferable before wider release.
