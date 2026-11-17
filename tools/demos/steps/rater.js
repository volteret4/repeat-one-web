// Temas al azar con su ficha, portada y parecidos; estadísticas y dimensiones.
const get = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (_) { return null; } };
const first = await get('/api/next'); if (first?.id) { await fetch(`/api/art/${first.id}`); await get(`/api/meta/${first.id}`); await get(`/api/similar/${first.id}`); }
await get('/api/sidebar'); await get('/api/stats');
const ids = new Set();
for (let i = 0; i < 6; i++) { const r = await get('/api/random'); for (const t of (r?.tracks || (Array.isArray(r) ? r : [r]))) if (t?.id) ids.add(t.id); }
for (const id of [...ids].slice(0, 25)) { await get(`/api/meta/${id}`); await get(`/api/track/${id}`); await get(`/api/similar/${id}`); await fetch(`/api/art/${id}`); }
return ids.size;
