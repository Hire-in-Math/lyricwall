// LyricWall renderer — now playing, lyrics views, backgrounds, beat engine.
const $ = (id) => document.getElementById(id);
const api = window.lw || null; // null when opened in a plain browser (demo mode)
window.LW = { beat: 0, spectrum: null };

const PLACES = [
  ['Shibuya Crossing, Tokyo', 'Shibuya crossing night'], ['Brooklyn Bridge, New York', 'Brooklyn Bridge night skyline'],
  ['Santa Monica Pier, LA', 'Santa Monica Pier sunset'], ['Shinjuku, Tokyo', 'Shinjuku night street'],
  ['SoHo, New York', 'SoHo Manhattan street'], ['Venice Beach, LA', 'Venice Beach California'],
  ['Le Marais, Paris', 'Le Marais Paris street'], ['Shoreditch, London', 'Shoreditch street art'],
  ['Gangnam, Seoul', 'Gangnam Seoul night'], ['Wynwood, Miami', 'Wynwood Walls'],
  ['Downtown Chicago', 'Chicago skyline night'], ['Mission District, SF', 'Mission District San Francisco'],
  ['Copacabana, Rio', 'Copacabana beach'], ['Kreuzberg, Berlin', 'Kreuzberg Berlin street'],
  ['Times Square, New York', 'Times Square night'], ['Harajuku, Tokyo', 'Takeshita Street Harajuku'],
  ['Sunset Blvd, LA', 'Sunset Boulevard Los Angeles'], ['Westwood, LA', 'Westwood Village Los Angeles'],
  ['Dubai Marina', 'Dubai Marina night'], ['Navigli, Milan', 'Navigli Milan canal'],
  ['Gastown, Vancouver', 'Gastown Vancouver'], ['Hongdae, Seoul', 'Hongdae street Seoul'],
  ['Tribeca, New York', 'Tribeca Manhattan'], ['Malibu, CA', 'Malibu beach sunset'],
  ['Hollywood Hills, LA', 'Los Angeles night view Hollywood Hills'], ['Montmartre, Paris', 'Montmartre street Paris'],
  ['Camden, London', 'Camden Town London'], ['Hong Kong', 'Hong Kong skyline night'],
];
const STAMPS = ['now', '2m ago', 'yesterday', '11:42 PM', '3:07 AM', 'Sat', 'last summer', '1y ago'];

const state = {
  track: null, lines: [], idx: -2, count: 0, polling: false, holdUntil: 0,
  liveWords: [], albumBg: null, albumVivid: null, bgVivid: null, cardFolderList: [],
};

// ---------- utils ----------
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
function fmt(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1600); }
window.toast = toast;
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function parseLRC(lrc) {
  const out = [];
  for (const raw of lrc.split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const body = raw.replace(/\[[^\]]*\]/g, '');
    let words = null; // "enhanced" LRC has per-word times like <00:12.34>word
    if (/<\d+:\d+(?:\.\d+)?>/.test(body)) {
      words = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>\s*([^<]*)/g)]
        .map((m) => ({ t: (+m[1] * 60 + +m[2]) * 1000, w: m[3].trim() })).filter((x) => x.w);
    }
    const text = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    for (const s of stamps) out.push({ t: (+s[1] * 60 + +s[2]) * 1000, text, words });
  }
  return out.sort((a, b) => a.t - b.t);
}
function currentPosition() {
  const tr = state.track;
  if (!tr) return 0;
  const drift = tr.playing ? Date.now() - tr.fetchedAt : 0;
  return Math.min(tr.progressMs + drift, tr.durationMs);
}
const songOffsets = (() => { try { return JSON.parse(localStorage.getItem('lw-song-offsets') || '{}'); } catch { return {}; } })();
const songOffset = () => (state.track && songOffsets[state.track.id]) || 0;
const lyricPos = () => currentPosition() + S.offsetMs + songOffset();

// ---------- colors ----------
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0; const l = (max + min) / 2;
  const d = max - min; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
// Returns hue clusters [h, s, l, weight] sorted by weight (circular hue mean per bin).
// Groups the cover's pixels into its main colors (k-means), biggest first: [{ rgb, share, h, s, l, chroma }]
function colorClusters(img, k = 7) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  const dist = (a, b) => { const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };
  // farthest-point start (deterministic), then refine
  const cent = [px.reduce((m, p) => [m[0] + p[0] / px.length, m[1] + p[1] / px.length, m[2] + p[2] / px.length], [0, 0, 0])];
  const near = px.map((p) => dist(p, cent[0]));
  while (cent.length < k) {
    let bi = 0; for (let i = 1; i < px.length; i++) if (near[i] > near[bi]) bi = i;
    if (near[bi] < 300) break; // no more distinct colors
    cent.push([...px[bi]]); for (let i = 0; i < px.length; i++) near[i] = Math.min(near[i], dist(px[i], px[bi]));
  }
  let lab = new Array(px.length).fill(0);
  for (let it = 0; it < 10; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { let bj = 0, bd = Infinity; cent.forEach((cc, j) => { const dd = dist(p, cc); if (dd < bd) { bd = dd; bj = j; } }); lab[i] = bj; const t = sum[bj]; t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3]++; });
    sum.forEach((t, j) => { if (t[3]) cent[j] = [t[0] / t[3], t[1] / t[3], t[2] / t[3]]; });
  }
  const counts = cent.map(() => 0); lab.forEach((j) => counts[j]++);
  return cent.map((cc, j) => {
    const rgb = cc.map(Math.round); const [h, s, l] = rgbToHsl(...rgb);
    return { rgb, share: counts[j] / px.length, h, s, l, chroma: (1 - Math.abs(2 * l - 1)) * s };
  }).filter((x) => x.share > 0).sort((a, b) => b.share - a.share);
}
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// Dark, rich versions of the cover's biggest colors, for the background
function bgPalette(img) {
  const cl = colorClusters(img);
  const top = cl.slice(0, 3);
  while (top.length < 3) top.push(top[top.length - 1] || { h: 300, s: 0.5, l: 0.3 });
  return top.map((c, i) => hslToRgb(c.h, Math.min(0.85, c.s * 1.1), Math.min(0.42 - i * 0.06, Math.max(0.14, c.l * 0.8))));
}

