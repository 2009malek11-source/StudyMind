/* StudyMind — study.js
 * رفع الصفحات، التحليل، عرض الدرس، البطاقات، الاختبارات، المساعد، الصوت.
 */
'use strict';

/* ───────────── مكوّنات صغيرة ───────────── */
function seg(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'tablist', 'aria-label': label || '' });
  const btns = options.map(o => {
    const b = h('button', {
      type: 'button', role: 'tab', class: 'seg-btn' + (o.value === value ? ' on' : ''),
      'aria-selected': o.value === value ? 'true' : 'false',
      onclick: () => { value = o.value; btns.forEach((x, i) => { x.classList.toggle('on', options[i].value === value); x.setAttribute('aria-selected', options[i].value === value ? 'true' : 'false'); }); onChange(value); }
    }, o.label);
    return b;
  });
  btns.forEach(b => wrap.appendChild(b));
  return wrap;
}
function badge(text, kind) { return h('span', { class: 'badge ' + (kind || '') }, text); }
function emptyState(ic, title, text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon(ic, 34)), h('h3', null, title), text ? h('p', null, text) : null, action || null);
}
function go(hash) { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; }

/* ───────────── الصوت ───────────── */
const Speech = {
  active: false, btn: null,
  supported() { return 'speechSynthesis' in window; },
  stop() { if (this.supported()) speechSynthesis.cancel(); this.active = false; if (this.btn) this.btn.classList.remove('on'); this.btn = null; },
  speak(text, btn) {
    if (!this.supported()) { toast(t('speech.unsupported'), 'warn'); return; }
    if (this.active && this.btn === btn) { this.stop(); return; }
    this.stop();
    const lang = Prefs.get('lang') === 'ar' ? 'ar-SA' : 'en-US';
    const parts = String(text).replace(/[*#`>_]/g, '').replace(/([.!؟?])\s+/g, '$1\n').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    this.active = true; this.btn = btn || null; if (btn) btn.classList.add('on');
    let i = 0;
    const next = () => {
      if (!this.active || i >= parts.length) { this.stop(); return; }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      u.lang = lang; u.rate = Prefs.get('speechRate');
      const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      u.onend = next; u.onerror = () => this.stop();
      speechSynthesis.speak(u);
    };
    next();
  },
  listen(onText, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast(t('speech.nomic'), 'warn'); return null; }
    const r = new SR(); r.lang = Prefs.get('lang') === 'ar' ? 'ar-SA' : 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = e => { const tx = e.results[0] && e.results[0][0] ? e.results[0][0].transcript : ''; onText(sanitizeText(tx, 500)); };
    r.onerror = () => { toast(t('speech.micdenied'), 'warn'); };
    r.onend = onEnd;
    try { r.start(); } catch (e) { return null; }
    return r;
  }
};

/* ───────────── تحليل محلي مبسّط (بدون خادم) ───────────── */
const STOP = new Set(('من في على الى عن مع هذا هذه ذلك تلك التي الذي الذين ان كان كانت يكون هو هي هم ما لا او ثم قد كل بين عند حتي اذا لم لن به بها له لها كما اي ايضا فقط بعد قبل خلال حيث لان عندما the a an of to in is are was were and or for on with as by at from that this it be been which these those its their his her can may also than then into over under'
).split(/\s+/));
function splitSentences(text) {
  return sanitizeText(text, 60000).replace(/([.!?؟…])\s+/g, '$1\n').split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 18 && s.length < 400);
}
function localPack(pages, titleHint) {
  const text = pages.join('\n');
  const sents = splitSentences(text);
  const freq = new Map();
  for (const s of sents) for (const w of norm(s).split(' ')) if (w.length > 2 && !STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sents.map((s, i) => {
    const ws = norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));
    let sc = 0; for (const w of ws) sc += freq.get(w) || 0;
    sc = ws.length ? sc / Math.sqrt(ws.length) : 0;
    if (/\d/.test(s)) sc *= 1.15;
    return { s, i, sc };
  });
  const top = n => scored.slice().sort((a, b) => b.sc - a.sc).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.s);
  const defRe = [
    /^(.{2,40}?)\s+(?:هو|هي|هم|تعني|يعني|يُعرَّف بأنه|تُعرَّف بأنها|يعرف بأنه|تعرف بأنها)\s+(.{8,})$/,
    /^(.{2,40}?)\s+(?:is|are|means|refers to|is defined as)\s+(.{8,})$/i,
    /^(.{2,40}?):\s+(.{8,})$/
  ];
  const cards = [];
  for (const s of sents) {
    for (const re of defRe) {
      const m = s.match(re);
      if (m) {
        const term = m[1].replace(/^(ال)?/, '$&').replace(/[«»"'“”]/g, '').trim();
        if (term.split(' ').length <= 5 && !cards.some(c => c.term === term)) { cards.push({ term, q: t('local.whatIs', { term }), a: m[2].replace(/[.؟?!]+$/, '') }); }
        break;
      }
    }
    if (cards.length >= 12) break;
  }
  const facts = scored.filter(x => /\d|:/.test(x.s) || cards.some(c => x.s.startsWith(c.term))).sort((a, b) => b.sc - a.sc).slice(0, 8).sort((a, b) => a.i - b.i).map(x => x.s);
  // اختبارات
  const quiz = [];
  if (cards.length >= 4) {
    for (const c of shuffle(cards).slice(0, 6)) {
      const others = shuffle(cards.filter(x => x !== c)).slice(0, 3).map(x => x.a);
      const opts = shuffle([c.a].concat(others));
      quiz.push({ type: 'mcq', q: c.q, options: opts, answer: opts.indexOf(c.a), explanation: c.term + ': ' + c.a });
    }
  }
  for (const s of top(4)) {
    const words = s.split(' ').filter(w => w.length > 4 && !STOP.has(norm(w)));
    if (words.length < 4) continue;
    const target = words.slice().sort((a, b) => b.length - a.length)[0];
    const clean = target.replace(/[.,،؛:!?؟()«»"']/g, '');
    if (!clean) continue;
    quiz.push({ type: 'fill', q: s.replace(target, '_____'), answer: [clean], explanation: s });
  }
  const sum = {
    quick: top(3), standard: top(6), detailed: top(10),
    exam: (facts.length >= 4 ? facts : top(8)).slice(0, 8)
  };
  const title = sanitizeText(titleHint || (sents[0] || text).slice(0, 60), 80).trim() || t('lesson.untitled');
  const overview = top(2).join(' ');
  const expl = '### ' + t('local.keyIdeas') + '\n' + top(8).map(s => '- ' + s).join('\n');
  return normalizePack({
    title, overview,
    explanation: { simple: '### ' + t('local.keyIdeas') + '\n' + top(4).map(s => '- ' + s).join('\n'), standard: expl, deep: expl },
    summary: sum, keyFacts: facts.length ? facts : top(5),
    glossary: cards.slice(0, 10).map(c => ({ term: c.term, def: c.a })),
    examples: [], flashcards: cards.map(c => ({ q: c.q, a: c.a })), quiz
  });
}
function normalizePack(p) {
  p = p && typeof p === 'object' ? p : {};
  const S = (x, m) => sanitizeText(x, m || 4000).trim();
  const A = (x, m) => (Array.isArray(x) ? x : []).map(v => S(typeof v === 'string' ? v : (v && (v.text || v.q) || ''), m || 800)).filter(Boolean);
  const ex = p.explanation && typeof p.explanation === 'object' ? p.explanation : { standard: p.explanation };
  const sm = p.summary && typeof p.summary === 'object' && !Array.isArray(p.summary) ? p.summary : { standard: p.summary };
  const out = {
    title: S(p.title, 120), overview: S(p.overview, 1200),
    explanation: { simple: S(ex.simple, 12000), standard: S(ex.standard, 16000), deep: S(ex.deep, 20000) },
    summary: { quick: A(sm.quick), standard: A(sm.standard), detailed: A(sm.detailed), exam: A(sm.exam) },
    keyFacts: A(p.keyFacts), examples: A(p.examples),
    glossary: (Array.isArray(p.glossary) ? p.glossary : []).map(g => ({ term: S(g && g.term, 80), def: S(g && g.def, 500) })).filter(g => g.term && g.def).slice(0, 40),
    flashcards: (Array.isArray(p.flashcards) ? p.flashcards : []).map(c => ({ q: S(c && c.q, 400), a: S(c && c.a, 800) })).filter(c => c.q && c.a).slice(0, 80),
    quiz: [], mistakes: Array.isArray(p.mistakes) ? p.mistakes.slice(0, 80) : []
  };
  for (const q of (Array.isArray(p.quiz) ? p.quiz : []).slice(0, 80)) {
    if (!q || !q.q) continue;
    const type = ['mcq', 'tf', 'fill'].includes(q.type) ? q.type : (Array.isArray(q.options) ? 'mcq' : typeof q.answer === 'boolean' ? 'tf' : 'fill');
    const item = { type, q: S(q.q, 600), explanation: S(q.explanation, 800), page: Number.isFinite(+q.page) ? +q.page : undefined };
    if (type === 'mcq') {
      item.options = A(q.options, 300).slice(0, 6); item.answer = clamp(parseInt(q.answer, 10) || 0, 0, Math.max(0, item.options.length - 1));
      if (item.options.length < 2) continue;
    } else if (type === 'tf') item.answer = q.answer === true || q.answer === 'true' || q.answer === 'صح';
    else { item.answer = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(x => S(x, 200)).filter(Boolean); if (!item.answer.length) continue; }
    out.quiz.push(item);
  }
  // احتياطيات
  if (!out.explanation.standard) out.explanation.standard = out.explanation.deep || out.explanation.simple || out.overview;
  for (const k of ['quick', 'standard', 'detailed', 'exam']) if (!out.summary[k].length) out.summary[k] = out.summary.standard.length ? out.summary.standard : out.keyFacts.slice(0, 6);
  return out;
}

/* ───────────── درس تجريبي ───────────── */
const DEMO_TEXT = {
  ar: [
    'البناء الضوئي هو العملية التي تصنع بها النباتات الخضراء غذاءها باستخدام ضوء الشمس. يحدث البناء الضوئي في البلاستيدات الخضراء داخل خلايا الأوراق. الكلوروفيل هو الصبغة الخضراء التي تمتص الطاقة الضوئية من الشمس. تحتاج النباتات إلى ثلاثة مدخلات هي: الماء وثاني أكسيد الكربون وضوء الشمس.',
    'تمتص الجذور الماء من التربة وينتقل عبر الأوعية الخشبية إلى الأوراق. يدخل ثاني أكسيد الكربون إلى الورقة عن طريق الثغور. ينتج عن البناء الضوئي سكر الجلوكوز والأكسجين. الجلوكوز هو السكر الذي تستخدمه النبتة مصدرًا للطاقة والنمو. يخرج الأكسجين إلى الهواء عبر الثغور، وهو ما يتنفسه الإنسان والحيوان. الثغور هي فتحات صغيرة في سطح الورقة تتحكم في تبادل الغازات.'
  ],
  en: [
    'Photosynthesis is the process by which green plants make their own food using sunlight. Photosynthesis takes place in the chloroplasts inside leaf cells. Chlorophyll is the green pigment that absorbs light energy from the sun. Plants need three inputs: water, carbon dioxide and sunlight.',
    'Roots absorb water from the soil and it travels through the xylem to the leaves. Carbon dioxide enters the leaf through the stomata. Photosynthesis produces glucose and oxygen. Glucose is the sugar a plant uses as a source of energy and growth. Oxygen is released into the air through the stomata, and humans and animals breathe it. Stomata are tiny openings in the leaf surface that control gas exchange.'
  ]
};
function createDemoLesson() {
  const lang = Prefs.get('lang') === 'ar' ? 'ar' : 'en';
  const pages = DEMO_TEXT[lang];
  const pack = localPack(pages, lang === 'ar' ? 'البناء الضوئي (درس تجريبي)' : 'Photosynthesis (demo lesson)');
  pack.explanation.simple = lang === 'ar'
    ? '### الفكرة ببساطة\nالنبتة مثل مطبخ صغير: تأخذ **الماء** من الجذور و**ثاني أكسيد الكربون** من الهواء، وتستخدم **ضوء الشمس** كطاقة، فتصنع **سكرًا** تتغذى عليه وتُخرج **الأكسجين** الذي نتنفسه.'
    : '### The idea in simple words\nA plant is like a tiny kitchen: it takes **water** from the roots and **carbon dioxide** from the air, uses **sunlight** as energy, and makes **sugar** to feed itself while releasing the **oxygen** we breathe.';
  pack.explanation.standard = lang === 'ar'
    ? '### كيف يحدث البناء الضوئي؟\n1. يمتص **الكلوروفيل** في البلاستيدات الخضراء طاقة الضوء.\n2. تصل **المياه** من الجذور إلى الورقة، ويدخل **ثاني أكسيد الكربون** عبر الثغور.\n3. تُستخدم الطاقة لتحويلهما إلى **جلوكوز** و**أكسجين**.\n\n### لماذا هو مهم؟\nهو أساس السلاسل الغذائية، وهو مصدر الأكسجين في الهواء.'
    : '### How does photosynthesis work?\n1. **Chlorophyll** in the chloroplasts absorbs light energy.\n2. **Water** arrives from the roots and **carbon dioxide** enters through the stomata.\n3. The energy converts them into **glucose** and **oxygen**.\n\n### Why does it matter?\nIt underpins food chains and is the source of oxygen in the air.';
  pack.explanation.deep = pack.explanation.standard + (lang === 'ar'
    ? '\n\n### للتعمق\nيمكن تلخيص التفاعل: ماء + ثاني أكسيد الكربون + طاقة ضوئية ← جلوكوز + أكسجين. تتحكم الثغور بفتحها وإغلاقها في كمية الماء المفقود وفي تبادل الغازات.'
    : '\n\n### Going deeper\nThe reaction can be summarised as: water + carbon dioxide + light energy → glucose + oxygen. Stomata open and close to balance water loss against gas exchange.');
  pack.examples = lang === 'ar' ? ['نبتة في غرفة مظلمة تضعف لأنها لا تحصل على ضوء الشمس اللازم لصنع الغذاء.'] : ['A plant kept in a dark room weakens because it lacks the sunlight needed to make food.'];
  pack.quiz.push(lang === 'ar'
    ? { type: 'tf', q: 'يحدث البناء الضوئي في الجذور.', answer: false, explanation: 'يحدث في البلاستيدات الخضراء داخل خلايا الأوراق.' }
    : { type: 'tf', q: 'Photosynthesis takes place in the roots.', answer: false, explanation: 'It happens in the chloroplasts inside leaf cells.' });
  return addLesson({ title: pack.title, pages, pack, source: 'demo', level: 'standard' });
}
function addLesson(o) {
  const now = Date.now();
  const lesson = {
    id: uid(), title: sanitizeText(o.title || o.pack.title || t('lesson.untitled'), 120), createdAt: now, updatedAt: now,
    pages: o.pages.map(p => sanitizeText(p, 20000)), pack: o.pack, source: o.source || 'ai', level: o.level || 'standard',
    lang: Prefs.get('lang'), pageCount: o.pageCount || o.pages.length, tags: []
  };
  Store.state.lessons.unshift(lesson);
  Store.state.stats.pages += lesson.pageCount;
  Store.markStudyDay();
  Store.touch();
  return lesson;
}

/* ───────────── واجهة الدراسة: الرفع ───────────── */
const Study = {
  draft: { mode: 'images', items: [], text: '', busy: 0 },
  run: null
};

function viewStudy(root) {
  const d = Study.draft;
  const rerender = () => viewStudy(root);
  const running = !!Study.run;
  const fileGallery = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', id: 'f-gallery', 'aria-label': t('study.gallery') });
  const fileCamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', id: 'f-camera', 'aria-label': t('study.camera') });
  const handle = async files => {
    files = Array.from(files || []);
    if (!files.length) return;
    const room = CONFIG.MAX_PAGES - d.items.length;
    if (files.length > room) { toast(t('study.maxpages', { n: CONFIG.MAX_PAGES }), 'warn'); files = files.slice(0, Math.max(0, room)); }
    d.busy += files.length; rerender();
    for (const f of files) {
      try {
        const it = await prepareImage(f);
        it.dup = d.items.some(o => hamming(o.hash, it.hash) <= 4);
        it.blur = it.sharp < 12;
        d.items.push(it);
      } catch (e) { toast(t(e.message === 'size' ? 'study.toobig' : 'study.badfile', { name: f.name }), 'warn'); }
      d.busy--;
    }
    rerender();
  };
  fileGallery.addEventListener('change', () => handle(fileGallery.files));
  fileCamera.addEventListener('change', () => handle(fileCamera.files));

  const modeSeg = seg([{ value: 'images', label: t('study.mode.images') }, { value: 'text', label: t('study.mode.text') }], d.mode, v => { d.mode = v; rerender(); }, t('study.mode'));

  const drop = h('div', { class: 'drop', tabindex: '0', role: 'button', 'aria-label': t('study.drop'),
    onclick: () => fileGallery.click(), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileGallery.click(); } },
    ondragover: e => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'),
    ondrop: e => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files); } },
    h('div', { class: 'drop-ic' }, icon('upload', 32)), h('strong', null, t('study.drop')), h('span', { class: 'muted' }, t('study.drop.sub', { n: CONFIG.MAX_PAGES })));

  const imagesPart = h('div', { class: 'stack' },
    drop,
    h('div', { class: 'row wrap gap' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => fileCamera.click() }, icon('camera', 18), t('study.camera')),
      h('button', { class: 'btn', type: 'button', onclick: () => fileGallery.click() }, icon('image', 18), t('study.gallery'))),
    fileGallery, fileCamera,
    d.busy ? h('div', { class: 'muted center' }, t('study.preparing', { n: d.busy })) : null,
    d.items.length ? h('div', { class: 'row between' }, h('strong', null, t('study.pages', { n: d.items.length })),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { d.items = []; rerender(); } }, icon('trash', 16), t('study.clear'))) : null,
    d.items.length ? thumbGrid(d, rerender) : null);

  const ta = h('textarea', { class: 'input', rows: '9', maxlength: '40000', placeholder: t('study.text.ph'), 'aria-label': t('study.mode.text') });
  ta.value = d.text; ta.addEventListener('input', () => { d.text = ta.value; aBtn.disabled = d.text.trim().length <= 30; });
  const textPart = h('div', { class: 'stack' }, ta, h('div', { class: 'muted sm' }, t('study.text.hint')));

  const level = h('div', { class: 'field' }, h('label', null, t('study.level')),
    seg([{ value: 'simple', label: t('lvl.simple') }, { value: 'standard', label: t('lvl.standard') }, { value: 'deep', label: t('lvl.deep') }], Prefs.get('level'), v => Prefs.set('level', v), t('study.level')));

  const ready = d.mode === 'images' ? d.items.length > 0 : d.text.trim().length > 30;
  const optsRow = h('div', { class: 'grid2' }, level);

  const aBtn = analyzeButton(ready, () => startAnalysis(root));
  const panel = running ? progressPanel() : null;
  const hint = (!API.signedIn() && d.mode === 'images') ? h('div', { class: 'notice' }, icon('info', 18), h('div', null, t('study.nobackend'), ' ', h('button', { class: 'link-btn', type: 'button', onclick: () => openAccount() }, t('study.nobackend.link')))) : null;

  mount(root,
    h('section', { class: 'page' },
      pageHead(t('study.title'), t('study.sub')),
      running ? panel : [
        h('div', { class: 'card stack' }, modeSeg, d.mode === 'images' ? imagesPart : textPart),
        h('div', { class: 'card stack' }, optsRow),
        hint,
        h('div', { class: 'center' }, aBtn),
        h('div', { class: 'center' }, h('button', { class: 'link-btn', type: 'button', onclick: () => { const l = createDemoLesson(); toast(t('study.demo.done'), 'ok'); go('#/lesson/' + l.id); } }, t('study.demo')))
      ]));
}
function pageHead(title, sub, extra) {
  return h('header', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null), extra || null);
}
function thumbGrid(d, rerender) {
  const g = h('div', { class: 'thumbs' });
  d.items.forEach((it, i) => {
    const mv = k => { const j = i + k; if (j < 0 || j >= d.items.length) return; const a = d.items; [a[i], a[j]] = [a[j], a[i]]; rerender(); };
    g.appendChild(h('figure', { class: 'thumb' },
      h('div', { class: 'thumb-img' }, h('img', { src: it.dataUrl, alt: t('study.page', { n: i + 1 }), loading: 'lazy', decoding: 'async' }), h('span', { class: 'thumb-n' }, i + 1)),
      h('div', { class: 'thumb-badges' }, it.dup ? badge(t('study.dup'), 'warn') : null, it.blur ? badge(t('study.blur'), 'warn') : null),
      h('div', { class: 'thumb-actions' },
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': t('study.moveup'), disabled: i === 0, onclick: () => mv(-1) }, icon('chevL', 16)),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': t('study.movedown'), disabled: i === d.items.length - 1, onclick: () => mv(1) }, icon('chevR', 16)),
        h('button', { class: 'icon-btn sm danger', type: 'button', 'aria-label': t('u.delete'), onclick: () => { d.items.splice(i, 1); rerender(); } }, icon('trash', 16)))));
  });
  return g;
}

