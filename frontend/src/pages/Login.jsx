import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      // توجيه حسب الدور
      const role = res.data.user.role;
      navigate(
        role === "artist" ? "/artist" : role === "admin" ? "/admin" : "/",
      );
    } catch (err) {
      setError(err.response?.data?.message || "Giriş bilgileri hatalı");
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
          maxWidth: 420,
        }}
      >
        <h2
          style={{ marginBottom: "2rem", fontSize: "1.8rem", fontWeight: 400 }}
        >
          Giriş <span style={{ color: "var(--accent)" }}>Yap</span>
        </h2>

        {error && (
          <div
            style={{
              background: "rgba(224,85,85,0.1)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              padding: "0.7rem 1rem",
              borderRadius: 6,
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            placeholder="E-posta"
            type="email"
            required
            value={form.email}
            onChange={set("email")}
          />

          <div style={{ position: "relative" }}>
            <input
              placeholder="Şifre"
              type={showPass ? "text" : "password"}
              required
              value={form.password}
              onChange={set("password")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                fontSize: "1.1rem",
                cursor: "pointer",
              }}
              tabIndex={-1}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş"}
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
          Hesabınız yok mu?{" "}
          <Link to="/register" style={{ color: "var(--accent)" }}>
            Kayıt ol
          </Link>
        </p>
      </div>
    </div>
  );
}
