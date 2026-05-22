import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import ARViewer from "../components/ARViewer";

const API = "http://localhost:5000";

export default function PaintingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [painting, setPainting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAR, setShowAR] = useState(false);

  useEffect(() => {
    api
      .get(`/paintings/${id}`)
      .then((r) => setPainting(r.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="loading" style={{ paddingTop: "8rem" }}>
        ⏳ جارٍ التحميل...
      </div>
    );
  if (!painting)
    return (
      <div className="loading" style={{ paddingTop: "8rem" }}>
        اللوحة غير موجودة
      </div>
    );

  const imgSrc = painting.image
    ? `${API}/uploads/${painting.image}`
    : `https://picsum.photos/seed/${painting.id}/600/450`;

  return (
    <div className="page-wrapper">
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          marginBottom: "2rem",
          fontSize: "0.95rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        ← رجوع للمعرض
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3rem",
          alignItems: "start",
        }}
      >
        {/* Image */}
        <div>
          <img
            src={imgSrc}
            alt={painting.title}
            style={{
              width: "100%",
              borderRadius: "10px",
              display: "block",
              border: "1px solid var(--border)",
            }}
          />
        </div>

        {/* Info */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div>
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.85rem",
                letterSpacing: "0.1em",
                marginBottom: "0.5rem",
              }}
            >
              {painting.artist_name}
            </div>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 400 }}>
              {painting.title}
            </h1>
          </div>

          <div style={{ height: 1, background: "var(--border)" }} />

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}
          >
            {[
              ["الأسلوب", painting.style],
              ["الخامة", painting.medium],
              ["المقاس", painting.size_cm ? painting.size_cm + " سم" : "-"],
              ["السنة", painting.year],
            ].map(
              ([label, val]) =>
                val && (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ),
            )}
          </div>

          {painting.description && (
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.8,
                fontSize: "0.95rem",
              }}
            >
              {painting.description}
            </p>
          )}

          <div style={{ height: 1, background: "var(--border)" }} />

          <div
            style={{
              fontSize: "2rem",
              color: "var(--accent)",
              fontWeight: 700,
            }}
          >
            {Number(painting.price).toLocaleString("ar-SA")} ريال
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
          >
            <button
              className="btn-outline"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.9rem",
                fontSize: "1rem",
              }}
              onClick={() => setShowAR(true)}
            >
              📷 عرض على الجدار
            </button>
            <button className="btn-primary" style={{ padding: "0.9rem" }}>
              إضافة للسلة
            </button>
          </div>
        </div>
      </div>

      {showAR && (
        <ARViewer painting={painting} onClose={() => setShowAR(false)} />
      )}
    </div>
  );
}
