// Los 80 discos añadidos más recientemente que faltan en la colección 1, con portada, y las vistas de explorar.
const get = async u => (await fetch(u)).json();
const enc = encodeURIComponent;
const missing = (await get('/api/albums/missing')).sort((a, b) => b.added_at - a.added_at).slice(0, 80);
for (const a of missing) {
  await fetch(`/api/albums/cover?path=${enc(a.path || '')}&artist=${enc(a.artist || '')}&album=${enc(a.title || '')}&mbid=${enc(a.mbid || '')}`);
}
for (const view of ['artists', 'labels', 'genres']) {
  const rows = await get(`/api/explore?view=${view}`);
  for (const r of (rows || []).slice(0, 10)) await get(`/api/explore/albums?view=${view}&name=${enc(r.name)}`);
}
return missing.length;
