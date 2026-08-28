# CLAUDE.md — سياق مشروع معرض الفنون (AR Gallery)

> هذا الملف يُقرأ تلقائياً من Claude Code في كل جلسة.
> آخر تحديث: بعد commit 7a66420

---

## نظرة عامة

موقع ويب لعرض وبيع اللوحات الفنية.
الميزة الرئيسية: عرض اللوحة على جدار الغرفة عبر الكاميرا (WebXR).

---

## Stack التقني

| الطبقة   | التقنية               | الرابط / الملاحظة                  |
|----------|-----------------------|------------------------------------|
| Frontend | React + Vite          | http://localhost:5173               |
| Backend  | Node.js + Express     | http://localhost:5000               |
| Database | MySQL عبر Filess.io   | سحابي — يدعم LONGBLOB              |
| الهاتف  | أندرويد، Chrome       | يحتاج HTTPS + Google Play AR       |

---

## هيكل المجلدات

```
art-gallery-project/
├── CLAUDE.md
├── frontend/
│   └── src/
│       ├── api/axios.js
│       ├── utils/img.js                  ← مساعد artistPhotoUrl (جديد)
│       ├── components/
│       │   ├── ARViewerXR.jsx            ← ميزة AR الرئيسية (v16)
│       │   ├── Navbar.jsx                ← رابط /profile مضاف
│       │   └── PaintingCard.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── PaintingDetail.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── AdminDashboard.jsx
│       │   └── Profile.jsx               ← جديد: /profile
│       └── App.jsx                       ← مسار /profile مضاف
└── backend/
    ├── routes/
    │   ├── paintings.js
    │   ├── artists.js                    ← أُعيد كتابته (LONGBLOB + /me)
    │   └── auth.js                       ← /me موسّع + PUT /auth/profile
    ├── db.js
    └── server.js
```

---

## قاعدة البيانات — الحالة الراهنة

```sql
paintings : id, title, artist_id, price, style, medium, size_cm, year,
            description, image_data LONGBLOB, image_mime VARCHAR(100)

artists   : id, name, bio, photo, user_id,
            photo_data LONGBLOB, photo_mime VARCHAR(100)

users     : id, name, email, password, role
            -- ⚠️ لا يوجد created_at (أُزيل لتفادي خطأ)

orders    : id, user_id, painting_id, status
```

> الصور (لوحات + فنانين) مخزّنة كـ LONGBLOB في قاعدة البيانات،
> لا على القرص — لأن قرص Render مؤقّت.

---

## المسارات (Routes) الحالية

```
/              → Home
/painting/:id  → PaintingDetail
/login         → Login
/register      → Register
/admin         → AdminDashboard
/artist        → Artist page
/cart          → Cart
/favorites     → Favorites
/profile       → Profile (جديد)
```

---

## API Endpoints الحالية

### paintings
```
GET  /api/paintings
GET  /api/paintings/:id
POST /api/paintings          (multipart — يحفظ image_data/image_mime)
GET  /api/paintings/:id/image
GET  /api/paintings/mine     (للفنان)
```

### artists
```
GET  /api/artists
GET  /api/artists/me         (⚠️ قبل /:id في ترتيب المسارات)
PUT  /api/artists/me         (نبذة + صورة multipart)
GET  /api/artists/:id
GET  /api/artists/:id/photo  (يقدّم BLOB)
```

### auth
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me            (يرجع: name, email, role, artist_id, bio, has_photo)
PUT  /api/auth/profile       (تعديل الاسم + تغيير كلمة المرور)
```

---

## ميزة AR — الحالة الراهنة (ARViewerXR.jsx — v16)

### ما يعمل
- **اكتشاف الجدار**: شعاع الكاميرا يتقاطع مع XRPlane.polygon الفعلي (دالة pointInPolygon2D) — أدق من فحص النصف قطر القديم
- **تحريك اللوحة باللمس**: dragOnWall(xrFrame) يطلق شعاعاً من إصبع المستخدم ويتبع اللوحة بـ lerp — حلّ محل أزرار الأسهم
- **تنعيم التصويب**: lerp(0.35) يقلّل الاهتزاز
- **6 إطارات** قابلة للاختيار: gold, black, white, wood, silver, none
  - تظهر في: شاشة البدء + أثناء المسح + بعد التثبيت
  - buildFrame(id) يبني الإطار ويتخلّص من القديم (dispose)
  - E.setFrame(id) للتبديل الحيّ
- الإصدار: VERSION = "AR v16"

### المتطلبات للتشغيل
- ✅ HTTPS (Netlify أو ngrok)
- ✅ أندرويد Chrome
- ✅ Google Play Services for AR

### ما لم يُحلّ بعد
- لا ظل ديناميكي يتغير حسب موضع اللوحة
- لا إضاءة واقعية تتكيّف مع الغرفة

---

## صفحة Profile (/profile)

- **للجميع**: تعديل الاسم + تغيير كلمة المرور (يتحقق من القديمة عبر bcrypt)
- **للفنان فقط**: نبذة + رفع صورة شخصية + إحصاءات (عدد اللوحات / القيمة)
- الأفاتار: صورة الفنان أو أول حرف من الاسم
- شارة الدور: Yönetici / Sanatçı / Üye
- بعد تعديل الاسم: يُحدَّث في localStorage فيظهر فوراً في Navbar

---

## نقاط انتباه مهمة

```
⚠️ بعد كل نشر: أعد تشغيل الخادم لتُنفَّذ هجرة photo_data/photo_mime
⚠️ ترتيب مسارات artists.js: /me يجب أن يأتي قبل /:id
⚠️ جدول users لا يحوي created_at — لا تضفه للاستعلامات
⚠️ AR لا تُختبر إلا على جهاز حقيقي + HTTPS
```

---

## قواعد العمل مع هذا المشروع

- لا تعيد كتابة الكود كاملاً إلا إذا طُلب صراحةً
- نبّه دائماً إذا كان الحل يتطلب HTTPS أو تغيير في البيئة
- الأولوية للحلول التي تعمل أولاً ثم تُحسَّن
- عند تعديل artists.js: تحقق من ترتيب المسارات /me قبل /:id
