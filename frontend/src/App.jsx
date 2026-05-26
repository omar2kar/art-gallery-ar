// ===================================================
// routes/paintings.js — مع حماية وربط بالفنان
// ===================================================
const router = require("express").Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const { authRequired, allowRoles } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
// قبول الصور فقط + حد أقصى 5 ميغابايت
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("يُسمح بالصور فقط"));
  },
});

// يُرجع artist_id المرتبط بالمستخدم الحالي (للفنان)
async function getArtistId(userId) {
  const [rows] = await db.query("SELECT id FROM artists WHERE user_id=?", [
    userId,
  ]);
  return rows.length ? rows[0].id : null;
}

// GET /api/paintings — كل اللوحات (عام)
router.get("/", async (req, res) => {
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

// GET /api/paintings/mine — لوحات الفنان الحالي (محمي)
// مهم: قبل /:id حتى لا تُفسَّر "mine" كمعرّف
router.get(
  "/mine",
  authRequired,
  allowRoles("artist", "admin"),
  async (req, res) => {
    try {
      const artistId = await getArtistId(req.user.id);
      if (!artistId) return res.json({ success: true, data: [] });
      const [rows] = await db.query(
        "SELECT * FROM paintings WHERE artist_id=? ORDER BY created_at DESC",
        [artistId],
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/paintings/:id — لوحة واحدة (عام)
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT p.*, a.name as artist_name, a.bio as artist_bio
      FROM paintings p
      LEFT JOIN artists a ON p.artist_id = a.id
      WHERE p.id = ?
    `,
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: "غير موجود" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/paintings — إضافة لوحة (محمي: فنان أو أدمن)
// الأمان: نأخذ artist_id من حساب الفنان المسجّل، لا من جسم الطلب،
// فلا يستطيع فنان رفع لوحة باسم فنان آخر.
router.post(
  "/",
  authRequired,
  allowRoles("artist", "admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, price, style, medium, size_cm, year, description } =
        req.body;
      if (!title)
        return res
          .status(400)
          .json({ success: false, message: "العنوان مطلوب" });

      const artistId = await getArtistId(req.user.id);
      if (!artistId) {
        return res
          .status(400)
          .json({ success: false, message: "لا يوجد ملف فنان مرتبط بحسابك" });
      }

      const image = req.file ? req.file.filename : null;
      const [result] = await db.query(
        `INSERT INTO paintings (title,artist_id,price,style,medium,size_cm,year,description,image)
       VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          title,
          artistId,
          price || 0,
          style,
          medium,
          size_cm,
          year || null,
          description,
          image,
        ],
      );
      res.json({
        success: true,
        id: result.insertId,
        message: "تمت إضافة اللوحة",
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// DELETE /api/paintings/:id — حذف لوحة (محمي: صاحبها أو أدمن)
router.delete(
  "/:id",
  authRequired,
  allowRoles("artist", "admin"),
  async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT artist_id FROM paintings WHERE id=?",
        [req.params.id],
      );
      if (!rows.length)
        return res.status(404).json({ success: false, message: "غير موجود" });

      // الأدمن يحذف أي لوحة؛ الفنان يحذف لوحاته فقط
      if (req.user.role !== "admin") {
        const artistId = await getArtistId(req.user.id);
        if (rows[0].artist_id !== artistId) {
          return res
            .status(403)
            .json({ success: false, message: "لا تملك صلاحية حذف هذه اللوحة" });
        }
      }
      await db.query("DELETE FROM paintings WHERE id=?", [req.params.id]);
      res.json({ success: true, message: "تم الحذف" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
