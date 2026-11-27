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
  source: '',
  mode: 'lyrics',
  lights: {
    enabled: true, style: 'flow', colors: 'rainbow', custom: ['#ff0080', '#7a00ff', '#00d0ff'],
    speed: 0.45, brightness: 0.85, thickness: 0.45, glow: 0.6, beatReact: 0.7, spread: 1,
  },
  beat: { enabled: true, sensitivity: 0.5, pulseArt: true },
  bg: { source: 'album', imagePath: '', folderPath: '', slideSec: 30, blur: 0.25, dim: 0.35, grain: true },
  lyrics: { style: 'auto', noLyrics: 'cover', font: 'auto', wordByWord: true, emphasis: true, icons: true, size: 1, cardPhotos: 'places', cardFolder: '', onArtModes: true, cardEvery: 4 },
  player: { show: true, autoHide: false, pausedClock: true },
  window: { onTop: false, launchFullscreen: false, openAtLogin: false },
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

// ---------- Lyric styles and fonts ----------
const STYLE_GROUPS = [
  ['Automatic', [['auto', 'Auto-Vibe', 'Picks a style that fits each song from its genre and how the lyrics move.']]],
  ['Classic', [['chat', 'Messages', 'Chat bubbles with photo cards from real places.'], ['scroll', 'Scroll', 'A lyric sheet that scrolls; the current line stays sharp.'], ['focus', 'Karaoke', 'Big lines that fill in word by word.'], ['minimal', 'Minimal', 'One clean line at a time.']]],
  ['Big type', [['kinetic', 'Kinetic', 'Words punch, slide and spin in like a lyric video.'], ['grid', 'Split-flap grid', 'Words flip onto giant tiles. The chorus lights them up.'], ['editorial', 'Editorial spread', 'A magazine page: huge serif type beside the album art.'], ['stack', 'Gravity stack', 'Lines drop and pile up, then shatter on the chorus.'], ['fisheye', 'Fisheye lens', 'The sung word swells under a lens, with its icon above it.']]],
  ['Bass & motion', [['spotlight', 'Spotlight', 'A wall of hidden lyrics lit by a glowing orb that chases the singer.'], ['shockwave', 'Shockwave', 'Each line slams in and blasts the old words to the edges.'], ['tunnel', '3D tunnel', 'Lines fly out of the distance and rush past you.']]],
  ['Ambient', [['ink', 'Liquid ink', 'Crisp words that melt into colored smoke when the line ends.'], ['cloud', 'Word cloud', 'Lyrics float at different depths; the sung line zooms forward.'], ['stars', 'Constellation', 'Lines drift like stars and connect when they\'re sung.'], ['cinema', 'Cinema subtitles', 'Letterbox bars and movie subtitles over ambient light.'], ['neon', 'Neon sign', 'A glowing neon tube sign that lights up word by word.'], ['wave', 'Waveform', 'Words ride a live sound wave across the screen.']]],
  ['Playful', [['polaroid', 'Polaroids', 'Each line is a photo dropped on a table.'], ['ticker', 'LED ticker', 'A glowing dot-matrix sign scrolling across the screen.'], ['terminal', 'Terminal', 'Lyrics type themselves out like live code.'], ['split', 'Call & response', 'Main vocals on one side, ad-libs and echoes on the other.']]],
];
const STYLE_LIST = STYLE_GROUPS.flatMap(([, list]) => list).filter((x) => x[0] !== 'auto');
const AUTO_INFO = STYLE_GROUPS[0][1][0];
const styleInfo = (k) => (k === 'auto' ? AUTO_INFO : STYLE_LIST.find((x) => x[0] === k) || STYLE_LIST[0]);
const effStyle = () => window.curStyle?.() || S.lyrics.style;
function autoHint() {
  const st = window.curStyle?.(); const v = window.lwState?.vibe;
  if (!st || !v) return AUTO_INFO[2];
  return `This song: ${styleInfo(st)[1]}, because it sounds like ${v.label}${v.reasons?.length ? ' (' + v.reasons.join(', ') + ')' : ''}. Pick any style to lock it in.`;
}
const FONTS = [['auto', 'Matches the style'], ['system', 'System'], ['archivo', 'Archivo Wide'], ['unbounded', 'Unbounded'], ['space', 'Space Grotesk'], ['fraunces', 'Fraunces'], ['playfair', 'Playfair'], ['instrument', 'Instrument Serif'], ['bebas', 'Bebas Neue'], ['mono', 'JetBrains Mono'], ['neon', 'Tilt Neon'], ['caveat', 'Caveat (handwritten)'], ['doto', 'Doto (dot matrix)']];
const LIGHT_FX = [['flow', 'Flow'], ['chase', 'Chase'], ['spectrum', 'Spectrum'], ['breathe', 'Breathe'], ['static', 'Static']];
const BG_SRC = [['album', 'Album colors'], ['albumArt', 'Album art'], ['image', 'Your image'], ['folder', 'Photo slideshow'], ['black', 'Black']];
const label = (list, v) => (list.find((x) => x[0] === v) || [, v])[1];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- Panel schema ----------
const pct = (v) => Math.round(v * 100) + '%';
const UI = { open: 'lyrics', displays: [], update: { state: 'idle' }, info: null };
const SCHEMA = [
  { id: 'lyrics', title: 'Lyrics', summary: () => `${S.lyrics.style === 'auto' ? 'Auto: ' + styleInfo(effStyle())[1] : styleInfo(S.lyrics.style)[1]}, ${S.lyrics.font === 'auto' ? 'style font' : label(FONTS, S.lyrics.font)}`, items: [
    { key: 'lyrics.style', label: 'Style', type: 'select', groups: STYLE_GROUPS, hint: () => (S.lyrics.style === 'auto' ? autoHint() : styleInfo(S.lyrics.style)[2]) },
    { key: 'lyrics.font', label: 'Font', type: 'select', options: FONTS },
    { key: 'lyrics.size', label: 'Text size', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: pct },
    { key: 'lyrics.wordByWord', label: 'Word by word', type: 'toggle' },
    { key: 'lyrics.emphasis', label: 'Emphasize loud words', type: 'toggle', hint: () => 'Words sung harder get bigger and brighter.' },
    { key: 'lyrics.icons', label: 'Word icons', type: 'toggle', hint: () => 'Words like fire, money or moon pop a matching icon.' },
    { key: 'lyrics.cardPhotos', label: 'Photos', type: 'seg', options: [['places', 'Places'], ['folder', 'My photos'], ['album', 'Album art'], ['off', 'Off']], when: () => ['chat', 'polaroid'].includes(effStyle()) },
    { key: 'lyrics.cardFolder', label: 'Photo folder', type: 'folder', when: () => ['chat', 'polaroid'].includes(effStyle()) && S.lyrics.cardPhotos === 'folder' },
    { key: 'lyrics.cardEvery', label: 'Card every', type: 'range', min: 2, max: 8, step: 1, fmt: (v) => v + ' lines', when: () => effStyle() === 'chat' && S.lyrics.cardPhotos !== 'off' },
    { key: 'lyrics.onArtModes', label: 'Lyrics in Cover & Vinyl', type: 'toggle' },
    { key: 'lyrics.noLyrics', label: 'Songs without lyrics', type: 'seg', options: [['cover', 'Show the cover'], ['stay', 'Keep the style']] },
    { key: 'offsetMs', label: 'Timing (all songs)', hint: () => 'Use [ and ] to fix the timing of just the song that\'s playing.', type: 'range', min: -3000, max: 3000, step: 50, fmt: (v) => (v > 0 ? '+' : '') + (v / 1000).toFixed(2) + 's' },
  ]},
  { id: 'lights', title: 'RGB lights', summary: () => S.lights.enabled ? `${label(LIGHT_FX, S.lights.style)}, ${S.lights.colors === 'album' ? 'album colors' : S.lights.colors}` : 'Off', items: [
    { key: 'lights.enabled', label: 'Edge lights', type: 'toggle' },
    { key: 'lights.style', label: 'Effect', type: 'select', options: LIGHT_FX },
    { key: 'lights.colors', label: 'Colors', type: 'palette' },
    { key: 'lights.custom', label: 'Your colors', type: 'colors', when: () => S.lights.colors === 'custom' },
    { key: 'lights.speed', label: 'Speed', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.brightness', label: 'Brightness', type: 'range', min: 0.1, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.thickness', label: 'Thickness', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'lights.spread', label: 'Color repeats', type: 'range', min: 1, max: 4, step: 1, fmt: (v) => v + '×' },
    { key: 'lights.beatReact', label: 'React to beat', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
  ]},
  { id: 'bg', title: 'Background', summary: () => label(BG_SRC, S.bg.source), items: [
    { key: 'bg.source', label: 'Background', type: 'select', options: BG_SRC },
    { key: 'bg.imagePath', label: 'Image', type: 'file', when: () => S.bg.source === 'image' },
    { key: 'bg.folderPath', label: 'Folder', type: 'folder', when: () => S.bg.source === 'folder' },
    { key: 'bg.slideSec', label: 'Change every', type: 'range', min: 5, max: 120, step: 5, fmt: (v) => v + 's', when: () => S.bg.source === 'folder' },
    { key: 'bg.blur', label: 'Blur', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct, when: () => S.bg.source !== 'black' },
    { key: 'bg.dim', label: 'Darken', type: 'range', min: 0, max: 0.9, step: 0.01, fmt: pct, when: () => S.bg.source !== 'black' },
    { key: 'bg.grain', label: 'Film grain', type: 'toggle' },
  ]},
  { id: 'beat', title: 'Beat', summary: () => (S.beat.enabled ? 'Listening' : 'Off'), items: [
    { key: 'beat.enabled', label: 'Listen to music', type: 'toggle', hint: () => 'Uses system audio to sync the visuals. Nothing is recorded.' },
    { key: 'beat.sensitivity', label: 'Sensitivity', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'beat.pulseArt', label: 'Art bumps to the beat', type: 'toggle' },
  ]},
  { id: 'display', title: 'Display & window', summary: () => { const d = UI.displays.find((x) => x.current); return UI.displays.length > 1 && d ? d.name : S.window.onTop ? 'Always on top' : 'Window'; }, items: [
    { key: '_screen', label: 'Show on', type: 'display', when: () => !!window.lw },
    { key: 'window.launchFullscreen', label: 'Open in fullscreen', type: 'toggle', when: () => !!window.lw },
    { key: 'window.openAtLogin', label: 'Open when my computer starts', type: 'toggle', when: () => !!window.lw },
    { key: '_fullscreen', label: 'Fullscreen', type: 'action', text: 'Toggle', run: () => window.lw?.toggleFullscreen() },
    { key: 'window.onTop', label: 'Always on top', type: 'toggle' },
    { key: 'player.show', label: 'Show player', type: 'toggle' },
    { key: 'player.autoHide', label: 'Hide controls when idle', type: 'toggle' },
    { key: 'player.pausedClock', label: 'Show a clock when paused', type: 'toggle' },
  ]},
  { id: 'app', title: 'App', summary: () => (UI.info ? 'Version ' + UI.info.version : ''), items: [
    { key: 'source', label: 'Music source', type: 'seg', when: () => !!window.lw && UI.localSupported, options: [['local', 'This computer'], ['spotify', 'Spotify account']],
      hint: () => S.source === 'local' ? 'Apple Music or the Spotify app on this computer. No Premium needed.' : 'Follows Spotify on any device. Needs Premium.' },
    { key: '_update', label: 'Updates', type: 'update' },
    { key: '_guide', label: 'Setup guide', type: 'action', text: 'Open', run: () => (window.lw ? window.lw.openExternal('https://lyricwall-app.netlify.app/setup.html') : window.open('https://lyricwall-app.netlify.app/setup.html')) },
    { key: '_reset', label: 'Reset settings', type: 'action', text: 'Reset', run: () => { localStorage.removeItem('lw-settings'); location.reload(); } },
    { key: '_logout', label: 'Spotify account', type: 'action', text: 'Log out', when: () => S.source === 'spotify', run: async () => { await window.lw?.logout(); location.reload(); } },
  ]},
];

// ---------- Panel rendering ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const shortPath = (p) => (p ? p.split(/[\\/]/).slice(-2).join('/') : 'None chosen');
const CHEVRON = '<svg viewBox="0 0 24 24" class="chev"><path d="M7 10l5 5 5-5"/></svg>';

function updateText() {
  const u = UI.update;
  return {
    idle: 'Checks automatically', checking: 'Checking…', current: 'You\'re up to date', dev: 'Updates work in the installed app',
    available: `Version ${u.version} is available`, downloading: `Downloading ${u.version || ''}… ${u.percent || 0}%`,
    ready: `Version ${u.version} is ready`, error: 'Couldn\'t check for updates',
  }[u.state] || '';
}

function renderItem(it) {
  const row = el('div', 'set-row set-' + it.type);
  row.dataset.key = it.key;
  row.appendChild(el('div', 'set-label', it.label));
  const v = it.key.startsWith('_') ? null : sget(it.key);
  if (it.type === 'toggle') {
    const t = el('button', 'tgl' + (v ? ' on' : '')); t.setAttribute('role', 'switch'); t.setAttribute('aria-checked', !!v); t.setAttribute('aria-label', it.label);
    t.onclick = () => { sset(it.key, !sget(it.key)); renderSettings(); };
    row.appendChild(t);
  } else if (it.type === 'select') {
    const sel = el('select', 'sel');
    if (it.groups) it.groups.forEach(([g, list]) => { const og = el('optgroup'); og.label = g; list.forEach(([val, txt]) => og.appendChild(new Option(txt, val, false, val === v))); sel.appendChild(og); });
    else it.options.forEach(([val, txt]) => sel.appendChild(new Option(txt, val, false, val === v)));
    sel.onchange = () => { sset(it.key, sel.value); renderSettings(); };
    const wrap = el('div', 'sel-wrap'); wrap.append(sel); wrap.insertAdjacentHTML('beforeend', CHEVRON);
    row.appendChild(wrap);
  } else if (it.type === 'seg') {
    const g = el('div', 'seg');
    for (const [val, txt] of it.options) { const b = el('button', val === v ? 'active' : '', txt); b.onclick = () => { sset(it.key, val); renderSettings(); }; g.appendChild(b); }
    row.appendChild(g);
  } else if (it.type === 'range') {
    const wrap = el('div', 'rng');
    const r = el('input'); r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step; r.value = v; r.setAttribute('aria-label', it.label);
    const out = el('span', 'rng-val', it.fmt(v));
    const paint = () => r.style.setProperty('--p', ((r.value - it.min) / (it.max - it.min)) * 100 + '%');
    r.oninput = () => { const nv = +r.value; out.textContent = it.fmt(nv); paint(); sset(it.key, nv); };
    paint(); wrap.append(r, out); row.appendChild(wrap);
  } else if (it.type === 'palette') {
    const g = el('div', 'pal-grid');
    const opts = [['album', 'Album art'], ['background', 'Background'], ...Object.keys(COLOR_PRESETS).map((k) => [k, cap(k)]), ['custom', 'Custom']];
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
      if (S.lights.custom.length > 1) { const x = el('button', 'color-x', '×'); x.onclick = () => { sset('lights.custom', S.lights.custom.filter((_, j) => j !== i)); renderSettings(); }; w.appendChild(x); }
      g.appendChild(w);
    });
    if (S.lights.custom.length < 8) { const add = el('button', 'color-add', '+'); add.onclick = () => { sset('lights.custom', [...S.lights.custom, '#ffffff']); renderSettings(); }; g.appendChild(add); }
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
  } else if (it.type === 'display') {
    const ds = UI.displays;
    if (ds.length < 2) row.appendChild(el('span', 'set-note', ds.length ? 'Only one screen connected' : 'Checking screens…'));
    else {
      const sel = el('select', 'sel');
      ds.forEach((d) => sel.appendChild(new Option(`${d.name} (${d.size})${d.primary ? ', main' : ''}`, d.id, false, d.current)));
      sel.onchange = async () => { await window.lw.moveToDisplay(+sel.value, true); };
      const wrap = el('div', 'sel-wrap'); wrap.append(sel); wrap.insertAdjacentHTML('beforeend', CHEVRON);
      row.appendChild(wrap);
    }
  } else if (it.type === 'update') {
    const box = el('div', 'upd');
    box.appendChild(el('span', 'set-note', updateText()));
    const st = UI.update.state;
    if (st === 'ready' || st === 'available') { const b = el('button', 'btn primary', st === 'ready' ? 'Restart to update' : 'Download'); b.onclick = () => window.lw?.installUpdate(); box.appendChild(b); }
    else { const b = el('button', 'btn', 'Check now'); b.disabled = st === 'checking' || st === 'downloading'; b.onclick = () => { if (!window.lw) return; UI.update = { state: 'checking' }; renderSettings(); window.lw.checkUpdates(); }; box.appendChild(b); }
    row.appendChild(box);
  } else if (it.type === 'action') {
    const b = el('button', 'btn', it.text); b.onclick = it.run; row.appendChild(b);
  }
  const hint = it.hint?.();
  if (hint) row.appendChild(el('div', 'set-hint', hint));
  return row;
}

