// شعار المعرض: رمز ذهبي (لوحة داخل إطار: شمس + تلال + قاعدة) + اسم بخط Playfair.
export default function Logo({ size = 36, withText = true }) {
  return (
    <span className="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="logo-mark"
      >
        <defs>
          <linearGradient id="logoGold" x1="4" y1="4" x2="44" y2="44">
            <stop offset="0" stopColor="#f4e0a0" />
            <stop offset="0.5" stopColor="#d4af6a" />
            <stop offset="1" stopColor="#b8923f" />
          </linearGradient>
        </defs>
        <rect
          x="3.25"
          y="3.25"
          width="41.5"
          height="41.5"
          rx="11"
          stroke="url(#logoGold)"
          strokeWidth="2.5"
        />
        <circle cx="31.5" cy="16.5" r="4.4" fill="url(#logoGold)" />
        <path
          d="M9 33.5C15 24.5 20.5 30 25.5 24.5C29.5 20 35 25.5 39 22"
          stroke="url(#logoGold)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M9.5 38.5H38.5"
          stroke="url(#logoGold)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>

      {withText && (
        <span className="logo-text">
          <span className="logo-main">Sanat</span>
          <span className="logo-sub">GALERİSİ</span>
        </span>
      )}
    </span>
  );
}
