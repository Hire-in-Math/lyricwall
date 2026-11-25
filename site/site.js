// ---- Config: set this to your GitHub repo once it exists ----
const REPO = 'Hire-in-Math/lyricwall';
// Your Buy Me a Coffee page, e.g. 'https://buymeacoffee.com/yourname'. Leave empty to hide the coffee buttons.
const COFFEE = '';
const ISSUES = `https://github.com/${REPO}/issues`;
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

// ---- Support: issue forms, coffee, and the floating help button ----
document.querySelectorAll('[data-issue]').forEach((a) => { a.href = `${ISSUES}/new?template=${a.dataset.issue}`; a.target = '_blank'; a.rel = 'noopener'; });
document.querySelectorAll('[data-issues]').forEach((a) => { a.href = `${ISSUES}?q=is%3Aissue+sort%3Areactions-%2B1-desc`; a.target = '_blank'; a.rel = 'noopener'; });
document.querySelectorAll('[data-coffee]').forEach((a) => (a.href = COFFEE));
document.querySelectorAll('[data-coffee-block], [data-coffee]').forEach((n) => (n.hidden = !COFFEE));

if (!document.body.classList.contains('support-page')) {
  const fab = document.createElement('div');
  fab.className = 'help-fab';
  fab.innerHTML = `
    <div class="help-pop" id="helpPop" role="menu" hidden>
      <p class="help-pop-title">Need a hand?</p>
      <a role="menuitem" href="${ISSUES}/new?template=bug.yml" target="_blank" rel="noopener"><b>Report a problem</b><span>Something's not working</span></a>
      <a role="menuitem" href="${ISSUES}/new?template=feature.yml" target="_blank" rel="noopener"><b>Suggest a feature</b><span>New styles, lights, anything</span></a>
      <a role="menuitem" href="support.html#fixes"><b>Quick fixes</b><span>Common problems, solved</span></a>
      ${COFFEE ? `<a role="menuitem" class="pop-coffee" href="${COFFEE}" target="_blank" rel="noopener"><b>☕ Buy me a coffee</b><span>LyricWall is free, tips are optional</span></a>` : ''}
    </div>
    <button class="help-btn" aria-expanded="false" aria-controls="helpPop" aria-label="Help and feedback">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1-.2 1.3-.9 2.6-2 3.4 2 .1 3.9-.6 5.3-1.7 1.1.3 2.3.5 3.6.5 5.5 0 10-3.8 10-8.5S17.5 3 12 3zm.1 13.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm1.3-4.6c-.6.4-.7.6-.7 1.1v.3h-1.9v-.4c0-1.1.4-1.7 1.3-2.3.6-.4.9-.7.9-1.2 0-.6-.5-1-1.2-1-.8 0-1.3.5-1.4 1.2L8.5 9.2C8.7 7.6 10 6.6 12 6.6c1.9 0 3.2 1 3.2 2.6 0 1.1-.6 1.8-1.8 2.5z"/></svg>
    </button>`;
  document.body.appendChild(fab);
  const btn = fab.querySelector('.help-btn'), pop = fab.querySelector('.help-pop');
  const setOpen = (v) => {
    pop.hidden = !v; btn.setAttribute('aria-expanded', v); fab.classList.toggle('open', v);
    if (v && window.anime && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      anime.animate(pop.querySelectorAll('a, .help-pop-title'), { opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(45), duration: 420, ease: 'outExpo' });
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(pop.hidden); });
  document.addEventListener('click', (e) => { if (!fab.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setOpen(false); btn.focus(); } });
}
