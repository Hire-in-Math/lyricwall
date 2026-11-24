// ---- Config: set this to your GitHub repo once it exists ----
const REPO = 'Hire-in-Math/lyricwall';
const DL = {
  mac: `https://github.com/${REPO}/releases/latest/download/LyricWall-Mac.dmg`,
  win: `https://github.com/${REPO}/releases/latest/download/LyricWall-Windows-Setup.exe`,
};

// Download buttons: put the visitor's OS first
const ua = navigator.userAgent;
const os = /Windows/i.test(ua) ? 'win' : /Mac/i.test(ua) ? 'mac' : null;
const label = { mac: 'Download for Mac', win: 'Download for Windows' };
const primary = document.querySelector('[data-dl="primary"]');
const secondary = document.querySelector('[data-dl="secondary"]');
if (primary && secondary) {
  const first = os || 'mac', second = first === 'mac' ? 'win' : 'mac';
  primary.textContent = label[first]; primary.href = DL[first];
  secondary.textContent = label[second]; secondary.href = DL[second];
}
document.querySelectorAll('[data-dl="mac"]').forEach((a) => (a.href = DL.mac));
document.querySelectorAll('[data-dl="win"]').forEach((a) => (a.href = DL.win));
document.querySelectorAll('[data-repo]').forEach((a) => (a.href = `https://github.com/${REPO}`));
// After a download starts, point people at the setup guide
document.querySelectorAll('[data-dl]').forEach((a) => a.addEventListener('click', () => {
  if (!document.body.classList.contains('home')) return;
  setTimeout(() => { location.href = 'setup.html#' + (a.href.includes('Mac') ? 'mac' : 'windows'); }, 900);
}));

// Headline reveals word by word, like the app's lyrics
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('[data-words]').forEach((h) => {
  const words = h.textContent.trim().split(/\s+/);
  h.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'wd'; s.textContent = w;
    s.style.animationDelay = reduce ? '0s' : 300 + i * 260 + 'ms';
    h.append(s, i < words.length - 1 ? ' ' : '');
  });
});

// Scale the 1600x1000 app demo to fit the monitor
const screen = document.getElementById('screen');
const frame = document.getElementById('demo');
if (screen && frame) {
  const fit = () => { frame.style.transform = `scale(${screen.clientWidth / 1600})`; };
  new ResizeObserver(fit).observe(screen); fit();

  // Style switcher under the monitor
  const tabs = document.querySelectorAll('[data-demo]');
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', x === b));
    frame.src = `app/index.html?embed=1&t=5&lights.style=flow&lights.colors=rainbow&${b.dataset.demo}`;
  }));
}

// Setup guide: Mac / Windows tabs
const osTabs = document.querySelectorAll('[data-os]');
if (osTabs.length) {
  const show = (which) => {
    osTabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.os === which));
    document.querySelectorAll('[data-os-panel]').forEach((p) => (p.hidden = p.dataset.osPanel !== which));
  };
  osTabs.forEach((t) => t.addEventListener('click', () => { show(t.dataset.os); history.replaceState(null, '', '#' + (t.dataset.os === 'mac' ? 'mac' : 'windows')); }));
  const hash = location.hash.replace('#', '');
  show(hash === 'windows' ? 'win' : hash === 'mac' ? 'mac' : os || 'mac');
}
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => (b.textContent = t), 1400); } catch {}
}));
