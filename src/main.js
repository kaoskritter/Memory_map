import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-500-italic.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './styles.css';
import { CATS, CAT } from './categories.js';
import { parseWhen } from './when.js';
import { sample } from './sample.js';
import { sb, demoStore, cloudStore, listMaps, acceptInvites, createMap, loadMap } from './store.js';

const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = import.meta.env.VITE_TILE_ATTRIBUTION || '© OpenStreetMap contributors';
const GEOCODE_URL = import.meta.env.VITE_GEOCODE_URL || 'https://nominatim.openstreetmap.org/search';
const VIEWS = ['map', 'timeline', 'both', 'photos', 'edit'];
const badge = (cat) => { const c = CAT[cat]; return `<span class="badge" style="--c:${c.c}" aria-hidden="true"><svg viewBox="0 0 24 24">${c.i}</svg></span>`; };

/* ---------- preferences kept on this device only ---------- */
const prefs = (() => { try { return JSON.parse(localStorage.getItem('memorymap.prefs')) || {}; } catch (e) { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('memorymap.prefs', JSON.stringify(prefs)); } catch (e) { /* private mode */ } };
prefs.filters = prefs.filters || {}; prefs.view = VIEWS.includes(prefs.view) ? prefs.view : 'both';

/* ---------- state ---------- */
let S = null, store = null, user = null, myMaps = [];
let sel = null, hot = null, openSec = null, editing = null, draft = null, confirmDel = false, busy = false, fitted = false;
const ui = {};

const range = (e) => parseWhen(e.when);
const sortKey = (e) => { const r = range(e); return r ? r.from : 99999; };
const whenLabel = (e) => (e.when ? e.when.charAt(0).toUpperCase() + e.when.slice(1) : 'Not sure when');
function placeLabel(e) { const a = e.addr || {}; if (e.precision === 'approx') return a.rough || a.town || a.country || ''; return [a.street, a.town].filter(Boolean).join(', ') || a.state || a.country || ''; }
const memorial = () => S.mode === 'memorial';
const catOn = (id) => prefs.filters[id] !== false;
const allowed = (e) => CAT[e.cat] && (!CAT[e.cat].memorial || memorial());
const visible = () => S.events.filter((e) => allowed(e) && catOn(e.cat)).sort((a, b) => sortKey(a) - sortKey(b));
const byId = (id) => S.events.find((e) => e.id === id);
const owner = () => S.role === 'owner';
const first = (name) => String(name || '').split(' ')[0] || 'them';
function nameAt(year) { const s = S.subject; let cur = s.birthName || s.preferred; (s.changes || []).forEach((c) => { const r = parseWhen(c.year); if (r && year != null && r.from <= year && c.name) cur = c.name; }); return cur; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 6000); }
function friendly(err) {
  const m = String((err && err.message) || err || '');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'We could not reach Memory Map. Check your internet connection and try again.';
  if (/row-level security|permission|not authorized|JWT/i.test(m)) return 'You do not have permission to do that on this Memory Map.';
  return 'That did not save. Please try again in a moment.';
}
// Runs a save, shows a plain message if it fails, and stops double taps.
async function run(fn) {
  if (busy) return; busy = true; document.body.classList.add('busy');
  try { await fn(); } catch (err) { console.error(err); toast(friendly(err)); }
  finally { busy = false; document.body.classList.remove('busy'); }
}

/* =====================================================================
   Gate: sign in, choose or start a map
   ===================================================================== */
function showGate(html) { document.body.dataset.screen = 'gate'; delete document.body.dataset.mode; $('#gate').innerHTML = `<div class="gatecard">${html}</div>`; const f = $('#gate input, #gate button'); if (f) f.focus(); }
const brand = '<p class="brand">Memory Map</p>';
function gateSignIn(msg) {
  showGate(`${brand}<h1>A life story, told through its places</h1>
   <p>Pin the homes, schools, jobs and favourite spots of someone you love, and add the memories and photos that go with them.</p>
   ${sb ? `<form id="signin" class="field" style="gap:.8rem">${msg ? `<p class="notice">${esc(msg)}</p>` : ''}
     <div class="field"><label for="si-email">Your email address</label><span class="hint">We will email you a link to sign in. There is no password to remember.</span><input id="si-email" type="email" autocomplete="email" inputmode="email" required></div>
     <button class="btn primary" type="submit">Email me a sign-in link</button></form>
     <p class="hint">Memory Map is invite-only for now.</p>` : '<p class="notice">Sign-in is not set up on this copy yet. You can still look at the example.</p>'}
   <div class="rowbtns"><button class="btn" data-act="demo">See an example first</button><button class="btn quiet" data-act="privacy">How we look after your stories</button></div>`);
}
function gateSent(email) {
  showGate(`${brand}<h1>Check your email</h1><p>We sent a sign-in link to <b>${esc(email)}</b>. Open the email and tap the link. It can take a minute to arrive.</p>
   <form id="code" class="field" style="gap:.8rem"><div class="field"><label for="si-code">Or type the code from the email</label><span class="hint">Handy if the email is on another device.</span><input id="si-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*"></div>
   <input type="hidden" id="si-codeemail" value="${esc(email)}"><div class="rowbtns"><button class="btn primary" type="submit">Sign in with the code</button><button class="btn" type="button" data-act="signinagain">Use a different email</button></div></form>`);
}
function gateChoose() {
  showGate(`${brand}<h1>Which Memory Map?</h1><div class="field" style="gap:.6rem">${myMaps.map((m) => `<button class="btn mapchoice" data-act="openmap" data-id="${m.id}">${esc(m.preferred_name || 'Untitled')}<span class="hint">${m.owner_id === user.id ? 'You look after this one' : 'You can add memories and photos'}</span></button>`).join('')}</div>
   <div class="rowbtns"><button class="btn" data-act="gatenew">Start a new Memory Map</button><button class="btn quiet" data-act="signout">Sign out</button></div>`);
}
function gateNew(canGoBack) {
  showGate(`${brand}<h1>Start a Memory Map</h1><form id="newform" class="field" style="gap:.9rem">
   <fieldset><legend>Who is this Memory Map about?</legend><label class="choice"><input type="radio" name="forwho" id="nw-self" value="self" checked>Me</label><label class="choice"><input type="radio" name="forwho" id="nw-other" value="other">Someone else</label></fieldset>
   <div class="field"><label for="nw-name">Their name, as they like to be called</label><span class="hint">If it is about you, your own name.</span><input id="nw-name" required autocomplete="off"></div>
   <div class="field"><label for="nw-you">Your name</label><span class="hint">So the memories you write are signed.</span><input id="nw-you" autocomplete="name"></div>
   <div class="field"><label for="nw-rel">How are you related?</label><span class="hint">Only if it is about someone else. For example “granddaughter”.</span><input id="nw-rel" autocomplete="off"></div>
   <div class="rowbtns"><button class="btn primary" type="submit">Start</button>${canGoBack ? '<button class="btn" type="button" data-act="choose">Back</button>' : '<button class="btn quiet" type="button" data-act="signout">Sign out</button>'}</div></form>`);
}
function gateMessage(title, body, extra) { showGate(`${brand}<h1>${title}</h1><p>${body}</p><div class="rowbtns">${extra || ''}<button class="btn quiet" data-act="signout">Sign out</button></div>`); }

