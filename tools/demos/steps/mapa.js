// Semillas: 25 artistas de la colección (búsquedas amplias), sus géneros y los artistas de esos géneros.
const get = async u => (await fetch(u)).json();
const seeds = new Map();
for (const q of ['a', 'e', 'o', 'the', 'los', 'dj']) {
  for (const it of await get('/api/search?q=' + encodeURIComponent(q))) {
    if (it.type === 'artist' && it.state === 'local' && seeds.size < 25) seeds.set(it.artist_id, it);
  }
}
const done = new Set(), genres = new Set();
for (const id of seeds.keys()) {
  const a = await get('/api/artist/' + id); done.add(id);
  for (const g of a.genres || []) genres.add(g.key);
}
const more = [];
for (const g of [...genres].slice(0, 15)) {
  const r = await get('/api/genre?key=' + encodeURIComponent(g));
  for (const a of (r.artists || []).slice(0, 6)) if (!done.has(a.id)) more.push(a.id);
}
for (const id of [...new Set(more)].slice(0, 45)) { await get('/api/artist/' + id); done.add(id); }
return done.size;
