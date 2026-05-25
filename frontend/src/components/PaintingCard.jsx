import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFavorites from "../hooks/useFavorites";

// إصلاح مهم: متغيّر بيئة بدل IP ثابت — وإلا تُحجب الصور على Vercel (Mixed Content)
const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

export default function PaintingCard({ painting, onARClick }) {
  const navigate = useNavigate();
  const { isFav, toggle } = useFavorites();
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shared, setShared] = useState(false);

  const fav = isFav(painting.id);

  const imgSrc =
    painting.image && !imgError
      ? `${API}/uploads/${painting.image}`
      : `https://picsum.photos/seed/${painting.id}/400/300`;

  const goDetail = () => navigate(`/painting/${painting.id}`);

  // مشاركة: نستخدم Web Share API على الجوال، أو نسخ الرابط على غيره
  const share = async (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/painting/${painting.id}`;
    const data = {
      title: painting.title,
      text: `${painting.title} — ${painting.artist_name}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  };

  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        <img
          src={imgSrc}
          alt={painting.title}
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            aspectRatio: "4/3",
            objectFit: "cover",
            display: "block",
            cursor: "pointer",
            transition: "transform 0.4s ease",
            transform: hover ? "scale(1.05)" : "scale(1)",
          }}
          onClick={goDetail}
        />

        {/* زر المفضّلة (قلب) أعلى اليمين */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle(painting.id);
          }}
          aria-label="favorite"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            background: "rgba(10,10,15,0.55)",
            backdropFilter: "blur(4px)",
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: fav ? "scale(1.15)" : "scale(1)",
          }}
        >
          {fav ? "❤️" : "🤍"}
        </button>

        {/* Hover overlay — يعمل باللمس أيضاً */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(10,10,15,0.92), transparent 60%)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "1rem",
            opacity: hover ? 1 : 0,
            transition: "opacity 0.3s",
            pointerEvents: hover ? "auto" : "none",
          }}
        >
          <button
            className="btn-primary"
            style={{ padding: "0.5rem 1.5rem", fontSize: "0.85rem" }}
            onClick={goDetail}
          >
            Detayları Gör
          </button>
        </div>
      </div>

      <div style={{ padding: "1rem" }}>
        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            marginBottom: "0.3rem",
          }}
        >
          {painting.title}
        </div>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "0.85rem",
            marginBottom: "0.8rem",
          }}
        >
          {painting.artist_name}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "var(--accent)",
              fontWeight: 700,
              fontSize: "1.05rem",
            }}
          >
            {Number(painting.price).toLocaleString("tr-TR")} ₺
          </span>
          {painting.style && <span className="badge">{painting.style}</span>}
        </div>
      </div>

      <div
        style={{
          padding: "0.7rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <button
          className="btn-outline"
          style={{
            padding: "0.35rem 0.9rem",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
          onClick={() => onARClick(painting)}
        >
          📷 Duvarda Görüntüle
        </button>

        <button
          onClick={share}
          aria-label="share"
          title="Paylaş"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: shared ? "var(--accent)" : "var(--muted)",
            borderRadius: 6,
            padding: "0.35rem 0.6rem",
            fontSize: "0.8rem",
            transition: "all 0.2s",
          }}
        >
          {shared ? "✓ Kopyalandı" : "🔗"}
        </button>
      </div>
    </div>
  );
}
