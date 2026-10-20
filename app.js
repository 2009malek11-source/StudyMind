/* StudyMind — app.js
 * الإقلاع، التخطيط، التوجيه، الرئيسية، المكتبة، التقدّم، الإعدادات، الحسابات، المشاركة، التثبيت.
 */
'use strict';

const Track = {
  t0: null,
  start() { if (this.t0 == null && !document.hidden) this.t0 = Date.now(); },
  stop() {
    if (this.t0 == null) return;
    const ms = Math.min(Date.now() - this.t0, 30 * 60 * 1000); this.t0 = null;
    if (ms > 3000) { Store.state.stats.studyMs += ms; Store.markStudyDay(); Store.touch({ silent: true }); }
  }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) Track.stop(); else if (App.studying) Track.start(); });
window.addEventListener('pagehide', () => Track.stop());

const App = { studying: false, deferredInstall: null, swReg: null };

/* ───────────── المظهر واللغة ───────────── */
function resolvedTheme() {
  const p = Prefs.get('theme');
  if (p === 'light' || p === 'dark') return p;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyPrefs() {
  const root = document.documentElement, lang = Prefs.get('lang') === 'en' ? 'en' : 'ar';
  root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const th = resolvedTheme(); root.dataset.theme = th;
  root.style.setProperty('--fs', String(clamp(Number(Prefs.get('fontScale')) || 1, 0.85, 1.4)));
  root.classList.toggle('reduce-motion', !!Prefs.get('reduceMotion'));
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', th === 'dark' ? '#0b1226' : '#f4f8ff');
  document.title = CONFIG.APP_NAME + ' — ' + t('app.tagline');
}
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => { if (Prefs.get('theme') === 'system') { applyPrefs(); syncThemeToggle(); } };
  if (mq.addEventListener) mq.addEventListener('change', onMq);
}

/* ───────────── المقدمة (Intro) ───────────── */
function initIntro() {
  const el = $('#intro'); if (!el) return;
  let seen = false; try { seen = sessionStorage.getItem('sm_intro') === '1'; } catch (e) { /* */ }
  const reduced = Prefs.get('reduceMotion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!Prefs.get('intro') || seen) { el.remove(); document.body.classList.remove('intro-on'); return; }
  document.body.classList.add('intro-on');
  try { sessionStorage.setItem('sm_intro', '1'); } catch (e) { /* */ }
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; el.classList.add('out');
    setTimeout(() => { el.remove(); document.body.classList.remove('intro-on'); }, 520);
  };
  el.addEventListener('click', close);
  el.addEventListener('keydown', close);
  setTimeout(close, reduced ? 900 : 2900);
}

/* ───────────── التخطيط ───────────── */
const NAV = [
  { id: 'home', icon: 'home', key: 'nav.home', hash: '#/home' },
  { id: 'library', icon: 'layers', key: 'nav.library', hash: '#/library' },
  { id: 'study', icon: 'plus', key: 'nav.study', hash: '#/study', main: true },
  { id: 'progress', icon: 'chart', key: 'nav.progress', hash: '#/progress' },
  { id: 'settings', icon: 'sliders', key: 'nav.settings', hash: '#/settings' }
];
let sideCollapsed = false; try { sideCollapsed = localStorage.getItem('sm_side') === '1'; } catch (e) { /* */ }

function dayNightToggle() {
  const b = h('button', { class: 'dn', type: 'button', role: 'switch', id: 'dn-toggle', 'aria-label': t('set.theme.toggle'), 'aria-checked': resolvedTheme() === 'dark' ? 'true' : 'false',
    onclick: () => { const nxt = resolvedTheme() === 'dark' ? 'light' : 'dark'; Prefs.set('theme', nxt); applyPrefs(); syncThemeToggle(); } },
    h('span', { class: 'dn-sky' }, h('i', { class: 'dn-star s1' }), h('i', { class: 'dn-star s2' }), h('i', { class: 'dn-star s3' }), h('i', { class: 'dn-cloud c1' }), h('i', { class: 'dn-cloud c2' })),
    h('span', { class: 'dn-knob' }));
  return b;
}
function syncThemeToggle() { const b = $('#dn-toggle'); if (b) b.setAttribute('aria-checked', resolvedTheme() === 'dark' ? 'true' : 'false'); const s = $('#set-theme-seg'); if (s) { /* يُعاد رسم الإعدادات عند الحاجة */ } }

function brandMark(small) {
  return h('a', { class: 'brand', href: '#/home', 'aria-label': CONFIG.APP_NAME },
    h('img', { class: 'brand-img light-only', src: 'logo-mark.png', alt: '', width: small ? 34 : 40, height: small ? 34 : 40 }),
    h('img', { class: 'brand-img dark-only', src: 'logo-mark-dark.png', alt: '', width: small ? 34 : 40, height: small ? 34 : 40 }),
    h('span', { class: 'brand-t' }, h('span', { class: 'b1' }, 'Study'), h('span', { class: 'b2' }, 'Mind')));
}

