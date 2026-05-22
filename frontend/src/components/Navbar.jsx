import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        background: "rgba(10,10,15,0.9)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link
        to="/"
        style={{ fontSize: "1.6rem", fontWeight: 300, color: "var(--accent)" }}
      >
        لوحاتي{" "}
        <span style={{ fontStyle: "italic", color: "var(--accent2)" }}>
          Gallery
        </span>
      </Link>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        <Link to="/" style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
          المعرض
        </Link>

        {user?.role === "admin" && (
          <Link
            to="/admin"
            style={{ color: "var(--muted)", fontSize: "0.95rem" }}
          >
            الإدارة
          </Link>
        )}

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
              مرحباً {user.name}
            </span>
            <button
              className="btn-outline"
              style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
              onClick={logout}
            >
              خروج
            </button>
          </div>
        ) : (
          <Link to="/login">
            <button
              className="btn-primary"
              style={{ padding: "0.5rem 1.5rem", fontSize: "0.9rem" }}
            >
              دخول
            </button>
          </Link>
        )}
      </div>
    </nav>
  );
}
