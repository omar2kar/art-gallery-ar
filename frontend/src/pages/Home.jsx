import { useState, useEffect } from "react";
import api from "../api/axios";
import PaintingCard from "../components/PaintingCard";
import ARViewer from "../components/ARViewerXR";

export default function Home() {
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [arPainting, setArPainting] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/paintings")
      .then((r) => setPaintings(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = paintings.filter(
    (p) =>
      p.title.includes(search) ||
      p.artist_name?.includes(search) ||
      p.style?.includes(search),
  );

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
          ✦ معرض الفنون الرقمي ✦
        </div>
        <h1
          className="section-title"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
        >
          اكتشف <span>الجمال</span>
          <br />
          في كل زاوية
        </h1>
        <p
          style={{
            color: "var(--muted)",
            marginTop: "1rem",
            fontSize: "1.05rem",
          }}
        >
          عرض اللوحات على جدار منزلك بتقنية الكاميرا المباشرة
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 500, margin: "0 auto 2rem" }}>
        <input
          placeholder="🔍  ابحث عن لوحة أو فنان..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="loading">⏳ جارٍ تحميل اللوحات...</div>}

      {!loading && filtered.length === 0 && (
        <div className="loading">لا توجد نتائج للبحث</div>
      )}

      <div className="grid-3">
        {filtered.map((p) => (
          <PaintingCard key={p.id} painting={p} onARClick={setArPainting} />
        ))}
      </div>

      {arPainting && (
        <ARViewer painting={arPainting} onClose={() => setArPainting(null)} />
      )}
    </div>
  );
}