// Light colors that match the cover: each color gets a share of the screen edge based on how much
// of the cover it fills (and how colorful it is). Black/white/gray covers get a soft tinted white.
function vividPalette(img) {
  const cl = colorClusters(img);
  if (!cl.length) return ['#ffffff'];
  // merge clusters that are basically the same hue
  const colorful = [];
  for (const c of cl.filter((x) => x.chroma >= 0.09 && x.share >= 0.012)) {
    const m = colorful.find((o) => Math.min(Math.abs(o.h - c.h), 360 - Math.abs(o.h - c.h)) < 18 && Math.abs(o.l - c.l) < 0.25);
    if (m) { const w = m.share + c.share; m.s = (m.s * m.share + c.s * c.share) / w; m.l = (m.l * m.share + c.l * c.share) / w; m.chroma = Math.max(m.chroma, c.chroma); m.share = w; }
    else colorful.push({ ...c });
  }
  if (!colorful.length) {
    // neutral cover: white light, tinted by its faint color if it has one
    const tint = cl.slice().sort((a, b) => b.s - a.s)[0];
    const sat = tint.s > 0.06 ? 0.3 : 0;
    return [...Array(8).fill(toHex(hslToRgb(tint.h, sat, 0.86))), ...Array(4).fill(toHex(hslToRgb(tint.h, sat * 0.8, 0.62)))];
  }
  const imp = colorful.map((c) => ({ c, w: c.share * (0.35 + c.chroma) })).sort((a, b) => b.w - a.w).slice(0, 5);
  const total = imp.reduce((n, x) => n + x.w, 0);
  // light version of each color: keep its hue and character, just make it glow
  const glow = (c) => hslToRgb(c.h, Math.min(1, Math.max(0.55, c.s * 1.25)), Math.min(0.68, Math.max(0.5, c.l < 0.5 ? 0.5 + c.l * 0.15 : c.l)));
  const SLOTS = 12; const out = [];
  const counts = imp.map(({ w }) => Math.max(1, Math.round((SLOTS * w) / total)));
  // always exactly SLOTS colors so the lights can fade smoothly from one song to the next
  while (counts.reduce((a, b) => a + b, 0) > SLOTS) counts[counts.indexOf(Math.max(...counts))]--;
  while (counts.reduce((a, b) => a + b, 0) < SLOTS) counts[0]++;
  imp.forEach(({ c }, i) => { for (let k = 0; k < counts[i]; k++) out.push(toHex(glow(c))); });
  return out;
}

function resolveLightColors(src = S.lights.colors) {
  if (COLOR_PRESETS[src]) return COLOR_PRESETS[src];
  if (src === 'custom') return S.lights.custom;
  if (src === 'album') return state.albumVivid;
  if (src === 'background') return state.bgVivid || state.albumVivid;
  return COLOR_PRESETS.rainbow;
}
window.currentDynamicColors = (src) => resolveLightColors(src);
function updateLights() {
  const c = resolveLightColors();
  if (c && c.length) Lights.setColors(c);
  else Lights.setColors(COLOR_PRESETS.rainbow);
  document.documentElement.style.setProperty('--rgb', `conic-gradient(from var(--angle), ${[...(c || COLOR_PRESETS.rainbow), (c || COLOR_PRESETS.rainbow)[0]].join(',')})`);
}

// ---------- backgrounds ----------
let slideTimer = null, slideList = [], slideIdx = 0;
function addBgLayer(styleFn) {
  const host = $('bg');
  const layer = document.createElement('div');
  layer.className = 'bg-layer';
  styleFn(layer);
  host.appendChild(layer);
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('show')));
  [...host.children].slice(0, -1).forEach((old) => { old.classList.remove('show'); setTimeout(() => old.remove(), 1700); });
}
function gradientFrom(c) {
  const [a, b, cc] = c.map((x) => `rgb(${x.join(',')})`);
  const dark = `rgb(${c[0].map((v) => Math.round(v * 0.35)).join(',')})`;
  return `radial-gradient(60% 70% at 18% 22%, ${a}, transparent 70%), radial-gradient(55% 65% at 85% 28%, ${b}, transparent 70%), radial-gradient(70% 60% at 55% 95%, ${cc}, transparent 70%), ${dark}`;
}
async function setImageBg(src) {
  const img = await loadImg(src);
  if (!img) return;
  try { state.bgVivid = vividPalette(img); } catch {}
  addBgLayer((l) => { l.classList.add('photo'); l.style.backgroundImage = `url("${src}")`; });
  updateLights();
}
async function applyBackground() {
  clearInterval(slideTimer); slideTimer = null;
  const src = S.bg.source;
  document.documentElement.style.setProperty('--bgBlur', (S.bg.blur * 60).toFixed(0) + 'px');
  document.documentElement.style.setProperty('--bgDim', S.bg.dim);
  document.body.classList.toggle('no-grain', !S.bg.grain);
  if (src === 'black') { state.bgVivid = null; addBgLayer((l) => (l.style.background = '#000')); updateLights(); return; }
  if (src === 'album') {
    state.bgVivid = state.albumVivid;
    if (state.albumBg) addBgLayer((l) => { l.classList.add('grad'); l.style.background = gradientFrom(state.albumBg); });
    updateLights(); return;
  }
  if (src === 'albumArt') { if (state.track?.artData) await setImageBg(state.track.artData); return; }
  if (!api) return;
  if (src === 'image' && S.bg.imagePath) { await setImageBg(await api.readImage(S.bg.imagePath, 2400)); return; }
  if (src === 'folder' && S.bg.folderPath) {
    slideList = (await api.listImages(S.bg.folderPath)).sort(() => Math.random() - 0.5);
    if (!slideList.length) return toast('No images in that folder');
    slideIdx = 0;
    const next = async () => { await setImageBg(await api.readImage(slideList[slideIdx++ % slideList.length], 2400)); };
    await next();
    slideTimer = setInterval(next, S.bg.slideSec * 1000);
  }
}