function buildLayout() {
  const app = $('#app'); clear(app);
  const side = h('aside', { class: 'side' + (sideCollapsed ? ' collapsed' : ''), id: 'side', 'aria-label': t('nav.main') },
    h('div', { class: 'side-head' }, brandMark(),
      h('button', { class: 'icon-btn side-toggle', type: 'button', 'aria-label': t('nav.collapse'), onclick: () => { sideCollapsed = !sideCollapsed; side.classList.toggle('collapsed', sideCollapsed); try { localStorage.setItem('sm_side', sideCollapsed ? '1' : '0'); } catch (e) { /* */ } } }, icon('menu', 20))),
    h('label', { class: 'side-search' }, icon('search', 18), h('input', { type: 'search', class: 'side-search-in', placeholder: t('lib.search'), 'aria-label': t('lib.search'), onkeydown: e => { if (e.key === 'Enter') { Prefs.set('q', e.target.value); go('#/library'); } } })),
    h('nav', { class: 'side-nav' },
      NAV.map(n => h('a', { class: 'side-item', href: n.hash, dataset: { id: n.id }, title: t(n.key) }, icon(n.icon, 20), h('span', null, t(n.key)))),
      h('a', { class: 'side-item', href: '#/review', dataset: { id: 'review' }, title: t('nav.review') }, icon('cards', 20), h('span', null, t('nav.review')))),
    h('div', { class: 'side-foot' },
      h('button', { class: 'side-item', type: 'button', onclick: openShare, title: t('u.share') }, icon('share', 20), h('span', null, t('u.share'))),
      h('button', { class: 'side-item', type: 'button', id: 'side-acct', onclick: openAccount, title: t('acct.title') }, icon('user', 20), h('span', { id: 'side-acct-t' }, accountLabel()))));
  const top = h('header', { class: 'top' }, h('div', { class: 'top-brand' }, brandMark(true)), h('div', { class: 'top-sp' }), h('span', { class: 'cloud-dot', id: 'cloud-dot', title: '' }), dayNightToggle(),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('acct.title'), onclick: openAccount }, icon('user', 22)));
  const offline = h('div', { class: 'offline-bar hidden', id: 'offline-bar', role: 'status' }, icon('wifioff', 16), t('net.offline'));
  const main = h('div', { class: 'main' }, top, offline, h('main', { id: 'view', tabindex: '-1' }));
  const nav = h('nav', { class: 'liquid-nav', id: 'bottom-nav', 'aria-label': t('nav.main') },
    h('span', { class: 'liquid-glare' }),
    NAV.map(n => h('a', { class: 'ln-item' + (n.main ? ' main' : ''), href: n.hash, dataset: { id: n.id }, 'aria-label': t(n.key) }, icon(n.icon, n.main ? 24 : 21), h('span', null, t(n.key)))));
  app.appendChild(side); app.appendChild(main); app.appendChild(nav);
  syncOffline(); syncCloudDot();
}
function accountLabel() { return Store.auth && Store.auth.user ? (Store.auth.user.name || Store.auth.user.email) : (Store.state.profile.name || t('acct.guest')); }
function syncAccountUi() { const el = $('#side-acct-t'); if (el) el.textContent = accountLabel(); syncCloudDot(); }
function syncCloudDot() {
  const d = $('#cloud-dot'); if (!d) return;
  const on = !!(Store.auth && API.enabled());
  d.classList.toggle('hidden', !on); d.dataset.s = Cloud.status;
  d.title = t('cloud.' + Cloud.status);
}
function syncOffline() { const b = $('#offline-bar'); if (b) b.classList.toggle('hidden', navigator.onLine); }
window.addEventListener('online', () => { syncOffline(); if (Store.auth) Cloud.sync().catch(() => { }); });
window.addEventListener('offline', syncOffline);

