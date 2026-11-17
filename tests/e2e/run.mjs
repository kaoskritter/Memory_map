// End-to-end check of the built app in a real browser against the mock Supabase.
//   CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startMock } from './mock-supabase.mjs';

const root = new URL('../../', import.meta.url).pathname, API = 4401, WEB = 4400, api = `http://localhost:${API}`, web = `http://localhost:${WEB}/`;
const shots = join(root, 'test-results'); mkdirSync(shots, { recursive: true });
execSync('npx vite build --outDir dist-e2e', { cwd: root, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_ANON_KEY: 'test-key' } });

// Serve the build with the same security headers Vercel will send (plus the mock's address).
const hdrs = Object.fromEntries(JSON.parse(readFileSync(join(root, 'vercel.json'))).headers[0].headers.map((h) => [h.key, h.value]));
hdrs['Content-Security-Policy'] = hdrs['Content-Security-Policy'].replace('connect-src', `connect-src ${api}`).replace('img-src', `img-src ${api}`);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const site = http.createServer((req, res) => { let f = join(root, 'dist-e2e', req.url.split('?')[0]); if (!existsSync(f) || req.url.split('?')[0] === '/') f = join(root, 'dist-e2e/index.html'); res.writeHead(200, { ...hdrs, 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise((r) => site.listen(WEB, r));
const mock = await startMock(API);
await mock.db.query(`insert into beta_allowlist(email) values ('helen@example.com')`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const problems = [];
async function person(name) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } }), p = await ctx.newPage();
  await p.route(/fonts\.g|tile\.openstreetmap|nominatim/, (r) => r.abort());
  p.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|status of 40[036]|status of 500/.test(m.text())) problems.push(`${name}: ${m.text()}`); });
  return p;
}
async function signIn(p, email) {
  await p.goto(web); await p.fill('#si-email', email); await p.click('#signin button[type=submit]');
  await p.waitForSelector('#si-code'); await p.fill('#si-code', '123 456'); await p.click('#code button[type=submit]');
}
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const step = async (label, fn) => { try { await fn(); console.log('ok   ' + label); } catch (e) { problems.push(label + ': ' + e.message.split('\n')[0]); console.log('FAIL ' + label + '\n     ' + e.message.split('\n').slice(0,4).join(' | ')); } };

const helen = await person('helen'), tom = await person('tom'), nobody = await person('nobody');

