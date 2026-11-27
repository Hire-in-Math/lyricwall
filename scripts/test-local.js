// CI check for the "music on this computer" readers (run on macOS and Windows runners).
const L = require('../sources.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 6; i++) {
    const r = await L.nowPlaying();
    if (r.art && r.art.length > 120) r.art = r.art.slice(0, 60) + `… (${r.art.length} chars)`;
    console.log('nowPlaying', JSON.stringify(r));
    await wait(1500);
  }
  console.log('seek', JSON.stringify(await L.control('seek', 1000)));
  await wait(1500);
  console.log('after seek', JSON.stringify(await L.nowPlaying()).slice(0, 300));
  console.log('pause', JSON.stringify(await L.control('pause')));
  await wait(1500);
  console.log('after pause', JSON.stringify(await L.nowPlaying()).slice(0, 300));
  console.log('helper error:', L._test.lastError());
  L.stop(); process.exit(0);
})();