/* زر التحليل بشكل زر التحميل مع حلقة تقدّم */
function analyzeButton(ready, onClick) {
  const b = h('button', { class: 'dl-btn', type: 'button', disabled: !ready, 'aria-label': t('study.analyze'), onclick: onClick },
    h('span', { class: 'dl-ring' }, icon('sparkles', 26)), h('span', { class: 'dl-label' }, t('study.analyze')));
  return b;
}

/* ───────────── لوحة التقدّم (حقيقية) ───────────── */
let paintProgress = () => { };
function progressPanel() {
  const r = Study.run;
  const C = 2 * Math.PI * 44;
  const ringBg = document.createElementNS(SVGNS, 'circle'); ringBg.setAttribute('cx', 50); ringBg.setAttribute('cy', 50); ringBg.setAttribute('r', 44); ringBg.setAttribute('class', 'pr-bg');
  const ringFg = document.createElementNS(SVGNS, 'circle'); ringFg.setAttribute('cx', 50); ringFg.setAttribute('cy', 50); ringFg.setAttribute('r', 44); ringFg.setAttribute('class', 'pr-fg');
  ringFg.style.strokeDasharray = String(C);
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'pr-svg'); svg.setAttribute('aria-hidden', 'true');
  svg.appendChild(ringBg); svg.appendChild(ringFg);
  const pct = h('div', { class: 'pr-pct' }, '0%');
  const msg = h('h3', { class: 'pr-msg' }, t('prog.prep'));
  const sub = h('p', { class: 'muted' }, '');
  const eta = h('p', { class: 'muted sm' }, '');
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('i'));
  const stages = ['prep', 'read', 'study', 'sum', 'q'].map(k => h('li', { class: 'stage', dataset: { k } }, icon('check', 14), h('span', null, t('prog.' + k))));
  paintProgress = () => {
    const rr = Study.run; if (!rr) return;
    ringFg.style.strokeDashoffset = String(C * (1 - rr.pct / 100));
    pct.textContent = Math.round(rr.pct) + '%';
    bar.firstChild.style.width = rr.pct + '%'; bar.setAttribute('aria-valuenow', String(Math.round(rr.pct)));
    msg.textContent = rr.stage === 'read' ? t('prog.reading', { i: Math.min(rr.i + 1, rr.n), n: rr.n }) : t('prog.' + rr.stage);
    sub.textContent = rr.stage === 'read' && rr.n > 1 ? t('prog.pagesdone', { i: rr.i, n: rr.n }) : '';
    eta.textContent = rr.eta != null ? t('prog.eta', { t: fmtDuration(rr.eta) }) : '';
    const order = ['prep', 'read', 'study', 'sum', 'q']; const idx = order.indexOf(rr.stage);
    stages.forEach((li, k) => { li.classList.toggle('done', k < idx); li.classList.toggle('now', k === idx); });
    ringFg.classList.toggle('indet', rr.indeterminate);
  };
  setTimeout(paintProgress, 0);
  return h('div', { class: 'card progress-card center stack', 'aria-live': 'polite' },
    h('div', { class: 'pr-wrap' }, svg, h('div', { class: 'pr-center' }, pct)),
    msg, sub, bar, eta,
    h('ul', { class: 'stages' }, stages),
    h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (Study.run && Study.run.ctrl) Study.run.ctrl.abort(); } }, icon('stop', 16), t('prog.cancel')));
}

