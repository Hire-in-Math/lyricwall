// LyricWall extra lyric styles. Each view: init(), line(idx) -> word spans, optional onWord(span), frame(now).
// Uses helpers from app.js at call time: state, wordTimes, isGap, lyricPos, cardPhoto, PLACES, hash, S, Lights.
const ExtraViews = (() => {
  const $l = () => document.getElementById('lyrics');
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rand = (seed) => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const A = () => window.anime;
  const gapHTML = '<span class="gap"><span></span><span></span><span></span></span>';
  const colors = () => (Lights.getColors?.() || [[255, 60, 220], [40, 200, 255], [170, 90, 255]]).map((c) => c.map((v) => Math.round(v)));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  // word spans with timings, not yet in the page
  function spans(idx) {
    const line = state.lines[idx];
    const times = wordTimes(idx);
    const exact = line.words && line.words.length === line.text.split(' ').length;
    return line.text.split(' ').map((w, i) => {
      const s = mk('span', 'w'); s.textContent = w; s.dataset.t = times[i]; if (exact) s.dataset.exact = 1; return s;
    });
  }
  function appendWords(el, list) { list.forEach((s, i) => { el.appendChild(s); if (i < list.length - 1) el.appendChild(document.createTextNode(' ')); }); return list; }
  function isChorus(idx) {
    const t = norm(state.lines[idx]?.text || '');
    if (!t || t.length < 8) return false;
    return state.lines.filter((l) => norm(l.text) === t).length >= 2;
  }
  const lineDur = (idx) => { const a = state.lines[idx], b = state.lines[idx + 1]; return a && b ? b.t - a.t : 4000; };
  const V = {};

  // ---------- Word cloud: lines float at different depths; the active one zooms forward ----------
  V.cloud = {
    font: 'archivo',
    init() {
      const host = mk('div', 'cloud'); $l().appendChild(host);
      const r = rand(hash(state.track?.id || 'x'));
      state.lines.forEach((l, i) => {
        if (isGap(i)) return;
        const d = mk('div', 'cl'); d.dataset.i = i;
        const x = (r() - 0.5) * 78, y = (r() - 0.5) * 70, z = -250 - r() * 700, rot = (r() - 0.5) * 8;
        d.dataset.base = `translate(-50%,-50%) translate3d(${x}vw,${y}vh,${z}px) rotate(${rot}deg)`;
        d.style.transform = d.dataset.base;
        appendWords(d, spans(i));
        host.appendChild(d);
      });
    },
    line(idx) {
      let words = [];
      $l().querySelectorAll('.cl').forEach((d) => {
        const i = +d.dataset.i;
        d.classList.remove('active', 'past', 'near');
        if (i === idx) {
          d.classList.add('active'); d.style.transform = 'translate(-50%,-50%) translate3d(0,0,160px)';
          words = [...d.querySelectorAll('.w')];
        } else if (i < idx) {
          d.classList.add('past');
          d.style.transform = d.dataset.base.replace(/translate3d\(([^,]+),([^,]+),([^)]+)\)/, (_, x, y) => `translate3d(${x},calc(${y} - 12vh),-1400px)`);
        } else { d.classList.toggle('near', i - idx <= 3); d.style.transform = d.dataset.base; }
      });
      return words;
    },
  };

  // ---------- Editorial: magazine spread with huge type and the album art ----------
  V.editorial = {
    font: 'fraunces',
    init() {
      const tr = state.track || {};
      $l().innerHTML = `
        <div class="ed">
          <div class="ed-text">
            <div class="ed-meta"><span>${String((hash(tr.id || 'x') % 90) + 10).padStart(2, '0')}</span><span class="ed-title"></span></div>
            <div class="ed-prev"></div><div class="ed-cur"></div><div class="ed-next"></div>
          </div>
          <div class="ed-side">
            <div class="ed-art"><img alt="" /></div>
            <div class="ed-cap"><b class="ed-song"></b><span class="ed-artist"></span></div>
            <div class="ed-bar"><i></i></div>
            <div class="ed-pulse"></div>
          </div>
        </div>`;
      const h = $l();
      h.querySelector('.ed-title').textContent = tr.album || '';
      h.querySelector('.ed-song').textContent = tr.title || '';
      h.querySelector('.ed-artist').textContent = tr.artist || '';
      if (tr.artData) h.querySelector('.ed-art img').src = tr.artData;
    },
    line(idx) {
      const h = $l(); const cur = h.querySelector('.ed-cur');
      if (!cur) return [];
      h.querySelector('.ed-prev').textContent = idx > 0 && !isGap(idx - 1) ? state.lines[idx - 1].text : '';
      const nx = []; for (let k = idx + 1; k < state.lines.length && nx.length < 2; k++) if (!isGap(k)) nx.push(state.lines[k].text);
      h.querySelector('.ed-next').innerHTML = nx.map((t) => `<p>${t.replace(/</g, '&lt;')}</p>`).join('');
      cur.innerHTML = '';
      const words = idx < 0 || isGap(idx) ? (cur.innerHTML = gapHTML, []) : appendWords(cur, spans(idx));
      A()?.animate(cur, { opacity: [0, 1], y: [30, 0], duration: 700, ease: 'outExpo' });
      return words;
    },
    frame() {
      const bar = $l().querySelector('.ed-bar i');
      if (bar && state.track) bar.style.width = (100 * currentPosition() / state.track.durationMs) + '%';
    },
  };

  // ---------- Neon sign on a brick wall; words light up as sung ----------
  V.neon = {
    font: 'neon',
    init() { $l().innerHTML = '<div class="neon-wall"><div class="neon-glow"></div><div class="neon-sign"></div><div class="neon-reflect"></div></div>'; },
    line(idx) {
      const sign = $l().querySelector('.neon-sign'), refl = $l().querySelector('.neon-reflect'), glow = $l().querySelector('.neon-glow');
      if (!sign) return [];
      const cs = colors(); const c = cs[Math.max(0, idx) % cs.length];
      $l().querySelector('.neon-wall').style.setProperty('--nc', rgb(c));
      glow.style.background = `radial-gradient(50% 40% at 50% 46%, ${rgb(c, 0.35)}, transparent 70%)`;
      sign.innerHTML = '';
      const words = idx < 0 || isGap(idx) ? (sign.innerHTML = gapHTML, []) : appendWords(sign, spans(idx));
      refl.textContent = idx >= 0 && !isGap(idx) ? state.lines[idx].text : '';
      sign.classList.remove('flicker'); void sign.offsetWidth; sign.classList.add('flicker');
      return words;
    },
  };

  // ---------- Split-flap grid: words flip onto big tiles; the chorus flips everything ----------
  const COLS = 6, ROWS = 4;
  V.grid = {
    font: 'bebas',
    init() {
      const g = mk('div', 'flapgrid'); $l().appendChild(g);
      for (let i = 0; i < COLS * ROWS; i++) g.appendChild(mk('div', 'tile', '<div class="tile-in"></div>'));
    },
    line(idx) {
      const tiles = [...$l().querySelectorAll('.tile')];
      if (!tiles.length) return [];
      tiles.forEach((t) => { t.classList.remove('lit', 'wide', 'used', 'chorus', 'hot'); t.style.gridColumn = ''; t.style.display = ''; t.style.removeProperty('--tc'); t.querySelector('.tile-in').innerHTML = ''; });
      A()?.animate(tiles.map((t) => t.querySelector('.tile-in')), { rotateX: [90, 0], duration: 500, delay: A().stagger(18, { from: 'center' }), ease: 'outQuad' });
      if (idx < 0 || isGap(idx)) { tiles[Math.floor(ROWS / 2) * COLS + 2].querySelector('.tile-in').innerHTML = gapHTML; return []; }
      const list = spans(idx), chorus = isChorus(idx);
      // lay words out row by row, starting on row 2; long words take two tiles
      let col = 0, row = list.length > 8 ? 0 : 1; const placed = [];
      for (const s of list) {
        const span = s.textContent.length > 6 ? 2 : 1;
        if (col + span > COLS) { col = 0; row++; }
        if (row >= ROWS) break;
        const ti = row * COLS + col; const t = tiles[ti];
        t.classList.add('used'); if (chorus) t.classList.add('chorus');
        if (span === 2) { t.classList.add('wide'); t.style.gridColumn = `span 2`; tiles[ti + 1].style.display = 'none'; }
        t.querySelector('.tile-in').appendChild(s); placed.push(s);
        col += span;
      }
      return placed;
    },
    onWord(s) {
      const t = s.closest('.tile'); if (!t) return;
      t.classList.add('lit');
      const cs = colors(); const c = cs[[...t.parentElement.children].indexOf(t) % cs.length];
      if (s.classList.contains('emph') || t.classList.contains('chorus')) { t.style.setProperty('--tc', rgb(c)); t.classList.add('hot'); }
      A()?.animate(t.querySelector('.tile-in'), { rotateX: [-90, 0], duration: 420, ease: 'outBack(1.4)' });
    },
  };

  // ---------- Kinetic: words punch in and stack like a lyric video ----------
  const MOVES = [
    { scale: [2.6, 1], opacity: [0, 1], duration: 420, ease: 'outExpo' },
    { x: ['-60vw', 0], duration: 520, ease: 'outExpo' },
    { x: ['60vw', 0], duration: 520, ease: 'outExpo' },
    { rotate: [90, 0], scale: [0.4, 1], duration: 560, ease: 'outBack(1.6)' },
    { y: ['-60vh', 0], duration: 620, ease: 'outBounce' },
    { scaleY: [0, 1], duration: 380, ease: 'outBack(2)' },
  ];
  V.kinetic = {
    font: 'archivo',
    init() { $l().appendChild(mk('div', 'kin')); },
    line(idx) {
      const host = $l().querySelector('.kin'); if (!host) return [];
      [...host.children].forEach((old) => { A()?.animate(old, { scale: 1.6, opacity: 0, duration: 450, ease: 'inQuad', onComplete: () => old.remove() }) || old.remove(); });
      const stack = mk('div', 'kstack'); host.appendChild(stack);
      if (idx < 0 || isGap(idx)) { stack.innerHTML = gapHTML; return []; }
      const list = spans(idx);
      // greedy rows of ~11 characters; each row is sized to fill the width
      const rows = []; let cur = [];
      for (const s of list) { const len = cur.reduce((n, x) => n + x.textContent.length + 1, 0); if (cur.length && len + s.textContent.length > 11) { rows.push(cur); cur = []; } cur.push(s); }
      if (cur.length) rows.push(cur);
      const r = rand(hash(state.lines[idx].text));
      rows.forEach((row, ri) => {
        const chars = row.reduce((n, x) => n + x.textContent.length, 0) + row.length - 1;
        const rowEl = mk('div', 'krow');
        rowEl.style.fontSize = `min(${(86 / Math.max(chars, 3)) * 1.55}vw, ${Math.min(30, 72 / rows.length)}vh)`;
        if (r() < 0.25) rowEl.classList.add('outline');
        row.forEach((s) => { const b = mk('span', 'kw'); b.appendChild(s); s.dataset.move = Math.floor(r() * MOVES.length); rowEl.appendChild(b); rowEl.appendChild(document.createTextNode(' ')); });
        stack.appendChild(rowEl);
      });
      return list;
    },
    onWord(s) {
      const box = s.parentElement; if (!box || !A()) return;
      const m = MOVES[+s.dataset.move || 0];
      A().animate(box, { ...m, opacity: { from: 0, to: 1, duration: 160 } });
    },
  };

  // ---------- Constellation: lines drift like stars; the sung line lights up and connects ----------
  V.stars = {
    font: 'space',
    init() {
      const h = $l(); h.innerHTML = '<canvas class="starsky"></canvas><div class="starlines"></div><svg class="constel"><path/></svg>';
      const box = h.querySelector('.starlines'); const r = rand(hash(state.track?.id || 's'));
      state.lines.forEach((l, i) => {
        if (isGap(i)) return;
        const d = mk('div', 'sl'); d.dataset.i = i;
        d.style.left = 6 + r() * 70 + 'vw'; d.style.top = 8 + r() * 80 + 'vh';
        d.style.animationDuration = 40 + r() * 50 + 's'; d.style.animationDelay = -r() * 40 + 's';
        appendWords(d, spans(i)); box.appendChild(d);
      });
      const c = h.querySelector('.starsky'); this.ctx = c.getContext('2d'); this.canvas = c;
      this.pts = Array.from({ length: 260 }, () => [r(), r(), r() * 0.8 + 0.2, r() * 6.28]);
    },
    line(idx) {
      const h = $l(); let words = [];
      h.querySelectorAll('.sl').forEach((d) => {
        const on = +d.dataset.i === idx; d.classList.toggle('active', on);
        if (on) words = [...d.querySelectorAll('.w')];
      });
      const path = h.querySelector('.constel path'); if (path) path.setAttribute('d', '');
      return words;
    },
    onWord() {
      const h = $l(); const svg = h.querySelector('.constel'); const act = h.querySelector('.sl.active'); if (!svg || !act) return;
      const pts = [...act.querySelectorAll('.w.on')].map((w) => { const b = w.getBoundingClientRect(); return [b.left + b.width / 2, b.top - 10]; });
      svg.querySelector('path').setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0)).join(' '));
    },
    frame(now) {
      const c = this.canvas; if (!c || !c.isConnected) return;
      if (c.width !== innerWidth) { c.width = innerWidth; c.height = innerHeight; }
      const ctx = this.ctx; ctx.clearRect(0, 0, c.width, c.height);
      const b = window.LW.beat || 0, t = now / 1000;
      for (const p of this.pts) {
        const x = ((p[0] + t * 0.004 * p[2]) % 1) * c.width, y = p[1] * c.height;
        const a = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.8 + p[3])) * p[2] + b * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(x, y, p[2] * 1.4, 0, 6.28); ctx.fill();
      }
      if (Math.floor(now / 120) !== this._k) { this._k = Math.floor(now / 120); this.onWord(); } // keep lines attached while drifting
    },
  };

  // ---------- Waveform: a live sound line across the screen with the words riding it ----------
  V.wave = {
    font: 'space',
    init() { $l().innerHTML = '<canvas class="wavec"></canvas><div class="wave-words"></div>'; this.c = $l().querySelector('.wavec'); this.ctx = this.c.getContext('2d'); this.y = new Float32Array(256); },
    waveAt(fx) { const i = Math.min(255, Math.max(0, Math.floor(fx * 255))); return this.y[i]; },
    line(idx) {
      const box = $l().querySelector('.wave-words'); if (!box) return [];
      box.innerHTML = '';
      if (idx < 0 || isGap(idx)) return [];
      const list = spans(idx); const n = list.length;
      list.forEach((s, i) => { s.dataset.fx = (0.12 + (0.76 * (i + 0.5)) / n).toFixed(4); box.appendChild(s); });
      A()?.animate(list, { x: [80, 0], delay: A().stagger(40), duration: 600, ease: 'outExpo' });
      return list;
    },
    frame(now) {
      const c = this.c; if (!c || !c.isConnected) return;
      if (c.width !== innerWidth) { c.width = innerWidth; c.height = innerHeight; }
      const W = c.width, H = c.height, mid = H * 0.55, t = now / 1000, beat = window.LW.beat || 0;
      const td = window.LW.wave;
      for (let i = 0; i < 256; i++) {
        let v;
        if (td) v = (td[Math.floor((i / 256) * td.length)] - 128) / 128;
        else v = Math.sin(i * 0.09 + t * 3) * 0.35 + Math.sin(i * 0.23 - t * 1.7) * 0.2 * (0.6 + beat);
        const env = Math.sin((i / 255) * Math.PI);
        this.y[i] = this.y[i] * 0.6 + v * env * H * 0.18 * 0.4;
      }
      const ctx = this.ctx; ctx.clearRect(0, 0, W, H);
      const cs = colors(); const g = ctx.createLinearGradient(0, 0, W, 0);
      cs.forEach((col, i) => g.addColorStop(i / Math.max(1, cs.length - 1), rgb(col)));
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.shadowColor = rgb(cs[0], 0.8); ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i < 256; i++) { const x = (i / 255) * W, y = mid + this.y[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      $l().querySelectorAll('.wave-words .w').forEach((s) => {
        const fx = +s.dataset.fx; s.style.left = fx * 100 + 'vw';
        s.style.top = (mid + this.waveAt(fx)) / H * 100 + 'vh';
      });
    },
  };

  // ---------- Cinema: letterbox bars, italic subtitles, ambient light ----------
  V.cinema = {
    font: 'instrument',
    init() { $l().innerHTML = '<div class="cine"><div class="cine-amb"></div><div class="bar top"></div><div class="bar bot"></div><div class="sub"></div></div>'; },
    line(idx) {
      const sub = $l().querySelector('.sub'); if (!sub) return [];
      const cs = colors();
      $l().querySelector('.cine-amb').style.background = `radial-gradient(45% 55% at 30% 50%, ${rgb(cs[0], 0.45)}, transparent 70%), radial-gradient(45% 55% at 72% 46%, ${rgb(cs[1 % cs.length], 0.4)}, transparent 70%)`;
      const old = sub.firstElementChild; if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 500); }
      if (idx < 0 || isGap(idx)) return [];
      const p = mk('p', 'subline'); sub.appendChild(p);
      return appendWords(p, spans(idx));
    },
  };

  // ---------- Terminal: lyrics type themselves out with a glowing cursor ----------
  V.terminal = {
    font: 'mono',
    init() {
      const tr = state.track || {};
      $l().innerHTML = '<div class="term"><div class="term-log"></div></div>';
      const log = $l().querySelector('.term-log');
      const hd = mk('div', 'tl head'); hd.textContent = `lyricwall@spotify ~ % now-playing "${tr.title || ''}" --artist "${tr.artist || ''}"`;
      log.appendChild(hd);
    },
    line(idx) {
      const log = $l().querySelector('.term-log'); if (!log) return [];
      log.querySelector('.cursor')?.remove();
      const row = mk('div', 'tl');
      const stamp = mk('span', 'ts'); stamp.textContent = `[${fmt(state.lines[Math.max(0, idx)]?.t || 0)}] `; row.appendChild(stamp);
      row.appendChild(mk('span', 'prompt', idx < 0 || isGap(idx) ? '# instrumental ' : '&gt; '));
      const list = idx < 0 || isGap(idx) ? [] : appendWords(row, spans(idx));
      row.appendChild(mk('span', 'cursor'));
      log.appendChild(row);
      while (log.children.length > 40) log.firstElementChild.remove();
      return list;
    },
    onWord(s) {
      const full = s.textContent; if (s.dataset.typed) return; s.dataset.typed = 1;
      let i = 0; s.textContent = '';
      const step = () => { s.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 28); };
      step();
    },
  };

  // ---------- Gravity stack: lines drop and pile up; the chorus shatters the pile ----------
  V.stack = {
    font: 'bebas',
    init() { $l().appendChild(mk('div', 'pile')); },
    shatter() {
      const blocks = [...$l().querySelectorAll('.blk')];
      blocks.forEach((b) => {
        const r = Math.random;
        A()?.animate(b, { x: (r() - 0.5) * innerWidth * 1.4, y: -(r() * innerHeight * 0.8 + 200), rotate: (r() - 0.5) * 220, opacity: 0, scale: 0.6, duration: 900 + r() * 500, ease: 'outExpo', onComplete: () => b.remove() }) || b.remove();
      });
    },
    line(idx) {
      const pile = $l().querySelector('.pile'); if (!pile) return [];
      if (idx < 0 || isGap(idx)) return [];
      const full = pile.getBoundingClientRect().height > innerHeight * 0.72;
      if (full || (isChorus(idx) && state.lines.findIndex((l) => norm(l.text) === norm(state.lines[idx].text)) === idx)) this.shatter();
      const cs = colors(); const r = rand(hash(state.lines[idx].text + idx));
      const b = mk('div', 'blk'); b.style.setProperty('--bc', rgb(cs[idx % cs.length], 0.9)); b.style.rotate = (r() - 0.5) * 5 + 'deg';
      b.style.marginLeft = (r() * 30) + 'vw';
      const list = appendWords(b, spans(idx));
      pile.prepend(b);
      A()?.animate(b, { y: [-innerHeight, 0], duration: 900, ease: 'outBounce' });
      return list;
    },
  };

  // ---------- Call & response: main vocal left, ad-libs and echoes right ----------
  V.split = {
    font: 'archivo',
    init() { $l().innerHTML = '<div class="duo"><div class="side main"><div class="slot"></div></div><div class="side echo"><div class="slot"></div></div></div>'; },
    line(idx) {
      const h = $l(); const L = h.querySelector('.main .slot'), R = h.querySelector('.echo .slot'); if (!L) return [];
      const cs = colors();
      h.querySelector('.main').style.setProperty('--zc', rgb(cs[0], 0.28));
      h.querySelector('.echo').style.setProperty('--zc', rgb(cs[1 % cs.length], 0.28));
      L.innerHTML = ''; R.innerHTML = '';
      if (idx < 0 || isGap(idx)) { L.innerHTML = gapHTML; return []; }
      const list = spans(idx); let inParen = false; const main = [], echo = [];
      list.forEach((s) => {
        const t = s.textContent;
        if (t.includes('(')) inParen = true;
        (inParen ? echo : main).push(s);
        if (t.includes(')')) inParen = false;
      });
      const pL = mk('p'); appendWords(pL, main); L.appendChild(pL);
      if (echo.length) { const pR = mk('p'); appendWords(pR, echo); R.appendChild(pR); }
      A()?.animate([L, R], { opacity: [0, 1], x: (el, i) => [i ? 40 : -40, 0], duration: 700, ease: 'outExpo' });
      return list;
    },
    onWord(s) {
      // no ad-libs on this line: echo the words that hit hardest
      const R = $l().querySelector('.echo .slot'); if (!R || R.querySelector('p:not(.e)')) return;
      if (!s.classList.contains('emph') && !(s.nextSibling == null && s.textContent.length > 3)) return;
      const e = mk('p', 'e'); e.textContent = s.textContent.replace(/[,.]/g, ''); R.appendChild(e);
      A()?.animate(e, { opacity: [0, 1, 0.5], scale: [1.4, 1], duration: 900, ease: 'outExpo' });
      while (R.children.length > 3) R.firstElementChild.remove();
    },
  };

  // ---------- Fisheye: the sung word is magnified like a lens, with its icon ----------
  V.fisheye = {
    font: 'system',
    init() { $l().innerHTML = '<div class="fish"><div class="fish-icon"></div><div class="fish-row"></div></div>'; },
    line(idx) {
      const row = $l().querySelector('.fish-row'); if (!row) return [];
      row.innerHTML = ''; $l().querySelector('.fish-icon').textContent = '';
      if (idx < 0 || isGap(idx)) { row.innerHTML = gapHTML; row.style.transform = ''; return []; }
      const list = spans(idx); list.forEach((s) => row.appendChild(s));
      row.classList.add('no-icons');
      this.focus(list[0], true);
      return list;
    },
    focus(span, quiet) {
      const row = $l().querySelector('.fish-row'); if (!row || !span) return;
      const ws = [...row.querySelectorAll('.w')]; const ai = ws.indexOf(span);
      ws.forEach((w, i) => {
        const d = i - ai, g = Math.exp(-(d * d) / 2.2);
        w.style.fontSize = `calc(${1 + 2.3 * g} * var(--fishBase))`;
        w.style.transform = `perspective(900px) rotateY(${Math.max(-40, Math.min(40, d * 10))}deg) translateY(${Math.min(70, d * d * 2.5)}px)`;
        w.style.filter = `blur(${Math.min(4, Math.abs(d) * 0.7)}px)`;
        w.style.opacity = quiet && i > 0 ? 0.25 : Math.max(0.18, g + (w.classList.contains('on') ? 0.25 : 0));
      });
      // centre the active word using its layout position (not affected by transforms)
      row.style.transform = `translateX(${innerWidth / 2 - (span.offsetLeft + span.offsetWidth / 2)}px)`;
      if (!quiet) {
        const ic = FX.iconFor(span.textContent); const el = $l().querySelector('.fish-icon');
        if (ic && el) { el.textContent = ic; A()?.animate(el, { scale: [0.2, 1], opacity: [0, 1], rotate: [-20, 0], duration: 600, ease: 'outBack(2)' }); }
      }
    },
    onWord(s) { this.focus(s); },
  };

  // ---------- Polaroids: every line is a photo dropped on a table ----------
  V.polaroid = {
    font: 'caveat',
    init() { $l().appendChild(mk('div', 'table')); },
    line(idx) {
      const tb = $l().querySelector('.table'); if (!tb || idx < 0 || isGap(idx)) return [];
      const h = hash((state.track?.id || '') + idx); const r = rand(h);
      const card = mk('figure', 'pola');
      card.style.left = 12 + r() * 56 + 'vw'; card.style.top = 8 + r() * 42 + 'vh';
      const rot = (r() - 0.5) * 18; card.style.setProperty('--rot', rot + 'deg');
      const ph = mk('div', 'pola-ph'); if (state.albumBg) ph.style.background = gradientFrom(state.albumBg);
      const [place, q] = PLACES[h % PLACES.length];
      cardPhoto(q, h).then((src) => { if (src) { ph.style.backgroundImage = `url("${src}")`; ph.classList.add('loaded'); } });
      const cap = mk('figcaption'); const list = appendWords(cap, spans(idx));
      const where = mk('small'); where.textContent = place;
      card.append(ph, cap, where); tb.appendChild(card);
      [...tb.children].forEach((c, i, arr) => { c.classList.toggle('old', i < arr.length - 1); if (i < arr.length - 7) c.remove(); });
      A()?.animate(card, { scale: [1.5, 1], opacity: [0, 1], rotate: [rot - 25, rot], y: [-120, 0], duration: 800, ease: 'outBack(1.2)' });
      return list;
    },
  };

  // ---------- LED ticker: a glowing dot-matrix sign scrolling across the screen ----------
  V.ticker = {
    font: 'doto',
    init() { $l().innerHTML = '<div class="led"><div class="led-top"></div><div class="led-band"><div class="led-track"></div></div><div class="led-bot"></div></div>'; },
    line(idx) {
      const h = $l(); const track = h.querySelector('.led-track'); if (!track) return [];
      const cs = colors(); h.querySelector('.led').style.setProperty('--lc', rgb(cs[Math.max(0, idx) % cs.length]));
      h.querySelector('.led-top').textContent = `${state.track?.title || ''}  ✦  ${state.track?.artist || ''}`;
      let nx = ''; for (let k = idx + 1; k < state.lines.length; k++) if (!isGap(k)) { nx = state.lines[k].text; break; }
      h.querySelector('.led-bot').textContent = nx ? 'next  ›  ' + nx : '';
      track.innerHTML = '';
      if (idx < 0 || isGap(idx)) { track.textContent = '♪ ♪ ♪'; track.style.transform = 'translateX(0)'; return []; }
      const list = appendWords(track, spans(idx));
      this.anim?.pause?.();
      requestAnimationFrame(() => {
        const w = track.scrollWidth, dur = Math.max(3500, lineDur(idx) * 1.05);
        this.anim = A()?.animate(track, { x: [innerWidth * 0.55, Math.min(innerWidth * 0.05, innerWidth * 0.45 - w)], duration: dur, ease: 'linear' });
      });
      return list;
    },
  };

  return V;
})();
