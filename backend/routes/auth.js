// ===================================================
// routes/auth.js — مع دعم تسجيل الفنانين
// ===================================================
const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authRequired } = require('../middleware/auth');

// يولّد توكناً موحّداً
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
// يقبل: name, email, password, role ('user' أو 'artist'), bio (للفنان اختياري)
router.post('/register', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { name, email, password, role, bio } = req.body;

    // تحقّق أساسي من المدخلات
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'يرجى ملء جميع الحقول' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور 6 أحرف على الأقل' });
    }
    // الدور المسموح به عند التسجيل: user أو artist فقط (لا admin)
    const safeRole = role === 'artist' ? 'artist' : 'user';

    const hashed = await bcrypt.hash(password, 10);

    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      [name, email, hashed, safeRole]
    );
    const userId = result.insertId;

    // لو فنان: ننشئ صفّاً مرتبطاً في جدول artists
    if (safeRole === 'artist') {
      await conn.query(
        'INSERT INTO artists (name, bio, user_id) VALUES (?,?,?)',
        [name, bio || null, userId]
      );
    }

    await conn.commit();

    // دخول تلقائي بعد التسجيل (تجربة أفضل): نُرجع توكناً مباشرة
    const user = { id: userId, name, role: safeRole };
    const token = signToken(user);
    res.json({ success: true, token, user, message: 'تم التسجيل بنجاح' });
  } catch (err) {
    await conn.rollback();
    // خطأ المفتاح المكرّر = البريد مستخدم
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'البريد مستخدم مسبقاً' });
    }
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول خاطئة' });
    }
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول خاطئة' });
    }
    const user = { id: rows[0].id, name: rows[0].name, role: rows[0].role };
    const token = signToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me — يعيد بيانات المستخدم الحالي (للتحقق من الجلسة)
router.get('/me', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'غير موجود' });

    // لو فنان، نضيف معرّف الفنان (artist_id) + نبذته + علم وجود صورة
    let artist = null;
    if (rows[0].role === 'artist') {
      const [a] = await db.query(
        'SELECT id, bio, (photo_data IS NOT NULL) AS has_photo FROM artists WHERE user_id=?',
        [req.user.id]
      );
      if (a.length) artist = a[0];
    }
    res.json({
      success: true,
      user: {
        ...rows[0],
        artist_id: artist ? artist.id : null,
        bio: artist ? artist.bio : null,
        has_photo: artist ? !!artist.has_photo : false,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/profile — تحديث بيانات الحساب (الاسم + كلمة المرور اختيارياً)
// الأمان: المستخدم يعدّل حسابه هو فقط (من التوكن، لا من جسم الطلب).
router.put('/profile', authRequired, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    const [rows] = await db.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'غير موجود' });
    const me = rows[0];

    // 1) تغيير كلمة المرور (إن طُلب) — يتطلب كلمة المرور الحالية الصحيحة
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة 6 أحرف على الأقل' });
      }
      const valid = await bcrypt.compare(currentPassword || '', me.password);
      if (!valid) {
        return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query('UPDATE users SET password=? WHERE id=?', [hashed, req.user.id]);
    }

    // 2) تغيير الاسم (إن طُلب) — نحدّثه في users، وفي artists أيضاً لو فناناً
    let newName = me.name;
    if (typeof name === 'string' && name.trim()) {
      newName = name.trim();
      await db.query('UPDATE users SET name=? WHERE id=?', [newName, req.user.id]);
      if (me.role === 'artist') {
        await db.query('UPDATE artists SET name=? WHERE user_id=?', [newName, req.user.id]);
      }
    }

    res.json({
      success: true,
      message: 'تم تحديث الحساب',
      user: { id: me.id, name: newName, role: me.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;