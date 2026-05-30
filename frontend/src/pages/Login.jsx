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
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <b>Sanat</b> Galerisi
        </div>
        <h2 className="auth-title">
          Tekrar <span>Hoş Geldin</span>
        </h2>

        {error && <div className="auth-error">{error}</div>}

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
              className="auth-eye"
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

        <p className="auth-foot">
          Hesabınız yok mu? <Link to="/register">Kayıt ol</Link>
        </p>
      </div>
    </div>
  );
}
