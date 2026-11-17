// Canales seguidos, sus listas y los temas de las 3 primeras de cada uno.
const get = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : []; } catch (_) { return []; } };
const users = await get('/api/users');
for (const u of users.slice(0, 5)) {
  const pls = await get(`/api/users/${u.id}/playlists`);
  for (const p of (pls.playlists || pls).slice(0, 3)) await get(`/api/playlists/${p.id}/tracks`);
}
await get('/api/playlists');
return users.length;
