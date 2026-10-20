/* StudyMind — خادم مثال (Node 18+، بدون أي حزم خارجية)
 * يوفّر: الحسابات السحابية + المزامنة + قراءة صور الصفحات + التحليل + المساعد.
 * مفتاح الذكاء الاصطناعي يبقى هنا في الخادم فقط (متغيرات البيئة)، ولا يصل للمتصفح أبدًا.
 *
 * التشغيل:   GEMINI_API_KEY=xxxx SECRET=سلسلة_طويلة_عشوائية ALLOWED_ORIGIN=https://USER.github.io node server-example.js
 * تجربة بدون مفتاح:   MOCK=1 node server-example.js
 * لإجبار تسجيل الدخول قبل استخدام الذكاء الاصطناعي: REQUIRE_LOGIN=1
 */
'use strict';
const http = require('http'), fs = require('fs'), crypto = require('crypto');

const PORT = +process.env.PORT || 8787;
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString('hex');
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DB_FILE = process.env.DB_FILE || './studymind-data.json';
const MOCK = process.env.MOCK === '1';
const KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_BODY = 14 * 1024 * 1024;
if (!process.env.SECRET) console.warn('⚠ SECRET غير مضبوط: ستنتهي الجلسات عند إعادة التشغيل.');
if (ORIGIN === '*') console.warn('⚠ ALLOWED_ORIGIN=* للتجربة فقط. حدّد رابط تطبيقك عند النشر.');

/* ── تخزين بسيط (ملف JSON). للإنتاج استبدله بقاعدة بيانات (Supabase/Postgres…) ── */
let db = { users: {}, sync: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { /* جديد */ }
let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(DB_FILE, JSON.stringify(db), () => { }), 300); };

/* ── أمان: كلمات المرور (scrypt) + رموز موقّعة (HMAC) ── */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const b64u = b => Buffer.from(b).toString('base64url');
function makeToken(uid) { const p = b64u(JSON.stringify({ uid, exp: Date.now() + 30 * 864e5 })); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); }
function readToken(tok) {
  const [p, s] = String(tok || '').split('.'); if (!p || !s) return null;
  const good = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d.uid : null; } catch (e) { return null; }
}
const hits = new Map();
function limited(ip, max, ms) { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < ms); a.push(now); hits.set(ip, a); return a.length > max; }
setInterval(() => hits.clear(), 3600e3).unref();

/* ── الذكاء الاصطناعي (Gemini) ── */
async function gemini(parts, json) {
  if (MOCK) return null;
  if (!KEY) throw Object.assign(new Error('GEMINI_API_KEY missing'), { status: 500 });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.4 } : { temperature: 0.5 } })
  });
  if (!r.ok) throw Object.assign(new Error('ai ' + r.status), { status: 502 });
  const d = await r.json();
  return (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || []).map(p => p.text || '').join('');
}
const LANG = l => (l === 'en' ? 'English' : 'Arabic (العربية)');
const PACK_SPEC = `Return ONLY JSON: {"title":str,"overview":str,"explanation":{"simple":md,"standard":md,"deep":md},"summary":{"quick":[str],"standard":[str],"detailed":[str],"exam":[str]},"keyFacts":[str],"glossary":[{"term":str,"def":str}],"examples":[str],"flashcards":[{"q":str,"a":str}],"quiz":[{"type":"mcq"|"tf"|"fill","q":str,"options":[str] (mcq only),"answer": mcq=index number | tf=true/false | fill=[accepted strings],"explanation":str,"page":number}]}.
Rules: base overview/summary/keyFacts/glossary/flashcards/quiz ONLY on the provided book text; never invent facts and attribute them to the book. "examples" and the explanations may add clarifying material. Provide 8-15 flashcards and 8-12 quiz questions mixing types. Never drop a key definition or step when shortening.`;