// ---------- word timing ----------
function wordTimes(idx) {
  const line = state.lines[idx];
  const words = line.text.split(' ');
  if (!S.lyrics.wordByWord) return words.map(() => line.t);
  if (line.words && line.words.length === words.length) return line.words.map((w) => w.t);
  const next = state.lines[idx + 1];
  const dur = next ? next.t - line.t : 3000;
  const reveal = Math.max(300, Math.min(dur * 0.72, 3400));
  return words.map((_, i) => line.t + (i * reveal) / words.length);
}
function fillWords(el, idx) {
  const line = state.lines[idx];
  const times = wordTimes(idx);
  const spans = [];
  line.text.split(' ').forEach((w, i, arr) => {
    const sp = document.createElement('span');
    sp.className = 'w'; sp.textContent = w; sp.dataset.t = times[i];
    if (line.words && line.words.length === arr.length) sp.dataset.exact = 1;
    el.appendChild(sp); spans.push(sp);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return spans;
}
const isGap = (idx) => { const t = state.lines[idx]?.text; return !t || t === '♪'; };

// ---------- lyric views ----------
const Views = {};

// 1) Messages (chat bubbles + photo cards)
Views.chat = {
  init() { $('lyrics').innerHTML = '<div class="feed" id="feed"></div>'; state.count = 0; },
  line(idx) {
    const feed = $('feed');
    const n = state.count++;
    const el = document.createElement('div');
    el.className = 'msg';
    let words = [];
    if (idx < 0 || isGap(idx)) {
      const last = feed.lastElementChild;
      if (last && last.querySelector('.typing') && !last.classList.contains('leaving')) return []; // already "typing"
      state.count--;
      el.classList.add('left');
      el.innerHTML = '<div class="bubble gray typing"><span></span><span></span><span></span></div>';
    } else {
      const text = state.lines[idx].text;
      const h = hash((state.track?.id || 'x') + ':' + idx);
      const every = S.lyrics.cardEvery;
      const asCard = S.lyrics.cardPhotos !== 'off' && n % every === 0 && text.length > 14;
      if (asCard) {
        el.classList.add(n % (every * 2) === 0 ? 'left' : 'right');
        const [place, query] = PLACES[h % PLACES.length];
        el.innerHTML = `
          <div class="card">
            <div class="photo"><span class="stamp">${STAMPS[(h >> 5) % STAMPS.length]}</span></div>
            <div class="body"><div class="line"></div><div class="loc">📍 ${place}</div></div>
          </div>`;
        const ph = el.querySelector('.photo');
        if (state.albumBg) ph.style.background = gradientFrom(state.albumBg);
        cardPhoto(query, h).then((src) => { if (src) { ph.style.backgroundImage = `url("${src}")`; ph.classList.add('loaded'); } });
        words = fillWords(el.querySelector('.line'), idx);
      } else {
        const right = n % 2 === 1;
        el.classList.add(right ? 'right' : 'left');
        const b = document.createElement('div');
        b.className = 'bubble ' + (right ? 'blue' : 'gray');
        words = fillWords(b, idx);
        el.appendChild(b);
      }
    }
    feed.appendChild(el);
    const live = [...feed.children].filter((m) => !m.classList.contains('leaving'));
    live.forEach((m, i) => {
      const age = live.length - 1 - i;
      m.classList.toggle('old', age === 1 || age === 2);
      m.classList.toggle('older', age >= 3);
      if (age >= 4) { m.classList.add('leaving'); setTimeout(() => m.remove(), 700); }
    });
    return words;
  },
};

// 2) Scroll (Apple Music-style list)
Views.scroll = {
  init() {
    const host = $('lyrics');
    host.innerHTML = '<div class="scroll-list" id="slist"></div>';
    const list = $('slist');
    state.lines.forEach((l, i) => {
      const d = document.createElement('div');
      d.className = 'sline'; d.dataset.i = i;
      if (isGap(i)) d.innerHTML = '<span class="gap"><span></span><span></span><span></span></span>';
      else fillWords(d, i);
      list.appendChild(d);
    });
  },
  line(idx) {
    const list = $('slist');
    if (!list) return [];
    const els = list.children;
    let target = null;
    for (const d of els) {
      const i = +d.dataset.i;
      const dist = Math.min(5, Math.abs(i - idx));
      d.style.setProperty('--d', dist);
      d.classList.toggle('active', i === idx);
      d.classList.toggle('past', i < idx);
      if (i === Math.max(0, idx)) target = d;
    }
    if (target) list.style.transform = `translateY(${-(target.offsetTop + target.offsetHeight / 2) + window.innerHeight * 0.42}px)`;
    return target && idx >= 0 ? [...target.querySelectorAll('.w')] : [];
  },
};

// 3) Karaoke (previous / current / next, current fills word by word)  4) Minimal (one line)
function stackView(kind) {
  return {
    init() { $('lyrics').innerHTML = `<div class="stack ${kind}" id="stack"></div>`; },
    line(idx) {
      const host = $('stack');
      [...host.children].forEach((c) => {
        if (c.classList.contains('cur')) { c.classList.replace('cur', 'prev'); }
        else if (c.classList.contains('prev')) { c.classList.replace('prev', 'gone'); setTimeout(() => c.remove(), 700); }
        else if (c.classList.contains('next')) c.remove();
      });
      const mk = (i, cls) => {
        const d = document.createElement('div');
        d.className = 'kline ' + cls;
        let w = [];
        if (i < 0 || isGap(i)) d.innerHTML = '<span class="gap"><span></span><span></span><span></span></span>';
        else w = fillWords(d, i);
        host.appendChild(d);
        return w;
      };
      const words = mk(idx, 'cur enter');
      requestAnimationFrame(() => host.querySelector('.enter')?.classList.remove('enter'));
      if (kind === 'focus' && state.lines[idx + 1]) mk(idx + 1, 'next');
      return words;
    },
  };
}
Views.focus = stackView('focus');
Views.minimal = stackView('minimal');
Views.chat.font = Views.scroll.font = Views.focus.font = Views.minimal.font = 'system';
Object.assign(Views, ExtraViews);

// The style actually on screen: Auto-Vibe's pick for this song, or the one the user chose
function curStyle() { return S.lyrics.style === 'auto' ? (state.autoStyle || 'chat') : S.lyrics.style; }
window.curStyle = curStyle;
window.lwState = state;

// fonts: 'auto' uses each style's own font
const FONT_STACKS = {
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", sans-serif',
  archivo: '"LW Archivo", sans-serif', unbounded: '"LW Unbounded", sans-serif', space: '"LW Space", sans-serif',
  fraunces: '"LW Fraunces", Georgia, serif', playfair: '"LW Playfair", Georgia, serif', instrument: '"LW Instrument", Georgia, serif',
  bebas: '"LW Bebas", Impact, sans-serif', mono: '"LW Mono", ui-monospace, Menlo, Consolas, monospace',
  neon: '"LW Neon", sans-serif', caveat: '"LW Caveat", cursive', doto: '"LW Doto", ui-monospace, monospace',
};
function applyLyricFont() {
  const v = Views[curStyle()] || Views.chat;
  const key = S.lyrics.font && S.lyrics.font !== 'auto' ? S.lyrics.font : v.font || 'system';
  document.documentElement.style.setProperty('--lf', FONT_STACKS[key] || FONT_STACKS.system);
  document.body.dataset.font = key;
}

// small line under the player in Cover / Vinyl
const ArtLyric = {
  line(idx) {
    const host = $('artLyric');
    [...host.children].forEach((c) => { c.classList.add('gone'); setTimeout(() => c.remove(), 600); });
    if (idx < 0 || isGap(idx)) return [];
    const d = document.createElement('div'); d.className = 'al';
    const w = fillWords(d, idx); host.appendChild(d);
    return w;
  },
};

function renderLyrics(fresh) {
  const v = Views[curStyle()] || Views.chat;
  document.body.dataset.lyrics = curStyle();
  if (fresh) {
    $('lyrics').innerHTML = ''; $('lyrics').className = 'lyrics lyr-' + curStyle();
    applyLyricFont();
    if (state.lines.length || !v.needsLines) v.init();
    $('artLyric').innerHTML = '';
    if (window.anime) anime.animate('#lyrics', { opacity: [0, 1], scale: [0.97, 1], duration: 600, ease: 'outExpo' });
  }
  const idx = state.idx < -1 ? -1 : state.idx;
  if (!state.lines.length) return;
  state.liveWords = [...v.line(idx), ...ArtLyric.line(idx)];
  updateWords(true);
}
function updateWords(force) {
  const p = lyricPos();
  const v = Views[curStyle()];
  for (const w of state.liveWords) {
    const on = +w.dataset.t <= p;
    const was = w.classList.contains('on');
    if (on !== was || force) w.classList.toggle('on', on);
    if (on && !w.dataset.fired) {
      w.dataset.fired = 1;
      const fresh = p - +w.dataset.t < 700; // skip effects for words that were already over when they appeared
      if (fresh) FX.onWordOn(w);
      if (w.isConnected && $('lyrics').contains(w)) try { v?.onWord?.(w); } catch (e) { console.warn(e); }
    }
  }
}

// ---------- card photos ----------
async function cardPhoto(query, h) {
  const mode = S.lyrics.cardPhotos;
  try {
    if (mode === 'places') return api ? await api.placePhoto(query) : DEMO.photo(h);
    if (mode === 'folder' && api) {
      if (!state.cardFolderList.length && S.lyrics.cardFolder) state.cardFolderList = await api.listImages(S.lyrics.cardFolder);
      const list = state.cardFolderList;
      return list.length ? await api.readImage(list[h % list.length], 900) : state.track?.artData;
    }
  } catch {}
  return state.track?.artData || '';
}

// ---------- tick ----------
function tick() {
  const tr = state.track;
  if (tr) {
    const pos = currentPosition();
    $('barFill').style.width = (100 * pos / tr.durationMs).toFixed(2) + '%';
    $('tCur').textContent = fmt(pos);
    if (state.lines.length) {
      const p = lyricPos();
      let idx = -1;
      for (let i = 0; i < state.lines.length; i++) { if (state.lines[i].t <= p) idx = i; else break; }
      if (idx !== state.idx) {
        const jumped = idx < state.idx || idx - state.idx > 3;
        state.liveWords.forEach((w) => w.classList.add('on'));
        if (jumped && curStyle() === 'chat') { [...$('lyrics').querySelectorAll('.msg')].forEach((m) => { m.classList.add('leaving'); setTimeout(() => m.remove(), 700); }); state.count = 0; }
        state.idx = idx;
        renderLyrics(false);
      }
      updateWords();
    }
    if (S.mode === 'lyrics') { const v = Views[curStyle()]; try { v?.frame?.(performance.now()); } catch (e) { console.warn(e); } }
  }
  requestAnimationFrame(tick);
}

// ---------- track handling ----------
async function onNewTrack(tr) {
  state.track = tr; state.lines = []; state.idx = -2;
  if (state.tempMode) { state.tempMode = null; showModeClasses(S.mode); }   // back to the user's mode after a no-lyrics song
  if (document.body.classList.contains('settings-open')) setTimeout(renderSettings, 1500);
  $('idle').classList.add('hidden');
  $('player').classList.remove('hidden');
  $('title').textContent = tr.title; $('artist').textContent = tr.artist;
  $('tDur').textContent = fmt(tr.durationMs);
  updatePlayingUI();

  const artData = api && tr.art ? await api.fetchImage(tr.art) : tr.art;
  if (state.track !== tr) return;
  tr.artData = artData;
  document.querySelectorAll('.art-src').forEach((img) => { img.src = artData || ''; });
  showNowPill(tr);
  const img = await loadImg(artData);
  if (img) {
    try {
      state.albumBg = bgPalette(img); state.albumVivid = vividPalette(img);
      const c1 = state.albumBg[0].map((v) => Math.min(255, Math.round(v * 1.6))).join(', ');
      document.documentElement.style.setProperty('--c1', c1);
    } catch {}
  }
  if (S.bg.source === 'album' || S.bg.source === 'albumArt') applyBackground(); else updateLights();
  if (S.lyrics.cardPhotos === 'places' && api) [0, 1, 2].forEach(() => api.placePhoto(PLACES[Math.floor(Math.random() * PLACES.length)][1]));

  const lyr = api ? await api.lyrics(tr) : DEMO.lyrics;
  if (state.track !== tr) return;
  if (lyr.synced) state.lines = parseLRC(lyr.synced);
  else if (lyr.plain) {
    const ls = lyr.plain.split('\n').map((s) => s.trim()).filter(Boolean);
    const start = 12000, span = tr.durationMs - start - 10000;
    state.lines = ls.map((text, i) => ({ t: start + (span * i) / ls.length, text }));
    toast('No synced lyrics — approximate timing');
  } else {
    state.lines = [{ t: 0, text: lyr.instrumental ? '♪ instrumental ♪' : '♪' }];
    if (S.lyrics.noLyrics === 'cover' && S.mode === 'lyrics') { state.tempMode = 'cover'; showModeClasses('cover'); toast(lyr.instrumental ? 'Instrumental: showing the cover' : 'No lyrics for this one: showing the cover'); }
    else if (!lyr.instrumental) toast('No lyrics found for this one');
  }
  await decideVibe(tr);
  if (state.track !== tr) return;
  state.liveWords = [];
  renderLyrics(true);
}

// Auto-Vibe: choose a style for this song from its artist's genres + the lyrics
async function decideVibe(tr) {
  let genres = [];
  try { genres = api ? await api.artistGenres(tr.artistId) : DEMO.genres; } catch {}
  const v = Vibe.classify({ genres, lines: state.lines, explicit: tr.explicit, title: tr.title });
  state.vibe = v;
  state.autoStyle = Vibe.pick(v.vibe, tr.id);
  if (S.lyrics.style === 'auto' && !document.body.classList.contains('embed'))
    setTimeout(() => toast(`Auto-Vibe: ${styleInfo(state.autoStyle)[1]} (${v.label})`), 900);
}

async function poll() {
  if (state.polling) return; state.polling = true;
  try {
    const np = api ? await api.nowPlaying() : DEMO.nowPlaying();
    if (np.error === 'auth') { showSetup(); $('setupMsg').textContent = 'Spotify needs you to connect again. Your settings are kept.'; return; }
    setConnection(np.error);
    if (np.error) return;
    state.device = np.device || null;
    if (np.idle) { showIdle(np.reason); return; }
    document.body.classList.remove('is-idle');
    if (!state.track || state.track.id !== np.id) await onNewTrack(np);
    else if (Date.now() > state.holdUntil) {
      Object.assign(state.track, { progressMs: np.progressMs, playing: np.playing, fetchedAt: np.fetchedAt });
      updatePlayingUI();
    }
    if (state.track && np.device) {
      $('device').textContent = np.device.name ? 'on ' + np.device.name : '';
    }
  } finally { state.polling = false; }
}

// ---------- idle screen + connection ----------
function showIdle(reason) {
  if (state.track) { state.track = null; state.lines = []; $('lyrics').innerHTML = ''; $('artLyric').innerHTML = ''; }
  document.body.classList.add('is-idle');
  $('player').classList.add('hidden'); $('idle').classList.remove('hidden');
  $('idleText').textContent = {
    podcast: 'Podcasts don\'t have lyrics. Play a song to bring the wall back.',
    ad: 'Ad break. The lyrics are back after it.',
  }[reason] || 'Play something on Spotify';
  updateClock();
}
function updateClock() {
  const d = new Date();
  $('idleClock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('idleDate').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
setInterval(() => { if (document.body.classList.contains('is-idle')) updateClock(); }, 10000);
let connWarned = null;
function setConnection(err) {
  const msg = err === 'offline' ? 'Can\'t reach Spotify. Retrying…' : err === 'ratelimit' ? 'Spotify asked LyricWall to slow down. Back in a few seconds.' : null;
  if (msg && connWarned !== err) toast(msg);
  connWarned = msg ? err : null;
  document.body.classList.toggle('is-offline', err === 'offline');
}

// ---------- modes ----------
const MODES = ['lyrics', 'cover', 'vinyl'];
function showModeClasses(m) {
  MODES.forEach((x) => document.body.classList.toggle('mode-' + x, x === m));
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
}
function setMode(m) {
  if (!MODES.includes(m)) m = 'lyrics';
  state.tempMode = null;
  showModeClasses(m);
  sset('mode', m);
}
function cycleMode() {
  const next = MODES[(MODES.indexOf(S.mode) + 1) % MODES.length];
  setMode(next); toast(next[0].toUpperCase() + next.slice(1) + ' mode');
}
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
$('gear').onclick = () => openSettings();
$('settingsClose').onclick = () => openSettings(false);

// ---------- playback controls ----------
function updatePlayingUI() {
  const playing = !!state.track?.playing;
  $('icoPlay').classList.toggle('hidden', playing);
  $('icoPause').classList.toggle('hidden', !playing);
  $('record').classList.toggle('spinning', playing);
}
async function control(act, arg) {
  const tr = state.track;
  if (!tr) return;
  if (act === 'toggle') act = tr.playing ? 'pause' : 'play';
  if (act === 'seek') { tr.progressMs = arg; tr.fetchedAt = Date.now(); state.holdUntil = Date.now() + 1500; state.idx = -2; }
  if (act === 'volume') {
    if (!state.device) return toast('No active Spotify device');
    if (state.device.canVolume === false) return toast('This device doesn\'t allow volume control');
    arg = Math.max(0, Math.min(100, arg)); state.device.volume = arg; toast(`Volume ${arg}%`);
  }
  if (act === 'play' || act === 'pause') {
    tr.progressMs = currentPosition(); tr.fetchedAt = Date.now(); tr.playing = act === 'play';
    state.holdUntil = Date.now() + 1500; updatePlayingUI();
  }
  if (!api) { if (act === 'next' || act === 'previous') toast('Demo mode'); return; }
  const r = await api.control(act, arg);
  if (!r.ok) { toast(r.error); state.holdUntil = 0; }
  setTimeout(poll, 450);
}
document.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => control(b.dataset.act)));

// click or drag the progress bar to jump in the song
{
  const bar = document.querySelector('.p-progress .bar');
  let dragging = false;
  const at = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
  const preview = (e) => { if (state.track) $('barFill').style.width = at(e) * 100 + '%'; };
  bar.addEventListener('pointerdown', (e) => { if (!state.track) return; dragging = true; bar.setPointerCapture(e.pointerId); preview(e); });
  bar.addEventListener('pointermove', (e) => { if (dragging) preview(e); });
  bar.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; control('seek', at(e) * state.track.durationMs); });
}

