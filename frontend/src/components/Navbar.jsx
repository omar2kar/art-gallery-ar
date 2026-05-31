import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useCart from "../hooks/useCart";
import useFavorites from "../hooks/useFavorites";
import Logo from "./Logo";

// أيقونة بشارة عدد — تُستخدم للسلة والمفضّلة
function IconCount({ to, icon, count, label }) {
  return (
    <Link to={to} className="nav-icon" aria-label={label} title={label}>
      <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{icon}</span>
      {count > 0 && <span className="nav-badge">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ظل/خلفية أوضح عند التمرير
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // أغلق الدرج عند تغيير الصفحة + امنع تمرير الخلفية
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setOpen(false);
    navigate("/login");
  }

  return (
    <>
      <nav className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label="Sanat Galerisi">
            <Logo size={36} />
          </Link>

          {/* روابط سطح المكتب */}
          <div className="nav-links">
            <Link to="/" className="nav-link">
              Galeri
            </Link>
            {user?.role === "artist" && (
              <Link to="/artist" className="nav-link">
                Tablolarım
              </Link>
            )}
            {user?.role === "admin" && (
              <Link to="/admin" className="nav-link">
                Yönetim
              </Link>
            )}

            <IconCount to="/favorites" icon="🤍" count={favCount} label="Favorilerim" />
            <IconCount to="/cart" icon="🛒" count={cartCount} label="Sepetim" />

            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <Link
                  to="/profile"
                  className="nav-user"
                  style={{ textDecoration: "none" }}
                  title="Profilim"
                >
                  Merhaba, {user.name}
                </Link>
                <button
                  className="btn-outline"
                  style={{ padding: "0.45rem 1.1rem", fontSize: "0.85rem" }}
                  onClick={logout}
                >
                  Çıkış
                </button>
              </div>
            ) : (
              <Link to="/login">
                <button
                  className="btn-primary"
                  style={{ padding: "0.55rem 1.6rem", fontSize: "0.9rem" }}
                >
                  Giriş
                </button>
              </Link>
            )}
          </div>

          {/* زر القائمة للموبايل */}
          <button
            className={`hamburger${open ? " open" : ""}`}
            aria-label="Menü"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* درج الموبايل */}
      {open && (
        <>
          <div className="nav-backdrop" onClick={() => setOpen(false)} />
          <aside className="drawer">
            {user && (
              <Link
                to="/profile"
                style={{
                  display: "block",
                  color: "var(--accent)",
                  fontWeight: 600,
                  padding: "0.4rem 0.6rem 0.8rem",
                  fontSize: "1.05rem",
                  textDecoration: "none",
                }}
              >
                Merhaba, {user.name} →
              </Link>
            )}

            <Link to="/" className="drawer-link">
              🖼️ Galeri
            </Link>
            {user && (
              <Link to="/profile" className="drawer-link">
                👤 Profilim
              </Link>
            )}
            <Link to="/favorites" className="drawer-link">
              🤍 Favorilerim{favCount > 0 ? ` (${favCount})` : ""}
            </Link>
            <Link to="/cart" className="drawer-link">
              🛒 Sepetim{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
            {user?.role === "artist" && (
              <Link to="/artist" className="drawer-link">
                🎨 Tablolarım
              </Link>
            )}
            {user?.role === "admin" && (
              <Link to="/admin" className="drawer-link">
                ⚙️ Yönetim
              </Link>
            )}

            <div className="drawer-divider" />

            {user ? (
              <button
                className="btn-outline"
                style={{ width: "100%", padding: "0.85rem" }}
                onClick={logout}
              >
                Çıkış Yap
              </button>
            ) : (
              <Link to="/login" style={{ display: "block" }}>
                <button className="btn-primary" style={{ width: "100%", padding: "0.9rem" }}>
                  Giriş Yap
                </button>
              </Link>
            )}
          </aside>
        </>
      )}
    </>
  );
}
