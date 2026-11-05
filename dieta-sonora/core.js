// Lógica pura de Dieta Sonora (sin DOM ni red), para poder probarla con node.
export const STATES = ['pending', 'owned', 'listened', 'dismissed'];
const USERID = /^[0-9a-z]{30}$/;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export const isUserId = s => USERID.test(String(s || '').trim());

// Muspy da AAAA, AAAA-MM o AAAA-MM-DD, a veces vacío. Se guarda tal cual: ordena bien como texto.
export function cleanDate(d) {
  const s = String(d ?? '').slice(0, 10);
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s) ? s : '';
}

// Valida una fila externa. Devuelve null si no sirve; nunca confía en otros campos.
export function normalizeRelease(r) {
  if (!r || typeof r !== 'object') return null;
  const mbid = String(r.mbid ?? '').toLowerCase();
  const artist = String(r.artist?.name ?? r.artist ?? '').trim().slice(0, 300);
  const name = String(r.name ?? '').trim().slice(0, 300);
  if (!UUID.test(mbid) || !artist || !name) return null;
  return {mbid, artist, name, type: String(r.type ?? '').trim().slice(0, 40), date: cleanDate(r.date),
    artistMbid: UUID.test(String(r.artist?.mbid ?? '')) ? r.artist.mbid : ''};
}

// Lo nuevo entra como pendiente; lo que ya estaba conserva tu estado y tu nota.
export function mergeReleases(existing, incoming, now = Date.now()) {
  const byId = new Map(existing.map(r => [r.mbid, r]));
  const out = [];
  let added = 0, updated = 0;
  for (const raw of incoming) {
    const r = normalizeRelease(raw);
    if (!r) continue;
    const old = byId.get(r.mbid);
    if (old) {
      const merged = {...old, ...r, date: r.date || old.date, state: old.state, addedAt: old.addedAt};
      if (JSON.stringify(merged) !== JSON.stringify(old)) { out.push(merged); updated++; }
    } else {
      const fresh = {...r, state: 'pending', addedAt: now};
      byId.set(r.mbid, fresh);
      out.push(fresh);
      added++;
    }
  }
  return {rows: out, added, updated};
}

// Fichero guardado de la API de Muspy (JSON) o de su feed (Atom).
export function parseImport(text, parseXml) {
  const t = String(text).trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    const data = JSON.parse(t);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.releases)) return data.releases;
    throw new Error('El JSON no contiene una lista de discos');
  }
  if (!t.startsWith('<')) throw new Error('El fichero no es JSON ni un feed de Muspy');
  const doc = parseXml(t);
  const rows = [];
  for (const e of doc.querySelectorAll('entry')) {
    const title = e.querySelector('title')?.textContent || '';
    const cut = title.indexOf(' - ');
    if (cut < 1) continue;
    rows.push({
      mbid: (e.querySelector('id')?.textContent || '').replace('urn:uuid:', ''),
      artist: title.slice(0, cut), name: title.slice(cut + 3),
      date: (e.querySelector('updated')?.textContent || '').slice(0, 10),
      type: (e.querySelector('li')?.textContent.match(/\(([^()]+)\)\s*$/) || [])[1] || '',
    });
  }
  return rows;
}

export function filterReleases(rows, {state = 'pending', q = '', type = '', year = ''} = {}) {
  const needle = q.trim().toLowerCase();
  return rows.filter(r => r.state === state
    && (!type || r.type === type)
    && (!year || r.date.startsWith(year))
    && (!needle || r.artist.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.artist.localeCompare(b.artist, 'es'));
}

export function counts(rows) {
  const c = {pending: 0, owned: 0, listened: 0, dismissed: 0};
  for (const r of rows) if (r.state in c) c[r.state]++;
  return c;
}

// Copia de seguridad: lo importado se valida igual que lo que llega de Muspy.
export function restoreBackup(data) {
  const list = Array.isArray(data?.releases) ? data.releases : null;
  if (!list) throw new Error('No es una copia de Dieta Sonora');
  const rows = [];
  for (const raw of list) {
    const r = normalizeRelease(raw);
    if (!r) continue;
    rows.push({...r, state: STATES.includes(raw.state) ? raw.state : 'pending', addedAt: Number(raw.addedAt) || Date.now()});
  }
  return rows;
}

export const VIDEO_ID = /^[\w-]{11}$/;

// Se ejecuta DENTRO de muspy.com, con la sesión del usuario: Muspy no admite llamadas desde otros dominios.
// Se publica como marcador; no recoge contraseñas y solo habla con la página de destino.
export function bookmarkletSource(target, targetOrigin) {
  const fn = async () => {
    if (location.hostname.replace(/^www\./, '') !== 'muspy.com') { alert('Abre muspy.com, inicia sesión y vuelve a pulsar este marcador.'); return; }
    const win = window.open(TARGET + '#muspy', 'dieta-sonora');
    if (!win) { alert('El navegador ha bloqueado la ventana: permite ventanas emergentes en muspy.com.'); return; }
    const finds = d => { const a = d.querySelector('a[href*="feed?id="],link[href*="feed?id="]'); const m = a && a.getAttribute('href').match(/feed\?id=([0-9a-z]{30})/); return m && m[1]; };
    try {
      let id = finds(document);
      if (!id) id = finds(new DOMParser().parseFromString(await (await fetch('/releases', {credentials: 'same-origin'})).text(), 'text/html'));
      if (!id) throw new Error('No encuentro tu ID: inicia sesión en muspy.com.');
      const releases = [];
      for (let offset = 0; offset < 5000; offset += 100) {
        const r = await fetch('/api/1/releases/' + id + '?limit=100&offset=' + offset, {credentials: 'same-origin'});
        if (!r.ok) throw new Error('Muspy respondió ' + r.status);
        const page = await r.json();
        releases.push(...page);
        if (page.length < 100) break;
        await new Promise(res => setTimeout(res, 300));
      }
      let tries = 0;
      const send = setInterval(() => {
        if (++tries > 120) { clearInterval(send); alert('La página de Dieta Sonora no responde.'); return; }
        win.postMessage({type: 'ds-muspy', userid: id, releases}, ORIGIN);
      }, 500);
      window.addEventListener('message', e => { if (e.origin === ORIGIN && e.data === 'ds-ack') clearInterval(send); });
    } catch (e) {
      win.postMessage({type: 'ds-error', message: String(e.message)}, ORIGIN);
      alert(e.message);
    }
  };
  const code = fn.toString().replaceAll('TARGET', JSON.stringify(target)).replaceAll('ORIGIN', JSON.stringify(targetOrigin));
  return 'javascript:' + encodeURIComponent(`(${code})()`);
}