async function startAnalysis(root) {
  const d = Study.draft;
  const opts = { level: Prefs.get('level'), summaryLen: Prefs.get('summaryLen'), lang: Prefs.get('lang') };
  const text = d.mode === 'text';
  if (!text && !API.signedIn()) {
    openModal({
      title: t('study.nb.title'), body: h('div', { class: 'stack' }, h('p', null, t('study.nb.body'))),
      actions: [
        { label: t('study.nb.text'), kind: '', onClick: () => { d.mode = 'text'; viewStudy(root); } },
        { label: t('study.demo'), kind: '', onClick: () => { const l = createDemoLesson(); go('#/lesson/' + l.id); } },
        { label: t('study.nb.setup'), kind: 'primary', onClick: () => openAccount() }
      ]
    });
    return;
  }
  const ctrl = new AbortController();
  const n = text ? 1 : d.items.length;
  Study.run = { stage: 'prep', i: 0, n, pct: 2, start: Date.now(), eta: null, ctrl, indeterminate: false };
  viewStudy(root);
  const run = Study.run;
  const times = [];
  const setStage = s => { run.stage = s; paintProgress(); };
  try {
    let pages = [], title = '';
    if (text) {
      pages = [sanitizeText(d.text, 40000)];
      run.pct = 10;
    } else {
      for (let i = 0; i < n; i++) {
        run.i = i; setStage('read');
        const t0 = Date.now();
        let txt = null, lastErr = null;
        for (let attempt = 0; attempt < 3 && txt == null; attempt++) {
          try {
            const r = await API.req('/api/read-page', { body: { image: d.items[i].dataUrl, index: i + 1, total: n, lang: opts.lang }, signal: ctrl.signal, timeout: 70000 });
            txt = sanitizeText(r.text || '', 20000);
          } catch (e) {
            lastErr = e;
            if (e.code === 'aborted' || e.code === 'unauthorized' || e.code === 'no_backend' || e.code === 'bad_url' || e.code === 'offline' || e.code === 'too_large') throw e;
            await new Promise(r => setTimeout(r, 900 * (attempt + 1)));
          }
        }
        if (txt == null) throw lastErr || new ApiError('network');
        pages.push(txt);
        times.push((Date.now() - t0) / 1000);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        run.i = i + 1;
        run.pct = 5 + (run.i / n) * 80;
        run.eta = avg * (n - run.i) + Math.max(6, avg * 2);
        paintProgress();
      }
    }
    if (!pages.join('').trim()) throw new ApiError('empty');
    run.indeterminate = true; run.eta = null; run.pct = Math.max(run.pct, 86); setStage('study');
    let pack;
    if (API.signedIn()) {
      const r = await API.req('/api/study', { body: { text: pages.join('\n\n'), pages, lang: opts.lang, level: opts.level, summaryLen: opts.summaryLen }, signal: ctrl.signal, timeout: 120000 });
      setStage('sum');
      pack = normalizePack(r.pack || r);
      setStage('q');
    } else {
      setStage('sum');
      pack = localPack(pages);
      setStage('q');
    }
    run.pct = 100; run.indeterminate = false; paintProgress();
    const lesson = addLesson({ title: pack.title || title, pages, pack, source: API.signedIn() ? 'ai' : 'local', level: opts.level, pageCount: n });
    Study.draft = { mode: 'images', items: [], text: '', busy: 0 };
    Study.run = null;
    toast(t('study.done'), 'ok');
    go('#/lesson/' + lesson.id);
  } catch (e) {
    Study.run = null;
    if (e && e.code === 'aborted') toast(t('study.cancelled'), 'warn');
    else if (e && e.code === 'empty') toast(t('study.empty'), 'warn');
    else toast(errMsg(e), 'err');
    viewStudy(root);
  }
}

