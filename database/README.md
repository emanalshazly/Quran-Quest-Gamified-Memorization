# قاعدة البيانات

## ترتيب التشغيل

1. `schemas/001_initial_schema.sql` — الجداول، الـ triggers، الدوال، وسياسات RLS.
2. `schemas/003_offline_sync.sql` — جدول منع تكرار العمليات المرسلة بعد العمل دون اتصال.
3. بيانات القرآن الكريم (114 سورة، 6236 آية) بإحدى الطريقتين:
   - **عبر الـ API (الأسهل):** `cd backend && npm run seed:quran` — يحتاج `SUPABASE_URL` و `SUPABASE_SERVICE_KEY` في `backend/.env`.
   - **عبر SQL:** تشغيل `seeds/002_quran_data.sql` (حوالي 1.9MB). لو رفضه محرر SQL في Supabase بسبب الحجم، استخدم `psql` أو الطريقة الأولى.

الطريقتان آمنتان للتشغيل أكثر من مرة.

## مصدر نص القرآن

- `data/quran-uthmani.txt` و `data/quran-data.js` نسختان **حرفيتان** من [مشروع تنزيل (Tanzil)](https://tanzil.net) — النص العثماني، الإصدار 1.1، برخصة Creative Commons Attribution 3.0.
- شروط الرخصة: **يُمنع تعديل النص**، ويجب ذكر المصدر (Tanzil) مع رابط tanzil.net، وإبقاء إشعار الحقوق في الملفات المشتقة. لذلك لا تُعدَّل هذه الملفات يدوياً أبداً، والتطبيق يذكر المصدر في شاشة الإعدادات.
- `seeds/002_quran_data.sql` ملف **مولَّد** من هذين الملفين عبر `node database/seeds/generate-quran-seed.js`. المولِّد يتحقق من عدد الآيات (6236) ومن عدد آيات كل سورة مقابل بيانات Tanzil.

### البسملة

ملف Tanzil يضع البسملة في بداية الآية الأولى من كل سورة (عدا الفاتحة حيث هي الآية الأولى نفسها، والتوبة التي لا بسملة فيها). تُحفظ البسملة كما هي في العمود `verses.bismillah_prefix` بدلاً من داخل `text_ar`، حتى يطابق نص الآية ترقيمها وملفها الصوتي. ضم العمودين يعيد سطر المصدر حرفياً.

## التلاوات الصوتية

ملف صوتي لكل آية من [everyayah.com](https://everyayah.com) بالصيغة `{folder}/{SSS}{AAA}.mp3`:

| القارئ | `preferred_reciter` | المجلد |
|--------|--------------------|--------|
| محمد صديق المنشاوي | `minshawi` | `Minshawy_Murattal_128kbps` |
| عبد الباسط عبد الصمد | `abdulbasit` | `Abdul_Basit_Murattal_64kbps` |
| ماهر المعيقلي | `maher` | `MaherAlMuaiqly128kbps` |

العمود `verses.audio_url` يحمل رابط المنشاوي كقيمة افتراضية، والتطبيق يبني الرابط حسب قارئ الطفل المفضل (`mobile/src/utils/audio.js`).
