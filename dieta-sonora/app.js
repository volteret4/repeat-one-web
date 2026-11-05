// Dieta Sonora para navegador. Los datos externos se insertan siempre como texto, nunca como HTML.
import {bookmarkletSource, counts, filterReleases, isUserId, mergeReleases, normalizeRelease, parseImport, restoreBackup, VIDEO_ID} from './core.js';
import {allReleases, getMeta, putReleases, setMeta, wipe} from './db.js';

const SETTINGS = 'repeat-one:dieta-sonora:settings';
const SITE_ORIGIN = 'https://volteret4.github.io';
const SITE = SITE_ORIGIN + '/repeat-one-web/dieta-sonora/';
const MUSPY_ORIGINS = ['https://muspy.com', 'https://www.muspy.com'];
const STATE_LABEL = {pending: 'Pendiente', owned: 'Ya lo tengo', listened: 'Escuchado', dismissed: 'Descartar'};
const EMPTY = {
  pending: 'No hay discos pendientes con estos filtros.', owned: 'Aquí aparecerán los discos que marques como «Ya lo tengo».',
  listened: 'Aquí aparecerán los discos que marques como escuchados.', dismissed: 'Aquí aparecerán los discos que descartes.',
};

const $ = id => document.getElementById(id);
const view = {state: 'pending', q: '', type: '', onlyYear: false, selected: null};
const THIS_YEAR = String(new Date().getFullYear());
let rows = [];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...kids.filter(k => k !== null && k !== undefined));
  return e;
}

function settings() {
  let own = {}, charts = {};
  try { own = JSON.parse(localStorage.getItem(SETTINGS)) || {}; } catch { /* vacío */ }
  // Si ya usas charts-web en este navegador, se reutilizan sus claves.
  try { charts = JSON.parse(localStorage.getItem('charts-web:settings')) || {}; } catch { /* vacío */ }
  return {youtube: own.youtube || charts.youtube_key || '', lastfm: own.lastfm || charts.lastfm_key || ''};
}

let statusTimer;
function notify(msg, isError = false) {
  const s = $('status');
  s.textContent = msg;
  s.classList.toggle('error', isError);
  s.hidden = false;
  clearTimeout(statusTimer);
  if (!isError) statusTimer = setTimeout(() => { s.hidden = true; }, 7000);
}

function coverImg(r, size = 250) {
  const img = el('img', {class: 'cover', loading: 'lazy', alt: '', src: `https://coverartarchive.org/release-group/${r.mbid}/front-${size}`});
  img.addEventListener('error', () => { img.src = placeholder(r); }, {once: true});
  return img;
}

// Sin portada: un cuadro con el color derivado del disco, siempre el mismo.
function placeholder(r) {
  let h = 0;
  for (const c of r.mbid) h = (h * 31 + c.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${h},35%,22%)"/><circle cx="50" cy="50" r="30" fill="hsl(${h},30%,14%)"/><circle cx="50" cy="50" r="6" fill="hsl(${h},40%,45%)"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function render() {
  const c = counts(rows);
  for (const k of Object.keys(c)) $('c-' + k).textContent = c[k];
  const list = filterReleases(rows, {state: view.state, q: view.q, type: view.type, year: view.onlyYear ? THIS_YEAR : ''});
  $('grid').replaceChildren(...list.map(r => el('button', {type: 'button', class: 'album' + (r.mbid === view.selected ? ' selected' : ''), 'data-id': r.mbid, onclick: () => select(r.mbid)},
    coverImg(r), el('b', {}, r.artist), el('span', {}, r.name), el('small', {}, [r.date || 'sin fecha', r.type].filter(Boolean).join(' · ')))));
  const empty = $('empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    if (rows.length) empty.replaceChildren(EMPTY[view.state]);
    else empty.replaceChildren(el('p', {}, 'Todavía no hay discos en este navegador.'),
      el('button', {type: 'button', class: 'primary', onclick: () => $('d-muspy').showModal()}, 'Añadir Muspy'));
  }
  const types = [...new Set(rows.map(r => r.type).filter(Boolean))].sort();
  const sel = $('f-type');
  sel.replaceChildren(el('option', {value: ''}, 'Todos los tipos'), ...types.map(t => el('option', {value: t}, t)));
  sel.value = types.includes(view.type) ? view.type : '';
}

