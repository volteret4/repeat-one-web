// Índice: rejilla por grupos y panel lateral. Los textos se insertan siempre como texto.
import {GROUPS, MODULES, README, TAGS} from './modules.js';

const $ = id => document.getElementById(id);
const panel = $('panel'), scrim = $('scrim');
let opener = null;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...kids.filter(k => k !== null && k !== undefined));
  return e;
}

const external = url => /^https?:/.test(url) ? {target: '_blank', rel: 'noopener'} : {};
const link = (label, url, cls) => el('a', {class: cls, href: url, ...external(url)}, label + (/^https?:/.test(url) ? ' ↗' : ''));

const KIND_LABEL = {public: 'Versión pública', sim: 'Simulación o demo', blog: 'Blog', script: 'Script', app: 'App de terceros'};
const filters = {kind: 'all', tag: null};
const matches = m => (filters.kind === 'all' || m.kind === filters.kind) && (!filters.tag || m.tags.includes(filters.tag));

function renderGrid() {
  const box = $('groups');
  box.replaceChildren();
  let shown = 0;
  for (const g of GROUPS) {
    const items = MODULES.filter(m => m.group === g && matches(m));
    shown += items.length;
    if (!items.length) continue;
    const grid = el('div', {class: 'grid'});
    for (const m of items) {
      const card = el('button', {type: 'button', class: 'card ' + m.kind, 'data-id': m.id, 'aria-haspopup': 'dialog', 'aria-expanded': 'false'},
        el('span', {class: 'card-head'}, el('span', {class: 'dot ' + m.kind, title: KIND_LABEL[m.kind]}), m.label),
        el('small', {}, m.short));
      card.addEventListener('click', () => { location.hash = m.id; });
      grid.append(card);
    }
    box.append(el('section', {class: 'group'}, el('h2', {}, g), grid));
  }
  if (!shown) box.append(el('p', {class: 'empty'}, 'Ningún módulo cumple los dos filtros.'));
  markOpen();
}

function panelBody(m) {
  const body = [
    el('div', {class: 'badge'}, el('span', {class: 'dot ' + m.kind}), {public: 'Versión pública disponible', sim: 'Solo despliegue local', blog: 'Blog', script: 'Script (sin web)', app: 'App de terceros'}[m.kind]),
    el('h2', {id: 'p-title'}, m.label),
    el('h3', {}, 'Qué hace'),
    el('p', {}, m.what),
    m.detail ? el('p', {class: 'detail'}, m.detail) : null,
  ];
  if (['blog', 'script', 'app'].includes(m.kind)) {
    body.push(el('h3', {}, {blog: 'Leer', script: 'Código', app: 'Enlaces'}[m.kind]), ...m.try.map(t => link(t.label, t.url, 'btn')));
    if (m.repos.length) body.push(el('h3', {}, 'Código'), ...m.repos.map(r => link(`Repositorio ${r.label}`, r.url, 'btn ghost')));
    return body;
  }
  if (m.kind === 'public') {
    body.push(el('h3', {}, 'Versión pública de prueba'), ...m.try.map(t => link(t.label, t.url, 'btn')));
  } else {
    body.push(el('h3', {}, m.replay ? 'Demo' : 'Simulación'),
      el('p', {class: 'warn'}, m.replay
        ? 'Este módulo no tiene versión pública. La demo es su web local con un extracto de datos reales: puedes navegar, buscar y filtrar, pero lo que cambiaría algo no se guarda.'
        : 'Este módulo no tiene versión pública. La simulación imita su despliegue local con datos inventados: no se conecta a nada ni guarda cambios.'),
      link(m.replay ? 'Ver la demo' : 'Ver la simulación', m.replay ? `./demo/${m.demo}/` : `./demo/${m.demo}.html`, 'btn'));
  }
  body.push(el('h3', {}, 'Versión local'));
  if (m.repos.length) body.push(...m.repos.map(r => link(`Repositorio ${r.label}`, r.url, 'btn ghost')));
  else body.push(el('p', {class: 'empty'}, 'Su código no está publicado por ahora.'));
  if (m.profile) {
    body.push(link('Instalar desde REPEAT-ONE', README, 'btn ghost'),
      el('p', {class: 'detail'}, 'Se elige en el menú del instalador: ', ...m.profile.split(', ').flatMap((p, i) => [i ? ', ' : '', el('code', {}, p)]), '.'));
  } else if (m.repos.length) {
    body.push(el('p', {class: 'detail'}, 'No se instala con REPEAT-ONE: su README explica cómo hacerlo por separado.'));
  }
  return body;
}

function markOpen() {
  const id = location.hash.slice(1);
  document.querySelectorAll('.card').forEach(c => c.setAttribute('aria-expanded', String(!panel.hidden && decodeURIComponent(id) === c.dataset.id)));
}

function closePanel() {
  panel.hidden = scrim.hidden = true;
  document.body.style.overflow = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  markOpen();
  if (opener?.isConnected) opener.focus();
  opener = null;
}

function route() {
  const m = MODULES.find(x => x.id === decodeURIComponent(location.hash.slice(1)));
  if (!m) {
    if (!panel.hidden) closePanel();
    return;
  }
  opener = opener || document.querySelector(`.card[data-id="${m.id}"]`);
  $('p-body').replaceChildren(...panelBody(m).filter(Boolean));
  panel.hidden = scrim.hidden = false;
  panel.scrollTop = 0;
  panel.focus();
  document.body.style.overflow = 'hidden';
  markOpen();
}

$('p-close').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
document.addEventListener('keydown', e => {
  if (panel.hidden) return;
  if (e.key === 'Escape') closePanel();
  if (e.key !== 'Tab') return;
  // El foco no sale del panel mientras está abierto.
  const f = [...panel.querySelectorAll('a[href],button')];
  const first = f[0], last = f.at(-1);
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('hashchange', route);

function setPressed(row, chip) {
  row.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
}

// Fila de usos: se pulsa uno para filtrar y otra vez para quitarlo.
const tagRow = $('f-tags');
for (const t of TAGS) {
  const n = MODULES.filter(m => m.tags.includes(t.id)).length;
  const chip = el('button', {type: 'button', class: 'chip', 'data-tag': t.id, 'aria-pressed': 'false'}, t.label + ' ', el('span', {}, String(n)));
  chip.addEventListener('click', () => {
    filters.tag = filters.tag === t.id ? null : t.id;
    setPressed(tagRow, filters.tag ? chip : null);
    renderGrid();
  });
  tagRow.append(chip);
}

const kindRow = $('f-kind');
kindRow.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  filters.kind = chip.dataset.kind;
  setPressed(kindRow, chip);
  renderGrid();
}));

$('n-all').textContent = MODULES.length;
for (const k of ['public', 'sim', 'blog', 'script', 'app']) $('n-' + k).textContent = MODULES.filter(m => m.kind === k).length;
renderGrid();
route();
