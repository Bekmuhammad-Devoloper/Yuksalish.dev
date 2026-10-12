/* Yuksalish.dev — bitta Chimyon manzarasi, to‘rt fasl.
 *
 * Orqa fon: bir xil kompozitsiyadagi 4 ta fotosurat (assets/img/*.jpg), skroll bilan
 * bir-biriga o‘tadi va kamera asta ko‘tariladi. Ustida canvas’da real ob-havo:
 * chuqurlikka ega yomg‘ir, qor, barg va gulbarglar, suzuvchi vodiy tumani, quyosh nurlari.
 *
 * Skroll ikki qiymat beradi:
 *   raw   — 0..3 chiziqli (balandlik va kamera uchun)
 *   blend — fasllar orasidagi silliq o‘tish (surat, rang va ob-havo uchun)            */
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
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ================= Fasllar ================= */
  const SEASONS = [
    { key: 'Navro‘z', desc: 'Bahor · yomg‘irdan keyin' },
    { key: 'Saraton', desc: 'Yoz · ochiq osmon' },
    { key: 'Mezon',   desc: 'Kuz · xazonrezgi' },
    { key: 'Chilla',  desc: 'Qish · qor' },
  ];
  // [Navro‘z, Saraton, Mezon, Chilla]
  const PAL = {
    accent: ['#f4a3bb', '#ffc061', '#ff9a57', '#a9c1ff'],
    tint:   ['#16201d', '#0e1c28', '#2a1910', '#111532'],   // shisha varaqlar foni
    fog:    ['#e9ece9', '#f4f1e8', '#f3dcc0', '#c9cde6'],
    light:  ['#fff1d8', '#fff6dc', '#ffc27a', '#b9c4ff'],
  };
  const NUM = {
    fog:     [.3, .04, .18, .2],    // vodiy tumani
    rays:    [.15, .1, .5, 0],      // quyosh nurlari
    veil:    [.06, 0, .015, .04],   // havodagi namlik pardasi
    flare:   [0, 1, 0, 0],          // yozgi linza dog‘lari
    lens:    [1, 0, 0, 0],          // linzadagi tomchilar
    wind:    [.6, .15, 2.2, .7],
    temp:    [12, 29, 9, -11],
  };
  const ALT = [1600, 2100, 2700, 3309];
  const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, v.map(hex)]));

  /* ================= Skroll → fasl ================= */
  const anchors = $$('[data-s]');
  let anchorY = [], maxScroll = 1;
  function measure() {
    maxScroll = Math.max(1, root.scrollHeight - innerHeight);
    anchorY = anchors.map((el) => Math.min(el.getBoundingClientRect().top + scrollY, maxScroll));
  }
  function readScroll() {
    const y = scrollY;
    let raw = 0, blend = 0;
    for (let i = 0; i < anchorY.length - 1; i++) {
      const a = anchorY[i], b = anchorY[i + 1];
      if (y < a) break;
      raw = i + (b > a ? clamp((y - a) / (b - a), 0, 1) : 1);
      // Fasl keyingi bo‘lim ekranga kirib kelayotganda almashadi
      const start = Math.max(a, b - innerHeight * 1.3), end = b - innerHeight * .15;
      blend = i + smooth(clamp((y - start) / Math.max(1, end - start), 0, 1));
    }
    return { raw, blend };
  }

  const st = { raw: 0, blend: 0 };
  const B = { i: 0, t: 0, w: [1, 0, 0, 0] };
  const C = {}, N = {};
  function computeBlend() {
    const i = Math.min(2, Math.floor(st.blend)), t = st.blend - i;
    B.i = i; B.t = t; B.w = [0, 0, 0, 0]; B.w[i] = 1 - t; B.w[i + 1] += t;
    for (const k in RGB) C[k] = mix(RGB[k][i], RGB[k][i + 1], t);
    for (const k in NUM) N[k] = lerp(NUM[k][i], NUM[k][i + 1], t);
  }

  /* ================= Fotosuratlar ================= */
  const photos = $('#photos');
  const imgs = $$('#photos img');
  let mx = 0, my = 0, pmx = 0, pmy = 0;

  // Ekrandagi nuqta ↔ surat piksellari (object-fit: cover + kamera harakati hisobga olinadi)
  const OBJ_POS = [.62, .55];
  let box = { left: 0, top: 0, width: 1, height: 1 };
  function imageMap(k) {
    const im = imgs[k];
    const iw = im.naturalWidth || 1536, ih = im.naturalHeight || 864;
    const s = Math.max(box.width / iw, box.height / ih);
    return { s, dx: box.left + (box.width - iw * s) * OBJ_POS[0], dy: box.top + (box.height - ih * s) * OBJ_POS[1] };
  }
  function toScreen(k, u, v) {
    const m = imageMap(k), im = imgs[k];
    return { x: m.dx + u * (im.naturalWidth || 1536) * m.s, y: m.dy + v * (im.naturalHeight || 864) * m.s };
  }

  function updatePhotos(time) {
    imgs.forEach((im, k) => { im.style.opacity = B.w[k].toFixed(3); });
    // Kamera: skroll bilan asta yaqinlashib, yuqoriga ko‘tariladi; sichqoncha bilan biroz suriladi
    const asc = st.raw / 3;
    const breathe = reduceMotion ? 0 : Math.sin(time * .00015) * .006;
    const s = 1.06 + asc * .08 + breathe;
    const tx = -pmx * 14, ty = asc * 3.5 - pmy * 8;
    photos.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}%, 0) scale(${s.toFixed(4)})`;
    box = photos.getBoundingClientRect();
  }

  /* ================= Ob-havo qatlami ================= */
  const canvas = $('#world');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, density = 1, wind = .5, gust = 0;

  // Silliq tasodifiy funksiya (shamol shiddati uchun)
  const wave = (t) => Math.sin(t) * .5 + Math.sin(t * 2.31 + 1.7) * .3 + Math.sin(t * 5.13 + .4) * .2;

  /* ---------- spraytlar: bir marta chiziladi, keyin tez nusxalanadi ---------- */
  function sprite(size, draw, blur = 0) {
    const pad = Math.ceil(blur * 2.5);
    const c = document.createElement('canvas');
    c.width = c.height = size + pad * 2;
    const g = c.getContext('2d');
    if (blur) g.filter = `blur(${blur}px)`;
    g.translate(pad + size / 2, pad + size / 2);
    draw(g, size);
    c.k = (size + pad * 2) / size;        // chizishda o‘lchamni to‘g‘rilash uchun
    return c;
  }
  const BLURS = [0, 1.2, 3.5];            // fokusda → fokusdan tashqari

  // Qor parchasi
  const SNOW = BLURS.concat(7).map((b) => sprite(32, (g, s) => {
    const r = s / 2;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.45, 'rgba(255,255,255,.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
  }, b));

  // O‘rik gulbargi
  const PETAL = [['#fff7f9', '#f2b9c9'], ['#ffffff', '#f7d3dd']].map(([c0, c1]) =>
    BLURS.map((b) => sprite(40, (g, s) => {
      const r = s * .42;
      const gr = g.createLinearGradient(0, -r, 0, r);
      gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, r);
      g.bezierCurveTo(-r * 1.1, r * .2, -r * .8, -r * 1.05, 0, -r * .7);
      g.bezierCurveTo(r * .8, -r * 1.05, r * 1.1, r * .2, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(220,150,170,.35)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(0, r * .9); g.lineTo(0, -r * .4); g.stroke();
    }, b)));

  // Kuzgi barglar: chinor (panjasimon), o‘rik (cho‘ziq), tol (ingichka)
  const LEAF_COLORS = ['#c9651f', '#a9411a', '#d9a234', '#8f3114', '#b8782b', '#7d4b1d'];
  const shade = (hexc, k) => { const c = hex(hexc); return `rgb(${c.map((v) => Math.round(v * k)).join(',')})`; };
  const LEAF_SHAPES = [
    (g, s) => {   // chinor
      const R = s * .46;
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const th = i / 120 * 6.283 - Math.PI / 2;
        const lobe = Math.pow(Math.abs(Math.cos((th + Math.PI / 2) * 2.5)), .55);
        const notch = th > Math.PI * .3 && th < Math.PI * .7 ? .55 : 1;   // bandi tomoni
        const r = R * (.5 + .5 * lobe) * notch;
        const x = Math.cos(th) * r, y = Math.sin(th) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    },
    (g, s) => {   // o‘rik
      const R = s * .46;
      g.beginPath();
      g.moveTo(0, -R);
      g.bezierCurveTo(R * .75, -R * .55, R * .7, R * .55, 0, R * .8);
      g.bezierCurveTo(-R * .7, R * .55, -R * .75, -R * .55, 0, -R);
      g.closePath();
    },
    (g, s) => {   // tol
      const R = s * .48;
      g.beginPath();
      g.moveTo(0, -R);
      g.quadraticCurveTo(R * .34, 0, 0, R * .85);
      g.quadraticCurveTo(-R * .34, 0, 0, -R);
      g.closePath();
    },
  ];
  function leafSprite(shapeIdx, col, back, blur) {
    return sprite(56, (g, s) => {
      const k = back ? .72 : 1;
      LEAF_SHAPES[shapeIdx](g, s);
      const gr = g.createRadialGradient(-s * .08, -s * .1, 0, 0, 0, s * .55);
      gr.addColorStop(0, shade(col, k * 1.12));
      gr.addColorStop(1, shade(col, k * .82));
      g.fillStyle = gr;
      g.fill();
      g.save(); g.clip();
      g.strokeStyle = shade(col, k * .62); g.globalAlpha = .55;
      g.lineWidth = s * .025;
      g.beginPath(); g.moveTo(0, s * .45); g.lineTo(0, -s * .42); g.stroke();      // markaziy tomir
      g.lineWidth = s * .012;
      for (let i = -3; i <= 3; i++) {
        if (!i) continue;
        const y0 = s * .3 - Math.abs(i) * s * .12;
        g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(i * s * .08, y0 - s * .06, i * s * .16, y0 - s * .2); g.stroke();
      }
      g.restore();
      g.strokeStyle = shade(col, k * .5); g.lineWidth = s * .03; g.globalAlpha = 1;
      g.beginPath(); g.moveTo(0, s * .38); g.lineTo(s * .02, s * .5); g.stroke();    // bandi
    }, blur);
  }
  const LEAVES = [];   // [shape][color][side][blur]
  for (let sh = 0; sh < LEAF_SHAPES.length; sh++) {
    LEAVES[sh] = LEAF_COLORS.map((c) => [0, 1].map((back) => [0, 2.5].map((b) => leafSprite(sh, c, back, b))));
  }

  // Quyoshdagi chang zarrasi
  const MOTE = [0, 2].map((b) => sprite(24, (g, s) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    gr.addColorStop(0, 'rgba(255,250,228,1)');
    gr.addColorStop(.3, 'rgba(255,240,200,.5)');
    gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, s / 2, 0, 6.283); g.fill();
  }, b));

  function drawSprite(spr, x, y, size, rot = 0, sx = 1, alpha = 1) {
    const d = size * spr.k;
    ctx.globalAlpha = alpha;
    if (rot || sx !== 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, sx);
      ctx.drawImage(spr, -d / 2, -d / 2, d, d);
      ctx.restore();
    } else ctx.drawImage(spr, x - d / 2, y - d / 2, d, d);
  }

  /* ---------- tuman ---------- */
  const fogTex = document.createElement('canvas');
  (function makeFog() {
    const w = 512, h = 160;
    fogTex.width = w; fogTex.height = h;
    const g = fogTex.getContext('2d');
    const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const r = seeded(4242);
    for (let n = 0; n < 220; n++) {
      const x = r() * w, y = h * (.25 + r() * .6), rad = 20 + r() * 60;
      for (const dx of [-w, 0, w]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
        gr.addColorStop(0, `rgba(255,255,255,${.05 + r() * .07})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x + dx, y, rad * 1.8, rad * .55, 0, 0, 6.283); g.fill();
      }
    }
  })();
  let fogOff1 = 0, fogOff2 = 0;

  function drawFog() {
    if (N.fog < .01) return;
    const tw = W * 1.4, th = tw * fogTex.height / fogTex.width;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const [off, y, a, sc] of [[fogOff1, H * .5, 1, 1], [fogOff2, H * .62, .8, 1.35]]) {
      const w2 = tw * sc, h2 = th * sc;
      const x0 = -((off % w2) + w2) % w2;
      ctx.globalAlpha = N.fog * a;
      for (let x = x0; x < W; x += w2) ctx.drawImage(fogTex, x, y - h2 / 2, w2, h2);
    }
    ctx.restore();
    const g = ctx.createLinearGradient(0, H * .45, 0, H);
    g.addColorStop(0, rgba(C.fog, 0));
    g.addColorStop(.5, rgba(C.fog, N.fog * .2));
    g.addColorStop(1, rgba(C.fog, N.fog * .08));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * .45, W, H * .55);
  }

  /* ---------- yorug‘lik: kuzgi nurlar va yozgi linza dog‘lari ---------- */
  function drawRays(time) {
    if (N.rays < .01) return;
    // Kuz suratida quyosh chap chetda, ufqda
    const sun = toScreen(2, .0, .47);
    const ox = sun.x, oy = sun.y;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 7; k++) {
      const ang = -.16 + k * .07 + Math.sin(time * .00018 + k) * .012;
      const len = W * 1.3, spread = .012 + (k % 3) * .007;
      const a = N.rays * (.045 + .035 * Math.sin(time * .0005 + k * 1.7));
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      g.addColorStop(0, rgba(C.light, a));
      g.addColorStop(.7, rgba(C.light, a * .3));
      g.addColorStop(1, rgba(C.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
      ctx.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
      ctx.closePath(); ctx.fill();
    }
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, W * .55);
    glow.addColorStop(0, rgba(C.light, N.rays * .4));
    glow.addColorStop(.3, rgba(C.light, N.rays * .12));
    glow.addColorStop(1, rgba(C.light, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawFlare() {
    const a = N.flare;
    if (a < .01) return;
    // Yozgi quyosh kadrdan tashqarida, o‘ng yuqorida; linzada aks-sado doiralari qoldiradi
    const sx = W * .96 - pmx * 30, sy = -H * .06 - pmy * 20;
    const cx = W * .5, cy = H * .5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .5);
    g.addColorStop(0, `rgba(255,248,225,${.55 * a})`);
    g.addColorStop(.2, `rgba(255,236,190,${.16 * a})`);
    g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const ghosts = [[.35, 26, [255, 220, 160], .1], [.6, 60, [170, 230, 200], .05], [.82, 16, [255, 200, 150], .12], [1.15, 110, [150, 190, 255], .035], [1.4, 38, [255, 170, 120], .06]];
    for (const [t, r, c, al] of ghosts) {
      const x = sx + (cx - sx) * t * 1.6, y = sy + (cy - sy) * t * 1.6;
      const gg = ctx.createRadialGradient(x, y, r * .2, x, y, r);
      gg.addColorStop(0, rgba(c, al * a * .4));
      gg.addColorStop(.85, rgba(c, al * a));
      gg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- linzadagi yomg‘ir tomchilari ---------- */
  // Har bir tomchi orqasidagi manzarani teskari va kichraytirib ko‘rsatadi — haqiqiy linzadagidek.
  let drops = [];
  function updateDrops() {
    const w = B.w[0] * N.lens;
    const target = Math.round(42 * w * density);
    if (drops.length < target && Math.random() < .35) {
      const big = Math.random() < .3;
      drops.push({ x: rand(0, W), y: rand(0, H * .95), r: big ? rand(7, 13) : rand(2, 6.5), a: 0, vy: 0, life: 1, trail: 0, sx: rand(.85, 1.05) });
    }
    const next = [];
    for (const d of drops) {
      if (drops.length > target + 2 || w < .05) d.life -= .012;     // fasl o‘tganda bug‘lanadi
      d.a = Math.min(1, d.a + .08) * Math.max(0, d.life);
      if (d.r > 8.5 && Math.random() < .015) d.vy = rand(1.5, 4);   // og‘ir tomchi pastga sirg‘aladi
      if (d.vy) {
        d.y += d.vy; d.x += Math.sin(d.y * .05) * .4;
        d.vy *= .985;
        if (d.vy < .3) d.vy = 0;
        d.trail += d.vy;
        if (d.trail > 9) {                                           // orqasida mayda iz qoladi
          d.trail = 0;
          if (drops.length < 140) next.push({ x: d.x + rand(-1, 1), y: d.y - d.r * 1.2, r: rand(1.2, 2.6), a: 1, vy: 0, life: .9, trail: 0, sx: 1 });
          d.r *= .985;
        }
      }
      if (d.life > 0 && d.y < H + 20 && d.r > 1) next.push(d);
    }
    drops = next;
  }
  function drawDrops() {
    if (!drops.length) return;
    const k = B.w[0] >= B.w[1] ? 0 : 1;
    const img = imgs[k];
    if (!img.naturalWidth) return;
    const m = imageMap(k);
    for (const d of drops) {
      if (d.a < .02) continue;
      const rx = d.r * d.sx, ry = d.r;
      ctx.save();
      ctx.globalAlpha = d.a * .85;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, rx, ry, 0, 0, 6.283); ctx.clip();
      // linza effekti: tomchi atrofidagi ~5 barobar katta hududni teskari ko‘rsatadi
      const span = d.r * 5.5 / m.s;
      const ix = (d.x - m.dx) / m.s, iy = (d.y - m.dy) / m.s;
      ctx.translate(d.x, d.y); ctx.scale(1, -1);
      try { ctx.drawImage(img, ix - span, iy - span, span * 2, span * 2, -rx, -ry, rx * 2, ry * 2); } catch { /* chegara tashqarisi */ }
      ctx.restore();
      // suv: ichki yorug‘lik, pastki yorqin o‘roq (kaustika), yumshoq qirra va yaltiroq nuqta
      ctx.globalAlpha = d.a;
      const body = ctx.createRadialGradient(d.x, d.y + d.r * .35, 0, d.x, d.y, d.r);
      body.addColorStop(0, 'rgba(255,255,255,.22)');
      body.addColorStop(.7, 'rgba(255,255,255,.05)');
      body.addColorStop(.9, 'rgba(20,28,34,.12)');
      body.addColorStop(1, 'rgba(20,28,34,.28)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, rx, ry, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(.6, d.r * .1);
      ctx.beginPath(); ctx.ellipse(d.x, d.y + d.r * .05, rx * .8, ry * .8, 0, .35, 2.8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(d.x - d.r * .32, d.y - d.r * .4, Math.max(.5, d.r * .16), Math.max(.4, d.r * .1), -.6, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- havodagi zarrachalar ---------- */
  // z — chuqurlik: 0 uzoq (kichik, xira), 1 kameraga yaqin (katta, fokusdan tashqari)
  const TYPES = {
    rain:  { max: 520, w: [1, 0, 0, 0],    rate: 18 },
    petal: { max: 22,  w: [.8, .04, 0, 0], rate: 1 },
    bird:  { max: 3,   w: [.25, 1, .4, 0], rate: .008 },
    mote:  { max: 46,  w: [0, 1, .5, 0],   rate: 1 },
    leaf:  { max: 40,  w: [0, 0, 1, 0],    rate: 1 },
    snow:  { max: 620, w: [0, 0, 0, 1],    rate: 16 },
  };
  const BURST = ['petal', 'mote', 'leaf', 'snow'];
  const blurIdx = (z, n) => Math.min(n - 1, Math.floor(Math.max(0, z - .55) / .45 * n));
  let parts = [];

  function spawn(type, x, y, burst, keepPhysics) {
    const z = type === 'snow' || type === 'rain' ? Math.pow(Math.random(), 2.4) : Math.pow(Math.random(), 1.5);
    const p = { type, z, a: 0, dying: false, bx: 0, by: 0, ph: Math.random() * 6.28 };
    switch (type) {
      case 'rain':  p.x = rand(-W * .3, W * 1.05); p.y = rand(-H * .3, H * .1); p.vy = 18 + z * 26; p.len = 10 + z * 46; p.a = 1; break;
      case 'petal': p.x = rand(-80, W); p.y = rand(-40, -10); p.vx = rand(.2, .9); p.vy = .5 + z * 1.4; p.size = 4 + z * z * 22; p.rot = rand(0, 6.28); p.vr = rand(-.04, .04); p.c = (Math.random() * 2) | 0; break;
      case 'mote':  p.x = rand(0, W); p.y = rand(H * .1, H * .95); p.vy = rand(-.2, -.04); p.size = 3 + z * 9; p.life = 0; p.max = rand(300, 700); break;
      case 'bird': {
        const left = Math.random() < .5;
        p.x = left ? -20 : W + 20; p.y = rand(H * .1, H * .3);
        p.vx = (left ? 1 : -1) * rand(.5, .9); p.size = rand(2, 3.2);
        p.flock = 2 + ((Math.random() * 4) | 0); p.a = 1;
        break;
      }
      case 'leaf':  p.x = rand(-W * .5, W * .9); p.y = -40; p.vx = rand(.4, 1.2); p.vy = .7 + z * 2; p.size = 9 + z * z * 46; p.rot = rand(0, 6.28); p.vr = rand(-.04, .04); p.flip = rand(.015, .05); p.sh = (Math.random() * 3) | 0; p.c = (Math.random() * LEAF_COLORS.length) | 0; break;
      case 'snow':  p.x = rand(-W * .2, W * 1.2); p.y = rand(-60, -5); p.size = 2 + z * z * 26; p.vy = .35 + z * 1.9; break;
    }
    if (x !== undefined) { p.x = x; p.y = y; }
    if (keepPhysics) p.a = 0;
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
        else {
          // Fasl endi boshlanayotgan bo‘lsa, zarrachalar butun ekran bo‘ylab paydo bo‘ladi (tepadan kutmasdan)
          const fill = have < target * .6 && type !== 'bird';
          for (let n = 0; n < Math.min(T.rate * (fill ? 3 : 1), target - have); n++) {
            if (fill) spawn(type, rand(-W * .1, W * 1.1), rand(-20, H * .95), false, true);
            else spawn(type);
          }
        }
      } else if (have > target) {
        for (const p of parts) {
          if (have <= target) break;
          if (p.type === type && !p.dying) { p.dying = true; have--; }
        }
      }
    }

    const next = [];
    for (const p of parts) {
      p.ph += .03;
      p.x += p.bx; p.y += p.by; p.bx *= .93; p.by *= .93;
      const par = .35 + p.z * 1.1;
      switch (p.type) {
        case 'rain':  p.vx = wind * (2.2 + p.z * 3.5) + .5; p.x += p.vx; p.y += p.vy; break;
        case 'petal': p.x += (p.vx + wind * 1.1 + Math.sin(p.ph) * .8) * par; p.y += p.vy + Math.cos(p.ph * 1.3) * .3; p.rot += p.vr + Math.sin(p.ph) * .01; break;
        case 'mote':  p.x += (Math.sin(p.ph * .5) * .25 + wind * .25) * par; p.y += p.vy; p.life++; break;
        case 'bird':  p.x += p.vx; p.y += Math.sin(p.ph * .3) * .1; break;
        case 'leaf':  p.x += (p.vx + wind * 1.4 + Math.sin(p.ph * .7) * 1.4) * par; p.y += p.vy + Math.cos(p.ph * 1.5) * .45; p.rot += p.vr + Math.sin(p.ph) * .012; p.ph += p.flip; break;
        case 'snow':  p.x += (Math.sin(p.ph * .4 + p.z * 4) * .55 + wind * .7) * par; p.y += p.vy * (1 + gust * .15); break;
      }
      if (p.dying) p.a -= .02;
      else if (p.a < 1) p.a = Math.min(1, p.a + .03);
      if (p.max) { p.fade = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1)); if (p.life >= p.max) continue; }
      const out = p.y > H + 80 || p.y < -H * .6 || p.x < -W * .6 - 80 || p.x > W * 1.6 + 80 ||
        (p.type === 'bird' && (p.x < -60 || p.x > W + 60));
      if (out || p.a <= 0) continue;
      next.push(p);
    }
    parts = next;
  }

  function drawParticles(time) {
    // yomg‘ir: uchta chuqurlik qatlami, har biri bitta yo‘l bilan (tez)
    const bands = [[0, .35, .09, .7], [.35, .7, .15, 1.1], [.7, 1.01, .2, 1.8]];
    ctx.lineCap = 'round';
    for (const [z0, z1, al, lw] of bands) {
      ctx.beginPath();
      let any = false;
      for (const p of parts) {
        if (p.type !== 'rain' || p.z < z0 || p.z >= z1) continue;
        const dx = p.vx / p.vy * p.len;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - p.len);
        any = true;
      }
      if (any) { ctx.strokeStyle = `rgba(214,224,234,${al})`; ctx.lineWidth = lw; ctx.globalAlpha = 1; ctx.stroke(); }
    }

    for (const p of parts) {
      const a = p.a * (p.fade ?? 1);
      switch (p.type) {
        case 'petal':
          drawSprite(PETAL[p.c][blurIdx(p.z, 3)], p.x, p.y, p.size, p.rot, .3 + Math.abs(Math.sin(p.ph * 1.4)) * .7, a * (.6 + p.z * .35));
          break;
        case 'mote':
          drawSprite(MOTE[p.z > .6 ? 1 : 0], p.x, p.y, p.size, 0, 1, a * (.35 + p.z * .5));
          break;
        case 'bird':
          ctx.globalAlpha = .65 * a;
          ctx.strokeStyle = 'rgb(28,30,34)';
          ctx.lineWidth = 1;
          for (let k = 0; k < p.flock; k++) {
            const s = p.size * (1 - k * .08), bx = p.x - Math.sign(p.vx) * k * 13, by = p.y + (k % 2 ? 5 : -4) * Math.ceil(k / 2);
            const f = Math.sin(time * .017 + p.ph * 10 + k * 1.3) * s * .7;
            ctx.beginPath();
            ctx.moveTo(bx - s, by - f);
            ctx.quadraticCurveTo(bx - s * .4, by - s * .25, bx, by);
            ctx.quadraticCurveTo(bx + s * .4, by - s * .25, bx + s, by - f);
            ctx.stroke();
          }
          break;
        case 'leaf': {
          const flip = Math.cos(p.ph * 2);
          const spr = LEAVES[p.sh][p.c][flip > 0 ? 0 : 1][p.z > .72 ? 1 : 0];
          drawSprite(spr, p.x, p.y, p.size, p.rot, .12 + Math.abs(flip) * .88, a * (p.z > .72 ? .85 : .97));
          break;
        }
        case 'snow':
          drawSprite(SNOW[blurIdx(p.z, 4)], p.x, p.y, p.size, 0, 1, a * (.5 + p.z * .45));
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawVeil() {
    if (N.veil < .01) return;
    ctx.fillStyle = `rgba(190,200,212,${N.veil})`;
    ctx.fillRect(0, 0, W, H);
  }

  /* ================= Interfeys ================= */
  const hudKey = $('#hudKey'), hudDesc = $('#hudDesc'), hudTemp = $('#hudTemp');
  const altValue = $('#altValue'), altMarker = $('#altMarker'), altScale = $('#altScale');
  const nav = $('#nav');
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

  const manifest = $('#manifest'), manifestText = $('#manifestText');
  manifestText.innerHTML = manifestText.textContent.trim().split(/\s+/).map((w) => `<span>${w}</span>`).join(' ');
  const words = [...manifestText.children];
  let lastWords = -1;

  const wm = $('#wordmark');
  wm.innerHTML = [...wm.textContent].map((ch, i) => `<i style="--i:${i}">${ch}</i>`).join('');

  const works = $('#ishlar'), track = $('#worksTrack'), worksBar = $('#worksBar');
  const wide = matchMedia('(min-width: 861px)');
  function sizeWorks() {
    if (!wide.matches) { works.style.height = ''; return; }
    works.style.height = (innerHeight + Math.max(0, track.scrollWidth - innerWidth)) + 'px';
  }

  let lastIdx = -1;
  function updateUI() {
    root.style.setProperty('--accent', rgba(C.accent));
    root.style.setProperty('--paper', rgba(C.tint, .5));
    root.style.setProperty('--paper-solid', rgba(C.tint));

    const idx = Math.round(st.blend);
    if (idx !== lastIdx) {
      lastIdx = idx;
      hudKey.textContent = SEASONS[idx].key;
      hudDesc.textContent = SEASONS[idx].desc;
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
      words.forEach((w, k) => { w.style.opacity = k < lit ? 1 : .25; });
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
    density = clamp(W / 1400, .4, 1) * (reduceMotion ? .3 : 1);
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
    const k = reduceMotion ? 1 : .08;
    st.raw += (s.raw - st.raw) * k;
    st.blend += (s.blend - st.blend) * k;
    if (Math.abs(s.blend - st.blend) < .0004) st.blend = s.blend;
    computeBlend();

    gust = Math.max(0, wave(time * .00035));             // vaqti-vaqti bilan shamol kuchayadi
    wind = N.wind * (.75 + gust * 1.1 + wave(time * .0011 + 3) * .15);
    if (!reduceMotion) { fogOff1 += .18 + wind * .12; fogOff2 += .32 + wind * .2; }
    pmx += (mx - pmx) * .035; pmy += (my - pmy) * .035;

    updatePhotos(time);
    ctx.clearRect(0, 0, W, H);
    drawRays(time);
    drawFlare();
    drawFog();
    drawVeil();
    updateParticles();
    drawParticles(time);
    updateDrops();
    drawDrops();

    updateUI();
    updateScrollUI();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('load', () => { sizeWorks(); measure(); });
  if (document.fonts) document.fonts.ready.then(() => { sizeWorks(); measure(); });
  resize();
  const s0 = readScroll();
  st.raw = s0.raw; st.blend = s0.blend;
  computeBlend();
  requestAnimationFrame(frame);
})();
