import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFavorites from "../hooks/useFavorites";
import { paintingImageUrl, IMG_PLACEHOLDER } from "../utils/img";

export default function PaintingCard({ painting, onARClick }) {
  const navigate = useNavigate();
  const { isFav, toggle } = useFavorites();
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shared, setShared] = useState(false);

  const fav = isFav(painting.id);

  const realUrl = paintingImageUrl(painting);
  const imgSrc = realUrl && !imgError ? realUrl : IMG_PLACEHOLDER;

  const goDetail = () => navigate(`/painting/${painting.id}`);

  // مشاركة: Web Share API على الجوال، أو نسخ الرابط
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
      <div
        style={{ position: "relative", overflow: "hidden", cursor: "pointer" }}
        onClick={goDetail}
      >
        <img
          src={imgSrc}
          alt={painting.title}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            aspectRatio: "4/5",
            objectFit: "cover",
            display: "block",
            transition: "transform 0.6s cubic-bezier(.2,.8,.2,1)",
            transform: hover ? "scale(1.06)" : "scale(1)",
          }}
        />

        {/* تدرّج سفلي دائم لإبراز السعر فوق الصورة */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(8,8,12,0.85) 0%, rgba(8,8,12,0.2) 35%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* شارة النمط أعلى اليسار */}
        {painting.style && (
          <span
            className="badge"
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(8,8,12,0.65)",
              backdropFilter: "blur(6px)",
            }}
          >
            {painting.style}
          </span>
        )}

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
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "rgba(8,8,12,0.55)",
            backdropFilter: "blur(6px)",
            fontSize: "1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s",
            transform: fav ? "scale(1.15)" : "scale(1)",
          }}
        >
          {fav ? "❤️" : "🤍"}
        </button>

        {/* السعر فوق الصورة */}
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 12,
            color: "var(--accent2)",
            fontWeight: 700,
            fontSize: "1.15rem",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {Number(painting.price).toLocaleString("tr-TR")} ₺
        </div>
      </div>

      {/* المعلومات */}
      <div style={{ padding: "0.9rem 1rem 0.7rem" }}>
        <div
          style={{
            fontFamily: "var(--display)",
            fontSize: "1.15rem",
            fontWeight: 500,
            lineHeight: 1.25,
            marginBottom: "0.25rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {painting.title}
        </div>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{ color: "var(--accent)" }}>✦</span>
          {painting.artist_name}
        </div>
      </div>

      {/* الإجراءات */}
      <div
        style={{
          padding: "0.6rem 1rem 0.9rem",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <button
          className="btn-outline"
          style={{
            flex: 1,
            padding: "0.55rem 0.6rem",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
          }}
          onClick={() => onARClick(painting)}
        >
          📷 Duvarda Gör
        </button>

        <button
          onClick={share}
          aria-label="share"
          title="Paylaş"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border-soft)",
            color: shared ? "var(--accent)" : "var(--muted)",
            borderRadius: "var(--radius-sm)",
            padding: "0.55rem 0.7rem",
            fontSize: "0.85rem",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {shared ? "✓" : "🔗"}
        </button>
      </div>
    </div>
  );
}