/* ───────────── التوجيه ───────────── */
function route() {
  const view = $('#view'); if (!view) return;
  Speech.stop();
  const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const page = parts[0] || 'home';
  const studying = page === 'lesson' || page === 'review';
  App.studying = studying; if (studying) Track.start(); else Track.stop();
  const navId = ['home', 'library', 'study', 'progress', 'settings', 'review'].includes(page) ? page : page === 'lesson' ? 'library' : 'home';
  $$('[data-id]').forEach(a => { const on = a.dataset.id === navId; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  switch (page) {
    case 'study': viewStudy(view); break;
    case 'library': viewLibrary(view); break;
    case 'progress': viewProgress(view); break;
    case 'settings': viewSettings(view, parts[1]); break;
    case 'review': viewReview(view); break;
    case 'lesson': viewLesson(view, parts[1], parts[2]); break;
    default: viewHome(view);
  }
  if (page !== 'settings' || !parts[1]) window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

/* ───────────── الرئيسية ───────────── */
function lessonCard(l) {
  const qs = Store.state.stats.quizzes.filter(q => q.lessonId === l.id);
  const best = qs.length ? Math.max(...qs.map(q => Math.round(q.score / q.total * 100))) : null;
  return h('a', { class: 'lesson-card', href: '#/lesson/' + l.id },
    h('div', { class: 'lc-ic' }, icon('book', 22)),
    h('div', { class: 'grow' }, h('strong', { class: 'lc-t', dir: 'auto' }, l.title),
      h('div', { class: 'muted sm' }, fmtDate(l.createdAt), ' · ', t('lesson.pages', { n: l.pageCount }))),
    best != null ? h('span', { class: 'badge ' + (best >= 80 ? 'ok' : best >= 50 ? 'info' : 'warn') }, best + '%') : null,
    icon(document.documentElement.dir === 'rtl' ? 'chevL' : 'chevR', 18));
}
function statTile(ic, val, label, cls) { return h('div', { class: 'tile ' + (cls || '') }, h('div', { class: 'tile-ic' }, icon(ic, 20)), h('strong', null, val), h('span', { class: 'muted sm' }, label)); }
function avgScore() { const q = Store.state.stats.quizzes; if (!q.length) return null; return Math.round(q.reduce((a, x) => a + x.score / x.total, 0) / q.length * 100); }

function viewHome(root) {
  const S = Store.state, last = S.lessons[0];
  const name = Store.auth && Store.auth.user ? Store.auth.user.name : S.profile.name;
  const dueCount = S.lessons.reduce((n, l) => n + deckOf(l).filter(c => isDue(c.key)).length, 0);
  const tools = [
    ['sparkles', t('home.t.explain'), last ? '#/lesson/' + last.id + '/explain' : '#/study'],
    ['list', t('home.t.summary'), last ? '#/lesson/' + last.id + '/summary' : '#/study'],
    ['cards', t('home.t.cards'), '#/review'],
    ['help', t('home.t.quiz'), last ? '#/lesson/' + last.id + '/quiz' : '#/study'],
    ['mic', t('home.t.tutor'), last ? '#/lesson/' + last.id + '/tutor' : '#/study']
  ];
  mount(root, h('section', { class: 'page' },
    h('div', { class: 'hero' },
      h('div', { class: 'hero-t' }, h('p', { class: 'muted' }, name ? t('home.hello', { name }) : t('home.hello0')), h('h1', null, t('home.title')), h('p', null, t('home.sub'))),
      h('div', { class: 'row wrap gap' },
        h('a', { class: 'btn primary lg', href: '#/study' }, icon('upload', 20), t('home.upload')),
        last ? h('a', { class: 'btn lg', href: '#/lesson/' + last.id }, icon('book', 20), t('home.continue')) : h('button', { class: 'btn lg', type: 'button', onclick: () => { const l = createDemoLesson(); go('#/lesson/' + l.id); } }, icon('sparkles', 20), t('study.demo')))),
    !Store.auth ? h('div', { class: 'notice' }, icon('cloud', 20), h('div', null, h('strong', null, t('home.guest.t')), ' ', t('home.guest.b')), h('button', { class: 'btn sm primary', type: 'button', onclick: openAccount }, t(API.enabled() ? 'acct.register' : 'home.guest.go'))) : null,
    dueCount ? h('a', { class: 'notice ok-n', href: '#/review' }, icon('cards', 20), h('div', null, h('strong', null, t('home.due', { n: dueCount })), ' ', t('home.due.sub')), icon(document.documentElement.dir === 'rtl' ? 'chevL' : 'chevR', 18)) : null,
    h('div', { class: 'tiles' },
      statTile('flame', Store.streak(), t('home.streak'), 'warm'), statTile('file', S.stats.pages, t('home.pages')),
      statTile('target', avgScore() == null ? '—' : avgScore() + '%', t('home.avg')), statTile('book', S.lessons.length, t('home.lessons'))),
    h('div', null, h('h2', { class: 'sec-t' }, t('home.tools')), h('div', { class: 'quick' }, tools.map(x => h('a', { class: 'quick-i', href: x[2] }, h('span', { class: 'quick-ic' }, icon(x[0], 22)), h('span', null, x[1]))))),
    h('div', null, h('div', { class: 'row between' }, h('h2', { class: 'sec-t' }, t('home.recent')), S.lessons.length > 3 ? h('a', { class: 'link-btn', href: '#/library' }, t('home.all')) : null),
      S.lessons.length ? h('div', { class: 'stack' }, S.lessons.slice(0, 3).map(lessonCard)) : emptyState('book', t('home.empty.t'), t('home.empty.b'))),
    h('div', { class: 'card row between wrap gap share-strip' }, h('div', null, h('strong', null, t('share.title')), h('p', { class: 'muted sm' }, t('share.sub'))), h('button', { class: 'btn', type: 'button', onclick: openShare }, icon('share', 18), t('u.share')))));
}

/* ───────────── المكتبة + شريط البحث المتحرك ───────────── */
function viewLibrary(root) {
  let q = Prefs.get('q') || ''; Prefs.set('q', '');
  const list = h('div', { class: 'stack' });
  const paint = () => {
    const nq = norm(q);
    const items = Store.state.lessons.filter(l => !nq || norm(l.title).includes(nq) || l.pages.some(p => norm(p).includes(nq)));
    mount(list, items.length ? items.map(lessonCard) : (Store.state.lessons.length ? emptyState('search', t('lib.nomatch'), '') : emptyState('layers', t('lib.empty.t'), t('lib.empty.b'), h('a', { class: 'btn primary', href: '#/study' }, t('home.upload')))));
  };
  const inp = h('input', { type: 'search', class: 'sb-in', placeholder: t('lib.search'), 'aria-label': t('lib.search'), autocomplete: 'off', value: q });
  inp.addEventListener('input', () => { q = inp.value; paint(); });
  const bar = h('div', { class: 'sb' }, inp, h('span', { class: 'sb-ic' }, icon('search', 20)));
  mount(root, h('section', { class: 'page' }, pageHead(t('lib.title'), t('lib.sub', { n: Store.state.lessons.length })), bar, list));
  paint();
}

/* ───────────── التقدّم ───────────── */
function trendChart(vals) {
  const W = 320, H = 110, pad = 14;
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'trend'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('prog2.trend'));
  [0, 50, 100].forEach(v => { const y = H - pad - (v / 100) * (H - pad * 2); const l = document.createElementNS(SVGNS, 'line'); l.setAttribute('x1', pad); l.setAttribute('x2', W - pad); l.setAttribute('y1', y); l.setAttribute('y2', y); l.setAttribute('class', 'grid'); svg.appendChild(l); });
  if (vals.length) {
    const pts = vals.map((v, i) => [pad + (vals.length === 1 ? (W - pad * 2) / 2 : i * (W - pad * 2) / (vals.length - 1)), H - pad - (v / 100) * (H - pad * 2)]);
    const pl = document.createElementNS(SVGNS, 'polyline'); pl.setAttribute('points', pts.map(p => p.join(',')).join(' ')); pl.setAttribute('class', 'line'); svg.appendChild(pl);
    pts.forEach(p => { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 4); c.setAttribute('class', 'dot'); svg.appendChild(c); });
  }
  return svg;
}
function viewProgress(root) {
  const S = Store.state, qz = S.stats.quizzes;
  const days = []; const set = new Set(S.stats.days);
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: dayKey(d), on: set.has(dayKey(d)), d }); }
  const per = S.lessons.map(l => { const q = qz.filter(x => x.lessonId === l.id); return { l, n: q.length, avg: q.length ? Math.round(q.reduce((a, x) => a + x.score / x.total, 0) / q.length * 100) : null }; });
  const strong = per.filter(x => x.avg != null && x.avg >= 80), weak = per.filter(x => x.avg != null && x.avg < 60);
  const nameIn = h('input', { class: 'input', value: S.profile.name || '', maxlength: '60', placeholder: t('acct.name'), 'aria-label': t('acct.name') });
  nameIn.addEventListener('change', () => { S.profile.name = sanitizeText(nameIn.value, 60).trim(); Store.touch({ silent: true }); syncAccountUi(); });
  mount(root, h('section', { class: 'page' }, pageHead(t('prog2.title'), t('prog2.sub')),
    h('div', { class: 'tiles' },
      statTile('book', S.lessons.length, t('home.lessons')), statTile('file', S.stats.pages, t('home.pages')),
      statTile('help', qz.length, t('prog2.quizzes')), statTile('target', avgScore() == null ? '—' : avgScore() + '%', t('home.avg')),
      statTile('clock', fmtDuration(S.stats.studyMs / 1000), t('prog2.time')), statTile('flame', Store.streak(), t('home.streak'), 'warm'),
      statTile('cards', S.stats.reviews || 0, t('prog2.reviews'))),
    h('div', { class: 'card stack' }, h('strong', null, t('prog2.days')),
      h('div', { class: 'days' }, days.map(d => h('div', { class: 'day' + (d.on ? ' on' : ''), title: d.k }, h('i'), h('span', null, String(d.d.getDate())))))),
    h('div', { class: 'card stack' }, h('strong', null, t('prog2.trend')), qz.length ? trendChart(qz.slice(-10).map(q => Math.round(q.score / q.total * 100))) : h('p', { class: 'muted' }, t('prog2.notrend'))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card stack' }, h('strong', null, t('prog2.strong')), strong.length ? h('ul', { class: 'hist' }, strong.map(x => h('li', null, h('a', { href: '#/lesson/' + x.l.id + '/quiz', dir: 'auto' }, x.l.title), h('span', { class: 'badge ok' }, x.avg + '%')))) : h('p', { class: 'muted' }, t('prog2.none'))),
      h('div', { class: 'card stack' }, h('strong', null, t('prog2.weak')), weak.length ? h('ul', { class: 'hist' }, weak.map(x => h('li', null, h('a', { href: '#/lesson/' + x.l.id + '/memorize', dir: 'auto' }, x.l.title), h('span', { class: 'badge warn' }, x.avg + '%')))) : h('p', { class: 'muted' }, t('prog2.none')))),
    h('div', { class: 'card stack' }, h('label', { class: 'lbl' }, t('acct.name')), nameIn)));
}

