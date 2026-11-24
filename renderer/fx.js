// LyricWall word effects: emphasis (from the audio + the text) and matching icons for words.
const FX = (() => {
  // ---------- word → icon ----------
  const ICONS = {
    // feelings
    love: '❤️', heart: '❤️', hearts: '💕', lover: '💘', kiss: '💋', crush: '💘', baby: '🍼', babe: '😘', sad: '😢', cry: '😭', tear: '💧', tears: '💧',
    happy: '😊', smile: '😁', laugh: '😂', broken: '💔', heartbreak: '💔', lonely: '🥀', alone: '🥀', angry: '😤', mad: '😤', scared: '😨', fear: '😨',
    crazy: '🤪', dream: '💭', dreams: '💭', think: '💭', mind: '🧠', soul: '✨', pray: '🙏', prayer: '🙏', god: '🙏', bless: '🙏', blessed: '🙏',
    devil: '😈', demon: '😈', evil: '😈', angel: '😇', heaven: '😇', hell: '🔥', ghost: '👻', dead: '💀', die: '💀', death: '💀', kill: '🔪', skull: '💀',
    // money & stuff
    money: '💸', cash: '💵', rich: '💰', bands: '💵', racks: '💵', dollar: '💵', dollars: '💵', bank: '🏦', paid: '💰', pay: '💳', gold: '🥇',
    diamond: '💎', diamonds: '💎', ice: '🧊', icy: '🧊', chain: '⛓️', chains: '⛓️', ring: '💍', rings: '💍', crown: '👑', king: '👑', queen: '👑', drip: '💧',
    watch: '⌚', rolex: '⌚', shoes: '👟', sneakers: '👟', designer: '🛍️', bag: '👜', bags: '👜', gucci: '🛍️', prada: '🛍️', fashion: '🛍️',
    // vehicles & places
    car: '🏎️', cars: '🏎️', drive: '🚗', driving: '🚗', ride: '🏎️', riding: '🏎️', whip: '🏎️', benz: '🚘', lambo: '🏎️', ferrari: '🏎️', speed: '💨', fast: '💨',
    plane: '✈️', fly: '✈️', flying: '✈️', jet: '🛩️', flight: '✈️', boat: '🛥️', yacht: '🛥️', train: '🚆', road: '🛣️', highway: '🛣️', street: '🏙️', streets: '🏙️',
    city: '🌃', town: '🏘️', home: '🏠', house: '🏠', mansion: '🏰', room: '🚪', door: '🚪', window: '🪟', bed: '🛏️', club: '🪩', party: '🎉', world: '🌍',
    paris: '🗼', london: '💂', tokyo: '🗼', york: '🗽', vegas: '🎰', hollywood: '🎬', la: '🌴', miami: '🌴', cali: '🌴', california: '🌴',
    // nature & sky
    fire: '🔥', flame: '🔥', flames: '🔥', burn: '🔥', burning: '🔥', lit: '🔥', hot: '🥵', cold: '🥶', freeze: '🥶', snow: '❄️', rain: '🌧️', storm: '⛈️',
    thunder: '⚡', lightning: '⚡', sun: '☀️', sunshine: '☀️', summer: '☀️', moon: '🌙', night: '🌙', midnight: '🌙', star: '⭐', stars: '✨', sky: '🌌',
    space: '🚀', rocket: '🚀', planet: '🪐', ocean: '🌊', sea: '🌊', wave: '🌊', waves: '🌊', water: '💧', river: '🏞️', beach: '🏖️', island: '🏝️',
    flower: '🌸', flowers: '💐', rose: '🌹', roses: '🌹', tree: '🌳', garden: '🌷', wind: '🌬️', cloud: '☁️', clouds: '☁️', rainbow: '🌈', earth: '🌍',
    // time
    time: '⏰', clock: '🕰️', forever: '♾️', tonight: '🌙', morning: '🌅', today: '📅', tomorrow: '📅', yesterday: '📅', minute: '⏱️', second: '⏱️',
    // music & media
    music: '🎵', song: '🎶', songs: '🎶', sing: '🎤', singing: '🎤', mic: '🎤', beat: '🥁', drum: '🥁', drums: '🥁', guitar: '🎸', piano: '🎹', dance: '💃',
    dancing: '💃', radio: '📻', record: '💿', vinyl: '💿', headphones: '🎧', phone: '📱', call: '📞', text: '💬', texts: '💬', message: '💬', camera: '📸',
    picture: '📸', photo: '📸', movie: '🎬', tv: '📺', game: '🎮', play: '▶️', stage: '🎤', crowd: '🙌', fans: '🙌', famous: '🌟', star_: '🌟',
    // body & actions
    eyes: '👀', eye: '👁️', look: '👀', see: '👀', watch_: '👀', hand: '✋', hands: '🙌', lips: '👄', mouth: '👄', face: '🙂', head: '🗣️', feet: '🦶',
    run: '🏃', running: '🏃', walk: '🚶', jump: '🦘', fall: '⬇️', falling: '🍂', up: '⬆️', down: '⬇️', high: '📈', low: '📉', sleep: '😴', wake: '⏰',
    talk: '🗣️', say: '🗣️', said: '🗣️', scream: '😱', shout: '📣', whisper: '🤫', secret: '🤫', lie: '🤥', lies: '🤥', truth: '💯', real: '💯',
    // misc
    gun: '🔫', guns: '🔫', shot: '🎯', war: '⚔️', fight: '🥊', win: '🏆', winning: '🏆', lose: '📉', game_: '🎮', key: '🔑', keys: '🔑', lock: '🔒',
    drink: '🥂', drinks: '🥂', wine: '🍷', champagne: '🍾', beer: '🍺', coffee: '☕', smoke: '💨', cigarette: '🚬', pill: '💊', pills: '💊', candy: '🍬',
    sugar: '🍬', sweet: '🍭', cherry: '🍒', peach: '🍑', apple: '🍎', food: '🍔', pizza: '🍕', hungry: '🍽️', dog: '🐶', cat: '🐱', butterfly: '🦋',
    bird: '🐦', wings: '🪽', snake: '🐍', wolf: '🐺', lion: '🦁', tiger: '🐯', shark: '🦈', monster: '👾', alien: '👽', robot: '🤖', light: '💡',
    lights: '💡', dark: '🌑', darkness: '🌑', shadow: '🌑', mirror: '🪞', glass: '🥂', gift: '🎁', birthday: '🎂', wedding: '💒', school: '🏫',
    book: '📖', letter: '✉️', paper: '📄', ticket: '🎟️', map: '🗺️', magic: '🪄', luck: '🍀', lucky: '🍀', number: '🔢', one: '1️⃣', two: '2️⃣',
    goodbye: '👋', bye: '👋', hello: '👋', hi: '👋', yes: '✅', no: '❌', never: '🚫', stop: '🛑', go: '🟢', wait: '⏳', crown_: '👑', boss: '😎', cool: '😎',
  };
  const STRONG = new Set(['never', 'always', 'forever', 'love', 'hate', 'fire', 'money', 'now', 'go', 'stop', 'fly', 'high', 'free', 'alive', 'die',
    'everything', 'nothing', 'baby', 'yeah', 'whoa', 'oh', 'hey', 'tonight', 'crazy', 'wild', 'lit', 'up', 'out', 'again', 'more', 'all', 'gone', 'real']);

  const norm = (w) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');
  function iconFor(word) {
    let w = norm(word).replace(/'s$/, '').replace(/in'$/, 'ing');
    if (!w || w.length < 2) return null;
    if (ICONS[w]) return ICONS[w];
    for (const suf of ['ing', 'ed', 'es', 's', 'er', 'y']) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) {
        const st = w.slice(0, -suf.length);
        if (ICONS[st]) return ICONS[st];
        if (ICONS[st + 'e']) return ICONS[st + 'e'];
        if (suf === 'ing' && st.at(-1) === st.at(-2) && ICONS[st.slice(0, -1)]) return ICONS[st.slice(0, -1)]; // running → run
      }
    }
    return null;
  }

  // ---------- live vocal loudness (from system audio, when available) ----------
  const vocal = { level: 0, avg: 0, has: false };
  function sample(freq) {
    // ~300 Hz – 3 kHz is where most singing sits
    if (!freq) { vocal.has = false; return; }
    let sum = 0; for (let i = 6; i < 64; i++) sum += freq[i];
    const lvl = sum / 58;
    vocal.level = lvl;
    vocal.avg = vocal.avg ? vocal.avg * 0.985 + lvl * 0.015 : lvl;
    vocal.has = true;
  }

  // How much should this word stand out? 0..1
  function emphasis(span) {
    const w = span.textContent || '';
    const n = norm(w);
    let score = 0;
    if (/!/.test(w)) score += 0.6;
    if (n.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) score += 0.7;
    if (STRONG.has(n)) score += 0.3;
    const sibs = span.parentElement ? [...span.parentElement.querySelectorAll('.w')] : [];
    const i = sibs.indexOf(span);
    if (i === sibs.length - 1 && n.length >= 4) score += 0.3;              // line endings land harder
    if (i > 0 && norm(sibs[i - 1].textContent) === n) score += 0.4;        // repeated word ("go go go")
    const t = +span.dataset.t, nt = sibs[i + 1] ? +sibs[i + 1].dataset.t : NaN;
    if (span.dataset.exact && nt - t > 700) score += 0.45;                   // held note (word-timed lyrics only)
    if (vocal.has && vocal.avg > 8) score += Math.max(0, Math.min(1, (vocal.level / vocal.avg - 1.12) * 2.2));
    return Math.min(1, score);
  }

  // ---------- floating icon popups ----------
  const recent = new Map();
  function popIcon(span, emoji) {
    const layer = document.getElementById('fxLayer');
    if (!layer || !span.isConnected) return;
    const now = performance.now();
    if (recent.get(emoji) > now - 2500 || layer.childElementCount > 5) return;
    recent.set(emoji, now);
    const r = span.getBoundingClientRect();
    if (!r.width || r.top < -50 || r.top > innerHeight + 50) return;
    const el = document.createElement('div');
    el.className = 'icon-pop';
    el.textContent = emoji;
    const size = Math.max(34, Math.min(110, r.height * 1.25));
    el.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top}px;font-size:${size}px`;
    layer.appendChild(el);
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (window.anime) {
      anime.animate(el, {
        opacity: [{ to: 1, duration: 180 }, { to: 1, duration: 900 }, { to: 0, duration: 600 }],
        scale: [{ from: 0.2, to: 1.25, duration: 320, ease: 'outBack(2)' }, { to: 1, duration: 300 }],
        y: { from: 0, to: -size * 1.4, duration: 1700, ease: 'outCubic' },
        x: { from: 0, to: dir * size * 0.35, duration: 1700, ease: 'inOutSine' },
        rotate: { from: dir * -18, to: dir * 10, duration: 1700, ease: 'inOutSine' },
        onComplete: () => el.remove(),
      });
    } else setTimeout(() => el.remove(), 1800);
  }

  // Called once when a word is sung
  function onWordOn(span) {
    if (S.lyrics.emphasis !== false) {
      const e = emphasis(span);
      if (e >= 0.45) { span.classList.add('emph'); span.style.setProperty('--e', e.toFixed(2)); }
    }
    if (S.lyrics.icons && !span.closest('.no-icons')) {
      const ic = iconFor(span.textContent);
      if (ic) { span.dataset.icon = ic; popIcon(span, ic); }
    }
  }

  return { iconFor, emphasis, sample, onWordOn, popIcon, vocal };
})();
