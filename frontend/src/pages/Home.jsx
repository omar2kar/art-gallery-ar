import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import PaintingCard from "../components/PaintingCard";
import ARViewer from "../components/ARViewerXR";

// خيارات الترتيب
const SORTS = {
  newest: { label: "En Yeni", fn: (a, b) => b.id - a.id },
  cheap: { label: "Fiyat ↑", fn: (a, b) => Number(a.price) - Number(b.price) },
  expensive: {
    label: "Fiyat ↓",
    fn: (a, b) => Number(b.price) - Number(a.price),
  },
};

export default function Home() {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false);
  const [arPainting, setArPainting] = useState(null);
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState("all"); // فلتر النمط
  const [sort, setSort] = useState("newest"); // الترتيب

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setSlow(false);
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

  // أنماط فريدة للفلترة (من البيانات نفسها)
  const styles = useMemo(() => {
    const set = new Set(paintings.map((p) => p.style).filter(Boolean));
    return ["all", ...set];
  }, [paintings]);

  // بحث + فلتر + ترتيب
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    let list = paintings.filter((p) => {
      const okStyle = style === "all" || p.style === style;
      if (!okStyle) return false;
      if (!q) return true;
      const hay = [p.title, p.artist_name, p.style]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return hay.includes(q);
    });
    return list.sort(SORTS[sort].fn);
  }, [paintings, search, style, sort]);

  return (
    <div className="page-wrapper">
      {/* خلفية متوهّجة ناعمة خلف الـ Hero */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(900px, 90vw)",
          height: 420,
          background:
            "radial-gradient(ellipse at center, rgba(201,168,76,0.18), transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Hero */}
      <div
        style={{
          textAlign: "center",
          padding: "2rem 0 3rem",
          position: "relative",
          zIndex: 1,
        }}
        className="hero-in"
      >
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

      {/* البحث */}
      <div
        style={{
          maxWidth: 500,
          margin: "0 auto 1.2rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        <input
          placeholder="🔍  Tablo veya sanatçı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* شريط الفلترة + الترتيب */}
      {!loading && !error && paintings.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.8rem",
            alignItems: "center",
            marginBottom: "2.2rem",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* الأنماط — تمرير أفقي على الموبايل */}
          <div className="filter-scroll" style={{ flex: 1 }}>
            {styles.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={style === s ? "chip chip-active" : "chip"}
              >
                {s === "all" ? "Tümü" : s}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              width: "auto",
              flexShrink: 0,
              padding: "0.5rem 0.8rem",
              fontSize: "0.85rem",
            }}
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* تحميل — هيكل عظمي (skeleton) */}
      {loading && (
        <>
          {slow && (
            <div className="loading" style={{ paddingBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                  lineHeight: 1.6,
                }}
              >
                ⏳ Sunucu uyanıyor, ilk açılış biraz sürebilir (~30 sn)...
              </div>
            </div>
          )}
          <div className="grid-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card sk-card">
                <div className="sk sk-img" />
                <div style={{ padding: "1rem" }}>
                  <div className="sk sk-line" style={{ width: "70%" }} />
                  <div className="sk sk-line" style={{ width: "45%" }} />
                  <div
                    className="sk sk-line"
                    style={{ width: "30%", marginTop: "0.8rem" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* خطأ */}
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
      {!loading && !error && visible.length === 0 && (
        <div className="loading">
          {search.trim() || style !== "all"
            ? "Aramanıza uygun sonuç bulunamadı"
            : "Henüz tablo eklenmemiş"}
        </div>
      )}

      {/* الشبكة — مع ظهور متدرّج */}
      {!loading && !error && visible.length > 0 && (
        <div className="grid-3">
          {visible.map((p, i) => (
            <div
              key={p.id}
              className="fade-up"
              style={{ animationDelay: `${Math.min(i * 60, 600)}ms` }}
            >
              <PaintingCard painting={p} onARClick={setArPainting} />
            </div>
          ))}
        </div>
      )}

      {arPainting && (
        <ARViewer painting={arPainting} onClose={() => setArPainting(null)} />
      )}
    </div>
  );
}
