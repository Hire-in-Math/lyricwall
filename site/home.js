// LyricWall landing page motion, built with anime.js v4.
{
  const { animate, createTimeline, stagger, onScroll, splitText, createDrawable, scrambleText, utils } = anime;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const frame = $('#demo');

  // ---------- Live demo: tell the app on the monitor which look to show ----------
  const LOOKS = {
    chat:   { mode: 'lyrics', 'lyrics.style': 'chat',    'lights.style': 'flow',     'lights.colors': 'rainbow' },
    scroll: { mode: 'lyrics', 'lyrics.style': 'scroll',  'lights.style': 'flow',     'lights.colors': 'album' },
    focus:  { mode: 'lyrics', 'lyrics.style': 'focus',   'lights.style': 'chase',    'lights.colors': 'cyberpunk' },
    cover:  { mode: 'cover',  'lyrics.style': 'chat',    'lights.style': 'spectrum', 'lights.colors': 'album' },
    vinyl:  { mode: 'vinyl',  'lyrics.style': 'chat',    'lights.style': 'flow',     'lights.colors': 'vaporwave' },
  };
  const WALL = { chat: 'chat', scroll: 'scroll', focus: 'focus', cover: 'cover', vinyl: 'vinyl' };
  let current = 'chat';
  function setLook(name) {
    if (!LOOKS[name]) return;
    current = name;
    frame?.contentWindow?.postMessage({ type: 'lw-set', settings: LOOKS[name] }, '*');
    document.body.dataset.look = WALL[name];
    $$('.progress-dots span').forEach((d, i) => d.classList.toggle('on', i === Object.keys(LOOKS).indexOf(name)));
  }
  frame?.addEventListener('load', () => setLook(current));

  // Scale the 1600x1000 app to fit the monitor
  const screen = $('#screen');
  if (screen && frame) {
    const fit = () => { frame.style.transform = `scale(${screen.clientWidth / 1600})`; };
    new ResizeObserver(fit).observe(screen); fit();
  }

  // ---------- Equalizer bars ----------
  const eq = $('#eq');
  if (eq) eq.innerHTML = Array.from({ length: 64 }, () => '<span></span>').join('');

  if (reduce) {
    // No motion: show everything in its final state and switch looks by scroll position only.
    const chapters = $$('.chapter');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setLook(e.target.dataset.mode)), { threshold: 0.6 });
    chapters.forEach((c) => io.observe(c));
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

    // ---------- 2. Story: the monitor scenes, pinned while you scroll ----------
    const chapters = $$('.chapter');
    const story = createTimeline({
      defaults: { ease: 'inOutQuad' },
      autoplay: onScroll({
        target: '.story', enter: 'start start', leave: 'end end', sync: true,
        onUpdate: (self) => {
          const i = Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length * 0.999));
          const name = chapters[Math.max(0, i)].dataset.mode;
          if (name !== current) setLook(name);
        },
      }),
    });
    story
      .add('.screen-off', { opacity: [1, 0], duration: 250 }, 0)
      .add('.monitor-wrap', { scale: [0.88, 1], duration: 300 }, 0)
      .add('.wall-light', { opacity: [0, 0.6], scale: [0.6, 1], duration: 400 }, 0);
    chapters.forEach((c, i) => {
      const start = i * 1000;
      story.add(c, { opacity: [0, 1], y: [50, 0], filter: ['blur(10px)', 'blur(0px)'], duration: 260 }, start + (i === 0 ? 60 : 0));
      if (i < chapters.length - 1) story.add(c, { opacity: [1, 0], y: [0, -50], filter: ['blur(0px)', 'blur(10px)'], duration: 260 }, start + 740);
    });
    story.add('.story-pin', { opacity: [1, 1], duration: 1 }, chapters.length * 1000); // keeps the last chapter on screen to the end

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

    animate('.effects li', {
      opacity: [0, 1], y: [20, 0], scale: [0.8, 1], delay: stagger(80), duration: 700, ease: 'outBack(1.6)',
      autoplay: onScroll({ target: '.effects', enter: '90% start' }),
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
