# Fuera los artículos que vienen de feeds de torrents (sus enlaces de descarga llevan credenciales,
# a veces en la propia ruta). Se recorre todo: freshrss y wallabag son diccionarios de listas.
def limpia(o):
    if isinstance(o, list):
        return [limpia(x) for x in o if not (isinstance(x, dict) and 'torrent' in json.dumps(x).lower())]
    if isinstance(o, dict):
        return {k: limpia(v) for k, v in o.items() if not ('torrent' in k.lower())}
    return o

for k, f in map.items():
    if k.startswith('api/articles_data.json'):
        p = out / f
        p.write_text(json.dumps(limpia(json.loads(p.read_text())), ensure_ascii=False))
