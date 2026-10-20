/* StudyMind — core.js
 * أدوات أساسية: DOM آمن، أيقونات، تخزين مشفّر، واجهة الخادم، معالجة الصور.
 * لا يستخدم eval ولا innerHTML. كل النصوص تُعرض عبر textContent.
 */
'use strict';

/* ───────────── إعدادات قابلة للتعديل ───────────── */
const CONFIG = {
  // ضع رابط الخادم هنا (أو من الإعدادات داخل التطبيق). مثال: 'https://api.example.com'
  BACKEND_URL: '',
  // رابط التطبيق للمشاركة (اتركه فارغًا ليُستخدم رابط الصفحة الحالية)
  SHARE_URL: '',
  APP_NAME: 'StudyMind',
  VERSION: '1.0.0',
  MAX_IMAGE_SIDE: 1600,
  JPEG_QUALITY: 0.82,
  MAX_PAGES: 60,
  SEC_PER_PAGE_GUESS: 4
};

/* ───────────── DOM ───────────── */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function safeUrl(u) {
  try {
    const x = new URL(String(u), location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(x.protocol) ? x.href : '#';
  } catch (e) { return '#'; }
}

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) { if (typeof v === 'function') el.addEventListener(k.slice(2), v); }
      else if (k === 'href') {
        el.setAttribute('href', safeUrl(v));
        if (/^https?:/i.test(el.getAttribute('href')) && new URL(el.href).origin !== location.origin) {
          el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank');
        }
      }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  appendKids(el, kids);
  return el;
}
function appendKids(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) appendKids(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function mount(el, ...kids) { clear(el); appendKids(el, kids); return el; }

/* ───────────── أيقونات (SVG مبني بالـ DOM) ───────────── */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  upload: 'M12 16V4|M8 8l4-4 4 4|M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z|c12,13,3.5',
  book: 'M4 19.5V5a2 2 0 0 1 2-2h14v14H6.5A2.5 2.5 0 0 0 4 19.5z|M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  layers: 'M12 2 3 7l9 5 9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5',
  chart: 'M5 21V11|M12 21V4|M19 21v-7',
  sliders: 'M4 6h10|M18 6h2|M4 12h4|M12 12h8|M4 18h12|M20 18h0|c16,6,2|c10,12,2|c18,18,2',
  user: 'c12,8,4|M4 21a8 8 0 0 1 16 0',
  sun: 'c12,12,4|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  search: 'c11,11,7|M21 21l-4.3-4.3',
  trash: 'M3 6h18|M8 6V4h8v2|M6 6l1 14h10l1-14|M10 11v6|M14 11v6',
  up: 'M12 19V5|M5 12l7-7 7 7',
  down: 'M12 5v14|M19 12l-7 7-7-7',
  x: 'M18 6 6 18|M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  share: 'c18,5,3|c6,12,3|c18,19,3|M8.6 13.5l6.8 4|M15.4 6.5l-6.8 4',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 4v16|M16 4v16',
  stop: 'M6 6h12v12H6z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z|M5 11a7 7 0 0 0 14 0|M12 18v3',
  volume: 'M4 9v6h4l5 4V5L8 9z|M16 9a4 4 0 0 1 0 6|M18.5 6.5a8 8 0 0 1 0 11',
  send: 'M22 2 11 13|M22 2l-7 20-4-9-9-4z',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z|M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cards: 'M3 8h13v12H3z|M8 8V4h13v12h-5',
  help: 'c12,12,9|M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7|M12 17h.01',
  refresh: 'M21 12a9 9 0 1 1-3-6.7|M21 4v5h-5',
  download: 'M12 4v12|M7 11l5 5 5-5|M4 20h16',
  globe: 'c12,12,9|M3 12h18|M12 3a14 14 0 0 1 0 18|M12 3a14 14 0 0 0 0 18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  wifioff: 'M2 2l20 20|M8.5 16.4a5 5 0 0 1 7 0|M5 12.9a10 10 0 0 1 5-2.7|M19 12.9a10 10 0 0 0-2.6-2.2|M12 20h.01',
  plus: 'M12 5v14|M5 12h14',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  menu: 'M4 6h16|M4 12h16|M4 18h16',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h6',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1|M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  copy: 'M9 9h11v11H9z|M5 15V5h10',
  logout: 'M9 21H5V3h4|M16 17l5-5-5-5|M21 12H9',
  lock: 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4',
  info: 'c12,12,9|M12 11v6|M12 7.5h.01',
  image: 'M3 5h18v14H3z|c8.5,10,1.5|M21 16l-5-5L5 19',
  alert: 'M12 3 2 20h20z|M12 10v4|M12 17h.01',
  clock: 'c12,12,9|M12 7v5l3 2',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  target: 'c12,12,9|c12,12,5|c12,12,1',
  list: 'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',
  pen: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  mail: 'M3 5h18v14H3z|M3 7l9 6 9-6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|c12,12,3',
  eyeoff: 'M3 3l18 18|M10.6 6.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9|M6.5 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9',
  dot: 'c12,12,2'
};
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(name, size) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 22); svg.setAttribute('height', size || 22);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false'); svg.setAttribute('class', 'ico');
  const def = ICONS[name] || ICONS.dot;
  for (const part of def.split('|')) {
    if (part[0] === 'c') {
      const [cx, cy, r] = part.slice(1).split(',');
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      svg.appendChild(c);
    } else {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', part); svg.appendChild(p);
    }
  }
  return svg;
}

