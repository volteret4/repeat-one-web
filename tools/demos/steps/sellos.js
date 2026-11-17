// Por cada tipo (sellos, productores, masters): los 6 con más discos, su ficha, sus artistas y los discos de cada uno.
const get = async u => (await fetch(u)).json();
const enc = encodeURIComponent;
const out = {};
for (const t of ['labels', 'producers', 'masters']) {
  const groups = (await get(`/api/groups/${t}?`)).sort((a, b) => b.album_count - a.album_count).slice(0, 6);
  out[t] = groups.length;
  for (const g of groups) {
    await get(`/api/groups/${t}/${enc(g.slug)}`);
    const artists = await get(`/api/groups/${t}/${enc(g.slug)}/artists`);
    for (const a of (artists.artists || artists).slice(0, 3)) {
      await get(`/api/groups/${t}/${enc(g.slug)}/artists/${a.id}/albums`);
      await get(`/api/artists/${a.id}/albums`);
    }
  }
}
return out;
