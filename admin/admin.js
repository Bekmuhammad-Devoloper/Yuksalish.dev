/* Yuksalish.dev admin panel: loyihalar va jamoa a’zolarini boshqarish */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asset = (p) => (!p ? '' : /^(data:|blob:|https?:)/.test(p) ? p : '../' + p);
  const SEASON_IMAGES = ['assets/img/bahor.jpg', 'assets/img/yoz.jpg', 'assets/img/kuz.jpg', 'assets/img/qish.jpg'];

  let db = { projects: [], team: [] };
  let tab = 'projects';
  let editing = null;          // tahrirlanayotgan element (yoki null — yangi)

  /* ---------- API ---------- */
  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Sessiya tugadi, qayta kiring'); }
    if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
    return data;
  }

  let toastTimer;
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Kirish ---------- */
  function showLogin() { $('#appView').hidden = true; $('#loginView').hidden = false; $('#loginPassword').focus(); }
  async function showApp() {
    db = await call('GET', '/api/admin/all');
    $('#loginView').hidden = true; $('#appView').hidden = false;
    render();
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; $('#loginError').textContent = '';
    try {
      await call('POST', '/api/login', { password: $('#loginPassword').value });
      $('#loginPassword').value = '';
      await showApp();
    } catch (err) { $('#loginError').textContent = err.message; }
    btn.disabled = false;
  });
  $('#logoutBtn').addEventListener('click', async () => { await call('POST', '/api/logout').catch(() => {}); showLogin(); });

  /* ---------- Ro‘yxat ---------- */
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('#searchInput').value = '';
    render();
  }));
  $('#searchInput').addEventListener('input', render);

  function render() {
    $('#countProjects').textContent = db.projects.length;
    $('#countTeam').textContent = db.team.length;
    const isP = tab === 'projects';
    $('#listTitle').textContent = isP ? 'Loyihalar' : 'Jamoa';
    $('#listHint').textContent = isP
      ? `Faol loyihalar saytdagi galereyada shu tartibda ko‘rinadi · ${db.projects.filter((p) => p.active).length} ta faol`
      : `Faol xodimlar “Jamoa” bo‘limida shu tartibda ko‘rinadi · ${db.team.filter((t) => t.active).length} ta faol`;
    $('#addBtn').textContent = isP ? '+ Loyiha qo‘shish' : '+ Xodim qo‘shish';

    const q = $('#searchInput').value.trim().toLowerCase();
    const items = db[tab];
    const shown = items.filter((i) => !q || JSON.stringify(i).toLowerCase().includes(q));
    $('#emptyState').hidden = shown.length > 0;
    $('#rows').innerHTML = shown.map((it) => {
      const i = items.indexOf(it);
      const thumb = isP
        ? `<div class="thumb" style="background-image:url('${esc(asset(it.image))}');background-position:${esc(it.pos)}"></div>`
        : `<div class="thumb" style="${it.photo ? `background-image:url('${esc(asset(it.photo))}')` : ''}">${it.photo ? '' : esc(it.initials)}</div>`;
      const sub = isP
        ? [it.kind, (it.links || []).map((l) => (LINK_TYPES.find(([v]) => v === l.type) || [])[1]).filter(Boolean).join(', ')].filter(Boolean).join(' · ')
        : it.role;
      const extra = isP && it.status ? `<span class="pill gold">${esc(it.status)}</span>` : '';
      return `<li class="row ${isP ? '' : 'row-team'} ${it.active ? '' : 'off'}" data-id="${esc(it.id)}">
        ${thumb}
        <div class="row-main">
          <div class="row-title">${esc(it.name)} ${extra}</div>
          <div class="row-sub">${esc(sub) || '&nbsp;'}</div>
        </div>
        <label class="switch-row" title="Saytda ko‘rinishi">
          <input type="checkbox" data-act="toggle" ${it.active ? 'checked' : ''}><span class="switch"></span>
          <span class="switch-label">${it.active ? 'Faol' : 'Nofaol'}</span>
        </label>
        <div class="row-actions">
          <button class="icon-btn" data-act="up" title="Yuqoriga" aria-label="Yuqoriga" ${i === 0 || q ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-act="down" title="Pastga" aria-label="Pastga" ${i === items.length - 1 || q ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-act="edit" title="Tahrirlash" aria-label="Tahrirlash">✎</button>
          <button class="icon-btn danger" data-act="delete" title="O‘chirish" aria-label="O‘chirish">🗑</button>
        </div>
      </li>`;
    }).join('');
  }

  $('#rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.dataset.act === 'toggle') return;
    const id = btn.closest('.row').dataset.id;
    const items = db[tab];
    const idx = items.findIndex((x) => x.id === id);
    const act = btn.dataset.act;
    try {
      if (act === 'edit') openEditor(items[idx]);
      if (act === 'delete') {
        $('#confirmText').textContent = `“${items[idx].name}” butunlay o‘chiriladi. Faqat yashirish uchun “Faol” tugmasini o‘chiring.`;
        const dlg = $('#confirmDialog');
        dlg.returnValue = '';
        dlg.showModal();
        dlg.addEventListener('close', async function onClose() {
          dlg.removeEventListener('close', onClose);
          if (dlg.returnValue !== 'ok') return;
          try {
            await call('DELETE', `/api/admin/${tab}/${id}`);
            db[tab] = db[tab].filter((x) => x.id !== id);
            render(); toast('O‘chirildi');
          } catch (err) { toast(err.message, true); }
        });
      }
      if (act === 'up' || act === 'down') {
        const j = act === 'up' ? idx - 1 : idx + 1;
        const order = items.slice();
        [order[idx], order[j]] = [order[j], order[idx]];
        await call('POST', `/api/admin/${tab}/reorder`, { ids: order.map((x) => x.id) });
        db[tab] = order; render();
      }
    } catch (err) { toast(err.message, true); }
  });

  $('#rows').addEventListener('change', async (e) => {
    if (e.target.dataset.act !== 'toggle') return;
    const id = e.target.closest('.row').dataset.id;
    const item = db[tab].find((x) => x.id === id);
    try {
      const upd = await call('PATCH', `/api/admin/${tab}/${id}`, { active: e.target.checked });
      item.active = upd.active; render();
      toast(upd.active ? 'Saytda ko‘rinadi' : 'Saytdan yashirildi');
    } catch (err) { e.target.checked = !e.target.checked; toast(err.message, true); }
  });

  /* ---------- Tahrirlash oynasi ---------- */
  const field = (id, label, value, opts = {}) => {
    const full = opts.full ? ' full' : '';
    const hint = opts.hint ? ` <small>${esc(opts.hint)}</small>` : '';
    const ctl = opts.area
      ? `<textarea id="${id}" maxlength="${opts.max || 400}" rows="${opts.rows || 3}">${esc(value)}</textarea>`
      : `<input id="${id}" value="${esc(value)}" maxlength="${opts.max || 120}" ${opts.required ? 'required' : ''} placeholder="${esc(opts.ph || '')}">`;
    return `<label class="field${full}"><span>${esc(label)}${opts.required ? ' *' : ''}${hint}</span>${ctl}</label>`;
  };
  const pairRows = (rows, a, b) => rows.map((r) => `<div class="pair"><input value="${esc(r[0])}" placeholder="${a}" maxlength="40"><input value="${esc(r[1])}" placeholder="${b}" maxlength="300"><button type="button" class="icon-btn danger" data-del-pair aria-label="O‘chirish">×</button></div>`).join('');

  const LINK_TYPES = [['site', 'Sayt'], ['telegram', 'Telegram bot'], ['playmarket', 'Google Play'], ['appstore', 'App Store'], ['landing', 'Landing']];
  const LINK_PH = { site: 'https://…', telegram: 'https://t.me/…', playmarket: 'https://play.google.com/store/apps/details?id=…', appstore: 'https://apps.apple.com/…', landing: 'https://…' };
  const linkRow = (l = { type: 'site', url: '' }) => `<div class="pair pair-link">
    <select aria-label="Havola turi">${LINK_TYPES.map(([v, t]) => `<option value="${v}" ${l.type === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <input value="${esc(l.url)}" placeholder="${LINK_PH[l.type] || 'https://…'}" maxlength="300" inputmode="url">
    <button type="button" class="icon-btn danger" data-del-pair aria-label="O‘chirish">×</button></div>`;

  function openEditor(item) {
    editing = item || null;
    const isP = tab === 'projects';
    const it = item || (isP ? { image: 'assets/img/yoz.jpg', pos: '50% 50%', active: true } : { active: true, stats: [], skills: [], links: [] });
    $('#editTitle').textContent = (item ? 'Tahrirlash: ' : '') + (isP ? (item ? item.name : 'Yangi loyiha') : (item ? item.name : 'Yangi xodim'));
    $('#f-active').checked = it.active !== false;
    $('#editError').textContent = '';

    if (isP) {
      $('#editFields').innerHTML = `
        ${field('f-name', 'Loyiha nomi', it.name, { required: true, max: 80, ph: 'Masalan: Bilimdon AI' })}
        ${field('f-word', 'Muqovadagi so‘z', it.word, { max: 24, hint: 'bo‘sh bo‘lsa — nomning birinchi so‘zi' })}
        ${field('f-kind', 'Turi', it.kind, { max: 60, ph: 'Veb-sayt, Telegram bot, Ilova…' })}
        ${field('f-status', 'Holat belgisi', it.status, { max: 40, ph: 'Masalan: Ishlab chiqilmoqda' })}
        ${field('f-desc', 'Qisqa tavsif', it.desc, { area: true, full: true, max: 400 })}
        <div class="field full"><span>Havolalar <small>sayt, Telegram bot, Google Play, App Store, landing — ko‘pi bilan 6 ta</small></span>
          <div class="pairs" id="projLinks">${(it.links || []).map(linkRow).join('')}</div>
          <button type="button" class="add-line" id="addProjLink">+ havola qo‘shish</button>
        </div>
        <div class="field full"><span>Muqova rasmi</span>
          <div class="img-pick">
            <div class="img-preview" id="imgPreview"></div>
            <div class="img-options">${SEASON_IMAGES.map((s) => `<button type="button" class="img-opt" data-img="${s}" style="background-image:url('${asset(s)}')" aria-label="${s.split('/').pop()}"></button>`).join('')}</div>
            <label class="btn btn-ghost upload-btn">Rasm yuklash<input type="file" accept="image/jpeg,image/png,image/webp" id="f-file"></label>
          </div>
        </div>
        ${field('f-pos', 'Rasm fokus nuqtasi', it.pos, { max: 12, hint: 'gorizontal% vertikal%, masalan 50% 50%' })}`;
    } else {
      $('#editFields').innerHTML = `
        ${field('f-name', 'Ism familiya', it.name, { required: true, max: 80 })}
        ${field('f-role', 'Lavozim', it.role, { max: 100, ph: 'Masalan: Asoschi va CEO' })}
        ${field('f-initials', 'Bosh harflar', it.initials, { max: 4, hint: 'rasm bo‘lmasa ko‘rinadi' })}
        ${field('f-now', '“Hozir” qatori', it.now, { max: 160 })}
        ${field('f-bio', 'Tavsif', it.bio, { area: true, full: true, max: 600, rows: 4 })}
        ${field('f-skills', 'Ko‘nikmalar', (it.skills || []).join(', '), { full: true, max: 500, hint: 'vergul bilan ajrating' })}
        <div class="field full"><span>Ko‘rsatkichlar <small>ko‘pi bilan 3 ta, masalan “100%” — “NestJS baholash”</small></span>
          <div class="pairs" id="statsPairs">${pairRows((it.stats || []).map((s) => [s.value, s.label]), 'Qiymat', 'Izoh')}</div>
          <button type="button" class="add-line" data-add-pair="statsPairs" data-a="Qiymat" data-b="Izoh" data-max="3">+ ko‘rsatkich</button>
        </div>
        <div class="field full"><span>Havolalar <small>masalan “Telegram” — https://t.me/…</small></span>
          <div class="pairs" id="linkPairs">${pairRows((it.links || []).map((l) => [l.label, l.url]), 'Nomi', 'https://…')}</div>
          <button type="button" class="add-line" data-add-pair="linkPairs" data-a="Nomi" data-b="https://…" data-max="6">+ havola</button>
        </div>
        <div class="field full"><span>Rasm <small>portret, 4:5</small></span>
          <div class="img-pick">
            <div class="img-preview tall" id="imgPreview"></div>
            <label class="btn btn-ghost upload-btn">Rasm yuklash<input type="file" accept="image/jpeg,image/png,image/webp" id="f-file"></label>
            <button type="button" class="btn btn-ghost" id="removePhoto">Rasmni olib tashlash</button>
          </div>
        </div>`;
    }
    setImage(isP ? it.image : it.photo, isP ? it.pos : null);
    $('#editDialog').showModal();
    $('#f-name').focus();
  }

  let currentImage = '';
  function setImage(path) {
    currentImage = path || '';
    const pv = $('#imgPreview');
    pv.style.backgroundImage = currentImage ? `url('${asset(currentImage)}')` : '';
    if ($('#f-pos')) pv.style.backgroundPosition = $('#f-pos').value || '50% 50%';
    document.querySelectorAll('.img-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.img === currentImage)));
  }

  $('#editFields').addEventListener('click', (e) => {
    const opt = e.target.closest('.img-opt');
    if (opt) setImage(opt.dataset.img);
    if (e.target.id === 'removePhoto') setImage('');
    if (e.target.matches('[data-del-pair]')) e.target.closest('.pair').remove();
    if (e.target.id === 'addProjLink') {
      const box = $('#projLinks');
      if (box.children.length >= 6) return toast('Ko‘pi bilan 6 ta havola', true);
      box.insertAdjacentHTML('beforeend', linkRow());
      box.lastElementChild.querySelector('input').focus();
    }
    const add = e.target.closest('[data-add-pair]');
    if (add) {
      const box = $('#' + add.dataset.addPair);
      if (box.children.length >= Number(add.dataset.max)) return toast(`Ko‘pi bilan ${add.dataset.max} ta`, true);
      box.insertAdjacentHTML('beforeend', pairRows([['', '']], add.dataset.a, add.dataset.b));
      box.lastElementChild.querySelector('input').focus();
    }
  });
  $('#editFields').addEventListener('input', (e) => { if (e.target.id === 'f-pos') setImage(currentImage); });
  $('#editFields').addEventListener('change', (e) => {
    if (e.target.matches('.pair-link select')) e.target.nextElementSibling.placeholder = LINK_PH[e.target.value];
  });
  $('#editFields').addEventListener('change', async (e) => {
    if (e.target.id !== 'f-file' || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 4 * 1024 * 1024) { toast('Rasm 4 MB dan katta bo‘lmasin', true); return; }
    const data = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(file); });
    try {
      const { url } = await call('POST', '/api/admin/upload', { data });
      setImage(url); toast('Rasm yuklandi');
    } catch (err) { toast(err.message, true); }
    e.target.value = '';
  });

  document.querySelectorAll('#editDialog [data-close]').forEach((b) => b.addEventListener('click', () => $('#editDialog').close()));

  const val = (id) => ($(id) ? $(id).value.trim() : '');
  const pairs = (id) => [...$('#' + id).children].map((p) => [...p.querySelectorAll('input')].map((i) => i.value.trim())).filter(([a, b]) => a || b);

  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isP = tab === 'projects';
    if (!val('#f-name')) { $('#editError').textContent = 'Nomini kiriting'; $('#f-name').focus(); return; }
    const body = isP
      ? { name: val('#f-name'), word: val('#f-word'), kind: val('#f-kind'), status: val('#f-status'), desc: val('#f-desc'),
          links: [...$('#projLinks').children].map((r) => ({ type: r.querySelector('select').value, url: r.querySelector('input').value.trim() })).filter((l) => l.url),
          image: currentImage, pos: val('#f-pos'), active: $('#f-active').checked }
      : { name: val('#f-name'), role: val('#f-role'), initials: val('#f-initials'), now: val('#f-now'), bio: val('#f-bio'),
          skills: val('#f-skills').split(',').map((s) => s.trim()).filter(Boolean),
          stats: pairs('statsPairs').map(([value, label]) => ({ value, label })),
          links: pairs('linkPairs').map(([label, url]) => ({ label, url })),
          photo: currentImage, active: $('#f-active').checked };
    const btn = $('#saveBtn'); btn.disabled = true; $('#editError').textContent = '';
    try {
      if (editing) {
        const upd = await call('PUT', `/api/admin/${tab}/${editing.id}`, body);
        db[tab][db[tab].findIndex((x) => x.id === editing.id)] = upd;
      } else {
        db[tab].push(await call('POST', `/api/admin/${tab}`, body));
      }
      $('#editDialog').close(); render(); toast('Saqlandi');
    } catch (err) { $('#editError').textContent = err.message; }
    btn.disabled = false;
  });

  $('#addBtn').addEventListener('click', () => openEditor(null));

  /* ---------- Boshlash ---------- */
  call('GET', '/api/admin/me').then(showApp).catch(() => showLogin());
})();
