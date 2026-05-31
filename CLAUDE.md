# CLAUDE.md — سياق مشروع معرض الفنون (AR Gallery)

> هذا الملف يُقرأ تلقائياً من Claude Code في كل جلسة.
> لا تحذفه — هو ذاكرة المشروع.

---

## نظرة عامة على المشروع

موقع ويب لعرض وبيع اللوحات الفنية، الميزة الرئيسية هي عرض اللوحة على جدار الغرفة (AR).

---

## Stack التقني

| الطبقة    | التقنية                        | الرابط                      |
|-----------|--------------------------------|-----------------------------|
| Frontend  | React + Vite                   | http://localhost:5173        |
| Backend   | Node.js + Express              | http://localhost:5000        |
| Database  | MySQL عبر XAMPP                | —                           |
| الهاتف   | أندرويد، Chrome                | —                           |

---

## هيكل المجلدات

```
art-gallery-project/
├── frontend/
│   └── src/
│       ├── api/axios.js
│       ├── components/
│       │   ├── ARViewer.jsx        ← ميزة AR الرئيسية (الملف الأهم)
│       │   ├── Navbar.jsx
│       │   └── PaintingCard.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── PaintingDetail.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   └── AdminDashboard.jsx
│       └── App.jsx
└── backend/
    ├── routes/
    │   ├── paintings.js
    │   ├── artists.js
    │   └── auth.js
    ├── db.js
    └── server.js
```

---

## قاعدة البيانات — الجداول الأساسية

```sql
paintings : id, title, artist_id, price, style, medium, size_cm, year, image, description
artists   : id, name, bio, photo
users     : id, name, email, password, role (admin/user)
orders    : id, user_id, painting_id, status
```

---

## ميزة AR — الحالة الراهنة

### ما يعمل الآن (ARViewer.jsx)
- المستخدم يرفع صورة غرفته (JPG) أو يستخدم غرفة افتراضية مرسومة بـ Canvas
- اللوحة تُوضع يدوياً بالضغط على الجدار
- سحب اللوحة وتحريكها داخل حدود الجدار
- تكبير/تصغير بإصبعين (pinch-to-zoom) وأزرار +/−
- تدوير بخطوات 90°
- إطار ذهبي ثلاثي الأبعاد (قابل للإخفاء)
- ظل ناعم وطبقة إضاءة على اللوحة
- حفظ الصورة النهائية PNG

### المشاكل القائمة
- **الكاميرا الحية محجوبة**: المتصفح يرفض `getUserMedia` على HTTP
- لا يوجد تعرف تلقائي على الجدار (Plane Detection)
- اللوحة لا تلتصق بالجدار بشكل واقعي — الوضع يدوي فقط
- لا ظل ديناميكي يتغير حسب موضع اللوحة

### السبب الجذري
`navigator.mediaDevices.getUserMedia` يُحجب من Chrome على HTTP.
الحل الوحيد: HTTPS أو `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

---

## ما جُرِّب ولم ينجح

| المحاولة    | السبب                                      |
|-------------|---------------------------------------------|
| ngrok       | صعب الإعداد على Windows، مشاكل في التوكن  |
| WebXR API   | يتطلب HTTPS إجبارياً                        |
| TensorFlow.js | لم يُجرَّب بعد                           |

---

## الهدف المطلوب (للعرض أمام اللجنة)

1. كاميرا حية حقيقية على أندرويد Chrome
2. تعرف تلقائي على الجدار (Plane Detection)
3. اللوحة تلتصق بالجدار بشكل واقعي
4. ظل وإضاءة واقعية تتغير حسب الموضع
5. إطار ثلاثي الأبعاد واقعي

---

## الخطة المتفق عليها للوصول إلى HTTPS

```
Frontend → Netlify   (HTTPS مجاني، يدعم React/Vite)
Backend  → Render    (Node.js مجاني)
Database → Filess.io (MySQL مجاني)
```

هذا سيتيح:
- `getUserMedia` للكاميرا الحية
- WebXR API لـ Plane Detection
- التشغيل الكامل على أندرويد Chrome

---

## قواعد العمل مع هذا المشروع

- الملف الرئيسي للـ AR هو `frontend/src/components/ARViewer.jsx`
- Backend API على `http://192.168.0.145:5000` (IP المحلي — قد يتغير)
- صور اللوحات تُخزَّن الآن داخل قاعدة البيانات كعمود `LONGBLOB` (image_data + image_mime)
  وتُقدَّم عبر `GET /api/paintings/:id/image` — لم تعد تُحفظ على القرص في `backend/uploads/`
  (السبب: قرص النشر مؤقّت ephemeral فكانت الصور تختفي). الأعمدة تُضاف تلقائياً عند إقلاع الخادم.
- لا تعيد كتابة الكود كاملاً إلا إذا طُلب صراحةً
- نبّه دائماً إذا كان الحل يتطلب HTTPS أو تغيير في البيئة
- الأولوية للحلول التي تعمل على localhost أولاً

---

## متغيرات البيئة المطلوبة (.env في backend)

> ملاحظة: قاعدة البيانات على Filess.io السحابية (كانت XAMPP محلياً في البداية).

```env
PORT=5000
DB_HOST=p1prtn.h.filess.io      # Filess.io — كانت localhost عبر XAMPP سابقاً
DB_PORT=<filess_port>           # Filess.io يستخدم منفذاً مخصّصاً (غير 3306) — اتركه فارغاً إن كان 3306
DB_USER=<filess_user>
DB_PASSWORD=<filess_password>   # ملاحظة: المفتاح اسمه DB_PASSWORD (وليس DB_PASS)
DB_NAME=artgallery_packideano
```

> الواجهة محلياً: لمعاينة `localhost` نضيف `frontend/.env.local` يحوي
> `VITE_API_URL=http://localhost:5000` (الافتراضي في الكود يشير إلى `192.168.0.145:5000` للجوال على نفس الشبكة).
