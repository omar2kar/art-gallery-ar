// ===================================================
// middleware/auth.js — حماية المسارات
// ضعه في: backend/middleware/auth.js
// ===================================================
const jwt = require('jsonwebtoken');

// يتحقق من وجود توكن صالح في الترويسة Authorization: Bearer <token>
// إن نجح، يضع بيانات المستخدم في req.user ويُكمل؛ وإلا يرفض الطلب.
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'جلسة غير صالحة، سجّل الدخول من جديد' });
  }
}

// يتحقق أن دور المستخدم ضمن الأدوار المسموح بها (يُستخدم بعد authRequired)
// مثال: router.post('/', authRequired, allowRoles('artist','admin'), handler)
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'لا تملك صلاحية لهذا الإجراء' });
    }
    next();
  };
}

module.exports = { authRequired, allowRoles };