async function afterSignIn() {
  showGate(`${brand}<p>Opening your Memory Map…</p>`);
  try {
    await acceptInvites();
    myMaps = await listMaps();
    if (myMaps.length === 1) return await openMap(myMaps[0].id);
    if (myMaps.length > 1) { const last = myMaps.find((m) => m.id === prefs.lastMap); return last ? await openMap(last.id) : gateChoose(); }
    gateNew(false);
  } catch (err) { console.error(err); gateMessage('We could not open Memory Map', esc(friendly(err)), '<button class="btn primary" data-act="retry">Try again</button>'); }
}
async function openMap(id) {
  showGate(`${brand}<p>Opening your Memory Map…</p>`);
  S = await loadMap(id, user.id); store = cloudStore(id, user.id);
  prefs.lastMap = id; savePrefs(); enterApp(S.events.length ? prefs.view : (owner() ? 'edit' : 'both'));
}
function openDemo() { S = sample(); store = demoStore(); enterApp('both'); }
function enterApp(view) {
  sel = null; hot = null; openSec = S.events.length ? null : 'about'; editing = null; draft = null; fitted = false;
  document.body.dataset.screen = 'app'; S.view = view;
  if (!map) initMap();
  refresh(); setView(view);
}

/* =====================================================================
   Header, tabs, filters
   ===================================================================== */
