import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import PaintingCard from "../components/PaintingCard";
import ARViewer from "../components/ARViewerXR";

export default function Home() {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false); // الخادم بطيء (نوم Render)
  const [arPainting, setArPainting] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setSlow(false);
    // لو تأخّر الرد (Render نائم) نُظهر رسالة طمأنة بعد 4 ثوانٍ
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    api
      .get("/paintings")
      .then((r) => setPaintings(r.data.data || []))
      .catch(() => setError(true))
      .finally(() => {
        clearTimeout(slowTimer);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // بحث غير حسّاس لحالة الأحرف ويتجاهل المسافات الزائدة
  const q = search.trim().toLocaleLowerCase("tr-TR");
  const filtered = paintings.filter((p) => {
    if (!q) return true;
    const hay = [p.title, p.artist_name, p.style]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    return hay.includes(q);
  });

  return (
    <div className="page-wrapper">
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "2rem 0 3rem" }}>
        <div
          style={{
            fontSize: "0.8rem",
            letterSpacing: "0.3em",
            color: "var(--accent)",
            marginBottom: "1rem",
            textTransform: "uppercase",
          }}
        >
          ✦ Dijital Sanat Galerisi ✦
        </div>
        <h1
          className="section-title"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
        >
          Her köşede <span>güzelliği</span>
          <br />
          keşfedin
        </h1>
        <p
          style={{
            color: "var(--muted)",
            marginTop: "1rem",
            fontSize: "1.05rem",
          }}
        >
          Tabloları canlı kamera teknolojisiyle evinizin duvarında görün
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 500, margin: "0 auto 2rem" }}>
        <input
          placeholder="🔍  Tablo veya sanatçı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* تحميل */}
      {loading && (
        <div className="loading">
          ⏳ Tablolar yükleniyor...
          {slow && (
            <div
              style={{
                fontSize: "0.85rem",
                marginTop: "0.8rem",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              Sunucu uyanıyor, bu ilk açılışta biraz sürebilir (~30 sn).
              <br />
              Lütfen bekleyin...
            </div>
          )}
        </div>
      )}

      {/* خطأ اتصال */}
      {!loading && error && (
        <div className="loading">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>⚠️</div>
          <p style={{ color: "var(--text)", marginBottom: "1.2rem" }}>
            Tablolar yüklenemedi. İnternet bağlantınızı kontrol edin.
          </p>
          <button className="btn-primary" onClick={load}>
            🔄 Tekrar Dene
          </button>
        </div>
      )}

      {/* لا نتائج */}
      {!loading && !error && filtered.length === 0 && (
        <div className="loading">
          {search.trim()
            ? `"${search}" için sonuç bulunamadı`
            : "Henüz tablo eklenmemiş"}
        </div>
      )}

      {/* الشبكة */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid-3">
          {filtered.map((p) => (
            <PaintingCard key={p.id} painting={p} onARClick={setArPainting} />
          ))}
        </div>
      )}

      {arPainting && (
        <ARViewer painting={arPainting} onClose={() => setArPainting(null)} />
      )}
    </div>
  );
}
