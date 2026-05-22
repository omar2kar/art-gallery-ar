const router = require('express').Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// إعداد رفع الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// GET /api/paintings - جلب كل اللوحات
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, a.name as artist_name, a.photo as artist_photo
      FROM paintings p
      LEFT JOIN artists a ON p.artist_id = a.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/paintings/:id - تفاصيل لوحة واحدة
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, a.name as artist_name, a.bio as artist_bio
      FROM paintings p
      LEFT JOIN artists a ON p.artist_id = a.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/paintings - إضافة لوحة جديدة
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, artist_id, price, style, medium, size_cm, year, description } = req.body;
    const image = req.file ? req.file.filename : null;
    const [result] = await db.query(
      `INSERT INTO paintings (title,artist_id,price,style,medium,size_cm,year,description,image)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [title, artist_id, price, style, medium, size_cm, year, description, image]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;