/* ───────────── المشاركة ───────────── */
function shareUrl() { return (Prefs.get('shareUrl') || CONFIG.SHARE_URL || (location.origin + location.pathname.replace(/index\.html$/, ''))).trim(); }
function openShare() {
  const url = shareUrl();
  const msg = t('share.msg');
  const doCopy = async () => { try { await navigator.clipboard.writeText(url); toast(t('u.copied'), 'ok'); } catch (e) { toast(t('u.copyfail'), 'warn'); } };
  const body = h('div', { class: 'stack center' },
    h('img', { class: 'qr', src: 'share-qr.png', alt: t('share.qr'), width: 220, height: 220 }),
    h('p', { class: 'muted sm' }, t('share.scan')),
    h('div', { class: 'url-box', dir: 'ltr' }, url),
    h('div', { class: 'row wrap gap center' },
      navigator.share ? h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { await navigator.share({ title: CONFIG.APP_NAME, text: msg, url }); } catch (e) { /* */ } } }, icon('share', 18), t('u.share')) : null,
      h('button', { class: 'btn', type: 'button', onclick: doCopy }, icon('link', 18), t('share.copylink'))),
    h('div', { class: 'row wrap gap center' },
      h('a', { class: 'btn sm', href: 'https://wa.me/?text=' + encodeURIComponent(msg + ' ' + url) }, 'WhatsApp'),
      h('a', { class: 'btn sm', href: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(msg) }, 'Telegram'),
      h('a', { class: 'btn sm', href: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(msg) + '&url=' + encodeURIComponent(url) }, 'X'),
      h('a', { class: 'btn sm', href: 'mailto:?subject=' + encodeURIComponent(CONFIG.APP_NAME) + '&body=' + encodeURIComponent(msg + ' ' + url) }, 'Email')));
  openModal({ title: t('share.title'), body, actions: [{ label: t('u.close'), kind: 'ghost' }] });
}

