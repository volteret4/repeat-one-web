// Índice: rejilla por grupos y panel lateral. Los textos se insertan siempre como texto.
import {GROUPS, MODULES, README} from './modules.js';

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

function renderGrid(filter) {
  const box = $('groups');
  box.replaceChildren();
  for (const g of GROUPS) {
    const items = MODULES.filter(m => m.group === g && (filter === 'all' || m.kind === filter));
    if (!items.length) continue;
    const grid = el('div', {class: 'grid'});
    for (const m of items) {
      const card = el('button', {type: 'button', class: 'card ' + m.kind, 'data-id': m.id, 'aria-haspopup': 'dialog', 'aria-expanded': 'false'},
        el('span', {class: 'card-head'}, el('span', {class: 'dot ' + m.kind, title: m.kind === 'public' ? 'Versión pública' : 'Simulación'}), m.label),
        el('small', {}, m.short));
      card.addEventListener('click', () => { location.hash = m.id; });
      grid.append(card);
    }
    box.append(el('section', {class: 'group'}, el('h2', {}, g), grid));
  }
  markOpen();
}

function panelBody(m) {
  const body = [
    el('div', {class: 'badge'}, el('span', {class: 'dot ' + m.kind}), m.kind === 'public' ? 'Versión pública disponible' : 'Solo despliegue local'),
    el('h2', {id: 'p-title'}, m.label),
    el('h3', {}, 'Qué hace'),
    el('p', {}, m.what),
    m.detail ? el('p', {class: 'detail'}, m.detail) : null,
  ];
  if (m.kind === 'public') {
    body.push(el('h3', {}, 'Versión pública de prueba'), ...m.try.map(t => link(t.label, t.url, 'btn')));
  } else {
    body.push(el('h3', {}, 'Simulación'),
      el('p', {class: 'warn'}, 'Este módulo no tiene versión pública. La simulación imita su despliegue local con datos inventados: no se conecta a nada ni guarda cambios.'),
      link('Ver la simulación', `./demo/${m.demo}.html`, 'btn'));
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

document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
  renderGrid(chip.dataset.filter);
}));

$('n-all').textContent = MODULES.length;
$('n-public').textContent = MODULES.filter(m => m.kind === 'public').length;
$('n-sim').textContent = MODULES.filter(m => m.kind === 'sim').length;
renderGrid('all');
route();
