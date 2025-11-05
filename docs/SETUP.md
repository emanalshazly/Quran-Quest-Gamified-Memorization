# 🔧 دليل الإعداد الشامل - Quran Quest

هذا الدليل يُوضح خطوات إعداد المشروع من الصفر.

---

## 📋 المتطلبات الأساسية

### 1. تثبيت Node.js
```bash
# تحقق من النسخة المثبتة
node --version  # يجب أن تكون 18+ أو أحدث
npm --version

# إذا لم تكن مثبتة، حمّلها من:
# https://nodejs.org/
```

### 2. تثبيت React Native CLI
```bash
# للـ macOS/Linux
sudo npm install -g react-native-cli

# للـ Windows (كمسؤول)
npm install -g react-native-cli
```

### 3. للـ iOS (macOS فقط)
```bash
# تثبيت Xcode من App Store
# ثم تثبيت Command Line Tools
xcode-select --install

# تثبيت CocoaPods
sudo gem install cocoapods
```

### 4. للـ Android
1. حمّل [Android Studio](https://developer.android.com/studio)
2. ثبّت SDK Tools:
   - Android SDK Platform 33
   - Android SDK Build-Tools
   - Android Emulator
3. أضف المتغيرات البيئية:

```bash
# في ~/.bash_profile أو ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## 🚀 الخطوات التفصيلية

### الخطوة 1: Clone المشروع

```bash
git clone https://github.com/emanalshazly/Quran-Quest-Gamified-Memorization.git
cd Quran-Quest-Gamified-Memorization
```

---

### الخطوة 2: إعداد Supabase

#### أ. إنشاء حساب Supabase
1. اذهب إلى https://supabase.com
2. سجّل حساب جديد (مجاناً)
3. اضغط على "New Project"
4. املأ البيانات:
   - **Project Name**: quran-quest
   - **Database Password**: (احفظها في مكان آمن!)
   - **Region**: اختر الأقرب لك
5. اضغط "Create new project"
6. انتظر 2-3 دقائق حتى يكتمل الإعداد

#### ب. تشغيل Database Schema
1. في Supabase Dashboard، اذهب إلى `SQL Editor`
2. افتح ملف `database/schemas/001_initial_schema.sql` من المشروع
3. انسخ كامل المحتوى
4. الصقه في SQL Editor
5. اضغط "Run" أو Ctrl+Enter
6. تأكد من ظهور "Success" بدون أخطاء

#### ج. الحصول على API Keys
1. اذهب إلى `Project Settings` (الترس في الزاوية)
2. اختر `API` من القائمة الجانبية
3. ستجد:
   - **Project URL**: انسخه
   - **anon public**: انسخه
   - **service_role**: انسخه (احتفظ به سرياً!)

---

### الخطوة 3: إعداد Backend

```bash
cd backend
npm install
```

#### إنشاء ملف .env
```bash
cp .env.example .env
```

افتح `.env` وعدّل القيم:
```env
PORT=3000
NODE_ENV=development

# من Supabase
SUPABASE_URL=https://xyzabcdef.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...

# أي مفتاح سري طويل
JWT_SECRET=my-super-secret-jwt-key-change-this-in-production

# إبق الباقي كما هو
```

#### تشغيل Backend
```bash
npm run dev
```

يجب أن ترى:
```
🚀 Quran Quest API Server running on port 3000
📊 Environment: development
```

اختبر API:
```bash
curl http://localhost:3000/health
```

يجب أن ترى:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-05T...",
  "uptime": 1.234
}
```

---

### الخطوة 4: إعداد Mobile App

```bash
cd ../mobile
npm install
```

#### للـ iOS فقط (macOS)
```bash
cd ios
pod install
cd ..
```

#### تعديل الإعدادات

##### 1. ملف `src/config/supabase.js`
```javascript
// غيّر هذه القيم
const SUPABASE_URL = 'https://xyzabcdef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...';
```

##### 2. ملف `src/services/api.js`
```javascript
// غيّر IP المحلي الخاص بك
// للحصول على IP:
# macOS/Linux
ifconfig | grep "inet "
# Windows
ipconfig

// ثم استبدل في الكود:
const API_BASE_URL = 'http://192.168.1.100:3000/api';
// ⚠️ لا تستخدم localhost أو 127.0.0.1 في الهاتف!
```

---

### الخطوة 5: تشغيل التطبيق

#### للـ Android

##### تشغيل المحاكي
```bash
# افتح Android Studio
# Tools → AVD Manager → Create Virtual Device
# اختر Pixel 5 مع Android 13

# أو من Terminal
emulator -avd Pixel_5_API_33
```

##### تشغيل التطبيق
```bash
npm run android
```

في المرة الأولى، قد يأخذ 5-10 دقائق.

#### للـ iOS (macOS فقط)

##### تشغيل المحاكي
```bash
# سيفتح تلقائياً
npm run ios
```

أو اختر جهاز محدد:
```bash
npm run ios -- --simulator="iPhone 15 Pro"
```

---

## 🐛 حل المشاكل الشائعة

### مشكلة: `command not found: react-native`
```bash
npm install -g react-native-cli
```

### مشكلة: Android Build Failed
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### مشكلة: CocoaPods error (iOS)
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### مشكلة: Metro Bundler لا يعمل
```bash
# أوقف كل العمليات
npx react-native start --reset-cache
```

### مشكلة: Cannot connect to API
تأكد من:
1. Backend يعمل على `localhost:3000`
2. استخدمت IP المحلي الصحيح (ليس localhost)
3. الهاتف/المحاكي على نفس الشبكة

---

## 📱 اختبار التطبيق

### 1. إنشاء حساب
```
Email: parent@test.com
Password: Test123!
```

### 2. إضافة طفل
```
Name: أحمد
Avatar: اختر أي صورة
Date of Birth: 2015-01-01
```

### 3. اختبار API
في Postman أو Insomnia:

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "parent@test.com",
  "password": "Test123!"
}
```

---

## 🔄 إعداد بيانات تجريبية

### إضافة سور وآيات للتجربة

```sql
-- في Supabase SQL Editor
-- السور موجودة بالفعل في Schema، لكن الآيات فارغة

