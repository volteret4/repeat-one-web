# Demos con datos reales

Cada carpeta `demo/<módulo>/` es la web real de un servicio local de REPEAT-ONE grabada con
un extracto de datos: `demo/_replay/replay.js` contesta sus llamadas a la API con lo grabado,
y lo que cambiaría algo (guardar, borrar, sincronizar) solo muestra un aviso.

## Grabar

Necesitas Playwright con Chromium y un túnel a los servicios de pepecono:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -L 8758:127.0.0.1:8758 -L 5023:127.0.0.1:5023 -L 8779:127.0.0.1:8779 -L 8773:127.0.0.1:8773 -L 5020:127.0.0.1:5020 -L 8774:127.0.0.1:8774 -L 8759:127.0.0.1:8759 -L 5024:127.0.0.1:5024 -L 8771:127.0.0.1:8771 -L 8768:127.0.0.1:8768 -L 8755:127.0.0.1:8755 -L 8772:127.0.0.1:8772 -L 5021:127.0.0.1:5021 -L 8751:127.0.0.1:8751 -L 8753:127.0.0.1:8753 -L 8776:127.0.0.1:8776 -L 5022:127.0.0.1:5022 -L 8747:127.0.0.1:8747 -L 8794:127.0.0.1:8794 -L 8780:127.0.0.1:8780 pepecono
```

```bash
tools/demos/grabar_todo.sh
```

```bash
tools/demos/grabar_todo.sh mapa gaps
```

Discos Olvidados no está desplegado en pepecono: arráncalo en local en el puerto 8775 con
`LASTFM_DB`, `MUSICA_LOCAL_DB` y `TRASVASE_DB` apuntando a copias de sus bases de datos.

Antes de publicar, siempre:

```bash
tools/demos/revisar.py
```

## Qué no sale de casa

- Ninguna petición que no sea GET llega al servicio, ni los GET que lanzan trabajo (sync, scan…).
- El panel ⚙ (`/api/settings`) no se graba.
- `record.py` borra rutas, IPs, nombres de equipos y credenciales en URLs de todo lo guardado.
- Por módulo (`steps/*.py`): sin usuarios de Telegram ni de Last.fm de otras personas, sin
  artículos de feeds de torrents, portadas renombradas para que no lleven la ruta.
- `revisar.py` busca claves, rutas, IPs y correos en el resultado y falla si encuentra algo.

## Tamaño

Extractos pequeños: el objetivo es ~1 MB por demo. Cada `steps/<módulo>.js` elige qué grabar
(p. ej. 60 artistas en Gaps, 80 discos en Trasvase) y `--trim N` recorta las listas largas.