/* ───────────── عرض الدرس ───────────── */
function viewLesson(root, id, tab) {
  const lesson = Store.lesson(id);
  if (!lesson) { mount(root, h('section', { class: 'page' }, emptyState('alert', t('lesson.notfound'), '', h('a', { class: 'btn primary', href: '#/library' }, t('nav.library'))))); return; }
  tab = ['explain', 'summary', 'memorize', 'quiz', 'tutor', 'pages'].includes(tab) ? tab : 'explain';
  const p = lesson.pack;
  const tabs = [['explain', 'book', t('tab.explain')], ['summary', 'list', t('tab.summary')], ['memorize', 'cards', t('tab.memorize')], ['quiz', 'help', t('tab.quiz')], ['tutor', 'sparkles', t('tab.tutor')], ['pages', 'file', t('tab.pages')]];
  const body = h('div', { class: 'lesson-body', id: 'lesson-body' });
  const titleEl = h('h1', { class: 'lesson-title' }, lesson.title);
  const head = h('header', { class: 'lesson-head' },
    h('a', { class: 'icon-btn', href: '#/library', 'aria-label': t('u.back') }, icon(document.documentElement.dir === 'rtl' ? 'chevR' : 'chevL', 22)),
    h('div', { class: 'grow' }, titleEl,
      h('div', { class: 'muted sm row wrap gap6' }, fmtDate(lesson.createdAt), '·', t('lesson.pages', { n: lesson.pageCount }),
        lesson.source === 'demo' ? badge(t('lesson.demo'), 'info') : lesson.source === 'local' ? badge(t('lesson.local'), 'warn') : badge(t('lesson.ai'), 'ok'))),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('lesson.rename'), onclick: () => renameLesson(lesson, titleEl) }, icon('pen', 20)),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('u.share'), onclick: () => shareLesson(lesson) }, icon('share', 20)),
    h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': t('u.delete'), onclick: async () => { if (await confirmBox(t('lesson.del.t'), t('lesson.del.b'), t('u.delete'), true)) { Store.state.lessons = Store.state.lessons.filter(l => l.id !== id); Store.state.deleted[id] = Date.now(); delete Store.state.chats[id]; Object.keys(Store.state.srs).filter(k => k.startsWith(id + ':')).forEach(k => delete Store.state.srs[k]); Store.touch(); toast(t('lesson.deleted')); go('#/library'); } } }, icon('trash', 20)));
  const tabBar = h('nav', { class: 'tabs', 'aria-label': t('lesson.tabs') }, tabs.map(x => h('a', { href: '#/lesson/' + id + '/' + x[0], class: 'tab' + (x[0] === tab ? ' on' : ''), 'aria-current': x[0] === tab ? 'page' : null }, icon(x[1], 18), h('span', null, x[2]))));
  mount(root, h('section', { class: 'page lesson' }, head, tabBar, body));
  const onTab = { explain: tabExplain, summary: tabSummary, memorize: tabMemorize, quiz: tabQuiz, tutor: tabTutor, pages: tabPages }[tab];
  onTab(body, lesson, p);
  const cur = $('.tab.on', tabBar); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
}
async function renameLesson(lesson, el) {
  const inp = h('input', { class: 'input', value: lesson.title, maxlength: '120', 'aria-label': t('lesson.rename') });
  openModal({ title: t('lesson.rename'), body: inp, actions: [{ label: t('u.cancel'), kind: 'ghost' }, { label: t('u.save'), kind: 'primary', onClick: () => { const v = sanitizeText(inp.value, 120).trim(); if (v) { lesson.title = v; lesson.updatedAt = Date.now(); el.textContent = v; Store.touch({ silent: true }); } } }] });
}
function lessonShareText(lesson) {
  const s = lesson.pack.summary.standard;
  return lesson.title + '\n\n' + s.map(x => '• ' + x).join('\n') + '\n\n— StudyMind';
}
async function shareLesson(lesson) {
  const text = lessonShareText(lesson);
  if (navigator.share) { try { await navigator.share({ title: lesson.title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast(t('u.copied'), 'ok'); } catch (e) { toast(t('u.copyfail'), 'warn'); }
}
function readBtn(getText) {
  const b = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => Speech.speak(getText(), b) }, icon('volume', 16), t('speech.read'));
  return b;
}
function sourceNote(kind) { return h('span', { class: 'src-note ' + kind }, kind === 'book' ? t('src.book') : t('src.ai')); }

function tabExplain(body, lesson, p) {
  let level = lesson.level || Prefs.get('level') || 'standard';
  const out = h('div', { class: 'stack' });
  const paint = () => {
    const md = p.explanation[level] || p.explanation.standard || p.overview;
    mount(out,
      p.overview ? h('div', { class: 'card hl' }, h('div', { class: 'row between' }, h('strong', null, t('exp.overview')), sourceNote('book')), h('p', null, p.overview)) : null,
      h('div', { class: 'card stack' }, h('div', { class: 'row between wrap gap' }, h('strong', null, t('exp.explain')), sourceNote('ai')), renderMd(md || t('exp.none')), readBtn(() => md)),
      p.glossary.length ? h('div', { class: 'card stack' }, h('strong', null, t('exp.terms')), h('dl', { class: 'terms' }, p.glossary.map(g => [h('dt', null, g.term), h('dd', null, g.def)]))) : null,
      p.examples.length ? h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('strong', null, t('exp.examples')), sourceNote('ai')), h('ul', null, p.examples.map(x => h('li', null, x)))) : null,
      p.keyFacts.length ? h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('strong', null, t('exp.check')), sourceNote('book')), h('p', { class: 'muted' }, t('exp.check.sub')), h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/lesson/' + lesson.id + '/quiz' }, t('exp.check.go')))) : null);
  };
  mount(body, h('div', { class: 'stack' }, seg([{ value: 'simple', label: t('lvl.simple') }, { value: 'standard', label: t('lvl.standard') }, { value: 'deep', label: t('lvl.deep') }], level, v => { level = v; Speech.stop(); paint(); }, t('study.level')), out));
  paint();
}

