# Escuchas del usuario: solo las de artistas que salen en las colecciones grabadas (extracto pequeño
# y las marcas de «escuchado» siguen siendo correctas en lo que se ve). Sin amigos ni otros usuarios.
import re
artistas = set()
norm = lambda s: re.sub(r'[^\w]', '', (s or '').lower())
for k, f in map.items():
    if k.startswith('api/collection?'):
        for a in json.dumps(json.loads((out / f).read_text()), ensure_ascii=False).split('"artist": "')[1:] or []:
            artistas.add(norm(a.split('"')[0]))
        d = json.loads((out / f).read_text())
        for al in (d.get('albums') if isinstance(d, dict) else d) or []:
            if isinstance(al, dict):
                artistas.add(norm(al.get('artist')))
for k in [k for k in map if k.startswith('api/scrobbles?')]:
    p = out / map[k]
    eventos = [json.loads(l[6:]) for l in p.read_text().split('\n') if l.startswith('data: ')]
    fin = next((e for e in eventos if e.get('done')), None)
    if not fin:
        p.unlink(); del map[k]; continue
    fin['heard'] = [h for h in fin.get('heard', []) if norm(h.get('artist') if isinstance(h, dict) else (h[0] if isinstance(h, list) else str(h).split('\x01')[0])) in artistas]
    for x in ('last_scrobble_artist', 'last_scrobble_track'):
        fin.pop(x, None)
    p.write_text(f'data: {json.dumps({"page": 1, "total_pages": 1, "count": len(fin["heard"])})}\n\ndata: {json.dumps(fin, ensure_ascii=False)}\n\n')
for k in [k for k in map if k.startswith(('api/friends', 'api/scrobbles/'))]:
    (out / map[k]).unlink(); del map[k]

def patch_html(html):
    # El usuario de la demo viene puesto.
    return html.replace('<input id="inp-user" type="text"', '<input id="inp-user" type="text" value="paqueradejere"', 1)
