// ===================================================
// routes/paintings.js — مع حماية وربط بالفنان
// ===================================================
const router = require('express').Router();
const db = require('../db');
const multer = require('multer');
const { authRequired, allowRoles } = require('../middleware/auth');

// نخزّن الصورة في الذاكرة ثم نكتب بايتاتها في قاعدة البيانات (LONGBLOB)،
// حتى تبقى الصور دائمة ومشتركة مع قاعدة Aiven ولا تختفي عند إعادة نشر/تشغيل الخادم.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('يُسمح بالصور فقط'));
  },
});

// تهيئة تلقائية: نضيف عمودي تخزين الصورة إن لم يكونا موجودين (idempotent).
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM paintings LIKE 'image_data'");
    if (!cols.length) {
      await db.query(
        'ALTER TABLE paintings ADD COLUMN image_data LONGBLOB, ADD COLUMN image_mime VARCHAR(100)'
      );
      console.log('✅ تمت إضافة عمودي image_data/image_mime لتخزين الصور في قاعدة البيانات');
    }
  } catch (err) {
    console.error('⚠️ تعذّر التحقق من أعمدة تخزين الصور:', err.message);
  }
})();

// أعمدة اللوحة دون الـ BLOB الثقيل — مع علم has_image للواجهة
const PAINTING_COLS =
  'p.id, p.title, p.artist_id, p.price, p.style, p.medium, p.size_cm, p.year, ' +
  'p.image, p.description, p.is_available, p.created_at, ' +
  '(p.image_data IS NOT NULL) AS has_image';

// يُرجع artist_id المرتبط بالمستخدم الحالي (للفنان)
async function getArtistId(userId) {
  const [rows] = await db.query('SELECT id FROM artists WHERE user_id=?', [userId]);
  return rows.length ? rows[0].id : null;
}

// GET /api/paintings — كل اللوحات (عام)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ${PAINTING_COLS}, a.name as artist_name, a.photo as artist_photo
      FROM paintings p
      LEFT JOIN artists a ON p.artist_id = a.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/paintings/mine — لوحات الفنان الحالي (محمي)
// مهم: قبل /:id حتى لا تُفسَّر "mine" كمعرّف
router.get('/mine', authRequired, allowRoles('artist', 'admin'), async (req, res) => {
  try {
    const artistId = await getArtistId(req.user.id);
    if (!artistId) return res.json({ success: true, data: [] });
    const [rows] = await db.query(
      'SELECT id, title, artist_id, price, style, medium, size_cm, year, image, ' +
        'description, is_available, created_at, (image_data IS NOT NULL) AS has_image ' +
        'FROM paintings WHERE artist_id=? ORDER BY created_at DESC',
      [artistId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/paintings/:id — لوحة واحدة (عام)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ${PAINTING_COLS}, a.name as artist_name, a.bio as artist_bio
      FROM paintings p
      LEFT JOIN artists a ON p.artist_id = a.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/paintings/:id/image — تقديم صورة اللوحة المخزّنة في قاعدة البيانات (عام)
router.get('/:id/image', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT image_data, image_mime FROM paintings WHERE id=?',
      [req.params.id]
    );
    if (!rows.length || !rows[0].image_data) return res.status(404).end();
    res.set('Content-Type', rows[0].image_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(rows[0].image_data);
  } catch {
    res.status(500).end();
  }
});

// POST /api/paintings — إضافة لوحة (محمي: فنان أو أدمن)
// الأمان: نأخذ artist_id من حساب الفنان المسجّل، لا من جسم الطلب،
// فلا يستطيع فنان رفع لوحة باسم فنان آخر.
router.post('/', authRequired, allowRoles('artist', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const { title, price, style, medium, size_cm, year, description } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'العنوان مطلوب' });

    const artistId = await getArtistId(req.user.id);
    if (!artistId) {
      return res.status(400).json({ success: false, message: 'لا يوجد ملف فنان مرتبط بحسابك' });
    }

    const image = req.file ? req.file.originalname : null;
    const imageData = req.file ? req.file.buffer : null;
    const imageMime = req.file ? req.file.mimetype : null;
    const [result] = await db.query(
      `INSERT INTO paintings (title,artist_id,price,style,medium,size_cm,year,description,image,image_data,image_mime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [title, artistId, price || 0, style, medium, size_cm, year || null, description, image, imageData, imageMime]
    );
    res.json({ success: true, id: result.insertId, message: 'تمت إضافة اللوحة' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/paintings/:id — حذف لوحة (محمي: صاحبها أو أدمن)
router.delete('/:id', authRequired, allowRoles('artist', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT artist_id FROM paintings WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'غير موجود' });

    // الأدمن يحذف أي لوحة؛ الفنان يحذف لوحاته فقط
    if (req.user.role !== 'admin') {
      const artistId = await getArtistId(req.user.id);
      if (rows[0].artist_id !== artistId) {
        return res.status(403).json({ success: false, message: 'لا تملك صلاحية حذف هذه اللوحة' });
      }
    }
    await db.query('DELETE FROM paintings WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;