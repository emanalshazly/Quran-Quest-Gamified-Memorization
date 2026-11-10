# 🌟 Quran Quest: Gamified Memorization

<div align="center">

**تطبيق تفاعلي لحفظ القرآن الكريم للأطفال مع نظام Gamification متقدم**

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-orange.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) | [العربية](#arabic)

</div>

---

## 📖 نظرة عامة

**Quran Quest** هو تطبيق تعليمي إسلامي مُلعب يحوّل حفظ القرآن الكريم إلى رحلة مغامرة مُشوقة للأطفال (5-15 سنة). يستخدم التطبيق:

- ✅ **Gamification مكثف**: نظام نقاط، شارات، مستويات، ومعارك
- ✅ **SM-2 Algorithm**: للمراجعة المتباعدة الذكية
- ✅ **Parent Dashboard**: لوحة للوالدين لمتابعة التقدم
- 🚧 **AI Voice Analysis** (قيد التطوير): التقييم الحالي تجريبي — دمج TensorFlow Lite للتقييم المحلي على خارطة الطريق
- ✅ **Offline Support**: الحفظ والاختبار والمراجعة دون اتصال مع مزامنة تلقائية
- 🚧 **Multi-language**: الواجهة الحالية عربية، ودعم الإنجليزية جزئي

### ⚠️ حالة المشروع

هذا المشروع **قيد التطوير النشط** وليس جاهزاً للإنتاج بعد. ما يعمل الآن:
- الـ Backend API (حوالي 40 endpoint) مع مصادقة Supabase وخوارزمية SM-2
- مخطط قاعدة البيانات الكامل مع RLS وTriggers
- تطبيق الموبايل: الدخول/التسجيل، ملفات الأطفال، خريطة المغامرة، وضع الحفظ، وضع الاختبار (بتقييم تجريبي)، المراجعة اليومية، لوحة الأبطال، الشارات، التحديات، لوحة الوالدين، الإعدادات

- نص القرآن الكريم كاملاً (114 سورة، 6236 آية) من مشروع تنزيل [tanzil.net](https://tanzil.net)، مع تلاوة لكل آية بثلاثة قراء — انظر [database/README.md](database/README.md)

- تذكير يومي بالآيات المستحقة للمراجعة، يُفعَّل من الإعدادات — انظر [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)
- العمل دون اتصال: ما أُنجز يُحفظ على الجهاز ويُرسل تلقائياً عند عودة الإنترنت، مع تنزيل تلاوة أي سورة للاستماع دون اتصال — انظر [docs/OFFLINE.md](docs/OFFLINE.md)

ما هو ناقص (انظر Roadmap أدناه): مجلدات iOS/Android الأصلية، تقييم التلاوة بالذكاء الاصطناعي، الإشعارات الفورية من الخادم، الاشتراكات داخل التطبيق، والاختبارات الآلية.

---

## 🏗️ البنية التقنية

### Frontend (Mobile App)
- **React Native** 0.73.2
- **React Navigation** للتنقل بين الشاشات
- **Context API** لإدارة الحالة
- **react-native-audio-recorder-player** للتسجيل الصوتي
- **TensorFlow Lite** لتحليل الصوت المحلي (مخطط — غير مدمج بعد)

### Backend (API)
- **Node.js** 18+
- **Express.js** 4.18
- **Supabase** (PostgreSQL + Auth)
- **JWT Authentication**
- **Rate Limiting & Security**

### Database
- **PostgreSQL** على Supabase
- **Row Level Security (RLS)**
- **Automated triggers & functions**

---

## 🚀 الميزات الرئيسية

### 1️⃣ نظام المصادقة
- حساب واحد للوالدين
- ملفات أطفال حسب الباقة: **1 مجاني / 3 احترافي / 5 عائلي**
- كل طفل له Avatar واسم ومستوى

### 2️⃣ خريطة المغامرة (Quest Map)
```
📚 الأجزاء ← 🗺️ عوالم (Worlds)
📖 السور ← 🎯 مستويات (Levels)
✅ سور محفوظة ← ⭐ علامة ذهبية
🔒 سور مقفلة ← للاشتراكات المدفوعة
```

### 3️⃣ وضع الحفظ (Memorization Mode)
- عرض آية واحدة بالمرة
- خط عثماني كبير وواضح
- تشغيل تلاوة بـ 3 قراء مشهورين:
  - الشيخ محمد صديق المنشاوي
  - الشيخ عبد الباسط عبد الصمد
  - الشيخ ماهر المعيقلي
- أزرار: **كرر** | **التالي** | **سجّل تلاوتك**

### 4️⃣ وضع الاختبار (Test Mode)
- تسجيل صوتي للتلاوة
- تقييم بثلاث درجات: **الدقة / التجويد / النطق**
- Feedback فوري بالعربية والإنجليزية
- ⚠️ التقييم الحالي **تجريبي (placeholder)** — التقييم الذكي المحلي بـ TensorFlow Lite قيد التطوير

### 5️⃣ نظام التكرار المُتباعد (SM-2 Algorithm)
```javascript
// جدولة المراجعات الذكية (خوارزمية SM-2 الكلاسيكية)
المراجعة الأولى الناجحة  → بعد يوم واحد
المراجعة الثانية الناجحة → بعد 6 أيام
بعد ذلك                 → الفترة السابقة × معامل السهولة (Ease Factor)
فشل التذكر (Quality < 3) → تعود الآية مستحقة فوراً من جديد
```

### 6️⃣ نظام Gamification

#### 🎯 النقاط
| النشاط | النقاط |
|--------|--------|
| حفظ آية جديدة | 10 نقاط |
| مراجعة ناجحة | 5 نقاط |
| Streak يومي | 20 نقطة |
| تحدي يومي | 50 نقطة |
| الفوز بمعركة | 30 نقطة |
| تقييم مثالي (95%+) | 15 نقطة |
| إكمال سورة | 100 نقطة |

#### 🏅 الشارات (Badges)
- 🌟 **الآية الأولى**: حفظ أول آية
- 📖 **حافظ السور القصيرة**: حفظ 5 سور
- 🏆 **نجم الحفظ**: حفظ جزء كامل
- 🔥 **ملتزم 7 أيام**: استمرار لمدة أسبوع
- ⭐ **ملتزم 30 يوماً**: استمرار لمدة شهر
- 💪 **المُراجع الدؤوب**: 50 مراجعة
- 💯 **عشرة كاملة**: 10 تقييمات مثالية متتالية
- ⚔️ **بطل المعارك**: الفوز بـ 10 معارك

#### 📊 Leaderboard
- **ترتيب عائلي**: أفضل 10 داخل العائلة
- **ترتيب عالمي**: أفضل 10 عالمياً — بأسماء مجهّلة حفاظاً على خصوصية الأطفال (COPPA)

### 7️⃣ التحديات اليومية
```yaml
أمثلة:
  - احفظ 5 آيات اليوم
  - راجع 3 سور قديمة
  - سجّل تلاوتك 10 مرات
  - احصل على 3 تقييمات مثالية

المكافأة: 50 نقطة عند الإكمال
```

### 8️⃣ وضع المعركة (Battle Mode)
- تحدي أخيك/صديقك
- سؤال عشوائي من السور المحفوظة
- من يُجيب أسرع وأصح يفوز
- النقاط للفائز: **30 نقطة**

### 9️⃣ لوحة الوالدين (Parent Dashboard)

#### 📈 التقدم التفصيلي
- عدد السور المحفوظة
- معدل الدقة الأسبوعي
- الوقت اليومي المُستغرق
- توزيع مستويات الإتقان

#### 📊 رسوم بيانية
- تقدم شهري
- نشاط يومي
- توزيع النقاط

#### 🎯 تحديد الأهداف
```javascript
مثال:
  الهدف: "حفظ جزء عم"
  المدة: 3 أشهر
  التقدم: 65%
  متبقي: 10 سور
```

#### 📧 تقرير أسبوعي
- إرسال تلقائي على البريد
- ملخص الأسبوع
- إحصائيات مقارنة

---

## 📂 هيكل المشروع

```
Quran-Quest-Gamified-Memorization/
│
├── backend/                    # Node.js API
│   ├── src/
│   │   ├── config/            # Supabase configuration
│   │   ├── middlewares/       # Auth, validation, etc.
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── spacedRepetition.service.js  # SM-2 Algorithm
│   │   │   └── gamification.service.js      # Points & Badges
│   │   └── server.js          # Express server
│   ├── package.json
│   └── .env.example
│
├── mobile/                     # React Native App
│   ├── src/
│   │   ├── config/            # App configuration
│   │   ├── navigation/        # React Navigation
│   │   ├── screens/           # App screens
│   │   │   ├── Auth/          # Login, Register
│   │   │   ├── Home/          # Quest Map
│   │   │   ├── Surah/         # Surah details, verses
│   │   │   ├── Profile/       # Kid profile
│   │   │   ├── Parent/        # Parent dashboard
│   │   │   └── Battle/        # Battle mode
│   │   ├── components/        # Reusable components
│   │   ├── services/          # API calls
│   │   ├── contexts/          # Context API
│   │   │   ├── AuthContext.js
│   │   │   └── AppContext.js
│   │   ├── utils/             # Helper functions
│   │   └── constants/         # Theme, colors, etc.
│   ├── package.json
│   └── app.json
│
├── database/                   # Database migrations
│   └── schemas/
│       └── 001_initial_schema.sql  # Complete PostgreSQL schema
│
├── docs/                       # Documentation
│   ├── SETUP.md               # Setup guide
│   └── PROJECT_SUMMARY.md     # Project summary
│
└── README.md                   # This file
```

---

## 🔧 التثبيت والإعداد

### المتطلبات
- **Node.js** 18+ و npm/yarn
- **React Native CLI**
- **Xcode** (للـ iOS) أو **Android Studio** (للـ Android)
- **Supabase Account** (مجاني)

### 1️⃣ Clone المشروع
```bash
git clone https://github.com/your-username/Quran-Quest-Gamified-Memorization.git
cd Quran-Quest-Gamified-Memorization
```

### 2️⃣ إعداد Supabase

#### أ. إنشاء مشروع جديد
1. اذهب إلى [Supabase](https://supabase.com)
2. أنشئ مشروع جديد
3. انتظر حتى يكتمل الإعداد

#### ب. تشغيل Database Schema
```sql
-- انسخ محتوى database/schemas/001_initial_schema.sql
-- والصقه في SQL Editor في Supabase
```

بعد إعداد الـ Backend (الخطوة 3)، حمّل نص القرآن الكريم:
```bash
cd backend && npm run seed:quran
```

#### ج. احصل على API Keys
```
Project Settings → API →
  - Project URL
  - anon public key
  - service_role key (سري!)
```

### 3️⃣ إعداد Backend

```bash
cd backend
npm install

# إنشاء ملف .env
cp .env.example .env
```

عدّل `.env`:
```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

JWT_SECRET=your_strong_secret_key
```

تشغيل البيكند:
```bash
npm run dev
```

### 4️⃣ إعداد Mobile App

```bash
cd mobile
npm install

# للـ iOS (macOS only)
cd ios && pod install && cd ..
```

عدّل `mobile/src/config/supabase.js`:
```javascript
const SUPABASE_URL = 'your_supabase_url';
const SUPABASE_ANON_KEY = 'your_anon_key';
```

عدّل `mobile/src/services/api.js`:
```javascript
const API_BASE_URL = 'http://YOUR_IP:3000/api';
// استبدل YOUR_IP بـ IP جهازك المحلي
```

تشغيل التطبيق:
```bash
# للـ Android
npm run android

# للـ iOS
npm run ios
```

---

## 🗄️ Database Schema

### الجداول الرئيسية

#### 👤 users (الآباء)
```sql
- id (UUID)
- email
- subscription_tier (free/pro/family)
- subscription_expires_at
```

#### 👶 kids (الأطفال)
```sql
- id (UUID)
- user_id → users
- name, avatar, date_of_birth
- level, total_points, streak_count
- preferred_reciter, language_preference
```

#### 📖 surahs
```sql
- id
- surah_number, name_ar, name_en
- verses_count, revelation_type
- virtue_ar, virtue_en
- audio_url_* (لكل قارئ)
- is_free (للاشتراك المجاني)
```

#### 📜 verses
```sql
- id
- surah_id → surahs
- verse_number, text_ar
- text_transliteration, text_translation_en
- audio_url
```

#### 🧠 memorized_verses (نظام SM-2)
```sql
- kid_id → kids
- verse_id → verses
- next_review_date
- ease_factor, interval_days, repetition_count
- last_review_quality (0-5)
- mastery_level (beginner/intermediate/advanced/master)
```

#### 🎙️ recordings (تسجيلات صوتية)
```sql
- kid_id, verse_id
- audio_url, duration_seconds
- accuracy_score, tajweed_score, pronunciation_score
- errors_detected (JSONB)
- feedback_ar, feedback_en
- is_passed
```

#### 🏅 badges
```sql
- kid_id
- badge_name, badge_type, badge_icon
- description_ar, description_en
- earned_at
```

#### 🎯 daily_challenges
```sql
- kid_id
- challenge_type, challenge_description
- target_value, current_progress
- is_completed, reward_points
```

#### 📊 leaderboard
```sql
- kid_id
- total_points, weekly_points, monthly_points
- global_rank, family_rank
```

#### ⚔️ battle_challenges
```sql
- challenger_id, opponent_id
- verse_id
- challenger_score, opponent_score
- challenger_time_seconds, opponent_time_seconds
- winner_id, status
```

---

## 🔌 API Endpoints

### 🔐 Authentication
```http
POST   /api/auth/register          # تسجيل جديد
POST   /api/auth/login             # تسجيل دخول
POST   /api/auth/logout            # تسجيل خروج
GET    /api/auth/me                # معلومات المستخدم
POST   /api/auth/reset-password    # إعادة تعيين كلمة المرور
```

### 👶 Kids Management
```http
GET    /api/kids                   # كل الأطفال للوالد
GET    /api/kids/:kidId            # طفل محدد
POST   /api/kids                   # إضافة طفل
PUT    /api/kids/:kidId            # تحديث طفل
DELETE /api/kids/:kidId            # حذف طفل
GET    /api/kids/:kidId/stats      # إحصائيات الطفل
```

### 📖 Surahs & Verses
```http
GET    /api/surahs                 # كل السور
GET    /api/surahs/:surahId        # سورة محددة مع آياتها
GET    /api/surahs/:surahId/verses/:verseNumber
GET    /api/surahs/juz/:juzNumber
GET    /api/surahs/:surahId/progress/:kidId
```

### 🧠 Memorization
```http
POST   /api/memorization/record    # تسجيل تلاوة
POST   /api/memorization/analyze   # تحليل التسجيل (AI)
POST   /api/memorization/memorize  # تأكيد الحفظ
POST   /api/memorization/review    # مراجعة آية
GET    /api/memorization/due/:kidId  # آيات مستحقة للمراجعة
GET    /api/memorization/stats/:kidId
GET    /api/memorization/history/:kidId
```

### 🎮 Gamification
```http
GET    /api/gamification/badges/:kidId
GET    /api/gamification/leaderboard?type=global&limit=10
GET    /api/gamification/points-history/:kidId
GET    /api/gamification/daily-challenge/:kidId
POST   /api/gamification/daily-challenge/:kidId/progress
GET    /api/gamification/stats/:kidId
```

### ⚔️ Battle Mode
```http
POST   /api/battle/challenge       # إنشاء تحدي
POST   /api/battle/:battleId/accept
POST   /api/battle/:battleId/submit
GET    /api/battle/pending/:kidId
GET    /api/battle/history/:kidId
```

### 👨‍👩‍👧 Parent Dashboard
```http
GET    /api/parent/dashboard
GET    /api/parent/kid/:kidId/detailed-stats
POST   /api/parent/goal            # إنشاء هدف
GET    /api/parent/goals/:kidId
PUT    /api/parent/goal/:goalId
GET    /api/parent/weekly-report
```

### 🔔 Notifications
```http
GET    /api/notifications
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all
POST   /api/notifications/schedule
```

---

## 🧮 SM-2 Algorithm للمراجعة المتباعدة

### كيف يعمل؟

```javascript
// Quality Scale (0-5)
0 = نسي الآية تماماً
1 = خطأ لكن تذكر عند رؤية الصواب
2 = خطأ لكن شعر بالألفة
3 = صحيح لكن بصعوبة
4 = صحيح مع تردد بسيط
5 = صحيح بشكل مثالي

// الخوارزمية
إذا Quality < 3:
  ← إعادة الآية للبداية (فشل)
إذا Quality >= 3:
  إذا كانت المراجعة الأولى:
    ← المراجعة التالية بعد يوم واحد
  إذا كانت المراجعة الثانية:
    ← المراجعة التالية بعد 6 أيام
  وإلا:
    ← المراجعة التالية = الفترة السابقة × Ease Factor

// Ease Factor (سهولة التذكر)
يبدأ من 2.5
يزيد إذا كان الأداء جيد
ينقص إذا كان الأداء سيئ
```

### مثال عملي

```
الطفل حفظ آية جديدة بدقة 90%
  ↓
Quality = 4 (جيد مع تردد)
  ↓
المراجعة الأولى: غداً
  ↓
نجح بدقة 95%
  ↓
Quality = 5 (مثالي)
  ↓
المراجعة الثانية: بعد 6 أيام
  ↓
نجح بدقة 88%
  ↓
Quality = 4
  ↓
المراجعة الثالثة: بعد 6 × 2.5 = 15 يوم
  ↓
... وهكذا حتى يصل لمستوى Master
```

---

## 🎨 معايير التصميم

### ألوان إسلامية
```javascript
Primary:   #2E7D32  // أخضر إسلامي
Secondary: #FFD700  // ذهبي
Accent:    #0D47A1  // أزرق عميق
```

### تصميم للأطفال
- ✅ كرتوني وجذاب
- ✅ Animations سلسة
- ✅ Haptic Feedback عند النجاح
- ✅ أيقونات كبيرة وواضحة
- ✅ ألوان زاهية ومشجعة

### إمكانية الوصول
- ✅ دعم RTL للعربية
- ✅ Dark mode للقراءة الليلية
- ✅ خطوط كبيرة للآيات
- ✅ تباين عالي للنصوص

---

## 💰 نظام الاشتراك

| الخطة | السعر | المميزات |
|------|-------|----------|
| **Free** | مجاناً | • 3 سور قصيرة<br>• 1 طفل<br>• ميزات أساسية |
| **Pro** | $7/شهر | • جميع الـ 30 جزء<br>• 3 أطفال<br>• تحليلات متقدمة<br>• جميع القراء |
| **Family** | $15/شهر | • جميع الـ 30 جزء<br>• 5 أطفال<br>• تحليلات متقدمة<br>• جميع القراء<br>• تقارير أسبوعية |

---

## 🔒 الأمان والخصوصية

### COPPA Compliant
- ✅ آمن للأطفال
- ✅ بدون إعلانات
- ✅ بدون روابط خارجية
- ✅ موافقة الوالدين مطلوبة

### Security Measures
```javascript
✓ مصادقة Supabase Auth (JWT) — كلمات المرور تُدار بالكامل عبر Supabase
✓ Row Level Security (RLS) في Supabase
✓ Rate Limiting على API
✓ تجهيل أسماء الأطفال في اللوحة العالمية
⚠️ Input Validation ما زال أساسياً — يحتاج توسعة قبل الإنتاج
⚠️ درجات التقييم تُرسل حالياً من العميل (تُقيّد 0-100 في الخادم) حتى يُدمج التقييم المحلي
```

---

## 🧪 الاختبار

```bash
# Backend tests
cd backend
npm test

# Mobile app tests
cd mobile
npm test
```

---

## 🚢 النشر (Deployment)

### Backend (على Heroku/Railway)
```bash
# إعداد متغيرات البيئة
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_ANON_KEY=...
# ... الخ

# Push
git push heroku main
```

### Mobile App

#### للـ iOS (App Store)
```bash
cd ios
fastlane release
```

#### للـ Android (Google Play)
```bash
cd android
./gradlew bundleRelease
```

---

## 🤝 المساهمة

نرحب بالمساهمات! الرجاء:

1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى Branch (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

---

## 📝 الترخيص

هذا المشروع مرخص تحت رخصة MIT - انظر ملف [LICENSE](LICENSE) للتفاصيل.

---

## 🙏 شكر وتقدير

- **قراء القرآن الكريم** لتسجيلاتهم المباركة
- **Supabase** للبنية التحتية المجانية الرائعة
- **React Native Community** للمكتبات المفتوحة المصدر

---

## 🗺️ Roadmap المستقبل

### الأساسيات المتبقية قبل الإطلاق
- [ ] توليد مجلدات iOS/Android الأصلية وربط المكتبات (fonts, permissions)
- [x] تحميل نص الآيات الكامل من مصدر موثق (Tanzil) إلى جدول verses
- [x] روابط التلاوات الصوتية للقراء الثلاثة (لكل آية)
- [x] تنزيل التلاوات للاستماع دون اتصال (لكل سورة)
- [ ] دمج TensorFlow Lite model للتقييم المحلي للتلاوة
- [x] تذكيرات المراجعة اليومية (إشعارات محلية مجدولة على الجهاز)
- [ ] إشعارات فورية من الخادم (FCM/APNs) — مثل إشعار وصول تحدٍّ من أخ
- [x] العمل دون اتصال مع المزامنة التلقائية (الحفظ، الاختبار، المراجعة)
- [ ] الاشتراكات داخل التطبيق (IAP)
- [ ] تدفق موافقة الوالدين (COPPA) والتقارير الأسبوعية بالبريد
- [ ] اختبارات آلية (Backend + Mobile)

### ميزات مستقبلية
- [ ] دعم Apple Watch و Wear OS
- [ ] ميزة Group Challenges (تحديات جماعية)
- [ ] دعم لغات إضافية (فرنسي، إندونيسي، أردو)
- [ ] نسخة Web للوالدين

---

<div align="center">

**جُعل بـ ❤️ لخدمة القرآن الكريم وأطفال المسلمين**

⭐ إذا أعجبك المشروع، لا تنسَ النجمة!

</div>