function renderSettings() {
  const body = document.getElementById('settingsBody');
  const scroll = body.scrollTop;
  // keep keyboard focus on the same control after redrawing
  const focusKey = document.activeElement?.closest?.('#settingsBody .set-row')?.dataset.key;
  body.innerHTML = '';
  for (const sec of SCHEMA) {
    const open = UI.open === sec.id;
    const s = el('section', 'acc' + (open ? ' open' : ''));
    const head = el('button', 'acc-head');
    head.setAttribute('aria-expanded', open);
    head.innerHTML = `<span class="acc-title"></span><span class="acc-sum"></span>${CHEVRON}`;
    head.querySelector('.acc-title').textContent = sec.title;
    head.querySelector('.acc-sum').textContent = sec.summary?.() || '';
    head.onclick = () => {
      UI.open = open ? null : sec.id; renderSettings();
      if (!open && window.anime) anime.animate(`#settingsBody .acc.open .set-row`, { opacity: [0, 1], y: [-8, 0], delay: anime.stagger(22), duration: 380, ease: 'outQuad' });
    };
    const wrap = el('div', 'acc-body'); const inner = el('div', 'acc-inner');
    if (open) for (const it of sec.items) { if (!it.when || it.when()) inner.appendChild(renderItem(it)); }
    wrap.appendChild(inner);
    s.append(head, wrap);
    body.appendChild(s);
  }
  body.scrollTop = scroll;
  if (focusKey) body.querySelector(`.set-row[data-key="${focusKey}"]`)?.querySelector('select, input, button')?.focus({ preventScroll: true });
}

async function openSettings(open) {
  const p = document.getElementById('settings');
  const v = open ?? !p.classList.contains('open');
  p.classList.toggle('open', v);
  document.body.classList.toggle('settings-open', v);
  if (v) {
    if (window.lw) {
      try { UI.displays = await window.lw.displays(); UI.info = await window.lw.appInfo(); UI.update = await window.lw.updateStatus(); } catch {}
    }
    renderSettings();
    if (window.anime) anime.animate('#settingsBody .acc', { opacity: [0, 1], x: [24, 0], delay: anime.stagger(35), duration: 500, ease: 'outExpo' });
  }
}