function tabSummary(body, lesson, p) {
  let len = Prefs.get('summaryLen') || 'standard';
  const out = h('div', { class: 'stack' });
  const paint = () => {
    const items = p.summary[len] || [];
    mount(out, h('div', { class: 'card stack' },
      h('div', { class: 'row between wrap gap' }, h('strong', null, t('sum.' + len)), sourceNote('book')),
      h('ol', { class: 'points' }, items.map(x => h('li', null, x))),
      h('div', { class: 'row wrap gap' }, readBtn(() => items.join('. ')),
        h('button', { class: 'btn sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(items.map(x => '• ' + x).join('\n')); toast(t('u.copied'), 'ok'); } catch (e) { toast(t('u.copyfail'), 'warn'); } } }, icon('copy', 16), t('u.copy')),
        h('button', { class: 'btn sm', type: 'button', onclick: () => shareLesson(lesson) }, icon('share', 16), t('u.share')))),
      len !== 'detailed' ? h('p', { class: 'muted sm' }, t('sum.note')) : null);
  };
  mount(body, h('div', { class: 'stack' }, seg([{ value: 'quick', label: t('sum.quick') }, { value: 'standard', label: t('sum.standard') }, { value: 'detailed', label: t('sum.detailed') }, { value: 'exam', label: t('sum.exam') }], len, v => { len = v; Speech.stop(); paint(); }, t('sum.len')), out));
  paint();
}

/* ───────────── الحفظ: بطاقات + استرجاع نشط ───────────── */
function deckOf(lesson) {
  const cards = lesson.pack.flashcards.map((c, i) => ({ key: lesson.id + ':c' + i, q: c.q, a: c.a, lesson }));
  const mis = (lesson.pack.mistakes || []).map((c, i) => ({ key: lesson.id + ':m' + i, q: c.q, a: c.a, lesson, mistake: true }));
  return cards.concat(mis);
}
function isDue(key) { const s = Store.state.srs[key]; return !s || s.due <= Date.now(); }
function srsRate(key, known) {
  const s = Store.state.srs[key] || { box: 0 };
  const box = known ? Math.min(5, s.box + 1) : 0;
  const days = [0, 1, 3, 7, 14, 30][box];
  Store.state.srs[key] = { box, due: Date.now() + days * 864e5, at: Date.now() };
  Store.state.stats.reviews = (Store.state.stats.reviews || 0) + 1;
  Store.markStudyDay(); Store.touch({ silent: true });
}
function tabMemorize(body, lesson, p) {
  const deck = deckOf(lesson);
  const due = deck.filter(c => isDue(c.key));
  const area = h('div', { class: 'stack' });
  const home = () => mount(area,
    p.keyFacts.length ? h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('strong', null, t('mem.facts')), sourceNote('book')), h('ul', { class: 'facts' }, p.keyFacts.map(f => h('li', null, f))), readBtn(() => p.keyFacts.join('. '))) : null,
    h('div', { class: 'card stack' }, h('strong', null, t('mem.cards')),
      deck.length ? h('p', { class: 'muted' }, t('mem.cards.sub', { n: deck.length, d: due.length })) : h('p', { class: 'muted' }, t('mem.nocards')),
      deck.length ? h('div', { class: 'row wrap gap' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => session(shuffle(due.length ? due : deck), false) }, icon('cards', 18), due.length ? t('mem.review', { n: due.length }) : t('mem.again')),
        h('button', { class: 'btn', type: 'button', onclick: () => session(shuffle(deck), true) }, icon('pen', 18), t('mem.recall'))) : null));
  const session = (cards, recall) => runCards(area, cards, recall, home);
  mount(body, area); home();
}
function runCards(area, cards, recall, onExit) {
  let i = 0, known = 0, flipped = false; const queue = cards.slice(); const total = cards.length; let seen = 0;
  const paint = () => {
    if (!queue.length) {
      mount(area, h('div', { class: 'card center stack' }, h('div', { class: 'big-ic ok' }, icon('check', 40)), h('h3', null, t('mem.done')), h('p', { class: 'muted' }, t('mem.done.sub', { k: known, n: total })),
        h('button', { class: 'btn primary', type: 'button', onclick: onExit }, t('u.back'))));
      return;
    }
    const c = queue[0]; flipped = false;
    const typed = recall ? h('textarea', { class: 'input', rows: '2', placeholder: t('mem.recall.ph'), 'aria-label': t('mem.recall.ph') }) : null;
    const front = h('div', { class: 'fc-face front' }, h('span', { class: 'fc-tag' }, c.lesson.title), h('p', { class: 'fc-text' }, c.q), recall ? typed : h('span', { class: 'muted sm' }, t('mem.tap')));
    const back = h('div', { class: 'fc-face back' }, h('span', { class: 'fc-tag' }, t('mem.answer')), h('p', { class: 'fc-text' }, c.a));
    const card = h('div', { class: 'fc', tabindex: '0', role: 'button', 'aria-label': t('mem.flip') }, h('div', { class: 'fc-in' }, front, back));
    const rate = h('div', { class: 'row gap center hidden' },
      h('button', { class: 'btn danger-soft', type: 'button', onclick: () => next(false) }, icon('x', 18), t('mem.unknown')),
      h('button', { class: 'btn ok-soft', type: 'button', onclick: () => next(true) }, icon('check', 18), t('mem.known')));
    const flip = () => { flipped = !flipped; card.classList.toggle('flipped', flipped); rate.classList.toggle('hidden', !flipped); };
    card.addEventListener('click', e => { if (e.target.tagName === 'TEXTAREA') return; flip(); });
    card.addEventListener('keydown', e => { if (e.target.tagName === 'TEXTAREA') return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    const next = ok => { srsRate(c.key, ok); queue.shift(); seen++; if (ok) known++; else queue.push(c); paint(); };
    const done = total - new Set(queue.map(x => x.key)).size;
    mount(area, h('div', { class: 'stack' },
      h('div', { class: 'row between' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: onExit }, icon('x', 16), t('u.exit')), h('span', { class: 'muted', dir: 'ltr' }, done + ' / ' + total)),
      h('div', { class: 'bar' }, h('i', { style: { width: (done / total * 100) + '%' } })),
      card, recall ? h('div', { class: 'row center' }, h('button', { class: 'btn', type: 'button', onclick: () => { if (!flipped) flip(); } }, icon('eye', 16), t('mem.reveal'))) : null, rate));
  };
  paint();
}

/* ───────────── الاختبارات ───────────── */
function tabQuiz(body, lesson, p) {
  const area = h('div', { class: 'stack' });
  mount(body, area);
  const home = () => {
    const n = p.quiz.length;
    const hist = Store.state.stats.quizzes.filter(q => q.lessonId === lesson.id).slice(-5).reverse();
    mount(area,
      h('div', { class: 'card stack' }, h('strong', null, t('quiz.title')),
        n ? h('p', { class: 'muted' }, t('quiz.sub', { n })) : h('p', { class: 'muted' }, t('quiz.none')),
        n ? h('div', { class: 'row wrap gap' },
          [5, 10, n].filter((v, i, a) => v <= n && a.indexOf(v) === i).map(c => h('button', { class: 'btn' + (c === Math.min(10, n) ? ' primary' : ''), type: 'button', onclick: () => start(c) }, c === n && n > 10 ? t('quiz.all', { n }) : t('quiz.count', { n: c })))) : null),
      hist.length ? h('div', { class: 'card stack' }, h('strong', null, t('quiz.history')), h('ul', { class: 'hist' }, hist.map(q => h('li', null, h('span', null, fmtDate(q.at)), h('strong', null, q.score + '/' + q.total))))) : null);
  };
  const start = count => {
    const qs = shuffle(p.quiz).slice(0, count).map(q => {
      if (q.type !== 'mcq') return q;
      const idx = shuffle(q.options.map((_, i) => i));
      return Object.assign({}, q, { options: idx.map(i => q.options[i]), answer: idx.indexOf(q.answer) });
    });
    let i = 0, score = 0; const wrong = [];
    const ask = () => {
      if (i >= qs.length) return finish();
      const q = qs[i]; let answered = false;
      const fb = h('div', { class: 'feedback hidden', 'aria-live': 'polite' });
      const nextBtn = h('button', { class: 'btn primary hidden', type: 'button', onclick: () => { i++; ask(); } }, i === qs.length - 1 ? t('quiz.finish') : t('quiz.next'));
      const result = (ok, given) => {
        if (answered) return; answered = true;
        if (ok) score++; else wrong.push(q);
        const ans = q.type === 'mcq' ? q.options[q.answer] : q.type === 'tf' ? (q.answer ? t('quiz.true') : t('quiz.false')) : q.answer[0];
        mount(fb, h('strong', { class: ok ? 'ok-t' : 'err-t' }, ok ? t('quiz.right') : t('quiz.wrong')), !ok ? h('p', null, t('quiz.correct'), ': ', h('b', null, ans)) : null, q.explanation ? h('p', { class: 'muted' }, q.explanation) : null, q.page ? h('p', { class: 'muted sm' }, t('quiz.page', { n: q.page })) : null);
        fb.classList.remove('hidden', 'ok', 'bad'); fb.classList.add(ok ? 'ok' : 'bad'); nextBtn.classList.remove('hidden'); setTimeout(() => { if (nextBtn.isConnected) nextBtn.focus(); }, 300);
      };
      let inputs;
      if (q.type === 'mcq') {
        inputs = h('div', { class: 'opts' }, q.options.map((o, k) => h('button', { class: 'opt', type: 'button', onclick: e => { if (answered) return; $$('.opt', inputs).forEach((b, j) => { if (j === q.answer) b.classList.add('right'); }); if (k !== q.answer) e.currentTarget.classList.add('wrong'); result(k === q.answer); } }, h('span', { class: 'opt-k' }, String.fromCharCode(65 + k)), h('span', null, o))));
      } else if (q.type === 'tf') {
        inputs = h('div', { class: 'opts row' }, [true, false].map(v => h('button', { class: 'opt', type: 'button', onclick: e => { if (answered) return; e.currentTarget.classList.add(v === q.answer ? 'right' : 'wrong'); result(v === q.answer); } }, v ? t('quiz.true') : t('quiz.false'))));
      } else {
        const inp = h('input', { class: 'input', type: 'text', autocomplete: 'off', placeholder: t('quiz.fill.ph'), maxlength: '200', 'aria-label': t('quiz.fill.ph') });
        const submit = () => { if (answered) return; const g = norm(inp.value); if (!g) return; result(q.answer.some(a => norm(a) === g || (g.length > 3 && norm(a).includes(g))), inp.value); inp.disabled = true; };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        inputs = h('div', { class: 'row gap' }, inp, h('button', { class: 'btn primary', type: 'button', onclick: submit }, t('quiz.check')));
      }
      mount(area, h('div', { class: 'card stack' },
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, t('quiz.q', { i: i + 1, n: qs.length })), h('button', { class: 'btn ghost sm', type: 'button', onclick: home }, icon('x', 16), t('u.exit'))),
        h('div', { class: 'bar' }, h('i', { style: { width: (i / qs.length * 100) + '%' } })),
        h('h3', { class: 'q-text' }, q.q), inputs, fb, nextBtn));
    };
    const finish = () => {
      const pct = Math.round(score / qs.length * 100);
      Store.state.stats.quizzes.push({ lessonId: lesson.id, score, total: qs.length, at: Date.now() });
      Store.markStudyDay();
      let added = 0;
      for (const q of wrong) {
        const ans = q.type === 'mcq' ? q.options[q.answer] : q.type === 'tf' ? (q.answer ? t('quiz.true') : t('quiz.false')) : q.answer[0];
        const card = { q: q.q, a: ans + (q.explanation ? ' — ' + q.explanation : '') };
        if (!lesson.pack.mistakes.some(m => m.q === card.q)) { lesson.pack.mistakes.push(card); added++; }
      }
      lesson.updatedAt = Date.now(); Store.touch();
      mount(area, h('div', { class: 'card center stack' },
        h('div', { class: 'score-ring' }, h('strong', null, pct + '%'), h('span', null, score + '/' + qs.length)),
        h('h3', null, pct >= 80 ? t('quiz.res.great') : pct >= 50 ? t('quiz.res.good') : t('quiz.res.keep')),
        wrong.length ? h('p', { class: 'muted' }, t('quiz.res.review', { n: wrong.length }), added ? ' ' + t('quiz.res.added', { n: added }) : '') : h('p', { class: 'muted' }, t('quiz.res.perfect')),
        h('div', { class: 'row wrap gap center' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => start(count) }, icon('refresh', 16), t('quiz.again')),
          wrong.length ? h('a', { class: 'btn', href: '#/lesson/' + lesson.id + '/memorize' }, icon('cards', 16), t('quiz.review')) : null,
          h('button', { class: 'btn ghost', type: 'button', onclick: home }, t('u.back')))));
    };
    ask();
  };
  home();
}

