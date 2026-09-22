/* ============================================================
   script.js — alur, animasi, partikel, musik, dan interaksi
   Isi konten (nama, foto, surat, kupon) ada di config.js
   ============================================================ */
(() => {
  'use strict';

  /* ------------------------------------------------------------
     1. Config & helper
  ------------------------------------------------------------ */
  const CFG = window.GIFT_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const clean = (v, max = 40) => String(v || '').trim().slice(0, max);

  const NAME = clean(params.get('nama')) || clean(CFG.name) || 'Kamu';
  const FROM = clean(params.get('dari'));
  const SIGNATURE = FROM ? `— dari ${FROM} 💗` : (CFG.signature || '— dengan sayang 💗');
  const TWISTS = (Array.isArray(CFG.twists) && CFG.twists.length) ? CFG.twists : ['Plot twist: hari ini kamu resmi bertambah satu tahun lebih keren 😌'];
  const COUPONS = (Array.isArray(CFG.coupons) && CFG.coupons.length) ? CFG.coupons : ['Kupon: 1× traktir es krim 🍦'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const startBtn = $('#startBtn');
  const musicBtn = $('#musicBtn');
  const veil = $('#veil');
  const loader = $('#loader');
  const glowEl = $('#cursorGlow');

  /* ------------------------------------------------------------
     2. Partikel (canvas): latar melayang + confetti + kursor
  ------------------------------------------------------------ */
  const bgCanvas = $('#bgCanvas');
  const fxCanvas = $('#fxCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  const fxCtx = fxCanvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const PALETTE = ['#F8C8DC', '#F6B6D0', '#BFDFFF', '#AFCBFF', '#FFFFFF', '#F4A6C6', '#93B8F7'];
  const CONFETTI = ['#F8C8DC', '#F6B6D0', '#BFDFFF', '#AFCBFF', '#FFF8F5', '#F4A6C6', '#93B8F7', '#FFFFFF'];

  function shape(c, kind, s) {
    switch (kind) {
      case 'heart':
        c.beginPath();
        c.moveTo(0, s * .5);
        c.bezierCurveTo(-s, -s * .05, -s * .5, -s * .85, 0, -s * .3);
        c.bezierCurveTo(s * .5, -s * .85, s, -s * .05, 0, s * .5);
        c.closePath(); c.fill(); break;
      case 'spark':
        c.beginPath();
        c.moveTo(0, -s);
        c.quadraticCurveTo(0, 0, s, 0);
        c.quadraticCurveTo(0, 0, 0, s);
        c.quadraticCurveTo(0, 0, -s, 0);
        c.quadraticCurveTo(0, 0, 0, -s);
        c.closePath(); c.fill(); break;
      case 'star':
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * .45 : s;
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath(); c.fill(); break;
      case 'rect':
        c.fillRect(-s, -s * .5, s * 2, s); break;
      default:
        c.beginPath(); c.arc(0, 0, s * .6, 0, TAU); c.fill();
    }
  }

  /* --- partikel latar (pelan, di belakang konten) --- */
  const ambient = [];
  function newAmbient(anywhere) {
    const kind = pick(['heart', 'heart', 'spark', 'spark', 'star', 'dot']);
    return {
      kind, x: rand(0, W), y: anywhere ? rand(0, H) : H + rand(10, 80),
      size: rand(5, 12) * (kind === 'dot' ? .5 : 1),
      vy: rand(10, 28), amp: rand(8, 26), f: rand(.25, .6), ph: rand(0, TAU),
      rot: rand(-.4, .4), vr: rand(-.3, .3), a: rand(.35, .8), color: pick(PALETTE)
    };
  }
  function seedAmbient() {
    ambient.length = 0;
    if (reduceMotion) return;
    const n = clamp(Math.round(W / 38), 12, 30);
    for (let i = 0; i < n; i++) ambient.push(newAmbient(true));
  }
  function drawBg(dt, t) {
    bgCtx.clearRect(0, 0, W, H);
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.y -= p.vy * dt; p.rot += p.vr * dt;
      if (p.y < -30) { ambient[i] = newAmbient(false); continue; }
      const x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
      const tw = p.kind === 'spark' ? .65 + .35 * Math.sin(t * 2.2 + p.ph) : 1;
      bgCtx.save();
      bgCtx.translate(x, p.y);
      bgCtx.rotate(p.kind === 'heart' ? Math.sin(t * p.f + p.ph) * .25 : p.rot);
      bgCtx.globalAlpha = p.a * tw;
      bgCtx.fillStyle = p.color;
      shape(bgCtx, p.kind, p.size);
      bgCtx.restore();
    }
  }

  /* --- partikel efek (confetti, hati, jejak kursor) --- */
  const parts = [];
  const MAX_PARTS = 280;
  let fxDirty = false;
  const addPart = o => { if (parts.length < MAX_PARTS) parts.push(o); };

  function burstAt(x, y, opt = {}) {
    if (reduceMotion) return;
    const count = opt.count || 24, power = opt.power || 1, colors = opt.colors || CONFETTI;
    for (let i = 0; i < count; i++) {
      const kind = Math.random() < .5 ? 'rect' : pick(['heart', 'spark', 'heart', 'dot']);
      const a = rand(0, TAU), sp = rand(120, 380) * power;
      addPart({
        mode: 'burst', kind, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150 * power,
        g: 300, drag: .2, rot: rand(0, TAU), vr: rand(-6, 6), flip: rand(0, TAU),
        s: kind === 'rect' ? rand(3.5, 6) : rand(5, 10), c: pick(colors), life: rand(1.6, 2.6)
      });
    }
  }
  function spawnTrail(x, y) {
    addPart({
      mode: 'burst', kind: pick(['spark', 'spark', 'heart']),
      x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-14, 14), vy: rand(-22, 8),
      g: 24, drag: .5, rot: rand(0, TAU), vr: rand(-2, 2),
      s: rand(3, 6.5), c: pick(['#F4A6C6', '#93B8F7', '#F6B6D0', '#AFCBFF']), life: rand(.55, .9)
    });
  }
  function spawnFall() {
    const kind = Math.random() < .55 ? 'rect' : pick(['heart', 'spark', 'dot']);
    addPart({
      mode: 'fall', kind, x: rand(0, W), y: -14, vy: rand(38, 85),
      sway: rand(10, 30), f: rand(.6, 1.4), ph: rand(0, TAU), age: 0,
      rot: rand(0, TAU), vr: rand(-2, 2), flip: rand(0, TAU),
      s: kind === 'rect' ? rand(3, 5) : rand(5, 9), c: pick(CONFETTI.slice(0, 7)), alpha: rand(.7, 1)
    });
  }
  function spawnRise() {
    addPart({
      mode: 'rise', kind: 'heart', x: rand(0, W), y: H + 14, vy: -rand(50, 100),
      sway: rand(10, 26), f: rand(.5, 1.1), ph: rand(0, TAU), age: 0,
      rot: 0, vr: 0, s: rand(6, 11), c: pick(['#F4A6C6', '#F6B6D0', '#93B8F7', '#AFCBFF']), alpha: rand(.6, .95)
    });
  }
  function stepPart(p, dt) {
    p.rot += p.vr * dt;
    if (p.flip !== undefined) p.flip += 7 * dt;
    if (p.mode === 'burst') {
      const k = Math.pow(p.drag, dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    }
    p.age += dt; p.y += p.vy * dt;
    return p.mode === 'fall' ? p.y < H + 20 : p.y > -20;
  }
  function drawFx(dt) {
    if (!parts.length) {
      if (fxDirty) { fxCtx.clearRect(0, 0, W, H); fxDirty = false; }
      return;
    }
    fxDirty = true;
    fxCtx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!stepPart(p, dt)) { parts.splice(i, 1); continue; }
      const x = p.mode === 'burst' ? p.x : p.x + Math.sin(p.age * p.f + p.ph) * p.sway;
      const a = p.mode === 'burst' ? Math.min(1, p.life / .5) : p.alpha;
      fxCtx.save();
      fxCtx.translate(x, p.y);
      fxCtx.rotate(p.rot);
      if (p.kind === 'rect') fxCtx.scale(1, Math.cos(p.flip));
      fxCtx.globalAlpha = a;
      fxCtx.fillStyle = p.c;
      shape(fxCtx, p.kind, p.s);
      fxCtx.restore();
    }
  }

  /* --- kursor (desktop) --- */
  const mouse = { x: -100, y: -100 };
  const glow = { x: -100, y: -100 };
  let lastTrail = 0;
  if (finePointer && !reduceMotion) {
    window.addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY;
      glowEl.classList.add('on');
      const now = performance.now();
      if (now - lastTrail > 55) { lastTrail = now; spawnTrail(e.clientX, e.clientY); }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => glowEl.classList.remove('on'));
  }

  /* --- percikan kecil saat tap/klik --- */
  let lastTap = 0;
  window.addEventListener('pointerdown', e => {
    const now = performance.now();
    if (now - lastTap < 140) return;
    lastTap = now;
    burstAt(e.clientX, e.clientY, { count: 7, power: .45, colors: ['#F4A6C6', '#93B8F7', '#F6B6D0', '#AFCBFF'] });
  }, { passive: true });

  /* --- ukuran canvas & loop --- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    [bgCanvas, fxCanvas].forEach(c => { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fxCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seedAmbient();
  }
  let resizeTimer = 0, lastW = 0, lastH = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth !== lastW || Math.abs(window.innerHeight - lastH) > 150) { resize(); lastW = W; lastH = H; }
    }, 150);
  });

  let finale = false, fallAcc = 0, riseAcc = 0, lastT = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - lastT) / 1000);
    lastT = now;
    drawBg(dt, now / 1000);
    if (finale && !reduceMotion) {
      fallAcc += dt * 5; riseAcc += dt * 1.3;
      while (fallAcc >= 1) { fallAcc -= 1; spawnFall(); }
      while (riseAcc >= 1) { riseAcc -= 1; spawnRise(); }
    }
    drawFx(dt);
    if (finePointer && !reduceMotion) {
      const k = Math.min(1, dt * 12);
      glow.x += (mouse.x - glow.x) * k; glow.y += (mouse.y - glow.y) * k;
      glowEl.style.transform = `translate3d(${glow.x}px,${glow.y}px,0)`;
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------
     3. Musik (melodi music-box bawaan, atau file sendiri)
  ------------------------------------------------------------ */
  const Music = (() => {
    const BEAT = 60 / 76;
    // [nada MIDI, durasi dalam ketukan] — melodi ulang tahun, 3/4
    const MELODY = [
      [67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2],
      [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
      [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 1],
      [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 2]
    ];
    const C = [48, 55, 64], G = [43, 55, 59], F = [41, 53, 57];
    const CHORDS = [C, G, G, C, C, F, F, C];
    const PASS_LEN = 28 * BEAT;

    let ctx = null, master = null, bus = null, timer = null, audioEl = null;
    let nextPass = 0, on = false, everStarted = false;

    const mf = m => 440 * Math.pow(2, (m - 69) / 12);
    const vol = () => clamp(Number(CFG.music && CFG.music.volume) || .6, 0, 1);
    const src = () => (CFG.music && CFG.music.src) || '';

    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      bus = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      bus.connect(lp); lp.connect(master);
      // gema lembut
      const dl = ctx.createDelay(1); dl.delayTime.value = .34;
      const fb = ctx.createGain(); fb.gain.value = .32;
      const wet = ctx.createGain(); wet.gain.value = .34;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      bus.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(master);
      return true;
    }
    function tone(freq, t, dur, v) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      const g = ctx.createGain(), g2 = ctx.createGain();
      o1.type = 'sine'; o2.type = 'triangle';
      o1.frequency.value = freq; o2.frequency.value = freq * 2;
      g2.gain.value = .16;
      o1.connect(g); o2.connect(g2); g2.connect(g);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      g.connect(bus);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + .05); o2.stop(t + dur + .05);
    }
    function schedulePass(t0) {
      let beat = 0;
      MELODY.forEach(([m, b]) => {
        tone(mf(m), t0 + beat * BEAT, Math.max(.9, b * BEAT * 1.6), .16);
        beat += b;
      });
      CHORDS.forEach((ch, i) => {
        ch.forEach((m, j) => tone(mf(m), t0 + (i * 3 + j) * BEAT, 1.1, j === 0 ? .07 : .045));
      });
    }
    function tick() {
      if (!ctx) return;
      while (nextPass < ctx.currentTime + 4) { schedulePass(nextPass); nextPass += PASS_LEN; }
    }

    function start() {
      everStarted = true;
      if (src()) {
        if (!audioEl) { audioEl = new Audio(src()); audioEl.loop = true; }
        audioEl.volume = vol();
        on = true;
        const pr = audioEl.play();
        if (pr && pr.catch) pr.catch(() => { on = false; sync(); });
        return;
      }
      if (!ctx && !build()) return;
      ctx.resume();
      if (!timer) { nextPass = ctx.currentTime + .2; tick(); timer = setInterval(tick, 700); }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(vol(), ctx.currentTime, .4);
      on = true;
    }
    function stop() {
      on = false;
      if (audioEl) { audioEl.pause(); return; }
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .15);
      setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 700);
    }
    function toggle() { on ? stop() : start(); }

    // jeda otomatis saat tab disembunyikan
    let resumeOnShow = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { resumeOnShow = on; if (on) stop(); }
      else if (resumeOnShow) { resumeOnShow = false; start(); sync(); }
    });

    return { start, toggle, get isOn() { return on; }, get everStarted() { return everStarted; } };
  })();

  function sync() {
    const on = Music.isOn;
    musicBtn.classList.toggle('is-on', on);
    musicBtn.setAttribute('aria-pressed', String(on));
    musicBtn.setAttribute('aria-label', on ? 'Matikan musik' : 'Nyalakan musik');
  }
  musicBtn.addEventListener('click', () => { Music.toggle(); sync(); });

  /* ------------------------------------------------------------
     4. Navigasi & section bertahap
  ------------------------------------------------------------ */
  const steps = ['s1', 's2', 's3', 's4', 's5', 's6'];
  const sections = steps.map(id => document.getElementById(id));
  const dots = $$('.dots button');
  const entered = new Set();

  function unlockUpTo(n) {
    for (let i = 0; i < n; i++) {
      sections[i].classList.remove('locked');
      if (dots[i]) dots[i].disabled = false;
    }
  }
  function goTo(id, instant) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: (instant || reduceMotion) ? 'auto' : 'smooth', block: 'start' });
  }
  function advance(id) {
    unlockUpTo(steps.indexOf(id) + 1);
    goTo(id);
  }
  function veilTransition(mid) {
    if (reduceMotion) { mid(); return; }
    veil.classList.add('on');
    setTimeout(() => {
      mid();
      requestAnimationFrame(() => setTimeout(() => veil.classList.remove('on'), 180));
    }, 650);
  }

  $$('[data-next]').forEach(b => b.addEventListener('click', () => advance(b.dataset.next)));
  dots.forEach(d => d.addEventListener('click', () => goTo(d.dataset.target)));

  function onEnter(id) {
    document.body.dataset.scene = id === 's1' ? 'open' : id === 's6' ? 'final' : 'mid';
    if (entered.has(id)) return;
    entered.add(id);
    if (id === 's2') setTimeout(() => burstAt(window.innerWidth / 2, window.innerHeight * .3, { count: 16, power: .7 }), 700);
    if (id === 's6') setTimeout(() => burstAt(window.innerWidth / 2, window.innerHeight * .38, { count: 34 }), 500);
  }
  const sectionIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.target.id === 's6') finale = e.isIntersecting;
      if (!e.isIntersecting) return;
      dots.forEach(d => d.removeAttribute('aria-current'));
      const d = dots.find(x => x.dataset.target === e.target.id);
      if (d) d.setAttribute('aria-current', 'true');
      onEnter(e.target.id);
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(s => sectionIO.observe(s));

  // gradient latar ikut bergeser halus mengikuti scroll
  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      document.documentElement.style.setProperty('--p', p.toFixed(3));
      scrollTick = false;
    });
  }, { passive: true });

  /* ------------------------------------------------------------
     5. Fade-in saat muncul
  ------------------------------------------------------------ */
  let revealIO = null;
  function initReveal() {
    revealIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
      });
    }, { threshold: .15, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal').forEach(el => revealIO.observe(el));
  }

  /* ------------------------------------------------------------
     6. Isi dinamis: nama, foto, surat
  ------------------------------------------------------------ */
  function personalize() {
    $$('.name').forEach(el => { el.textContent = NAME; });
    document.title = NAME === 'Kamu' ? 'Happy Birthday ✨' : `Happy Birthday, ${NAME} ✨`;
  }

  const CAMERA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg><span>foto kamu di sini</span>';
  const photoImgs = [];

  function buildPhotos() {
    const board = $('#photoBoard');
    const rots = [-5, 4, -3, 5, -4];
    const list = (Array.isArray(CFG.photos) ? CFG.photos : []).slice(0, 5);
    list.forEach((ph, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'polaroid-wrap reveal';
      wrap.style.setProperty('--d', (i * .13).toFixed(2) + 's');

      const fig = document.createElement('figure');
      fig.className = 'polaroid';
      fig.style.setProperty('--r', rots[i % rots.length] + 'deg');
      fig.dataset.sticker = ph.sticker || '';

      const frame = document.createElement('div');
      frame.className = 'polaroid__img';
      const placeholder = () => {
        frame.innerHTML = CAMERA_SVG;
        frame.classList.add('is-empty', 'tone-' + (i % 3));
      };
      if (ph.src) {
        const img = new Image();
        img.alt = ph.alt || ph.caption || 'Foto';
        img.decoding = 'async';
        img.addEventListener('error', placeholder);
        img.src = ph.src;
        frame.appendChild(img);
        photoImgs.push(img);
      } else {
        placeholder();
      }

      const cap = document.createElement('figcaption');
      cap.textContent = ph.caption || '';
      fig.append(frame, cap);
      wrap.appendChild(fig);
      board.appendChild(wrap);
    });
  }

  const stage = $('#letterStage');
  const envelope = $('#envelope');
  const letter = $('#letter');

  function buildLetter() {
    const body = $('#letterBody');
    const lines = Array.isArray(CFG.letter) ? CFG.letter : [];
    lines.forEach((text, i) => {
      const p = document.createElement('p');
      p.className = text ? 'line' : 'line line--gap';
      p.style.setProperty('--i', i);
      p.textContent = text;
      body.appendChild(p);
    });
    const from = $('#letterFrom');
    from.style.setProperty('--i', lines.length + 1);
    from.textContent = SIGNATURE;
  }

  function openLetter() {
    if (envelope.classList.contains('open')) return;
    envelope.classList.add('open');
    envelope.setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      stage.classList.add('reading');
      letter.classList.add('show');
      const r = letter.getBoundingClientRect();
      burstAt(window.innerWidth / 2, Math.max(140, r.top + 40), { count: 18, power: .8 });
      setTimeout(() => letter.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }), 500);
    }, reduceMotion ? 50 : 1500);
  }
  envelope.addEventListener('click', openLetter);

  /* ------------------------------------------------------------
     7. Interaksi kecil
  ------------------------------------------------------------ */
  // Balon: pecahkan, muncul lagi beberapa detik kemudian
  $$('.balloon').forEach(b => {
    b.addEventListener('click', () => {
      if (b.classList.contains('pop')) return;
      const r = b.getBoundingClientRect();
      b.classList.remove('back');
      b.classList.add('pop');
      burstAt(r.left + r.width / 2, r.top + r.height * .4, { count: 14, power: .8, colors: [b.dataset.c, '#FFFFFF', '#FFF8F5', b.dataset.c] });
      setTimeout(() => { b.classList.remove('pop'); b.classList.add('back'); }, 3800);
    });
  });

  // Plot twist
  const curiousBtn = $('#curiousBtn');
  const twistBox = $('#twistBox');
  const twistText = $('#twistText');
  const curiousLabel = curiousBtn.textContent;
  let twistIdx = -1;
  curiousBtn.addEventListener('click', () => {
    twistIdx = (twistIdx + 1) % TWISTS.length;
    twistText.classList.remove('pop');
    void twistText.offsetWidth;
    twistText.textContent = TWISTS[twistIdx];
    twistText.classList.add('pop');
    twistBox.classList.add('open');
    curiousBtn.textContent = 'Masih penasaran? 👀';
    const r = curiousBtn.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, { count: 26 });
  });

  // Tiup lilin
  const cakeBtn = $('#cakeBtn');
  const cakeHint = $('#cakeHint');
  const HINT_LIT = 'Tiup lilinnya, terus make a wish 🕯️';
  cakeBtn.addEventListener('click', () => {
    const out = cakeBtn.classList.toggle('out');
    cakeHint.textContent = out ? 'Wish kamu sudah dititipkan. Semoga terkabul ✨' : 'Nyala lagi! Ketuk untuk meniup 🕯️';
    if (out) {
      const r = cakeBtn.getBoundingClientRect();
      burstAt(r.left + r.width / 2, r.top + r.height * .3, { count: 30 });
    }
  });

  // Kupon kejutan
  const giftBtn = $('#giftBtn');
  const couponBox = $('#couponBox');
  const couponText = $('#couponText');
  let lastCoupon = -1;
  giftBtn.addEventListener('click', () => {
    giftBtn.classList.remove('shake');
    void giftBtn.offsetWidth;
    giftBtn.classList.add('shake');
    setTimeout(() => {
      let i;
      do { i = Math.floor(Math.random() * COUPONS.length); } while (i === lastCoupon && COUPONS.length > 1);
      lastCoupon = i;
      couponText.classList.remove('pop');
      void couponText.offsetWidth;
      couponText.textContent = COUPONS[i];
      couponText.classList.add('pop');
      couponBox.classList.add('open');
      const r = giftBtn.getBoundingClientRect();
      burstAt(r.left + r.width / 2, r.top + r.height / 2, { count: 22 });
    }, 450);
  });

  /* ------------------------------------------------------------
     8. Mulai, final, ulangi
  ------------------------------------------------------------ */
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    const r = startBtn.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, { count: 30 });
    if (!Music.everStarted) { Music.start(); sync(); }
    veilTransition(() => { unlockUpTo(2); goTo('s2', true); });
  });

  $('#confettiBtn').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2, { count: 38 });
  });

  function resetAll() {
    veilTransition(() => {
      sections.forEach((s, i) => { if (i > 0) s.classList.add('locked'); });
      dots.forEach((d, i) => { d.disabled = i > 0; });
      entered.clear();
      finale = false;
      parts.length = 0;

      envelope.classList.remove('open');
      envelope.setAttribute('aria-expanded', 'false');
      stage.classList.remove('reading');
      letter.classList.remove('show');

      twistBox.classList.remove('open'); twistIdx = -1; curiousBtn.textContent = curiousLabel;
      cakeBtn.classList.remove('out'); cakeHint.textContent = HINT_LIT;
      couponBox.classList.remove('open');
      $$('.balloon').forEach(b => b.classList.remove('pop', 'back'));

      sections.forEach((s, i) => {
        if (i === 0) return;
        $$('.reveal', s).forEach(el => { el.classList.remove('in'); revealIO.observe(el); });
      });
      startBtn.disabled = false;
      window.scrollTo(0, 0);
    });
  }
  $('#replayBtn').addEventListener('click', resetAll);

  /* ------------------------------------------------------------
     9. Loading screen & start
  ------------------------------------------------------------ */
  function runLoader() {
    const bar = $('.loader__bar span', loader);
    const minTime = 1500, t0 = performance.now();
    (function tick() {
      const p = Math.min(1, (performance.now() - t0) / minTime);
      bar.style.transform = `scaleX(${(.08 + .88 * (1 - Math.pow(1 - p, 3))).toFixed(3)})`;
      if (p < 1) requestAnimationFrame(tick);
    })();

    const fontsReady = (document.fonts && document.fonts.ready) ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
    const imgsReady = Promise.race([
      Promise.all(photoImgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.addEventListener('load', res); img.addEventListener('error', res); }))),
      wait(3500)
    ]);
    return Promise.all([fontsReady, imgsReady, wait(minTime)]).then(() => {
      bar.style.transform = 'scaleX(1)';
      return wait(250);
    }).then(() => {
      loader.classList.add('hide');
      document.body.classList.add('ready');
      setTimeout(() => loader.remove(), 1000);
    });
  }

  function init() {
    personalize();
    buildPhotos();
    buildLetter();
    resize(); lastW = W; lastH = H;
    requestAnimationFrame(frame);
    runLoader().then(initReveal);
  }

  init();
})();
