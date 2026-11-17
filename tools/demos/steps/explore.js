// Exploración genérica: pulsa lo visible (pestañas, filas, tarjetas, filtros) como lo haría alguien curioseando.
// Las acciones que cambian algo no llegan al servicio (record.py las contesta sin enviarlas).
const MAX = window.__EXPLORE_MAX || 40;
const NO = /borrar|eliminar|delete|quitar|sincron|sync|actualizar|copiar|descargar|guardar|añadir|crear|subir|upload|escanear|scan|enviar|extraer|analizar|montaje|cerrar sesión|logout|⚙|✕|×/i;
const seen = new Set();
let clicks = 0;
const visible = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).visibility !== 'hidden'; };
for (let round = 0; round < 3 && clicks < MAX; round++) {
  const els = [...document.querySelectorAll('[role=tab], .tab, nav a, nav button, button, li, tr, .card, .item, .row, summary, label, a[href^="#"]')]
    .filter(e => visible(e) && !NO.test(e.textContent) && e.textContent.trim().length < 80 && !e.closest('#replay-banner'));
  for (const e of els) {
    const key = e.tagName + '|' + e.textContent.trim().slice(0, 40);
    if (seen.has(key) || clicks >= MAX) continue;
    seen.add(key);
    try { e.click(); clicks++; await sleep(600); } catch (_) {}
    document.querySelector('[aria-label=Cerrar], .modal-close, .close-btn')?.click();
  }
}
return clicks;
