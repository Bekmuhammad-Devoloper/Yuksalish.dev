/* Yuksalish.dev — Chimyon tog‘lariga to‘rt fasl davomida ko‘tarilish.
 *
 * Canvas’da qatlamli tog‘ tizmalari, daraxtlar, uy, osmon va ob-havo chiziladi.
 * Skroll ikki qiymat beradi:
 *   sRaw  — 0..3 chiziqli (balandlik va kamera ko‘tarilishi uchun)
 *   blend — fasllar orasidagi silliq o‘tish (ranglar va ob-havo uchun)            */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  /* ================= Fasllar ================= */
  const SEASONS = [
    { key: 'Navro‘z', desc: 'Bahor · yengil yomg‘ir' },
    { key: 'Saraton', desc: 'Yoz · ochiq osmon' },
    { key: 'Mezon',   desc: 'Kuz · xazonrezgi' },
    { key: 'Chilla',  desc: 'Qish · qor' },
  ];

  // [Navro‘z, Saraton, Mezon, Chilla]
  const PAL = {
    skyTop:   ['#9cc6e4', '#3f8fd8', '#d99a76', '#161d3a'],
    skyMid:   ['#d5e7ee', '#8cc8ee', '#efc296', '#3f3a68'],
    skyLow:   ['#f6e1cf', '#e2f2f8', '#f8dfb0', '#b9819a'],
    haze:     ['#e6e2dc', '#cfe5ef', '#efd3a8', '#6f6690'],
    landFar:  ['#7fa595', '#6f9d8c', '#b48868', '#5d5b86'],
    landNear: ['#3f7a45', '#2f6e35', '#7a3f1e', '#aeb6d6'],
    snow:     ['#f6f7fa', '#ffffff', '#fff3e6', '#dfe3f6'],
    pine:     ['#2c5a3a', '#21502e', '#34482a', '#2a3552'],
    trunk:    ['#4a3426', '#4a3426', '#3e2a1c', '#2c2a40'],
    wall:     ['#e4d3bb', '#eadbc4', '#d9b98f', '#3a3658'],
    roof:     ['#8e3b2a', '#93402c', '#6e2c1c', '#e6e9f7'],
    sun:      ['#fff3d6', '#fffbe9', '#ffd08a', '#f2f0ff'],
    glow:     ['#ffe9c7', '#fff6cf', '#ffb767', '#c9c4ff'],
    cloud:    ['#f3efea', '#ffffff', '#f7d8b6', '#8a7fae'],
    ink:      ['#15211b', '#0f1c2b', '#2b170b', '#f2f0ff'],
    halo:     ['#fff8ee', '#eaf6ff', '#fff0d6', '#161d3a'],
    accent:   ['#c2456e', '#d9480f', '#b03a10', '#7f9cff'],
    paper:    ['#f7f4ee', '#f3f7f7', '#fbf0e1', '#1b2045'],
    paperInk: ['#18211c', '#101c27', '#2a1a0f', '#eceeff'],
  };
  // Daraxt tojlari: har faslda 4 xil tus (o‘rik gullari → yashil → chinor oltini)
  const CROWN = [
    ['#f6d3dc', '#fbeef1', '#a9cf7c', '#8fc06a'],
    ['#3d8a3b', '#4c9a42', '#2f7633', '#5aa247'],
    ['#e18a2a', '#c8551e', '#e9b23c', '#b8431b'],
    ['#b8431b', '#c8551e', '#e9b23c', '#e18a2a'],
  ];
  const NUM = {
    sunA:    [1, 1, 1, 0],
    moonA:   [0, 0, 0, 1],
    starA:   [0, 0, 0, 1],
    sunX:    [.18, .64, .82, .74],
    sunY:    [.3, .13, .42, .17],
    sunR:    [.03, .034, .046, .026],
    cloudA:  [.9, .55, .7, .5],
    mist:    [.4, .2, .36, .35],
    snowLine:[.38, .08, .26, 1.05],
    crownA:  [1, 1, .97, 0],
    windowA: [.08, 0, .5, 1],
    wind:    [.5, .15, 2.3, .8],
    paperA:  [.86, .86, .88, .8],
    haloA:   [.55, .5, .5, .55],
    temp:    [14, 31, 11, -9],
  };
  const ALT = [1600, 2100, 2700, 3309];
  const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, v.map(hex)]));
  const CROWN_RGB = CROWN.map((row) => row.map(hex));

  /* ================= Shovqin (tog‘ shakli uchun) ================= */
  const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (() => { const r = seeded(20260321); return Float32Array.from({ length: 4096 }, r); })();
  const vnoise = (x) => {
    const i = Math.floor(x), f = x - i;
    const a = R[i & 4095], b = R[(i + 1) & 4095];
    return a + (b - a) * f * f * (3 - 2 * f);
  };
  const fbm = (x, oct, ridged) => {
    let s = 0, amp = .5, fr = 1, n = 0;
    for (let o = 0; o < oct; o++) {
      let v = vnoise(x * fr + o * 31.7);
      if (ridged) v = 1 - Math.abs(v * 2 - 1);
      s += v * amp; n += amp; amp *= .5; fr *= 2.07;
    }
    return s / n;
  };

  /* ================= Manzara geometriyasi ================= */
  const LAYERS = [
    { base: .53, amp: .27, f: 1 / 230, oct: 5, ridged: 1, k: .01, peak: true },
    { base: .59, amp: .17, f: 1 / 190, oct: 5, ridged: 1, k: .03 },
    { base: .67, amp: .10, f: 1 / 280, oct: 4, k: .05, trees: { per: 16, h: [7, 12], pine: .8 } },
    { base: .75, amp: .07, f: 1 / 340, oct: 3, k: .08, jit: 1.2, trees: { per: 30, h: [14, 24], pine: .6 } },
    { base: .83, amp: .06, f: 1 / 420, oct: 3, k: .11, jit: 1.8, trees: { per: 60, h: [26, 46], pine: .45 }, house: true },
    { base: .94, amp: .05, f: 1 / 520, oct: 2, k: .16, jit: 2.6, trees: { per: 150, h: [60, 115], pine: .35 } },
  ];
  const STEP = 6, MARGIN = 90;

  const canvas = $('#world');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, scale = 1, density = 1;
  let stars = [], clouds = [], house = null;

  function build() {
    scale = clamp(H / 900, .7, 1.4);
    LAYERS.forEach((L, i) => {
      L.d = i / (LAYERS.length - 1);
      const n = Math.ceil((W + MARGIN * 2) / STEP) + 1;
      L.ys = new Float32Array(n);
      let min = Infinity;
      for (let j = 0; j < n; j++) {
        const x = -MARGIN + j * STEP;
        let h = fbm(x * L.f + i * 97.3, L.oct, L.ridged) * .9;
        if (L.peak) h += .85 * Math.exp(-((((x / W) - .6) / .12) ** 2)); // Katta Chimyon
        let y = H * (L.base - L.amp * h);
        if (L.jit) y += (vnoise(x * .35 + i * 50) - .5) * L.jit * 2 * scale; // o‘t-o‘lan qirrasi
        L.ys[j] = y;
        if (y < min) min = y;
      }
      L.top = min;

      L.items = [];
      if (L.trees) {
        const r = seeded(1000 + i * 77);
        const count = Math.round(W / L.trees.per);
        for (let t = 0; t < count; t++) {
          const x = r() * W;
          if (fbm(x * .004 + i * 13, 2) < .42) continue;          // daraxtlar to‘da-to‘da bo‘lsin
          if (L.house && Math.abs(x - W * .76) < 60 * scale) continue;
          const h = lerp(L.trees.h[0], L.trees.h[1], r()) * scale;
          const blobs = Array.from({ length: 6 + ((r() * 4) | 0) }, () => {
            const a = r() * 6.283, d = Math.sqrt(r()) * .24;
            return [Math.cos(a) * d * 1.1, -.66 + Math.sin(a) * d * .8, .12 + r() * .1];
          });
          L.items.push({ x, h, pine: r() < L.trees.pine, v: (r() * 4) | 0, lean: (r() - .5) * .1, blobs });
        }
        L.items.sort((a, b) => a.h - b.h);
      }
    });
    house = { x: W * .76, s: 30 * scale };

    const r = seeded(7);
    stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({
      x: r() * W, y: r() * H * .6, a: .3 + r() * .7, s: r() < .1 ? 1.6 : .9, tw: .5 + r() * 2, ph: r() * 6.28,
    }));
    clouds = Array.from({ length: 7 }, (_, i) => {
      const s = (.7 + r() * .8) * scale;
      return {
        x: r() * (W + 600), y: H * (.07 + r() * .26), sp: .4 + r() * .9,
        puffs: Array.from({ length: 6 }, () => ({ dx: (r() - .5) * 220 * s, dy: (r() - .5) * 30 * s, r: (50 + r() * 70) * s })),
        a: .5 + r() * .5, depth: i / 7,
      };
    });
  }

  const ridgeY = (L, x) => {
    const fx = (x + MARGIN) / STEP;
    const j = clamp(Math.floor(fx), 0, L.ys.length - 2);
    return lerp(L.ys[j], L.ys[j + 1], fx - j);
  };

  /* ================= Skroll → fasl ================= */
  const anchors = $$('[data-s]');
  let anchorY = [], maxScroll = 1;
  function measure() {
    maxScroll = Math.max(1, root.scrollHeight - innerHeight);
    anchorY = anchors.map((el) => Math.min(el.getBoundingClientRect().top + scrollY, maxScroll));
  }
  function readScroll() {
    const y = scrollY;
    let sRaw = 0, sBlend = 0;
    for (let i = 0; i < anchorY.length - 1; i++) {
      const a = anchorY[i], b = anchorY[i + 1];
      if (y < a) break;
      sRaw = i + (b > a ? clamp((y - a) / (b - a), 0, 1) : 1);
      // Rang almashuvi keyingi bo‘lim ekranga kirib kelayotganda bo‘ladi
      const start = Math.max(a, b - innerHeight * 1.3), end = b - innerHeight * .15;
      sBlend = i + smooth(clamp((y - start) / Math.max(1, end - start), 0, 1));
    }
    return { sRaw, sBlend };
  }

  const st = { raw: 0, blend: 0 };
  const B = { i: 0, t: 0, w: [1, 0, 0, 0] };
  const C = {}, N = {};
  function computeColors() {
    const i = Math.min(2, Math.floor(st.blend)), t = st.blend - i;
    B.i = i; B.t = t; B.w = [0, 0, 0, 0]; B.w[i] = 1 - t; B.w[i + 1] += t;
    for (const k in RGB) C[k] = mix(RGB[k][i], RGB[k][i + 1], t);
    for (const k in NUM) N[k] = lerp(NUM[k][i], NUM[k][i + 1], t);
    C.crown = CROWN_RGB[i].map((c, v) => mix(c, CROWN_RGB[i + 1][v], t));
  }

  /* ================= Chizish ================= */
  let pmx = 0, pmy = 0, mx = 0, my = 0, cloudOff = 0, wind = .5, ascent = 0;
  const chimneyTop = { x: 0, y: 0 };

  function drawSky(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H * .8);
    g.addColorStop(0, rgba(C.skyTop));
    g.addColorStop(.5, rgba(C.skyMid));
    g.addColorStop(1, rgba(C.skyLow));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (N.starA > .01) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = N.starA * s.a * (.55 + .45 * Math.sin(time * .001 * s.tw + s.ph));
        ctx.fillRect(s.x - pmx * 2, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    const sx = N.sunX * W - pmx * 6, sy = N.sunY * H + ascent * H * .04;
    const sr = N.sunR * Math.max(W, H);
    const bodyA = Math.max(N.sunA, N.moonA);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 10);
    glow.addColorStop(0, rgba(C.glow, .55 * bodyA));
    glow.addColorStop(.25, rgba(C.glow, .18 * bodyA));
    glow.addColorStop(1, rgba(C.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba(C.sun, bodyA);
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
    if (N.moonA > .01) {
      ctx.fillStyle = rgba([120, 120, 170], .18 * N.moonA);
      [[-.3, -.2, .22], [.25, .1, .16], [-.05, .35, .12]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(sx + dx * sr, sy + dy * sr, r * sr, 0, 6.283); ctx.fill();
      });
    }
  }

  function drawClouds() {
    const A = N.cloudA;
    if (A < .01) return;
    const span = W + 700;
    for (const c of clouds) {
      const cx = ((c.x + cloudOff * c.sp) % span + span) % span - 350 - pmx * (4 + c.depth * 6);
      const cy = c.y + ascent * H * .03;
      for (const p of c.puffs) {
        const x = cx + p.dx, y = cy + p.dy;
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
        g.addColorStop(0, rgba(C.cloud, .55 * A * c.a));
        g.addColorStop(.55, rgba(C.cloud, .3 * A * c.a));
        g.addColorStop(1, rgba(C.cloud, 0));
        ctx.fillStyle = g;
        ctx.save(); ctx.translate(x, y); ctx.scale(1, .42); ctx.translate(-x, -y);
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawPine(x, y, h, col, snowCol, snowA) {
    ctx.fillStyle = col;
    ctx.fillRect(x - h * .025, y - h * .1, h * .05, h * .12);
    const tiers = [[1, .42, .17], [.74, .24, .24], [.48, .06, .31]];
    ctx.beginPath();
    for (const [t, b, w] of tiers) {
      ctx.moveTo(x, y - h * t);
      ctx.lineTo(x - h * w, y - h * b);
      ctx.lineTo(x + h * w, y - h * b);
      ctx.closePath();
    }
    ctx.fill();
    if (snowA > .02) {
      ctx.fillStyle = rgba(snowCol, snowA);
      ctx.beginPath();
      for (const [t, b, w] of tiers) {
        const k = .38;
        ctx.moveTo(x, y - h * t);
        ctx.lineTo(x - h * w * k, y - h * lerp(t, b, k));
        ctx.lineTo(x + h * w * k, y - h * lerp(t, b, k));
        ctx.closePath();
      }
      ctx.fill();
    }
  }

  function drawLeafTree(x, y, h, trunkCol, crownCol, crownA, lean, blobs) {
    ctx.strokeStyle = trunkCol;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, h * .055);
    const tx = x + lean * h;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(tx, y - h * .5);
    ctx.stroke();
    ctx.lineWidth = Math.max(.8, h * .028);
    ctx.beginPath();
    ctx.moveTo(tx, y - h * .42); ctx.lineTo(tx - h * .22, y - h * .78);
    ctx.moveTo(tx, y - h * .45); ctx.lineTo(tx + h * .24, y - h * .74);
    ctx.moveTo(tx, y - h * .5);  ctx.lineTo(tx + h * .02, y - h * .95);
    ctx.moveTo(tx - h * .12, y - h * .62); ctx.lineTo(tx - h * .3, y - h * .66);
    ctx.stroke();
    if (crownA > .02) {
      // soya tomoni, keyin yorug‘ qatlam — toj hajmli ko‘rinsin
      ctx.fillStyle = rgba(mix(crownCol, [20, 25, 20], .22), crownA);
      ctx.beginPath();
      for (const [bx, by, br] of blobs) { ctx.moveTo(tx + bx * h + br * h, y + by * h + h * .03); ctx.arc(tx + bx * h, y + by * h + h * .03, br * h, 0, 6.283); }
      ctx.fill();
      ctx.fillStyle = rgba(crownCol, crownA);
      ctx.beginPath();
      for (const [bx, by, br] of blobs) { const cx = tx + bx * h - h * .02, cy = y + by * h - h * .02, rr = br * h * .86; ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, 6.283); }
      ctx.fill();
    }
  }

  function drawHouse(x, y, s, d) {
    const wall = mix(C.wall, C.haze, (1 - d) * .3), roof = mix(C.roof, C.haze, (1 - d) * .3);
    const winA = N.windowA;
    if (winA > .02) {
      const g = ctx.createRadialGradient(x + s * .25, y - s * .4, 0, x + s * .25, y - s * .4, s * 2.2);
      g.addColorStop(0, `rgba(255,200,110,${.35 * winA})`);
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - s * 2.5, y - s * 2.8, s * 5, s * 5);
    }
    ctx.fillStyle = rgba(mix(roof, [40, 30, 30], .3));
    ctx.fillRect(x + s * .32, y - s * 1.25, s * .16, s * .5);
    chimneyTop.x = x + s * .4; chimneyTop.y = y - s * 1.25;
    ctx.fillStyle = rgba(wall);
    ctx.fillRect(x - s * .6, y - s * .72, s * 1.2, s * .74);
    ctx.fillStyle = rgba(roof);
    ctx.beginPath();
    ctx.moveTo(x - s * .78, y - s * .68); ctx.lineTo(x, y - s * 1.28); ctx.lineTo(x + s * .78, y - s * .68);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(30,25,35,.75)';
    ctx.fillRect(x - s * .38, y - s * .42, s * .2, s * .42);
    ctx.fillRect(x + s * .1, y - s * .5, s * .3, s * .24);
    ctx.fillStyle = `rgba(255,206,120,${.15 + .85 * winA})`;
    ctx.fillRect(x + s * .1, y - s * .5, s * .3, s * .24);
  }

  function drawLand() {
    const snowLine = N.snowLine;
    LAYERS.forEach((L, i) => {
      const d = L.d;
      const oy = ascent * H * L.k;
      const ox = -pmx * (3 + d * 16);
      const col = mix(mix(C.landFar, C.landNear, Math.pow(d, 1.1)), C.haze, Math.pow(1 - d, 2) * .55);
      const snowCol = mix(C.snow, C.haze, (1 - d) * .3);
      const top = L.top + oy, base = L.base * H + oy;
      const cap = clamp(snowLine * 1.5 - d * 1.1, 0, 1);

      if (top > H) return;
      let fill;
      if (cap > .01) {
        fill = ctx.createLinearGradient(0, top, 0, base);
        fill.addColorStop(0, rgba(snowCol));
        fill.addColorStop(Math.max(0, cap * .82), rgba(snowCol));
        fill.addColorStop(Math.min(1, cap + .04), rgba(col));
        fill.addColorStop(1, rgba(mix(col, [0, 0, 0], .12)));
      } else {
        fill = ctx.createLinearGradient(0, top, 0, H);
        fill.addColorStop(0, rgba(col));
        fill.addColorStop(1, rgba(mix(col, [0, 0, 0], .18)));
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(-MARGIN + ox, H + 2);
      for (let j = 0; j < L.ys.length; j++) ctx.lineTo(-MARGIN + j * STEP + ox, L.ys[j] + oy);
      ctx.lineTo(W + MARGIN + ox, H + 2);
      ctx.closePath();
      ctx.fill();

      // daraxtlar
      if (L.items.length) {
        const pineCol = rgba(mix(C.pine, C.haze, (1 - d) * .55));
        const trunkCol = rgba(mix(C.trunk, C.haze, (1 - d) * .5));
        const treeSnow = clamp(snowLine * 1.4 - .5, 0, 1);
        for (const t of L.items) {
          const tx = t.x + ox;
          if (tx < -t.h || tx > W + t.h) continue;
          const ty = ridgeY(L, t.x) + oy + t.h * .06;
          if (ty - t.h > H) continue;
          if (t.pine) drawPine(tx, ty, t.h, pineCol, snowCol, treeSnow);
          else drawLeafTree(tx, ty, t.h, trunkCol, mix(C.crown[t.v], C.haze, (1 - d) * .45), N.crownA, t.lean, t.blobs);
        }
      }
      if (L.house) drawHouse(house.x + ox, ridgeY(L, house.x) + oy + 2, house.s, d);

      // vodiy tumani
      if (i < LAYERS.length - 1 && N.mist > .01) {
        const my0 = base - H * .05, h = H * .09;
        const g = ctx.createLinearGradient(0, my0 - h, 0, my0 + h);
        g.addColorStop(0, rgba(C.haze, 0));
        g.addColorStop(.6, rgba(C.haze, N.mist * (.9 - d * .5)));
        g.addColorStop(1, rgba(C.haze, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, my0 - h, W, h * 2);
      }
    });
  }

  /* ================= Ob-havo zarrachalari ================= */
  // w — ulush: [Navro‘z, Saraton, Mezon, Chilla]
  const TYPES = {
    rain:   { max: 150, w: [1, 0, 0, 0],     rate: 5 },
    petal:  { max: 30,  w: [1, .08, 0, 0],   rate: 1 },
    bird:   { max: 7,   w: [.4, 1, .25, 0],  rate: .025 },
    mote:   { max: 45,  w: [.1, 1, .3, 0],   rate: 1 },
    leaf:   { max: 60,  w: [0, 0, 1, 0],     rate: 1 },
    snow:   { max: 260, w: [0, 0, .04, 1],   rate: 6 },
  };
  const LEAF = ['#e18a2a', '#c8551e', '#e9b23c', '#b8431b', '#d9902f'].map(hex);
  const BURST = ['petal', 'mote', 'leaf', 'snow'];
  let parts = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function spawn(type, x, y, burst) {
    const p = { type, a: type === 'rain' ? 1 : 0, dying: false, bx: 0, by: 0, ph: Math.random() * 6.28, z: Math.random() };
    switch (type) {
      case 'rain':  p.x = rand(-200, W + 50); p.y = rand(-H * .3, -10); p.vy = 12 + p.z * 9; p.len = 10 + p.z * 16; break;
      case 'petal': p.x = rand(-80, W); p.y = -12; p.vx = rand(.2, .8); p.vy = rand(.6, 1.3); p.size = 3 + p.z * 4; p.rot = rand(0, 6.28); p.vr = rand(-.05, .05); p.col = Math.random() < .65 ? [248, 214, 224] : [255, 244, 247]; break;
      case 'mote':  p.x = rand(0, W); p.y = rand(H * .2, H * .9); p.vy = rand(-.35, -.08); p.r = .8 + p.z * 1.8; p.life = 0; p.max = rand(260, 540); break;
      case 'bird': {
        const left = Math.random() < .5;
        p.x = left ? -30 : W + 30; p.y = rand(H * .12, H * .36);
        p.vx = (left ? 1 : -1) * rand(1.2, 2.2); p.size = (5 + p.z * 5) * scale;
        p.flock = 1 + ((Math.random() * 3) | 0);
        break;
      }
      case 'leaf':  p.x = rand(-W * .5, W); p.y = -20; p.vx = rand(.3, 1); p.vy = rand(.9, 2); p.size = 6 + p.z * 7; p.rot = rand(0, 6.28); p.vr = rand(-.07, .07); p.col = LEAF[(Math.random() * LEAF.length) | 0]; break;
      case 'snow':  p.x = rand(-150, W + 150); p.y = rand(-40, -5); p.r = .8 + p.z * p.z * 4.2; p.vy = .45 + p.z * 1.5; break;
      case 'smoke': p.vx = rand(-.05, .15); p.vy = rand(-.6, -.4); p.r = rand(3, 5) * scale; p.life = 0; p.max = rand(160, 230); break;
    }
    if (x !== undefined) { p.x = x; p.y = y; }
    if (burst) {
      const ang = Math.random() * 6.28, sp = rand(2, 7);
      p.bx = Math.cos(ang) * sp; p.by = Math.sin(ang) * sp - 2;
      p.a = 1;
      if (type === 'mote') { p.life = 0; p.max = rand(120, 220); }
    }
    parts.push(p);
  }

  function updateParticles() {
    const counts = {};
    for (const p of parts) if (!p.dying) counts[p.type] = (counts[p.type] || 0) + 1;
    for (const type in TYPES) {
      const T = TYPES[type];
      const weight = T.w.reduce((s, w, k) => s + w * B.w[k], 0);
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
    const smokeW = B.w[2] * .45 + B.w[3];
    if (smokeW > .02 && Math.random() < smokeW * .2 && chimneyTop.y < H) spawn('smoke', chimneyTop.x, chimneyTop.y);

    const next = [];
    for (const p of parts) {
      p.ph += .03;
      p.x += p.bx; p.y += p.by; p.bx *= .93; p.by *= .93;
      switch (p.type) {
        case 'rain':  p.vx = wind * 2.2 + .8; p.x += p.vx; p.y += p.vy; break;
        case 'petal': p.x += p.vx + wind * .9 + Math.sin(p.ph) * .8; p.y += p.vy; p.rot += p.vr; break;
        case 'mote':  p.x += Math.sin(p.ph * .6) * .3 + wind * .2; p.y += p.vy; p.life++; break;
        case 'bird':  p.x += p.vx; p.y += Math.sin(p.ph * .4) * .25; break;
        case 'leaf':  p.x += p.vx + wind * 1.3 + Math.sin(p.ph * .8) * 1.4; p.y += p.vy + Math.cos(p.ph * 1.6) * .4; p.rot += p.vr + Math.sin(p.ph) * .02; break;
        case 'snow':  p.x += Math.sin(p.ph * .5 + p.z * 3) * .45 + wind * .5 * (.4 + p.z); p.y += p.vy; break;
        case 'smoke': p.x += p.vx + wind * .3 + p.life * .002 * wind; p.y += p.vy; p.r += .09 * scale; p.life++; break;
      }
      if (p.dying) p.a -= .025;
      else if (p.a < 1) p.a = Math.min(1, p.a + .04);
      if (p.max) { p.fade = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1)); if (p.life >= p.max) continue; }
      const out = p.y > H + 40 || p.y < -H * .6 || p.x < -W * .6 - 80 || p.x > W * 1.6 + 80 ||
        (p.type === 'bird' && (p.x < -80 || p.x > W + 80));
      if (out || p.a <= 0) continue;
      next.push(p);
    }
    parts = next;
  }

  function drawParticles(time) {
    ctx.lineCap = 'round';
    for (const p of parts) {
      const a = p.a * (p.fade ?? 1);
      ctx.globalAlpha = a;
      switch (p.type) {
        case 'rain':
          ctx.strokeStyle = `rgba(235,242,250,${.18 + p.z * .35})`;
          ctx.lineWidth = .8 + p.z * .7;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * p.len / p.vy, p.y - p.len); ctx.stroke();
          break;
        case 'petal':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .5 + Math.sin(p.ph * 2) * .4);
          ctx.fillStyle = rgba(p.col);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .65, 0, 0, 6.283); ctx.fill();
          ctx.restore();
          break;
        case 'mote':
          ctx.fillStyle = 'rgba(255,248,210,.22)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgba(255,252,235,.95)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .8, 0, 6.283); ctx.fill();
          break;
        case 'bird':
          for (let k = 0; k < p.flock; k++) {
            const s = p.size * (1 - k * .12), bx = p.x - Math.sign(p.vx) * k * 22, by = p.y + (k % 2 ? 10 : -6) * k;
            const f = Math.sin(time * .013 + p.ph * 10 + k) * s * .6;
            ctx.strokeStyle = rgba(mix(C.ink, C.skyMid, .35));
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(bx - s, by - f);
            ctx.quadraticCurveTo(bx - s * .4, by - s * .3, bx, by);
            ctx.quadraticCurveTo(bx + s * .4, by - s * .3, bx + s, by - f);
            ctx.stroke();
          }
          break;
        case 'leaf': {
          const s = p.size;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .55 + Math.sin(p.ph * 1.3) * .45);
          ctx.fillStyle = rgba(p.col);
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.quadraticCurveTo(-s * .2, -s * .9, s, 0);
          ctx.quadraticCurveTo(-s * .2, s * .9, -s, 0);
          ctx.fill();
          ctx.strokeStyle = 'rgba(70,25,8,.4)'; ctx.lineWidth = .9;
          ctx.beginPath(); ctx.moveTo(-s * 1.3, 0); ctx.lineTo(s * .85, 0); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'snow':
          if (p.r > 3.4) {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
          } else ctx.fillStyle = `rgba(255,255,255,${.55 + p.z * .45})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = a * .32;
          ctx.fillStyle = rgba(mix(C.snow, C.haze, .4));
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ================= Interfeys ================= */
  const hudKey = $('#hudKey'), hudDesc = $('#hudDesc'), hudTemp = $('#hudTemp');
  const altValue = $('#altValue'), altMarker = $('#altMarker'), altScale = $('#altScale');
  const nav = $('#nav');
  const themeMeta = $('meta[name="theme-color"]');
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Altimetr shkalasi
  const ALT_MIN = 1500, ALT_MAX = 3400;
  const altPos = (a) => (1 - (a - ALT_MIN) / (ALT_MAX - ALT_MIN)) * 100;
  for (let a = ALT_MIN; a <= ALT_MAX; a += 100) {
    const i = document.createElement('i');
    i.style.top = altPos(a) + '%';
    if (a % 500 === 0) {
      i.className = 'major';
      const em = document.createElement('em');
      em.style.top = altPos(a) + '%';
      em.textContent = fmt(a);
      altScale.appendChild(em);
    }
    altScale.appendChild(i);
  }

  // So‘zma-so‘z ochiladigan manifest
  const manifest = $('#manifest'), manifestText = $('#manifestText');
  manifestText.innerHTML = manifestText.textContent.trim().split(/\s+/).map((w) => `<span>${w}</span>`).join(' ');
  const words = [...manifestText.children];
  let lastWords = -1;

  // Bosh harflarni ajratish (ko‘tarilish animatsiyasi)
  const wm = $('#wordmark');
  wm.innerHTML = [...wm.textContent].map((ch, i) => `<i style="--i:${i}">${ch}</i>`).join('');

  // Gorizontal galereya
  const works = $('#ishlar'), track = $('#worksTrack'), worksBar = $('#worksBar');
  const wide = matchMedia('(min-width: 861px)');
  function sizeWorks() {
    if (!wide.matches) { works.style.height = ''; return; }
    const dist = Math.max(0, track.scrollWidth - innerWidth);
    works.style.height = (innerHeight + dist) + 'px';
  }

  let lastIdx = -1;
  function updateUI() {
    for (const k of ['ink', 'accent', 'paperInk']) root.style.setProperty('--' + (k === 'paperInk' ? 'paper-ink' : k), rgba(C[k]));
    root.style.setProperty('--paper', rgba(C.paper, N.paperA));
    root.style.setProperty('--paper-solid', rgba(C.paper));
    root.style.setProperty('--paper-line', rgba(C.paperInk, .14));
    root.style.setProperty('--halo', rgba(C.halo, N.haloA));
    document.body.style.background = rgba(C.skyTop);

    const idx = Math.round(st.blend);
    if (idx !== lastIdx) {
      lastIdx = idx;
      hudKey.textContent = SEASONS[idx].key;
      hudDesc.textContent = SEASONS[idx].desc;
      themeMeta && themeMeta.setAttribute('content', PAL.skyTop[idx]);
    }
    const temp = Math.round(N.temp);
    hudTemp.textContent = (temp > 0 ? '+' : temp < 0 ? '−' : '') + Math.abs(temp) + '°';

    const i = Math.min(2, Math.floor(st.raw));
    const alt = lerp(ALT[i], ALT[i + 1], st.raw - i);
    altValue.textContent = fmt(alt);
    altMarker.style.top = altPos(alt) + '%';
  }

  function updateScrollUI() {
    nav.classList.toggle('scrolled', scrollY > innerHeight * .7);

    const mr = manifest.getBoundingClientRect();
    const mp = clamp(-mr.top / Math.max(1, mr.height - innerHeight), 0, 1);
    const lit = Math.round(mp * words.length * 1.15);
    if (lit !== lastWords) {
      lastWords = lit;
      words.forEach((w, k) => { w.style.opacity = k < lit ? 1 : .2; });
    }

    if (wide.matches) {
      const wr = works.getBoundingClientRect();
      const wp = clamp(-wr.top / Math.max(1, wr.height - innerHeight), 0, 1);
      const dist = Math.max(0, track.scrollWidth - innerWidth);
      track.style.transform = `translate3d(${(-wp * dist).toFixed(1)}px,0,0)`;
      worksBar.style.width = (wp * 100).toFixed(2) + '%';
    }
  }

  /* ================= Hodisalar ================= */
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    density = clamp(W / 1400, .45, 1) * (reduceMotion ? .3 : 1);
    build();
    sizeWorks();
    measure();
  }

  if (!reduceMotion) {
    addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth * 2 - 1;
      my = e.clientY / innerHeight * 2 - 1;
    }, { passive: true });
  }

  addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, label, .sheet, .work, .nav, .hud')) return;
    const type = BURST[Math.round(st.blend)];
    for (let n = 0; n < 18; n++) spawn(type, e.clientX, e.clientY, true);
  });

  // Email nusxasi
  const copyBtn = $('#copyEmail');
  copyBtn.addEventListener('click', () => {
    const text = $('#emailLink').textContent;
    const done = () => { copyBtn.textContent = 'Nusxalandi'; setTimeout(() => (copyBtn.textContent = 'Nusxa olish'), 1800); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($('#emailLink'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copyBtn.textContent = 'Belgilandi';
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch { fallback(); }
  });

  // Forma
  const form = $('#contactForm'), note = $('#formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    for (const id of ['f-name', 'f-contact']) {
      const inp = document.getElementById(id);
      const bad = !inp.value.trim();
      inp.closest('.field').classList.toggle('invalid', bad);
      if (bad) ok = false;
    }
    if (!ok) { note.textContent = 'Ism va aloqa uchun telefon yoki Telegram kiriting.'; return; }
    const d = new FormData(form);
    const body = `Ism: ${d.get('name')}\nAloqa: ${d.get('contact')}\nKerak: ${d.getAll('type').join(', ') || '—'}\n\n${d.get('message') || ''}`;
    sendForm(body);
  });
  function sendForm(body) {
    note.textContent = 'Pochta dasturingiz ochilmoqda…';
    location.href = `mailto:hello@yuksalish.dev?subject=${encodeURIComponent('Yangi loyiha — Yuksalish.dev')}&body=${encodeURIComponent(body)}`;
  }

  $('#year').textContent = new Date().getFullYear();

  /* ================= Asosiy sikl ================= */
  function frame(time) {
    const s = readScroll();
    const k = reduceMotion ? 1 : .09;
    st.raw += (s.sRaw - st.raw) * k;
    st.blend += (s.sBlend - st.blend) * k;
    if (Math.abs(s.sBlend - st.blend) < .0004) st.blend = s.sBlend;
    computeColors();
    ascent = st.raw / 3;

    wind = N.wind * (1 + Math.sin(time * .0004) * .3);
    cloudOff += reduceMotion ? 0 : .1 + wind * .3;
    pmx += (mx - pmx) * .04; pmy += (my - pmy) * .04;

    drawSky(time);
    drawClouds();
    drawLand();
    updateParticles();
    drawParticles(time);

    updateUI();
    updateScrollUI();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('load', () => { sizeWorks(); measure(); });
  if (document.fonts) document.fonts.ready.then(() => { sizeWorks(); measure(); });
  resize();
  const s0 = readScroll();
  st.raw = s0.sRaw; st.blend = s0.sBlend;
  requestAnimationFrame(frame);
})();
