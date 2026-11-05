// Discos inventados para probar la página sin cuenta de Muspy. Los MBID no existen.
const today = new Date();
const daysAgo = n => new Date(today - n * 864e5).toISOString().slice(0, 10);
const row = (i, artist, name, type, days) => ({mbid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, artist: {name: artist}, name, type, date: daysAgo(days)});

export const SAMPLE = [
  row(1, 'Las Vacas Eléctricas', 'Pasto de Neón', 'Album', 2),
  row(2, 'Turno de Noche', 'Polígono Sur', 'Album', 5),
  row(3, 'Cinta Magnética', 'Lado B', 'EP', 9),
  row(4, 'Hielo Seco', 'Humo de Sala', 'Album', 12),
  row(5, 'Marea Baja', 'Rompeolas', 'Album', 20),
  row(6, 'Radio Faro', 'Onda Media', 'EP', 33),
  row(7, 'Kilómetro Cero', 'Vía de Servicio', 'Album', 41),
  row(8, 'Orquesta del Polígono', 'Música para Naves', 'Album', 60),
];
