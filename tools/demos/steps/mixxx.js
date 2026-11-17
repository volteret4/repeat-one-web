// 8 carpetas de Mixxx una a una (cada una pide sus temas), y las vistas de estadísticas y relaciones (la de portadas pesa demasiado).
const boxes = [...document.querySelectorAll('input[type=checkbox]')].filter(b => !/^\./.test(b.closest('label')?.textContent.trim() || b.parentElement.textContent.trim()));
const pick = boxes.filter((_, i) => i % Math.max(1, Math.floor(boxes.length / 8)) === 0).slice(0, 8);
for (const b of pick) { b.click(); await sleep(1500); b.click(); await sleep(400); }
pick[0]?.click(); await sleep(1500);
for (const t of ['Estadísticas', 'Relaciones']) {
  const btn = [...document.querySelectorAll('button')].find(e => e.textContent.includes(t));
  if (btn) { btn.click(); await sleep(2000); btn.click(); await sleep(500); }
}
const pl = [...document.querySelectorAll('li, div')].find(e => e.textContent.trim().startsWith('test') && e.children.length < 4);
pl?.click(); await sleep(1200);
return pick.length;
