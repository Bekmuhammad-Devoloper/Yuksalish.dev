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
    tint:   ['#122236', '#0d2040', '#211f33', '#0f1638'],   // shisha varaqlar foni (brend navy asosida)
    fog:    ['#e9ece9', '#f4f1e8', '#f3dcc0', '#c9cde6'],
    light:  ['#fff1d8', '#fff6dc', '#ffc27a', '#b9c4ff'],
  };
  const NUM = {
    fog:     [.3, .04, .18, .2],    // vodiy tumani
    rays:    [.15, .1, .5, 0],      // quyosh nurlari
    veil:    [.06, 0, .015, .04],   // havodagi namlik pardasi
    flare:   [0, 1, 0, 0],          // yozgi linza dog‘lari
    lens:    [1, 0, 0, 0],          // linzadagi tomchilar
    sky:     [.16, .04, .1, .08],   // osmonda sekin suzuvchi bulut pardasi
    frost:   [0, 0, 0, 1],          // linzaga yopishib eriydigan qor
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
    const iw = im.naturalWidth || 1536, ih = im.naturalHeight || 1024;
    const s = Math.max(box.width / iw, box.height / ih);
    return { s, dx: box.left + (box.width - iw * s) * OBJ_POS[0], dy: box.top + (box.height - ih * s) * OBJ_POS[1] };
  }
  function toScreen(k, u, v) {
    const m = imageMap(k), im = imgs[k];
    return { x: m.dx + u * (im.naturalWidth || 1536) * m.s, y: m.dy + v * (im.naturalHeight || 1024) * m.s };
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
  const SNOW = [0, .5, 1.5, 4].map((b) => sprite(32, (g, s) => {
    const r = s / 2;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.55, 'rgba(255,255,255,.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
  }, b));

  // Yorug‘ fondagi qor parchasi — kulrangroq (qor ustida oq parcha ko‘rinmaydi, real hayotda ham shunday)
  const SNOW_DIM = [0, .5, 1.5, 4].map((b) => sprite(32, (g, s) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    gr.addColorStop(0, 'rgba(150,160,178,.95)');
    gr.addColorStop(.55, 'rgba(165,174,190,.8)');
    gr.addColorStop(1, 'rgba(165,174,190,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, s / 2, 0, 6.283); g.fill();
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
  let fogOff1 = 0, fogOff2 = 0, rainT = 0;

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
    const sun = toScreen(2, .044, .31);
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

  /* ---------- fon yorug‘ligi xaritasi ---------- */
  // Haqiqiy hayotda yomg‘ir to‘q fonda oq, yorug‘ osmonda kulrang ko‘rinadi; qor ham yorug‘ qor ustida xiralashadi.
  // Shuning uchun surat yorug‘ligini kichik to‘rda o‘lchab, har zarrani shunga moslab bo‘yaymiz.
  const LG = document.createElement('canvas'), lgx = LG.getContext('2d', { willReadFrequently: true });
  let lum = null, lumW = 96, lumH = 54, lumKey = -1, lumTick = 0;
  function updateLum() {
    const k = B.w.indexOf(Math.max(...B.w));
    if (k === lumKey && ++lumTick % 45) return;
    lumKey = k; lumTick = 0;
    const im = imgs[k];
    if (!im.naturalWidth || !W) return;
    lumH = Math.max(8, Math.round(lumW * H / W));
    LG.width = lumW; LG.height = lumH;
    const m = imageMap(k), sc = lumW / W;
    try {
      lgx.drawImage(im, m.dx * sc, m.dy * sc, im.naturalWidth * m.s * sc, im.naturalHeight * m.s * sc);
      const d = lgx.getImageData(0, 0, lumW, lumH).data;
      lum = new Float32Array(lumW * lumH);
      for (let i = 0; i < lum.length; i++) lum[i] = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255;
    } catch { lum = null; }      // fayl tizimidan ochilganda brauzer piksellarni o‘qishga ruxsat bermaydi
  }
  const lumAt = (x, y) => {
    if (!lum) return .4;
    const gx = clamp((x / W * lumW) | 0, 0, lumW - 1), gy = clamp((y / H * lumH) | 0, 0, lumH - 1);
    return lum[gy * lumW + gx];
  };

  /* ---------- yerga tushgan yomg‘ir sachrashlari ---------- */
  let splashes = [];
  function updateSplashes() {
    const w = B.w[0];
    if (w > .05) {
      const ground = toScreen(0, .5, .66).y;        // bahor suratida o‘tloq shu chiziqdan pastda
      const n = Math.random() < w * density * 6 % 1 ? Math.ceil(w * density * 6) : Math.floor(w * density * 6);
      for (let i = 0; i < n; i++) {
        const y = rand(Math.max(ground, H * .45), H);
        const depth = (y - ground) / Math.max(1, H - ground);          // pastroq — kameraga yaqinroq
        splashes.push({ x: rand(0, W), y, s: .6 + depth * 2.4, t: 0, life: 10 + depth * 8,
          drops: Array.from({ length: 2 + (Math.random() * 3 | 0) }, () => ({ vx: rand(-1.6, 1.6), vy: rand(-2.6, -1.2) })) });
      }
    }
    splashes = splashes.filter((sp) => ++sp.t < sp.life);
  }
  function drawSplashes() {
    if (!splashes.length) return;
    ctx.lineWidth = 1;
    for (const sp of splashes) {
      const k = sp.t / sp.life, a = (1 - k) * .55;
      const light = lumAt(sp.x, sp.y) < .55;
      ctx.strokeStyle = light ? `rgba(235,242,250,${a})` : `rgba(70,80,92,${a})`;
      ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sp.s * (1 + k * 5), sp.s * (1 + k * 5) * .28, 0, 0, 6.283); ctx.stroke();
      ctx.fillStyle = light ? `rgba(240,245,252,${a})` : `rgba(70,80,92,${a})`;
      for (const d of sp.drops) {
        const t = sp.t;
        ctx.fillRect(sp.x + d.vx * t * sp.s * .6, sp.y + (d.vy * t + .25 * t * t) * sp.s * .5, Math.max(1, sp.s * .6), Math.max(1, sp.s * .6));
      }
    }
  }

  /* ---------- osmonda suzuvchi bulut pardasi (time-lapse taassuroti) ---------- */
  let skyOff = 0;
  function drawSky() {
    if (N.sky < .01) return;
    const tw = W * 1.8, th = H * .5;
    const x0 = -((skyOff % tw) + tw) % tw;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = N.sky;
    for (let x = x0; x < W; x += tw) ctx.drawImage(fogTex, x, -H * .08, tw, th);
    ctx.restore();
  }

  /* ---------- linzadagi yomg‘ir tomchilari ---------- */
  // Har bir tomchi orqasidagi manzarani teskari va kichraytirib ko‘rsatadi — haqiqiy linzadagidek.
  let drops = [];
  function updateDrops() {
    const w = B.w[0] * N.lens;
    const target = Math.round(60 * w * density);
    if (drops.length < target && Math.random() < .35) {
      const big = Math.random() < .3;
      drops.push({ x: rand(0, W), y: rand(0, H * .95), r: big ? rand(7, 13) : rand(2, 6.5), a: 0, vy: 0, life: 1, trail: 0, sx: rand(.85, 1.05) });
    }
    // qishda linzaga qor parchalari yopishadi va asta erib tomchiga aylanadi
    const fw = B.w[3] * N.frost;
    if (fw > .3 && drops.filter((d) => d.flake).length < 8 * density && Math.random() < .02 * fw) {
      drops.push({ x: rand(0, W), y: rand(0, H * .9), r: rand(5, 11), a: 0, vy: 0, life: 1, trail: 0, sx: rand(.9, 1.1), flake: 1, melt: 0, rot: rand(0, 6.28) });
    }
    const next = [];
    for (const d of drops) {
      if (d.flake) {
        d.melt += .0035;
        if (d.melt >= 1) { d.flake = 0; d.r *= .6; d.life = 1.6; }   // erib bo‘ldi — endi oddiy tomchi
        d.a = Math.min(1, d.a + .06);
        if (fw < .1) d.life -= .02;
        if (d.life > 0) next.push(d);
        continue;
      }
      if ((drops.length > target + 2 || w < .05) && !(fw > .3)) d.life -= .012;     // fasl o‘tganda bug‘lanadi
      else if (fw > .3) d.life -= .004;
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
    const k = B.w.indexOf(Math.max(...B.w));
    const img = imgs[k];
    if (!img.naturalWidth) return;
    const m = imageMap(k);
    for (const d of drops) {
      if (d.a < .02) continue;
      if (d.flake) {
        // yopishgan qor: fokusdan tashqari oq dog‘, erigan sari shaffoflashib tomchiga aylanadi
        const k = d.melt, r = d.r * (1.6 - k * .6);
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r);
        g.addColorStop(0, `rgba(255,255,255,${(.75 - k * .5) * d.a})`);
        g.addColorStop(.6, `rgba(240,244,255,${(.45 - k * .3) * d.a})`);
        g.addColorStop(1, 'rgba(240,244,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.283); ctx.fill();
        // olti qirrali kristall izi (erishning boshida ko‘rinadi)
        if (k < .5) {
          ctx.strokeStyle = `rgba(255,255,255,${(.5 - k) * d.a})`; ctx.lineWidth = .8;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const an = d.rot + i * Math.PI / 3;
            ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(an) * r * .8, d.y + Math.sin(an) * r * .8);
          }
          ctx.stroke();
        }
        continue;
      }
      const rx = d.r * d.sx, ry = d.r;
      ctx.save();
      ctx.globalAlpha = d.a;
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
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = Math.max(.7, d.r * .12);
      ctx.beginPath(); ctx.ellipse(d.x, d.y + d.r * .05, rx * .8, ry * .8, 0, .35, 2.8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(d.x - d.r * .32, d.y - d.r * .4, Math.max(.5, d.r * .16), Math.max(.4, d.r * .1), -.6, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- havodagi zarrachalar ---------- */
  // z — chuqurlik: 0 uzoq (kichik, xira), 1 kameraga yaqin (katta, fokusdan tashqari)
  const TYPES = {
    rain:  { max: 650, w: [1, 0, 0, 0],    rate: 22 },
    petal: { max: 42,  w: [.9, .04, 0, 0], rate: 2 },
    bird:  { max: 5,   w: [.25, 1, .4, 0], rate: .015 },
    mote:  { max: 75,  w: [0, 1, .5, 0],   rate: 2 },
    leaf:  { max: 65,  w: [0, 0, 1, 0],    rate: 2 },
    snow:  { max: 820, w: [0, 0, 0, 1],    rate: 20 },
  };
  const BURST = ['petal', 'mote', 'leaf', 'snow'];
  const blurIdx = (z, n) => Math.min(n - 1, Math.floor(Math.max(0, z - .8) / .2 * n));   // faqat kameraga juda yaqinlari xira
  let parts = [];

  function spawn(type, x, y, burst, keepPhysics) {
    const z = type === 'snow' || type === 'rain' ? Math.pow(Math.random(), 2.4) : Math.pow(Math.random(), 1.5);
    const p = { type, z, a: 0, dying: false, bx: 0, by: 0, ph: Math.random() * 6.28 };
    switch (type) {
      case 'rain': {
        // shamol yomg‘irni to‘lqin-to‘lqin olib keladi: shovqin yuqori joyda zichroq
        let x = rand(-W * .3, W * 1.05);
        for (let t = 0; t < 3 && wave(x * .004 + rainT) < -.1; t++) x = rand(-W * .3, W * 1.05);
        p.x = x; p.y = rand(-H * .3, H * .1); p.vy = 18 + z * 26; p.len = 10 + z * 46; p.a = 1; break;
      }
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
      case 'snow':  p.x = rand(-W * .2, W * 1.2); p.y = rand(-60, -5); p.size = 3 + z * z * 20; p.vy = .45 + z * 1.9; break;
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
        case 'snow':  p.dx = (Math.sin(p.ph * .4 + p.z * 4) * .55 + wind * .7) * par; p.x += p.dx; p.y += p.vy * (1 + gust * .15); break;
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
    // Fonga qarab: to‘q joyda oq-kumush, yorug‘ osmonda kulrang
    const bands = [[0, .35, .26, .9], [.35, .7, .38, 1.3], [.7, 1.01, .5, 2]];
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
    for (const [z0, z1, al, lw] of bands) {
      for (const lightPass of [true, false]) {
        ctx.beginPath();
        let any = false;
        for (const p of parts) {
          if (p.type !== 'rain' || p.z < z0 || p.z >= z1) continue;
          if ((lumAt(p.x, p.y) < .62) !== lightPass) continue;
          const dx = p.vx / p.vy * p.len;
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - p.len);
          any = true;
        }
        if (!any) continue;
        ctx.strokeStyle = lightPass ? `rgba(232,240,248,${al})` : `rgba(88,98,112,${al * .85})`;
        ctx.lineWidth = lw; ctx.stroke();
      }
    }

    for (const p of parts) {
      const a = p.a * (p.fade ?? 1);
      switch (p.type) {
        case 'petal':
          drawSprite(PETAL[p.c][blurIdx(p.z, 3)], p.x, p.y, p.size, p.rot, .3 + Math.abs(Math.sin(p.ph * 1.4)) * .7, a * .95);
          break;
        case 'mote':
          drawSprite(MOTE[p.z > .85 ? 1 : 0], p.x, p.y, p.size, 0, 1, a * (.7 + p.z * .3));
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
          const spr = LEAVES[p.sh][p.c][flip > 0 ? 0 : 1][p.z > .88 ? 1 : 0];
          drawSprite(spr, p.x, p.y, p.size, p.rot, .12 + Math.abs(flip) * .88, a);
          break;
        }
        case 'snow': {
          // yorug‘ qor fonida kulrang tus; shamolda harakatdan cho‘ziladi
          const spr = (lumAt(p.x, p.y) > .72 ? SNOW_DIM : SNOW)[blurIdx(p.z, 4)];
          const vx = p.dx || 0, vy = p.vy;
          const sp = Math.hypot(vx, vy);
          if (sp > 2.2) {
            const st = Math.min(2.2, 1 + (sp - 2.2) * .35);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(vy, vx)); ctx.scale(st, 1 / Math.sqrt(st));
            drawSprite(spr, 0, 0, p.size, 0, 1, a * (.85 + p.z * .15));
            ctx.restore();
          } else drawSprite(spr, p.x, p.y, p.size, 0, 1, a * (.85 + p.z * .15));
          break;
        }
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

  // Sarlavha so‘zlari pastdan birin-ketin ko‘tariladi
  const headline = $('#headline');
  let wi = 0;
  const splitWords = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          w.innerHTML = `<i style="--i:${wi++}">${part}</i>`;
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else splitWords(n);
    }
  };
  splitWords(headline);

  const works = $('#ishlar'), track = $('#worksTrack'), worksBar = $('#worksBar');
  const wide = matchMedia('(min-width: 861px)');
  // Kartalar ekran balandligiga sig‘masa, galereya butunligicha kichrayadi — pastki havolalar kesilmaydi
  const worksHead = $('.works-head'), worksBarBox = worksBar.parentElement;
  let worksZoom = 1;
  function sizeWorks() {
    track.style.zoom = '';
    worksZoom = 1;
    if (!wide.matches) { works.style.height = ''; return; }
    const pin = track.parentElement, cs = getComputedStyle(pin);
    const avail = pin.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const total = worksBarBox.getBoundingClientRect().bottom - worksHead.getBoundingClientRect().top;
    const th = track.offsetHeight;
    if (total > avail && th) {
      worksZoom = Math.max(.55, 1 - (total - avail) / th);
      track.style.zoom = worksZoom.toFixed(3);
    }
    works.style.height = (innerHeight + Math.max(0, trackWidth() - innerWidth)) + 'px';
  }
  const trackWidth = () => track.scrollWidth * worksZoom;

  let lastIdx = -1;
  function updateUI() {
    root.style.setProperty('--season', rgba(C.accent));
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
      const dist = Math.max(0, trackWidth() - innerWidth);
      track.style.transform = `translate3d(${(-wp * dist / worksZoom).toFixed(1)}px,0,0)`;
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
    location.href = `mailto:yuksalishdev@gmail.com?subject=${encodeURIComponent('Yangi loyiha — Yuksalish.dev')}&body=${encodeURIComponent(body)}`;
  }

  $('#year').textContent = new Date().getFullYear();

  // Jamoa rasmlari HTML’da darhol ko‘rsatiladi (JS’ga bog‘liq emas); fayl yuklanmasa bosh harflarga qaytamiz
  function loadTeamPhotos() {
    $$('.person-photo[data-photo]').forEach((el) => {
      const src = el.dataset.photo;
      if (!src) return;
      el.style.backgroundImage = `url("${src}")`; el.style.backgroundPosition = 'center 20%'; el.classList.add('has-photo');
      const probe = new Image();
      probe.onerror = () => { el.style.backgroundImage = ''; el.classList.remove('has-photo'); };
      probe.src = src;
    });
  }
  loadTeamPhotos();

  /* ---------- Admin paneldagi ma’lumotlar (server bo‘lsa) ---------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|#)/i.test(u || '') ? u : '');
  const OUT = ' target="_blank" rel="noopener"';
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const LINK_LABELS = { site: 'Sayt', telegram: 'Telegram bot', playmarket: 'Google Play', appstore: 'App Store', landing: 'Landing' };
  // Havola logolari (strelka o‘rniga)
  const ICONS = {
    telegram: '<path class="li-fill" d="M21.4 4.2 2.9 11.4c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 5.8c.3-1.3-.5-1.9-1.5-1.6zM8.8 14.1l9.4-5.9c.5-.3.9-.1.5.2l-7.9 7.1-.3 3.3z"/>',
    playmarket: '<path class="li-fill" d="M4.1 2.7c-.3.3-.4.7-.4 1.2v16.2c0 .5.1.9.4 1.2l9-9.3zm10.1 10.4 2.6 2.6L6 21.9zM6 2.1l10.8 6.2-2.6 2.6zm11.9 6.9 2.5 1.4c.9.5.9 1.3 0 1.8l-2.5 1.4-2.7-2.3z"/>',
    appstore: '<path class="li-fill" d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6s1.8-.8 3.3-.8 2 .8 3.4.8 2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/>',
    site: '<g class="li-line"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></g>',
    landing: '<g class="li-line"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18M7 13h6M7 16.5h10"/></g>',
    instagram: '<g class="li-line"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle class="li-fill" cx="17.2" cy="6.8" r="1.1"/>',
    linkedin: '<path class="li-fill" d="M5 3.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM3.2 9.3H7v11.2H3.2zm6.1 0h3.6v1.6h.1c.5-.9 1.7-1.9 3.6-1.9 3.8 0 4.5 2.5 4.5 5.8v5.7h-3.8v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.1H9.3z"/>',
  };
  const linkType = (a) => {
    if (a.dataset.type) return a.dataset.type;
    const h = a.getAttribute('href') || '', t = a.textContent.trim().toLowerCase();
    if (/t\.me\//.test(h)) return 'telegram';
    if (/instagram\.com/.test(h)) return 'instagram';
    if (/linkedin\.com/.test(h)) return 'linkedin';
    if (/play\.google\.com/.test(h)) return 'playmarket';
    if (/apps\.apple\.com/.test(h)) return 'appstore';
    return t === 'landing' ? 'landing' : 'site';
  };
  function iconize(root = document) {
    root.querySelectorAll('.work-link, .person-link').forEach((a) => {
      if (a.querySelector('.li')) return;
      a.querySelectorAll('svg').forEach((s) => s.remove());
      a.insertAdjacentHTML('afterbegin', `<svg class="li" viewBox="0 0 24 24" aria-hidden="true">${ICONS[linkType(a)] || ICONS.site}</svg>`);
    });
  }
  iconize();

  // Bannerlar: muqova bannerning o‘z proporsiyasini oladi — rasm to‘liq, kesilmasdan
  function fitBanners(root = document) {
    root.querySelectorAll('.cover.banner:not(.fit)').forEach((c) => {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(c.style.backgroundImage || '');
      if (!m) return;
      const im = new Image();
      im.onload = () => { c.style.aspectRatio = `${im.naturalWidth} / ${im.naturalHeight}`; c.classList.add('fit'); if (typeof sizeWorks === 'function') { sizeWorks(); measure(); } };
      im.src = m[1];
    });
  }
  fitBanners();

  function projectCard(p, i, all) {
    const links = (p.links || []).filter((l) => safeUrl(l.url));
    const num = `${String(i + 1).padStart(2, '0')}<span>/${String(all.length).padStart(2, '0')}</span>`;
    const foot = links.length
      ? `<div class="work-links">${links.map((l) => `<a class="work-link" data-type="${esc(l.type)}" href="${esc(l.url)}"${OUT}>${esc(LINK_LABELS[l.type] || 'Havola')}</a>`).join('')}</div>`
      : '';
    return `<article class="work">
      <div class="cover${/^assets\/img\//.test(p.image || '') ? '' : ' banner'}" data-img="${esc(p.image)}" data-pos="${esc(p.pos)}"><span class="cover-num">${num}</span>${p.status ? `<span class="work-status">${esc(p.status)}</span>` : ''}</div>
      <div class="work-body">
        ${p.kind ? `<p class="work-kind">${esc(p.kind)}</p>` : ''}
        <h3 class="work-title">${esc(p.name)}</h3>
        ${p.desc ? `<p class="work-desc">${esc(p.desc)}</p>` : ''}
        ${p.features?.length ? `<ul class="work-feats">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      </div>
      ${foot}
    </article>`;
  }
  function memberCard(t) {
    const stats = t.stats?.length ? `<dl class="person-stats">${t.stats.map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join('')}</dl>` : '';
    const skills = t.skills?.length ? `<ul class="person-skills">${t.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
    const now = t.now ? `<p class="person-now"><span class="mono">Hozir</span>${esc(t.now)}</p>` : '';
    const links = (t.links || []).filter((l) => safeUrl(l.url));
    const linkHtml = links.length ? `<div class="person-links">${links.map((l) => `<a class="person-link" href="${esc(l.url)}"${l.url.startsWith('#') ? '' : OUT}>${esc(l.label)}</a>`).join('')}</div>` : '';
    return `<article class="person sheet">
      <div class="person-photo" data-photo="${esc(t.photo)}" role="img" aria-label="${esc(t.name)}"><span class="person-initials" aria-hidden="true">${esc(t.initials)}</span></div>
      <div class="person-body">
        <p class="person-role mono">${esc(t.role)}</p>
        <h3>${esc(t.name)}</h3>
        ${t.bio ? `<p class="person-bio">${esc(t.bio)}</p>` : ''}
        ${stats}${skills}${now}${linkHtml}
      </div>
    </article>`;
  }
  function applyContent(data) {
    if (Array.isArray(data.projects)) {
      const next = track.querySelector('.work-next');
      track.querySelectorAll('.work:not(.work-next)').forEach((n) => n.remove());
      next.insertAdjacentHTML('beforebegin', data.projects.map(projectCard).join(''));
      track.querySelectorAll('.cover[data-img]').forEach((c) => {
        c.style.backgroundImage = `url("${c.dataset.img}")`;
        if (!c.classList.contains('banner')) c.style.backgroundPosition = c.dataset.pos;
      });
    }
    if (Array.isArray(data.team)) {
      $('#teamGrid').innerHTML = data.team.map(memberCard).join('');
      loadTeamPhotos();
    }
    iconize();
    fitBanners();
    sizeWorks(); measure();
  }
  if (location.protocol.startsWith('http')) {
    fetch('/api/content', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then((d) => d && applyContent(d))
      .catch(() => { /* server yo‘q — statik kontent qoladi */ });
  }

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
    if (!reduceMotion) { fogOff1 += .18 + wind * .12; fogOff2 += .32 + wind * .2; skyOff += .05 + wind * .04; rainT += .004 + wind * .003; }
    pmx += (mx - pmx) * .035; pmy += (my - pmy) * .035;

    updatePhotos(time);
    ctx.clearRect(0, 0, W, H);
    drawRays(time);
    drawFlare();
    drawSky();
    drawFog();
    drawVeil();
    updateParticles();
    drawParticles(time);
    updateLum();
    updateSplashes();
    drawSplashes();
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
