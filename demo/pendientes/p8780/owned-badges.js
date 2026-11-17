/*
 * owned-badges.js — servido por ya_lo_tengo (/owned-badges.js).
 *
 * Pinta cuatro iconos (Airsonic, qBittorrent, escuchado, en Mix) dentro de
 * cada elemento con data-owned-artist (+ data-owned-album opcional; sin
 * disco, los iconos son del artista). Si el elemento tiene un descendiente
 * [data-owned-slot], los iconos van ahí en vez de al final del elemento.
 * Procesa también lo que la app pinte después (MutationObserver) y vuelve a
 * pintar si cambian los atributos. Las consultas se agrupan y se cachean.
 *
 * Carga desde cualquier app (mismo host, puerto 8780):
 *   <script>(function(){var s=document.createElement('script');
 *     s.src='./p8780/owned-badges.js';
 *     document.head.appendChild(s);})();</script>
 *
 * API: window.OwnedBadges.scan() fuerza una pasada; .refresh() vacía la caché.
 */
(function () {
  if (window.OwnedBadges) return;

  const script = document.currentScript;
  const BASE = script ? new URL('.', script.src).href.replace(/\/$/, '') : location.protocol + '//' + location.hostname + ':8780';
  const SELECTOR = '[data-owned-artist]';
  const cache = new Map();     // clave -> resultado
  const pending = new Map();   // clave -> [elementos esperando]
  let timer = null;

  const css = `
.ob-icons{display:inline-flex;gap:3px;align-items:center;vertical-align:middle;margin-left:4px;
  font:700 9px/1 system-ui,sans-serif;letter-spacing:0;text-transform:none}
.ob-i{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:15px;
  padding:0 3px;border-radius:4px;border:1px solid currentColor;box-sizing:border-box;cursor:default;white-space:nowrap}
.ob-i.off{opacity:.28;background:transparent!important;color:#888!important;border-color:#888}
.ob-air{background:#3fb950;border-color:#3fb950;color:#05200c}
.ob-qb{background:#f0883e;border-color:#f0883e;color:#2b1302}
.ob-lfm{background:#58a6ff;border-color:#58a6ff;color:#04182e}
.ob-mix{background:#bc8cff;border-color:#bc8cff;color:#1e0b38}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function keyOf(el) {
    return (el.dataset.ownedArtist || '').trim().toLowerCase() + '\u0001' +
           (el.dataset.ownedAlbum || '').trim().toLowerCase();
  }

  function icon(cls, label, on, title) {
    return `<span class="ob-i ${cls}${on ? '' : ' off'}" title="${title}">${label}</span>`;
  }

  function html(r, isArtist) {
    const what = isArtist ? 'del artista' : '';
    const parts = [];
    if (r.airsonic !== null)
      parts.push(icon('ob-air', 'A', r.airsonic, r.airsonic ? `En Airsonic ${what}` : `No está en Airsonic ${what}`));
    if (r.qbittorrent !== null)
      parts.push(icon('ob-qb', 'qB', r.qbittorrent, r.qbittorrent ? `En qBittorrent ${what}` : `No está en qBittorrent ${what}`));
    if (r.listened !== null) {
      const p = r.listened.plays;
      parts.push(icon('ob-lfm', p ? '♫' + p : '♫', p > 0,
        p ? `Escuchado ${p} ${p === 1 ? 'vez' : 'veces'}${r.listened.last ? ' · última: ' + r.listened.last : ''}` : 'Sin escuchas'));
    }
    if (r.mix !== null)
      parts.push(icon('ob-mix', r.mix ? 'M' + r.mix : 'M', r.mix > 0,
        r.mix ? `En Mix: ${r.mix} ${r.mix === 1 ? 'tema' : 'temas'}` : 'No está en Mix'));
    return parts.join('');
  }

  function paint(el, r) {
    const target = el.querySelector('[data-owned-slot]') || el;
    let box = target.querySelector(':scope > .ob-icons');
    if (!box) {
      box = document.createElement('span');
      box.className = 'ob-icons';
      target.appendChild(box);
    }
    box.innerHTML = html(r, !(el.dataset.ownedAlbum || '').trim());
    el.__obKey = keyOf(el);
  }

  async function flush() {
    timer = null;
    const keys = [...pending.keys()].slice(0, 200);
    if (!keys.length) return;
    const items = keys.map(k => { const [artist, album] = k.split('\u0001'); return { artist, album }; });
    let results = [];
    try {
      const r = await fetch(BASE + './api/owned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
      });
      results = (await r.json()).results || [];
    } catch (e) {
      keys.forEach(k => pending.delete(k));
      return;
    }
    keys.forEach((k, i) => {
      const r = results[i];
      const els = pending.get(k) || [];
      pending.delete(k);
      if (!r) return;
      cache.set(k, r);
      els.forEach(el => { if (el.isConnected && keyOf(el) === k) paint(el, r); });
    });
    if (pending.size) timer = setTimeout(flush, 0);
  }

  function handle(el) {
    if (!(el.dataset.ownedArtist || '').trim()) return;
    const k = keyOf(el);
    if (el.__obKey === k && el.querySelector('.ob-icons')) return;
    if (cache.has(k)) { paint(el, cache.get(k)); return; }
    if (!pending.has(k)) pending.set(k, []);
    pending.get(k).push(el);
    if (!timer) timer = setTimeout(flush, 120);
  }

  function scan(root) {
    const r = root || document;
    if (r.matches && r.matches(SELECTOR)) handle(r);
    if (r.querySelectorAll) r.querySelectorAll(SELECTOR).forEach(handle);
  }

  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') { handle(m.target); continue; }
      m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList.contains('ob-icons')) scan(n); });
      // La app reescribió el contenido de un elemento ya marcado: repintar
      const owner = m.target.closest && m.target.closest(SELECTOR);
      if (owner) handle(owner);
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-owned-artist', 'data-owned-album'],
  });

  window.OwnedBadges = {
    scan: () => scan(document),
    refresh: () => { cache.clear(); document.querySelectorAll(SELECTOR).forEach(el => { el.__obKey = null; }); scan(document); },
  };
  scan(document);
})();