/* ───────────── الحساب (سحابي) ───────────── */
function openAccount() {
  if (Store.auth && Store.auth.user) {
    const u = Store.auth.user;
    openModal({
      title: t('acct.title'),
      body: h('div', { class: 'stack' },
        h('div', { class: 'acct-card' }, h('div', { class: 'avatar' }, (u.name || u.email || '?').slice(0, 1).toUpperCase()), h('div', null, h('strong', null, u.name || ''), h('div', { class: 'muted sm', dir: 'ltr' }, u.email || ''))),
        h('p', { class: 'notice sm ok-n' }, icon('cloud', 16), h('div', null, t('cloud.where.cloud'))), h('p', { class: 'muted sm' }, t('cloud.' + Cloud.status), Cloud.lastSync ? ' · ' + new Date(Cloud.lastSync).toLocaleTimeString() : '')),
      actions: [
        { label: t('acct.sync'), kind: '', keepOpen: true, onClick: async () => { try { await Cloud.sync(); toast(t('acct.synced'), 'ok'); } catch (e) { toast(errMsg(e), 'err'); } syncCloudDot(); } },
        { label: t('acct.logout'), kind: 'danger', onClick: () => { setTimeout(doLogout, 260); } },
        { label: t('u.close'), kind: 'ghost' }
      ]
    });
    return;
  }
  if (!API.enabled()) {
    openModal({
      title: t('acct.title'), body: h('div', { class: 'stack' }, h('p', null, t('acct.nobackend')), h('p', { class: 'muted sm' }, t('acct.local'))),
      actions: [{ label: t('u.close'), kind: 'ghost' }, { label: t('study.nb.setup'), kind: 'primary', onClick: () => go('#/settings/server') }]
    });
    return;
  }
  authModal('login');
}

