// Auto-Vibe: picks a lyric style that fits the song.
// Spotify no longer gives new apps audio features (energy, tempo...), so we combine what's still available:
// the artist's genres, how fast the lyrics come, and the words in the lyrics.
const Vibe = (() => {
  const VIBES = {
    hype:       { label: 'hype / party rap',   styles: ['kinetic', 'shockwave', 'tunnel', 'grid', 'stack'] },
    rap:        { label: 'rap',                styles: ['kinetic', 'shockwave', 'spotlight', 'grid', 'split'] },
    party:      { label: 'party / dance',      styles: ['tunnel', 'kinetic', 'shockwave', 'spotlight', 'fisheye'] },
    electronic: { label: 'electronic',         styles: ['tunnel', 'spotlight', 'wave', 'ticker', 'neon'] },
    chill:      { label: 'chill / R&B',        styles: ['ink', 'cloud', 'cinema', 'stars', 'neon'] },
    pop:        { label: 'pop',                styles: ['chat', 'fisheye', 'kinetic', 'polaroid', 'focus'] },
    rock:       { label: 'rock',               styles: ['stack', 'grid', 'shockwave', 'ticker', 'tunnel'] },
    acoustic:   { label: 'acoustic / indie',   styles: ['polaroid', 'cinema', 'editorial', 'minimal', 'ink'] },
  };
  // genre keywords → vibe points
  const GENRE_RULES = [
    [/rage|drill|trap|plugg|crunk|phonk|hyperpop|frat|party rap/, { hype: 4.5 }],
    [/rap|hip hop|hip-hop|grime|boom bap|g-funk/, { rap: 3 }],
    [/edm|house|techno|trance|dubstep|electro|drum and bass|dnb|bass music|synthwave|future bass|electronica|idm/, { electronic: 3, party: 1 }],
    [/\bdance\b|dance pop|club|disco|reggaeton|dancehall|afrobeats|amapiano|latin/, { party: 2.5, pop: 1 }],
    [/r&b|rnb|soul|neo soul|lo-fi|lofi|chill|ambient|bedroom|downtempo|trip hop|jazz|bossa/, { chill: 3 }],
    [/acoustic|folk|singer.songwriter|indie|country|americana|piano|classical/, { acoustic: 2.5, chill: 0.5 }],
    [/rock|metal|punk|grunge|emo|hardcore|shoegaze/, { rock: 3 }],
    [/alternative/, { rock: 1.5, pop: 0.5 }],
    [/pop|k-pop|kpop|j-pop/, { pop: 2 }],
  ];
  const PARTY_WORDS = /\b(party|club|turn(t| up)|shots?|drunk|lit|dance|dancin|bounce|twerk|weekend|crowd|rage|mosh|pop out|slime)\b/g;
  const SOFT_WORDS = /\b(love|heart|baby|feel|feelings|miss|alone|slow|hold|kiss|tears?|cry|soft|dream|rain|night)\b/g;

  function classify({ genres = [], lines = [], explicit = false, title = '' }) {
    const score = Object.fromEntries(Object.keys(VIBES).map((k) => [k, 0]));
    const reasons = [];
    const gtext = genres.join(' | ').toLowerCase();
    for (const [re, pts] of GENRE_RULES) if (re.test(gtext)) for (const [k, v] of Object.entries(pts)) score[k] += v;
    if (genres.length) reasons.push(genres.slice(0, 2).join(', '));

    // lyric speed: rap verses pack far more words per second
    const real = lines.filter((l) => l.text && l.text !== '♪');
    if (real.length > 4) {
      const words = real.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
      const span = (real[real.length - 1].t - real[0].t) / 1000 || 1;
      const wps = words / span;
      if (wps > 2.9) { score.rap += 2; score.hype += 1.5; reasons.push('fast lyrics'); }
      else if (wps > 2.2) { score.rap += 1; score.pop += 0.5; }
      else if (wps < 1.15) { score.chill += 1.5; score.acoustic += 1; reasons.push('slow lyrics'); }
      const all = real.map((l) => l.text.toLowerCase()).join(' ');
      const party = (all.match(PARTY_WORDS) || []).length, soft = (all.match(SOFT_WORDS) || []).length;
      if (party >= 3) { score.party += Math.min(3, party * 0.5); score.hype += 0.5; reasons.push('party words'); }
      if (soft >= 5 && wps < 2.2) { score.chill += Math.min(2, soft * 0.25); }
    }
    if (explicit) { score.rap += 0.5; score.hype += 0.3; }
    if (/remix|edit|bootleg|vip/i.test(title)) score.electronic += 1;

    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    const vibe = best[1] > 0 ? best[0] : 'pop';
    return { vibe, label: VIBES[vibe].label, reasons, score };
  }

  // same song → same style; different songs of a vibe get different styles from its set
  let lastPick = null;
  function pick(vibe, trackId) {
    const list = VIBES[vibe]?.styles || VIBES.pop.styles;
    let h = 0; for (const c of trackId || 'x') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    let style = list[h % list.length];
    if (style === lastPick && list.length > 1) style = list[(h + 1) % list.length];
    lastPick = style;
    return style;
  }
  return { classify, pick, VIBES };
})();
