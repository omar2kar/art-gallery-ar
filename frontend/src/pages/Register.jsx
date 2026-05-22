import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "حدث خطأ");
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
          إنشاء <span style={{ color: "var(--accent)" }}>حساب</span>
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
            placeholder="الاسم الكامل"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
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
            {loading ? "جارٍ التسجيل..." : "تسجيل"}
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
          لديك حساب؟{" "}
          <Link to="/login" style={{ color: "var(--accent)" }}>
            سجّل دخولك
          </Link>
        </p>
      </div>
    </div>
  );
}
