# StudyMind v1.1 — الإعداد النهائي (Supabase)

التطبيق مربوط داخليًا بمشروع Supabase المخصص `chyltyhlhpgxndflznvv` (مستقل عن بقية مشاريعك) والرابط ثابت:
https://2009malek11-source.github.io/StudyMind/ — المستخدم لا يرى أي رابط خادم؛ يسجّل بـ Google أو البريد فقط.

## خطوات لوحة Supabase (مرة واحدة)
1. **Authentication → URL Configuration**: Site URL = `https://2009malek11-source.github.io/StudyMind/` وأضفه في Redirect URLs.
2. **Authentication → Providers → Google**: فعّله وضع Client ID/Secret من Google Cloud (Callback: `https://chyltyhlhpgxndflznvv.supabase.co/auth/v1/callback`).
3. **Edge Functions → Secrets**: أضف `GEMINI_API_KEY` (من aistudio.google.com). اختياري: `DAILY_LIMIT`, `GEMINI_MODEL`.
4. (اختياري) Authentication → SMTP لإرسال رسائل التفعيل بحدّ أعلى.

---

# StudyMind — تعلّم · افهم · انمُ

تطبيق PWA لتحويل صور صفحات الكتب إلى شرح وملخص وبطاقات حفظ واختبارات ومساعد ذكي.
يعمل على Android وiPhone وسطح المكتب، ومن أي متصفح حديث، ويُنشر كملفات ثابتة على GitHub Pages.

## 1) النشر على GitHub Pages (دقيقتان)
1. أنشئ مستودعًا جديدًا (مثلًا `studymind`) وارفع **كل** ملفات هذا المجلد في الجذر مباشرة (بدون مجلدات).
2. Settings ← Pages ← Source: `Deploy from a branch` ← Branch: `main` / `(root)`.
3. افتح الرابط `https://USERNAME.github.io/studymind/` — هذا هو رابط التطبيق.
4. ضع هذا الرابط في **الإعدادات ← المشاركة ← رابط التطبيق للمشاركة** (أو في `CONFIG.SHARE_URL` داخل `core.js`)، وتأكد أن الباركود `share-qr.png` يشير إلى الرابط نفسه.

## 2) التثبيت كتطبيق
- **iPhone:** افتح الرابط في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية».
- **Android/Chrome:** قائمة ⋮ ← «تثبيت التطبيق» (أو زر «تثبيت» داخل الإعدادات).
- **الكمبيوتر:** أيقونة التثبيت في شريط العنوان.
الحد الأدنى الموصى به: iOS 16.4+ / Chrome 111+ / Safari 16.4+ / Firefox 113+.

## 3) ربط الخادم (الرابط الذي ستعطيه لاحقًا)
أبسط طريقة: افتح **الإعدادات ← الخادم والسحابة** وألصق الرابط ثم «اختبار الاتصال».
أو ثبّته في الكود: `CONFIG.BACKEND_URL` داخل `core.js`.

> لا تضع مفاتيح الذكاء الاصطناعي في ملفات الواجهة أبدًا. تبقى في الخادم فقط.

### عقد الواجهة (API) — يجب أن يوفّرها خادمك
| الطريقة | المسار | الجسم | الاستجابة |
|---|---|---|---|
| GET | `/api/health` | — | `{ok:true,name}` |
| POST | `/api/auth/register` | `{name,email,password}` | `{token,user:{name,email}}` |
| POST | `/api/auth/login` | `{email,password}` | `{token,user}` |
| GET/PUT | `/api/sync` | PUT: `{data,updatedAt}` | GET: `{data}` (يتطلب `Authorization: Bearer`) |
| POST | `/api/read-page` | `{image:dataURL(jpeg),index,total,lang}` | `{text}` — استخراج نص صفحة واحدة |
| POST | `/api/study` | `{text,pages[],lang,level,summaryLen}` | `{pack}` |
| POST | `/api/chat` | `{messages[],context:{title,summary,keyFacts,text},lang}` | `{reply}` |

شكل `pack`: `title, overview, explanation{simple,standard,deep}(markdown), summary{quick,standard,detailed,exam}[], keyFacts[], glossary[{term,def}], examples[], flashcards[{q,a}], quiz[{type:'mcq'|'tf'|'fill',q,options?,answer,explanation,page?}]`.
التطبيق يعالج الصفحات **واحدة تلو الأخرى** عبر `/api/read-page`، لذلك شريط التقدّم حقيقي وليس شكليًا.
يجب أن يسمح الخادم بـ CORS لأصل تطبيقك (`https://USERNAME.github.io`).

### خادم جاهز للتجربة: `server-example.js`
```bash
MOCK=1 node server-example.js                       # تجربة بدون أي مفتاح
GEMINI_API_KEY=... SECRET=... ALLOWED_ORIGIN=https://USERNAME.github.io node server-example.js
```
يوفّر الحسابات (scrypt + رموز موقّعة) والمزامنة وقراءة الصور والتحليل والمساعد عبر Gemini، بدون أي حزم. التخزين ملف JSON للتجربة؛ للإنتاج استبدله بقاعدة بيانات (مثل Supabase/Postgres) وانشره على Render أو Railway أو Fly.io عبر HTTPS.
`REQUIRE_LOGIN=1` يمنع استخدام الذكاء الاصطناعي قبل تسجيل الدخول لتفادي استنزاف رصيدك.

## 4) بدون خادم؟
- «لصق نص» ينتج تحليلًا محليًا مبسّطًا (جمل مفتاحية + بطاقات من التعريفات + أسئلة).
- «درس تجريبي» يعرض كل الواجهات.
- تحليل **الصور** والمساعد الذكي يحتاجان خادمًا.

## 5) الأمان
- CSP صارم (`script-src 'self'`، بدون inline scripts/styles، بدون eval).
- كل نص من المستخدم أو الذكاء الاصطناعي يُعرض بـ `textContent`؛ عارض Markdown يبني عناصر DOM ولا يستخدم `innerHTML`.
- الروابط الخارجية بـ `rel="noopener noreferrer"`، و`referrer: no-referrer`.
- البيانات المحلية مشفّرة بـ AES-GCM (مفتاح غير قابل للتصدير في IndexedDB). تحمي من الاطلاع العابر لا من شخص يملك المتصفح نفسه.
- لا تُخزَّن صور الصفحات، النص المستخرج فقط. الأخطاء تُعرض برسائل عامة بدون تفاصيل داخلية.
- طلبات الخادم لا تُخزَّن في كاش الـ Service Worker ولا ترسل Cookies.

## 6) تحديث النسخة
غيّر `VERSION` في `sw.js` عند كل نشر ليتلقّى المستخدمون إشعار «يتوفر إصدار جديد».

## الملفات
`index.html` `style.css` `core.js` `i18n.js` `study.js` `app.js` `manifest.json` `sw.js` + الأيقونات والشعار (`logo*.png`, `body.png`, `cap*.png`, `wordmark*.png`, `tagline*.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.png`, `og-image.png`) + `share-qr.png` + `server-example.js`.
