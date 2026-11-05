// Común a todas las simulaciones: aviso permanente y datos inventados.
const SIM = (() => {
  const artists = ['Las Vacas Eléctricas', 'Turno de Noche', 'Cinta Magnética', 'Hielo Seco', 'Marea Baja', 'Radio Faro', 'Kilómetro Cero', 'Orquesta del Polígono', 'Sala Verde', 'Nocturno Ribera', 'Los Topes', 'Nave Nueve'];
  const labels = ['Sello Polvo', 'Discos Tranvía', 'Nave 9 Records', 'Cinta Roja', 'Faro Sonoro', 'Planta Baja'];
  const genres = ['Techno', 'House', 'Post-punk', 'Ambient', 'Dub', 'Shoegaze'];
  const titles = ['Pasto de Neón', 'Polígono Sur', 'Lado B', 'Humo de Sala', 'Rompeolas', 'Onda Media', 'Vía de Servicio', 'Música para Naves', 'Clorofila', 'Orilla Izquierda', 'Diez', 'Compás Nueve'];
  const albums = artists.map((artist, i) => ({artist, title: titles[i], label: labels[i % labels.length], genre: genres[i % genres.length], year: 2026 - (i % 5), bpm: 118 + i * 3, key: `${(i % 12) + 1}${i % 2 ? 'A' : 'B'}`}));
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const cover = (s, size = 120) => {
    const h = hash(s), a = h % 360, b = (a + 40 + h % 90) % 360, k = 20 + h % 45;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${a},45%,22%)"/><circle cx="${k + 15}" cy="${90 - k}" r="${k}" fill="hsl(${b},60%,52%)"/><rect y="${h % 70}" width="100" height="5" fill="hsl(${a},25%,80%)" opacity=".55"/></svg>`;
    return `<img class="cv" alt="" width="${size}" height="${size}" src="data:image/svg+xml,${encodeURIComponent(svg)}">`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  let timer;
  const toast = msg => {
    const t = document.getElementById('sim-toast');
    t.textContent = msg || 'Simulación: en el despliegue local esto haría la acción de verdad. Aquí no se guarda nada.';
    t.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { t.hidden = true; }, 3200);
  };
  return {artists, labels, genres, albums, cover, esc, toast};
})();

document.addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('div');
  b.id = 'sim-banner';
  b.setAttribute('role', 'note');
  b.innerHTML = '<span>⚠️ <b>Simulación del despliegue local.</b> Datos inventados: esta página no se conecta a ningún servicio y no guarda cambios.</span><a href="../#' + document.body.dataset.mod + '">← Volver al índice</a>';
  document.body.prepend(b);
  const t = document.createElement('div');
  t.id = 'sim-toast';
  t.hidden = true;
  t.setAttribute('role', 'status');
  document.body.append(t);
  // Cualquier botón sin comportamiento propio avisa en lugar de parecer roto.
  document.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn && !btn.dataset.ui) SIM.toast();
  });
});
