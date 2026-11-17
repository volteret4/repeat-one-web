// Colecciones (6) y la carga de escuchas del propio usuario (solo él: nada de amigos).
const get = async u => (await fetch(u)).json();
const cols = await get('/api/collections');
const flat = (Array.isArray(cols) ? cols : Object.values(cols).flat()).filter(c => c && c.slug);
// Una colección de cada grupo, para que se vea variedad.
const porGrupo = new Map();
for (const c of flat) if (!porGrupo.has(c.group)) porGrupo.set(c.group, c.slug);
const slugs = [...porGrupo.values()];
for (const c of flat.filter(c => c.source_type !== 'rateyourmusic')) if (slugs.length < 6 && !slugs.includes(c.slug)) slugs.push(c.slug);
for (const c of flat) if (slugs.length < 6 && !slugs.includes(c.slug)) slugs.push(c.slug);
for (const s of slugs) await get('/api/collection?slug=' + encodeURIComponent(s));
const inp = document.getElementById('inp-user');
inp.value = 'paqueradejere';
document.getElementById('btn-go')?.click() ?? inp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
for (let i = 0; i < 420; i++) { await sleep(1000); if (/✓|Error/.test(document.getElementById('um-progress')?.textContent || '')) break; }
return {slugs, estado: document.getElementById('um-progress')?.textContent};
