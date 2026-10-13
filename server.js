/* Yuksalish.dev — landing + admin panel serveri.
 * Tashqi kutubxonasiz (Node.js 18+). Ma’lumotlar: data/db.json (birinchi ishga tushishda db.seed.json’dan yaratiladi).
 *
 *   ADMIN_PASSWORD=... node server.js        → http://localhost:3000  (admin: /admin)
 *
 * Muhit o‘zgaruvchilari:
 *   ADMIN_PASSWORD  — admin panel paroli (majburiy; bo‘lmasa admin panelga kirib bo‘lmaydi)
 *   SESSION_SECRET  — sessiya imzosi uchun kalit (berilmasa har ishga tushishda yangisi yaratiladi)
 *   PORT            — port (standart 3000)
 *   COOKIE_SECURE=1 — sayt HTTPS orqali ishlasa cookie’ni Secure qilish
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const SEED_FILE = path.join(ROOT, 'data', 'db.seed.json');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
const SESSION_TTL = 12 * 60 * 60 * 1000;          // 12 soat

if (!PASSWORD) console.warn('[!] ADMIN_PASSWORD o‘rnatilmagan — admin panelga kirish o‘chirilgan.');

/* ================= Ma’lumotlar bazasi (JSON fayl) ================= */
function loadDb() {
  if (!fs.existsSync(DB_FILE)) fs.copyFileSync(SEED_FILE, DB_FILE);
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.projects ||= []; db.team ||= [];
  // eski format (url/urlLabel) → links
  for (const p of db.projects) {
    if (!Array.isArray(p.links)) p.links = p.url ? [{ type: /t\.me\//.test(p.url) ? 'telegram' : 'site', url: p.url }] : [];
    delete p.url; delete p.urlLabel;
  }
  return db;
}
let db = loadDb();
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);                     // yarim yozilgan fayl qolmasin
}
const newId = (p) => p + crypto.randomBytes(5).toString('hex');

/* ================= Tekshiruv (validatsiya) ================= */
class BadRequest extends Error {}
const str = (v, max, required) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new BadRequest('Majburiy maydon to‘ldirilmagan');
  if (s.length > max) throw new BadRequest(`Matn juda uzun (ko‘pi bilan ${max} belgi)`);
  return s;
};
const url = (v) => {
  const s = str(v, 300);
  if (!s) return '';
  if (/^https?:\/\/[^\s"'<>]+$/i.test(s) || /^#[\w-]*$/.test(s)) return s;
  throw new BadRequest('Havola http:// yoki https:// bilan boshlanishi kerak');
};
const IMAGE_RE = /^assets\/(img|team|uploads)\/[\w.-]+\.(jpe?g|png|webp)$/i;
const image = (v) => {
  const s = str(v, 200);
  if (!s) return '';
  if (!IMAGE_RE.test(s)) throw new BadRequest('Rasm manzili noto‘g‘ri');
  return s;
};
const pos = (v) => (typeof v === 'string' && /^\d{1,3}% \d{1,3}%$/.test(v.trim()) ? v.trim() : '50% 50%');
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

const LINK_TYPES = ['site', 'telegram', 'playmarket', 'appstore', 'landing'];
function cleanProject(b) {
  const name = str(b.name, 80, true);
  return {
    name,
    word: str(b.word, 24) || name.split(/\s+/)[0],
    kind: str(b.kind, 60),
    desc: str(b.desc, 400),
    status: str(b.status, 40),
    links: list(b.links, 6)
      .map((l) => ({ type: LINK_TYPES.includes(l && l.type) ? l.type : 'site', url: url(l && l.url) }))
      .filter((l) => l.url),
    image: image(b.image) || 'assets/img/yoz.jpg',
    pos: pos(b.pos),
    active: b.active !== false,
  };
}
function cleanMember(b) {
  const name = str(b.name, 80, true);
  return {
    name,
    initials: str(b.initials, 4) || name.split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase(),
    role: str(b.role, 100),
    bio: str(b.bio, 600),
    stats: list(b.stats, 3).map((s) => ({ value: str(s && s.value, 12), label: str(s && s.label, 40) })).filter((s) => s.value),
    skills: list(b.skills, 14).map((s) => str(s, 32)).filter(Boolean),
    now: str(b.now, 160),
    links: list(b.links, 6).map((l) => ({ label: str(l && l.label, 30), url: url(l && l.url) })).filter((l) => l.label && l.url),
    photo: image(b.photo),
    active: b.active !== false,
  };
}

/* ================= Sessiya ================= */
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeToken() {
  const exp = String(Date.now() + SESSION_TTL);
  return `${exp}.${sign(exp)}`;
}
function validToken(t) {
  if (!t) return false;
  const [exp, mac] = t.split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sign(exp)), b = Buffer.from(mac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]));
const isAdmin = (req) => validToken(cookies(req).ys_admin);
function setSession(res, token, maxAge) {
  res.setHeader('Set-Cookie', `ys_admin=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${COOKIE_SECURE ? '; Secure' : ''}`);
}
function passwordOk(input) {
  if (!PASSWORD || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
// Parolni taxmin qilishdan himoya: 10 ta xato urinishdan keyin 15 daqiqa bloklash
const fails = new Map();
const ip = (req) => req.socket.remoteAddress || '';
function locked(req) {
  const f = fails.get(ip(req));
  return f && f.n >= 10 && Date.now() - f.t < 15 * 60 * 1000;
}
function noteFail(req) {
  const f = fails.get(ip(req)) || { n: 0, t: 0 };
  if (Date.now() - f.t > 15 * 60 * 1000) f.n = 0;
  f.n++; f.t = Date.now();
  fails.set(ip(req), f);
}

/* ================= Yordamchilar ================= */
function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}
function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return reject(new BadRequest('JSON kutilgan'));
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new BadRequest('So‘rov juda katta')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new BadRequest('JSON noto‘g‘ri')); }
    });
    req.on('error', reject);
  });
}

