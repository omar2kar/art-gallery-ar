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
      setMsg("✅ تمت إضافة اللوحة بنجاح");
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
      setMsg("❌ حدث خطأ");
    }
  }

  return (
    <div className="page-wrapper">
      <h1 className="section-title" style={{ marginBottom: "2rem" }}>
        لوحة <span>الإدارة</span>
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Add Painting Form */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ marginBottom: "1.5rem", fontWeight: 500 }}>
            إضافة لوحة جديدة
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
              placeholder="اسم اللوحة *"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              value={form.artist_id}
              onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
            >
              <option value="">-- اختر الفنان --</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              placeholder="السعر (ريال) *"
              type="number"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              placeholder="الأسلوب (انطباعية، واقعية...)"
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
            />
            <input
              placeholder="الخامة (زيت على قماش...)"
              value={form.medium}
              onChange={(e) => setForm({ ...form, medium: e.target.value })}
            />
            <input
              placeholder="المقاس (مثال: 60x80)"
              value={form.size_cm}
              onChange={(e) => setForm({ ...form, size_cm: e.target.value })}
            />
            <input
              placeholder="السنة"
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
            <textarea
              placeholder="وصف اللوحة"
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
                صورة اللوحة
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
                style={{ border: "none", padding: 0, background: "none" }}
              />
            </div>
            <button className="btn-primary" type="submit">
              إضافة اللوحة
            </button>
          </form>
        </div>

        {/* Paintings List */}
        <div>
          <h2 style={{ marginBottom: "1rem", fontWeight: 500 }}>
            اللوحات ({paintings.length})
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
              <div
                key={p.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.8rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{p.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {p.artist_name} • {Number(p.price).toLocaleString()} ريال
                  </div>
                </div>
                <span className="badge">{p.style || "بدون أسلوب"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
