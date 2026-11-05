// Catálogo del índice: lo único que hay que tocar para añadir o cambiar un módulo.
// kind: 'public' = tiene versión pública real; 'sim' = solo se muestra una simulación.
const GH = 'https://github.com/volteret4/';
const PAGES = 'https://volteret4.github.io/';

export const GROUPS = ['Adquisición', 'Ampliando', 'Escarbando', 'Info', 'Herramientas', 'Otros'];

export const MODULES = [
  // ── Adquisición
  {id: 'dieta-sonora', label: 'Dieta Sonora', group: 'Adquisición', kind: 'public', short: 'Los lanzamientos de tus artistas, pendientes de escuchar',
    what: 'Reúne en una sola pantalla los discos nuevos de los artistas que sigues, con portada y dónde escucharlos, y te deja marcar los que ya tienes o has escuchado.',
    detail: 'La versión pública guarda todo en la base de datos de tu navegador y obtiene los discos de tu cuenta de Muspy, sin calendario. La local añade descargas desde tu NAS de música compartida y comprueba qué tienes ya en Airsonic y qBittorrent.',
    try: [{label: 'Probar la versión pública', url: './dieta-sonora/'}], repos: [{label: 'dieta-sonora', url: GH + 'dieta-sonora'}], profile: 'dieta_sonora'},
  {id: 'bandcamp', label: 'Bandcamp', group: 'Adquisición', kind: 'public', short: 'Los correos de Bandcamp convertidos en una web de escucha',
    what: 'Lee los avisos de Bandcamp de tu buzón por IMAP y genera una web con el reproductor de cada disco, organizada por género.',
    detail: 'La versión pública es la colección ya generada. La local lee tu propio correo y se actualiza sola.',
    try: [{label: 'Probar la versión pública', url: PAGES + 'bancamp_imap/'}], repos: [{label: 'bancamp_imap', url: GH + 'bancamp_imap'}], profile: 'bandcamp'},
  {id: 'freshrss', label: 'FreshRSS', group: 'Adquisición', kind: 'public', short: 'La música enlazada en tus feeds, lista para reproducir',
    what: 'Recorre tus feeds de FreshRSS, saca los enlaces de Bandcamp, YouTube y SoundCloud, y crea una página de reproductores por feed o categoría.',
    detail: 'La versión pública muestra los feeds ya procesados. La local se conecta a tu servidor FreshRSS.',
    try: [{label: 'Probar la versión pública', url: PAGES + 'freshrss_embeeds/'}], repos: [{label: 'freshrss_embeeds', url: GH + 'freshrss_embeeds'}], profile: 'freshrss'},
  {id: 'charts', label: 'Sello | Artist Chart', group: 'Adquisición', kind: 'public', short: 'El catálogo de un sello o la discografía de un artista',
    what: 'Escribes el nombre de un sello o de un artista y ves todo lo publicado como un mosaico de portadas, con vídeos e información de Last.fm.',
    detail: 'Cruza MusicBrainz y Discogs. La versión pública guarda las búsquedas en tu navegador y usa tus propias claves. Las locales son más rápidas porque trabajan desde un servidor con yt-dlp.',
    try: [{label: 'Probar charts de sellos', url: PAGES + 'charts-web/sellos/'}, {label: 'Probar charts de artistas', url: PAGES + 'charts-web/artistas/'}],
    repos: [{label: 'charts_sellos', url: GH + 'charts_sellos'}, {label: 'charts_artistas', url: GH + 'charts_artistas'}, {label: 'charts-web (versión pública)', url: GH + 'charts-web'}], profile: 'charts_sellos, charts_artistas'},
  {id: 'charts-nas', label: 'Charts del NAS', group: 'Adquisición', kind: 'sim', short: 'Colecciones del NAS de música compartida, con vídeo',
    what: 'Muestra como mosaico las colecciones y búsquedas de un NAS de música compartida, con vídeos y qué discos tienes ya.',
    demo: 'charts-nas', repos: []},

  // ── Ampliando
  {id: 'musthear', label: 'Musthear', group: 'Ampliando', kind: 'public', short: 'Discos imprescindibles según miles de listas',
    what: 'Explora colecciones de discos imprescindibles por género y época. La versión local las cruza con tus escuchas de Last.fm para enseñarte los que aún no conoces.',
    detail: 'La versión pública solo permite explorar las colecciones.',
    try: [{label: 'Probar la versión pública', url: PAGES + 'must_hear/'}], repos: [{label: 'escuchowsky', url: GH + 'escuchowsky'}], profile: 'escuchowsky'},
  {id: 'tumtumpa', label: 'Tumtumpá', group: 'Ampliando', kind: 'public', short: 'Blog de opiniones sobre discos',
    what: 'Un blog con opiniones personales sobre discos, hecho con Hugo y publicado como web estática.',
    detail: 'En repeat-one, el nombre también da título a Tumtumpa Discover, que descubre música a partir de tus escuchas y vive en el repo escuchowsky.',
    try: [{label: 'Leer el blog', url: PAGES + 'tumtumpa/'}], repos: [{label: 'tumtumpa', url: GH + 'tumtumpa'}], profile: null},
  {id: 'consejero', label: 'Consejero Mix', group: 'Ampliando', kind: 'sim', short: 'Recomendaciones para pinchar',
    what: 'Una lista de temas para pinchar, con vídeo y enlaces a tiendas, que se afina con tu opinión: 👍, 🤷 o 👎 y una nota sobre el porqué.', demo: 'consejero', repos: []},
  {id: 'escuchowsky', label: 'Escuchowsky', group: 'Ampliando', kind: 'sim', short: 'Compara las escuchas de varios usuarios',
    what: 'Compara las escuchas de varios usuarios de Last.fm por género y te dice qué disfruta cada uno que el otro no conoce.', demo: 'escuchowsky',
    repos: [{label: 'escuchowsky', url: GH + 'escuchowsky'}], profile: 'escuchowsky'},

  // ── Escarbando
  {id: 'sellos', label: 'Sellos & Productores', group: 'Escarbando', kind: 'sim', short: 'Tu colección navegada por sello y productor',
    what: 'Recorre tu colección en tres columnas: sello o productor, artista y disco. Cada elemento abre un panel con su ficha.', demo: 'sellos',
    repos: [{label: 'sellos-discograficos', url: GH + 'sellos-discograficos'}], profile: 'sellos_discograficos'},
  {id: 'gaps', label: 'Discografía Gaps', group: 'Escarbando', kind: 'sim', short: 'Los discos que te faltan de tus artistas',
    what: 'Compara la discografía completa de los artistas que sigues con lo que tienes, y te dice qué falta y dónde conseguirlo.', demo: 'gaps', repos: []},
  {id: 'mapa', label: 'Mapa de Discos', group: 'Escarbando', kind: 'sim', short: 'Tu colección como un mapa navegable',
    what: 'Dibuja un grafo desde un artista hasta sus discos y géneros, y de ahí a otros artistas de tu colección. Marca lo que tienes y lo que te falta.', demo: 'mapa', repos: []},
  {id: 'pendientes', label: 'Discos Pendientes', group: 'Escarbando', kind: 'sim', short: 'Qué falta por escuchar y qué has descargado',
    what: 'Lleva tus discos pendientes desde el calendario: qué has descargado ya, qué has escuchado y qué te queda del catálogo de cada artista.', demo: 'pendientes', repos: []},

  // ── Info
  {id: 'encarta', label: 'Encarta', group: 'Info', kind: 'public', short: 'Todo lo que sabemos de un artista, disco o sello',
    what: 'Una enciclopedia musical de consulta: buscas un artista, disco, canción, sello, género o año y reúne notas, listas, charts y libros en una ficha.',
    detail: 'La versión pública es reducida: solo las fichas con más datos. La local usa la base completa.',
    try: [{label: 'Probar la versión pública', url: PAGES + 'encarta/'}], repos: [{label: 'encarta', url: GH + 'encarta'}], profile: 'encarta'},
  {id: 'grapas', label: 'Grapas Fanzine', group: 'Info', kind: 'public', short: 'Reseñas, entrevistas y artículos',
    what: 'Un fanzine web que reúne reseñas, entrevistas y artículos de los artistas de Encarta, con enlaces a sus fichas.',
    detail: 'La versión pública solo lleva extractos que enlazan al medio original. La local muestra el texto completo, para uso en casa.',
    try: [{label: 'Leer el fanzine', url: PAGES + 'grapa/'}], repos: [{label: 'grapa', url: GH + 'grapa'}], profile: null},

  // ── Herramientas
  {id: 'trasvase', label: 'Trasvase', group: 'Herramientas', kind: 'sim', short: 'Copiar discos entre dos colecciones',
    what: 'Compara dos colecciones de música y copia a la principal los discos que le faltan, con filtros por artista, género o sello.', demo: 'trasvase', repos: []},
  {id: 'clips', label: 'YT Clips', group: 'Herramientas', kind: 'sim', short: 'Recorta y guarda momentos de vídeos',
    what: 'Recorta fragmentos de vídeos de YouTube, los guarda con etiqueta y permite montarlos en un único vídeo.', demo: 'clips', repos: []},
  {id: 'conciertos', label: 'Bot Conciertos', group: 'Herramientas', kind: 'sim', short: 'Conciertos y lanzamientos de tus artistas',
    what: 'Un bot de Telegram que avisa de conciertos y lanzamientos de tus artistas. Su web muestra la agenda y el calendario.', demo: 'conciertos', repos: []},
  {id: 'podcast', label: 'Podcast TTS', group: 'Herramientas', kind: 'sim', short: 'Tus artículos convertidos en podcast',
    what: 'Convierte en audio los artículos que eliges de FreshRSS o Wallabag y los publica en un feed para tu app de podcasts.', demo: 'podcast', repos: []},
  {id: 'tracklist', label: 'Tracklist ID', group: 'Herramientas', kind: 'sim', short: 'Identifica los temas de una sesión',
    what: 'Pegas el enlace de una sesión de YouTube y la analiza por tramos para reconstruir la lista de temas.', demo: 'tracklist', repos: []},
  {id: 'sync', label: 'Artist Sync', group: 'Herramientas', kind: 'sim', short: 'Tus artistas cruzados entre servicios',
    what: 'Cruza tus artistas entre Muspy, Airsonic, qBittorrent y Last.fm, y te deja seguir en Muspy los que faltan.', demo: 'sync', repos: []},
  {id: 'explorador', label: 'Explorador de Escuchas', group: 'Herramientas', kind: 'sim', short: 'Busca en tu historial de escuchas',
    what: 'Filtra todo tu historial de Last.fm y ListenBrainz por fechas, artista, disco, género o sello, con gráficos del resultado.', demo: 'explorador', repos: []},

  // ── Otros
  {id: 'stats', label: 'Dieta Sonora — Estadísticas', group: 'Otros', kind: 'sim', short: 'Cuánto tardas en escuchar lo que sale',
    what: 'Mide el tiempo que pasa desde que sale un disco hasta que lo consigues y lo escuchas, por artista y por género.', demo: 'stats', repos: []},
  {id: 'mixxx', label: 'Mixxx Info', group: 'Otros', kind: 'sim', short: 'Ficha de cada tema para pinchar',
    what: 'Una ficha de cada tema de tu carpeta de Mixxx, con BPM, tonalidad y portada, filtros y un asistente de listas.', demo: 'mixxx', repos: []},
  {id: 'rater', label: 'Mix Rater', group: 'Otros', kind: 'sim', short: 'Puntúa temas en 12 dimensiones',
    what: 'Puntúa cada tema en 12 dimensiones, como alegre o melancólica, y busca después por parecido.', demo: 'rater', repos: []},
  {id: 'flujo', label: 'Flujo Musical', group: 'Otros', kind: 'sim', short: 'De radar a favorito, paso a paso',
    what: 'Un mapa del recorrido de cada artista desde que lo descubres hasta que es un favorito, con la herramienta de cada fase.', demo: 'flujo', repos: []},
  {id: 'playlists', label: 'YT Playlists', group: 'Otros', kind: 'sim', short: 'Listas de YouTube enriquecidas',
    what: 'Sigue canales y listas de YouTube, y marca qué temas tienes ya en tu colección.', demo: 'playlists', repos: []},
];

export const README = GH + 'repeat-one-web#instalación';