function renderTop() {
  const s = S.subject, n = S.events.filter(allowed).length, name = s.preferred || 'Someone special';
  document.documentElement.dataset.size = prefs.size || 'normal';
  const title = memorial() ? 'In loving memory of ' + esc(name) : esc(name) + '’s Memory Map';
  let sub = memorial() ? [s.born, s.died].filter(Boolean).join(' – ') : (s.born ? 'Born ' + s.born : '');
  sub = [sub, n + (n === 1 ? ' place' : ' places') + ' so far'].filter(Boolean).join(' · ');
  $('#top').innerHTML = `<div class="who"><h1>${title}</h1><p class="sub">${esc(sub)}${owner() ? '' : ' · You can add memories and photos'}</p></div><div class="actions">${
    S.view === 'edit' ? '<button class="btn primary" data-act="view" data-v="both">Back to the map</button>' : (owner() ? '<button class="btn primary" data-act="view" data-v="edit">Add or change places</button>' : '')}<button class="btn" data-act="settings">Settings</button></div>`;
  $('#sample').hidden = !S.demo;
  document.body.dataset.view = S.view; document.body.dataset.mode = S.mode;
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.view)));
  document.title = (s.preferred ? s.preferred + ' · ' : '') + 'Memory Map';
}
function renderFilters() {
  const counts = {}; S.events.forEach((e) => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
  $('#filters').innerHTML = '<h2>Show on the map</h2>' + CATS.filter((c) => !c.memorial || memorial()).map((c) =>
    `<label><input type="checkbox" id="f-${c.id}" data-f="${c.id}"${catOn(c.id) ? ' checked' : ''}>${badge(c.id)}<span>${c.name}</span><span class="n">${counts[c.id] || 0}</span></label>`).join('') +
    '<div class="row"><button class="btn quiet" data-act="fall" data-on="1">Show all</button><button class="btn quiet" data-act="fall" data-on="0">Hide all</button></div>';
}

/* =====================================================================
   Map
   ===================================================================== */
let map, markers = {};
const pinIcon = (cat) => { const c = CAT[cat]; return L.divIcon({ className: '', html: `<div class="pin" style="--c:${c.c}"><svg viewBox="0 0 24 24">${c.i}</svg></div>`, iconSize: [46, 46], iconAnchor: [23, 23] }); };
const tiles = (m) => L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(m);
function initMap() {
  map = L.map('map', { worldCopyJump: true, minZoom: 2, zoomSnap: 0.5 }).setView([-37.6, 144.3], 7);
  map.attributionControl.setPrefix(false); tiles(map);
  map.on('click', () => select(null));
}
function renderMap() {
  if (!map) return;
  Object.values(markers).forEach((m) => m.remove()); markers = {};
  visible().filter((e) => e.lat != null).forEach((e) => {
    const m = L.marker([e.lat, e.lng], { title: e.title + ', ' + whenLabel(e), alt: e.title, riseOnHover: true, icon: pinIcon(e.cat) }).addTo(map);
    m.on('click', (ev) => { L.DomEvent.stopPropagation(ev); select(e.id, 'map'); });
    m.on('mouseover', () => setHot(e.id)); m.on('mouseout', () => setHot(null));
    markers[e.id] = m;
  });
  paint();
}
function fitHome() {
  if (!map) return; const ev = visible().filter((e) => e.lat != null); if (!ev.length) return;
  // Frame the area where most of the life happened, so one far-away trip does not shrink everything else.
  const mid = (k) => { const a = ev.map((e) => e[k]).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const ml = mid('lat'), mg = mid('lng');
  const near = ev.filter((e) => Math.abs(e.lat - ml) < 4 && Math.abs(e.lng - mg) < 5);
  map.fitBounds(L.latLngBounds(near.map((e) => [e.lat, e.lng])).pad(0.25), { maxZoom: 13, animate: false });
}
function paint() {
  Object.keys(markers).forEach((k) => { const el = markers[k].getElement(); if (el) { el.classList.toggle('sel', k === sel); el.classList.toggle('hot', k === hot && k !== sel); } });
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('hot', c.dataset.id === hot && c.dataset.id !== sel));
}
function setHot(id) { hot = id; paint(); }

/* =====================================================================
   Timeline, preview, gallery
   ===================================================================== */
function renderTimeline() {
  const ev = visible(), box = $('#tl');
  if (!ev.length) { box.innerHTML = `<p class="empty">Nothing to show yet. ${S.events.length ? 'Tick a box under “Show on the map” to bring places back.' : (owner() ? 'Choose “Add or change places” to begin.' : 'Places will appear here as they are added.')}</p>`; return; }
  let html = '', cur = null;
  ev.forEach((e) => {
    const r = range(e), g = r ? Math.floor(r.from / 10) * 10 + 's' : 'Not sure when';
    if (g !== cur) { if (cur !== null) html += '</ol>'; html += `<h3 class="decade">${g}</h3><ol class="tl">`; cur = g; }
    const c = CAT[e.cat], on = e.id === sel;
    html += `<li><button class="card${on ? ' sel' : ''}" style="--c:${c.c}" data-act="select" data-id="${e.id}" aria-pressed="${on}">${badge(e.cat)}<span class="when">${esc(whenLabel(e))}</span><span class="title">${esc(e.title)}</span><span class="place">${esc(placeLabel(e))}${e.precision === 'approx' ? '<span class="rough">roughly</span>' : ''}${e.lat == null ? '<span class="rough">no pin yet</span>' : ''}</span></button>`;
    if (on) { const m = e.memories[0]; html += `<div class="more" style="--c:${c.c}">${m ? `<p>“${esc(m.text)}”<br><span class="place">${esc(m.by)}</span></p>` : '<p>No memories written yet.</p>'}<button class="btn primary" data-act="open" data-id="${e.id}">Open this story</button></div>`; }
    html += '</li>';
  });
  box.innerHTML = html + '</ol>';
}
function renderPreview() {
  const p = $('#preview'), e = sel && byId(sel);
  if (!e) { p.innerHTML = '<div class="txt"><p class="meta">Tap a pin or a place on the timeline to see it here.</p></div><button class="btn quiet" data-act="fit">Show everything</button>'; return; }
  p.innerHTML = `${badge(e.cat)}<div class="txt"><h3>${esc(e.title)}</h3><p class="meta">${esc(whenLabel(e))} · ${esc(placeLabel(e))}</p></div><button class="btn primary" data-act="open" data-id="${e.id}">Open this story</button>`;
}
function select(id, from) {
  if (id === sel && from !== 'map') id = null;
  sel = id; renderTimeline(); renderPreview(); paint();
  if (!id) return;
  const e = byId(id);
  if (from !== 'map' && map && e.lat != null && S.view !== 'timeline') {
    const ll = L.latLng(e.lat, e.lng);
    if (!map.getBounds().pad(-0.15).contains(ll)) { const z = Math.max(map.getZoom(), 9); reduce ? map.setView(ll, z) : map.flyTo(ll, z, { duration: 0.8 }); }
  }
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) { if (from === 'map') card.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); else card.focus({ preventScroll: true }); }
}
function renderGallery() {
  const items = []; visible().forEach((e) => e.photos.forEach((p) => items.push({ e, p })));
  $('#gal').innerHTML = items.length ? items.map((x) => `<button data-act="open" data-id="${x.e.id}"><img src="${esc(x.p.src)}" alt="${esc(x.p.cap || 'Photo from ' + x.e.title)}" loading="lazy"><span><b>${esc(x.e.title)}</b><br>${esc(whenLabel(x.e))}</span></button>`).join('') : '<p class="empty">No photos yet. Open a place and choose “Add a photo”.</p>';
}

/* =====================================================================
   Story dialog
   ===================================================================== */
function openStory(id, keepText) {
  const e = byId(id); if (!e) return; sel = id; renderTimeline(); renderPreview(); paint();
  const r = range(e), then = r ? nameAt(r.from) : null, s = S.subject, x = e.extra || {};
  const facts = [x.type, x.course, x.role].filter(Boolean).join(' · ');
  const canRemove = (it) => owner() || it.mine;
  $('#story').innerHTML = `<div class="dlg"><header>${badge(e.cat)}<div><h2>${esc(e.title)}</h2><p class="meta">${esc(whenLabel(e))} · ${esc(placeLabel(e))}${e.precision === 'approx' ? '<span class="rough">roughly</span>' : ''}</p>${
    facts ? `<p class="meta">${esc(facts)}</p>` : ''}${e.people ? `<p class="meta">With ${esc(e.people)}</p>` : ''}${then && then !== s.preferred ? `<p class="meta">Known then as ${esc(then)}</p>` : ''}</div><button class="btn quiet" data-act="close">Close</button></header>
    <section><h3>Memories</h3>${e.memories.length ? e.memories.map((m, i) => `<blockquote class="memory"><p>${esc(m.text)}</p><footer>${esc(m.by)}${canRemove(m) ? ` <button class="link" data-act="delmem" data-i="${i}">Remove</button>` : ''}</footer></blockquote>`).join('') : '<p class="meta">Nobody has written a memory here yet. Yours could be the first.</p>'}</section>
    ${e.photos.length ? `<section><h3>Photos</h3><div class="photos">${e.photos.map((p, i) => `<figure><img src="${esc(p.src)}" alt="${esc(p.cap || 'Photo from ' + e.title)}">${canRemove(p) ? `<button class="link" data-act="delstoryphoto" data-i="${i}">Remove</button>` : ''}</figure>`).join('')}</div></section>` : ''}
    <form id="memform" class="field" style="gap:.6rem"><h3>Add a memory</h3><div class="field"><label for="m-text">What do you remember about this place?</label><textarea id="m-text" maxlength="5000" placeholder="A sentence or two is plenty.">${esc(keepText || '')}</textarea></div>
    <div class="field"><label for="m-by">Your name</label><input id="m-by" maxlength="200" value="${esc(prefs.myName || (owner() ? (s.builder || '') : ''))}" autocomplete="name"></div>
    <div class="rowbtns"><button class="btn primary" type="submit">Save this memory</button><label class="btn" for="m-photo">Add a photo</label><input class="sr" type="file" id="m-photo" accept="image/*" data-photo="${e.id}">${
    owner() ? `<button class="btn" type="button" data-act="editfrom" data-id="${e.id}">Change this place</button>` : ''}</div></form></div>`;
  const d = $('#story'); if (!d.open) d.showModal();
}
// Shrinks a picture in the browser before it is stored, so phone photos upload quickly.
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej(new Error('photo'))), 'image/jpeg', 0.85); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('photo')); };
    img.src = url;
  });
}

