// Historial de análisis y el detalle de los 6 más recientes.
const h = await (await fetch('/api/history')).json();
for (const it of h.slice(0, 6)) await fetch(`/api/history/${it.id}`);
return h.length;
