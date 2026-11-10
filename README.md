# REPEAT-ONE

Herramientas para encontrar, ordenar y escuchar música. Cada una es un repo independiente; este reúne:

- **El índice público**: <https://volteret4.github.io/repeat-one-web/>. Pulsa un módulo para saber qué hace, probarlo y llegar a su repo.
- **Dieta Sonora para navegador**, en [`dieta-sonora/`](dieta-sonora/): guarda los datos en tu navegador y obtiene los discos de Muspy.
- **Simulaciones**, en [`demo/`](demo/), de los módulos sin versión pública. Usan datos inventados y no se conectan a nada.
- **El instalador**, que levanta en tu servidor los módulos que elijas.

## Módulos instalables

| Módulo | Qué hace | Repo | Puerto |
|---|---|---|---|
| `dieta_sonora` | Lanzamientos de Muspy, con descargas desde tu NAS de música compartida | [dieta-sonora](https://github.com/volteret4/dieta-sonora) | 5010 |
| `bandcamp` | Web de escucha a partir de tus correos de Bandcamp | [bancamp_imap](https://github.com/volteret4/bancamp_imap) | 8765 |
| `freshrss` | Reproductores de la música enlazada en tus feeds | [freshrss_embeeds](https://github.com/volteret4/freshrss_embeeds) | 8766 |
| `charts_sellos` | Catálogo de un sello | [charts_sellos](https://github.com/volteret4/charts_sellos) | 8792 |
| `charts_artistas` | Discografía de un artista | [charts_artistas](https://github.com/volteret4/charts_artistas) | 8793 |
| `escuchowsky` | Escuchowsky, Musthear y Tumtumpa Discover | [escuchowsky](https://github.com/volteret4/escuchowsky) | 8751, 8752, 8753 |
| `encarta` | Enciclopedia musical de consulta | [encarta](https://github.com/volteret4/encarta) | 8777 |
| `sellos_discograficos` | Tu colección por sello y productor | [sellos-discograficos](https://github.com/volteret4/sellos-discograficos) | 8758 |
| `scheduler` | Tareas diarias con Ofelia | | |

Los módulos que el índice muestra solo como simulación y sin repo no están publicados, así que no se pueden instalar.

## Instalación

Necesitas Docker con el plugin `docker compose`, `git`, `python3` y `bash` 4 o superior.

```bash
git clone https://github.com/volteret4/repeat-one-web.git
```

```bash
cd repeat-one-web && scripts/up.sh
```

El asistente te enseña los módulos y eliges por número. Para cada uno:

1. Clona su repo en `services/`, o lo actualiza si ya está.
2. Crea su `.env` a partir de `.env.example` y te pregunta las variables principales. Con Intro las omites. Lo que respondas se guarda en el `.env` raíz para no repetirlo en otros módulos. El resto de opciones están en el `.env` de cada módulo.
3. Construye y arranca los contenedores, y te muestra las direcciones.

También puedes elegir sin menú:

```bash
scripts/up.sh --list
```

```bash
scripts/up.sh --yes --profile dieta_sonora --profile charts_sellos
```

Y usar cualquier otro subcomando de `docker compose`:

```bash
scripts/up.sh --profile dieta_sonora logs -f
```

```bash
scripts/up.sh --profile dieta_sonora down
```

### Instalador web

Si prefieres una página a las preguntas de la terminal:

```bash
scripts/instalar.sh
```

Comprueba los requisitos y, si falta algo, te da el enlace a su guía de instalación. Luego abre una web en `127.0.0.1` (primer puerto libre desde el 8799, con un token en el enlace). En un servidor sin navegador, ábrela con el túnel `ssh -L` que muestra la terminal.

En la web eliges módulos, se clonan los que falten y rellenas sus variables. Se guardan en el `.env` raíz, con copia en `.env.bak-instalador-*`, y en el `.env` de cada módulo. Las claves nunca vuelven al navegador. La web no toca Docker ni su socket: al final te da el comando `scripts/up.sh --yes --profile …` para que lo ejecutes tú.

### Antes de arrancar cada módulo

- **dieta_sonora**: basta con `MUSPY_USERID`. Con `NAS_URL` y `NAS_API_KEY` añade las descargas desde tu NAS de música compartida. Define `WATCH_TORRENTS_HOST_PATH` en el `.env` raíz con la carpeta que vigila tu cliente de torrents. Para poblarlo sin esperar a la tarea diaria: `docker exec dieta-sonora bash main.sh`.
- **bandcamp** y **freshrss**: necesitan tu buzón IMAP o tu servidor FreshRSS. Sus README explican los formatos.
- **charts_sellos** y **charts_artistas**: funcionan sin claves, con menos datos. Si YouTube bloquea `yt-dlp`, deja un `cookies.txt` en la carpeta `data/` del módulo.
- **escuchowsky**: `musthear` y `escuchowsky` necesitan `services/escuchowsky/db/must_hear.db`. Esa base no se distribuye; sin ella esas dos webs no tienen datos.
- **encarta**: necesita `services/encarta/data/encarta.db`, que se construye con `build.py` a partir de tus fuentes. Mira su README.
- **sellos_discograficos**: necesita tu base en `services/sellos-discograficos/musica_local.sqlite`. El instalador crea el fichero vacío para que Docker no lo monte como carpeta: sustitúyelo por el tuyo.
- **scheduler**: monta el socket de Docker para lanzar las tareas de los demás contenedores. Elígelo solo si confías en lo que corre en esa máquina.

### Seguridad

Son herramientas para tu red local: casi ninguna tiene usuarios ni contraseña. No las expongas a internet sin un proxy con autenticación por delante. Dieta Sonora, por ejemplo, maneja tus enlaces de descarga personales.

Los `.env` se crean con permisos `600` y están ignorados por git. No los subas.

## Desarrollo

El índice y Dieta Sonora para navegador son HTML, CSS y JavaScript sin dependencias ni compilación. El catálogo del índice está en [`modules.js`](modules.js).

```bash
python3 -m http.server 8000
```

```bash
node --test test/
```

### Dieta Sonora para navegador

Muspy no envía cabeceras CORS, así que la página no puede pedirle datos directamente. Los discos llegan de dos formas, sin pedirte la contraseña:

- **Un marcador** que se ejecuta dentro de muspy.com con tu sesión y envía los lanzamientos solo a esta página.
- **Importando un archivo**: el JSON de `https://muspy.com/api/1/releases/<tu-id>` o el feed Atom.

Los discos, tu estado de cada uno y las claves opcionales de YouTube y Last.fm se guardan únicamente en tu navegador. Todas las páginas de `volteret4.github.io` comparten origen y por tanto almacenamiento: usa claves propias y restríngelas.

## Licencia

Sin licencia por ahora: el código se puede leer, pero no concede permisos de reutilización.