const routes = {
  'GET /api/health': async () => ({ ok: true, name: 'StudyMind API', mock: MOCK }),

  'POST /api/auth/register': async (req, b, ip) => {
    if (limited('reg' + ip, 8, 3600e3)) throw { status: 429 };
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120), name = String(b.name || '').trim().slice(0, 60), pw = String(b.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || pw.length < 8 || pw.length > 100 || !name) throw { status: 400, msg: 'invalid data' };
    if (db.users[email]) throw { status: 409, msg: 'email already registered' };
    const salt = crypto.randomBytes(16).toString('hex');
    db.users[email] = { id: crypto.randomUUID(), name, email, salt, hash: hashPw(pw, salt), createdAt: Date.now() }; save();
    const u = db.users[email]; return { token: makeToken(u.id), user: { name, email } };
  },
  'POST /api/auth/login': async (req, b, ip) => {
    if (limited('log' + ip, 20, 900e3)) throw { status: 429 };
    const u = db.users[String(b.email || '').trim().toLowerCase()];
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(b.password || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!ok) throw { status: 401 };
    return { token: makeToken(u.id), user: { name: u.name, email: u.email } };
  },
  'GET /api/me': async (req, b, ip, uid) => { const u = Object.values(db.users).find(x => x.id === uid); if (!u) throw { status: 401 }; return { user: { name: u.name, email: u.email } }; },
  'GET /api/sync': async (req, b, ip, uid) => ({ data: db.sync[uid] || null }),
  'PUT /api/sync': async (req, b, ip, uid) => { if (!b.data || typeof b.data !== 'object') throw { status: 400 }; db.sync[uid] = b.data; save(); return { ok: true, at: Date.now() }; },

  'POST /api/read-page': async (req, b, ip, uid) => {
    if (limited('rp' + (uid || ip), 200, 3600e3)) throw { status: 429 };
    const m = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
    if (!m) throw { status: 400, msg: 'bad image' };
    if (MOCK) return { text: `Page ${b.index}: Photosynthesis is the process by which plants make food using sunlight. Chlorophyll is the green pigment that absorbs light. Stomata are tiny openings that control gas exchange.` };
    const text = await gemini([{ text: `Transcribe all text on this book page exactly, in reading order, keeping headings, lists, formulas and table structure. Language of the page may be Arabic or English. Output plain text only.` }, { inline_data: { mime_type: m[1], data: m[2] } }]);
    return { text: String(text || '').slice(0, 20000) };
  },
  'POST /api/study': async (req, b, ip, uid) => {
    if (limited('st' + (uid || ip), 60, 3600e3)) throw { status: 429 };
    const text = String(b.text || '').slice(0, 60000); if (text.trim().length < 30) throw { status: 400, msg: 'text too short' };
    if (MOCK) return { pack: { title: 'Photosynthesis (mock)', overview: 'Plants make food from light.', explanation: { simple: '### Simple\nPlants cook with sunlight.', standard: '### Standard\nChlorophyll absorbs light to make **glucose**.', deep: '### Deep\nWater + CO2 + light → glucose + O2.' }, summary: { quick: ['Plants make food from light.'], standard: ['Chlorophyll absorbs light.', 'Stomata exchange gases.'], detailed: ['Chlorophyll absorbs light.', 'Stomata exchange gases.', 'Glucose is energy.'], exam: ['Inputs: water, CO2, light.'] }, keyFacts: ['Chlorophyll is the green pigment.'], glossary: [{ term: 'Stomata', def: 'Tiny leaf openings for gas exchange' }], examples: ['A plant in the dark weakens.'], flashcards: [{ q: 'What is chlorophyll?', a: 'The green pigment that absorbs light.' }], quiz: [{ type: 'mcq', q: 'What absorbs light?', options: ['Roots', 'Chlorophyll', 'Stomata'], answer: 1, explanation: 'Chlorophyll absorbs light energy.' }, { type: 'tf', q: 'Photosynthesis happens in roots.', answer: false, explanation: 'It happens in leaf chloroplasts.' }, { type: 'fill', q: 'Tiny openings in leaves are called _____.', answer: ['stomata'], explanation: 'Stomata control gas exchange.' }] } };
    const out = await gemini([{ text: `You are an expert teacher. Write all output in ${LANG(b.lang)}. Preferred explanation level: ${b.level || 'standard'}.\n${PACK_SPEC}\n\nBOOK TEXT (pages separated by blank lines):\n${text}` }], true);
    let pack; try { pack = JSON.parse(String(out).replace(/^```json\s*|```$/g, '')); } catch (e) { throw { status: 502, msg: 'bad ai json' }; }
    return { pack };
  },
  'POST /api/chat': async (req, b, ip, uid) => {
    if (limited('ch' + (uid || ip), 120, 3600e3)) throw { status: 429 };
    const ctx = b.context || {}, msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-12);
    if (MOCK) return { reply: '**Mock tutor:** ' + String((msgs[msgs.length - 1] || {}).content || '').slice(0, 100) };
    const hist = msgs.map(m => (m.role === 'user' ? 'Student: ' : 'Tutor: ') + String(m.content).slice(0, 1000)).join('\n');
    const reply = await gemini([{ text: `You are a patient tutor. Answer in ${LANG(b.lang)} using the lesson below. If the answer is not in the lesson text, say so clearly, then give general help marked as "outside the book". Use short markdown.\n\nLESSON "${String(ctx.title || '').slice(0, 120)}":\n${String(ctx.text || '').slice(0, 14000)}\n\nCONVERSATION:\n${hist}\nTutor:` }]);
    return { reply: String(reply || '').slice(0, 6000) };
  }
};

http.createServer(async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  const send = (s, o) => { res.writeHead(s, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const path = req.url.split('?')[0], r = routes[req.method + ' ' + path];
  if (!r) return send(404, { error: 'not found' });
  try {
    let body = {}; if (req.method !== 'GET') {
      const chunks = []; let n = 0;
      for await (const c of req) { n += c.length; if (n > MAX_BODY) return send(413, { error: 'too large' }); chunks.push(c); }
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { return send(400, { error: 'bad json' }); }
    }
    const open = ['GET /api/health', 'POST /api/auth/register', 'POST /api/auth/login'].includes(req.method + ' ' + path);
    const uid = readToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    const needAuth = !open && (path === '/api/sync' || path === '/api/me' || process.env.REQUIRE_LOGIN === '1');
    if (needAuth && !uid) return send(401, { error: 'unauthorized' });
    send(200, await r(req, body, ip, uid));
  } catch (e) {
    if (e && e.status) return send(e.status, { error: e.msg || 'error' });
    console.error('internal:', e && e.message); send(500, { error: 'server error' });
  }
}).listen(PORT, () => console.log('StudyMind API on :' + PORT + (MOCK ? ' (MOCK)' : '')));
