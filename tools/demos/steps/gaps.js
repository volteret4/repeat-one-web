// 60 artistas con discografía mediana (8-120 discos) y algún disco que falte; se abren todos.
const all = await (await fetch('/api/artists')).json();
const pick = all.filter(a => a.missing_count > 0 && a.total_count >= 8 && a.total_count <= 120).sort((a, b) => b.total_count - a.total_count).slice(0, 60);
window.__pick = pick.map(a => a.id);
for (const a of pick) { await fetch(`/api/artists/${a.id}/albums`); }
await fetch('/api/availability/job');
// Marcas de «ya lo tengo» (Airsonic, qBittorrent, escuchado, Mix) de esos artistas y sus discos.
const items = [];
for (const a of pick) {
  items.push({artist: a.name, album: ''});
  const d = await (await fetch(`/api/artists/${a.id}/albums`)).json();
  for (const al of d.albums || []) items.push({artist: a.name, album: al.title});
}
const owned = location.protocol + '//' + location.hostname + ':8780/api/owned';
for (let i = 0; i < items.length; i += 200) {
  await fetch(owned, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({items: items.slice(i, i + 200)})});
}
