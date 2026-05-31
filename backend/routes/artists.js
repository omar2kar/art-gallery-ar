const router = require('express').Router();
const db = require('../db');
const multer = require('multer');
const { authRequired, allowRoles } = require('../middleware/auth');

// صورة الفنان تُخزَّن في قاعدة البيانات (LONGBLOB) مثل صور اللوحات،
// حتى تبقى دائمة ولا تختفي عند إعادة نشر الخادم (قرص النشر مؤقّت).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('يُسمح بالصور فقط'));
  },
});

// تهيئة تلقائية: نضيف عمودي تخزين صورة الفنان إن لم يكونا موجودين (idempotent).
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM artists LIKE 'photo_data'");
    if (!cols.length) {
      await db.query(
        'ALTER TABLE artists ADD COLUMN photo_data LONGBLOB, ADD COLUMN photo_mime VARCHAR(100)'
      );
      console.log('✅ تمت إضافة عمودي photo_data/photo_mime لصور الفنانين');
    }
  } catch (err) {
    console.error('⚠️ تعذّر التحقق من أعمدة صورة الفنان:', err.message);
  }
})();

// أعمدة الفنان دون الـ BLOB الثقيل — مع علم has_photo للواجهة
const ARTIST_COLS = 'id, name, bio, photo, (photo_data IS NOT NULL) AS has_photo';

// GET /api/artists — كل الفنانين (عام)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${ARTIST_COLS} FROM artists ORDER BY name`);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/artists/me — ملف الفنان الحالي (محمي) — قبل /:id حتى لا تُفسَّر "me" كمعرّف
router.get('/me', authRequired, allowRoles('artist', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${ARTIST_COLS} FROM artists WHERE user_id=?`,
      [req.user.id]
    );
    if (!rows.length) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/artists/me — تحديث نبذة/صورة الفنان الحالي (محمي)
router.put(
  '/me',
  authRequired,
  allowRoles('artist', 'admin'),
  upload.single('photo'),
  async (req, res) => {
    try {
      const [rows] = await db.query('SELECT id FROM artists WHERE user_id=?', [req.user.id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'لا يوجد ملف فنان مرتبط بحسابك' });
      }
      const artistId = rows[0].id;

      const { bio } = req.body;
      const sets = [];
      const vals = [];
      if (typeof bio === 'string') {
        sets.push('bio=?');
        vals.push(bio);
      }
      if (req.file) {
        sets.push('photo_data=?', 'photo_mime=?', 'photo=?');
        vals.push(req.file.buffer, req.file.mimetype, req.file.originalname);
      }
      if (sets.length) {
        vals.push(artistId);
        await db.query(`UPDATE artists SET ${sets.join(', ')} WHERE id=?`, vals);
      }
      res.json({ success: true, message: 'تم تحديث ملف الفنان' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/artists/:id/photo — تقديم صورة الفنان المخزّنة في قاعدة البيانات (عام)
router.get('/:id/photo', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT photo_data, photo_mime FROM artists WHERE id=?',
      [req.params.id]
    );
    if (!rows.length || !rows[0].photo_data) return res.status(404).end();
    res.set('Content-Type', rows[0].photo_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(rows[0].photo_data);
  } catch {
    res.status(500).end();
  }
});

// GET /api/artists/:id — فنان واحد (عام)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${ARTIST_COLS} FROM artists WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