/* ───────────── المساعد (AI Tutor) ───────────── */
function localAnswer(lesson, q) {
  const qw = new Set(norm(q).split(' ').filter(w => w.length > 2 && !STOP.has(w)));
  if (!qw.size) return null;
  const cand = [];
  lesson.pages.forEach((pg, pi) => splitSentences(pg).forEach(s => { const ws = norm(s).split(' '); let sc = 0; for (const w of ws) if (qw.has(w)) sc++; if (sc) cand.push({ s, pi, sc }); }));
  cand.sort((a, b) => b.sc - a.sc);
  const top = cand.slice(0, 3);
  if (!top.length) return null;
  return t('chat.local.intro') + '\n\n' + top.map(x => '- ' + x.s + ' (' + t('quiz.page', { n: x.pi + 1 }) + ')').join('\n');
}
function tabTutor(body, lesson, p) {
  const hist = Store.state.chats[lesson.id] || (Store.state.chats[lesson.id] = []);
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const inp = h('textarea', { class: 'input', rows: '1', maxlength: '1000', placeholder: t('chat.ph'), 'aria-label': t('chat.ph') });
  let busy = false, rec = null;
  const bubble = m => h('div', { class: 'msg ' + m.role }, m.role === 'assistant' ? renderMd(m.content) : h('p', null, m.content));
  const paint = () => {
    mount(log, hist.length ? hist.map(bubble) : h('div', { class: 'muted center' }, t('chat.empty')));
    log.scrollTop = log.scrollHeight;
  };
  const send = async text => {
    text = sanitizeText(text, 1000).trim(); if (!text || busy) return;
    busy = true; inp.value = ''; hist.push({ role: 'user', content: text }); paint();
    const wait = h('div', { class: 'msg assistant typing' }, h('span'), h('span'), h('span')); log.appendChild(wait); log.scrollTop = log.scrollHeight;
    let reply = null;
    if (API.signedIn()) {
      try {
        const ctx = { title: lesson.title, summary: p.summary.standard, keyFacts: p.keyFacts, text: lesson.pages.join('\n\n').slice(0, 14000) };
        const r = await API.req('/api/chat', { body: { messages: hist.slice(-12), context: ctx, lang: Prefs.get('lang') }, timeout: 60000 });
        reply = sanitizeText(r.reply || '', 6000);
      } catch (e) { reply = '⚠️ ' + errMsg(e); }
    } else {
      reply = localAnswer(lesson, text) || t('chat.local.none');
    }
    wait.remove(); hist.push({ role: 'assistant', content: reply || t('chat.local.none') });
    if (hist.length > 60) hist.splice(0, hist.length - 60);
    lesson.updatedAt = Date.now(); Store.touch({ silent: true }); busy = false; paint();
  };
  const sugg = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4'].map(k => h('button', { class: 'chip', type: 'button', onclick: () => send(t(k)) }, t(k)));
  const mic = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.mic'), onclick: () => { if (rec) { try { rec.stop(); } catch (e) { /* */ } return; } mic.classList.add('on'); rec = Speech.listen(tx => send(tx), () => { mic.classList.remove('on'); rec = null; }); if (!rec) mic.classList.remove('on'); } }, icon('mic', 20));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value); } });
  mount(body, h('div', { class: 'card chat' },
    !API.signedIn() ? h('div', { class: 'notice sm' }, icon('info', 16), h('div', null, t('chat.nobackend'))) : null,
    log, h('div', { class: 'chips' }, sugg),
    h('div', { class: 'chat-in' }, mic, inp, h('button', { class: 'icon-btn primary', type: 'button', 'aria-label': t('chat.send'), onclick: () => send(inp.value) }, icon('send', 20))),
    hist.length ? h('button', { class: 'link-btn sm', type: 'button', onclick: () => { hist.length = 0; Store.touch({ silent: true }); paint(); } }, t('chat.clear')) : null));
  paint();
}

