import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import ARViewer from "../components/ARViewerXR";
import useCart from "../hooks/useCart";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

export default function PaintingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has, toggle } = useCart();
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
        ⏳ Yükleniyor...
      </div>
    );
  if (!painting)
    return (
      <div className="loading" style={{ paddingTop: "8rem" }}>
        Tablo bulunamadı
      </div>
    );

  const imgSrc = painting.image
    ? `${API}/uploads/${painting.image}`
    : `https://picsum.photos/seed/${painting.id}/700/520`;

  return (
    <div className="page-wrapper">
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          marginBottom: "1.8rem",
          fontSize: "0.95rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        ← Galeriye dön
      </button>

      <div className="detail-grid">
        {/* الصورة */}
        <div className="detail-img">
          <img
            src={imgSrc}
            alt={painting.title}
            style={{
              width: "100%",
              borderRadius: "var(--radius)",
              display: "block",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          />
        </div>

        {/* المعلومات */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <div
              style={{
                color: "var(--accent)",
                fontSize: "0.85rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "0.6rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              ✦ {painting.artist_name}
            </div>
            <h1
              className="section-title"
              style={{ fontSize: "clamp(1.8rem, 5vw, 2.6rem)" }}
            >
              {painting.title}
            </h1>
          </div>

          <div style={{ height: 1, background: "var(--border)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {[
              ["Stil", painting.style],
              ["Malzeme", painting.medium],
              ["Boyut", painting.size_cm ? painting.size_cm + " cm" : null],
              ["Yıl", painting.year],
            ].map(
              ([label, val]) =>
                val && (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.95rem",
                      paddingBottom: "0.5rem",
                      borderBottom: "1px solid var(--border-soft)",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ),
            )}
          </div>

          {painting.description && (
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.85,
                fontSize: "0.98rem",
              }}
            >
              {painting.description}
            </p>
          )}

          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "2.4rem",
              color: "var(--accent2)",
              fontWeight: 600,
            }}
          >
            {Number(painting.price).toLocaleString("tr-TR")} ₺
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <button
              className="btn-outline"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.95rem",
                fontSize: "1rem",
              }}
              onClick={() => setShowAR(true)}
            >
              📷 Duvarda Görüntüle
            </button>
            <button
              className={has(painting.id) ? "btn-outline" : "btn-primary"}
              style={{ padding: "0.95rem" }}
              onClick={() => toggle(painting)}
            >
              {has(painting.id) ? "✓ Sepette — Çıkar" : "Sepete Ekle"}
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
