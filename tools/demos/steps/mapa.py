# Coherencia del extracto: búsquedas y géneros solo con artistas grabados, y todos los grabados encontrables.
import re
art = {}
for k, f in map.items():
    m = re.match(r'api/artist/(\d+)$', k)
    if m:
        art[int(m.group(1))] = json.loads((out / f).read_text())
for k, f in list(map.items()):
    p = out / f
    if k.startswith('api/search'):
        p.write_text(json.dumps([it for it in json.loads(p.read_text()) if it.get('artist_id') in art], ensure_ascii=False))
    elif k.startswith('api/genre'):
        g = json.loads(p.read_text())
        g['artists'] = [a for a in g.get('artists', []) if a.get('id') in art]
        g['total'] = len(g['artists'])
        p.write_text(json.dumps(g, ensure_ascii=False))
# Una búsqueda "comodín" con todos los artistas grabados y sus discos: replay.js filtra por el texto.
todos = []
for i, a in art.items():
    todos.append({'artist_id': i, 'label': a['artist']['name'], 'state': a['artist'].get('state'), 'type': 'artist'})
    for al in a.get('albums', []):
        if al.get('state'):
            todos.append({'album_key': al['key'], 'artist': a['artist']['name'], 'artist_id': i, 'label': al['title'], 'state': al['state'], 'type': 'album'})
(out / 'data/search-all.json').write_text(json.dumps(todos, ensure_ascii=False))
map['api/search?q='] = 'data/search-all.json'
