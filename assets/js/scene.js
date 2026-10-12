/* Yuksalish.dev — skroll bilan almashadigan 4 fasl.
 * Bitta SVG manzara CSS o‘zgaruvchilari orqali qayta bo‘yaladi,
 * canvas esa ob-havoni (yomg‘ir, gulbarg, qushlar, barg, qor, tutun) chizadi. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const svg = document.getElementById('scene');
  const canvas = document.getElementById('weather');
  const ctx = canvas.getContext('2d');

  /* ---------- Fasllar ---------- */
  const SEASONS = [
    { name: 'Bahor', desc: 'Yomg‘irli', icon: '🌧️' },
    { name: 'Yoz',   desc: 'Quyoshli',  icon: '☀️' },
    { name: 'Kuz',   desc: 'Shamolli',  icon: '🍂' },
    { name: 'Qish',  desc: 'Qorli',     icon: '❄️' },
  ];

  // Ranglar: [bahor, yoz, kuz, qish]
  const COLORS = {
    'sky0':    ['#79b6de', '#2b86d6', '#d9805a', '#8ea3b8'],
    'sky1':    ['#e6f3f5', '#bde4ff', '#fbd6a0', '#e8edf2'],
    'sun':     ['#fff2c0', '#ffd84a', '#ff9447', '#f4f6f8'],
    'glow':    ['#fff6d6', '#fff1a8', '#ffb070', '#ffffff'],
    'cloud':   ['#e3e9ee', '#ffffff', '#fbe0cb', '#dde4ea'],
    'mt-far':  ['#93a9be', '#7f98b0', '#9a7f90', '#b4c2d0'],
    'mt-near': ['#74a58a', '#5b8f6e', '#a8714f', '#d3dde7'],
    'hill':    ['#8acb7c', '#5aa84c', '#d39a45', '#e9eff5'],
    'ground':  ['#66b158', '#3f8d38', '#b67b33', '#f5f8fb'],
    'lake0':   ['#9ccbe2', '#4aa3dc', '#7f9db0', '#d9e7f1'],
    'lake1':   ['#6fa9c9', '#2c7fb8', '#5d7b90', '#b9cfdf'],
    'canopy':  ['#a3d977', '#45963e', '#e9822f', '#ffffff'],
    'canopy2': ['#82c35d', '#2f7a2d', '#c95a2a', '#ffffff'],
    'trunk':   ['#6e4c37', '#6a4733', '#5e3e2c', '#5b4a43'],
    'pine':    ['#2f6e48', '#245c3b', '#2f5a42', '#2d4f47'],
    'wall':    ['#efe2cf', '#f3e6d0', '#e6d2b6', '#e3dbd2'],
    'roof':    ['#b9533c', '#c05a3f', '#9c4431', '#8d5b4e'],
    'grass':   ['#4f9b45', '#2f7a2c', '#9a6326', '#c9d4dd'],
    'accent':  ['#d6457a', '#d97a00', '#c4501f', '#2f6fb3'],
  };

  // Shaffoflik va boshqa sonlar
  const NUMBERS = {
    'caps-op':    [.6, .2, .4, 1],
    'haze-op':    [.35, .15, .3, .45],
    'cloud-op':   [.95, .6, .75, .9],
    'canopy-op':  [1, 1, .95, 0],
    'blossom-op': [1, 0, 0, 0],
    'apple-op':   [0, .25, 1, 0],
    'snow-op':    [0, 0, 0, 1],
    'window-op':  [.2, .05, .6, 1],
    'flower-op':  [1, .75, 0, 0],
    'pumpkin-op': [0, 0, 1, 0],
    'snowman-op': [0, 0, 0, 1],
    'grass-op':   [1, 1, .7, 0],
    'ice-op':     [0, 0, 0, .8],
    'rainbow-op': [.45, 0, 0, 0],
  };
  const SUN = { x: [1240, 800, 1380, 1040], y: [190, 130, 330, 250], r: [56, 68, 62, 46] };
  const WIND = [.5, .15, 2.4, .7];
  const TEMP = [16, 32, 11, -6];

  /* ---------- Yordamchilar ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const RGB = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.map(hexToRgb)]));
  const mixRgb = (a, b, t) => a.map((c, i) => Math.round(lerp(c, b[i], t)));

  // Takrorlanuvchi tasodifiy sonlar (bezaklar har safar bir xil joyda bo‘lsin)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- SVG bezaklarini yaratish ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };

  const grass = document.getElementById('grass');
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1600, y = 772 + rnd() * 120, h = 6 + rnd() * 10;
    el('path', { d: `M${x} ${y} q-3 ${-h / 2} -5 ${-h} M${x} ${y} q1 ${-h / 2} 1 ${-h * 1.2} M${x} ${y} q3 ${-h / 2} 6 ${-h * .9}` }, grass);
  }
  const flowers = document.getElementById('flowers');
  const FLOWER_COLORS = ['#ff6f91', '#ffd166', '#ffffff', '#b28dff', '#ff9f43'];
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 1600, y = 780 + rnd() * 110;
    if (x > 500 && x < 620 && y < 800) continue;
    el('circle', { cx: x, cy: y, r: 3 + rnd() * 2.5, fill: FLOWER_COLORS[i % FLOWER_COLORS.length] }, flowers);
    el('circle', { cx: x, cy: y, r: 1.4, fill: '#f4b400' }, flowers);
  }
  const blossoms = document.getElementById('blossoms');
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 110;
    el('circle', { cx: 562 + Math.cos(a) * d * 1.15, cy: 530 + Math.sin(a) * d * .75, r: 3.5 + rnd() * 3, fill: i % 3 ? '#f7a8c4' : '#fff' }, blossoms);
  }
  const apples = document.getElementById('apples');
  [[500, 560], [610, 520], [545, 600], [650, 575], [470, 520], [585, 470], [520, 470], [600, 600]].forEach(([x, y]) => {
    el('circle', { cx: x, cy: y, r: 8, fill: '#d63b2b' }, apples);
    el('circle', { cx: x - 2.5, cy: y - 2.5, r: 2.2, fill: '#fff', opacity: .5 }, apples);
  });

  const clouds = [...document.querySelectorAll('.cloud')].map((n) => ({
    n, x: +n.dataset.x, y: +n.dataset.y, s: +n.dataset.s, k: +n.dataset.k,
  }));
  const sunG = document.getElementById('sunG');
  const sunCircle = document.getElementById('sun');
  const layers = ['layerFar', 'layerMid', 'layerNear'].map((id, i) => ({ n: document.getElementById(id), k: [6, 12, 22][i] }));
  const chimney = document.getElementById('chimney');

  /* ---------- UI ---------- */
  const sections = [...document.querySelectorAll('[data-season]')];
  const railLinks = [...document.querySelectorAll('.rail a')];
  const railFill = document.querySelector('.rail-fill');
  const wxName = document.getElementById('wxName');
  const wxDesc = document.getElementById('wxDesc');
  const wxIcon = document.getElementById('wxIcon');
  const wxTemp = document.getElementById('wxTemp');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  document.getElementById('year').textContent = new Date().getFullYear();

  let tops = [], maxScroll = 1;
  function measure() {
    tops = sections.map((s) => s.getBoundingClientRect().top + scrollY);
    maxScroll = Math.max(1, root.scrollHeight - innerHeight);
  }

  // Skroll holatidan uzluksiz fasl qiymati: 0 (bahor) … 3 (qish)
  function targetSeason() {
    const y = scrollY;
    let s = 0;
    for (let i = 0; i < tops.length - 1; i++) {
      const a = Math.min(tops[i], maxScroll), b = Math.min(tops[i + 1], maxScroll);
      if (y >= a) s = i + (b > a ? clamp((y - a) / (b - a), 0, 1) : 1);
    }
    return s;
  }

  let sCur = targetSeason(), lastApplied = -1, lastIdx = -1;
  const blend = { i: 0, t: 0, w: [1, 0, 0, 0] };

  function computeBlend(s) {
    const i = Math.min(2, Math.floor(s));
    // Fasl to‘liq ko‘rinadigan "plato" qoldirib, o‘tishni o‘rtaga jamlaymiz
    const t = smooth(clamp((s - i - .2) / .6, 0, 1));
    blend.i = i; blend.t = t;
    blend.w = [0, 0, 0, 0];
    blend.w[i] = 1 - t;
    blend.w[i + 1] = t;
  }
  const val = (arr) => lerp(arr[blend.i], arr[blend.i + 1], blend.t);

  function applyScene() {
    const { i, t } = blend;
    const style = svg.style;
    for (const k in RGB) {
      const [r, g, b] = mixRgb(RGB[k][i], RGB[k][i + 1], t);
      const c = `rgb(${r},${g},${b})`;
      if (k === 'accent') root.style.setProperty('--accent', c);
      else style.setProperty('--' + k, c);
    }
    for (const k in NUMBERS) style.setProperty('--' + k, val(NUMBERS[k]).toFixed(3));
    sunG.setAttribute('transform', `translate(${val(SUN.x).toFixed(1)} ${val(SUN.y).toFixed(1)})`);
    sunCircle.setAttribute('r', val(SUN.r).toFixed(1));

    const idx = Math.round(sCur);
    if (idx !== lastIdx) {
      lastIdx = idx;
      railLinks.forEach((a, n) => a.classList.toggle('on', n === idx));
      wxName.textContent = SEASONS[idx].name;
      wxDesc.textContent = SEASONS[idx].desc;
      wxIcon.textContent = SEASONS[idx].icon;
      themeMeta.setAttribute('content', COLORS.sky0[idx]);
    }
    const temp = Math.round(val(TEMP));
    wxTemp.textContent = (temp > 0 ? '+' : temp < 0 ? '−' : '') + Math.abs(temp) + '°';
    railFill.style.height = (sCur / 3 * 100).toFixed(2) + '%';
  }

  /* ---------- Sichqoncha parallaksi ---------- */
  let mx = 0, my = 0, pmx = 0, pmy = 0;
  if (!reduceMotion) {
    addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth * 2 - 1;
      my = e.clientY / innerHeight * 2 - 1;
    }, { passive: true });
  }

  /* ---------- Ob-havo zarrachalari ---------- */
  let W = 0, H = 0, dpr = 1, density = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    density = clamp(W / 1400, .45, 1) * (reduceMotion ? .3 : 1);
    measure();
  }

  // max — eng ko‘p soni, w — har bir fasldagi ulushi [bahor, yoz, kuz, qish]
  const TYPES = {
    rain:   { max: 170, w: [1, 0, 0, 0],      rate: 5 },
    petal:  { max: 26,  w: [.9, .1, 0, 0],    rate: 1 },
    pollen: { max: 40,  w: [.15, 1, .15, 0],  rate: 1 },
    bird:   { max: 6,   w: [.6, 1, .3, 0],    rate: .02 },
    leaf:   { max: 55,  w: [0, 0, 1, .05],    rate: 1 },
    snow:   { max: 240, w: [0, 0, .03, 1],    rate: 5 },
  };
  const LEAF_COLORS = ['#e2762b', '#c9542a', '#f2b134', '#a63d1f', '#d9902f'];
  const BURST = ['petal', 'pollen', 'leaf', 'snow'];
  let parts = [];
  let wind = WIND[0];

  function spawn(type, x, y, burst) {
    const p = { type, a: type === 'rain' ? 1 : 0, dying: false, bx: 0, by: 0, ph: Math.random() * 6.28 };
    switch (type) {
      case 'rain':
        p.x = rand(-150, W + 50); p.y = rand(-H * .3, -10);
        p.vy = rand(13, 19); p.len = rand(12, 22);
        break;
      case 'petal':
        p.x = rand(-50, W); p.y = -12;
        p.vx = rand(.2, .8); p.vy = rand(.7, 1.4); p.size = rand(4, 7);
        p.rot = rand(0, 6.28); p.vr = rand(-.04, .04);
        p.color = Math.random() < .7 ? '#f7a8c4' : '#ffe3ec';
        break;
      case 'pollen':
        p.x = rand(0, W); p.y = rand(H * .35, H);
        p.vy = rand(-.5, -.15); p.r = rand(1.2, 2.6);
        p.life = 0; p.maxLife = rand(240, 520);
        break;
      case 'bird': {
        const left = Math.random() < .5;
        p.x = left ? -30 : W + 30; p.y = rand(H * .1, H * .38);
        p.vx = (left ? 1 : -1) * rand(1.1, 2.1); p.size = rand(6, 10);
        break;
      }
      case 'leaf':
        p.x = rand(-W * .4, W); p.y = -20;
        p.vx = rand(.3, 1); p.vy = rand(1, 2.1); p.size = rand(7, 12);
        p.rot = rand(0, 6.28); p.vr = rand(-.06, .06);
        p.color = LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0];
        break;
      case 'snow':
        p.x = rand(-100, W + 100); p.y = rand(-40, -5);
        p.r = rand(1, 3.6); p.vy = .5 + p.r * .35;
        break;
      case 'smoke':
        p.vx = rand(-.1, .2); p.vy = rand(-.7, -.45); p.r = rand(5, 8);
        p.life = 0; p.maxLife = rand(140, 200);
        break;
    }
    if (x !== undefined) { p.x = x; p.y = y; }
    if (burst) {
      const ang = Math.random() * 6.28, sp = rand(2, 6);
      p.bx = Math.cos(ang) * sp; p.by = Math.sin(ang) * sp - 1.5;
      p.a = 1;
      if (type === 'pollen') { p.life = 0; p.maxLife = rand(140, 260); }
    }
    parts.push(p);
  }

  function updateParticles() {
    const counts = {};
    for (const p of parts) if (!p.dying) counts[p.type] = (counts[p.type] || 0) + 1;

    for (const type in TYPES) {
      const T = TYPES[type];
      const weight = T.w.reduce((sum, w, k) => sum + w * blend.w[k], 0);
      const target = Math.round(T.max * weight * density);
      let have = counts[type] || 0;
      if (have < target) {
        if (T.rate < 1) { if (Math.random() < T.rate * weight) spawn(type); }
        else for (let n = 0; n < Math.min(T.rate, target - have); n++) spawn(type);
      } else if (have > target) {
        for (const p of parts) {
          if (have <= target) break;
          if (p.type === type && !p.dying) { p.dying = true; have--; }
        }
      }
    }

    // Uy mo‘risidan tutun (kuz va qishda)
    const smokeW = blend.w[2] * .35 + blend.w[3];
    if (smokeW > .02 && Math.random() < smokeW * .22) {
      const r = chimney.getBoundingClientRect();
      if (r.width) spawn('smoke', r.left + r.width / 2, r.top);
    }

    const next = [];
    for (const p of parts) {
      p.ph += .03;
      p.x += p.bx; p.y += p.by;
      p.bx *= .94; p.by *= .94;
      switch (p.type) {
        case 'rain':
          p.vx = wind * 2.2 + .6;
          p.x += p.vx; p.y += p.vy;
          break;
        case 'petal':
          p.x += p.vx + wind * .9 + Math.sin(p.ph) * .7;
          p.y += p.vy; p.rot += p.vr;
          break;
        case 'pollen':
          p.x += Math.sin(p.ph * .7) * .35 + wind * .25;
          p.y += p.vy; p.life++;
          break;
        case 'bird':
          p.x += p.vx; p.y += Math.sin(p.ph * .5) * .25;
          break;
        case 'leaf':
          p.x += p.vx + wind * 1.3 + Math.sin(p.ph * .8) * 1.4;
          p.y += p.vy + Math.cos(p.ph * 1.6) * .35;
          p.rot += p.vr + Math.sin(p.ph) * .02;
          break;
        case 'snow':
          p.x += Math.sin(p.ph * .5) * .5 + wind * .5 * (p.r / 2.5);
          p.y += p.vy;
          break;
        case 'smoke':
          p.x += p.vx + wind * .35; p.y += p.vy; p.r += .14; p.life++;
          break;
      }

      if (p.dying) p.a -= .03;
      else if (p.a < 1) p.a = Math.min(1, p.a + .05);
      if (p.type === 'pollen' || p.type === 'smoke') {
        const f = Math.sin(Math.PI * clamp(p.life / p.maxLife, 0, 1));
        p.alphaMul = f;
        if (p.life >= p.maxLife) continue;
      }

      const out = p.y > H + 30 || p.y < -H * .5 || p.x < -W * .5 - 60 || p.x > W * 1.5 + 60 ||
        (p.type === 'bird' && (p.x < -60 || p.x > W + 60));
      if (out || p.a <= 0) continue;
      next.push(p);
    }
    parts = next;
  }

  function drawParticles(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const p of parts) {
      const a = p.a * (p.alphaMul ?? 1);
      ctx.globalAlpha = a;
      switch (p.type) {
        case 'rain':
          ctx.strokeStyle = 'rgba(225,238,250,.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * p.len / p.vy, p.y - p.len);
          ctx.stroke();
          break;
        case 'petal':
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, .55 + Math.sin(p.ph * 2) * .35);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .6, 0, 0, 6.283); ctx.fill();
          ctx.restore();
          break;
        case 'pollen':
          ctx.fillStyle = 'rgba(255,244,180,.25)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#fff7c9';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
        case 'bird': {
          const s = p.size, f = Math.sin(time * .012 + p.ph * 10) * s * .55;
          const dir = Math.sign(p.vx);
          ctx.strokeStyle = '#25313d'; ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y - f);
          ctx.quadraticCurveTo(p.x - s * .4, p.y - s * .35, p.x + dir * 1.5, p.y);
          ctx.quadraticCurveTo(p.x + s * .4, p.y - s * .35, p.x + s, p.y - f);
          ctx.stroke();
          break;
        }
        case 'leaf': {
          const s = p.size;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, .6 + Math.sin(p.ph * 1.3) * .4);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.quadraticCurveTo(0, -s * .75, s, 0);
          ctx.quadraticCurveTo(0, s * .75, -s, 0);
          ctx.fill();
          ctx.strokeStyle = 'rgba(80,30,10,.45)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-s * 1.2, 0); ctx.lineTo(s * .9, 0); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'snow':
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = a * .45;
          ctx.fillStyle = '#e9edf1';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // Bosganda joriy faslga mos "portlash" (gulbarg, nur, barg yoki qor)
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, label, .panel, .topbar, .rail, .wx')) return;
    const type = BURST[Math.round(sCur)];
    for (let n = 0; n < 16; n++) spawn(type, e.clientX, e.clientY, true);
  });

  /* ---------- Asosiy sikl ---------- */
  let cloudOffset = 0;
  function frame(time) {
    const target = targetSeason();
    sCur += (target - sCur) * (reduceMotion ? .3 : .08);
    if (Math.abs(target - sCur) < .0005) sCur = target;
    computeBlend(sCur);
    if (Math.abs(sCur - lastApplied) > .0003) { applyScene(); lastApplied = sCur; }

    wind = val(WIND) + Math.sin(time * .0004) * .25 * val(WIND);

    cloudOffset += reduceMotion ? 0 : .12 + wind * .35;
    for (const c of clouds) {
      const x = ((c.x + cloudOffset * c.s) % 2100 + 2100) % 2100 - 250;
      c.n.setAttribute('transform', `translate(${x.toFixed(1)} ${c.y}) scale(${c.k})`);
    }

    pmx += (mx - pmx) * .05; pmy += (my - pmy) * .05;
    for (const L of layers) L.n.setAttribute('transform', `translate(${(-pmx * L.k).toFixed(2)} ${(-pmy * L.k * .3).toFixed(2)})`);

    updateParticles();
    drawParticles(time);
    requestAnimationFrame(frame);
  }

  /* ---------- Paydo bo‘lish va forma ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: .15 });
  document.querySelectorAll('.reveal').forEach((n) => io.observe(n));

  const form = document.getElementById('contactForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const body = `Ism: ${d.get('name')}\nAloqa: ${d.get('contact')}\n\n${d.get('message') || ''}`;
    location.href = `mailto:hello@yuksalish.dev?subject=${encodeURIComponent('Yangi loyiha — Yuksalish.dev')}&body=${encodeURIComponent(body)}`;
  });

  addEventListener('resize', resize);
  addEventListener('load', measure);
  resize();
  computeBlend(sCur);
  applyScene();
  lastApplied = sCur;
  requestAnimationFrame(frame);
})();