function select(mbid) {
  view.selected = mbid;
  const r = rows.find(x => x.mbid === mbid);
  document.querySelectorAll('.album').forEach(a => a.classList.toggle('selected', a.dataset.id === mbid));
  renderSidebar(r);
}

async function setState(r, state) {
  r.state = state;
  await putReleases([r]);
  render();
  renderSidebar(r);
}

function closeSidebar() {
  view.selected = null;
  $('sidebar').classList.remove('open');
  $('sidebar').replaceChildren(el('p', {class: 'placeholder'}, 'Selecciona un disco para ver los detalles y dónde escucharlo.'));
  document.querySelectorAll('.album.selected').forEach(a => a.classList.remove('selected'));
}

function renderSidebar(r) {
  const side = $('sidebar');
  const query = `${r.artist} ${r.name}`;
  const enc = encodeURIComponent(query);
  const video = el('div', {class: 'section', id: 'video'}, el('h3', {}, 'Escuchar'));
  const links = el('div', {class: 'links'},
    el('a', {href: `https://www.youtube.com/results?search_query=${enc}`, target: '_blank', rel: 'noopener'}, 'YouTube ↗'),
    el('a', {href: `https://bandcamp.com/search?q=${enc}&item_type=a`, target: '_blank', rel: 'noopener'}, 'Bandcamp ↗'));
  video.append(links);
  const hasYt = !!settings().youtube;
  if (hasYt) video.append(el('p', {}, el('button', {type: 'button', onclick: e => findVideo(r, video, e.currentTarget)}, '▶ Buscar el vídeo aquí')));
  else video.append(el('p', {class: 'small'}, 'Añade una clave de YouTube en «Ajustes y datos» para verlo aquí mismo.'));
  const info = el('div', {class: 'section', id: 'info'});
  side.replaceChildren(
    el('button', {type: 'button', class: 'x', 'aria-label': 'Cerrar', onclick: closeSidebar}, '×'),
    coverImg(r, 500), el('h2', {}, r.artist), el('p', {class: 'album-title'}, r.name),
    el('p', {class: 'meta'}, [r.date || 'sin fecha', r.type].filter(Boolean).join(' · ')),
    el('div', {class: 'actions'}, ...['pending', 'owned', 'listened', 'dismissed'].map(s =>
      el('button', {type: 'button', class: r.state === s ? 'on' : '', 'aria-pressed': String(r.state === s), onclick: () => setState(r, s)}, STATE_LABEL[s]))),
    video, info,
    el('div', {class: 'section'}, el('h3', {}, 'Ficha'), el('div', {class: 'links'},
      el('a', {href: `https://musicbrainz.org/release-group/${r.mbid}`, target: '_blank', rel: 'noopener'}, 'MusicBrainz ↗'),
      r.artistMbid ? el('a', {href: `https://muspy.com/artist/${r.artistMbid}`, target: '_blank', rel: 'noopener'}, 'Muspy ↗') : null,
      el('a', {href: `https://www.discogs.com/search/?q=${enc}&type=master`, target: '_blank', rel: 'noopener'}, 'Discogs ↗'),
      el('a', {href: `https://www.last.fm/music/${encodeURIComponent(r.artist)}/${encodeURIComponent(r.name)}`, target: '_blank', rel: 'noopener'}, 'Last.fm ↗'))));
  side.classList.add('open');
  side.scrollTop = 0;
  side.focus({preventScroll: true});
  loadLastfm(r, info);
}

