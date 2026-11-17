// Reproduce una demo grabada de un servicio local de REPEAT-ONE.
// Se carga antes que el código de la web: contesta sus llamadas a la API con las
// respuestas guardadas (un extracto de datos reales) y convierte en simulación
// cualquier acción que cambiaría algo. Necesita window.REPLAY = {mod, root, map, ports}.
(() => {
  const R = window.REPLAY;
  // Raíz de la demo: en las páginas de subcarpetas la marca su <base>.
  const here = new URL('.', document.baseURI);
  let owned = null;

  // Clave de una URL pedida por la web: "p<puerto>/ruta?query" para otros puertos
  // del mismo servicio, "ruta?query" para el propio. Igual que en la grabación.
  function keyOf(input) {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    const port = R.ports?.find(p => u.port === String(p));
    let path;
    if (port) path = `p${port}${u.pathname}`;
    else if (u.origin === location.origin && u.pathname.startsWith(here.pathname)) path = u.pathname.slice(here.pathname.length);
    else if (u.origin === location.origin) path = u.pathname.replace(/^\//, '');
    else if (u.hostname === location.hostname) return '__otro_servicio__'; // otra app del mismo servidor: no existe aquí
    else return null; // fuera del servicio (portadas, YouTube…): se pide de verdad
    path = path.replace(/^\/+/, '');
    return path + u.search;
  }

  // FNV-1a de 32 bits; el mismo que record.py.
  function fnv(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  function lookup(key) {
    if (key in R.map) return R.map[key];
    const path = key.split('?')[0];
    // Misma ruta con otros parámetros: la primera grabada (p. ej. otra página o filtro).
    const alt = Object.keys(R.map).find(k => k.split('?')[0] === path);
    return alt ? R.map[alt] : null;
  }

  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('replay-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'replay-toast';
      t.setAttribute('role', 'status');
      document.body.append(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  window.REPLAY.toast = toast;

  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const key = keyOf(input);
    if (key === null) return realFetch(input, init);
    if (method !== 'GET' && method !== 'HEAD') {
      // Marcas de «ya lo tengo»: se contestan disco a disco con lo grabado.
      if (key.split('?')[0].endsWith('api/owned') && R.map.__owned__) {
        owned = owned || realFetch(new URL(R.root + R.map.__owned__, here)).then(r => r.json());
        const all = await owned;
        const items = JSON.parse(typeof init.body === 'string' ? init.body : '{}').items || [];
        const norm = v => String(v || '').trim().toLowerCase();
        return json({results: items.map(it => all[`${norm(it.artist)}\u0001${norm(it.album)}`] || null)});
      }
      // Otras consultas por POST que no cambian nada: se grabaron por su cuerpo.
      if ((R.readOnlyPosts || []).includes(key.split('?')[0])) {
        const body = typeof init.body === 'string' ? init.body : '';
        const file = R.map[key + '#b' + fnv(body)];
        return file ? realFetch(new URL(R.root + file, here)) : json({});
      }
      toast('Demo: en la versión local esto haría la acción de verdad. Aquí no se guarda nada.');
      return json({ok: true, simulated: true, message: 'Demo: no se guarda nada.'});
    }
    // Webs que llaman a Last.fm desde el navegador: la clave la pone cada visitante y vive en su navegador.
    if (R.lastfmKeyPath && key.split('?')[0] === R.lastfmKeyPath) {
      let k = '';
      try { k = localStorage.getItem('repeatone.lfm_key') || ''; } catch (_) {}
      return json({lfm_key: k});
    }
    const searched = await search(key);
    if (searched) return json(searched);
    const file = lookup(key);
    if (!file) return json({error: 'Esta consulta no está en el extracto de la demo.'}, 404);
    return realFetch(new URL(R.root + file, here));
  };

  // Búsquedas: se juntan todas las respuestas grabadas de esa ruta y se filtran por el texto.
  const cache = new Map();
  const load = file => cache.get(file) || cache.set(file, realFetch(new URL(R.root + file, here)).then(r => r.json())).get(file);
  async function search(key) {
    const [path, query = ''] = key.split('?');
    const spec = R.search?.[path];
    if (!spec || key in R.map) return null;
    const q = (new URLSearchParams(query).get(spec.param) || '').trim().toLowerCase();
    const files = Object.entries(R.map).filter(([k]) => k.split('?')[0] === path).map(([, f]) => f);
    if (!files.length) return null;
    const bodies = await Promise.all(files.map(load));
    const listOf = b => (spec.list ? b?.[spec.list] : b) || [];
    const seen = new Set(), items = [];
    for (const it of bodies.flatMap(listOf)) {
      const s = JSON.stringify(it);
      if (seen.has(s)) continue;
      seen.add(s);
      if (!q || s.toLowerCase().includes(q)) items.push(it);
    }
    return spec.list ? {...bodies[0], [spec.list]: items} : items;
  }

  // XMLHttpRequest: lo mismo, para las webs que no usan fetch.
  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const x = new RealXHR();
    const open = x.open;
    x.open = function (method, url, ...rest) {
      const key = keyOf(url);
      if (key !== null) {
        if (String(method).toUpperCase() !== 'GET') {
          toast('Demo: en la versión local esto haría la acción de verdad. Aquí no se guarda nada.');
          return open.call(x, 'GET', 'data:application/json,' + encodeURIComponent('{"ok":true,"simulated":true}'), ...rest);
        }
        const file = lookup(key);
        url = file ? new URL(R.root + file, here).href : 'data:application/json,' + encodeURIComponent('{"error":"no está en el extracto"}');
      }
      return open.call(x, method, url, ...rest);
    };
    return x;
  };

  // Conexiones en vivo (progreso de tareas): en la demo no hay nada que escuchar.
  window.EventSource = function () { return {close() {}, addEventListener() {}, set onmessage(_) {}, set onerror(_) {}}; };

  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.id = 'replay-banner';
    b.setAttribute('role', 'note');
    b.innerHTML = '<span>🎧 <b>Demo con un extracto de datos reales</b> del despliegue local. Puedes navegar y filtrar; lo que cambiaría algo no se guarda.</span>';
    const a = document.createElement('a');
    a.href = new URL('../#' + R.mod, here).href;
    a.textContent = '← Volver al índice';
    b.append(a);
    document.body.prepend(b);
    if (R.lastfmKeyPath) {
      let k = '';
      try { k = localStorage.getItem('repeatone.lfm_key') || ''; } catch (_) {}
      const f = document.createElement('form');
      f.id = 'replay-key';
      f.innerHTML = '<label>Tu API key de Last.fm <input name="k" autocomplete="off" spellcheck="false" placeholder="32 caracteres"></label><button>Guardar</button><a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener">Conseguir una ↗</a><small>Se guarda solo en este navegador y solo se envía a Last.fm.</small>';
      f.k.value = k;
      f.addEventListener('submit', e => {
        e.preventDefault();
        try { localStorage.setItem('repeatone.lfm_key', f.k.value.trim()); } catch (_) {}
        location.reload();
      });
      b.after(f);
      if (!k) toast('Pon tu API key de Last.fm arriba para usar esta página.');
    }
  });
})();
