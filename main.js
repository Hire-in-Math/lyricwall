// LyricWall — main process: window, Spotify auth (PKCE), now-playing + lyrics fetching.
const { app, BrowserWindow, ipcMain, shell, session, desktopCapturer, dialog, nativeImage } = require('electron');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';
const storeFile = () => path.join(app.getPath('userData'), 'lyricwall.json');

let win;
let store = {};

function loadStore() {
  try { store = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); } catch { store = {}; }
}
function saveStore() {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(store, null, 2));
}

function setupAudioCapture() {
  // Lets the renderer grab system audio (loopback) so the visuals can react to the beat.
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then((sources) => callback({ video: sources[0], audio: 'loopback' }))
      .catch(() => callback({}));
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 760,
    backgroundColor: '#000000',
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ---------- Spotify auth (PKCE, no client secret needed) ----------
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Token request failed');
  store.accessToken = json.access_token;
  store.expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  if (json.refresh_token) store.refreshToken = json.refresh_token;
  saveStore();
}

function login(clientId) {
  return new Promise((resolve, reject) => {
    store.clientId = clientId.trim();
    saveStore();
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<body style="background:#000;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh"><h2>You\'re in. Go back to LyricWall ✨</h2></body>');
      server.close();
      if (err || url.searchParams.get('state') !== state) return reject(new Error(err || 'State mismatch'));
      try {
        store.scopes = SCOPES;
        await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: store.clientId, code_verifier: verifier });
        if (win) { win.show(); win.focus(); }
        resolve(true);
      } catch (e) { reject(e); }
    });
    server.on('error', reject);
    server.listen(8888, '127.0.0.1', () => {
      const q = new URLSearchParams({
        client_id: store.clientId, response_type: 'code', redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state,
      });
      shell.openExternal('https://accounts.spotify.com/authorize?' + q.toString());
    });
  });
}

// ---------- Playback controls (Spotify Premium required) ----------
async function control(action) {
  const token = await accessToken();
  if (!token) return { ok: false, error: 'Not logged in' };
  const map = {
    play: ['PUT', '/me/player/play'], pause: ['PUT', '/me/player/pause'],
    next: ['POST', '/me/player/next'], previous: ['POST', '/me/player/previous'],
  };
  const [method, p] = map[action] || [];
  if (!method) return { ok: false, error: 'Unknown action' };
  const res = await fetch('https://api.spotify.com/v1' + p, { method, headers: { Authorization: 'Bearer ' + token } });
  if (res.ok || res.status === 204) return { ok: true };
  if (res.status === 403) return { ok: false, error: 'Controls need Spotify Premium' };
  if (res.status === 404) return { ok: false, error: 'No active Spotify device' };
  if (res.status === 401) return { ok: false, error: 'Reconnect Spotify to enable controls (Shift+L)' };
  return { ok: false, error: 'Spotify error ' + res.status };
}

async function accessToken() {
  if (!store.refreshToken) return null;
  if (!store.accessToken || Date.now() > store.expiresAt) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: store.refreshToken, client_id: store.clientId });
  }
  return store.accessToken;
}

// ---------- Now playing ----------
async function nowPlaying() {
  const token = await accessToken();
  if (!token) return { error: 'auth' };
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (res.status === 204) return { idle: true };
  if (res.status === 401) { store.expiresAt = 0; return { error: 'retry' }; }
  if (res.status === 429) return { error: 'ratelimit' };
  if (!res.ok) return { error: 'http ' + res.status };
  const j = await res.json();
  const t = j.item;
  if (!t || j.currently_playing_type !== 'track') return { idle: true };
  return {
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    mainArtist: t.artists[0]?.name || '',
    album: t.album?.name || '',
    art: t.album?.images?.[0]?.url || '',
    durationMs: t.duration_ms,
    progressMs: j.progress_ms,
    playing: j.is_playing,
    fetchedAt: Date.now(),
  };
}

