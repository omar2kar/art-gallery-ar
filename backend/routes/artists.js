const router = require('express').Router();
const db = require('../db');

// GET /api/artists
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM artists ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/artists/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM artists WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'غير موجود' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;