// ---------- beat engine ----------
const beat = { analyser: null, data: null, stream: null, ctx: null, hist: [], pulse: 0, last: 0, value: 0 };
async function startAudio() {
  if (beat.analyser) return true;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    stream.getVideoTracks().forEach((t) => t.stop());
    if (!stream.getAudioTracks().length) throw new Error('no audio');
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.6;
    ctx.createMediaStreamSource(stream).connect(an);
    Object.assign(beat, { stream, analyser: an, data: new Uint8Array(an.frequencyBinCount), ctx });
    window.LW.spectrum = beat.data;
    return true;
  } catch { return false; }
}
function stopAudio() {
  beat.stream?.getTracks().forEach((t) => t.stop()); beat.ctx?.close();
  Object.assign(beat, { stream: null, analyser: null, ctx: null }); window.LW.spectrum = null;
}
async function setBeat(on, quiet) {
  if (S.beat.enabled !== on) sset('beat.enabled', on);
  $('beatBtn').classList.toggle('on', on);
  if (on && api) { const ok = await startAudio(); if (!quiet) toast(ok ? 'Reacting to your music 🔊' : 'Couldn’t hear system audio — using auto pulse'); }
  else if (!on) { stopAudio(); if (!quiet) toast('Beat off'); }
}
$('beatBtn').onclick = () => setBeat(!S.beat.enabled);