function tabPages(body, lesson) {
  mount(body, h('div', { class: 'stack' },
    h('p', { class: 'muted' }, t('pages.note')),
    lesson.pages.map((pg, i) => h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('strong', null, t('study.page', { n: i + 1 })), h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(pg); toast(t('u.copied'), 'ok'); } catch (e) { toast(t('u.copyfail'), 'warn'); } } }, icon('copy', 16), t('u.copy'))),
      h('p', { class: 'page-text', dir: 'auto' }, pg || t('pages.empty'))))));
}

/* ───────────── المراجعة الذكية (كل الدروس) ───────────── */
function viewReview(root) {
  const all = [];
  for (const l of Store.state.lessons) for (const c of deckOf(l)) all.push(c);
  const due = all.filter(c => isDue(c.key));
  const area = h('div', { class: 'stack' });
  const home = () => mount(area, h('div', { class: 'card stack center' },
    h('div', { class: 'big-ic' }, icon('cards', 40)),
    all.length ? h('h3', null, t('rev.due', { n: due.length })) : h('h3', null, t('rev.none')),
    h('p', { class: 'muted' }, all.length ? t('rev.sub', { n: all.length }) : t('rev.none.sub')),
    due.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => runCards(area, shuffle(due).slice(0, 30), false, () => viewReview(root)) }, icon('play', 16), t('rev.start')) : h('a', { class: 'btn primary', href: '#/study' }, t('home.upload'))));
  mount(root, h('section', { class: 'page' }, pageHead(t('rev.title'), t('rev.head')), area));
  home();
}

