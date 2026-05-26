import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

const EMPTY = {
  title: "",
  price: "",
  style: "",
  medium: "",
  size_cm: "",
  year: "",
  description: "",
};

export default function ArtistDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // حماية: لو ليس فناناً/أدمن، أعِده للرئيسية
  useEffect(() => {
    if (!user || (user.role !== "artist" && user.role !== "admin")) {
      navigate("/");
    }
  }, []); // eslint-disable-line

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const loadMine = useCallback(() => {
    setLoading(true);
    api
      .get("/paintings/mine")
      .then((r) => setMine(r.data.data || []))
      .catch(() => setErr("Tablolar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.title.trim()) {
      setErr("Başlık gerekli");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("image", file);
      await api.post("/paintings", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg("✅ Tablo başarıyla eklendi");
      setForm(EMPTY);
      setFile(null);
      setPreview(null);
      loadMine();
    } catch (e2) {
      setErr(e2.response?.data?.message || "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Bu tabloyu silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/paintings/${id}`);
      setMine((m) => m.filter((p) => p.id !== id));
    } catch {
      setErr("Silme işlemi başarısız");
    }
  }

  return (
    <div className="page-wrapper">
      <h1 className="section-title" style={{ marginBottom: "0.3rem" }}>
        Sanatçı <span>Paneli</span>
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2.5rem" }}>
        Hoş geldin, {user?.name} — tablolarını buradan yönet
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: "2rem",
          alignItems: "start",
        }}
        className="artist-grid"
      >
        {/* نموذج الرفع */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1.5rem",
          }}
        >
          <h3 style={{ marginBottom: "1.2rem", fontWeight: 600 }}>
            🖼️ Yeni Tablo Ekle
          </h3>

          {msg && <div style={okBox}>{msg}</div>}
          {err && <div style={errBox}>{err}</div>}

          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
          >
            {/* رفع الصورة */}
            <label style={uploadBox}>
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    maxHeight: 200,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span style={{ color: "var(--muted)" }}>
                  📷 Tablo görselini seç
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onFile}
                style={{ display: "none" }}
              />
            </label>

            <input
              placeholder="Başlık *"
              value={form.title}
              onChange={set("title")}
              required
            />
            <input
              placeholder="Fiyat (₺)"
              type="number"
              value={form.price}
              onChange={set("price")}
            />
            <input
              placeholder="Stil (örn: Empresyonizm)"
              value={form.style}
              onChange={set("style")}
            />
            <input
              placeholder="Teknik (örn: Tuval üzerine yağlıboya)"
              value={form.medium}
              onChange={set("medium")}
            />
            <input
              placeholder="Boyut (örn: 60x80)"
              value={form.size_cm}
              onChange={set("size_cm")}
            />
            <input
              placeholder="Yıl"
              type="number"
              value={form.year}
              onChange={set("year")}
            />
            <textarea
              placeholder="Açıklama"
              rows={3}
              value={form.description}
              onChange={set("description")}
              style={{ resize: "vertical" }}
            />

            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Ekleniyor..." : "Tabloyu Ekle"}
            </button>
          </form>
        </div>

        {/* لوحات الفنان */}
        <div>
          <h3 style={{ marginBottom: "1.2rem", fontWeight: 600 }}>
            Tablolarım ({mine.length})
          </h3>

          {loading ? (
            <div className="loading">⏳ Yükleniyor...</div>
          ) : mine.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--border)",
                borderRadius: 12,
                padding: "3rem 1rem",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Henüz tablo eklemediniz. Soldaki formu kullanın 👈
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              {mine.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "0.7rem",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={
                      p.image
                        ? `${API}/uploads/${p.image}`
                        : `https://picsum.photos/seed/${p.id}/120/90`
                    }
                    alt={p.title}
                    style={{
                      width: 90,
                      height: 68,
                      objectFit: "cover",
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>
                      {p.title}
                    </div>
                    <div style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
                      {Number(p.price).toLocaleString("tr-TR")} ₺
                    </div>
                    {p.style && (
                      <span
                        className="badge"
                        style={{ marginTop: "0.3rem", display: "inline-block" }}
                      >
                        {p.style}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    title="Sil"
                    style={{
                      background: "rgba(224,85,85,0.1)",
                      border: "1px solid var(--danger)",
                      color: "var(--danger)",
                      borderRadius: 6,
                      padding: "0.4rem 0.7rem",
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const okBox = {
  background: "rgba(74,222,128,0.1)",
  border: "1px solid #4ade80",
  color: "#4ade80",
  padding: "0.6rem 1rem",
  borderRadius: 6,
  marginBottom: "1rem",
  fontSize: "0.88rem",
};
const errBox = {
  background: "rgba(224,85,85,0.1)",
  border: "1px solid var(--danger)",
  color: "var(--danger)",
  padding: "0.6rem 1rem",
  borderRadius: 6,
  marginBottom: "1rem",
  fontSize: "0.88rem",
};
const uploadBox = {
  border: "1px dashed var(--border)",
  borderRadius: 8,
  padding: "1.2rem",
  textAlign: "center",
  cursor: "pointer",
  display: "block",
};
