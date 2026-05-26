import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("user"); // user | artist
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    bio: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { ...form, role });
      // دخول تلقائي بعد التسجيل
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      // الفنان يذهب للوحته، المستخدم للرئيسية
      navigate(res.data.user.role === "artist" ? "/artist" : "/");
    } catch (err) {
      setError(err.response?.data?.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 440,
        }}
      >
        <h2
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.8rem",
            fontWeight: 400,
          }}
        >
          Hesap <span style={{ color: "var(--accent)" }}>Oluştur</span>
        </h2>

        {/* اختيار نوع الحساب */}
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => setRole("user")}
            style={roleBtn(role === "user")}
          >
            🎨 Sanatsever
          </button>
          <button
            type="button"
            onClick={() => setRole("artist")}
            style={roleBtn(role === "artist")}
          >
            🖌️ Sanatçı
          </button>
        </div>

        {role === "artist" && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.82rem",
              marginBottom: "1.2rem",
              lineHeight: 1.6,
            }}
          >
            Sanatçı olarak kaydolursanız kendi tablolarınızı yükleyip
            sergileyebilirsiniz.
          </p>
        )}

        {error && <div style={errBox}>{error}</div>}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            placeholder="Ad Soyad"
            required
            value={form.name}
            onChange={set("name")}
          />
          <input
            placeholder="E-posta"
            type="email"
            required
            value={form.email}
            onChange={set("email")}
          />

          <div style={{ position: "relative" }}>
            <input
              placeholder="Şifre (en az 6 karakter)"
              type={showPass ? "text" : "password"}
              required
              value={form.password}
              onChange={set("password")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={eyeBtn}
              tabIndex={-1}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>

          {role === "artist" && (
            <textarea
              placeholder="Kısa biyografi (isteğe bağlı)"
              rows={3}
              value={form.bio}
              onChange={set("bio")}
              style={{ resize: "vertical" }}
            />
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            color: "var(--muted)",
            fontSize: "0.9rem",
          }}
        >
          Zaten hesabınız var mı?{" "}
          <Link to="/login" style={{ color: "var(--accent)" }}>
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}

const roleBtn = (active) => ({
  flex: 1,
  padding: "0.8rem",
  borderRadius: 8,
  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
  background: active ? "rgba(201,168,76,0.12)" : "var(--surface2)",
  color: active ? "var(--accent)" : "var(--muted)",
  fontWeight: 700,
  fontSize: "0.9rem",
  transition: "all 0.2s",
});

const errBox = {
  background: "rgba(224,85,85,0.1)",
  border: "1px solid var(--danger)",
  color: "var(--danger)",
  padding: "0.7rem 1rem",
  borderRadius: 6,
  marginBottom: "1rem",
  fontSize: "0.9rem",
};

const eyeBtn = {
  position: "absolute",
  left: 10,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  fontSize: "1.1rem",
  cursor: "pointer",
};
