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
    veil:    [.1, 0, .02, .06],     // havodagi namlik pardasi
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

  function updatePhotos(time) {
    imgs.forEach((im, k) => { im.style.opacity = B.w[k].toFixed(3); });
    // Kamera: skroll bilan asta yaqinlashib, yuqoriga ko‘tariladi; sichqoncha bilan biroz suriladi
    const asc = st.raw / 3;
    const breathe = reduceMotion ? 0 : Math.sin(time * .00015) * .006;
    const s = 1.06 + asc * .08 + breathe;
    const tx = -pmx * 14, ty = asc * 3.5 - pmy * 8;
    photos.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}%, 0) scale(${s.toFixed(4)})`;
  }

  /* ================= Ob-havo qatlami ================= */
  const canvas = $('#world');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, density = 1, wind = .5;

  // Tuman teksturasi: bir marta yaratiladigan shovqin, keyin suzib yuradi
  const fogTex = document.createElement('canvas');
  (function makeFog() {
    const w = 512, h = 160;
    fogTex.width = w; fogTex.height = h;
    const g = fogTex.getContext('2d');
    const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const r = seeded(4242);
    // Yumshoq dog‘lar — uzluksiz tuman bulutlari
    for (let n = 0; n < 220; n++) {
      const x = r() * w, y = h * (.25 + r() * .6), rad = 20 + r() * 60;
      for (const dx of [-w, 0, w]) {          // chetlari ulanadigan (tile) bo‘lsin
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
    // ikki qatlam turli tezlikda — hajmli tuman taassuroti
    for (const [off, y, a, sc] of [[fogOff1, H * .48, 1, 1], [fogOff2, H * .6, .8, 1.35]]) {
      const w2 = tw * sc, h2 = th * sc;
      const x0 = -((off % w2) + w2) % w2;
      ctx.globalAlpha = N.fog * a;
      for (let x = x0; x < W; x += w2) ctx.drawImage(fogTex, x, y - h2 / 2, w2, h2);
    }
    ctx.restore();
    // pastki qismdagi bir tekis tuman
    const g = ctx.createLinearGradient(0, H * .45, 0, H);
    g.addColorStop(0, rgba(C.fog, 0));
    g.addColorStop(.5, rgba(C.fog, N.fog * .22));
    g.addColorStop(1, rgba(C.fog, N.fog * .1));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * .45, W, H * .55);
  }

  function drawRays(time) {
    if (N.rays < .01) return;
    // Quyosh chap yuqoridan — kuz suratidagi yorug‘lik yo‘nalishiga mos
    const ox = -W * .05, oy = H * .32;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 6; k++) {
      const ang = -.12 + k * .075 + Math.sin(time * .0002 + k) * .01;
      const len = W * 1.2, spread = .018 + (k % 3) * .008;
      const a = N.rays * (.05 + .04 * Math.sin(time * .0006 + k * 1.7));
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      g.addColorStop(0, rgba(C.light, a));
      g.addColorStop(1, rgba(C.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
      ctx.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
      ctx.closePath(); ctx.fill();
    }
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, W * .6);
    glow.addColorStop(0, rgba(C.light, N.rays * .35));
    glow.addColorStop(1, rgba(C.light, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- zarrachalar ---------- */
  // z — chuqurlik: 0 uzoq (kichik, xira), 1 kameraga yaqin (katta, fokusdan tashqari)
  const TYPES = {
    rain:  { max: 420, w: [1, 0, 0, 0],    rate: 14 },
    petal: { max: 26,  w: [.8, .05, 0, 0], rate: 1 },
    bird:  { max: 4,   w: [.3, 1, .4, 0],  rate: .01 },
    mote:  { max: 50,  w: [0, 1, .45, 0],  rate: 1 },
    leaf:  { max: 46,  w: [0, 0, 1, 0],    rate: 1 },
    snow:  { max: 520, w: [0, 0, 0, 1],    rate: 14 },
  };
  const LEAF = ['#d9822b', '#b84a1c', '#e2a93a', '#9c3415', '#c86a24', '#8a5a1e'].map(hex);
  const BURST = ['petal', 'mote', 'leaf', 'snow'];
  let parts = [];

  function spawn(type, x, y, burst) {
    const z = type === 'snow' || type === 'rain' ? Math.pow(Math.random(), 2.2) : Math.random();
    const p = { type, z, a: 0, dying: false, bx: 0, by: 0, ph: Math.random() * 6.28 };
    switch (type) {
      case 'rain':  p.x = rand(-W * .3, W * 1.05); p.y = rand(-H * .4, -10); p.vy = 16 + z * 22; p.len = 14 + z * 50; p.a = 1; break;
      case 'petal': p.x = rand(-80, W); p.y = rand(-40, -10); p.vx = rand(.2, .9); p.vy = .5 + z * 1.3; p.size = 2.5 + z * z * 9; p.rot = rand(0, 6.28); p.vr = rand(-.05, .05); p.col = Math.random() < .6 ? [250, 222, 230] : [255, 246, 248]; break;
      case 'mote':  p.x = rand(0, W); p.y = rand(H * .15, H * .95); p.vy = rand(-.25, -.05); p.r = .6 + z * 2.2; p.life = 0; p.max = rand(300, 600); break;
      case 'bird': {
        const left = Math.random() < .5;
        p.x = left ? -20 : W + 20; p.y = rand(H * .1, H * .32);
        p.vx = (left ? 1 : -1) * rand(.6, 1.1); p.size = rand(2.2, 3.6);
        p.flock = 2 + ((Math.random() * 4) | 0);
        p.a = 1;
        break;
      }
      case 'leaf':  p.x = rand(-W * .5, W); p.y = -30; p.vx = rand(.4, 1.2); p.vy = .8 + z * 1.8; p.size = 4 + z * z * 16; p.rot = rand(0, 6.28); p.vr = rand(-.05, .05); p.flip = rand(.02, .06); p.col = LEAF[(Math.random() * LEAF.length) | 0]; break;
      case 'snow':  p.x = rand(-W * .2, W * 1.2); p.y = rand(-60, -5); p.r = .7 + z * z * 7; p.vy = .35 + z * 1.6; break;
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

    const next = [];
    for (const p of parts) {
      p.ph += .03;
      p.x += p.bx; p.y += p.by; p.bx *= .93; p.by *= .93;
      const par = .4 + p.z;   // yaqin zarracha tezroq siljiydi (parallaks)
      switch (p.type) {
        case 'rain':  p.vx = wind * (2 + p.z * 3) + .6; p.x += p.vx; p.y += p.vy; break;
        case 'petal': p.x += (p.vx + wind * .9 + Math.sin(p.ph) * .8) * par; p.y += p.vy; p.rot += p.vr; break;
        case 'mote':  p.x += Math.sin(p.ph * .6) * .25 + wind * .2 * par; p.y += p.vy; p.life++; break;
        case 'bird':  p.x += p.vx; p.y += Math.sin(p.ph * .3) * .12; break;
        case 'leaf':  p.x += (p.vx + wind * 1.2 + Math.sin(p.ph * .7) * 1.3) * par; p.y += p.vy + Math.cos(p.ph * 1.5) * .35; p.rot += p.vr + Math.sin(p.ph) * .015; p.ph += p.flip; break;
        case 'snow':  p.x += (Math.sin(p.ph * .45 + p.z * 4) * .5 + wind * .55) * par; p.y += p.vy; break;
      }
      if (p.dying) p.a -= .025;
      else if (p.a < 1) p.a = Math.min(1, p.a + .03);
      if (p.max) { p.fade = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1)); if (p.life >= p.max) continue; }
      const out = p.y > H + 60 || p.y < -H * .6 || p.x < -W * .6 - 80 || p.x > W * 1.6 + 80 ||
        (p.type === 'bird' && (p.x < -60 || p.x > W + 60));
      if (out || p.a <= 0) continue;
      next.push(p);
    }
    parts = next;
  }

  function drawParticles(time) {
    ctx.lineCap = 'round';
    for (const p of parts) {
      const a = p.a * (p.fade ?? 1);
      switch (p.type) {
        case 'rain': {
          // uzoq tomchilar ingichka va xira, yaqinlari uzun, yarim shaffof, harakatda xiralashgan
          const dx = p.vx / p.vy * p.len;
          const g = ctx.createLinearGradient(p.x, p.y, p.x - dx, p.y - p.len);
          const al = a * (.12 + p.z * .22);
          g.addColorStop(0, `rgba(228,236,244,${al})`);
          g.addColorStop(1, 'rgba(228,236,244,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = .6 + p.z * 1.8;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - p.len); ctx.stroke();
          break;
        }
        case 'petal': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, .35 + Math.abs(Math.sin(p.ph * 1.6)) * .65);
          const s = p.size;
          if (p.z > .7) {
            // fokusdan tashqari — yumshoq qirra
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
            g.addColorStop(0, rgba(p.col, a * .8)); g.addColorStop(1, rgba(p.col, 0));
            ctx.fillStyle = g;
          } else ctx.fillStyle = rgba(p.col, a * (.55 + p.z * .4));
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * .7, 0, 0, 6.283); ctx.fill();
          ctx.restore();
          break;
        }
        case 'mote': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, `rgba(255,246,214,${a * .75})`);
          g.addColorStop(1, 'rgba(255,246,214,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, 6.283); ctx.fill();
          break;
        }
        case 'bird':
          ctx.strokeStyle = `rgba(25,28,32,${.7 * a})`;
          ctx.lineWidth = 1.1;
          for (let k = 0; k < p.flock; k++) {
            const s = p.size * (1 - k * .08), bx = p.x - Math.sign(p.vx) * k * 14, by = p.y + (k % 2 ? 6 : -4) * Math.ceil(k / 2);
            const f = Math.sin(time * .016 + p.ph * 10 + k * 1.3) * s * .7;
            ctx.beginPath();
            ctx.moveTo(bx - s, by - f);
            ctx.quadraticCurveTo(bx - s * .4, by - s * .25, bx, by);
            ctx.quadraticCurveTo(bx + s * .4, by - s * .25, bx + s, by - f);
            ctx.stroke();
          }
          break;
        case 'leaf': {
          const s = p.size;
          const flip = Math.cos(p.ph * 2);                 // barg aylanayotgandek — eni o‘zgaradi
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .15 + Math.abs(flip) * .85);
          const lit = flip > 0 ? 1 : .7;                    // orqa tomoni qoraroq
          const col = p.col.map((c) => c * lit);
          const al = a * (p.z > .75 ? .75 : .95);
          ctx.fillStyle = rgba(col, al);
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.bezierCurveTo(-s * .5, -s * .75, s * .5, -s * .65, s, 0);
          ctx.bezierCurveTo(s * .5, s * .65, -s * .5, s * .75, -s, 0);
          ctx.fill();
          ctx.strokeStyle = rgba(col.map((c) => c * .6), al * .7); ctx.lineWidth = Math.max(.5, s * .06);
          ctx.beginPath(); ctx.moveTo(-s * 1.25, 0); ctx.lineTo(s * .9, 0); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'snow':
          if (p.r > 3) {
            // kameraga yaqin qor parchasi — bokeh
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, `rgba(255,255,255,${a * .55})`);
            g.addColorStop(.6, `rgba(255,255,255,${a * .25})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
          } else ctx.fillStyle = `rgba(255,255,255,${a * (.45 + p.z * .5)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          break;
      }
    }
  }

  function drawVeil() {
    if (N.veil < .01) return;
    ctx.fillStyle = `rgba(200,210,220,${N.veil})`;
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

    wind = N.wind * (1 + Math.sin(time * .0004) * .35 + Math.sin(time * .0013) * .15);
    if (!reduceMotion) { fogOff1 += .18 + wind * .12; fogOff2 += .32 + wind * .2; }
    pmx += (mx - pmx) * .035; pmy += (my - pmy) * .035;

    updatePhotos(time);
    ctx.clearRect(0, 0, W, H);
    drawRays(time);
    drawFog();
    drawVeil();
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
  st.raw = s0.raw; st.blend = s0.blend;
  computeBlend();
  requestAnimationFrame(frame);
})();
