import { useState, useEffect, useCallback } from "react";

// خطّاف بسيط لإدارة اللوحات المفضّلة عبر localStorage.
// يحفظ قائمة المعرّفات (ids) في متصفّح الزائر — لا حاجة لقاعدة بيانات.
// ملاحظة: localStorage يعمل في مشروعك الحقيقي على المتصفح بشكل طبيعي.

const KEY = "favorite_paintings";
const EVENT = "favorites-changed"; // حدث داخلي لمزامنة المكوّنات في نفس التبويب

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

  // مزامنة بين التبويبات (storage) وداخل نفس التبويب (حدث مخصّص)
  useEffect(() => {
    const sync = () => setIds(read());
    const onStorage = (e) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const persist = useCallback((next) => {
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* تجاهل أخطاء التخزين */
    }
    // أبلغ بقية المكوّنات في نفس التبويب (الـ storage event لا يُطلق محلياً)
    window.dispatchEvent(new Event(EVENT));
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