function beatFrame() {
  const now = performance.now();
  const playing = !!state.track?.playing;
  let target = 0;
  if (S.beat.enabled && playing) {
    if (beat.analyser) {
      beat.analyser.getByteFrequencyData(beat.data);
      FX.sample(beat.data);
      if (!beat.td) beat.td = new Uint8Array(beat.analyser.fftSize);
      beat.analyser.getByteTimeDomainData(beat.td); window.LW.wave = beat.td;
      const bass = (beat.data[1] + beat.data[2] + beat.data[3] + beat.data[4]) / 4;
      beat.hist.push(bass); if (beat.hist.length > 45) beat.hist.shift();
      const avg = beat.hist.reduce((a, b) => a + b, 0) / beat.hist.length;
      const sens = S.beat.sensitivity;
      if (bass > avg * (1.32 - sens * 0.28) && bass > 85 - sens * 55 && now - beat.last > 240) { beat.pulse = 1; beat.last = now; }
      target = Math.max(beat.pulse, (bass / 255) * 0.35);
    } else {
      const period = 60000 / 112, ph = (currentPosition() % period) / period;
      target = Math.exp(-ph * 5) * (0.5 + S.beat.sensitivity * 0.5);
    }
  }
  beat.pulse *= 0.86;
  beat.value += (target - beat.value) * (target > beat.value ? 0.6 : 0.18);
  window.LW.beat = beat.value;
  document.documentElement.style.setProperty('--beat', beat.value.toFixed(3));
  document.documentElement.style.setProperty('--artBeat', S.beat.pulseArt ? beat.value.toFixed(3) : 0);
  requestAnimationFrame(beatFrame);
}

