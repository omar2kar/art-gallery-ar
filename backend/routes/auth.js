const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (name,email,password) VALUES (?,?,?)',
      [name, email, hashed]);
    res.json({ success: true, message: 'تم التسجيل بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'البريد مستخدم مسبقاً' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'بيانات خاطئة' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ message: 'بيانات خاطئة' });
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role },
      process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: rows[0].id, name: rows[0].name, role: rows[0].role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;