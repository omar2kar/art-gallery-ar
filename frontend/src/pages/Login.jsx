import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "خطأ في البيانات");
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
          borderRadius: "12px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        <h2
          style={{ marginBottom: "2rem", fontSize: "1.8rem", fontWeight: 400 }}
        >
          تسجيل <span style={{ color: "var(--accent)" }}>الدخول</span>
        </h2>

        {error && (
          <div
            style={{
              background: "rgba(224,85,85,0.1)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              padding: "0.7rem 1rem",
              borderRadius: "6px",
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
            placeholder="البريد الإلكتروني"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="كلمة المرور"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
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
          ليس لديك حساب؟{" "}
          <Link to="/register" style={{ color: "var(--accent)" }}>
            سجّل الآن
          </Link>
        </p>
      </div>
    </div>
  );
}