// ---------- settings changes ----------
window.onSetting = (key, v) => {
  if (key.startsWith('lights.')) updateLights();
  if (key.startsWith('bg.')) applyBackground();
  if (key === 'beat.enabled') setBeat(v);
  if (key === 'lyrics.style' || key === 'lyrics.wordByWord' || key === 'lyrics.cardPhotos') { state.liveWords = []; renderLyrics(true); }
  if (key === 'lyrics.cardFolder') state.cardFolderList = [];
  if (key === 'lyrics.font') applyLyricFont();
  if (key === 'window.launchFullscreen') api?.setPref('launchFullscreen', v);
  if (key === 'window.openAtLogin') api?.loginItem(!!v);
  if (key === 'lyrics.size') document.documentElement.style.setProperty('--lyricScale', v);
  if (key === 'lyrics.onArtModes') document.body.classList.toggle('no-art-lyrics', !v);
  if (key.startsWith('player.')) applyPlayerPrefs();
  if (key === 'window.onTop') api?.setOnTop(v);
};
function applyPlayerPrefs() {
  document.body.classList.toggle('player-off', !S.player.show);
  document.body.classList.toggle('autohide', S.player.autoHide);
}
let idleTimer;
function wake() {
  document.body.classList.remove('ui-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!document.body.classList.contains('settings-open')) document.body.classList.add('ui-idle'); }, 3000);
}
window.addEventListener('mousemove', wake);

// ---------- setup / auth ----------
function friendlyError(e = '') {
  if (/redirect/i.test(e)) return 'Spotify says the Redirect URI doesn’t match. Make sure you added exactly http://127.0.0.1:8888/callback in your Spotify app settings.';
  if (/client/i.test(e)) return 'That Client ID didn’t work. Copy it again from your Spotify app page (it’s 32 letters and numbers).';
  if (/EADDRINUSE/.test(e)) return 'Something else is using port 8888. Close other copies of LyricWall and try again.';
  if (/access_denied/.test(e)) return 'Spotify login was cancelled. Click Connect to try again.';
  return e || 'Something went wrong. Try again.';
}
function showSetup(err) { $('setup').classList.remove('hidden'); if (err) $('setupErr').textContent = err; }
$('connect').onclick = async () => {
  const id = $('clientId').value.trim();
  if (!id) return ($('setupErr').textContent = 'Paste your Client ID first');
  $('setupErr').textContent = 'A browser tab opened. Log in and click Agree, then come back here…';
  const r = await api.login(id);
  if (r.ok) { $('setup').classList.add('hidden'); $('setupErr').textContent = ''; poll(); }
  else $('setupErr').textContent = friendlyError(r.error);
};

document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => (api ? api.openExternal(b.dataset.open) : window.open(b.dataset.open))));
$('copyRedir').onclick = async () => { try { await navigator.clipboard.writeText($('redir').textContent); $('copyRedir').textContent = 'Copied!'; setTimeout(() => ($('copyRedir').textContent = 'Copy'), 1500); } catch {} };

