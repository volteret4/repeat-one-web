// Base de datos del navegador. Nombre propio porque el origen se comparte con otras páginas.
const NAME = 'repeat-one:dieta-sonora';
let dbp = null;

function open() {
  dbp ??= new Promise((resolve, reject) => {
    const q = indexedDB.open(NAME, 1);
    q.onupgradeneeded = () => {
      q.result.createObjectStore('releases', {keyPath: 'mbid'});
      q.result.createObjectStore('meta');
    };
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  return dbp;
}

async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then(v => { result = v; });
    t.oncomplete = () => resolve(result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

const req = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });

export const allReleases = () => tx('releases', 'readonly', t => req(t.objectStore('releases').getAll()));
export const putReleases = rows => tx('releases', 'readwrite', t => { const s = t.objectStore('releases'); rows.forEach(r => s.put(r)); });
export const getMeta = key => tx('meta', 'readonly', t => req(t.objectStore('meta').get(key)));
export const setMeta = (key, value) => tx('meta', 'readwrite', t => { t.objectStore('meta').put(value, key); });
export const wipe = () => tx(['releases', 'meta'], 'readwrite', t => { t.objectStore('releases').clear(); t.objectStore('meta').clear(); });
