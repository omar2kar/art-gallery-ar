import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { artistPhotoUrl } from "../utils/img";

const ROLE_TR = {
  admin: "Yönetici",
  artist: "Sanatçı",
  user: "Üye",
};

export default function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null); // { count, value } للفنان

  // نموذج الحساب
  const [name, setName] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [savingAcc, setSavingAcc] = useState(false);
  const [accMsg, setAccMsg] = useState("");
  const [accErr, setAccErr] = useState("");

  // نموذج الفنان
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [savingArt, setSavingArt] = useState(false);
  const [artMsg, setArtMsg] = useState("");
  const [artErr, setArtErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/auth/me")
      .then((r) => {
        const u = r.data.user;
        setMe(u);
        setName(u.name || "");
        setBio(u.bio || "");
        if (u.role === "artist") {
          api
            .get("/paintings/mine")
            .then((res) => {
              const list = res.data.data || [];
              setStats({
                count: list.length,
                value: list.reduce((s, p) => s + Number(p.price || 0), 0),
              });
            })
            .catch(() => {});
        }
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    load();
  }, [load, navigate]);

  function onPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function saveAccount(e) {
    e.preventDefault();
    setAccErr("");
    setAccMsg("");
    if (!name.trim()) {
      setAccErr("İsim boş olamaz");
      return;
    }
    if (newPass && newPass.length < 6) {
      setAccErr("Yeni şifre en az 6 karakter olmalı");
      return;
    }
    if (newPass && !curPass) {
      setAccErr("Mevcut şifrenizi girin");
      return;
    }
    setSavingAcc(true);
    try {
      const r = await api.put("/auth/profile", {
        name: name.trim(),
        currentPassword: curPass || undefined,
        newPassword: newPass || undefined,
      });
      // حدّث الاسم المخزّن محلياً ليظهر في الـ Navbar فوراً
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored) {
        stored.name = r.data.user.name;
        localStorage.setItem("user", JSON.stringify(stored));
      }
      setMe((m) => ({ ...m, name: r.data.user.name }));
      setCurPass("");
      setNewPass("");
      setAccMsg("✅ Hesap bilgileri güncellendi");
      setTimeout(() => setAccMsg(""), 3000);
    } catch (e2) {
      setAccErr(e2.response?.data?.message || "Bir hata oluştu");
    } finally {
      setSavingAcc(false);
    }
  }

  async function saveArtist(e) {
    e.preventDefault();
    setArtErr("");
    setArtMsg("");
    setSavingArt(true);
    try {
      const fd = new FormData();
      fd.append("bio", bio);
      if (photoFile) fd.append("photo", photoFile);
      await api.put("/artists/me", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPhotoFile(null);
      setArtMsg("✅ Sanatçı profili güncellendi");
      load(); // أعد التحميل لتحديث has_photo والصورة الحيّة
      setTimeout(() => setArtMsg(""), 3000);
    } catch (e2) {
      setArtErr(e2.response?.data?.message || "Bir hata oluştu");
    } finally {
      setSavingArt(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="loading" style={{ color: "var(--muted)" }}>
          Profil yükleniyor…
        </div>
      </div>
    );
  }
  if (!me) return null;

  const photoUrl = photoPreview || artistPhotoUrl(me);
  const initial = (me.name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR");

  return (
    <div className="page-wrapper">
      {/* رأس البروفايل */}
      <div
        className="hero-in"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.4rem",
          flexWrap: "wrap",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          padding: "1.6rem",
          marginBottom: "2rem",
        }}
      >
        {/* الأفاتار */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            flexShrink: 0,
            border: "2px solid var(--accent)",
            boxShadow: "0 8px 28px rgba(201,168,76,0.25)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.05))",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={me.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontSize: "2.4rem",
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              {initial}
            </span>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            className="section-title"
            style={{ margin: 0, fontSize: "1.8rem" }}
          >
            {me.name}
          </h1>
          <p style={{ color: "var(--muted)", margin: "0.3rem 0 0.6rem" }}>
            {me.email}
          </p>
          <span className="badge">{ROLE_TR[me.role] || me.role}</span>
        </div>

        {/* روابط سريعة حسب الدور */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {me.role === "artist" && (
            <Link to="/artist">
              <button className="btn-outline" style={{ fontSize: "0.85rem" }}>
                🎨 Tablolarım
              </button>
            </Link>
          )}
          {me.role === "admin" && (
            <Link to="/admin">
              <button className="btn-outline" style={{ fontSize: "0.85rem" }}>
                ⚙️ Yönetim
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* بطاقات إحصائية للفنان */}
      {me.role === "artist" && stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="stat-card">
            <span style={{ fontSize: "1.8rem" }}>🖼️</span>
            <div>
              <div className="stat-num">{stats.count}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                Toplam Tablo
              </div>
            </div>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: "1.8rem" }}>💰</span>
            <div>
              <div className="stat-num" style={{ fontSize: "1.5rem" }}>
                {stats.value.toLocaleString("tr-TR")} ₺
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                Toplam Değer
              </div>
            </div>
          </div>
        </div>
      )}

      {/* الشبكة: حساب + (فنان) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            me.role === "artist" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
          gap: "1.4rem",
          maxWidth: me.role === "artist" ? "100%" : 560,
        }}
      >
        {/* نموذج الحساب */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: "1.2rem", fontWeight: 600 }}>
            👤 Hesap Bilgileri
          </h3>
          {accMsg && <div style={okBox}>{accMsg}</div>}
          {accErr && <div style={errBox}>{accErr}</div>}

          <form onSubmit={saveAccount} style={formStyle}>
            <div>
              <label style={lblStyle}>İsim</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız"
              />
            </div>

            <div style={{ ...dividerLabel }}>Şifre Değiştir (isteğe bağlı)</div>

            <div>
              <label style={lblStyle}>Mevcut Şifre</label>
              <input
                type="password"
                value={curPass}
                onChange={(e) => setCurPass(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label style={lblStyle}>Yeni Şifre</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="En az 6 karakter"
                autoComplete="new-password"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={savingAcc}>
              {savingAcc ? "Kaydediliyor..." : "Bilgileri Kaydet"}
            </button>
          </form>
        </div>

        {/* نموذج الفنان */}
        {me.role === "artist" && (
          <div style={cardStyle}>
            <h3 style={{ marginBottom: "1.2rem", fontWeight: 600 }}>
              🎨 Sanatçı Profili
            </h3>
            {artMsg && <div style={okBox}>{artMsg}</div>}
            {artErr && <div style={errBox}>{artErr}</div>}

            <form onSubmit={saveArtist} style={formStyle}>
              <label className="upload-zone">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt=""
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      objectFit: "cover",
                      margin: "0 auto",
                    }}
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>
                      📷
                    </div>
                    <span style={{ color: "var(--muted)" }}>
                      Profil fotoğrafı seç
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhoto}
                  style={{ display: "none" }}
                />
              </label>

              <div>
                <label style={lblStyle}>Hakkımda (Biyografi)</label>
                <textarea
                  rows={5}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Sanatçı olarak kendinizi tanıtın…"
                  style={{ resize: "vertical" }}
                />
              </div>

              <button className="btn-primary" type="submit" disabled={savingArt}>
                {savingArt ? "Kaydediliyor..." : "Profili Kaydet"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "1.5rem",
};
const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};
const lblStyle = {
  display: "block",
  fontSize: "0.8rem",
  color: "var(--muted)",
  marginBottom: "0.35rem",
};
const dividerLabel = {
  borderTop: "1px solid var(--border)",
  paddingTop: "0.9rem",
  marginTop: "0.2rem",
  fontSize: "0.78rem",
  color: "var(--muted)",
  letterSpacing: "0.04em",
};
const okBox = {
  background: "rgba(74,222,128,0.1)",
  border: "1px solid #4ade80",
  color: "#4ade80",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  marginBottom: "1rem",
  fontSize: "0.88rem",
};
const errBox = {
  background: "rgba(224,85,85,0.1)",
  border: "1px solid var(--danger)",
  color: "var(--danger)",
  padding: "0.6rem 1rem",
  borderRadius: 8,
  marginBottom: "1rem",
  fontSize: "0.88rem",
};
