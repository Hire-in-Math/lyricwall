// Reads what's playing on this computer, so LyricWall works without a Spotify account:
//   Mac:     Apple Music and the Spotify app, through AppleScript (JavaScript for Automation)
//   Windows: any app that shows up in Windows' media controls (Spotify, Apple Music, browsers…)
// Every reader returns the same shape as the Spotify Web API reader in main.js.

const { execFile, spawn } = require('child_process');
const crypto = require('crypto');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const run = (cmd, args, timeout = 4000) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, out, errOut) =>
      err ? reject(Object.assign(err, { stderr: String(errOut || '') })) : resolve(String(out))));
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const firstArtist = (a = '') => a.split(/\s*(?:,|&| feat\.? | ft\.? | x | with )\s*/i)[0].trim();

// ---------- iTunes lookup: genre (for Auto-Vibe) and a cover if the player didn't give one ----------
const lookupCache = new Map();
async function itunesLookup(artist, title) {
  const key = (artist + '|' + title).toLowerCase();
  if (lookupCache.has(key)) return lookupCache.get(key);
  let out = { genres: [], art: '' };
  try {
    const q = encodeURIComponent(`${firstArtist(artist)} ${title.replace(/\s*[([].*?[)\]]/g, '')}`.trim());
    const r = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`, { signal: AbortSignal.timeout(5000) });
    const hit = r.ok ? (await r.json()).results?.[0] : null;
    if (hit) out = { genres: hit.primaryGenreName ? [hit.primaryGenreName.toLowerCase()] : [], art: (hit.artworkUrl100 || '').replace('100x100bb', '600x600bb') };
  } catch {}
  lookupCache.set(key, out);
  if (lookupCache.size > 200) lookupCache.delete(lookupCache.keys().next().value);
  return out;
}

// ======================================================================
// Mac
// ======================================================================
// running() never launches an app, so this only looks at players that are already open.
const MAC_READ = `(() => {
  const read = (name) => {
    let a; try { a = Application(name); } catch (e) { return null; }
    if (!a.running()) return null;
    const out = { app: name, state: String(a.playerState()) };
    if (out.state === 'stopped') return out;
    const t = a.currentTrack;
    out.title = t.name(); out.artist = t.artist(); out.album = t.album();
    out.duration = t.duration(); out.position = a.playerPosition(); out.volume = a.soundVolume();
    if (name === 'Spotify') { out.id = t.id(); out.art = t.artworkUrl(); }
    else { out.id = t.persistentID(); out.genre = t.genre(); }
    return out;
  };
  const res = [];
  for (const n of ['Spotify', 'Music']) {
    try { const x = read(n); if (x) res.push(x); } catch (e) { res.push({ app: n, error: String(e) }); }
  }
  return JSON.stringify(res);
})()`;

// Apple Music keeps covers inside the app: save the current one to a temp file and read it back.
const macArtCache = new Map();
async function macMusicArt(id) {
  if (macArtCache.has(id)) return macArtCache.get(id);
  const file = require('path').join(require('os').tmpdir(), 'lyricwall-cover');
  const script = `
    tell application "Music"
      set d to missing value
      try
        set d to raw data of artwork 1 of current track
      end try
    end tell
    if d is missing value then return "none"
    set f to open for access (POSIX file "${file}") with write permission
    set eof f to 0
    write d to f
    close access f
    return "ok"`;
  let data = '';
  try {
    if ((await run('osascript', ['-e', script])).trim() === 'ok') {
      const buf = require('fs').readFileSync(file);
      const type = buf[0] === 0x89 ? 'image/png' : 'image/jpeg';
      data = `data:${type};base64,${buf.toString('base64')}`;
    }
  } catch {}
  macArtCache.set(id, data);
  if (macArtCache.size > 20) macArtCache.delete(macArtCache.keys().next().value);
  return data;
}

async function macNowPlaying() {
  let list;
  try { list = JSON.parse(await run('osascript', ['-l', 'JavaScript', '-e', MAC_READ], 20000)); }
  catch (e) {
    if (/-1743|not authori[sz]ed/i.test(e.stderr || e.message)) return { error: 'permission' };
    return { error: 'player' };
  }
  const blocked = list.find((p) => p.error && /-1743|not authori[sz]ed/i.test(p.error));
  const players = list.filter((p) => !p.error && p.state !== 'stopped' && p.title);
  // the one that's playing wins; otherwise a paused track (Spotify first)
  const p = players.find((x) => x.state === 'playing') || players[0];
  if (!p) {
    if (blocked) return { error: 'permission', app: blocked.app === 'Music' ? 'Music' : 'Spotify' };
    return { idle: true, reason: list.length ? 'nothing' : 'noplayer' };
  }
  const isSpotify = p.app === 'Spotify';
  const device = { name: isSpotify ? 'Spotify' : 'Apple Music', type: 'Computer', volume: Math.round(p.volume ?? 50), canVolume: true };
  if (isSpotify && /^spotify:(ad|episode):/.test(p.id || '')) return { idle: true, reason: p.id.includes(':ad:') ? 'ad' : 'podcast', device };
  if (isSpotify && !p.artist && /advertisement|spotify/i.test(p.title)) return { idle: true, reason: 'ad', device };

  const id = isSpotify ? String(p.id).split(':').pop() : 'am-' + p.id;
  const tr = {
    id, title: p.title, artist: p.artist || '', mainArtist: firstArtist(p.artist), artistId: '', explicit: false,
    album: p.album || '', art: isSpotify ? p.art || '' : '',
    durationMs: Math.round(isSpotify ? p.duration : p.duration * 1000),
    progressMs: Math.round((p.position || 0) * 1000),
    playing: p.state === 'playing', device, source: 'local', app: p.app, fetchedAt: Date.now(),
  };
  if (!isSpotify && p.genre) tr.genres = [String(p.genre).toLowerCase()];
  return tr;
}

// Cover and genre are fetched once per song, not every poll.
async function enrich(tr) {
  if (!tr || tr.idle || tr.error) return tr;
  if (tr.app === 'Music' && !tr.art) tr.art = await macMusicArt(tr.id);
  if (!tr.art || !tr.genres?.length) {
    const hit = await itunesLookup(tr.artist, tr.title);
    if (!tr.art) tr.art = hit.art;
    if (!tr.genres?.length) tr.genres = hit.genres;
  }
  return tr;
}

async function macControl(app, action, arg) {
  const a = `Application(${JSON.stringify(app === 'Music' ? 'Music' : 'Spotify')})`;
  const body = {
    play: `${a}.play()`, pause: `${a}.pause()`, next: `${a}.nextTrack()`, previous: `${a}.previousTrack()`,
    seek: `${a}.playerPosition = ${Math.max(0, (+arg || 0) / 1000)}`,
    volume: `${a}.soundVolume = ${Math.max(0, Math.min(100, Math.round(+arg || 0)))}`,
  }[action];
  if (!body) return { ok: false, error: 'Unknown action' };
  try { await run('osascript', ['-l', 'JavaScript', '-e', `${body}; ''`]); return { ok: true }; }
  catch (e) {
    if (/-1743|not authori[sz]ed/i.test(e.stderr || e.message)) return { ok: false, error: `Allow LyricWall to control ${app === 'Music' ? 'Music' : 'Spotify'} in System Settings → Privacy & Security → Automation` };
    return { ok: false, error: 'The player didn’t respond' };
  }
}

// ======================================================================
// Windows: a small PowerShell helper stays running, prints what's playing as JSON lines,
// and takes commands (play, pause, next, previous, seek <ms>) on stdin.
// ======================================================================
const WIN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskG = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Await($op, [Type]$t) { $task = $asTaskG.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(5000); $task.Result }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$stdin = [System.IO.StreamReader]::new([Console]::OpenStandardInput())
$pending = $stdin.ReadLineAsync()
$artKey = ''; $seenKey = ''; $stable = 0
function Pick {
  $cur = $mgr.GetCurrentSession()
  if ($cur -and [string]$cur.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { return $cur }
  foreach ($x in $mgr.GetSessions()) { if ([string]$x.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { return $x } }
  return $cur
}
while ($true) {
  try {
    if ($pending.IsCompleted) {
      $line = $pending.Result
      if ($null -eq $line) { exit }
      $pending = $stdin.ReadLineAsync()
      $s = Pick
      if ($s) {
        $c = $line.Split(' ')
        switch ($c[0]) {
          'play'     { [void](Await ($s.TryPlayAsync()) ([bool])) }
          'pause'    { [void](Await ($s.TryPauseAsync()) ([bool])) }
          'next'     { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
          'previous' { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
          'seek'     { [void](Await ($s.TryChangePlaybackPositionAsync([long]$c[1] * 10000)) ([bool])) }
        }
      }
    }
    $s = Pick
    if (-not $s) { $o = @{ none = $true } }
    else {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $tl = $s.GetTimelineProperties(); $pb = $s.GetPlaybackInfo()
      $o = @{ app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist; album = $p.AlbumTitle; status = [string]$pb.PlaybackStatus;
        pos = $tl.Position.TotalMilliseconds; start = $tl.StartTime.TotalMilliseconds; end = $tl.EndTime.TotalMilliseconds;
        updated = $tl.LastUpdatedTime.ToUnixTimeMilliseconds(); canSeek = $pb.Controls.IsPlaybackPositionEnabled }
      $key = "$($o.app)|$($o.title)|$($o.artist)"
      # wait a moment after a song change: some apps update the cover a beat after the title
      if ($key -ne $seenKey) { $seenKey = $key; $stable = 0 } else { $stable++ }
      if ($key -ne $artKey -and $stable -ge 2) {
        $artKey = $key
        if ($p.Thumbnail) {
          try {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $n = [uint32]$st.Size
            $rd = [Windows.Storage.Streams.DataReader]::new($st.GetInputStreamAt(0))
            [void](Await ($rd.LoadAsync($n)) ([uint32]))
            $b = New-Object byte[] $n; $rd.ReadBytes($b)
            $o.art = [Convert]::ToBase64String($b); $o.artType = $st.ContentType; $o.artFor = $key
          } catch { $o.artErr = $_.Exception.Message }
        }
      }
    }
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  } catch { [Console]::Out.WriteLine((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)) }
  Start-Sleep -Milliseconds 400
}`;

let winProc = null, winLatest = null, winArt = new Map(), winBuf = '', winRestartAt = 0, winLastError = '';
function winStart() {
  if (winProc || Date.now() < winRestartAt) return;
  const encoded = Buffer.from(WIN_SCRIPT, 'utf16le').toString('base64');
  winProc = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true });
  winProc.stdout.setEncoding('utf8');
  winProc.stdout.on('data', (d) => {
    winBuf += d;
    let i;
    while ((i = winBuf.indexOf('\n')) >= 0) {
      const line = winBuf.slice(0, i).trim(); winBuf = winBuf.slice(i + 1);
      if (!line.startsWith('{')) continue;
      try {
        const o = JSON.parse(line);
        if (o.error) { winLastError = o.error; continue; }
        o.at = Date.now();
        const k = `${o.app}|${o.title}|${o.artist}`;
        o.firstSeen = winLatest && `${winLatest.app}|${winLatest.title}|${winLatest.artist}` === k ? winLatest.firstSeen : o.at;
        if (o.art) { winArt.set(o.artFor, `data:${o.artType || 'image/jpeg'};base64,${o.art}`); delete o.art; if (winArt.size > 20) winArt.delete(winArt.keys().next().value); }
        winLatest = o;
      } catch {}
    }
  });
  winProc.stderr.on('data', (d) => (winLastError = String(d).slice(0, 300)));
  winProc.on('exit', () => { winProc = null; winLatest = null; winRestartAt = Date.now() + 3000; });
  winProc.on('error', (e) => { winLastError = e.message; winProc = null; winRestartAt = Date.now() + 10000; });
}
function winStop() { try { winProc?.stdin.end(); winProc?.kill(); } catch {} winProc = null; winLatest = null; }