/* ───────────── المعلّم الذكي العام (بدون درس محدّد) ───────────── */
function viewTutor(root) {
  const hist = Store.state.chats._free || (Store.state.chats._free = []);
  const log = h('div', { class: 'chat-log tall', 'aria-live': 'polite' });
  const inp = h('textarea', { class: 'input', rows: '1', maxlength: '1000', placeholder: t('chat.ph.free'), 'aria-label': t('chat.ph.free') });
  let busy = false, rec = null;
  const bubble = m => h('div', { class: 'msg ' + m.role }, m.role === 'assistant' ? renderMd(m.content) : h('p', null, m.content),
    m.role === 'assistant' ? h('button', { class: 'link-btn sm', type: 'button', onclick: () => Speech.speak(m.content, null) }, icon('volume', 14), t('u.listen')) : null);
  const paint = () => { mount(log, hist.length ? hist.map(bubble) : h('div', { class: 'muted center' }, t('tutor.empty'))); log.scrollTop = log.scrollHeight; };
  const send = async text => {
    text = sanitizeText(text, 1000).trim(); if (!text || busy) return;
    if (!API.signedIn()) { openAccount(); return; }
    busy = true; inp.value = ''; hist.push({ role: 'user', content: text }); paint();
    const wait = h('div', { class: 'msg assistant typing' }, h('span'), h('span'), h('span')); log.appendChild(wait); log.scrollTop = log.scrollHeight;
    let reply;
    try { const r = await API.req('/api/chat', { body: { messages: hist.slice(-16), lang: Prefs.get('lang') }, timeout: 60000 }); reply = sanitizeText(r.reply || '', 8000); }
    catch (e) { reply = '⚠️ ' + errMsg(e); hist.pop(); }
    wait.remove();
    if (reply.startsWith('⚠️')) { toast(reply, 'err'); inp.value = text; } else hist.push({ role: 'assistant', content: reply });
    if (hist.length > 80) hist.splice(0, hist.length - 80);
    Store.touch({ silent: true }); busy = false; paint();
  };
  const sugg = ['tutor.s1', 'tutor.s2', 'tutor.s3', 'tutor.s4'].map(k => h('button', { class: 'chip', type: 'button', onclick: () => send(t(k)) }, t(k)));
  const mic = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('chat.mic'), onclick: () => { if (rec) { try { rec.stop(); } catch (e) { /* */ } return; } mic.classList.add('on'); rec = Speech.listen(tx => send(tx), () => { mic.classList.remove('on'); rec = null; }); if (!rec) mic.classList.remove('on'); } }, icon('mic', 20));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value); } });
  mount(root, h('section', { class: 'page' }, pageHead(t('tutor.title'), t('tutor.sub')),
    h('div', { class: 'card chat' },
      !API.signedIn() ? h('div', { class: 'notice sm' }, icon('info', 16), h('div', null, t('chat.nobackend')), h('button', { class: 'btn sm primary', type: 'button', onclick: () => openAccount() }, t('acct.login'))) : null,
      log, h('div', { class: 'chips' }, sugg),
      h('div', { class: 'chat-in' }, mic, inp, h('button', { class: 'icon-btn primary', type: 'button', 'aria-label': t('chat.send'), onclick: () => send(inp.value) }, icon('send', 20))),
      hist.length ? h('button', { class: 'link-btn sm', type: 'button', onclick: () => { hist.length = 0; Store.touch({ silent: true }); paint(); } }, t('chat.clear')) : null)));
  paint();
}