/* ───────────── أدوات عامة ───────────── */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function sanitizeText(s, max) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮]/g, '');
  return s.slice(0, max || 20000);
}
function dayKey(d) { const x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return sec + ' ' + t('u.sec');
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + ' ' + t('u.min') + (s ? ' ' + s + ' ' + t('u.sec') : '');
  return Math.floor(m / 60) + ' ' + t('u.hour') + ' ' + (m % 60) + ' ' + t('u.min');
}
function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString(Prefs.get('lang') === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch (e) { return dayKey(ts); }
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ───────────── تفضيلات (localStorage) ───────────── */
const Prefs = {
  defaults: { theme: 'system', lang: 'ar', fontScale: 1, speechRate: 1, backendUrl: '', intro: true, level: 'standard', summaryLen: 'standard', reduceMotion: false },
  data: null,
  load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem('sm_prefs') || '{}') || {}; } catch (e) { d = {}; }
    this.data = Object.assign({}, this.defaults, d);
    if (!this.data.backendUrl && CONFIG.BACKEND_URL) this.data.backendUrl = CONFIG.BACKEND_URL;
    return this;
  },
  get(k) { if (!this.data) this.load(); return this.data[k]; },
  set(k, v) { if (!this.data) this.load(); this.data[k] = v; try { localStorage.setItem('sm_prefs', JSON.stringify(this.data)); } catch (e) { /* ممنوع التخزين */ } }
};
Prefs.load();

