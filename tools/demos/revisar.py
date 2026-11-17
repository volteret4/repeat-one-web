#!/usr/bin/env python3
"""Revisa las demos antes de publicarlas: nada de claves, rutas ni nombres de la red de casa.

  revisar.py            # todas las carpetas demo/<mod>/
Sale con código 1 si encuentra algo.
"""
import re
import sys
from pathlib import Path

DEMO = Path(__file__).resolve().parents[2] / 'demo'
CHECKS = [
    ('clave hex de 32', re.compile(r'(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])')),
    ('campo sensible', re.compile(r'"(?:api_?key|lfm_key|token|secret|password|passwd|chat_id|cookie|auth)"\s*:\s*"[^"]{6,}', re.I)),
    ('ruta de casa', re.compile(r'(?:/mnt|/home|/media|/srv|/volume\d*)/[^\s"\'<>]+|%2F(?:mnt|home|media)%2F', re.I)),
    ('red de casa', re.compile(r'\b(?:192\.168|10\.\d{1,3})\.\d{1,3}\.\d{1,3}\b|\bpepe-?cono\b|duckdns\.org|\bpollete\b', re.I)),
    ('correo', re.compile(r'\b[\w.+-]+@(?:gmail|disroot|hotmail|outlook|yahoo|proton)\.\w+', re.I)),
]
# Hex de 32 que no son claves: ids de imágenes de Last.fm y MBID sin guiones en URLs de portadas.
ALLOW = re.compile(r'(?:msclkid|fbclid|gclid|utm_[a-z]+)=[0-9a-zA-Z_-]+|"author":\s*"[^"]*"|lastfm[^"\s]*/[0-9a-f]{32}|i/u/[^"\s]*[0-9a-f]{32}|2a96cbd8b46e442fc41c2b86b821562f')

bad = 0
for d in sorted(p for p in DEMO.iterdir() if p.is_dir() and not p.name.startswith(('_', 'raw-'))):
    for f in d.rglob('*'):
        if not f.is_file() or f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.woff', '.woff2', '.mp3'):
            continue
        text = f.read_text('utf-8', 'replace')
        clean = ALLOW.sub('', text)
        for name, rx in CHECKS:
            for m in rx.finditer(clean):
                ctx = clean[max(0, m.start() - 50):m.end() + 30].replace('\n', ' ')
                print(f'{f.relative_to(DEMO)}: {name}: …{ctx}…')
                bad += 1
                break
print(f'{bad} avisos' if bad else 'Sin avisos.')
sys.exit(1 if bad else 0)