/* ================= Statik fayllar ================= */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};
function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (pathname === '/admin/') pathname = '/admin/index.html';
  // faqat ochiq papkalar: landing, assets/, admin/ (data/, server.js va boshqalar yopiq)
  if (!/^\/(index\.html|assets\/[\w./-]+|admin\/[\w.-]+)$/.test(pathname) || pathname.includes('..')) return send(res, 404, 'Topilmadi');
  const file = path.join(ROOT, pathname);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Topilmadi');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache',
      ...(pathname.startsWith('/admin/') ? { 'X-Frame-Options': 'DENY' } : {}),
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ================= Rasm yuklash ================= */
const MAGIC = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
];
function saveUpload(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new BadRequest('Faqat JPG, PNG yoki WEBP rasm');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw new BadRequest('Rasm 4 MB dan katta bo‘lmasin');
  const kind = MAGIC.find((k) => k.test(buf));
  if (!kind) throw new BadRequest('Fayl rasm emas');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${kind.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `assets/uploads/${name}`;
}

/* ================= API ================= */
const COLLECTIONS = { projects: { clean: cleanProject, prefix: 'p' }, team: { clean: cleanMember, prefix: 't' } };
const publicView = () => ({
  projects: db.projects.filter((p) => p.active),
  team: db.team.filter((t) => t.active),
});

async function api(req, res, pathname) {
  const m = req.method;

  if (pathname === '/api/content' && m === 'GET') return send(res, 200, publicView(), { 'Cache-Control': 'no-cache' });

  if (pathname === '/api/login' && m === 'POST') {
    if (locked(req)) return send(res, 429, { error: 'Juda ko‘p urinish. 15 daqiqadan keyin qayta urining.' });
    const body = await readJson(req, 2048);
    if (!PASSWORD) return send(res, 503, { error: 'Serverda ADMIN_PASSWORD o‘rnatilmagan' });
    if (!passwordOk(body.password)) { noteFail(req); return send(res, 401, { error: 'Parol noto‘g‘ri' }); }
    fails.delete(ip(req));
    setSession(res, makeToken(), SESSION_TTL / 1000);
    return send(res, 200, { ok: true });
  }
  if (pathname === '/api/logout' && m === 'POST') { setSession(res, '', 0); return send(res, 200, { ok: true }); }

  if (!pathname.startsWith('/api/admin/')) return send(res, 404, { error: 'Topilmadi' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Kirish talab qilinadi' });

  if (pathname === '/api/admin/me' && m === 'GET') return send(res, 200, { ok: true });
  if (pathname === '/api/admin/all' && m === 'GET') return send(res, 200, db);

  if (pathname === '/api/admin/upload' && m === 'POST') {
    const body = await readJson(req, 6 * 1024 * 1024);
    return send(res, 200, { url: saveUpload(body.data) });
  }

  const r = /^\/api\/admin\/(projects|team)(?:\/([\w-]+))?(?:\/(reorder))?$/.exec(pathname);
  if (!r) return send(res, 404, { error: 'Topilmadi' });
  const [, coll, id, action] = r;
  const C = COLLECTIONS[coll];
  const items = db[coll];

  if (!id && m === 'POST') {
    const item = { id: newId(C.prefix), ...C.clean(await readJson(req, 64 * 1024)) };
    items.push(item); saveDb();
    return send(res, 201, item);
  }
  if (id === 'reorder' && m === 'POST') {
    const { ids } = await readJson(req, 64 * 1024);
    if (!Array.isArray(ids) || ids.length !== items.length || !ids.every((x) => items.some((i) => i.id === x))) throw new BadRequest('Tartib noto‘g‘ri');
    db[coll] = ids.map((x) => items.find((i) => i.id === x)); saveDb();
    return send(res, 200, { ok: true });
  }
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return send(res, 404, { error: 'Topilmadi' });
  if (m === 'PUT') {
    items[idx] = { id, ...C.clean(await readJson(req, 64 * 1024)) }; saveDb();
    return send(res, 200, items[idx]);
  }
  if (m === 'PATCH') {                                // faqat faol / nofaol
    const body = await readJson(req, 1024);
    items[idx].active = Boolean(body.active); saveDb();
    return send(res, 200, items[idx]);
  }
  if (m === 'DELETE') {
    items.splice(idx, 1); saveDb();
    return send(res, 200, { ok: true });
  }
  void action;
  return send(res, 405, { error: 'Ruxsat etilmagan' });
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname.startsWith('/api/')) return await api(req, res, pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Ruxsat etilmagan');
    serveStatic(req, res, decodeURIComponent(pathname));
  } catch (e) {
    if (e instanceof BadRequest) return send(res, 400, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Server xatosi' });
  }
}).listen(PORT, () => console.log(`Yuksalish.dev: http://localhost:${PORT}  ·  admin: http://localhost:${PORT}/admin`));