async function doLogout() {
  let ok = true;
  if (API.enabled() && navigator.onLine) { try { await Cloud.sync(); } catch (e) { ok = false; } } else if (Cloud.isDirty()) ok = false;
  if (!(await confirmBox(t('acct.logout.t'), ok ? t('acct.logout.b') : t('acct.logout.unsynced'), t('acct.logout'), true))) return;
  await Store.setAuth(null);
  Store.state = defaultState();
  try { await Vault.save('state', Store.state); localStorage.removeItem('sm_dirty'); } catch (e) { /* */ }
  Cloud.status = 'idle'; Cloud.lastSync = 0;
  syncAccountUi(); toast(t('acct.loggedout'));
  if (location.hash === '#/home' || !location.hash) route(); else location.hash = '#/home';
}
function authModal(mode) {
  let busy = false;
  const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', maxlength: '60', placeholder: t('acct.name'), 'aria-label': t('acct.name') });
  const email = h('input', { class: 'input', type: 'email', autocomplete: mode === 'login' ? 'username' : 'email', inputmode: 'email', maxlength: '120', placeholder: t('acct.email'), 'aria-label': t('acct.email'), dir: 'ltr' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', maxlength: '100', placeholder: t('acct.pass'), 'aria-label': t('acct.pass'), dir: 'ltr' });
  const err = h('p', { class: 'err-t sm hidden', role: 'alert' });
  const eye = h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': t('acct.showpass'), onclick: () => { pass.type = pass.type === 'password' ? 'text' : 'password'; } }, icon('eye', 18));
  const submit = async m => {
    if (busy) return; err.classList.add('hidden');
    const em = sanitizeText(email.value, 120).trim().toLowerCase(), pw = pass.value, nm = sanitizeText(name.value, 60).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { err.textContent = t('acct.e.email'); err.classList.remove('hidden'); return; }
    if (pw.length < 8) { err.textContent = t('acct.e.pass'); err.classList.remove('hidden'); return; }
    if (m === 'register' && !nm) { err.textContent = t('acct.e.name'); err.classList.remove('hidden'); return; }
    busy = true; btn.disabled = true;
    try {
      const r = await API.req(m === 'login' ? '/api/auth/login' : '/api/auth/register', { body: m === 'login' ? { email: em, password: pw } : { name: nm, email: em, password: pw }, timeout: 30000 });
      if (!r.token) throw new ApiError('server');
      await Store.setAuth({ token: String(r.token), user: { name: sanitizeText(r.user && r.user.name || nm, 60), email: sanitizeText(r.user && r.user.email || em, 120) } });
      if (!Store.state.profile.name) Store.state.profile.name = Store.auth.user.name;
      try { await Cloud.sync(); } catch (e) { /* ستُعاد المحاولة تلقائيًا */ }
      syncAccountUi(); toast(t('acct.welcome', { name: Store.auth.user.name || '' }), 'ok');
      ctl.close();
      if ($('#view') && (location.hash.startsWith('#/home') || location.hash === '' || location.hash.startsWith('#/library') || location.hash.startsWith('#/progress'))) route();
    } catch (e) {
      err.textContent = e.code === 'unauthorized' ? t('acct.e.bad') : (e.code === 'server' && e.message && e.message !== 'server' ? e.message : errMsg(e)); err.classList.remove('hidden');
    }
    busy = false; btn.disabled = false;
  };
  const btn = h('button', { class: 'btn primary', type: 'submit' }, mode === 'login' ? t('acct.login') : t('acct.register'));
  const body = h('form', { class: 'stack', novalidate: true, onsubmit: e => { e.preventDefault(); submit(mode); } },
    h('p', { class: 'muted sm' }, t('acct.cloud.note')),
    mode === 'register' ? name : null, email, h('div', { class: 'pass-row' }, pass, eye), err,
    h('div', { class: 'row between wrap gap' }, btn, h('button', { class: 'link-btn', type: 'button', onclick: () => { ctl.close(); setTimeout(() => authModal(mode === 'login' ? 'register' : 'login'), 240); } }, mode === 'login' ? t('acct.switch.reg') : t('acct.switch.log'))));
  const ctl = openModal({ title: mode === 'login' ? t('acct.login') : t('acct.register'), body });
}

/* ───────────── الإعدادات ───────────── */
function setRow(label, sub, control) { return h('div', { class: 'set-row' }, h('div', { class: 'grow' }, h('strong', null, label), sub ? h('div', { class: 'muted sm' }, sub) : null), control); }
function switchCtl(on, onChange, label) {
  const b = h('button', { class: 'switch' + (on ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label, onclick: () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); onChange(on); } }, h('i'));
  return b;
}
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }

function viewSettings(root, focus) {
  const rerender = () => viewSettings(root);
  const urlIn = h('input', { class: 'input', type: 'url', inputmode: 'url', dir: 'ltr', placeholder: 'https://api.example.com', value: Prefs.get('backendUrl') || '', 'aria-label': t('set.server.url'), autocomplete: 'off', spellcheck: 'false' });
  const status = h('p', { class: 'sm muted', role: 'status' }, API.enabled() ? t('set.server.saved') : t('set.server.none'));
  const saveUrl = () => {
    const v = urlIn.value.trim().replace(/\/+$/, '');
    if (v && !API.validate(v)) { status.textContent = t('set.server.bad'); status.className = 'sm err-t'; return false; }
    Prefs.set('backendUrl', v); status.textContent = v ? t('set.server.saved') : t('set.server.none'); status.className = 'sm muted'; syncCloudDot(); return true;
  };
  const test = async () => {
    if (!saveUrl()) return; if (!API.enabled()) return;
    status.textContent = t('set.server.testing'); status.className = 'sm muted';
    try { const r = await API.req('/api/health', { timeout: 12000 }); status.textContent = t('set.server.ok') + (r && r.name ? ' — ' + sanitizeText(r.name, 40) : ''); status.className = 'sm ok-t'; }
    catch (e) { status.textContent = t('set.server.fail') + ' (' + errMsg(e) + ')'; status.className = 'sm err-t'; }
  };
  const shareIn = h('input', { class: 'input', type: 'url', dir: 'ltr', placeholder: 'https://username.github.io/studymind/', value: Prefs.get('shareUrl') || '', 'aria-label': t('set.share.url') });
  shareIn.addEventListener('change', () => { const v = shareIn.value.trim(); if (!v || /^https?:\/\//i.test(v)) { Prefs.set('shareUrl', v); toast(t('u.saved'), 'ok'); } else toast(t('set.server.bad'), 'warn'); });
  const rate = h('input', { type: 'range', min: '0.6', max: '1.6', step: '0.1', value: String(Prefs.get('speechRate')), 'aria-label': t('set.speech.rate'), class: 'range' });
  rate.addEventListener('input', () => Prefs.set('speechRate', Number(rate.value)));
  const fs = h('input', { type: 'range', min: '0.9', max: '1.3', step: '0.05', value: String(Prefs.get('fontScale')), 'aria-label': t('set.font'), class: 'range' });
  fs.addEventListener('input', () => { Prefs.set('fontScale', Number(fs.value)); applyPrefs(); });
  const importIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': t('set.import') });
  importIn.addEventListener('change', async () => {
    const f = importIn.files[0]; if (!f) return;
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error('size');
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.lessons)) throw new Error('fmt');
      Cloud.merge(data); toast(t('set.import.ok'), 'ok'); rerender();
    } catch (e) { toast(t('set.import.bad'), 'err'); }
  });
  const exportData = () => {
    const blob = new Blob([JSON.stringify(Store.state)], { type: 'application/json' });
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.setAttribute('download', 'studymind-backup-' + dayKey() + '.json');
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const install = async () => {
    if (isStandalone()) { toast(t('set.install.done'), 'ok'); return; }
    if (App.deferredInstall) { App.deferredInstall.prompt(); try { await App.deferredInstall.userChoice; } catch (e) { /* */ } App.deferredInstall = null; return; }
    openModal({
      title: t('set.install'), body: h('div', { class: 'stack' }, h('p', null, isIOS() ? t('install.ios') : t('install.other')),
        h('ol', { class: 'points' }, (isIOS() ? ['install.ios1', 'install.ios2', 'install.ios3'] : ['install.a1', 'install.a2', 'install.a3']).map(k => h('li', null, t(k))))),
      actions: [{ label: t('u.ok'), kind: 'primary' }]
    });
  };
  const wipe = async () => {
    if (!(await confirmBox(t('set.wipe'), t('set.wipe.b'), t('set.wipe.go'), true))) return;
    try { await Vault.wipe(); } catch (e) { /* */ }
    try { localStorage.removeItem('sm_prefs'); sessionStorage.clear(); } catch (e) { /* */ }
    if (window.caches) { try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* */ } }
    location.hash = '#/home'; location.reload();
  };
  const sec = (id, title, ic, ...kids) => h('section', { class: 'card set-sec', id: 'set-' + id }, h('h2', { class: 'set-h' }, icon(ic, 20), title), ...kids);
  mount(root, h('section', { class: 'page' }, pageHead(t('set.title'), t('set.sub')),
    sec('look', t('set.look'), 'sun',
      setRow(t('set.theme'), null, h('div', { id: 'set-theme-seg' }, seg([{ value: 'system', label: t('set.theme.sys') }, { value: 'light', label: t('set.theme.light') }, { value: 'dark', label: t('set.theme.dark') }], Prefs.get('theme'), v => { Prefs.set('theme', v); applyPrefs(); syncThemeToggle(); }, t('set.theme')))),
      setRow(t('set.lang'), null, seg([{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }], Prefs.get('lang'), v => { Prefs.set('lang', v); applyPrefs(); buildLayout(); route(); }, t('set.lang'))),
      setRow(t('set.font'), null, fs),
      setRow(t('set.motion'), t('set.motion.sub'), switchCtl(!!Prefs.get('reduceMotion'), v => { Prefs.set('reduceMotion', v); applyPrefs(); }, t('set.motion'))),
      setRow(t('set.intro'), t('set.intro.sub'), switchCtl(!!Prefs.get('intro'), v => Prefs.set('intro', v), t('set.intro')))),
    sec('study', t('set.study'), 'book',
      setRow(t('study.level'), null, seg([{ value: 'simple', label: t('lvl.simple') }, { value: 'standard', label: t('lvl.standard') }, { value: 'deep', label: t('lvl.deep') }], Prefs.get('level'), v => Prefs.set('level', v), t('study.level'))),
      setRow(t('sum.len'), null, seg([{ value: 'quick', label: t('sum.quick') }, { value: 'standard', label: t('sum.standard') }, { value: 'detailed', label: t('sum.detailed') }, { value: 'exam', label: t('sum.exam') }], Prefs.get('summaryLen'), v => Prefs.set('summaryLen', v), t('sum.len'))),
      setRow(t('set.speech.rate'), null, h('div', { class: 'row gap' }, rate, h('button', { class: 'btn sm', type: 'button', onclick: () => Speech.speak(t('set.speech.test'), null) }, icon('volume', 16))))),
    sec('server', t('set.server'), 'cloud',
      h('p', { class: 'muted sm' }, t('set.server.note')), h('label', { class: 'lbl' }, t('set.server.url')), urlIn,
      h('div', { class: 'row wrap gap' }, h('button', { class: 'btn primary', type: 'button', onclick: saveUrl }, t('u.save')), h('button', { class: 'btn', type: 'button', onclick: test }, icon('refresh', 16), t('set.server.test'))),
      status,
      setRow(t('set.storage'), Store.auth ? t('cloud.where.cloud') : t('cloud.where.local'), h('span', { class: 'badge ' + (Store.auth ? 'ok' : 'warn') }, Store.auth ? t('set.storage.cloud') : t('set.storage.local'))),
      setRow(t('acct.title'), Store.auth && Store.auth.user ? Store.auth.user.email : t('acct.guest.sub'), h('button', { class: 'btn', type: 'button', onclick: openAccount }, icon('user', 16), Store.auth ? t('acct.manage') : t('acct.login')))),
    sec('share', t('set.share'), 'share',
      h('div', { class: 'row gap wrap' }, h('img', { class: 'qr sm-qr', src: 'share-qr.png', alt: t('share.qr'), width: 120, height: 120 }), h('div', { class: 'grow stack' }, h('p', { class: 'muted sm' }, t('share.sub')), h('button', { class: 'btn primary', type: 'button', onclick: openShare }, icon('share', 16), t('u.share')))),
      h('label', { class: 'lbl' }, t('set.share.url')), shareIn, h('p', { class: 'muted sm' }, t('set.share.note'))),
    sec('app', t('set.app'), 'download',
      setRow(t('set.install'), isStandalone() ? t('set.install.done') : t('set.install.sub'), h('button', { class: 'btn', type: 'button', onclick: install }, icon('download', 16), t('set.install.go'))),
      setRow(t('set.offline'), navigator.serviceWorker ? t('set.offline.on') : t('set.offline.off'), h('span', { class: 'badge ' + (navigator.serviceWorker ? 'ok' : 'warn') }, navigator.serviceWorker ? 'ON' : 'OFF'))),
    sec('data', t('set.data'), 'shield',
      h('p', { class: 'muted sm' }, t('set.data.note')),
      h('div', { class: 'row wrap gap' }, h('button', { class: 'btn', type: 'button', onclick: exportData }, icon('download', 16), t('set.export')), h('button', { class: 'btn', type: 'button', onclick: () => importIn.click() }, icon('upload', 16), t('set.import')), importIn,
        h('button', { class: 'btn danger-soft', type: 'button', onclick: wipe }, icon('trash', 16), t('set.wipe')))),
    sec('about', t('set.about'), 'info',
      h('div', { class: 'about' }, h('img', { class: 'light-only', src: 'logo.png', alt: 'StudyMind', width: 160, height: 160 }), h('img', { class: 'dark-only', src: 'logo-dark.png', alt: 'StudyMind', width: 160, height: 160 }),
        h('p', { class: 'muted sm' }, 'v' + CONFIG.VERSION), h('p', { class: 'muted sm' }, t('set.about.note'))))));
  if (focus) { const el = $('#set-' + focus); if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
}

/* ───────────── PWA ───────────── */
function registerSW() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.deferredInstall = e; });
  window.addEventListener('appinstalled', () => { App.deferredInstall = null; toast(t('set.install.done'), 'ok'); });
  if (!('serviceWorker' in navigator) || !/^https:$|^http:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    App.swReg = reg;
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const box = $('#toasts') || document.body;
          toast(t('app.update'), 'ok');
          openModal({ title: t('app.update'), body: h('p', null, t('app.update.b')), actions: [{ label: t('u.later'), kind: 'ghost' }, { label: t('app.update.go'), kind: 'primary', onClick: () => { nw.postMessage('skipWaiting'); } }] });
        }
      });
    });
  }).catch(() => { /* التطبيق يعمل بدون SW */ });
  // نعيد التحميل فقط عند تحديث نسخة قديمة، لا عند أول تثبيت (حتى لا تختفي المقدمة)
  const hadController = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloading) return; reloading = true; location.reload(); });
}