/* ───────────── خزنة مشفّرة (IndexedDB + AES-GCM) ───────────── */
const Vault = {
  db: null, key: null, plain: false,
  _tx(mode) { return this.db.transaction('kv', mode).objectStore('kv'); },
  _get(k) { return new Promise((res, rej) => { const r = this._tx('readonly').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  _put(k, v) { return new Promise((res, rej) => { const r = this._tx('readwrite').put(v, k); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  _del(k) { return new Promise((res, rej) => { const r = this._tx('readwrite').delete(k); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  async open() {
    if (this.db || this.plain) return;
    try {
      if (!window.indexedDB || !(window.crypto && crypto.subtle)) throw new Error('nosupport');
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('studymind', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      let k = await this._get('devkey');
      if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await this._put('devkey', k); }
      this.key = k;
    } catch (e) { this.plain = true; this.db = null; }
  },
  async save(name, obj) {
    await this.open();
    if (this.plain) { try { localStorage.setItem('sm_v_' + name, JSON.stringify(obj)); } catch (e) { /* ممتلئ */ } return; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(obj)));
    await this._put(name, { iv, ct });
  },
  async load(name) {
    await this.open();
    if (this.plain) { try { return JSON.parse(localStorage.getItem('sm_v_' + name)); } catch (e) { return null; } }
    const rec = await this._get(name);
    if (!rec) return null;
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, this.key, rec.ct);
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return null; }
  },
  async remove(name) { await this.open(); if (this.plain) { localStorage.removeItem('sm_v_' + name); return; } await this._del(name); },
  async wipe() {
    await this.open();
    if (this.plain) { Object.keys(localStorage).filter(k => k.startsWith('sm_v_')).forEach(k => localStorage.removeItem(k)); return; }
    await this._del('state'); await this._del('auth');
  }
};

/* ───────────── حالة التطبيق ───────────── */
function defaultState() {
  return {
    version: 1, updatedAt: Date.now(),
    profile: { name: '', email: '' },
    lessons: [], srs: {}, chats: {}, deleted: {},
    stats: { pages: 0, quizzes: [], studyMs: 0, days: [], reviews: 0 }
  };
}
const Store = {
  state: null, auth: null, _subs: [], saving: null,
  async init() {
    await Vault.open();
    this.state = await Vault.load('state') || defaultState();
    this.auth = await Vault.load('auth');
    const d = defaultState();
    for (const k of Object.keys(d)) if (!(k in this.state)) this.state[k] = d[k];
    for (const k of Object.keys(d.stats)) if (!(k in this.state.stats)) this.state.stats[k] = d.stats[k];
  },
  onChange(fn) { this._subs.push(fn); },
  touch(opts) {
    this.state.updatedAt = Date.now();
    this._persist();
    if (!opts || !opts.silent) this._subs.forEach(f => { try { f(); } catch (e) { /* تجاهل */ } });
    if (this.auth && Prefs.get('backendUrl') && !(opts && opts.nosync)) { try { localStorage.setItem('sm_dirty', '1'); } catch (e) { /* */ } this._syncSoon(); }
  },
  _persist: debounce(function () { Vault.save('state', Store.state).catch(() => { }); }, 350),
  _syncSoon: debounce(function () { Cloud.sync().catch(() => { }); }, 1200),
  async setAuth(a) { this.auth = a; if (a) await Vault.save('auth', a); else await Vault.remove('auth'); },
  markStudyDay() { const k = dayKey(); if (!this.state.stats.days.includes(k)) this.state.stats.days.push(k); },
  streak() {
    const days = new Set(this.state.stats.days); let n = 0; const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
  lesson(id) { return this.state.lessons.find(l => l.id === id); }
};

/* ───────────── الاتصال بالخادم ───────────── */
class ApiError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
const API = {
  base() { return String(Prefs.get('backendUrl') || '').trim().replace(/\/+$/, ''); },
  enabled() { return !!this.base(); },
  validate(u) {
    try {
      const x = new URL(u);
      if (x.protocol === 'https:') return true;
      if (x.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(x.hostname)) return true;
    } catch (e) { /* غير صالح */ }
    return false;
  },
  async req(path, opt) {
    opt = opt || {};
    if (!this.enabled()) throw new ApiError('no_backend');
    if (!this.validate(this.base())) throw new ApiError('bad_url');
    if (!navigator.onLine) throw new ApiError('offline');
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), opt.timeout || 90000);
    if (opt.signal) opt.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    const headers = { 'Accept': 'application/json' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    if (Store.auth && Store.auth.token) headers['Authorization'] = 'Bearer ' + Store.auth.token;
    let res;
    try {
      res = await fetch(this.base() + path, {
        method: opt.method || (opt.body ? 'POST' : 'GET'), headers,
        body: opt.body ? JSON.stringify(opt.body) : undefined,
        signal: ctrl.signal, credentials: 'omit', mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer'
      });
    } catch (e) {
      clearTimeout(to);
      if (opt.signal && opt.signal.aborted) throw new ApiError('aborted');
      throw new ApiError(ctrl.signal.aborted ? 'timeout' : 'network');
    }
    clearTimeout(to);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const code = res.status === 401 ? 'unauthorized' : res.status === 429 ? 'rate' : res.status === 413 ? 'too_large' : 'server';
      throw new ApiError(code, data && data.error ? sanitizeText(data.error, 200) : code);
    }
    return data || {};
  }
};
function errMsg(e) {
  const c = e && e.code;
  if (c === 'unauthorized' && !Store.auth) return t('err.login');
  const map = ['no_backend', 'bad_url', 'offline', 'timeout', 'network', 'unauthorized', 'rate', 'too_large', 'server', 'aborted'];
  return t('err.' + (map.includes(c) ? c : 'generic'));
}

/* ───────────── مزامنة السحابة (الحساب هو المرجع الأساسي) ───────────── */
const Cloud = {
  status: 'idle', lastSync: 0, busy: null, onStatus: null, onMerged: null,
  _ui() { if (this.onStatus) { try { this.onStatus(); } catch (e) { /* */ } } },
  isDirty() { try { return localStorage.getItem('sm_dirty') === '1'; } catch (e) { return false; } },
  // يجلب نسخة الحساب، يدمجها، ثم يرفع النتيجة. آمن للاستخدام من عدة أجهزة.
  sync() {
    if (!Store.auth || !API.enabled()) return Promise.resolve(false);
    if (this.busy) return this.busy;
    this.busy = (async () => {
      this.status = 'syncing'; this._ui();
      try {
        const r = await API.req('/api/sync', { timeout: 30000 });
        let changed = false;
        if (r && r.data && typeof r.data === 'object') changed = this.merge(r.data);
        await API.req('/api/sync', { method: 'PUT', body: { data: Store.state, updatedAt: Store.state.updatedAt }, timeout: 45000 });
        try { localStorage.removeItem('sm_dirty'); } catch (e) { /* */ }
        this.status = 'ok'; this.lastSync = Date.now();
        if (changed && this.onMerged) { try { this.onMerged(); } catch (e) { /* */ } }
        return true;
      } catch (e) { this.status = 'error'; throw e; }
      finally { this.busy = null; this._ui(); }
    })();
    return this.busy;
  },
  push() { return this.sync(); },
  pull() { return this.sync(); },
  merge(remote) {
    const s = Store.state; let changed = false;
    const del = Object.assign({}, remote.deleted || {});
    for (const k of Object.keys(s.deleted || {})) del[k] = Math.max(del[k] || 0, s.deleted[k]);
    const byId = new Map(s.lessons.map(l => [l.id, l]));
    for (const rl of (remote.lessons || [])) {
      if (!rl || typeof rl.id !== 'string' || !rl.pack) continue;
      if (del[rl.id] && del[rl.id] >= (rl.updatedAt || 0)) continue;
      const cur = byId.get(rl.id);
      if (!cur || (rl.updatedAt || 0) > (cur.updatedAt || 0)) { byId.set(rl.id, rl); changed = true; }
    }
    for (const [id, l] of Array.from(byId)) if (del[id] && del[id] >= (l.updatedAt || 0)) { byId.delete(id); changed = true; delete s.srs[id]; for (const k of Object.keys(s.srs)) if (k.startsWith(id + ':')) delete s.srs[k]; delete s.chats[id]; }
    const cut = Date.now() - 90 * 864e5; for (const k of Object.keys(del)) if (del[k] < cut) delete del[k];
    s.deleted = del;
    s.lessons = Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const k of Object.keys(remote.srs || {})) {
      const a = s.srs[k], b = remote.srs[k];
      if (b && (!a || (b.at || 0) > (a.at || 0))) { s.srs[k] = b; changed = true; }
    }
    for (const k of Object.keys(remote.chats || {})) { const a = s.chats[k], b = remote.chats[k]; if (Array.isArray(b) && (!a || b.length > a.length)) s.chats[k] = b; }
    const rs = remote.stats || {};
    s.stats.pages = Math.max(s.stats.pages, rs.pages || 0);
    s.stats.studyMs = Math.max(s.stats.studyMs, rs.studyMs || 0);
    s.stats.reviews = Math.max(s.stats.reviews || 0, rs.reviews || 0);
    s.stats.days = Array.from(new Set([...(s.stats.days || []), ...(rs.days || [])]));
    const seen = new Set(s.stats.quizzes.map(q => q.at));
    for (const q of (rs.quizzes || [])) if (q && !seen.has(q.at)) { s.stats.quizzes.push(q); changed = true; }
    if (!s.profile.name && remote.profile) s.profile.name = sanitizeText(remote.profile.name, 60);
    Store.touch({ nosync: true });
    return changed;
  }
};

/* ───────────── Markdown آمن → DOM ───────────── */
function inlineMd(text) {
  const frag = document.createDocumentFragment();
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0, m;
  text = String(text);
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith('**')) frag.appendChild(h('strong', null, tok.slice(2, -2)));
    else if (tok.startsWith('`')) frag.appendChild(h('code', null, tok.slice(1, -1)));
    else frag.appendChild(h('em', null, tok.slice(1, -1)));
    last = m.index + tok.length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}
function renderMd(src) {
  const root = h('div', { class: 'md' });
  const lines = sanitizeText(src, 60000).split('\n');
  let list = null, listType = null, para = [];
  const flushPara = () => { if (para.length) { root.appendChild(h('p', null, inlineMd(para.join(' ')))); para = []; } };
  const flushList = () => { list = null; listType = null; };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); root.appendChild(h('h' + (m[1].length + 2), null, inlineMd(m[2]))); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ul') { list = h('ul'); listType = 'ul'; root.appendChild(list); }
      list.appendChild(h('li', null, inlineMd(m[1]))); continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ol') { list = h('ol'); listType = 'ol'; root.appendChild(list); }
      list.appendChild(h('li', null, inlineMd(m[1]))); continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); root.appendChild(h('blockquote', null, inlineMd(m[1]))); continue; }
    flushList(); para.push(line.trim());
  }
  flushPara();
  return root;
}

