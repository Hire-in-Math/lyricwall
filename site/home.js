// LyricWall landing page motion, built with anime.js v4.
{
  const { animate, createTimeline, stagger, onScroll, splitText, createDrawable, scrambleText, utils } = anime;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const frame = $('#demo');

  // ---------- Lyric styles: click a button to show it on the monitor ----------
  const LOOKS = {
    chat:      { mode: 'lyrics', 'lyrics.style': 'chat',      'lights.style': 'flow',     'lights.colors': 'rainbow',   d: 'Lyrics arrive as chat bubbles, with photo cards from real places.' },
    focus:     { mode: 'lyrics', 'lyrics.style': 'focus',     'lights.style': 'chase',    'lights.colors': 'cyberpunk', d: 'Big karaoke lines that fill in word by word.' },
    kinetic:   { mode: 'lyrics', 'lyrics.style': 'kinetic',   'lights.style': 'spectrum', 'lights.colors': 'album',     d: 'Words punch, slide and spin in like a music video.' },
    neon:      { mode: 'lyrics', 'lyrics.style': 'neon',      'lights.style': 'breathe',  'lights.colors': 'vaporwave', d: 'A neon tube sign on a brick wall that lights up as each word is sung.' },
    tunnel:    { mode: 'lyrics', 'lyrics.style': 'tunnel',    'lights.style': 'flow',     'lights.colors': 'cyberpunk', d: 'Lines fly out of the distance through glowing rings and rush past you.' },
    spotlight: { mode: 'lyrics', 'lyrics.style': 'spotlight', 'lights.style': 'flow',     'lights.colors': 'album',     d: 'A dark wall of lyrics, lit by an orb of light that follows the singer.' },
    ink:       { mode: 'lyrics', 'lyrics.style': 'ink',       'lights.style': 'breathe',  'lights.colors': 'sunset',    d: 'Crisp words that melt into colored smoke when the line ends.' },
    cover:     { mode: 'cover',  'lyrics.style': 'chat',      'lights.style': 'spectrum', 'lights.colors': 'album',     d: 'Big album art over a background made from its colors, pulsing to the beat.' },
    vinyl:     { mode: 'vinyl',  'lyrics.style': 'chat',      'lights.style': 'flow',     'lights.colors': 'vaporwave', d: 'A record that spins while the song plays and stops when you pause.' },
  };
  let current = 'chat';
  function setLook(name) {
    const look = LOOKS[name]; if (!look) return;
    current = name;
    const { d, ...settings } = look;
    frame?.contentWindow?.postMessage({ type: 'lw-set', settings }, '*');
    document.body.dataset.look = name;
    const desc = $('#lookDesc'); if (desc) desc.textContent = d;
  }
  frame?.addEventListener('load', () => setLook(current));
  setLook('chat');
  const lookBtns = $$('.looks button');
  lookBtns.forEach((b) => b.addEventListener('click', () => {
    lookBtns.forEach((x) => x.setAttribute('aria-checked', x === b));
    setLook(b.dataset.look);
    if (!reduce) {
      animate(b, { scale: [0.9, 1], duration: 500, ease: 'outElastic(1, .5)' });
      animate('.styles-sec .monitor', { scale: [0.985, 1], duration: 600, ease: 'outElastic(1, .6)' });
    }
  }));

  // Scale the 1600x1000 app to fit each screen
  $$('.screen').forEach((scr) => {
    const f = scr.querySelector('iframe');
    if (!f) return;
    const fit = () => { f.style.transform = `scale(${scr.clientWidth / (+f.dataset.w || 1600)})`; };
    new ResizeObserver(fit).observe(scr); fit();
  });

  // ---------- Light effect picker: click to preview on the mini monitor ----------
  const lightsFrame = $('#lightsDemo');
  const FX_DESC = {
    flow: 'Colors stream around the edges of your screen.',
    chase: 'Streaks of light race around the screen with glowing tails.',
    spectrum: 'Each part of the edge reacts to a different frequency: bass at the bottom, treble at the top.',
    breathe: 'The whole edge glows and fades slowly, like it\'s breathing.',
    static: 'A still ring of color that stays put.',
  };
  const lightState = { 'lights.style': 'flow', 'lights.colors': 'rainbow' };
  const sendLights = () => lightsFrame?.contentWindow?.postMessage({ type: 'lw-set', settings: lightState }, '*');
  lightsFrame?.addEventListener('load', sendLights);
  $$('.chips[data-key]').forEach((group) => {
    const key = group.dataset.key;
    const btns = [...group.querySelectorAll('button')];
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-checked', x === b));
      lightState[key] = b.dataset.value;
      sendLights();
      if (key === 'lights.style') $('#fxDesc').textContent = FX_DESC[b.dataset.value];
      if (!reduce) {
        animate(b, { scale: [0.9, 1], duration: 500, ease: 'outElastic(1, .5)' });
        animate('#lightsScreen', { scale: [0.985, 1], duration: 600, ease: 'outElastic(1, .6)' });
      }
    }));
    // arrow keys move between options, like a native radio group
    group.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const n = btns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length];
      n.focus(); n.click();
    });
  });

  // ---------- Equalizer bars ----------
  const eq = $('#eq');
  if (eq) eq.innerHTML = Array.from({ length: 64 }, () => '<span></span>').join('');

  if (reduce) {
    // No motion: everything is shown in its final state.
  } else {

    // ---------- 1. Intro: the logo draws itself ----------
    const tagline = $('#tagline');
    const tagText = tagline.textContent;
    tagline.textContent = ' ';
    const word = splitText('.wordmark', { chars: { wrap: 'clip' } });

    createTimeline({ defaults: { ease: 'outExpo' } })
      .add(['.intro-logo', '.wordmark'], { opacity: [0, 1], duration: 1 }, 0)
      .add(createDrawable('.intro-logo .lw-ring'), { draw: ['0 0', '0 1'], duration: 1600, ease: 'inOutQuart' }, 0)
      .add(createDrawable('.intro-logo .lw-lines path'), { draw: ['0 0', '0 1'], duration: 1200, delay: stagger(130), ease: 'inOutCubic' }, 250)
      .add(createDrawable('.intro-logo .lw-glow path'), { draw: ['0 0', '0 1'], duration: 1200, delay: stagger(130), ease: 'inOutCubic' }, 250)
      .add('.intro-logo .lw-glow', { opacity: [0, 0.9], duration: 1200 }, 1100)
      .add('.intro-glow', { opacity: [0, 1], scale: [0.5, 1], duration: 2000 }, 900)
      .add(word.chars, { y: ['110%', '0%'], duration: 1000, delay: stagger(45) }, 1300)
      .add(tagline, { innerHTML: scrambleText({ text: tagText, cursor: '_' }), duration: 1100, ease: 'linear' }, 1800)
      .add('.intro-cta .bubble-btn', { opacity: [0, 1], y: [24, 0], scale: [0.85, 1], duration: 700, delay: stagger(120), ease: 'outBack(1.7)' }, 2200)
      .add(['.intro-fine', '.scroll-cue'], { opacity: [0, 1], duration: 800 }, 2600);

    // Logo glow breathes after it's drawn
    animate('.intro-logo .lw-glow', { opacity: [0.9, 0.45], duration: 2200, ease: 'inOutSine', loop: true, alternate: true, delay: 3000 });

    // Scrolling away from the intro: logo lifts and fades
    animate(['.intro-logo .logo-svg', '.wordmark-wrap'], {
      y: [0, -90], scale: [1, 0.86], opacity: [1, 0],
      autoplay: onScroll({ target: '.intro', enter: 'start start', leave: 'start end', sync: true }),
    });

    // ---------- 2. Styles: the monitor powers on as it scrolls into view ----------
    createTimeline({ autoplay: onScroll({ target: '.styles-sec', enter: '80% start' }) })
      .add('.styles-sec .monitor-wrap', { opacity: [0, 1], scale: [0.9, 1], y: [40, 0], duration: 1100, ease: 'outExpo' }, 0)
      .add('.styles-sec .wall-light', { opacity: [0, 0.6], scale: [0.6, 1], duration: 1400, ease: 'outQuad' }, 200)
      .add('.looks button', { opacity: [0, 1], y: [20, 0], scale: [0.8, 1], delay: stagger(45), duration: 700, ease: 'outBack(1.6)' }, 150)
      .add(['.styles-copy', '.look-desc', '.more-styles'], { opacity: [0, 1], y: [16, 0], delay: stagger(90), duration: 800, ease: 'outExpo' }, 250);

    // ---------- 3. Lights ----------
    createTimeline({ autoplay: onScroll({ target: '.lights', enter: 'end start', leave: 'center center', sync: true }) })
      .add(createDrawable('.waves path'), { draw: ['0 0', '0 1'], delay: stagger(160), duration: 1000, ease: 'inOutSine' });

    const bars = animate('.eq span', {
      scaleY: () => utils.random(0.08, 1, 2),
      duration: 240, ease: 'outQuad',
      delay: stagger(10, { from: 'center' }),
      loop: true, alternate: true,
      onLoop: (self) => self.refresh(),
      autoplay: onScroll({ target: '#eq' }),
    });

    animate('.chips[data-key] button', {
      opacity: [0, 1], y: [20, 0], scale: [0.8, 1], delay: stagger(50), duration: 700, ease: 'outBack(1.6)',
      autoplay: onScroll({ target: '.picker', enter: '90% start' }),
    });
    animate('.mini-monitor', {
      opacity: [0, 1], scale: [0.9, 1], y: [40, 0], duration: 1200, ease: 'outExpo',
      autoplay: onScroll({ target: '.mini-monitor', enter: '90% start' }),
    });

    // ---------- Headings rise word by word as they enter ----------
    $$('.split').forEach((h) => {
      const { words } = splitText(h, { words: { wrap: 'clip' } });
      animate(words, {
        y: ['110%', '0%'], duration: 1000, delay: stagger(70), ease: 'outExpo',
        autoplay: onScroll({ target: h, enter: '85% start' }),
      });
    });
    $$('.lights-copy').forEach((p) => animate(p, { opacity: [0, 1], y: [24, 0], duration: 900, ease: 'outExpo', autoplay: onScroll({ target: p, enter: '90% start' }) }));

    // ---------- 4. Features ----------
    animate('.feature-list article', {
      opacity: [0, 1], y: [40, 0], duration: 900, ease: 'outExpo', delay: stagger(90),
      autoplay: onScroll({ target: '.feature-list', enter: '85% start' }),
    });

    // ---------- 5. Steps: a line draws down as you scroll ----------
    animate(createDrawable('.steps-line path'), {
      draw: ['0 0', '0 1'], ease: 'linear',
      autoplay: onScroll({ target: '.steps-wrap', enter: '70% start', leave: '40% end', sync: true }),
    });
    $$('.steps > li').forEach((li) => animate(li, {
      opacity: [0, 1], x: [-30, 0], duration: 900, ease: 'outExpo',
      autoplay: onScroll({ target: li, enter: '85% start' }),
    }));

    // ---------- 6. FAQ ----------
    animate('.faq details', {
      opacity: [0, 1], y: [20, 0], duration: 700, delay: stagger(60), ease: 'outExpo',
      autoplay: onScroll({ target: '.faq', enter: '80% start' }),
    });

    // ---------- 7. Finale: the logo draws again ----------
    createTimeline({ autoplay: onScroll({ target: '.finale', enter: '80% start' }) })
      .add('.finale-logo', { opacity: [0, 1], duration: 1 }, 0)
      .add(createDrawable('.finale-logo .lw-ring'), { draw: ['0 0', '0 1'], duration: 1200, ease: 'inOutQuart' }, 0)
      .add(createDrawable('.finale-logo .lw-lines path, .finale-logo .lw-glow path'), { draw: ['0 0', '0 1'], duration: 1000, delay: stagger(60), ease: 'inOutCubic' }, 150)
      .add('.finale-logo .lw-glow', { opacity: [0, 0.9], duration: 900 }, 800)
      .add('.finale .bubble-btn', { opacity: [0, 1], y: [24, 0], scale: [0.85, 1], duration: 700, delay: stagger(120), ease: 'outBack(1.7)' }, 900);
  }
}
