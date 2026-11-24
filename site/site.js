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
{
  const first = os || 'mac', second = first === 'mac' ? 'win' : 'mac';
  document.querySelectorAll('[data-dl^="primary"]').forEach((a) => { a.textContent = label[first]; a.href = DL[first]; });
  document.querySelectorAll('[data-dl^="secondary"]').forEach((a) => { a.textContent = label[second]; a.href = DL[second]; });
}
document.querySelectorAll('[data-dl="mac"]').forEach((a) => (a.href = DL.mac));
document.querySelectorAll('[data-dl="win"]').forEach((a) => (a.href = DL.win));
document.querySelectorAll('[data-repo]').forEach((a) => (a.href = `https://github.com/${REPO}`));
// After a download starts, point people at the setup guide
document.querySelectorAll('[data-dl]').forEach((a) => a.addEventListener('click', () => {
  if (!document.body.classList.contains('home')) return;
  setTimeout(() => { location.href = 'setup.html#' + (a.href.includes('Mac') ? 'mac' : 'windows'); }, 900);
}));

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
