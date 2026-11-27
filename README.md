# LyricWall

Apple Music and Spotify lyrics that glow on your screen. LyricWall turns whatever you're playing into synced, animated lyrics with RGB light around the edges of your window. Leave it running on a second monitor.

**Download and setup guide: https://lyricwall-app.netlify.app**

- Auto-Vibe: picks a lyric style for each song from the artist's genres and how the lyrics move
- 22 lyric styles (Spotlight, Shockwave, Liquid ink, 3D tunnel, Messages, Scroll, Karaoke, Minimal, Kinetic, Split-flap grid, Editorial, Gravity stack, Fisheye, Word cloud, Constellation, Cinema, Neon, Waveform, Polaroids, LED ticker, Terminal, Call & response) in 12 fonts
- Words sung louder are emphasized; words like fire or moon pop matching icons
- Choose which screen it shows on; auto-updates
- Cover and Vinyl views with play, pause and skip
- RGB edge lights with five effects, album-matched or custom colors
- Pulses to the beat of your music
- Custom backgrounds and photo slideshows
- Mac and Windows

Two ways to follow your music:
- **On this computer** (default): reads Apple Music or the Spotify app (free or Premium) on your Mac or PC. No account or setup. On a Mac, macOS asks once to let LyricWall control Music or Spotify. On Windows, it works with anything in Windows' media controls.
- **Spotify on any device**: follows Spotify on your phone or speakers through the Spotify Web API. Needs Premium and your own free Spotify developer app (Spotify's rules since February 2026); the app walks you through it.

## Run from source
```
npm install
npm start
```
If Electron fails to install, run `npm install-scripts approve electron`, delete `node_modules/electron`, and run `npm install` again.

## Release a new version
1. Bump `version` in `package.json`.
2. Commit, then tag and push: `git tag v1.0.1 && git push && git push --tags`
3. GitHub Actions builds `LyricWall-Mac.dmg` and `LyricWall-Windows-Setup.exe` and attaches them to a GitHub Release. The website's download buttons always point at the latest release.

After changing anything in `renderer/`, run `npm run sync-site` so the live demo on the website matches.

## Project layout
- `main.js`, `preload.js`, `renderer/`: the Electron app
- `site/`: the landing page and setup guide (deployed by Netlify)
- `.github/workflows/release.yml`: builds the installers
- `build/icon.png`: app icon

Lyrics from [LRCLIB](https://lrclib.net). Place photos from Wikimedia Commons. Not affiliated with Spotify.

MIT License.