await step('someone not on the guest list is turned away kindly', async () => {
  await nobody.goto(web); await nobody.fill('#si-email', 'nobody@example.com'); await nobody.click('#signin button[type=submit]');
  await nobody.waitForSelector('.notice'); assert.match(await nobody.textContent('.notice'), /not on the guest list/);
});
await step('the example opens without signing in', async () => {
  await nobody.click('[data-act=demo]'); await nobody.waitForSelector('.card'); assert.equal(await nobody.locator('.card').count(), 19); assert.equal(await nobody.locator('.pin').count(), 19);
  await nobody.screenshot({ path: join(shots, 'demo.png') });
});
await step('the example can join its places in order and lay out a memory book', async () => {
  await nobody.check('#f-path'); await nobody.waitForSelector('#map path.leaflet-interactive, #map .leaflet-overlay-pane path');
  await nobody.uncheck('#f-path'); assert.equal(await nobody.locator('#map .leaflet-overlay-pane path').count(), 0, 'line goes away');
  await nobody.click('[data-act=settings]'); await nobody.click('[data-act=book]');
  await nobody.waitForSelector('#book .cover h1'); assert.ok(await nobody.locator('#book .bk-place').count() > 5, 'places in the book');
  assert.ok(await nobody.locator('#book .memory').count() > 0, 'memories in the book');
  await nobody.screenshot({ path: join(shots, 'book.png') });
  await nobody.click('[data-act=closebook]'); await nobody.waitForSelector('#map', { state: 'visible' });
});
await step('the example family tree draws, names relationships, and links people to places', async () => {
  await nobody.click('[data-v=family]'); await nobody.waitForSelector('.famtree .pcard.me');
  assert.equal(await nobody.locator('.famtree .pcard').count(), 9);
  assert.ok(await nobody.locator('.famtree svg path').count() >= 8, 'lines drawn');
  await nobody.screenshot({ path: join(shots, 'family.png') });
  await nobody.click('.pcard[title="Ted Lawson"]'); await nobody.waitForSelector('#person h2');
  assert.match(await nobody.textContent('#person'), /Partner of Peggy/); assert.match(await nobody.textContent('#person'), /Married Ted Lawson/);
  await nobody.click('#person [data-act=openfromperson] >> nth=0'); await nobody.waitForSelector('#story .chip');
  assert.match(await nobody.textContent('#story .chips'), /Ted Lawson/); await nobody.click('#story [data-act=close]');
  await nobody.click('[data-v=both]');
});
await step('owner signs in with the emailed code and starts a map', async () => {
  await signIn(helen, 'helen@example.com'); await helen.waitForSelector('#newform');
  await helen.click('#nw-other', { force: true }); await helen.fill('#nw-name', 'Peggy Lawson'); await helen.fill('#nw-you', 'Helen'); await helen.fill('#nw-rel', 'Daughter'); await helen.click('#newform button[type=submit]');
  await helen.waitForSelector('.sechead'); assert.match(await helen.textContent('h1'), /Peggy Lawson/);
});
await step('owner adds a place with a rough address, fuzzy date, pin, memory and photo', async () => {
  await helen.click('.sechead[data-s=home]'); await helen.click('[data-act=new]'); await helen.waitForSelector('#pick.leaflet-container');
  await helen.fill('#e-title', 'Electra Street'); await helen.click('#p-a', { force: true }); await helen.waitForSelector('#e-rough');
  assert.equal(await helen.inputValue('#e-title'), 'Electra Street', 'typing survives the address switch');
  await helen.fill('#e-rough', 'Near the beach, Williamstown'); await helen.fill('#e-when', 'early 1960s');
  assert.match(await helen.textContent('#understood'), /1960 to 1963/);
  await helen.click('#pick', { position: { x: 200, y: 120 } }); await helen.fill('#e-mem', 'You could smell the sea.');
  await helen.setInputFiles('#e-photo', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpeg }); await helen.waitForSelector('.thumbs img');
  await helen.click('[data-act=save]'); await helen.waitForSelector('.entry');
  const r = (await mock.db.query(`select title, precision, year_from, year_to, lat is not null as pinned from events`)).rows[0];
  assert.deepEqual(r, { title: 'Electra Street', precision: 'approx', year_from: 1960, year_to: 1963, pinned: true });
  assert.equal((await mock.db.query(`select count(*)::int n from memories`)).rows[0].n, 1);
  assert.equal((await mock.db.query(`select count(*)::int n from photos`)).rows[0].n, 1); assert.equal(mock.files.size, 1);
});
await step('everything is still there after reloading, including the private photo', async () => {
  await helen.goto(web); await helen.waitForSelector('.card'); assert.equal(await helen.locator('.pin').count(), 1);
  await helen.click('.card'); await helen.click('.more [data-act=open]'); await helen.waitForSelector('#story .memory');
  assert.match(await helen.textContent('#story'), /smell the sea/);
  const okImg = await helen.locator('#story .photos img').evaluate((i) => i.complete && i.naturalWidth > 0); assert.ok(okImg, 'photo loads from signed link');
  await helen.screenshot({ path: join(shots, 'story.png') }); await helen.click('#story [data-act=close]');
});
await step('owner starts the family tree', async () => {
  await helen.click('[data-v=family]'); await helen.waitForSelector('.famtree .pcard.me'); await helen.click('.famhead [data-act=person]');
  await helen.click('[data-act=relpanel]'); await helen.waitForSelector('#relform'); await helen.fill('#r-name', 'Arthur Hartley'); await helen.fill('#r-born', 'about 1905');
  await helen.click('#relform button[type=submit]'); await helen.waitForFunction(() => document.querySelectorAll('.famtree .pcard').length === 2);
  assert.match(await helen.textContent('#person'), /Parents\s*Arthur Hartley/); await helen.click('#person [data-act=close]');
  const r = (await mock.db.query(`select kind from family_links`)).rows; assert.deepEqual(r, [{ kind: 'parent' }]);
  await helen.click('[data-v=both]');
});
await step('owner invites a relative', async () => {
  await helen.click('[data-act=settings]'); await helen.waitForSelector('#iv-email'); await helen.fill('#iv-email', 'Tom@Example.com'); await helen.click('#inviteform button[type=submit]');
  await helen.waitForSelector('#invtext'); assert.match(await helen.textContent('#settings'), /tom@example.com/); await helen.click('#settings [data-act=close]');
});
await step('the relative signs in, sees the map, cannot edit places, can add a memory and a photo', async () => {
  await signIn(tom, 'tom@example.com'); await tom.waitForSelector('.card');
  assert.equal(await tom.locator('[data-v=edit]').count(), 0, 'no edit button for contributors');
  await tom.click('.card'); await tom.click('.more [data-act=open]'); await tom.waitForSelector('#memform');
  assert.equal(await tom.locator('[data-act=editfrom]').count(), 0);
  await tom.fill('#m-text', 'Nan always had rum and raisin.'); await tom.fill('#m-by', 'Tom'); await tom.click('#memform button[type=submit]');
  await tom.waitForFunction(() => document.querySelectorAll('#story .memory').length === 2);
  await tom.setInputFiles('#m-photo', { name: 'b.jpg', mimeType: 'image/jpeg', buffer: jpeg }); await tom.waitForFunction(() => document.querySelectorAll('#story .photos img').length === 2);
  assert.equal(await tom.locator('#story [data-act=delmem]').count(), 1, 'can remove only own memory');
  await tom.click('#story [data-act=close]'); await tom.click('[data-act=settings]'); await tom.waitForSelector('#settings .dlg');
  assert.equal(await tom.locator('#mode-memorial').count(), 0); assert.equal(await tom.locator('[data-act=askdeletemap]').count(), 0);
});
await step('the relative adds a partner to the tree and links him to a place', async () => {
  await tom.click('#settings [data-act=close]'); await tom.click('[data-v=family]'); await tom.waitForSelector('.famtree .pcard.me');
  await tom.click('.famtree .pcard.me'); await tom.click('[data-act=relpanel]'); await tom.click('#rel-partner', { force: true }); await tom.fill('#r-name', 'Ted Lawson');
  await tom.click('#relform button[type=submit]'); await tom.waitForFunction(() => document.querySelectorAll('.famtree .pcard').length === 3);
  await tom.click('#person [data-act=close]'); await tom.click('.pcard[title="Ted Lawson"]'); await tom.waitForSelector('#pp-add');
  await tom.selectOption('#pp-add', { index: 1 }); await tom.click('[data-act=linkplace]'); await tom.waitForSelector('#person [data-act=openfromperson]');
  assert.equal((await mock.db.query(`select count(*)::int n from event_people`)).rows[0].n, 1);
  assert.equal((await mock.db.query(`select count(*)::int n from people`)).rows[0].n, 3);
  await tom.click('#person [data-act=close]');
});
await step('owner sees the relative’s memory, switches to memorial, and it sticks', async () => {
  await helen.goto(web); await helen.waitForSelector('.card'); await helen.click('.card'); await helen.click('.more [data-act=open]');
  await helen.waitForSelector('#story .memory'); assert.match(await helen.textContent('#story'), /rum and raisin/); await helen.click('#story [data-act=close]');
  await helen.click('[data-act=settings]'); await helen.waitForSelector('#mode-memorial'); await helen.click('#mode-memorial', { force: true });
  await helen.waitForFunction(() => /In loving memory/.test(document.querySelector('h1').textContent)); await helen.click('#settings [data-act=close]');
  assert.equal(await helen.locator('#f-end').count(), 1, 'farewell category appears');
  await helen.goto(web); await helen.waitForSelector('.card'); assert.match(await helen.textContent('h1'), /In loving memory of Peggy Lawson/);
  await helen.screenshot({ path: join(shots, 'owner.png') });
});
await step('owner changes a place and removes its photo', async () => {
  await helen.click('[data-v=edit]'); await helen.click('.sechead[data-s=home]'); await helen.click('[data-act=edit]'); await helen.waitForSelector('#e-title');
  await helen.fill('#e-title', 'Electra Street, the blue house'); await helen.click('.thumbs [data-act=delphoto] >> nth=0'); await helen.click('[data-act=save]');
  await helen.waitForFunction(() => /blue house/.test(document.querySelector('.entry')?.textContent || ''));
  assert.equal((await mock.db.query(`select count(*)::int n from photos`)).rows[0].n, 1); assert.equal(mock.files.size, 1);
});
await step('removing the invite ends the relative’s access', async () => {
  await helen.click('[data-act=settings]'); await helen.waitForSelector('[data-act=delinvite]'); await helen.click('[data-act=delinvite]');
  await helen.waitForFunction(() => !document.querySelector('[data-act=delinvite]')); await helen.click('#settings [data-act=close]');
  await tom.goto(web); await tom.waitForSelector('.gatecard h1'); assert.match(await tom.textContent('.gatecard'), /Start a Memory Map/);
  await tom.fill('#nw-name', 'Tom'); await tom.click('#newform button[type=submit]'); await tom.waitForFunction(() => /Not quite yet/.test(document.querySelector('.gatecard')?.textContent || ''));
});
await step('owner deletes the map and nothing is left behind', async () => {
  await helen.click('[data-act=settings]'); await helen.click('[data-act=askdeletemap]'); await helen.waitForSelector('[data-act=deletemap]'); await helen.click('[data-act=deletemap]');
  await helen.waitForSelector('#newform');
  for (const t of ['maps', 'events', 'memories', 'photos', 'invites', 'people', 'family_links', 'event_people']) assert.equal((await mock.db.query(`select count(*)::int n from ${t}`)).rows[0].n, 0, t);
  assert.equal(mock.files.size, 0, 'photo files removed');
});
await step('sign out returns to the sign-in screen', async () => { await helen.click('[data-act=signout]'); await helen.waitForSelector('#si-email'); });
await step('an expired email link gets a plain explanation', async () => {
  await helen.goto('about:blank'); await helen.goto(web + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); await helen.waitForSelector('.notice');
  assert.match(await helen.textContent('.notice'), /expired or was already used/);
});
await step('phone width has no sideways scrolling', async () => {
  await nobody.setViewportSize({ width: 390, height: 800 }); await nobody.waitForTimeout(200);
  assert.equal(await nobody.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await nobody.screenshot({ path: join(shots, 'phone.png') });
});

await browser.close(); site.close(); mock.close();
if (problems.length) { console.log('\nProblems:\n' + problems.join('\n')); process.exit(1); }
console.log('\nAll end-to-end checks passed.');
