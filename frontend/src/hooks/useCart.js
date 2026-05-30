import { useState, useEffect, useCallback } from "react";

// خطّاف السلة عبر localStorage — يعمل بالكامل على المتصفح بلا قاعدة بيانات.
// اللوحات قطع فريدة (نسخة واحدة)، لذا لا توجد كمية: كل لوحة تظهر مرة واحدة.
// نخزّن كائناً مختصراً لكل لوحة حتى تُعرض السلة دون إعادة جلب من الخادم.

const KEY = "cart_items";
const EVENT = "cart-changed"; // مزامنة المكوّنات في نفس التبويب

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function useCart() {
  const [items, setItems] = useState(read);

  useEffect(() => {
    const sync = () => setItems(read());
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
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* تجاهل أخطاء التخزين */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const has = useCallback((id) => items.some((p) => p.id === id), [items]);

  // يضيف لوحة (نحتفظ بالحقول اللازمة للعرض فقط)
  const add = useCallback(
    (painting) => {
      if (items.some((p) => p.id === painting.id)) return;
      const lite = {
        id: painting.id,
        title: painting.title,
        price: Number(painting.price) || 0,
        image: painting.image || null,
        artist_name: painting.artist_name || "",
      };
      persist([...items, lite]);
    },
    [items, persist],
  );

  const remove = useCallback(
    (id) => persist(items.filter((p) => p.id !== id)),
    [items, persist],
  );

  // يضيف إن لم تكن موجودة، أو يزيلها إن كانت — مفيد لزر واحد
  const toggle = useCallback(
    (painting) => {
      if (items.some((p) => p.id === painting.id)) {
        persist(items.filter((p) => p.id !== painting.id));
      } else {
        add(painting);
      }
    },
    [items, persist, add],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const total = items.reduce((s, p) => s + (Number(p.price) || 0), 0);

  return { items, has, add, remove, toggle, clear, count: items.length, total };
}
