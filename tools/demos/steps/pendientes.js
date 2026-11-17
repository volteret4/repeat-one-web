// Recorre las pestañas como lo haría alguien y abre algunas fichas.
const clickText = async (txt, sel = 'button, a, [role=tab], .tab, li') => {
  const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === txt);
  if (el) { el.click(); await sleep(1800); }
  return !!el;
};
const openSome = async (sel, n) => { for (const e of [...document.querySelectorAll(sel)].slice(0, n)) { e.click(); await sleep(900); document.querySelector('.modal .close, .close, [aria-label=Cerrar]')?.click(); await sleep(200); } };
const tabs = ['Pendientes', 'Catálogo', 'Artistas', 'Sin escuchas', 'Escuchados'];
const log = {};
for (const t of tabs) {
  log[t] = await clickText(t);
  // Estados del filtro de cada pestaña
  for (const f of ['Completados', 'Todos', 'Sí', 'No']) await clickText(f);
  await openSome('.item, .card, tr.row, .album, .task', 8);
}
// Página siguiente donde la haya
for (const t of tabs) { await clickText(t); await clickText('›') || await clickText('Siguiente') || await clickText('»'); }
// Fichas: para lo que han mostrado las listas, las mismas consultas que hace la página al abrir un disco.
const lists = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => /\/api\/(tasks|library|catalog\/search|catalog\/artists)\?/.test(u)))];
const got = {tasks: 0, library: 0, catalog: 0, artists: 0};
for (const u of lists) {
  const d = await (await fetch(u)).json();
  const items = (d.items || d.results || d.artists || d).slice?.(0, 10) || [];
  for (const it of items) {
    if (u.includes('/api/tasks?') && it.uid) { await fetch(`./api/tasks/${encodeURIComponent(it.uid)}/enrichment`); got.tasks++; }
    else if (u.includes('/api/library?') && it.id) { await fetch(`./api/library/${encodeURIComponent(it.id)}/enrichment`); got.library++; }
    else if (u.includes('/api/catalog/search?') && it.id) { await fetch(`./api/catalog/album/${it.id}`); got.catalog++; }
    if (it.artist || it.name) { await fetch('./api/catalog/artist_listens?artist=' + encodeURIComponent(it.artist || it.name)); got.artists++; }
  }
}
log.fichas = got;
return log;
