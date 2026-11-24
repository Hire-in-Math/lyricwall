// LyricWall settings: defaults, persistence, and the settings panel UI.
const COLOR_PRESETS = {
  rainbow:   ['#ff0040', '#ff8a00', '#ffe600', '#00ff6a', '#00d5ff', '#2a5bff', '#b300ff', '#ff00c8'],
  sunset:    ['#ff5e62', '#ff9966', '#ffcc70', '#ff6a88', '#b84dff'],
  ocean:     ['#00c6ff', '#0072ff', '#00f5c4', '#4facfe'],
  cyberpunk: ['#ff00a0', '#00f0ff', '#fffb00', '#7a00ff'],
  vaporwave: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'],
  fire:      ['#ff1e00', '#ff7b00', '#ffcf00', '#ff3c00'],
  ice:       ['#e0f7ff', '#7fdbff', '#3a8dff', '#b4c8ff'],
  forest:    ['#00ff87', '#60efff', '#0bd46f', '#c6ff00'],
  mono:      ['#ffffff', '#9a9aa0', '#ffffff', '#5a5a60'],
};

const DEFAULTS = {
  mode: 'lyrics',
  lights: {
    enabled: true, style: 'flow', colors: 'rainbow', custom: ['#ff0080', '#7a00ff', '#00d0ff'],
    speed: 0.45, brightness: 0.85, thickness: 0.45, glow: 0.6, beatReact: 0.7, spread: 1,
  },
  beat: { enabled: true, sensitivity: 0.5, pulseArt: true },
  bg: { source: 'album', imagePath: '', folderPath: '', slideSec: 30, blur: 0.25, dim: 0.35, grain: true },
  lyrics: { style: 'chat', wordByWord: true, size: 1, cardPhotos: 'places', cardFolder: '', onArtModes: true, cardEvery: 4 },
  player: { show: true, autoHide: false },
  window: { onTop: false },
  offsetMs: 0,
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k in over || {}) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') out[k] = deepMerge(base[k], over[k]);
    else if (over[k] !== undefined) out[k] = over[k];
  }
  return out;
}
const EMBED = new URLSearchParams(location.search).has('embed');
const S = (() => {
  if (EMBED) return deepMerge(DEFAULTS, {});
  try { return deepMerge(DEFAULTS, JSON.parse(localStorage.getItem('lw-settings') || '{}')); } catch { return deepMerge(DEFAULTS, {}); }
})();
function sget(path) { return path.split('.').reduce((o, k) => o?.[k], S); }
function sset(path, v) {
  const ks = path.split('.'); let o = S;
  ks.slice(0, -1).forEach((k) => (o = o[k]));
  o[ks.at(-1)] = v;
  if (!EMBED) try { localStorage.setItem('lw-settings', JSON.stringify(S)); } catch {}
  window.onSetting?.(path, v);
}