/* ───────────── إشعارات ونوافذ ───────────── */
function toast(msg, kind) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(box); }
  const el = h('div', { class: 'toast ' + (kind || '') }, msg);
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 350); }, 3600);
}
function openModal(opt) {
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'modal-back' });
  const close = () => { document.removeEventListener('keydown', onKey); back.classList.remove('in'); setTimeout(() => back.remove(), 220); if (prevFocus && prevFocus.focus) prevFocus.focus(); if (opt.onClose) opt.onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const actions = (opt.actions || []).map(a => h('button', { class: 'btn ' + (a.kind || ''), type: 'button', onclick: () => { const r = a.onClick ? a.onClick(close) : undefined; if (r !== false && !a.keepOpen) close(); } }, a.label));
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.title || '' },
    h('div', { class: 'modal-head' }, h('h3', null, opt.title || ''), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('u.close'), onclick: close }, icon('x', 20))),
    h('div', { class: 'modal-body' }, opt.body || null),
    actions.length ? h('div', { class: 'modal-actions' }, actions) : null);
  back.appendChild(box);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  document.body.appendChild(back);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { back.classList.add('in'); const f = $('input,textarea,button.btn', box); if (f) f.focus(); });
  return { close, box };
}
function confirmBox(title, text, okLabel, danger) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, body: h('p', null, text),
      onClose: () => { if (!done) res(false); },
      actions: [
        { label: t('u.cancel'), kind: 'ghost' },
        { label: okLabel || t('u.ok'), kind: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } }
      ]
    });
  });
}

