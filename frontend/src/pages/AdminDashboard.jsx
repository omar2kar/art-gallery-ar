import { useState, useEffect } from "react";
import api from "../api/axios";

export default function AdminDashboard() {
  const [paintings, setPaintings] = useState([]);
  const [artists, setArtists] = useState([]);
  const [form, setForm] = useState({
    title: "",
    artist_id: "",
    price: "",
    style: "",
    medium: "",
    size_cm: "",
    year: "",
    description: "",
  });
  const [image, setImage] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/paintings").then((r) => setPaintings(r.data.data));
    api.get("/artists").then((r) => setArtists(r.data.data));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (image) fd.append("image", image);
    try {
      await api.post("/paintings", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg("✅ Tablo başarıyla eklendi");
      api.get("/paintings").then((r) => setPaintings(r.data.data));
      setForm({
        title: "",
        artist_id: "",
        price: "",
        style: "",
        medium: "",
        size_cm: "",
        year: "",
        description: "",
      });
      setImage(null);
    } catch {
      setMsg("❌ Bir hata oluştu");
    }
  }

  return (
    <div className="page-wrapper">
      <h1 className="section-title" style={{ marginBottom: "2rem" }}>
        Yönetim <span>Paneli</span>
      </h1>

      <div className="artist-grid">
        {/* Add Painting Form */}
        <div
          style={{
            background: "linear-gradient(180deg, var(--surface), var(--bg-soft))",
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--radius)",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ marginBottom: "1.5rem", fontWeight: 600 }}>
            🖌️ Yeni Tablo Ekle
          </h2>
          {msg && (
            <div
              style={{
                marginBottom: "1rem",
                color: msg.includes("✅") ? "var(--accent)" : "var(--danger)",
              }}
            >
              {msg}
            </div>
          )}

          <form
            onSubmit={handleAdd}
            style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
          >
            <input
              placeholder="Tablo adı *"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              value={form.artist_id}
              onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
            >
              <option value="">-- Sanatçı seç --</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Fiyat (₺) *"
              type="number"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              placeholder="Stil (Empresyonizm, Realizm...)"
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
            />
            <input
              placeholder="Teknik (Tuval üzerine yağlıboya...)"
              value={form.medium}
              onChange={(e) => setForm({ ...form, medium: e.target.value })}
            />
            <input
              placeholder="Boyut (örn: 60x80 cm)"
              value={form.size_cm}
              onChange={(e) => setForm({ ...form, size_cm: e.target.value })}
            />
            <input
              placeholder="Yıl"
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
            <textarea
              placeholder="Tablo açıklaması"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <div>
              <label
                style={{
                  color: "var(--muted)",
                  fontSize: "0.85rem",
                  display: "block",
                  marginBottom: "0.4rem",
                }}
              >
                Tablo görseli
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
                style={{ border: "none", padding: 0, background: "none" }}
              />
            </div>
            <button className="btn-primary" type="submit">
              Tabloyu Ekle
            </button>
          </form>
        </div>

        {/* Paintings List */}
        <div>
          <h2 style={{ marginBottom: "1rem", fontWeight: 600 }}>
            Tablolar ({paintings.length})
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.7rem",
              maxHeight: "600px",
              overflowY: "auto",
            }}
          >
            {paintings.map((p) => (
              <div key={p.id} className="mine-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {p.artist_name} • {Number(p.price).toLocaleString("tr-TR")} ₺
                  </div>
                </div>
                <span className="badge">{p.style || "Stil yok"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
