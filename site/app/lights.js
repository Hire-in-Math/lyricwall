// LyricWall edge lights: draws RGB light around the whole window on two canvases
// (a crisp line + a blurred glow). Effects: flow, chase, spectrum, breathe, static.
const Lights = (() => {
  const glow = document.getElementById('lightsGlow');
  const line = document.getElementById('lightsLine');
  const gctx = glow.getContext('2d');
  const lctx = line.getContext('2d');
  const N = 420;              // samples around the perimeter
  const GLOW_SCALE = 0.5;     // glow canvas renders at half resolution (it's blurred anyway)
  let colors = [[255, 0, 64], [0, 213, 255], [179, 0, 255]];
  let target = colors;
  let ptsLine = [], ptsGlow = [], W = 0, H = 0, dpr = 1;
  const t0 = performance.now();

  const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function setColors(list) {
    const rgb = (list || []).map((c) => (typeof c === 'string' ? hexToRgb(c) : c)).filter(Boolean);
    if (!rgb.length) return;
    target = rgb;
    // resample current colors to the new count so the transition can blend
    colors = rgb.map((_, i) => sample(colors, i / rgb.length));
  }

  // rounded-rectangle perimeter, resampled to N evenly spaced points
  function perimeter(w, h, inset, r) {
    const raw = [];
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    const arc = (cx, cy, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (Math.PI / 2); raw.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    // start at bottom-center, go clockwise (bottom → left → top → right)
    raw.push([(x0 + x1) / 2, y1]);
    arc(x0 + r, y1 - r, Math.PI / 2);
    arc(x0 + r, y0 + r, Math.PI);
    arc(x1 - r, y0 + r, -Math.PI / 2);
    arc(x1 - r, y1 - r, 0);
    raw.push([(x0 + x1) / 2, y1]);
    const seg = []; let total = 0;
    for (let i = 1; i < raw.length; i++) { const d = Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); seg.push(d); total += d; }
    const out = []; let si = 0, acc = 0;
    for (let n = 0; n <= N; n++) {
      const want = (n / N) * total;
      while (si < seg.length - 1 && acc + seg[si] < want) { acc += seg[si]; si++; }
      const f = seg[si] ? (want - acc) / seg[si] : 0;
      const a = raw[si], b = raw[si + 1];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return out;
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    line.width = Math.round(W * dpr); line.height = Math.round(H * dpr);
    glow.width = Math.round(W * GLOW_SCALE); glow.height = Math.round(H * GLOW_SCALE);
    const corner = window.matchMedia('(display-mode: fullscreen)').matches ? 0 : 10;
    ptsLine = perimeter(line.width, line.height, 1.5 * dpr, corner * dpr);
    ptsGlow = perimeter(glow.width, glow.height, 0, corner * GLOW_SCALE);
  }
  window.addEventListener('resize', resize);
  resize();

  // cyclic palette interpolation
  function sample(pal, u) {
    u = ((u % 1) + 1) % 1;
    const n = pal.length, x = u * n, i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
    const s = f * f * (3 - 2 * f);
    return [0, 1, 2].map((k) => pal[i][k] + (pal[j][k] - pal[i][k]) * s);
  }

  function intensities(style, t, L, beat, spec) {
    const I = new Float32Array(N), U = new Float32Array(N); // brightness + color position per sample
    const speed = 0.02 + L.speed * 0.45;
    const rep = L.spread || 1;
    for (let i = 0; i < N; i++) U[i] = (i / N) * rep;

    if (style === 'flow') {
      for (let i = 0; i < N; i++) { U[i] -= t * speed; I[i] = 0.85 + 0.15 * Math.sin((i / N) * Math.PI * 2 * rep * 2 - t * 3); }
    } else if (style === 'static') {
      I.fill(1);
    } else if (style === 'breathe') {
      const b = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (0.8 + L.speed * 3)));
      for (let i = 0; i < N; i++) { U[i] = t * speed * 0.3 + (i / N) * 0.15; I[i] = b; }
    } else if (style === 'chase') {
      const k = Math.min(6, Math.max(2, colors.length));
      const tail = 0.16 + 0.1 * (1 - L.speed);
      for (let i = 0; i < N; i++) {
        const p = i / N; let best = 0, bu = 0;
        for (let j = 0; j < k; j++) {
          const head = (t * speed * 1.6 + j / k) % 1;
          let d = head - p; if (d < 0) d += 1;          // distance behind the head
          if (d < tail) { const v = Math.pow(1 - d / tail, 2.2); if (v > best) { best = v; bu = j / k; } }
        }
        I[i] = 0.06 + best * 0.94; U[i] = best > 0.02 ? bu : p * rep - t * speed * 0.2;
      }
    } else if (style === 'spectrum') {
      // bottom-center = bass … top-center = treble, mirrored left/right
      const bins = spec ? spec.length : 0;
      for (let i = 0; i < N; i++) {
        const p = i / N, d = Math.min(p, 1 - p) * 2; // 0 at bottom-center, 1 at top-center
        let a;
        if (bins) { const bi = Math.min(bins - 1, Math.floor(Math.pow(d, 1.7) * bins * 0.55)); a = spec[bi] / 255; a = Math.pow(a, 1.5); }
        else a = 0.5 + 0.25 * Math.sin(d * 9 - t * 3) + 0.2 * Math.sin(d * 23 + t * 5) * beat;
        I[i] = 0.08 + 0.92 * Math.max(0, Math.min(1, a));
        U[i] = d * rep * 0.5 - t * speed * 0.3;
      }
    }
    // beat reaction
    const br = L.beatReact;
    for (let i = 0; i < N; i++) I[i] = Math.min(1, I[i] * (1 - br * 0.35 + br * beat * 0.9));
    return [I, U];
  }

  function draw(ctx, pts, I, U, width, alpha) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (let i = 0; i < N; i++) {
      const a = I[i] * alpha; if (a < 0.01) continue;
      const c = sample(colors, U[i]);
      ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
      ctx.lineWidth = width * (0.55 + 0.45 * I[i]);
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
  }

  function frame() {
    const L = S.lights;
    document.body.classList.toggle('lights-off', !L.enabled);
    if (L.enabled) {
      // ease colors toward target (smooth palette changes between songs)
      if (colors.length === target.length) colors = colors.map((c, i) => c.map((v, k) => v + (target[i][k] - v) * 0.06));
      else colors = target;
      const t = (performance.now() - t0) / 1000;
      const beat = window.LW?.beat || 0;
      const [I, U] = intensities(L.style, t, L, beat, window.LW?.spectrum);
      draw(lctx, ptsLine, I, U, (1.5 + L.thickness * 5) * dpr, L.brightness);
      draw(gctx, ptsGlow, I, U, (6 + L.thickness * 14 + L.glow * 26) * GLOW_SCALE * 2, L.brightness * (0.2 + L.glow * 0.7));
      glow.style.filter = `blur(${12 + L.glow * 22 + beat * L.beatReact * 8}px) saturate(1.25)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { setColors, resize };
})();