// ---------- Lyrics (LRCLIB, free synced lyrics) ----------
const lyricCache = new Map();
async function lyrics({ id, title, mainArtist, album, durationMs }) {
  if (lyricCache.has(id)) return lyricCache.get(id);
  const headers = { 'User-Agent': 'LyricWall/1.0 (personal desktop app)' };
  let result = null;
  try {
    const q = new URLSearchParams({ track_name: title, artist_name: mainArtist, album_name: album, duration: Math.round(durationMs / 1000) });
    let r = await fetch('https://lrclib.net/api/get?' + q, { headers });
    if (r.ok) result = await r.json();
    if (!result || !result.syncedLyrics) {
      const sq = new URLSearchParams({ track_name: title.replace(/\s*[\(\[-].*$/, ''), artist_name: mainArtist });
      r = await fetch('https://lrclib.net/api/search?' + sq, { headers });
      if (r.ok) {
        const list = await r.json();
        result = list.find((x) => x.syncedLyrics) || list[0] || result;
      }
    }
  } catch (e) { /* offline etc. */ }
  const out = { synced: result?.syncedLyrics || null, plain: result?.plainLyrics || null, instrumental: !!result?.instrumental };
  lyricCache.set(id, out);
  return out;
}

// ---------- Album art as data URL (lets the renderer read colors without CORS issues) ----------
const imgCache = new Map();
async function fetchImage(url) {
  if (!url) return '';
  if (imgCache.has(url)) return imgCache.get(url);
  try {
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    const data = `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
    imgCache.set(url, data);
    if (imgCache.size > 30) imgCache.delete(imgCache.keys().next().value);
    return data;
  } catch { return url; }
}

// ---------- Photos: location pics for lyric cards + user images ----------
const UA = { 'User-Agent': 'LyricWall/1.0 (personal desktop app)' };
const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;

function toDataURL(buf, mime, maxW) {
  try {
    const img = nativeImage.createFromBuffer(buf);
    if (!img.isEmpty()) {
      const { width } = img.getSize();
      const out = width > maxW ? img.resize({ width: maxW, quality: 'good' }) : img;
      return 'data:image/jpeg;base64,' + out.toJPEG(86).toString('base64');
    }
  } catch {}
  return `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`;
}

// Searches Wikimedia Commons (free, no key) for a photo of a place.
const placeCache = new Map();
async function placePhoto(query) {
  if (placeCache.has(query)) {
    const list = placeCache.get(query);
    return list.length ? list[Math.floor(Math.random() * list.length)] : '';
  }
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
    gsrsearch: query + ' filetype:bitmap', gsrlimit: '8', prop: 'imageinfo',
    iiprop: 'url|mime|size', iiurlwidth: '900',
  });
  const list = [];
  try {
    const r = await fetch('https://commons.wikimedia.org/w/api.php?' + q, { headers: UA });
    const j = await r.json();
    const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const pg of pages) {
      const info = pg.imageinfo?.[0];
      if (!info || !/jpeg|png/.test(info.mime || '') || (info.width || 0) < info.height) continue; // landscape only
      if (list.length >= 3) break;
      try {
        const ir = await fetch(info.thumburl || info.url, { headers: UA });
        if (ir.ok) list.push(toDataURL(Buffer.from(await ir.arrayBuffer()), info.mime, 900));
      } catch {}
    }
  } catch {}
  placeCache.set(query, list);
  return list.length ? list[Math.floor(Math.random() * list.length)] : '';
}

async function pickImage() {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }] });
  return r.canceled ? '' : r.filePaths[0];
}
async function pickFolder() {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? '' : r.filePaths[0];
}
function listImages(dir) {
  try { return fs.readdirSync(dir).filter((f) => IMG_EXT.test(f) && !f.startsWith('.')).map((f) => path.join(dir, f)); }
  catch { return []; }
}
const localCache = new Map();
function readImage(p, maxW = 2000) {
  const key = p + '@' + maxW;
  if (localCache.has(key)) return localCache.get(key);
  try {
    const data = toDataURL(fs.readFileSync(p), 'image/jpeg', maxW);
    localCache.set(key, data);
    if (localCache.size > 40) localCache.delete(localCache.keys().next().value);
    return data;
  } catch { return ''; }
}

// ---------- IPC ----------
ipcMain.handle('status', () => ({ loggedIn: !!store.refreshToken, needsReauth: !!store.refreshToken && store.scopes !== SCOPES, clientId: store.clientId || '' }));
ipcMain.handle('control', async (_e, action) => { try { return await control(action); } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('login', async (_e, clientId) => { try { await login(clientId); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('logout', () => { store = { clientId: store.clientId }; saveStore(); return true; });
ipcMain.handle('nowPlaying', async () => { try { return await nowPlaying(); } catch (e) { return { error: e.message }; } });
ipcMain.handle('lyrics', (_e, track) => lyrics(track));
ipcMain.handle('fetchImage', (_e, url) => fetchImage(url));
ipcMain.handle('toggleFullscreen', () => win.setFullScreen(!win.isFullScreen()));
ipcMain.handle('toggleOnTop', () => { const v = !win.isAlwaysOnTop(); win.setAlwaysOnTop(v, 'floating'); return v; });
ipcMain.handle('quit', () => app.quit());
ipcMain.handle('openExternal', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('placePhoto', (_e, q) => placePhoto(q));
ipcMain.handle('pickImage', () => pickImage());
ipcMain.handle('pickFolder', () => pickFolder());
ipcMain.handle('listImages', (_e, dir) => listImages(dir));
ipcMain.handle('readImage', (_e, p, maxW) => readImage(p, maxW));
ipcMain.handle('setOnTop', (_e, v) => { win.setAlwaysOnTop(!!v, 'floating'); return !!v; });
ipcMain.handle('setFullscreen', (_e, v) => win.setFullScreen(!!v));

app.whenReady().then(() => { loadStore(); setupAudioCapture(); createWindow(); });
app.on('window-all-closed', () => app.quit());