const winAppName = (id = '') =>
  /spotify/i.test(id) ? 'Spotify' : /applemusic|appleinc/i.test(id) ? 'Apple Music' : /zune|microsoft\.media/i.test(id) ? 'Media Player'
  : /chrome/i.test(id) ? 'Chrome' : /msedge|edge/i.test(id) ? 'Edge' : /firefox/i.test(id) ? 'Firefox' : /tidal/i.test(id) ? 'TIDAL' : 'this computer';

async function winNowPlaying() {
  winStart();
  // give a fresh helper a moment to report in
  for (let i = 0; i < 15 && !winLatest && winProc; i++) await new Promise((r) => setTimeout(r, 200));
  const o = winLatest;
  if (!o || Date.now() - o.at > 5000) return winProc ? { idle: true, reason: 'nothing' } : { error: 'player', detail: winLastError };
  if (o.none || !o.title) return { idle: true, reason: 'nothing' };
  const name = winAppName(o.app);
  const device = { name, type: 'Computer', volume: null, canVolume: false };
  if (name === 'Spotify' && (!o.artist || /^advertisement$/i.test(o.title))) return { idle: true, reason: 'ad', device };
  const playing = o.status === 'Playing';
  const dur = Math.max(0, (o.end || 0) - (o.start || 0));
  // the reported position is from when the player last updated it; add the time since then
  let pos = (o.pos || 0) - (o.start || 0);
  if (playing && o.updated > 0) pos += Math.max(0, Date.now() - o.updated);
  if (dur) pos = Math.min(pos, dur);
  const key = `${o.app}|${o.title}|${o.artist}`;
  // a new song's cover arrives a moment after its title
  for (let i = 0; i < 8 && !winArt.has(key) && winProc && Date.now() - (winLatest?.firstSeen || 0) < 2500; i++) await new Promise((r) => setTimeout(r, 200));
  return {
    id: 'w-' + hash(key), title: o.title, artist: o.artist || '', mainArtist: firstArtist(o.artist), artistId: '', explicit: false,
    album: o.album || '', art: winArt.get(key) || '', artPending: !winArt.has(key),
    durationMs: Math.round(dur), progressMs: Math.round(pos), playing, device, source: 'local', app: name, fetchedAt: Date.now(),
  };
}
function winControl(action, arg) {
  if (action === 'volume') return { ok: false, error: 'Change the volume in your music app' };
  if (!['play', 'pause', 'next', 'previous', 'seek'].includes(action)) return { ok: false, error: 'Unknown action' };
  winStart();
  if (!winProc) return { ok: false, error: 'Couldn’t reach the music player' };
  winProc.stdin.write(action + (action === 'seek' ? ' ' + Math.round(+arg || 0) : '') + '\n');
  return { ok: true };
}

// ======================================================================
let lastApp = 'Spotify';
module.exports = {
  supported: isMac || isWin,
  itunesLookup,
  async nowPlaying() {
    const tr = isMac ? await macNowPlaying() : isWin ? await winNowPlaying() : { error: 'unsupported' };
    if (tr.app) lastApp = tr.app;
    return enrich(tr);
  },
  async control(action, arg) {
    return isMac ? macControl(lastApp, action, arg) : isWin ? winControl(action, arg) : { ok: false, error: 'Not supported here' };
  },
  stop() { if (isWin) winStop(); },
  _test: { lastError: () => winLastError, MAC_READ, WIN_SCRIPT, winAppName, firstArtist, feedWin: (o) => { winLatest = { ...o, at: Date.now(), firstSeen: Date.now() - 5000 }; }, setWinArt: (k, v) => winArt.set(k, v) },
};
