# Deja en /api/artists solo los artistas cuyos discos se grabaron.
import re
ids = {int(m.group(1)) for k in map for m in [re.match(r'api/artists/(\d+)/albums$', k)] if m}
f = out / map['api/artists']
f.write_text(json.dumps([a for a in json.loads(f.read_text()) if a['id'] in ids], ensure_ascii=False))