async function findVideo(r, box, btn) {
  btn.disabled = true;
  btn.textContent = 'Buscando…';
  const q = new URLSearchParams({part: 'snippet', type: 'video', maxResults: '1', videoEmbeddable: 'true', q: `${r.artist} ${r.name}`, key: settings().youtube});
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/search?' + q);
    if (!res.ok) throw new Error(res.status === 403 ? 'cuota agotada o clave restringida' : 'HTTP ' + res.status);
    const id = (await res.json()).items?.[0]?.id?.videoId;
    if (!VIDEO_ID.test(id || '')) throw new Error('sin resultados');
    btn.parentElement.replaceWith(el('iframe', {class: 'video', title: `Vídeo de ${r.name}`, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', src: `https://www.youtube-nocookie.com/embed/${id}`}));
  } catch (e) {
    btn.disabled = false;
    btn.textContent = `▶ Reintentar (${e.message})`;
  }
}

const stripTags = s => {
  const t = new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent || '';
  return t.replace(/\s*Read more on Last\.fm.*$/s, '').trim();
};

async function loadLastfm(r, box) {
  const key = settings().lastfm;
  if (!key) return;
  box.replaceChildren(el('h3', {}, 'Sobre el disco'), el('p', {class: 'small'}, 'Cargando…'));
  const q = new URLSearchParams({method: 'album.getinfo', artist: r.artist, album: r.name, api_key: key, format: 'json', autocorrect: '1'});
  try {
    const res = await fetch('https://ws.audioscrobbler.com/2.0/?' + q);
    const d = await res.json();
    if (view.selected !== r.mbid) return;
    if (!res.ok || d.error) throw new Error(d.message || 'HTTP ' + res.status);
    const a = d.album || {};
    const tags = [a.tags?.tag].flat().filter(Boolean).slice(0, 6);
    const wiki = stripTags(a.wiki?.summary);
    box.replaceChildren(el('h3', {}, 'Sobre el disco'),
      el('p', {class: 'small'}, `${Number(a.listeners || 0).toLocaleString('es')} oyentes · ${Number(a.playcount || 0).toLocaleString('es')} escuchas`),
      tags.length ? el('div', {class: 'tags'}, ...tags.map(t => el('span', {}, t.name))) : null,
      wiki ? el('p', {class: 'wiki'}, wiki) : null);
  } catch (e) {
    if (view.selected === r.mbid) box.replaceChildren(el('h3', {}, 'Sobre el disco'), el('p', {class: 'small'}, `Sin datos de Last.fm (${e.message}).`));
  }
}

async function ingest(raw, source) {
  const {rows: changed, added, updated} = mergeReleases(rows, raw);
  if (changed.length) await putReleases(changed);
  rows = await allReleases();
  await setMeta('lastImport', {at: Date.now(), source});
  render();
  const skipped = raw.filter(x => !normalizeRelease(x)).length;
  notify(`${source}: ${added} discos nuevos, ${updated} actualizados${skipped > 0 ? `, ${skipped} ignorados por datos incompletos` : ''}.`);
}

// ── Mensajes del marcador ────────────────────────────────────────────────────
window.addEventListener('message', async e => {
  if (!MUSPY_ORIGINS.includes(e.origin) || !e.data || typeof e.data !== 'object') return;
  if (e.data.type === 'ds-error') { notify(`Muspy: ${String(e.data.message).slice(0, 200)}`, true); return; }
  if (e.data.type !== 'ds-muspy' || !Array.isArray(e.data.releases)) return;
  e.source?.postMessage('ds-ack', e.origin);
  // El marcador reenvía hasta recibir respuesta: solo se procesa el primer envío.
  if (window.__dsImporting) return;
  window.__dsImporting = true;
  try {
    if (isUserId(e.data.userid)) await setMeta('userid', e.data.userid);
    await ingest(e.data.releases.slice(0, 20000), 'Muspy');
    if (location.hash === '#muspy') history.replaceState(null, '', location.pathname);
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  } catch (err) {
    notify(`No se pudieron guardar los discos: ${err.message}`, true);
  } finally {
    window.__dsImporting = false;
  }
});

// ── Eventos ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  view.state = t.dataset.state;
  document.querySelectorAll('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-pressed', String(x === t)); });
  render();
}));
$('f-q').addEventListener('input', e => { view.q = e.target.value; render(); });
$('f-type').addEventListener('change', e => { view.type = e.target.value; render(); });
$('f-year').addEventListener('change', e => { view.onlyYear = e.target.checked; render(); });
$('b-muspy').addEventListener('click', () => $('d-muspy').showModal());
$('b-settings').addEventListener('click', () => {
  const s = settings();
  $('s-yt').value = s.youtube;
  $('s-lfm').value = s.lastfm;
  $('d-settings').showModal();
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('bookmarklet').addEventListener('click', e => {
  e.preventDefault();
  notify('Arrastra el botón a la barra de marcadores y púlsalo estando en muspy.com.');
});

function updateIdLinks() {
  const id = $('m-id').value.trim();
  const ok = isUserId(id);
  $('m-links').hidden = !ok;
  if (ok) {
    $('m-json').href = `https://muspy.com/api/1/releases/${id}?limit=100`;
    $('m-json2').href = `https://muspy.com/api/1/releases/${id}?limit=100&offset=100`;
  }
}
$('m-id').addEventListener('input', updateIdLinks);

$('m-file').addEventListener('change', async e => {
  const parse = t => new DOMParser().parseFromString(t, 'application/xml');
  try {
    for (const f of e.target.files) await ingest(parseImport(await f.text(), parse), f.name);
    $('d-muspy').close();
  } catch (err) {
    notify(`No se pudo leer el archivo: ${err.message}`, true);
    $('d-muspy').close();
  }
  e.target.value = '';
});

$('m-sample').addEventListener('click', async () => {
  const m = await import('./sample.js');
  await ingest(m.SAMPLE, 'Ejemplo');
  $('d-muspy').close();
});

$('s-save').addEventListener('click', () => {
  localStorage.setItem(SETTINGS, JSON.stringify({youtube: $('s-yt').value.trim(), lastfm: $('s-lfm').value.trim()}));
  $('d-settings').close();
  notify('Claves guardadas en este navegador.');
  if (view.selected) select(view.selected);
});
$('s-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({version: 1, exportedAt: new Date().toISOString(), releases: rows}, null, 1)], {type: 'application/json'});
  const a = el('a', {href: URL.createObjectURL(blob), download: 'dieta-sonora-copia.json'});
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('s-import').addEventListener('change', async e => {
  try {
    const restored = restoreBackup(JSON.parse(await e.target.files[0].text()));
    await putReleases(restored);
    rows = await allReleases();
    render();
    notify(`Copia restaurada: ${restored.length} discos.`);
    $('d-settings').close();
  } catch (err) {
    notify(`No se pudo restaurar: ${err.message}`, true);
    $('d-settings').close();
  }
  e.target.value = '';
});
$('s-wipe').addEventListener('click', async () => {
  if (!confirm('¿Borrar todos los discos y estados de este navegador? Las claves se conservan.')) return;
  await wipe();
  rows = [];
  closeSidebar();
  render();
  $('d-settings').close();
  notify('Datos borrados.');
});

// ── Arranque ─────────────────────────────────────────────────────────────────
$('this-year').textContent = THIS_YEAR;
// El marcador apunta siempre a la página publicada, también si esto se abre en local.
$('bookmarklet').href = bookmarkletSource(SITE, SITE_ORIGIN);
try {
  rows = await allReleases();
  const id = await getMeta('userid');
  if (id) { $('m-id').value = id; updateIdLinks(); }
} catch (err) {
  notify(`Este navegador no permite guardar datos aquí (${err.message}).`, true);
}
render();
if (location.hash === '#muspy') notify('Esperando los discos de Muspy…');