// ---------- keys ----------
window.addEventListener('keydown', async (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;   // typing / choosing in settings
  if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;      // let the focused button handle it
  if (e.metaKey || e.ctrlKey || e.altKey) return;                           // leave menu shortcuts alone
  const k = e.key.toLowerCase();
  if (k === '?' || (k === '/' && e.shiftKey)) { toggleHelp(); return; }
  if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); control('volume', (state.device?.volume ?? 50) + (k === 'arrowup' ? 10 : -10)); return; }
  if (k === 'escape') {
    if (document.body.classList.contains('settings-open')) openSettings(false);
    else if (api && (await api.isFullscreen())) api.setFullscreen(false);
  }
  if (k === 's' || k === ',') openSettings();
  if (k === 'm') cycleMode();
  if (k === 'l') nextStyle(e.shiftKey ? -1 : 1);
  if (k === 'c') { const order = ['album', 'background', ...Object.keys(COLOR_PRESETS), 'custom']; sset('lights.colors', order[(order.indexOf(S.lights.colors) + 1) % order.length]); toast('Lights: ' + S.lights.colors); }
  if (k === 'e') { const st = ['flow', 'chase', 'spectrum', 'breathe', 'static']; sset('lights.style', st[(st.indexOf(S.lights.style) + 1) % st.length]); toast('Effect: ' + S.lights.style); }
  if (k === ' ') { e.preventDefault(); control('toggle'); }
  if (k === 'arrowright') control('next');
  if (k === 'arrowleft') control('previous');
  if (k === 'b') setBeat(!S.beat.enabled);
  if (k === 'f' && api) api.toggleFullscreen();
  if (k === 't') { sset('window.onTop', !S.window.onTop); toast('Always on top: ' + (S.window.onTop ? 'ON' : 'OFF')); }
  if (k === 'q' && api && !e.metaKey) api.quit();
  if ((k === '[' || k === ']') && state.track) {
    // timing is remembered per song
    const id = state.track.id; songOffsets[id] = (songOffsets[id] || 0) + (k === ']' ? 250 : -250);
    if (!songOffsets[id]) delete songOffsets[id];
    try { localStorage.setItem('lw-song-offsets', JSON.stringify(songOffsets)); } catch {}
    const v = songOffsets[id] || 0; toast(`Timing for this song ${v > 0 ? '+' : ''}${(v / 1000).toFixed(2)}s`);
  }
  if (k === 'escape' && $('help').classList.contains('show')) toggleHelp(false);
  if (document.body.classList.contains('settings-open')) renderSettings();
});

function toggleHelp(show) {
  const h = $('help'); const v = show ?? !h.classList.contains('show');
  h.classList.toggle('show', v);
  if (v && window.anime) anime.animate('#help .help-card', { opacity: [0, 1], scale: [0.95, 1], duration: 400, ease: 'outExpo' });
}
$('help').addEventListener('click', (e) => { if (e.target.id === 'help') toggleHelp(false); });
$('helpBtn').onclick = () => toggleHelp();

function nextStyle(dir = 1) {
  const keys = ['auto', ...STYLE_LIST.map((x) => x[0]).filter((k) => k !== 'auto')];
  const next = keys[(keys.indexOf(S.lyrics.style) + dir + keys.length) % keys.length];
  sset('lyrics.style', next);
  if (S.mode !== 'lyrics') setMode('lyrics');
  toast(next === 'auto' ? `Auto-Vibe: ${styleInfo(curStyle())[1]}` : styleInfo(next)[1]);
}

// "Now playing" pop when the song changes (lyrics mode, where the player is small)
function showNowPill(tr) {
  const p = $('nowPill');
  if (!window.anime || S.mode !== 'lyrics' || document.body.classList.contains('embed')) return;
  p.querySelector('img').src = tr.artData || '';
  p.querySelector('b').textContent = tr.title; p.querySelector('span').textContent = tr.artist;
  anime.createTimeline()
    .add(p, { opacity: [0, 1], y: [-30, 0], scale: [0.9, 1], duration: 600, ease: 'outBack(1.4)' })
    .add(p, { opacity: 0, y: -20, duration: 500, ease: 'inQuad' }, 3600);
}