-- مثال: إضافة آيات سورة الفاتحة
INSERT INTO verses (surah_id, verse_number, text_ar, text_translation_en) VALUES
(1, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'In the name of Allah, the Entirely Merciful, the Especially Merciful.'),
(1, 2, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', 'All praise is due to Allah, Lord of the worlds'),
-- ... الخ
```

ملاحظة: يُفضل استخدام API لملء القرآن الكامل من مصدر موثوق مثل:
- https://api.alquran.cloud/
- https://quran.com/api

---

## 🎯 التحقق من نجاح الإعداد

### Checklist

- [ ] ✅ Backend يعمل على http://localhost:3000
- [ ] ✅ `/health` endpoint يرجع `{"status": "healthy"}`
- [ ] ✅ Supabase متصل بدون أخطاء
- [ ] ✅ Mobile app يفتح بدون crashes
- [ ] ✅ يمكن إنشاء حساب جديد
- [ ] ✅ Login يعمل
- [ ] ✅ يمكن إضافة kid profile
- [ ] ✅ Home screen تعرض السور

---

## 📚 الخطوات التالية

بعد إتمام الإعداد:

1. **إضافة محتوى القرآن الكامل**:
   - استخدم API خارجي لملء جدول `verses`
   - أضف ملفات الصوت للقراء الثلاثة

2. **إعداد TensorFlow Lite**:
   - تدريب نموذج للتعرف على الصوت
   - دمجه في التطبيق

3. **Push Notifications**:
   - Firebase Cloud Messaging (FCM)
   - إعداد الـ certificates للـ iOS

4. **Testing**:
   - كتابة Unit Tests للـ Backend
   - Integration Tests للـ Mobile
   - E2E Tests

5. **Production Deployment**:
   - رفع Backend على Railway/Heroku
   - تفعيل RLS في Supabase
   - إنشاء builds للـ App Store و Google Play

---

## 🆘 الدعم

إذا واجهت أي مشكلة:

1. **تحقق من Logs**:
   ```bash
   # Backend logs
   npm run dev

   # React Native logs
   npx react-native log-android
   npx react-native log-ios
   ```

2. **افتح Issue على GitHub**:
   - وصف المشكلة
   - خطوات إعادة إنتاجها
   - Screenshots إن أمكن

3. **Community Support**:
   - Discord: (قريباً)
   - Discussions على GitHub

---

**تم بحمد الله! 🎉**

الآن يمكنك البدء في تطوير المشروع.