/* =====================================================================
   Edit page (sectioned, fields open in place)
   ===================================================================== */
const chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const fld = (id, label, val, hint, max) => `<div class="field"><label for="${id}">${label}</label>${hint ? `<span class="hint">${hint}</span>` : ''}<input id="${id}" value="${esc(val || '')}" maxlength="${max || 200}" autocomplete="off"></div>`;
function renderEdit() {
  const s = S.subject, who = first(s.preferred);
  let html = `<div class="editgrid"><div><h2>${s.preferred ? esc(s.preferred) + '’s places' : 'Places'}</h2><p>Open any heading and add what you know. Skip anything you like.</p>`;
  html += `<div class="sec"><button class="sechead" data-act="sec" data-s="about" aria-expanded="${openSec === 'about'}"><span class="name">About ${esc(who)}</span><span class="count">Names and dates</span>${chev}</button>`;
  if (openSec === 'about') {
    html += `<div class="secbody"><div class="two">${fld('a-preferred', 'Name they go by', s.preferred)}${fld('a-birth', 'Name at birth', s.birthName, 'If it was different')}</div><div class="two">${fld('a-born', 'Year born', s.born, 'A rough year is fine', 60)}${fld('a-pron', 'Pronouns', s.pronouns, 'Optional', 60)}</div>${
      memorial() ? fld('a-died', 'Year they passed away', s.died, '', 60) : ''}<p class="flabel">Other names over the years</p>${
      (s.changes || []).map((c, i) => `<div class="entry"><div class="t"><b>${esc(c.name)}</b><span>${esc([c.year, c.reason].filter(Boolean).join(' · '))}</span></div><button class="btn quiet" data-act="delname" data-i="${i}">Remove</button></div>`).join('') || '<p class="hint">None added.</p>'}
      <div class="two">${fld('n-name', 'Another name', '', 'Married name, nickname…')}${fld('n-year', 'From about when?', '', '', 60)}</div>${fld('n-reason', 'Why it changed', '', 'Optional')}
      <div class="rowbtns"><button class="btn" data-act="addname">Add this name</button><button class="btn primary" data-act="saveabout">Save</button></div></div>`;
  }
  html += '</div>';
  CATS.filter((c) => !c.memorial || memorial()).forEach((c) => {
    const list = S.events.filter((e) => e.cat === c.id).sort((a, b) => sortKey(a) - sortKey(b)), open = openSec === c.id;
    html += `<div class="sec"><button class="sechead" data-act="sec" data-s="${c.id}" aria-expanded="${open}">${badge(c.id)}<span class="name">${c.name}</span><span class="count">${list.length ? list.length + ' added' : 'Nothing yet'}</span>${chev}</button>`;
    if (open) {
      html += '<div class="secbody">';
      list.forEach((e) => { html += editing === e.id ? formHtml(c) : `<div class="entry"><div class="t"><b>${esc(e.title)}</b><span>${esc(whenLabel(e))}${placeLabel(e) ? ' · ' + esc(placeLabel(e)) : ''}</span></div><button class="btn" data-act="edit" data-id="${e.id}">Change</button></div>`; });
      html += editing === 'new' ? formHtml(c) : `<button class="btn" data-act="new" data-c="${c.id}">+ Add ${list.length ? 'another ' : (/^[aeiou]/.test(c.one) ? 'an ' : 'a ')}${c.one}</button>`;
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div><aside class="help"><div class="tip"><h3>There are no wrong answers</h3><p>“Early 1960s” or “near the old mill” is just as welcome as an exact date or address.</p></div><div class="tip"><h3>Do it in any order</h3><p>Start wherever the stories are. One memory often leads to another.</p></div><div class="tip"><h3>Nothing is final</h3><p>You can change or add more later.</p></div></aside></div>';
  if (pick) { pick.remove(); pick = null; }
  $('#edit').innerHTML = html;
  if (editing) initPicker();
}
function understood(r, txt) {
  if (!txt || !txt.trim()) return 'Leave this blank if you are not sure. It will sit under “Not sure when”.';
  if (!r) return 'We will keep your words exactly as written, and list this under “Not sure when”.';
  if (r.to === null) return `On the timeline this starts around ${r.from} and is still going.`;
  return r.from === r.to ? `On the timeline this sits at ${r.from}.` : `On the timeline this runs from about ${r.from} to ${r.to}.`;
}
function formHtml(c) {
  const d = draft, a = d.addr || {}, x = d.extra || {}, ap = d.precision === 'approx';
  let h = `<div class="form" id="form"><h3>${editing === 'new' ? 'New ' + c.one : 'Change this ' + c.one}</h3>${fld('e-title', 'What would you call it?', d.title, 'For example “The house on Elm Street”')}
   <div class="field"><span class="flabel" id="lp">How well do you know where it was?</span><div class="seg" role="radiogroup" aria-labelledby="lp"><label><input type="radio" name="prec" id="p-d" value="detailed"${ap ? '' : ' checked'}>I know the address</label><label><input type="radio" name="prec" id="p-a" value="approx"${ap ? ' checked' : ''}>Only roughly</label></div></div>`;
  h += ap ? fld('e-rough', 'Roughly where was it?', a.rough, 'In your own words. “A farm outside Castlemaine” is fine.') + fld('e-country', 'Country', a.country, 'Optional')
    : fld('e-street', 'Street', a.street, 'Leave blank if you are not sure') + `<div class="two">${fld('e-town', 'Suburb or town', a.town)}${fld('e-state', 'State or region', a.state)}</div>` + fld('e-country', 'Country', a.country);
  h += `<div class="field"><span class="flabel">Put the pin on the map</span><span class="hint">Tap the map where this was. Close enough is fine.</span><div id="pick"></div><div class="rowbtns"><button class="btn" type="button" data-act="geocode">Find it for me</button><span class="hint" id="geomsg" role="status">Looking it up sends the address to OpenStreetMap.</span></div></div>${
    fld('e-when', 'When was this?', d.when, 'A year, a few years, or a rough time like “early 1960s”.')}<p class="understood" id="understood">${understood(parseWhen(d.when), d.when)}</p>`;
  if (c.id === 'school') h += `<div class="two"><div class="field"><label for="e-type">What kind of school?</label><select id="e-type">${['', 'Primary', 'Secondary', 'College or university', 'Trade or night school', 'Other'].map((o) => `<option${x.type === o ? ' selected' : ''}>${o}</option>`).join('')}</select></div>${fld('e-course', 'Course or subject', x.course, 'Optional')}</div>`;
  if (c.id === 'work') h += fld('e-role', 'What was the job?', x.role, 'Optional');
  h += `${fld('e-people', 'Who else was part of this?', d.people, 'Optional', 500)}<div class="field"><label for="e-mem">A memory of this place</label><span class="hint">Optional. A sentence or two is plenty.</span><textarea id="e-mem" maxlength="5000">${esc(d.newMemory || '')}</textarea></div>
   <div class="field"><span class="flabel">Photos</span><div class="thumbs">${d.photos.map((p, i) => `<figure><img src="${esc(p.src)}" alt="${esc(p.cap || 'Photo ' + (i + 1))}"><button type="button" data-act="delphoto" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></figure>`).join('')}</div><div class="rowbtns"><label class="btn" for="e-photo">Add a photo</label><input class="sr" type="file" id="e-photo" accept="image/*" data-photo="draft"></div></div>`;
  h += confirmDel ? '<div class="confirm"><p><b>Remove this place, with its memories and photos?</b> This cannot be undone.</p><button class="btn danger" data-act="del">Yes, remove it</button><button class="btn" data-act="nodel">Keep it</button></div>'
    : `<div class="rowbtns"><button class="btn primary" data-act="save">Save this place</button><button class="btn" data-act="cancel">Cancel</button>${editing !== 'new' ? '<button class="btn danger" data-act="askdel">Remove</button>' : ''}</div>`;
  return h + '</div>';
}
function readForm() {
  if (!draft || !$('#form')) return; const v = (id) => { const el = $('#' + id); return el ? el.value.trim() : undefined; }, a = draft.addr;
  draft.title = v('e-title') || ''; draft.when = v('e-when') || ''; draft.people = v('e-people') || ''; draft.newMemory = v('e-mem') || '';
  ['street', 'town', 'state', 'country', 'rough'].forEach((k) => { const x = v('e-' + k); if (x !== undefined) a[k] = x; });
  ['type', 'course', 'role'].forEach((k) => { const x = v('e-' + k); if (x !== undefined) draft.extra[k] = x; });
}
let pick = null, pickM = null;
function initPicker() {
  if (!$('#pick')) return;
  const has = draft.lat != null, c = has ? [draft.lat, draft.lng] : (map ? map.getCenter() : [-37.6, 144.3]);
  pick = L.map('pick', { minZoom: 2 }).setView(c, has ? 14 : (map ? Math.min(map.getZoom(), 10) : 7)); pick.attributionControl.setPrefix(false); tiles(pick);
  pickM = null;
  const put = (ll) => { draft.lat = +ll.lat.toFixed(5); draft.lng = +ll.lng.toFixed(5); if (pickM) pickM.setLatLng(ll); else { pickM = L.marker(ll, { draggable: true, alt: 'Pin for this place', icon: pinIcon(draft.cat) }).addTo(pick); pickM.on('dragend', () => put(pickM.getLatLng())); } };
  if (has) put(L.latLng(draft.lat, draft.lng));
  pick.on('click', (e) => put(e.latlng)); pick._put = put;
}
async function geocode() {
  readForm(); const a = draft.addr, q = (draft.precision === 'approx' ? [a.rough, a.country] : [a.street, a.town, a.state, a.country]).filter(Boolean).join(', '), msg = $('#geomsg');
  if (!q) { msg.textContent = 'Type a town or street first, or just tap the map.'; return; }
  msg.textContent = 'Looking…';
  try {
    const j = await (await fetch(`${GEOCODE_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } })).json();
    if (!j.length) { msg.textContent = 'We could not find that. Tap the map to place the pin yourself.'; return; }
    const ll = L.latLng(+j[0].lat, +j[0].lon); pick._put(ll); pick.setView(ll, 15); msg.textContent = 'Found it. Drag the pin if it is not quite right.';
  } catch (e) { msg.textContent = 'We could not look that up just now. Tap the map to place the pin yourself.'; }
}
function startEdit(cat, id) {
  const e = id && byId(id); editing = id || 'new'; confirmDel = false; openSec = cat;
  draft = e ? { ...JSON.parse(JSON.stringify({ ...e, photos: [] })), photos: e.photos.slice(), removed: [] } : { id: null, cat, title: '', when: '', precision: 'detailed', addr: {}, lat: null, lng: null, extra: {}, people: '', memories: [], photos: [], removed: [] };
  renderEdit(); const f = $('#form'); if (f) { f.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); $('#e-title').focus({ preventScroll: true }); }
}
async function saveDraft() {
  readForm(); const d = draft, isNew = editing === 'new';
  if (!d.title) d.title = placeLabel(d) || 'A ' + CAT[d.cat].one;
  const text = d.newMemory, pending = d.photos.filter((p) => p.blob), removed = d.removed;
  const ev = { id: d.id, cat: d.cat, title: d.title, when: d.when, precision: d.precision, addr: d.addr, lat: d.lat, lng: d.lng, extra: d.extra, people: d.people, memories: d.memories, photos: d.photos.filter((p) => !p.blob) };
  if (isNew && store.demo) ev.id = 'd' + Date.now();
  await store.saveEvent(ev, isNew);
  const i = S.events.findIndex((e) => e.id === ev.id); if (i >= 0) S.events[i] = ev; else S.events.push(ev);
  editing = null; draft = null; sel = ev.id; prefs.filters[ev.cat] = true; savePrefs();
  // the place is safe now; memories and photos follow, and a failure here does not lose the place
  let trouble = false;
  if (text) { try { ev.memories.push(await store.addMemory(ev, prefs.myName || S.subject.builder || 'Family', text)); } catch (e) { trouble = true; } }
  for (const p of pending) { try { ev.photos.push(await store.addPhoto(ev, p.blob)); } catch (e) { trouble = true; } }
  for (const p of removed) { try { await store.removePhoto(p); } catch (e) { trouble = true; } }
  refresh(); renderEdit();
  toast(trouble ? 'The place is saved, but a memory or photo did not go through. Open it and try adding that again.' : (ev.lat == null ? 'Saved. It is on the timeline. Add a pin any time to see it on the map.' : 'Saved. You can change it any time.'));
}

/* =====================================================================
   Settings, family, privacy
   ===================================================================== */
async function renderSettings(panel) {
  const rad = (n, v, cur, l) => `<label class="choice"><input type="radio" name="${n}" id="${n}-${v}" value="${v}"${cur === v ? ' checked' : ''}>${l}</label>`;
  let h = '<div class="dlg"><header><div><h2>Settings</h2></div><button class="btn quiet" data-act="close">Close</button></header>';
  h += `<fieldset><legend>Text size</legend>${rad('size', 'normal', prefs.size || 'normal', 'Large')}${rad('size', 'large', prefs.size, 'Larger')}${rad('size', 'largest', prefs.size, 'Largest')}</fieldset>`;
  if (owner()) {
    h += `<fieldset><legend>What kind of Memory Map is this?</legend>${rad('mode', 'living', S.mode, 'A living story, still being added to')}${rad('mode', 'memorial', S.mode, 'A memorial, for someone who has passed away')}<p class="hint">A memorial also has room for a farewell service and a resting place.</p></fieldset>`;
    if (!S.demo) {
      let inv = []; try { inv = await store.listInvites(); } catch (e) { /* shown as empty */ }
      h += `<fieldset><legend>Family and friends who can add memories</legend><p class="hint">They can add memories and photos. Only you can change the places and dates.</p>${
        inv.map((i) => `<div class="entry"><div class="t"><b>${esc(i.email)}</b><span>${i.accepted_at ? 'Has joined' : 'Invited, not joined yet'}</span></div><button class="btn quiet" data-act="delinvite" data-id="${i.id}">Remove</button></div>`).join('') || '<p>Nobody invited yet.</p>'}
        <form id="inviteform" class="field" style="gap:.5rem;margin-top:.6rem"><label for="iv-email">Invite someone by email</label><input id="iv-email" type="email" autocomplete="off" required><button class="btn" type="submit">Add them</button></form>${
        panel === 'invited' ? `<div class="notice"><p><b>Added.</b> Now let them know. Send them this, in your own words if you like:</p><p id="invtext">I’m putting together a Memory Map for ${esc(S.subject.preferred || 'our family')} and would love you to add your memories and photos. Go to ${esc(location.origin)} and sign in with this email address.</p><button class="btn" type="button" data-act="copyinvite">Copy this message</button></div>` : ''}</fieldset>`;
    }
  }
  h += '<div class="rowbtns">';
  if (!S.demo) {
    h += '<button class="btn" data-act="export">Download a copy</button>';
    if (myMaps.length > 1) h += '<button class="btn" data-act="choose">Switch Memory Map</button>';
    h += '<button class="btn" data-act="gatenew">Start another Memory Map</button><button class="btn" data-act="signout">Sign out</button>';
  } else h += '<button class="btn primary" data-act="leavedemo">Leave the example</button>';
  h += '<button class="btn quiet" data-act="privacy">How we look after your stories</button></div>';
  if (owner() && !S.demo) h += panel === 'askdelete' ? '<div class="confirm"><p><b>Delete this whole Memory Map?</b> Every place, memory and photo will be removed for everyone, and it cannot be brought back. Consider downloading a copy first.</p><button class="btn danger" data-act="deletemap">Yes, delete everything</button><button class="btn" data-act="settings">Keep it</button></div>' : '<p><button class="link danger" data-act="askdeletemap">Delete this Memory Map…</button></p>';
  $('#settings').innerHTML = h + '</div>'; const d = $('#settings'); if (!d.open) d.showModal();
}
function showPrivacy() {
  $('#privacy').innerHTML = `<div class="dlg"><header><div><h2>How we look after your stories</h2></div><button class="btn quiet" data-act="close">Close</button></header>
   <ul class="plain"><li><b>Private by default.</b> A Memory Map can be seen only by the person who looks after it and the people they invite by email.</li>
   <li><b>Invited people can add, not rewrite.</b> They can add memories and photos. Only the person looking after the map can change places and dates.</li>
   <li><b>Where it is kept.</b> Places, memories and photos are stored with our hosting provider, Supabase, in Sydney, Australia. Photos are kept in private storage and are not public links.</li>
   <li><b>Maps.</b> The map pictures come from OpenStreetMap. If you press “Find it for me”, the address you typed is sent to OpenStreetMap to look it up. If you would rather not, tap the map to place the pin yourself.</li>
   <li><b>Your copy.</b> You can download a copy of a Memory Map, or delete it completely, from Settings at any time.</li>
   <li><b>No advertising, no selling of information.</b></li>
   <li><b>This is an early version.</b> Please keep your own copies of precious photos.</li></ul></div>`;
  $('#privacy').showModal();
}
function exportCopy() {
  const data = { exported: new Date().toISOString(), about: S.subject, kind: S.mode, places: S.events.map((e) => ({ category: CAT[e.cat].name, title: e.title, when: e.when, address: e.addr, addressIsRough: e.precision === 'approx', latitude: e.lat, longitude: e.lng, details: e.extra, people: e.people, memories: e.memories.map((m) => ({ by: m.by, text: m.text })), photoCount: e.photos.length })) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = (S.subject.preferred || 'memory-map').replace(/[^\w]+/g, '-').toLowerCase() + '-memory-map.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('A copy of the places and memories has been downloaded. Photos are not included yet.');
}

/* =====================================================================
   Wiring
   ===================================================================== */
function refresh() { renderTop(); renderFilters(); renderMap(); renderTimeline(); renderPreview(); renderGallery(); }
function setView(v) {
  if (v === 'edit' && !owner()) v = 'both';
  S.view = v; if (v !== 'edit') { prefs.view = v; savePrefs(); }
  renderTop();
  if (v === 'edit') { renderEdit(); $('#edit').scrollTop = 0; } else { editing = null; draft = null; }
  if (map && v !== 'edit') setTimeout(() => { map.invalidateSize(); if (!fitted) { fitHome(); fitted = true; } }, 30);
  try { if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v); } catch (e) { /* ignore */ }
}
function saveAbout(a, b) {
  const s = S.subject, v = (i) => { const el = $('#' + i); return el ? el.value.trim() : ''; };
  s.preferred = v('a-preferred'); s.birthName = v('a-birth'); s.born = v('a-born'); s.pronouns = v('a-pron'); if ($('#a-died')) s.died = v('a-died');
  if (a === 'delname') s.changes.splice(+b.dataset.i, 1);
  if (v('n-name')) { s.changes = s.changes || []; s.changes.push({ name: v('n-name'), year: v('n-year'), reason: v('n-reason') }); }
  return store.saveSubject(S).then(() => { renderTop(); if (a === 'saveabout') { openSec = null; toast('Saved.'); } renderEdit(); });
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, id = b.dataset.id;
  const acts = {
    view: () => setView(b.dataset.v),
    select: () => select(id, 'timeline'),
    open: () => openStory(id),
    close: () => b.closest('dialog').close(),
    fit: () => fitHome(),
    fall: () => { CATS.forEach((c) => { prefs.filters[c.id] = b.dataset.on === '1'; }); savePrefs(); if (b.dataset.on !== '1') sel = null; refresh(); },
    filters: () => { const on = document.body.classList.toggle('showfilters'); b.setAttribute('aria-expanded', String(on)); if (map) map.invalidateSize(); },
    settings: () => run(() => renderSettings()),
    privacy: () => showPrivacy(),
    demo: () => openDemo(),
    leavedemo: () => { $('#settings').close(); S = null; user ? afterSignIn() : gateSignIn(); },
    signinagain: () => gateSignIn(),
    retry: () => afterSignIn(),
    choose: () => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); gateChoose(); },
    gatenew: () => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); gateNew(myMaps.length > 0); },
    openmap: () => run(() => openMap(id)),
    signout: () => run(async () => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); await sb.auth.signOut(); }),
    export: () => exportCopy(),
    askdeletemap: () => run(() => renderSettings('askdelete')),
    deletemap: () => run(async () => { await store.deleteMap(S); $('#settings').close(); prefs.lastMap = null; savePrefs(); S = null; await afterSignIn(); toast('That Memory Map has been deleted.'); }),
    delinvite: () => run(async () => { await store.removeInvite(id); await renderSettings(); }),
    copyinvite: () => { navigator.clipboard.writeText($('#invtext').textContent).then(() => toast('Copied. Paste it into an email or message.'), () => toast('Press and hold the message to copy it.')); },
    sec: () => { readForm(); openSec = openSec === b.dataset.s ? null : b.dataset.s; editing = null; draft = null; renderEdit(); const h = document.querySelector(`.sechead[data-s="${b.dataset.s}"]`); if (h) h.focus(); },
    new: () => startEdit(b.dataset.c),
    edit: () => startEdit(byId(id).cat, id),
    editfrom: () => { $('#story').close(); setView('edit'); startEdit(byId(id).cat, id); },
    cancel: () => { editing = null; draft = null; renderEdit(); },
    save: () => run(saveDraft),
    askdel: () => { readForm(); confirmDel = true; renderEdit(); },
    nodel: () => { confirmDel = false; renderEdit(); },
    del: () => run(async () => { const e = byId(draft.id); await store.deleteEvent(e); S.events = S.events.filter((x) => x.id !== e.id); if (sel === e.id) sel = null; editing = null; draft = null; refresh(); renderEdit(); toast('Removed.'); }),
    delphoto: () => { readForm(); const [p] = draft.photos.splice(+b.dataset.i, 1); if (p && !p.blob) draft.removed.push(p); renderEdit(); },
    delmem: () => run(async () => { const e = byId(sel), m = e.memories[+b.dataset.i]; await store.removeMemory(m); e.memories.splice(+b.dataset.i, 1); openStory(sel, $('#m-text').value); }),
    delstoryphoto: () => run(async () => { const e = byId(sel), p = e.photos[+b.dataset.i]; await store.removePhoto(p); e.photos.splice(+b.dataset.i, 1); renderGallery(); openStory(sel, $('#m-text').value); }),
    geocode: () => geocode(),
    saveabout: () => run(() => saveAbout(a, b)), addname: () => run(() => saveAbout(a, b)), delname: () => run(() => saveAbout(a, b)),
  };
  if (acts[a]) acts[a]();
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.f) { prefs.filters[t.dataset.f] = t.checked; savePrefs(); if (sel && !visible().some((e) => e.id === sel)) sel = null; renderMap(); renderTimeline(); renderPreview(); renderGallery(); }
  else if (t.name === 'prec') { readForm(); draft.precision = t.value; renderEdit(); $('#p-' + (t.value === 'approx' ? 'a' : 'd')).focus(); }
  else if (t.name === 'size') { prefs.size = t.value; savePrefs(); document.documentElement.dataset.size = t.value; if (map) map.invalidateSize(); }
  else if (t.name === 'mode') run(async () => { const was = S.mode; S.mode = t.value; try { await store.saveSubject(S); } catch (e) { S.mode = was; throw e; } finally { refresh(); if (S.view === 'edit') renderEdit(); } });
  else if (t.dataset.photo && t.files && t.files[0]) {
    const where = t.dataset.photo, file = t.files[0];
    run(async () => {
      let blob; try { blob = await shrink(file); } catch (e) { toast('That file could not be read as a picture. Try another one.'); return; }
      if (where === 'draft') { readForm(); draft.photos.push({ blob, src: URL.createObjectURL(blob), cap: '' }); renderEdit(); }
      else { const e = byId(where), keep = $('#m-text') ? $('#m-text').value : ''; e.photos.push(await store.addPhoto(e, blob)); renderGallery(); openStory(where, keep); toast('Photo added.'); }
    });
  }
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'e-when') $('#understood').textContent = understood(parseWhen(ev.target.value), ev.target.value); });
document.addEventListener('submit', (ev) => {
  ev.preventDefault(); const f = ev.target.id;
  if (f === 'signin') run(async () => {
    const email = $('#si-email').value.trim().toLowerCase();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (!error) return gateSent(email);
    console.warn(error);
    if (/email rate limit/i.test(error.message)) gateSignIn('We have sent as many sign-in emails as we can for now. Please try again in about an hour.');
    else if (/rate|seconds|too many/i.test(error.message)) gateSignIn('We have just sent you an email. Please wait a minute before asking for another.');
    else if (/invite-only|Database error|Signups not allowed|not allowed/i.test(error.message)) gateSignIn('That email address is not on the guest list yet. Ask the person who invited you to check the address they used.');
    else gateSignIn('We could not send the email just now. Please check the address and try again.');
  });
  else if (f === 'code') run(async () => {
    const { error } = await sb.auth.verifyOtp({ email: $('#si-codeemail').value, token: $('#si-code').value.replace(/\s/g, ''), type: 'email' });
    if (error) toast('That code did not work. Check the numbers, or ask for a new email.');
  });
  else if (f === 'newform') run(async () => {
    const self = $('#nw-self').checked, nm = $('#nw-name').value.trim(), you = $('#nw-you').value.trim();
    const subject = { preferred: nm, birthName: '', pronouns: '', born: '', died: '', forSelf: self, relationship: self ? '' : $('#nw-rel').value.trim(), builder: you || (self ? nm : ''), changes: [] };
    if (you) { prefs.myName = you; savePrefs(); }
    let id;
    try { id = await createMap(user.id, subject); }
    catch (e) { if (/row-level security/i.test(e.message || '')) return gateMessage('Not quite yet', 'Your email can add memories to maps you are invited to, but it is not yet on the list to start a new Memory Map. Ask us to add you.', myMaps.length ? '<button class="btn primary" data-act="choose">Back</button>' : ''); throw e; }
    myMaps = await listMaps(); await openMap(id);
  });
  else if (f === 'memform') run(async () => {
    const tx = $('#m-text').value.trim(), by = $('#m-by').value.trim(); if (!tx) { $('#m-text').focus(); toast('Write a few words first, then save.'); return; }
    if (by) { prefs.myName = by; savePrefs(); }
    const e = byId(sel); e.memories.push(await store.addMemory(e, by || 'A family member', tx)); renderTimeline(); openStory(sel); toast('Memory saved. Thank you.');
  });
  else if (f === 'inviteform') run(async () => {
    const email = $('#iv-email').value.trim().toLowerCase();
    try { await store.addInvite(email); } catch (e) { if (/duplicate|unique/i.test(e.message || '')) { toast('That person is already invited.'); return; } throw e; }
    await renderSettings('invited');
  });
});
document.addEventListener('mouseover', (ev) => { const c = ev.target.closest && ev.target.closest('.card'); if (c) setHot(c.dataset.id); });
document.addEventListener('mouseout', (ev) => { const c = ev.target.closest && ev.target.closest('.card'); if (c) setHot(null); });
document.addEventListener('focusin', (ev) => { const c = ev.target.closest && ev.target.closest('.card'); if (c) setHot(c.dataset.id); });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S && VIEWS.includes(v) && v !== S.view) setView(v); });
window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

/* ---------- start ---------- */
document.documentElement.dataset.size = prefs.size || 'normal';
// A used or expired email link comes back with an error in the address; say so plainly.
let linkProblem = /error_code=|error=access_denied/.test(location.hash) ? 'That sign-in link has expired or was already used. Enter your email and we will send a fresh one.' : '';
if (linkProblem) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }
if (!sb) gateSignIn();
else {
  showGate(`${brand}<p>One moment…</p>`);
  sb.auth.onAuthStateChange((event, session) => {
    const next = session ? session.user : null;
    if (next && (!user || user.id !== next.id)) { user = next; setTimeout(afterSignIn, 0); }   // defer: no Supabase calls inside the callback
    else if (!next && (user || event === 'INITIAL_SESSION')) { user = null; if (!(S && S.demo)) { S = null; gateSignIn(linkProblem); linkProblem = ''; } }
  });
}