// ---------- app menu, screens, updates ----------
function showUpdateBanner(st) {
  const b = $('updBanner');
  if (st.state === 'ready' || st.state === 'available') {
    b.querySelector('.ub-text').textContent = st.state === 'ready' ? `LyricWall ${st.version} is ready` : `LyricWall ${st.version} is out`;
    b.querySelector('.ub-btn').textContent = st.state === 'ready' ? 'Restart' : 'Download';
    b.classList.add('show');
  } else b.classList.remove('show');
}
if (api) {
  api.on('menu', (a) => {
    if (a === 'settings') openSettings(true);
    else if (a === 'nextStyle') nextStyle(1);
    else if (a.startsWith('mode:')) setMode(a.slice(5));
  });
  api.on('displays', (d) => { UI.displays = d; if (document.body.classList.contains('settings-open')) renderSettings(); });
  api.on('update', (st) => { UI.update = st; showUpdateBanner(st); if (document.body.classList.contains('settings-open')) renderSettings(); });
  api.on('onTop', (v) => { if (S.window.onTop !== v) sset('window.onTop', v); });
  api.on('fullscreen', (v) => document.body.classList.toggle('is-fullscreen', v));
  $('updBanner').querySelector('.ub-btn').onclick = () => api.installUpdate();
  $('updBanner').querySelector('.ub-x').onclick = () => $('updBanner').classList.remove('show');
}

// ---------- demo mode (open index.html in a browser, no Spotify) ----------
const DEMO = (() => {
  const start = Date.now();
  const lines = [
    [3, ''], [6, 'City lights are blinking through the window'], [10, 'I been working through the night again'],
    [14, 'Coffee cold but the playlist keeps on going'], [18, 'Every song a postcard from a friend'],
    [22, 'Took the long way home across the river'], [26, 'Neon on the water, pink and blue'],
    [30, 'Every block I pass, I think of summer'], [34, 'Every summer, somehow, think of you'],
    [38, ''], [42, 'Turn it up, the monitor is glowing'], [46, 'Lines are falling like a text I sent'],
  ];
  const svg = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
  const art = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3fa4"/><stop offset=".55" stop-color="#ff8a3d"/><stop offset="1" stop-color="#5b2bff"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="160" r="70" fill="#2a1240" opacity=".55"/><circle cx="125" cy="145" r="12" fill="#fff"/><circle cx="175" cy="145" r="12" fill="#fff"/></svg>`);
  const photo = (h) => {
    const hue = h % 360;
    let b = ''; for (let i = 0; i < 14; i++) { const w = 30 + ((h >> i) % 40), x = i * 45, ht = 60 + ((h * (i + 3)) % 140); b += `<rect x="${x}" y="${300 - ht}" width="${w}" height="${ht}" fill="#0b0b18"/>`; for (let j = 0; j < 6; j++) b += `<rect x="${x + 6 + (j % 2) * 12}" y="${310 - ht + j * 18}" width="5" height="7" fill="hsl(${(hue + 40) % 360},90%,70%)" opacity=".8"/>`; }
    return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,25%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},90%,60%)"/></linearGradient></defs><rect width="600" height="300" fill="url(#s)"/><circle cx="430" cy="120" r="40" fill="hsl(${(hue + 60) % 360},100%,80%)" opacity=".8"/>${b}</svg>`);
  };
  return {
    photo,
    genres: ['indie pop'],
    lyrics: { synced: lines.map(([s, t]) => `[00:${String(s).padStart(2, '0')}.00]${t}`).join('\n') },
    nowPlaying: () => ({
      id: 'demo', title: 'Neon Postcards', artist: 'Demo Artist', mainArtist: 'Demo Artist', album: 'Demo', art,
      durationMs: 52000,
      progressMs: state.track && !state.track.playing ? state.track.progressMs : (Date.now() - start + (+new URLSearchParams(location.search).get('t') || 0) * 1000) % 52000,
      playing: state.track ? state.track.playing : true, fetchedAt: Date.now(),
    }),
  };
})();

// ---------- boot ----------
(async function boot() {
  const qs = new URLSearchParams(location.search);
  for (const [k, v] of qs) if (k.includes('.')) sset(k, isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v); // demo overrides
  setMode(qs.get('mode') || S.mode);
  if (qs.has('embed')) {
    document.body.classList.add('embed');
    // the website's live demo switches looks by message, without reloading
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.type !== 'lw-set' || typeof d.settings !== 'object') return;
      for (const [k, v] of Object.entries(d.settings)) {
        if (k === 'mode') setMode(v);
        else if (/^(lights|lyrics|beat|bg)\.[a-zA-Z]+$/.test(k) && sget(k) !== v) sset(k, v);
      }
    });
  }
  if (qs.has('setup')) showSetup();
  document.documentElement.style.setProperty('--lyricScale', S.lyrics.size);
  document.body.classList.toggle('no-art-lyrics', !S.lyrics.onArtModes);
  applyPlayerPrefs();
  $('beatBtn').classList.toggle('on', S.beat.enabled);
  updateLights();
  applyBackground();
  requestAnimationFrame(beatFrame);
  requestAnimationFrame(tick);
  wake();
  if (api) {
    if (S.window.onTop) api.setOnTop(true);
    api.setPref('launchFullscreen', !!S.window.launchFullscreen);
    document.body.classList.add('is-app', 'os-' + ((await api.appInfo()).platform || ''));
    const s = await api.status();
    $('clientId').value = s.clientId;
    if (!s.loggedIn) showSetup();
    else if (s.needsReauth) { showSetup(); $('setupMsg').textContent = 'New features need one more Spotify permission (playback controls). Reconnect below.'; }
    if (S.beat.enabled && !(await startAudio())) {
      const retry = async () => { window.removeEventListener('pointerdown', retry); if (S.beat.enabled) await startAudio(); };
      window.addEventListener('pointerdown', retry);
    }
  }
  await poll();
  setInterval(poll, 1500);
})();
