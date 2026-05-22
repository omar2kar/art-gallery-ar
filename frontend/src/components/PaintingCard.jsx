import { useNavigate } from "react-router-dom";

const API = "http://192.168.0.145:5000";

export default function PaintingCard({ painting, onARClick }) {
  const navigate = useNavigate();
  const imgSrc = painting.image
    ? `${API}/uploads/${painting.image}`
    : `https://picsum.photos/seed/${painting.id}/400/300`;

  return (
    <div className="card">
      <div style={{ position: "relative", overflow: "hidden" }}>
        <img
          src={imgSrc}
          alt={painting.title}
          style={{
            width: "100%",
            aspectRatio: "4/3",
            objectFit: "cover",
            display: "block",
            cursor: "pointer",
          }}
          onClick={() => navigate(`/painting/${painting.id}`)}
        />
        {/* Hover overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(10,10,15,0.9), transparent)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "1rem",
            opacity: 0,
            transition: "opacity 0.3s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
        >
          <button
            className="btn-primary"
            style={{ padding: "0.5rem 1.5rem", fontSize: "0.85rem" }}
            onClick={() => navigate(`/painting/${painting.id}`)}
          >
            عرض التفاصيل
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
            {Number(painting.price).toLocaleString("ar-SA")} ريال
          </span>
          <span className="badge">{painting.style}</span>
        </div>
      </div>

      <div
        style={{
          padding: "0.7rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
          📷 عرض على الجدار
        </button>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          {painting.year}
        </span>
      </div>
    </div>
  );
}