/* ───────────── معالجة الصور (ضغط + بصمة + وضوح) ───────────── */
async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* احتياطي */ }
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif|gif|bmp)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name)) throw new Error('type');
  if (file.size > 25 * 1024 * 1024) throw new Error('size');
  const bmp = await loadBitmap(file);
  const w0 = bmp.width, h0 = bmp.height;
  const sc = Math.min(1, CONFIG.MAX_IMAGE_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * sc)), hh = Math.max(1, Math.round(h0 * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, hh); cx.drawImage(bmp, 0, 0, w, hh);
  if (bmp.close) bmp.close();
  const dataUrl = cv.toDataURL('image/jpeg', CONFIG.JPEG_QUALITY);
  // بصمة 8x8 + قياس الحدّة
  const s = document.createElement('canvas'); s.width = 64; s.height = 64;
  const sx = s.getContext('2d', { willReadFrequently: true }); sx.drawImage(cv, 0, 0, 64, 64);
  const px = sx.getImageData(0, 0, 64, 64).data; const g = new Float32Array(64 * 64);
  for (let i = 0; i < 4096; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const sm = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let a = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) a += g[(y * 8 + j) * 64 + x * 8 + i]; sm[y * 8 + x] = a / 64; }
  const mean = sm.reduce((a, b) => a + b, 0) / 64; let hash = ''; for (let i = 0; i < 64; i++) hash += sm[i] > mean ? '1' : '0';
  let lap = 0, n = 0;
  for (let y = 1; y < 63; y++) for (let x = 1; x < 63; x++) { const v = 4 * g[y * 64 + x] - g[y * 64 + x - 1] - g[y * 64 + x + 1] - g[(y - 1) * 64 + x] - g[(y + 1) * 64 + x]; lap += v * v; n++; }
  const sharp = lap / n;
  return { id: uid(), dataUrl, w, h: hh, hash, sharp, bytes: Math.round(dataUrl.length * 0.75), name: sanitizeText(file.name, 80) };
}
function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