/* ───────────── الإقلاع ───────────── */
(async function boot() {
  applyPrefs();
  initIntro();
  try { await Store.init(); } catch (e) { Store.state = defaultState(); }
  Store.onChange(() => { syncAccountUi(); });
  buildLayout();
  if (!location.hash) history.replaceState(null, '', '#/home');
  route();
  window.addEventListener('hashchange', route);
  registerSW();
  Cloud.onStatus = syncCloudDot;
  Cloud.onMerged = () => { if (/^#\/(home|library|progress|review)?$/.test(location.hash) || location.hash === '') route(); };
  const doSync = () => { if (Store.auth && API.enabled() && navigator.onLine) Cloud.sync().catch(e => { if (e && e.code === 'unauthorized') { Store.setAuth(null).then(() => { syncAccountUi(); toast(t('err.unauthorized'), 'warn'); }); } }); };
  doSync();
  setInterval(() => { if (!document.hidden) doSync(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) doSync(); else if (Cloud.isDirty()) doSync(); });
  const boot2 = $('#boot-fallback'); if (boot2) boot2.remove();
})();

window.addEventListener('error', e => { try { console.warn('StudyMind:', e.message); } catch (x) { /* */ } e.preventDefault && e.preventDefault(); });
window.addEventListener('unhandledrejection', e => { e.preventDefault(); });
