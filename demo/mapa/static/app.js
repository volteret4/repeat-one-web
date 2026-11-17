/*
 * Mapa de discos: grafo que se despliega a partir de un artista.
 *
 *   artista ──▶ sus álbumes originales
 *           ──▶ [EPs]        ──▶ EPs
 *           ──▶ [Géneros]    ──▶ género ──▶ otros artistas ──▶ ...
 *           ──▶ [Otros tuyos]──▶ discos propios sin ficha en MusicBrainz
 *
 * Cada nodo creado al desplegar otro guarda data.owner = id del que lo
 * desplegó; plegar un nodo borra (recursivamente) todo lo que creó. Los
 * artistas y géneros son únicos en el mapa: si ya están, solo se añade la
 * flecha.
 */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  // Dentro de la pestaña de music-fuzzy (QWebEngineView): los discos
  // propios se pueden abrir en Music Browser. La pestaña escucha los
  // mensajes de consola "mfuz://open?..." (QtWebEngine no deja navegar a
  // esquemas propios sin registrarlos antes de crear la QApplication).
  var EMBED = params.get("embed") === "mfuz";
  var GENRE_PAGE = 12;

  var artistData = new Map();   // artist_id -> respuesta de /api/artist
  var rootArtistId = null;
  var $ = function (id) { return document.getElementById(id); };

  // ── Utilidades ────────────────────────────────────────────────────────
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var pending = 0;
  function api(path) {
    pending++;
    $("loading").style.display = "block";
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + path);
      return r.json();
    }).finally(function () {
      pending--;
      if (!pending) $("loading").style.display = "none";
    });
  }

  function pillWidth(label) {
    var longest = String(label).split("\n").reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    return Math.max(60, longest * 7.2 + 26);
  }

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  }

  /* Prueba las URLs en orden y pone en el nodo la primera que carga
     (Cover Art Archive / Discogs fallan a veces con 404/500). */
  var imageStatus = new Map();   // url -> Promise<boolean>
  function probe(url) {
    if (!imageStatus.has(url)) {
      imageStatus.set(url, new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(true); };
        img.onerror = function () { resolve(false); };
        img.src = url;
      }));
    }
    return imageStatus.get(url);
  }
  function loadImage(node, urls) {
    (urls || []).reduce(function (chain, url) {
      return chain.then(function (done) {
        return done || probe(url).then(function (ok) {
          if (ok && !node.removed()) node.data("image", url);
          return ok;
        });
      });
    }, Promise.resolve(false));
  }

  // ── Estilo del grafo (sale de las variables CSS del tema) ─────────────
  function buildStyle() {
    var bg = css("--bg"), surface = css("--surface"), surface2 = css("--surface-2"), border = css("--border");
    var text = css("--text"), muted = css("--text-muted"), accent = css("--accent"), accent2 = css("--accent-2");
    var success = css("--success"), warning = css("--warning");
    return [
      { selector: "node", style: {
        "label": "data(label)", "color": text, "font-size": 11, "text-wrap": "wrap", "text-max-width": 120,
        "text-valign": "bottom", "text-margin-y": 6, "background-color": surface2,
        "border-width": 1, "border-color": border,
        "text-background-color": bg, "text-background-opacity": 0.7, "text-background-padding": 2,
        "text-background-shape": "roundrectangle" } },
      { selector: "node[image]", style: {
        "background-image": "data(image)", "background-fit": "cover", "background-image-crossorigin": "null" } },
      { selector: "node.artist", style: {
        "shape": "ellipse", "width": 80, "height": 80, "border-width": 3, "border-color": accent,
        "font-size": 13, "font-weight": "bold" } },
      { selector: "node.artist.antiguo", style: { "border-style": "dashed", "border-color": warning } },
      { selector: "node.artist.root", style: { "width": 120, "height": 120, "font-size": 16 } },
      { selector: "node.artist.open", style: { "border-width": 5 } },
      { selector: "node.album", style: { "shape": "round-rectangle", "width": 68, "height": 68 } },
      { selector: "node.album.local", style: { "border-width": 4, "border-color": success } },
      { selector: "node.album.antiguo", style: { "border-width": 3, "border-color": warning, "border-style": "dashed" } },
      { selector: "node.album.missing", style: {
        "background-image-opacity": 0.3, "color": muted, "border-style": "dotted", "background-color": surface } },
      { selector: "node.album.ep", style: { "width": 54, "height": 54 } },
      { selector: "node.pill", style: {
        "shape": "round-rectangle", "width": "data(w)", "height": 30, "text-valign": "center", "text-margin-y": 0,
        "text-background-opacity": 0, "font-weight": "bold", "font-size": 12 } },
      { selector: "node.hub", style: {
        "background-color": surface, "border-width": 2, "border-style": "dashed", "border-color": accent2 } },
      { selector: "node.hub.open", style: { "border-style": "solid", "background-color": accent2, "color": bg } },
      { selector: "node.genre", style: {
        "background-color": surface, "border-width": 2, "border-color": accent2, "color": accent2 } },
      { selector: "node.genre.open", style: { "background-color": accent2, "color": bg } },
      { selector: "node.more", style: {
        "background-color": surface, "border-width": 1, "border-style": "dashed", "border-color": muted,
        "color": muted, "font-weight": "normal", "height": 24 } },
      { selector: "edge", style: {
        "width": 1.5, "line-color": border, "target-arrow-color": border, "target-arrow-shape": "triangle",
        "curve-style": "bezier", "arrow-scale": 0.9 } },
      { selector: "edge.to-hub", style: { "line-style": "dashed", "line-color": accent2, "target-arrow-color": accent2 } },
      { selector: "edge.to-artist", style: { "width": 2, "line-color": accent2, "target-arrow-color": accent2 } },
      { selector: "edge.to-genre", style: { "line-color": accent2, "target-arrow-color": accent2 } },
      { selector: "node:selected", style: { "overlay-color": accent, "overlay-opacity": 0.2, "overlay-padding": 8 } },
      { selector: "node.focus", style: { "underlay-color": accent, "underlay-opacity": 0.55, "underlay-padding": 10 } },
      { selector: ".faded", style: { "opacity": 0.18 } },
    ];
  }

  var cy = cytoscape({
    container: $("cy"),
    style: buildStyle(),
    wheelSensitivity: 0.3,
    minZoom: 0.1,
    maxZoom: 2.5,
    boxSelectionEnabled: false,
  });

  new MutationObserver(function () { cy.style(buildStyle()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ── Construcción del mapa ─────────────────────────────────────────────
  function addEdge(source, target, cls, owner) {
    var id = "e:" + source + ">" + target;
    if (cy.getElementById(id).nonempty()) return;
    cy.add({ group: "edges", data: { id: id, source: source, target: target, owner: owner }, classes: cls });
  }

  function arc(center, n, dir, spread, radius) {
    var out = [];
    for (var j = 0; j < n; j++) {
      var ang = n === 1 ? dir : dir - spread / 2 + (j * spread) / (n - 1);
      out.push({ x: center.x + radius * Math.cos(ang), y: center.y + radius * Math.sin(ang) });
    }
    return out;
  }

  /* Coloca n hijos alrededor de `parent`: en círculo si no tiene padre, o
     en abanico. El abanico se orienta hacia donde menos choca con lo que ya
     hay en el mapa (prefiriendo "hacia fuera", lejos de quien lo desplegó). */
  var MIN_GAP = 130;
  function childPositions(parent, n) {
    var p = parent.position();
    var owner = parent.data("owner") ? cy.getElementById(parent.data("owner")) : null;
    if (!owner || owner.empty()) {
      var radius = Math.max(190, (n * 105) / (2 * Math.PI));
      var ring = [];
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        ring.push({ x: p.x + radius * Math.cos(a), y: p.y + radius * Math.sin(a) });
      }
      return ring;
    }
    var others = cy.nodes().not(parent).map(function (nd) { return nd.position(); });
    var o = owner.position();
    var outward = Math.atan2(p.y - o.y, p.x - o.x);
    var spread = Math.min(Math.PI * 1.25, Math.max(Math.PI / 4, n * 0.32));
    var baseR = Math.max(170, (n * 100) / spread);
    var best = null;
    [1, 1.45, 1.9].forEach(function (scale) {
      for (var k = 0; k < 24; k++) {
        var dir = outward + (k * Math.PI) / 12;
        var pos = arc(p, n, dir, spread, baseR * scale);
        var penalty = 0;
        pos.forEach(function (q) {
          others.forEach(function (e) {
            var d = Math.hypot(q.x - e.x, q.y - e.y);
            if (d < MIN_GAP) penalty += (MIN_GAP - d) * (MIN_GAP - d);
          });
        });
        // Desempate: mejor hacia fuera y lo más cerca posible del padre
        var turn = Math.abs(Math.atan2(Math.sin(dir - outward), Math.cos(dir - outward)));
        var score = penalty + turn * 400 + (scale - 1) * 3000;
        if (!best || score < best.score) best = { score: score, pos: pos };
      }
    });
    return best.pos;
  }

  /* Añade los nodos `specs` como hijos de `parent`, con animación desde el
     padre. Los que ya existen en el mapa solo reciben la flecha. */
  function addChildren(parent, specs, edgeClassFor) {
    var targets = childPositions(parent, specs.length);
    var start = parent.position();
    var added = cy.collection();
    cy.batch(function () {
      specs.forEach(function (spec, i) {
        var existing = cy.getElementById(spec.data.id);
        if (existing.empty()) {
          spec.data.owner = parent.id();
          var node = cy.add({ group: "nodes", data: spec.data, classes: spec.classes, position: { x: start.x, y: start.y } });
          node.scratch("_target", targets[i]);
          loadImage(node, spec.images);
          added = added.union(node);
        }
        addEdge(parent.id(), spec.data.id, edgeClassFor(spec), parent.id());
      });
    });
    added.forEach(function (node) {
      node.animate({ position: node.scratch("_target") }, { duration: 380, easing: "ease-out-cubic" });
    });
    setTimeout(function () {
      var visible = parent.closedNeighborhood().nodes();
      cy.animate({ fit: { eles: visible, padding: 70 } }, { duration: 350 });
    }, 400);
    return added;
  }

  function collapse(node) {
    var id = node.id();
    cy.nodes().filter(function (n) { return n.data("owner") === id; }).forEach(function (child) {
      collapse(child);
    });
    cy.remove(cy.elements().filter(function (el) { return el.data("owner") === id; }));
    node.removeClass("open");
  }

  function albumNode(artistId, release, isEp) {
    var states = { local: "local", antiguo: "antiguo" };
    var label = shorten(release.title, 38) + (release.year ? "\n" + release.year : "");
    var data = { id: "rel:" + artistId + ":" + release.key, label: label, kind: "album",
                 artistId: artistId, release: release };
    return { data: data, images: release.covers, classes: "album " + (states[release.state] || "missing") + (isEp ? " ep" : "") };
  }

  function pillNode(id, label, cls, extra) {
    var data = Object.assign({ id: id, label: label, w: pillWidth(label) }, extra || {});
    return { data: data, classes: "pill " + cls };
  }

  function artistNode(artist, countLabel) {
    var label = shorten(artist.name, 30) + (countLabel ? "\n" + countLabel : "");
    var data = { id: "ar:" + artist.id, label: label, kind: "artist", artistId: artist.id, name: artist.name };
    return { data: data, images: artist.images, classes: "artist" + (artist.state === "antiguo" ? " antiguo" : "") };
  }

  function loadArtist(artistId) {
    if (artistData.has(artistId)) return Promise.resolve(artistData.get(artistId));
    return api("./api/artist/" + artistId).then(function (data) {
      artistData.set(artistId, data);
      return data;
    });
  }

  function expandArtist(node) {
    var artistId = node.data("artistId");
    return loadArtist(artistId).then(function (data) {
      if (node.removed() || node.hasClass("open")) return;
      node.addClass("open");
      if (!node.data("image")) loadImage(node, data.artist.images);
      var specs = data.albums.map(function (r) { return albumNode(artistId, r, false); });
      var hubs = [["eps", "EPs", data.eps.length], ["genres", "Géneros", data.genres.length],
                  ["extra", "Otros tuyos", data.extra.length]];
      hubs.forEach(function (h) {
        if (h[2]) specs.push(pillNode("hub:" + artistId + ":" + h[0], h[1] + " (" + h[2] + ")", "hub",
                                      { kind: "hub", hub: h[0], artistId: artistId }));
      });
      addChildren(node, specs, function (spec) { return spec.data.kind === "hub" ? "to-hub" : "to-album"; });
    });
  }

  function expandHub(node) {
    var data = artistData.get(node.data("artistId"));
    if (!data) return;
    node.addClass("open");
    var artistId = node.data("artistId");
    var specs;
    if (node.data("hub") === "genres") {
      specs = data.genres.map(function (g) {
        var label = g.label + (g.count ? " · " + g.count : "");
        return pillNode("ge:" + g.key, label, "genre", { kind: "genre", key: g.key, genreLabel: g.label });
      });
    } else {
      specs = data[node.data("hub")].map(function (r) { return albumNode(artistId, r, node.data("hub") === "eps"); });
    }
    addChildren(node, specs, function (spec) { return spec.data.kind === "genre" ? "to-genre" : "to-album"; });
  }

  function genreArtistSpec(a) {
    var count = a.count ? (a.count === 1 ? "1 disco" : a.count + " discos") : "tag";
    return artistNode(a, count);
  }

  function expandGenre(node, offset) {
    var exclude = rootArtistId != null ? "&exclude=" + rootArtistId : "";
    return api("./api/genre?key=" + encodeURIComponent(node.data("key")) + "&offset=" + (offset || 0) +
               "&limit=" + GENRE_PAGE + exclude).then(function (page) {
      if (node.removed()) return;
      node.addClass("open");
      var specs = page.artists.map(genreArtistSpec);
      var next = page.offset + page.artists.length;
      if (next < page.total) {
        specs.push(pillNode("more:" + page.key + ":" + next, "+" + (page.total - next) + " más", "more",
                            { kind: "more", genreId: node.id(), offset: next }));
      }
      addChildren(node, specs, function (spec) { return spec.data.kind === "artist" ? "to-artist" : "to-more"; });
    });
  }

  function expandMore(node) {
    var genre = cy.getElementById(node.data("genreId"));
    var offset = node.data("offset");
    cy.remove(node);
    if (genre.nonempty()) expandGenre(genre, offset);
  }

  // ── Interacción ───────────────────────────────────────────────────────
  function toggle(node) {
    var kind = node.data("kind");
    if (kind === "more") return expandMore(node);
    if (kind === "album") return;
    // El artista raíz no se pliega: dejaría el mapa vacío
    if (node.hasClass("open")) return node.hasClass("root") ? null : collapse(node);
    if (kind === "artist") return expandArtist(node);
    if (kind === "hub") return expandHub(node);
    if (kind === "genre") return expandGenre(node, 0);
  }

  cy.on("tap", "node", function (evt) {
    var node = evt.target;
    showPanel(node);
    toggle(node);
  });

  cy.on("dbltap", "node.album.local", function (evt) {
    var r = evt.target.data("release");
    var data = artistData.get(evt.target.data("artistId"));
    if (data) openInMusicBrowser(data.artist.name, r.owned_title || r.title);
  });

  cy.on("mouseover", "node", function (evt) {
    var hood = evt.target.closedNeighborhood();
    cy.elements().not(hood).addClass("faded");
  });
  cy.on("mouseout", "node", function () { cy.elements().removeClass("faded"); });

  cy.on("tap", function (evt) {
    if (evt.target === cy) showHelp();
  });

  function openInMusicBrowser(artist, album) {
    if (!EMBED) return;
    var q = new URLSearchParams({ artist: artist });
    if (album) q.set("album", album);
    console.info("mfuz://open?" + q.toString());
  }

  function start(artistId, focusKey) {
    rootArtistId = artistId;
    cy.elements().remove();
    $("empty").style.display = "none";
    params.set("artist", artistId);
    history.replaceState(null, "", "?" + params.toString());
    loadArtist(artistId).then(function (data) {
      var spec = artistNode(data.artist, "");
      var root = cy.add({ group: "nodes", data: spec.data, classes: spec.classes + " root", position: { x: 0, y: 0 } });
      cy.center(root);
      showPanel(root);
      return expandArtist(root).then(function () { if (focusKey) focusRelease(data, focusKey); });
    }).catch(function (e) { $("panel").innerHTML = '<p class="muted">Error: ' + esc(e.message) + "</p>"; });
  }

  /* Resalta un disco buscado; si está en EPs u Otros tuyos, despliega antes
     esa sección. */
  function focusRelease(data, key) {
    var artistId = data.artist.id;
    var matches = function (r) { return r.key === key || (r.album_id != null && "a" + r.album_id === key); };
    var release = null, hub = null;
    [["albums", null], ["eps", "eps"], ["extra", "extra"]].some(function (s) {
      release = data[s[0]].find(matches) || null;
      hub = s[1];
      return release;
    });
    if (!release) return;
    var show = function () {
      var node = cy.getElementById("rel:" + artistId + ":" + release.key);
      if (node.empty()) return;
      cy.nodes().removeClass("focus");
      node.addClass("focus").select();
      showPanel(node);
      setTimeout(function () { cy.animate({ center: { eles: node }, zoom: 1.1 }, { duration: 400 }); }, 450);
    };
    if (hub) {
      var hubNode = cy.getElementById("hub:" + artistId + ":" + hub);
      if (hubNode.nonempty() && !hubNode.hasClass("open")) expandHub(hubNode);
    }
    setTimeout(show, 420);
  }

  // ── Panel lateral ─────────────────────────────────────────────────────
  function showHelp() {
    $("panel").innerHTML =
      '<div class="help muted">' +
      "<p><b>Clic</b> en un artista, en <b>EPs</b>, <b>Géneros</b> u <b>Otros tuyos</b> para desplegarlo; " +
      "otro clic lo pliega.</p>" +
      "<p>En un <b>género</b> aparecen otros artistas de tu colección con ese género, ordenados por cuántos " +
      "discos suyos tienes de él. Clic en uno para ver su discografía.</p>" +
      "<p>Arrastra los nodos para recolocarlos; rueda para hacer zoom.</p>" +
      (EMBED ? "<p><b>Doble clic</b> en un disco tuyo lo abre en Music Browser.</p>" : "") +
      "</div>";
  }

  var STATE_TEXT = { local: "✓ Lo tienes", antiguo: "Lo tuviste (ya no está en local)" };

  function showPanel(node) {
    var kind = node.data("kind");
    var panel = $("panel");
    if (kind === "album") {
      var r = node.data("release");
      var data = artistData.get(node.data("artistId"));
      var artistName = data ? data.artist.name : "";
      var cover = node.data("image");
      panel.innerHTML =
        (cover ? '<img class="cover" src="' + esc(cover.replace("front-250", "front-500")) + '" alt="" ' +
                 'onerror="this.src=\'' + esc(cover) + '\'">' : "") +
        "<h2>" + esc(r.title) + "</h2>" +
        '<div class="muted">' + esc(artistName) + (r.date || r.year ? " · " + esc(r.date || r.year) : "") +
        " · " + esc(r.detail) + "</div>" +
        '<div class="state ' + esc(r.state || "") + '">' + esc(STATE_TEXT[r.state] || "Te falta") + "</div>" +
        (r.owned_title && r.owned_title !== r.title
          ? '<div class="muted">En tu colección como: ' + esc(r.owned_title) + "</div>" : "") +
        '<div class="actions">' +
        (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Ver en MusicBrainz</a>' : "") +
        "</div>" +
        (EMBED && r.state === "local" ? '<div class="actions"><button id="open-mb">Abrir en Music Browser</button></div>' : "");
      var btn = $("open-mb");
      if (btn) btn.onclick = function () { openInMusicBrowser(artistName, r.owned_title || r.title); };
      return;
    }
    if (kind === "artist") {
      var id = node.data("artistId");
      var render = function (d) {
        var a = d.artist;
        var summary = d.has_mb ? "Tienes " + d.owned_count + " de " + d.albums.length + " álbumes originales"
                               : d.albums.length + " discos tuyos · sin discografía de MusicBrainz";
        panel.innerHTML =
          (node.data("image") ? '<img class="avatar" src="' + esc(node.data("image")) + '" alt="">' : "") +
          "<h2>" + esc(a.name) + "</h2>" +
          '<div class="muted">' + esc([a.origin, a.formed_year].filter(Boolean).join(" · ")) + "</div>" +
          '<div class="muted" style="margin-top:6px">' + esc(summary) + "</div>" +
          (a.state === "antiguo" ? '<div class="state antiguo">Ya no tienes nada suyo en local</div>' : "") +
          '<div class="actions">' +
          (id !== rootArtistId ? '<button class="primary" id="make-root">Empezar desde aquí</button>' : "") +
          (EMBED ? '<button id="open-mb">Abrir en Music Browser</button>' : "") +
          "</div>";
        var mk = $("make-root");
        if (mk) mk.onclick = function () { start(id); };
        var ob = $("open-mb");
        if (ob) ob.onclick = function () { openInMusicBrowser(a.name); };
      };
      if (artistData.has(id)) render(artistData.get(id));
      else loadArtist(id).then(render);
      return;
    }
    if (kind === "genre") {
      var key = node.data("key");
      var exclude = rootArtistId != null ? "&exclude=" + rootArtistId : "";
      panel.innerHTML = "<h2>" + esc(node.data("genreLabel")) + '</h2><div class="muted">Cargando artistas…</div>';
      api("./api/genre?key=" + encodeURIComponent(key) + "&limit=50" + exclude).then(function (page) {
        panel.innerHTML =
          "<h2>" + esc(page.label) + "</h2>" +
          '<div class="muted">' + page.total + " artistas de tu colección" +
          (page.total > page.artists.length ? " (los " + page.artists.length + " primeros)" : "") +
          ". Clic para añadirlo al mapa.</div><ul>" +
          page.artists.map(function (a) {
            var inMap = cy.getElementById("ar:" + a.id).nonempty();
            return '<li data-id="' + a.id + '" class="' + (a.state === "antiguo" ? "antiguo " : "") +
                   (inMap ? "in-map" : "") + '"><span>' + esc(a.name) + '</span><span class="n">' +
                   (a.count ? a.count + (a.count === 1 ? " disco" : " discos") : "tag") + "</span></li>";
          }).join("") + "</ul>";
        panel.querySelectorAll("li").forEach(function (li) {
          li.onclick = function () {
            var a = page.artists.find(function (x) { return String(x.id) === li.dataset.id; });
            var genre = cy.getElementById("ge:" + key);
            if (!a || genre.empty()) return;
            var added = addChildren(genre, [genreArtistSpec(a)], function () { return "to-artist"; });
            li.classList.add("in-map");
            var target = cy.getElementById("ar:" + a.id);
            if (added.nonempty() || !target.hasClass("open")) expandArtist(target);
          };
        });
      });
      return;
    }
    if (kind === "hub") {
      var texts = { eps: "EPs de su discografía (sin directos, remixes ni recopilatorios).",
                    genres: "Géneros de sus discos en tu colección, con cuántos discos tienes de cada uno.",
                    extra: "Discos tuyos que no aparecen en su discografía de MusicBrainz " +
                           "(directos, recopilatorios, ediciones raras o títulos que no casan)." };
      panel.innerHTML = "<h2>" + esc(node.data("label")) + '</h2><p class="muted">' + esc(texts[node.data("hub")]) + "</p>";
      return;
    }
    showHelp();
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────
  var q = $("q"), results = $("results");
  var items = [], active = -1, timer = null, seq = 0;

  function renderResults() {
    if (!items.length) {
      results.innerHTML = q.value.trim().length >= 2 ? '<div class="result"><span class="sub">Sin resultados</span></div>' : "";
      results.classList.toggle("open", q.value.trim().length >= 2);
      return;
    }
    results.innerHTML = items.map(function (r, i) {
      var mark = r.state === "local" ? ' <span class="mark-local">✓</span>' :
                 r.state === "antiguo" ? ' <span class="mark-antiguo">◌</span>' : "";
      return '<div class="result' + (i === active ? " active" : "") + '" data-i="' + i + '">' +
             '<span class="kind">' + (r.type === "artist" ? "◉" : "♪") + "</span>" +
             "<span>" + esc(r.label) + mark + "</span>" +
             (r.type === "album" ? '<span class="sub">' + esc(r.artist) + "</span>" : "") + "</div>";
    }).join("");
    results.classList.add("open");
  }

  function choose(r) {
    results.classList.remove("open");
    q.value = r.type === "album" ? r.label + " — " + r.artist : r.label;
    q.blur();
    start(r.artist_id, r.type === "album" ? r.album_key : null);
  }

  q.addEventListener("input", function () {
    clearTimeout(timer);
    var text = q.value.trim();
    if (text.length < 2) { items = []; renderResults(); return; }
    timer = setTimeout(function () {
      var mine = ++seq;
      fetch("./api/search?q=" + encodeURIComponent(text)).then(function (r) { return r.json(); }).then(function (data) {
        if (mine !== seq) return;
        items = data; active = data.length ? 0 : -1;
        renderResults();
      });
    }, 150);
  });

  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      renderResults();
      e.preventDefault();
    } else if (e.key === "Enter" && items[active]) {
      choose(items[active]);
    } else if (e.key === "Escape") {
      results.classList.remove("open");
    }
  });

  results.addEventListener("mousedown", function (e) {
    var el = e.target.closest(".result[data-i]");
    if (el) { e.preventDefault(); choose(items[+el.dataset.i]); }
  });
  q.addEventListener("blur", function () { setTimeout(function () { results.classList.remove("open"); }, 100); });
  q.addEventListener("focus", function () { if (items.length) renderResults(); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
  });

  $("btn-fit").onclick = function () { cy.animate({ fit: { eles: cy.elements(), padding: 50 } }, { duration: 350 }); };
  $("btn-layout").onclick = function () {
    if (!cy.nodes().length) return;
    cy.layout({ name: "cose", animate: true, animationDuration: 600, randomize: false, nodeRepulsion: 9000,
                idealEdgeLength: 110, padding: 50 }).run();
  };

  showHelp();
  var initial = parseInt(params.get("artist"), 10);
  if (!isNaN(initial)) start(initial, params.get("album"));
  else if (!EMBED) q.focus();
})();
