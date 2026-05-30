import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import PaintingCard from "../components/PaintingCard";
import ARViewer from "../components/ARViewerXR";
import useFavorites from "../hooks/useFavorites";

export default function Favorites() {
  const { favIds } = useFavorites();
  const [paintings, setPaintings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [arPainting, setArPainting] = useState(null);

  useEffect(() => {
    api
      .get("/paintings")
      .then((r) => setPaintings(r.data.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const favs = useMemo(
    () => paintings.filter((p) => favIds.includes(p.id)),
    [paintings, favIds],
  );

  return (
    <div className="page-wrapper">
      <h1 className="section-title" style={{ marginBottom: "1.8rem" }}>
        <span>Favorilerim</span>
        {favIds.length > 0 && (
          <span style={{ color: "var(--accent)" }}> ({favIds.length})</span>
        )}
      </h1>

      {loading && (
        <div className="grid-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card sk-card">
              <div className="sk sk-img" />
              <div style={{ padding: "1rem" }}>
                <div className="sk sk-line" style={{ width: "70%" }} />
                <div className="sk sk-line" style={{ width: "45%" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="loading">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>⚠️</div>
          <p style={{ color: "var(--text)" }}>
            Tablolar yüklenemedi. İnternet bağlantınızı kontrol edin.
          </p>
        </div>
      )}

      {!loading && !error && favs.length === 0 && (
        <div className="loading">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>🤍</div>
          <p style={{ color: "var(--muted)", marginBottom: "1.2rem" }}>
            Henüz favori tablonuz yok. Beğendiğiniz tabloların kalbine dokunun.
          </p>
          <Link to="/">
            <button className="btn-primary">Galeriye Göz At</button>
          </Link>
        </div>
      )}

      {!loading && !error && favs.length > 0 && (
        <div className="grid-3">
          {favs.map((p, i) => (
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
