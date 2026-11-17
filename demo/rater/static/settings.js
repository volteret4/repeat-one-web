/* Music Rater — settings panel (theme switcher)
 * Self-injects gear button + slide-in panel into every page.
 * Theme variables are applied to :root immediately (no flash).
 */
(function () {
    'use strict';

    var THEMES = {
        'default': {
            '--bg': '#0d0d0d', '--surface': '#161616', '--surface2': '#1f1f1f',
            '--border': '#2a2a2a', '--border-bright': '#3d3d3d',
            '--text': '#e8e8e8', '--text-dim': '#666666', '--text-muted': '#444444',
            '--accent': '#e8ff47', '--accent2': '#ff6b35',
            '--done': '#2a2a2a', '--done-text': '#3a3a3a',
        },
        'ayu': {
            '--bg': '#212733', '--surface': '#272d38', '--surface2': '#2d3340',
            '--border': '#3a4050', '--border-bright': '#4a5060',
            '--text': '#d9d7ce', '--text-dim': '#827c75', '--text-muted': '#5c5855',
            '--accent': '#ffcc66', '--accent2': '#f29718',
            '--done': '#2d3340', '--done-text': '#4a5060',
        },
        'catppuccin': {
            '--bg': '#1e1e2e', '--surface': '#181825', '--surface2': '#313244',
            '--border': '#45475a', '--border-bright': '#585b70',
            '--text': '#cdd6f4', '--text-dim': '#a6adc8', '--text-muted': '#6c7086',
            '--accent': '#89b4fa', '--accent2': '#fab387',
            '--done': '#313244', '--done-text': '#45475a',
        },
        'kanagawa': {
            '--bg': '#1f1f28', '--surface': '#16161d', '--surface2': '#2a2a37',
            '--border': '#363646', '--border-bright': '#54546d',
            '--text': '#dcd7ba', '--text-dim': '#727169', '--text-muted': '#54546d',
            '--accent': '#7e9cd8', '--accent2': '#e6c384',
            '--done': '#2a2a37', '--done-text': '#54546d',
        },
        'moonfly': {
            '--bg': '#080808', '--surface': '#121212', '--surface2': '#17192b',
            '--border': '#2c2c3c', '--border-bright': '#3a3a50',
            '--text': '#bdbdbd', '--text-dim': '#9e9e9e', '--text-muted': '#6c6c6c',
            '--accent': '#74b2ff', '--accent2': '#36c692',
            '--done': '#17192b', '--done-text': '#3a3a50',
        },
        'nord': {
            '--bg': '#2e3440', '--surface': '#3b4252', '--surface2': '#434c5e',
            '--border': '#4c566a', '--border-bright': '#616e88',
            '--text': '#eceff4', '--text-dim': '#81a1c1', '--text-muted': '#4c566a',
            '--accent': '#88c0d0', '--accent2': '#d08770',
            '--done': '#3b4252', '--done-text': '#4c566a',
        },
        'srcery': {
            '--bg': '#121110', '--surface': '#262522', '--surface2': '#2d2b28',
            '--border': '#3e3d35', '--border-bright': '#504e45',
            '--text': '#c5b088', '--text-dim': '#917e6b', '--text-muted': '#6b5b47',
            '--accent': '#fbb829', '--accent2': '#ef2f27',
            '--done': '#2d2b28', '--done-text': '#504e45',
        },
        'tokyonight': {
            '--bg': '#1a1b26', '--surface': '#16161e', '--surface2': '#1f2335',
            '--border': '#292e42', '--border-bright': '#3b4261',
            '--text': '#c0caf5', '--text-dim': '#9399b2', '--text-muted': '#5e6370',
            '--accent': '#7aa2f7', '--accent2': '#f7768e',
            '--done': '#1f2335', '--done-text': '#3b4261',
        },
        'boo': {
            '--bg': '#1d1f21', '--surface': '#282a2e', '--surface2': '#373b41',
            '--border': '#373b41', '--border-bright': '#464e57',
            '--text': '#c5c8c6', '--text-dim': '#707880', '--text-muted': '#464e57',
            '--accent': '#b294bb', '--accent2': '#cc6666',
            '--done': '#373b41', '--done-text': '#464e57',
        },
        'hackthebox': {
            '--bg': '#141d2b', '--surface': '#1a2332', '--surface2': '#212d3b',
            '--border': '#2b3547', '--border-bright': '#374559',
            '--text': '#a4b1cd', '--text-dim': '#7d8a9f', '--text-muted': '#556070',
            '--accent': '#9fef00', '--accent2': '#5cb2ff',
            '--done': '#212d3b', '--done-text': '#374559',
        },
        'falcon': {
            '--bg': '#020221', '--surface': '#080830', '--surface2': '#18182a',
            '--border': '#1e1e38', '--border-bright': '#2c2c4c',
            '--text': '#b4b4b9', '--text-dim': '#8a8a90', '--text-muted': '#6b6b73',
            '--accent': '#65b9c9', '--accent2': '#ffc552',
            '--done': '#18182a', '--done-text': '#2c2c4c',
        },
        'borlandp': {
            '--bg': '#0000aa', '--surface': '#000088', '--surface2': '#0000bb',
            '--border': '#1515bb', '--border-bright': '#2020cc',
            '--text': '#ffffff', '--text-dim': '#aaaaff', '--text-muted': '#5555cc',
            '--accent': '#ffff55', '--accent2': '#55ffff',
            '--done': '#000077', '--done-text': '#2020aa',
        },
    };

    var THEME_LIST = [
        { key: 'default',    label: 'Default'          },
        { key: 'ayu',        label: 'Ayu'              },
        { key: 'catppuccin', label: 'Catppuccin Mocha' },
        { key: 'kanagawa',   label: 'Kanagawa'         },
        { key: 'moonfly',    label: 'Moonfly'          },
        { key: 'nord',       label: 'Nord'             },
        { key: 'srcery',     label: 'Srcery'           },
        { key: 'tokyonight', label: 'Tokyo Night'      },
        { key: 'boo',        label: 'Boo'              },
        { key: 'hackthebox', label: 'HackTheBox'       },
        { key: 'falcon',     label: 'Falcon'           },
        { key: 'borlandp',   label: 'Borland'          },
    ];

    var KEY = 'mix_rater_theme';

    function getSaved() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function applyVars(name) {
        var vars = THEMES[name];
        if (!vars) return;
        var root = document.documentElement;
        Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    }

    function applyTheme(name) {
        if (!THEMES[name]) return;
        applyVars(name);
        try { localStorage.setItem(KEY, name); } catch (e) {}
        document.querySelectorAll('.sett-theme-item').forEach(function (el) {
            el.classList.toggle('sett-active', el.dataset.theme === name);
        });
    }

    // ── Apply saved theme immediately to avoid flash ──────────────────────
    var _saved = getSaved();
    if (_saved && THEMES[_saved]) applyVars(_saved);

    // ── Inject after DOM ready ────────────────────────────────────────────
    var panelOpen = false;

    function toggle() {
        panelOpen = !panelOpen;
        var panel   = document.getElementById('sett-panel');
        var overlay = document.getElementById('sett-overlay');
        if (panel)   panel.classList.toggle('sett-open', panelOpen);
        if (overlay) overlay.classList.toggle('sett-open', panelOpen);
    }

    function injectCSS() {
        var s = document.createElement('style');
        s.id = 'sett-css';
        s.textContent = [
            '.sett-btn{margin-left:auto;padding:0 18px;background:var(--surface);border:none;',
            'color:var(--text-muted);cursor:pointer;font-size:17px;line-height:1;',
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
            'height:100%;transition:color .15s,background .15s;',
            'border-left:1px solid var(--border)!important;}',
            '.sett-btn:hover{color:var(--accent);background:var(--surface2);}',

            '#sett-overlay{display:none;position:fixed;inset:0;z-index:500;}',
            '#sett-overlay.sett-open{display:block;}',

            '#sett-panel{position:fixed;top:0;right:-280px;width:260px;height:100vh;',
            'background:var(--surface);border-left:1px solid var(--border-bright);',
            'z-index:501;transition:right .22s ease;display:flex;flex-direction:column;overflow:hidden;}',
            '#sett-panel.sett-open{right:0;}',

            '.sett-header{display:flex;align-items:center;justify-content:space-between;',
            'padding:13px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}',
            '.sett-title{font-family:"IBM Plex Mono",monospace;font-size:10px;',
            'letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim);}',
            '.sett-x{background:transparent;border:none;color:var(--text-muted);cursor:pointer;',
            'font-size:14px;padding:2px 6px;line-height:1;font-family:"IBM Plex Mono",monospace;}',
            '.sett-x:hover{color:var(--accent);}',

            '.sett-body{padding:14px;overflow-y:auto;flex:1;}',
            '.sett-section-label{font-family:"IBM Plex Mono",monospace;font-size:9px;',
            'letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;}',

            '.sett-theme-list{display:flex;flex-direction:column;gap:1px;}',
            '.sett-theme-item{display:flex;align-items:center;gap:10px;padding:7px 10px;',
            'cursor:pointer;border:1px solid transparent;transition:background .1s;}',
            '.sett-theme-item:hover{background:var(--surface2);}',
            '.sett-theme-item.sett-active{border-color:var(--accent);background:var(--surface2);}',

            '.sett-swatch{width:16px;height:16px;border-radius:50%;flex-shrink:0;',
            'border:1px solid rgba(255,255,255,.12);}',
            '.sett-theme-name{font-family:"IBM Plex Mono",monospace;font-size:11px;',
            'color:var(--text-dim);flex:1;}',
            '.sett-theme-item.sett-active .sett-theme-name{color:var(--text);}',
        ].join('');
        document.head.appendChild(s);
    }

    function injectHTML() {
        var nav = document.querySelector('nav');
        if (nav) {
            var btn = document.createElement('button');
            btn.className = 'sett-btn';
            btn.title = 'Ajustes';
            btn.setAttribute('aria-label', 'Ajustes');
            btn.textContent = '⚙';
            btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
            nav.appendChild(btn);
        }

        var overlay = document.createElement('div');
        overlay.id = 'sett-overlay';
        overlay.addEventListener('click', toggle);
        document.body.appendChild(overlay);

        var panel = document.createElement('div');
        panel.id = 'sett-panel';

        // Header
        var hdr = document.createElement('div');
        hdr.className = 'sett-header';
        var ttl = document.createElement('span');
        ttl.className = 'sett-title';
        ttl.textContent = 'Ajustes';
        var cls = document.createElement('button');
        cls.className = 'sett-x';
        cls.textContent = '✕';
        cls.addEventListener('click', toggle);
        hdr.appendChild(ttl);
        hdr.appendChild(cls);
        panel.appendChild(hdr);

        // Body
        var body = document.createElement('div');
        body.className = 'sett-body';
        var lbl = document.createElement('div');
        lbl.className = 'sett-section-label';
        lbl.textContent = 'Tema';
        body.appendChild(lbl);

        var list = document.createElement('div');
        list.className = 'sett-theme-list';
        var current = getSaved() || 'default';
        THEME_LIST.forEach(function (t) {
            var accent = (THEMES[t.key] || {})['--accent'] || '#888';
            var item = document.createElement('div');
            item.className = 'sett-theme-item' + (t.key === current ? ' sett-active' : '');
            item.dataset.theme = t.key;
            var sw = document.createElement('span');
            sw.className = 'sett-swatch';
            sw.style.background = accent;
            var nm = document.createElement('span');
            nm.className = 'sett-theme-name';
            nm.textContent = t.label;
            item.appendChild(sw);
            item.appendChild(nm);
            item.addEventListener('click', function () { applyTheme(t.key); });
            list.appendChild(item);
        });

        body.appendChild(list);
        panel.appendChild(body);
        document.body.appendChild(panel);
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('sett-css')) return;
        injectCSS();
        injectHTML();
    });
})();
