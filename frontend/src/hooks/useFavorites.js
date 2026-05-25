import { useState, useEffect, useCallback } from "react";

// خطّاف بسيط لإدارة اللوحات المفضّلة عبر localStorage.
// يحفظ قائمة المعرّفات (ids) في متصفّح الزائر — لا حاجة لقاعدة بيانات.
// ملاحظة: localStorage يعمل في مشروعك الحقيقي على المتصفح بشكل طبيعي.

const KEY = "favorite_paintings";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function useFavorites() {
  const [ids, setIds] = useState(read);

  // مزامنة بين التبويبات/المكوّنات
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setIds(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next) => {
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* تجاهل أخطاء التخزين */
    }
  }, []);

  const isFav = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id) => {
      const next = ids.includes(id)
        ? ids.filter((x) => x !== id)
        : [...ids, id];
      persist(next);
    },
    [ids, persist]
  );

  return { favIds: ids, isFav, toggle, count: ids.length };
}