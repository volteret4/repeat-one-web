/* Music Rater — dimension guide (tooltips + info panel)
 * Self-injects ℹ button + modal panel into every page.
 * On rate.html: adds title attributes and a dot indicator to cells with descriptions.
 */
(function () {
    'use strict';

    var DIM_META = [
        { key: 'alegre_melancolica',     la: 'Alegre',       lb: 'Melancólica'  },
        { key: 'relajada_energetica',    la: 'Mental',       lb: 'Emotivo'      },
        { key: 'instrumental_cantada',   la: 'Instrumental', lb: 'Cantada'      },
        { key: 'lenta_rapida',           la: 'Lenta',        lb: 'Rápida'       },
        { key: 'bailable_nobailable',    la: 'Bailable',     lb: 'No bailable'  },
        { key: 'comercial_experimental', la: 'Comercial',    lb: 'Experimental' },
        { key: 'luminosa_oscura',        la: 'Luminosa',     lb: 'Oscura'       },
        { key: 'fondo_atencion',         la: 'Fondo',        lb: 'Atención'     },
        { key: 'fluida_percusiva',       la: 'Fluida',       lb: 'Percusiva'    },
        { key: 'estatica_dinamica',      la: 'Estática',     lb: 'Dinámica'     },
        { key: 'reflexiva_fisica',       la: 'Reflexiva',    lb: 'Física'       },
        { key: 'intima_epica',           la: 'Íntima',       lb: 'Épica'        },
    ];

    var TOOLTIPS = {
        alegre_melancolica: {
            '-5': 'Dan ganas de bailar',
            '-3': 'Sonrisa',
            '+3': 'Ojitos',
            '+5': 'Drama',
        },
        relajada_energetica: {
            '-5': 'IDM · Math Rock',
            '-3': 'Bebop',
            '+3': 'Latin Jazz',
            '+5': 'Deep',
        },
        instrumental_cantada: {
            '-5': 'Los instrumentos cantan',
            '-3': 'BSO',
            '+3': 'Tarareas por cojones',
            '+5': 'Cantando a pleno pulmón',
        },
        lenta_rapida: {
            '-5': '80 bpm',
            '-3': '94 bpm',
            '0':  '115 bpm',
            '+3': '136 bpm',
            '+5': '150 bpm',
        },
        bailable_nobailable: {
            '-5': 'En medio de la pista',
            '-3': 'Te tira de la silla',
            '+3': 'Aprovecha pa ir a la barra',
            '+5': 'Acuéstate',
        },
        comercial_experimental: {
            '-5': 'Pop',
            '-3': 'Dance',
            '+3': 'Free Jazz',
            '+5': 'Ambient Drone',
        },
        luminosa_oscura: {
            '-5': 'Dios',
            '-3': 'Misa',
            '+3': 'Ambient',
            '+5': 'Drone · Noise',
        },
        fondo_atencion: {
            '-5': 'Ambient relajado',
            '-3': 'Cool Jazz',
            '+3': 'Pop',
            '+5': 'Punk',
        },
        fluida_percusiva: {
            '-5': 'Free Jazz',
            '-3': 'Jazz',
            '+3': 'Pop',
            '+5': 'Techno',
        },
        estatica_dinamica: {
            '-5': 'Techno 4×4',
            '-3': 'Pop sencillo',
            '+3': 'Jazz',
            '+5': 'Prog · Estructuras complejas',
        },
        reflexiva_fisica: {
            '-5': 'Trip',
            '-3': 'Ideas',
            '+3': 'Pies inquietos',
            '+5': 'Pogo',
        },
        intima_epica: {
            '-5': 'Dream Pop',
            '-3': 'Soul',
            '+3': 'Hip Hop',
            '+5': 'Techno Festival',
        },
    };

    // Expose globally so rate.html can use for dynamic tooltips if needed
    window.RATE_TOOLTIPS = TOOLTIPS;

    var panelOpen = false;

    function toggle() {
        panelOpen = !panelOpen;
        var panel   = document.getElementById('info-panel');
        var overlay = document.getElementById('info-overlay');
        if (panel)   panel.classList.toggle('info-open', panelOpen);
        if (overlay) overlay.classList.toggle('info-open', panelOpen);
    }

    function injectCSS() {
        var s = document.createElement('style');
        s.id = 'info-css';
        s.textContent = [
            // Nav button
            '.info-btn{padding:0 16px;background:var(--surface);border:none;',
            'color:var(--text-muted);cursor:pointer;font-size:15px;line-height:1;',
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;height:100%;',
            'transition:color .15s,background .15s;border-left:1px solid var(--border)!important;}',
            '.info-btn:hover{color:var(--accent);background:var(--surface2);}',

            // Overlay
            '#info-overlay{display:none;position:fixed;inset:0;z-index:600;',
            'background:rgba(0,0,0,.55);}',
            '#info-overlay.info-open{display:block;}',

            // Panel (centered modal, scale+fade in)
            '#info-panel{position:fixed;top:50%;left:50%;',
            'transform:translate(-50%,-50%) scale(.96);',
            'width:min(740px,92vw);max-height:82vh;',
            'background:var(--surface);border:1px solid var(--border-bright);',
            'z-index:601;display:flex;flex-direction:column;overflow:hidden;',
            'opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none;}',
            '#info-panel.info-open{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto;}',

            // Header
            '.info-header{display:flex;align-items:center;justify-content:space-between;',
            'padding:13px 20px;border-bottom:1px solid var(--border);flex-shrink:0;}',
            '.info-title{font-family:"IBM Plex Mono",monospace;font-size:10px;',
            'letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim);}',
            '.info-x{background:transparent;border:none;color:var(--text-muted);cursor:pointer;',
            'font-size:14px;padding:2px 6px;line-height:1;font-family:"IBM Plex Mono",monospace;}',
            '.info-x:hover{color:var(--accent);}',

            // Body grid
            '.info-body{overflow-y:auto;flex:1;display:grid;',
            'grid-template-columns:1fr 1fr;gap:1px;background:var(--border);align-content:start;}',

            // Dimension card
            '.info-dim{background:var(--surface);padding:14px;}',
            '.info-dim-poles{font-family:"IBM Plex Mono",monospace;font-size:9px;',
            'letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim);',
            'display:flex;justify-content:space-between;margin-bottom:6px;}',
            '.info-dim-poles span:last-child{opacity:.55;}',
            '.info-scale{display:flex;align-items:center;margin-bottom:10px;}',
            '.info-scale-track{flex:1;height:1px;background:var(--border-bright);margin:0 6px;}',
            '.info-scale-lbl{font-family:"IBM Plex Mono",monospace;font-size:8px;',
            'color:var(--text-muted);letter-spacing:.06em;}',

            // Values list
            '.info-vals{display:flex;flex-direction:column;gap:4px;}',
            '.info-val{display:flex;align-items:baseline;gap:8px;',
            'font-family:"IBM Plex Mono",monospace;}',
            '.info-val-num{font-size:9px;color:var(--text-muted);flex-shrink:0;',
            'min-width:20px;text-align:right;}',
            '.info-val-text{font-size:11px;color:var(--text-dim);}',

            // Tooltip dot on check-cell labels in rate.html
            'label.info-has-tip{position:relative;}',
            'label.info-has-tip::after{content:"";position:absolute;bottom:3px;left:50%;',
            'transform:translateX(-50%);width:3px;height:3px;border-radius:50%;',
            'background:currentColor;opacity:.4;}',
        ].join('');
        document.head.appendChild(s);
    }

    function injectHTML() {
        // ℹ button — insert before .sett-btn if present, else append to nav
        var nav = document.querySelector('nav');
        if (nav) {
            var btn = document.createElement('button');
            btn.className = 'info-btn';
            btn.title = 'Guía de valoraciones';
            btn.setAttribute('aria-label', 'Guía');
            btn.textContent = 'ℹ';
            btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
            var sett = nav.querySelector('.sett-btn');
            sett ? nav.insertBefore(btn, sett) : nav.appendChild(btn);
        }

        // Overlay
        var overlay = document.createElement('div');
        overlay.id = 'info-overlay';
        overlay.addEventListener('click', toggle);
        document.body.appendChild(overlay);

        // Modal panel
        var panel = document.createElement('div');
        panel.id = 'info-panel';

        // Header
        var hdr = document.createElement('div');
        hdr.className = 'info-header';
        var ttl = document.createElement('span');
        ttl.className = 'info-title';
        ttl.textContent = 'Guía de valoraciones';
        var cls = document.createElement('button');
        cls.className = 'info-x';
        cls.textContent = '✕';
        cls.addEventListener('click', toggle);
        hdr.appendChild(ttl);
        hdr.appendChild(cls);
        panel.appendChild(hdr);

        // Body grid
        var body = document.createElement('div');
        body.className = 'info-body';

        DIM_META.forEach(function (dim) {
            var vals = TOOLTIPS[dim.key] || {};
            var card = document.createElement('div');
            card.className = 'info-dim';

            // Poles header
            var poles = document.createElement('div');
            poles.className = 'info-dim-poles';
            poles.innerHTML = '<span>' + dim.la + '</span><span>' + dim.lb + '</span>';
            card.appendChild(poles);

            // Scale bar
            var scale = document.createElement('div');
            scale.className = 'info-scale';
            scale.innerHTML = '<span class="info-scale-lbl">−5</span>'
                + '<div class="info-scale-track"></div>'
                + '<span class="info-scale-lbl">+5</span>';
            card.appendChild(scale);

            // Values — sorted numerically
            var valList = document.createElement('div');
            valList.className = 'info-vals';

            Object.keys(vals)
                .map(function (k) { return parseInt(k); })
                .sort(function (a, b) { return a - b; })
                .forEach(function (n) {
                    var key = n > 0 ? '+' + n : String(n);
                    var row = document.createElement('div');
                    row.className = 'info-val';
                    row.innerHTML = '<span class="info-val-num">' + key + '</span>'
                        + '<span class="info-val-text">' + vals[key] + '</span>';
                    valList.appendChild(row);
                });

            card.appendChild(valList);
            body.appendChild(card);
        });

        panel.appendChild(body);
        document.body.appendChild(panel);
    }

    // Add title + dot indicator to check-cell labels in rate.html
    function applyTooltips() {
        Object.keys(TOOLTIPS).forEach(function (dim) {
            var vals = TOOLTIPS[dim];
            Object.keys(vals).forEach(function (valStr) {
                var v = parseInt(valStr);
                var labelId = 'r_' + dim + '_' + (v < 0 ? 'n' + Math.abs(v) : v);
                var label = document.querySelector('label[for="' + labelId + '"]');
                if (label) {
                    label.title = vals[valStr];
                    label.classList.add('info-has-tip');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('info-css')) return;
        injectCSS();
        injectHTML();
        applyTooltips();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panelOpen) toggle();
    });
})();
