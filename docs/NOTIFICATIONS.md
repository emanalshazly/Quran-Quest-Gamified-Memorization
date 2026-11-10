# 🔔 تذكيرات المراجعة

## كيف تعمل

التذكيرات **إشعارات محلية** يجدولها التطبيق على الجهاز نفسه، وليست push من الخادم:

1. التطبيق يطلب من الـ API أوقات استحقاق المراجعة لكل طفل (`GET /api/memorization/upcoming/:kidId`).
2. يحسب لكل يوم من الأيام السبعة القادمة عدد الآيات المستحقة عند ساعة التذكير (`mobile/src/utils/reminderSchedule.js`).
3. يجدول إشعاراً واحداً لكل طفل في كل يوم فيه آيات مستحقة (`mobile/src/services/notifications.js`).

العدّ تراكمي: الآيات التي لم تُراجَع تبقى محسوبة في الأيام التالية، فيستمر التذكير حتى تتم المراجعة. الأيام التي لا شيء مستحق فيها لا يصلها إشعار.

تُعاد الجدولة تلقائياً عند: فتح التطبيق، إتمام مراجعة، حفظ آية جديدة، تغيير إعدادات التذكير، وتغيير ملفات الأطفال. وتُلغى كل التذكيرات عند تسجيل الخروج. إن تعذّر الاتصال بالخادم تبقى التذكيرات المجدولة سابقاً كما هي.

## لماذا محلية وليست من الخادم

- لا تحتاج مشروع Firebase ولا مفاتيح APNs.
- تعمل حتى لو كان الجهاز غير متصل وقت التذكير.
- لا تُرسَل أي معرّفات للجهاز إلى الخادم (أنسب لتطبيق أطفال و COPPA).

القيد: الجدول يتحدث فقط عند فتح التطبيق، ويغطي 7 أيام. من لا يفتح التطبيق أكثر من أسبوع تتوقف تذكيراته. الإشعارات الفورية (مثل وصول تحدٍّ من أخ) تحتاج push من الخادم وهي على خارطة الطريق.

## الإعدادات

التذكيرات **معطّلة افتراضياً** ويفعّلها ولي الأمر من الإعدادات (أو من شاشة المراجعة)، مع اختيار ساعة التذكير: 7 ص، 1 م، 5 م (الافتراضي)، 8 م. عند التفعيل يطلب النظام إذن الإشعارات.

## الإعداد المطلوب في المشاريع الأصلية

هذه الخطوات لازمة بعد توليد مجلدي `android/` و `ios/` (غير موجودين في المستودع بعد).

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />

<application ...>
  <receiver android:name="com.dieam.reactnativepushnotification.modules.RNPushNotificationActions" />
  <receiver android:name="com.dieam.reactnativepushnotification.modules.RNPushNotificationPublisher" />
  <receiver
      android:name="com.dieam.reactnativepushnotification.modules.RNPushNotificationBootEventReceiver"
      android:exported="false">
    <intent-filter>
      <action android:name="android.intent.action.BOOT_COMPLETED" />
      <action android:name="android.intent.action.QUICKBOOT_POWERON" />
    </intent-filter>
  </receiver>
</application>
```

مستقبِل الإقلاع يعيد جدولة التذكيرات بعد إعادة تشغيل الجهاز.

### iOS

1. `cd ios && pod install`
2. في `AppDelegate`: إضافة استدعاءات `RNCPushNotificationIOS` وتعيين `UNUserNotificationCenter` delegate، حسب تعليمات مكتبة `@react-native-community/push-notification-ios`.

## الاختبار

منطق الجدولة مغطى باختبارات وحدة: `cd mobile && npm test`.

لم يُختبر بعد على جهاز فعلي: ظهور الإشعار، طلب الإذن، وإعادة الجدولة بعد إعادة التشغيل.
