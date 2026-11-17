# Lista de faltantes: los mismos 80 que se grabaron. Portadas: nombre por artista|disco (la ruta no sale de casa).
import re
from urllib.parse import parse_qs, urlsplit
f = out / map['api/albums/missing']
f.write_text(json.dumps(sorted(json.loads(f.read_text()), key=lambda a: -a['added_at'])[:80], ensure_ascii=False))
for k in [k for k in map if k.startswith('api/albums/cover?')]:
    q = parse_qs(urlsplit('/' + k).query)
    name = 'data/cv-' + fnv((q.get('artist', [''])[0]) + '|' + (q.get('album', [''])[0])) + '.jpg'
    src = out / map[k]
    try:
        # Miniatura: la portada original pesa demasiado para una demo.
        from PIL import Image
        im = Image.open(src).convert('RGB')
        im.thumbnail((160, 160))
        im.save(out / name, 'JPEG', quality=72)
        src.unlink()
    except Exception:
        src.unlink(missing_ok=True)
    del map[k]

def patch_html(html):
    js = ("function coverUrl(row, pathKey='path') {\n  return 'data/cv-' + __fnv((row.artist||'') + '|' + (row.title||'')) + '.jpg';\n}\n"
          "function __fnv(t){let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}")
    html = re.sub(r"function coverUrl\(row, pathKey='path'\) \{.*?\n\}", lambda m: js, html, count=1, flags=re.S)
    return re.sub(r"`\./api/albums/cover\?path=\$\{encodeURIComponent\(cvPath\)\}&artist=\$\{encodeURIComponent\(r\.artist\|\|''\)\}&album=\$\{encodeURIComponent\(r\.title\|\|''\)\}`",
                  "coverUrl(r)", html)

# Listas de «explorar»: como mucho 40 discos por entrada y, en las vistas, solo las entradas grabadas.
from urllib.parse import parse_qs as _pq
abiertas = {}
for k in map:
    if k.startswith('api/explore/albums?'):
        q = _pq(urlsplit('/' + k).query)
        abiertas.setdefault(q['view'][0], set()).add(q['name'][0])
        p = out / map[k]
        p.write_text(json.dumps(json.loads(p.read_text())[:40], ensure_ascii=False))
for k in map:
    m = re.match(r'api/explore\?view=(\w+)$', k)
    if m:
        p = out / map[k]
        p.write_text(json.dumps([r for r in json.loads(p.read_text()) if r.get('name') in abiertas.get(m.group(1), ())], ensure_ascii=False))