// ---------- Panel schema ----------
const pct = (v) => Math.round(v * 100) + '%';
const SCHEMA = [
  { title: 'RGB lights', items: [
    { key: 'lights.enabled', label: 'Edge lights', type: 'toggle' },
    { key: 'lights.style', label: 'Effect', type: 'seg', options: [['flow', 'Flow'], ['chase', 'Chase'], ['spectrum', 'Spectrum'], ['breathe', 'Breathe'], ['static', 'Static']] },
    { key: 'lights.colors', label: 'Colors', type: 'palette' },
    { key: 'lights.custom', label: 'Your colors', type: 'colors', when: () => S.lights.colors === 'custom' },
    { key: 'lights.speed', label: 'Speed', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.brightness', label: 'Brightness', type: 'range', min: 0.1, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.thickness', label: 'Thickness', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.spread', label: 'Color repeats', type: 'range', min: 1, max: 4, step: 1, fmt: (v) => v + '×' },
    { key: 'lights.beatReact', label: 'React to beat', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
  ]},
  { title: 'Beat', items: [
    { key: 'beat.enabled', label: 'Listen to music', type: 'toggle', hint: 'Uses system audio to sync visuals to the beat' },
    { key: 'beat.sensitivity', label: 'Sensitivity', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'beat.pulseArt', label: 'Art bumps to the beat', type: 'toggle' },
  ]},
  { title: 'Background', items: [
    { key: 'bg.source', label: 'Background', type: 'seg', options: [['album', 'Album colors'], ['albumArt', 'Album art'], ['image', 'Image'], ['folder', 'Slideshow'], ['black', 'Black']] },
    { key: 'bg.imagePath', label: 'Image', type: 'file', when: () => S.bg.source === 'image' },
    { key: 'bg.folderPath', label: 'Folder', type: 'folder', when: () => S.bg.source === 'folder' },
    { key: 'bg.slideSec', label: 'Change every', type: 'range', min: 5, max: 120, step: 5, fmt: (v) => v + 's', when: () => S.bg.source === 'folder' },
    { key: 'bg.blur', label: 'Blur', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct, when: () => S.bg.source !== 'black' },
    { key: 'bg.dim', label: 'Darken', type: 'range', min: 0, max: 0.9, step: 0.01, fmt: pct, when: () => S.bg.source !== 'black' },
    { key: 'bg.grain', label: 'Film grain', type: 'toggle' },
  ]},
  { title: 'Lyrics', items: [
    { key: 'lyrics.style', label: 'Style', type: 'seg', options: [['chat', 'Messages'], ['scroll', 'Scroll'], ['focus', 'Karaoke'], ['minimal', 'Minimal']] },
    { key: 'lyrics.wordByWord', label: 'Word by word', type: 'toggle' },
    { key: 'lyrics.size', label: 'Text size', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: pct },
    { key: 'lyrics.cardPhotos', label: 'Photo cards', type: 'seg', options: [['places', 'Places'], ['folder', 'My photos'], ['album', 'Album art'], ['off', 'Off']], when: () => S.lyrics.style === 'chat' },
    { key: 'lyrics.cardFolder', label: 'Photo folder', type: 'folder', when: () => S.lyrics.style === 'chat' && S.lyrics.cardPhotos === 'folder' },
    { key: 'lyrics.cardEvery', label: 'Card every', type: 'range', min: 2, max: 8, step: 1, fmt: (v) => v + ' lines', when: () => S.lyrics.style === 'chat' && S.lyrics.cardPhotos !== 'off' },
    { key: 'lyrics.onArtModes', label: 'Lyrics in Cover & Vinyl', type: 'toggle' },
    { key: 'offsetMs', label: 'Timing offset', type: 'range', min: -3000, max: 3000, step: 50, fmt: (v) => (v > 0 ? '+' : '') + (v / 1000).toFixed(2) + 's' },
  ]},
  { title: 'Player & window', items: [
    { key: 'player.show', label: 'Show player', type: 'toggle' },
    { key: 'player.autoHide', label: 'Hide controls when idle', type: 'toggle' },
    { key: 'window.onTop', label: 'Always on top', type: 'toggle' },
    { key: '_fullscreen', label: 'Fullscreen', type: 'action', text: 'Toggle', run: () => window.lw?.toggleFullscreen() },
    { key: '_reset', label: 'Reset settings', type: 'action', text: 'Reset', run: () => { localStorage.removeItem('lw-settings'); location.reload(); } },
    { key: '_logout', label: 'Spotify account', type: 'action', text: 'Log out', run: async () => { await window.lw?.logout(); location.reload(); } },
  ]},
];

// ---------- Panel rendering ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const shortPath = (p) => (p ? p.split(/[\\/]/).slice(-2).join('/') : 'None chosen');

function renderSettings() {
  const body = document.getElementById('settingsBody');
  body.innerHTML = '';
  for (const sec of SCHEMA) {
    const s = el('section', 'set-sec');
    s.appendChild(el('h3', null, sec.title));
    for (const it of sec.items) {
      if (it.when && !it.when()) continue;
      const row = el('div', 'set-row set-' + it.type);
      const lab = el('div', 'set-label', it.label);
      row.appendChild(lab);
      const v = sget(it.key);

      if (it.type === 'toggle') {
        const t = el('button', 'tgl' + (v ? ' on' : ''));
        t.onclick = () => { sset(it.key, !sget(it.key)); renderSettings(); };
        row.appendChild(t);
        if (it.hint) row.appendChild(el('div', 'set-hint', it.hint));
      } else if (it.type === 'seg') {
        const g = el('div', 'seg');
        for (const [val, txt] of it.options) {
          const b = el('button', val === v ? 'active' : '', txt);
          b.onclick = () => { sset(it.key, val); renderSettings(); };
          g.appendChild(b);
        }
        row.appendChild(g);
      } else if (it.type === 'range') {
        const wrap = el('div', 'rng');
        const r = el('input'); r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step; r.value = v;
        const out = el('span', 'rng-val', it.fmt(v));
        r.oninput = () => { const nv = +r.value; out.textContent = it.fmt(nv); sset(it.key, nv); };
        wrap.append(r, out); row.appendChild(wrap);
      } else if (it.type === 'palette') {
        const g = el('div', 'pal-grid');
        const opts = [['album', 'Album art'], ['background', 'Background'], ...Object.keys(COLOR_PRESETS).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), ['custom', 'Custom']];
        for (const [val, txt] of opts) {
          const b = el('button', 'pal-chip' + (val === v ? ' active' : ''));
          const sw = el('span', 'sw');
          const cols = COLOR_PRESETS[val] || (val === 'custom' ? S.lights.custom : window.currentDynamicColors?.(val));
          sw.style.background = cols && cols.length ? `linear-gradient(90deg, ${cols.join(',')})` : 'conic-gradient(#888, #444, #888)';
          b.append(sw, el('span', null, txt));
          b.onclick = () => { sset(it.key, val); renderSettings(); };
          g.appendChild(b);
        }
        row.appendChild(g);
      } else if (it.type === 'colors') {
        const g = el('div', 'color-list');
        S.lights.custom.forEach((c, i) => {
          const w = el('div', 'color-item');
          const inp = el('input'); inp.type = 'color'; inp.value = c;
          inp.oninput = () => { const arr = [...S.lights.custom]; arr[i] = inp.value; sset('lights.custom', arr); };
          w.appendChild(inp);
          if (S.lights.custom.length > 1) {
            const x = el('button', 'color-x', '×');
            x.onclick = () => { sset('lights.custom', S.lights.custom.filter((_, j) => j !== i)); renderSettings(); };
            w.appendChild(x);
          }
          g.appendChild(w);
        });
        if (S.lights.custom.length < 8) {
          const add = el('button', 'color-add', '+');
          add.onclick = () => { sset('lights.custom', [...S.lights.custom, '#ffffff']); renderSettings(); };
          g.appendChild(add);
        }
        row.appendChild(g);
      } else if (it.type === 'file' || it.type === 'folder') {
        const wrap = el('div', 'pick');
        wrap.appendChild(el('span', 'pick-path', shortPath(v)));
        const b = el('button', 'btn', 'Choose…');
        b.onclick = async () => {
          if (!window.lw) return window.toast?.('Only works in the app');
          const p = it.type === 'file' ? await window.lw.pickImage() : await window.lw.pickFolder();
          if (p) { sset(it.key, p); renderSettings(); }
        };
        wrap.appendChild(b); row.appendChild(wrap);
      } else if (it.type === 'action') {
        const b = el('button', 'btn', it.text); b.onclick = it.run; row.appendChild(b);
      }
      s.appendChild(row);
    }
    body.appendChild(s);
  }
}

function openSettings(open) {
  const p = document.getElementById('settings');
  const v = open ?? !p.classList.contains('open');
  p.classList.toggle('open', v);
  document.body.classList.toggle('settings-open', v);
  if (v) renderSettings();
}
