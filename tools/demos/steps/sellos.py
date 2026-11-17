# Listas de sellos/productores/masters: solo los grabados (con ficha), para que todo lo que se vea se pueda abrir.
import re
for t in ('labels', 'producers', 'masters'):
    slugs = {m.group(1) for k in map for m in [re.match(rf'api/groups/{t}/([^/?]+)/artists$', k)] if m}
    for k, f in map.items():
        if re.match(rf'api/groups/{t}(\?|$)', k):
            p = out / f
            p.write_text(json.dumps([g for g in json.loads(p.read_text()) if g['slug'] in slugs], ensure_ascii=False))
