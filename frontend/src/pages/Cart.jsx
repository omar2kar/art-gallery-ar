import { Link } from "react-router-dom";
import useCart from "../hooks/useCart";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

export default function Cart() {
  const { items, remove, clear, total } = useCart();

  if (items.length === 0)
    return (
      <div className="page-wrapper">
        <h1 className="section-title" style={{ marginBottom: "1.5rem" }}>
          <span>Sepetim</span>
        </h1>
        <div className="loading">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>🛒</div>
          <p style={{ color: "var(--muted)", marginBottom: "1.2rem" }}>
            Sepetiniz boş.
          </p>
          <Link to="/">
            <button className="btn-primary">Galeriye Göz At</button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="page-wrapper">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.8rem",
          flexWrap: "wrap",
          gap: "0.6rem",
        }}
      >
        <h1 className="section-title" style={{ margin: 0 }}>
          Sepetim <span>({items.length})</span>
        </h1>
        <button
          className="btn-outline"
          style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem" }}
          onClick={clear}
        >
          Sepeti Temizle
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {items.map((p) => {
          const imgSrc = p.image
            ? `${API}/uploads/${p.image}`
            : `https://picsum.photos/seed/${p.id}/160/160`;
          return (
            <div key={p.id} className="mine-row" style={{ gap: "1rem" }}>
              <Link to={`/painting/${p.id}`} style={{ flexShrink: 0 }}>
                <img
                  src={imgSrc}
                  alt={p.title}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    display: "block",
                  }}
                />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  to={`/painting/${p.id}`}
                  style={{
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.title}
                </Link>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {p.artist_name}
                </div>
              </div>
              <div
                style={{
                  color: "var(--accent2)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {Number(p.price).toLocaleString("tr-TR")} ₺
              </div>
              <button
                onClick={() => remove(p.id)}
                aria-label="Kaldır"
                title="Kaldır"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border-soft)",
                  color: "var(--danger)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.5rem 0.7rem",
                  fontSize: "0.9rem",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>

      {/* الإجمالي */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.4rem 1.5rem",
          background:
            "linear-gradient(180deg, var(--surface), var(--bg-soft))",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Toplam Tutar
          </div>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "2rem",
              color: "var(--accent2)",
              fontWeight: 600,
            }}
          >
            {Number(total).toLocaleString("tr-TR")} ₺
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: "0.9rem 2rem" }}
          onClick={() =>
            alert("Ödeme entegrasyonu yakında eklenecek 💳")
          }
        >
          Ödemeye Geç
        </button>
      </div>
    </div>
  );
}
