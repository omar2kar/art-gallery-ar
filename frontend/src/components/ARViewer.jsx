import { useEffect, useRef, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

export default function ARViewer({ painting, onClose }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const imgRef = useRef(null);
  const roomRef = useRef(null);

  const [mode, setMode] = useState("choose");

  // كل state لها ref مقابل
  const [pos, setPos] = useState({ x: 300, y: 300 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showFrame, setShowFrame] = useState(true);
  const [placed, setPlaced] = useState(false);
  const [toast, setToast] = useState("");

  const posRef = useRef({ x: 300, y: 300 });
  const scaleRef = useRef(1);
  const rotRef = useRef(0);
  const showFrameRef = useRef(true);
  const placedRef = useRef(false);
  const modeRef = useRef("choose");

  // sync state → ref
  const syncPos = (v) => {
    posRef.current = v;
    setPos(v);
  };
  const syncScale = (v) => {
    scaleRef.current = v;
    setScale(v);
  };
  const syncRotation = (v) => {
    rotRef.current = v;
    setRotation(v);
  };
  const syncFrame = (v) => {
    showFrameRef.current = v;
    setShowFrame(v);
  };
  const syncPlaced = (v) => {
    placedRef.current = v;
    setPlaced(v);
  };
  const syncMode = (v) => {
    modeRef.current = v;
    setMode(v);
  };

  const dragging = useRef(false);
  const dragOff = useRef({ x: 0, y: 0 });
  const pinchDist = useRef(0);
  const pinchScale = useRef(1);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // تحميل صورة اللوحة
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = painting.image
      ? `${API}/uploads/${painting.image}`
      : `https://picsum.photos/seed/${painting.id}/600/450`;
    img.onload = () => {
      imgRef.current = img;
    };
  }, []);

  function resizeCanvas() {
    if (!canvasRef.current) return;
    canvasRef.current.width = window.innerWidth;
    canvasRef.current.height = window.innerHeight;
  }

  function getPaintDim() {
    const W = canvasRef.current?.width || window.innerWidth;
    const maxW = W * 0.38 * scaleRef.current;
    const ratio = imgRef.current
      ? imgRef.current.height / imgRef.current.width
      : 0.75;
    return { pw: maxW, ph: maxW * ratio };
  }

  function getWallBounds() {
    const W = canvasRef.current?.width || window.innerWidth;
    const H = canvasRef.current?.height || window.innerHeight;
    return {
      top: H * 0.08,
      bottom: H * 0.75,
      left: W * 0.06,
      right: W * 0.94,
    };
  }

  function clampToWall(x, y) {
    const wall = getWallBounds();
    const { pw, ph } = getPaintDim();
    return {
      x: Math.max(wall.left + pw / 2, Math.min(wall.right - pw / 2, x)),
      y: Math.max(wall.top + ph / 2, Math.min(wall.bottom - ph / 2, y)),
    };
  }

  // ========== RENDER ==========
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || modeRef.current !== "ar") return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // --- خلفية ---
    if (roomRef.current) {
      const r = roomRef.current;
      const sc = Math.max(W / r.width, H / r.height);
      const sw = r.width * sc;
      const sh = r.height * sc;
      ctx.drawImage(r, (W - sw) / 2, (H - sh) / 2, sw, sh);
    } else {
      drawRoom(ctx, W, H);
    }

    // --- اللوحة ---
    if (!placedRef.current || !imgRef.current) return;

    const { pw, ph } = getPaintDim();
    const { x, y } = posRef.current;
    const rot = (rotRef.current * Math.PI) / 180;
    const fw = showFrameRef.current ? Math.max(10, 16 * scaleRef.current) : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // ظل ناعم كبير
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 50 * scaleRef.current;
    ctx.shadowOffsetX = 14 * scaleRef.current;
    ctx.shadowOffsetY = 16 * scaleRef.current;
    ctx.fillStyle = "rgba(0,0,0,0.01)";
    ctx.fillRect(
      -pw / 2 - fw - 5,
      -ph / 2 - fw - 5,
      pw + fw * 2 + 10,
      ph + fw * 2 + 10,
    );
    ctx.restore();

    // ظل حاد قريب
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(0,0,0,0.01)";
    ctx.fillRect(-pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6);
    ctx.restore();

    // إطار 3D
    if (showFrameRef.current) {
      const depth = fw * 0.45;

      // وجه سفلي (ظل)
      ctx.fillStyle = "rgba(30,18,3,0.95)";
      ctx.beginPath();
      ctx.moveTo(-pw / 2 - fw, ph / 2 + fw);
      ctx.lineTo(-pw / 2 - fw + depth, ph / 2 + fw - depth);
      ctx.lineTo(pw / 2 + fw - depth, ph / 2 + fw - depth);
      ctx.lineTo(pw / 2 + fw, ph / 2 + fw);
      ctx.closePath();
      ctx.fill();

      // وجه أيمن (ضوء)
      ctx.fillStyle = "rgba(220,170,60,0.6)";
      ctx.beginPath();
      ctx.moveTo(pw / 2 + fw, -ph / 2 - fw);
      ctx.lineTo(pw / 2 + fw - depth, -ph / 2 - fw + depth);
      ctx.lineTo(pw / 2 + fw - depth, ph / 2 + fw - depth);
      ctx.lineTo(pw / 2 + fw, ph / 2 + fw);
      ctx.closePath();
      ctx.fill();

      // الإطار الأمامي - تدرج ذهبي
      const g = ctx.createLinearGradient(
        -pw / 2 - fw,
        -ph / 2 - fw,
        pw / 2 + fw,
        ph / 2 + fw,
      );
      g.addColorStop(0, "#b08820");
      g.addColorStop(0.15, "#f5d055");
      g.addColorStop(0.3, "#c09028");
      g.addColorStop(0.5, "#eecc3a");
      g.addColorStop(0.7, "#9a6e18");
      g.addColorStop(0.85, "#e8b828");
      g.addColorStop(1, "#b88e1e");
      ctx.fillStyle = g;
      ctx.fillRect(-pw / 2 - fw, -ph / 2 - fw, pw + fw * 2, ph + fw * 2);

      // خط زخرفي داخل الإطار
      ctx.strokeStyle = "rgba(255,230,120,0.35)";
      ctx.lineWidth = 1.5;
      const inset = fw * 0.28;
      ctx.strokeRect(
        -pw / 2 - fw + inset,
        -ph / 2 - fw + inset,
        pw + (fw - inset) * 2,
        ph + (fw - inset) * 2,
      );

      // حد داخلي داكن
      ctx.fillStyle = "rgba(15,8,2,0.97)";
      ctx.fillRect(-pw / 2 - 2, -ph / 2 - 2, pw + 4, ph + 4);
    }

    // اللوحة
    ctx.drawImage(imgRef.current, -pw / 2, -ph / 2, pw, ph);

    // طبقة إضاءة
    const light = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
    light.addColorStop(0, "rgba(255,255,255,0.07)");
    light.addColorStop(0.4, "rgba(255,255,255,0.02)");
    light.addColorStop(1, "rgba(0,0,0,0.09)");
    ctx.fillStyle = light;
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);

    // مؤشر تحديد عند السحب
    if (dragging.current) {
      ctx.strokeStyle = "rgba(201,168,76,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, []);

  // loop مستمر
  useEffect(() => {
    if (mode !== "ar") return;
    let running = true;
    function loop() {
      if (!running) return;
      draw();
      animRef.current = requestAnimationFrame(loop);
    }
    resizeCanvas();
    loop();
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mode, draw]);

  // resize
  useEffect(() => {
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // غرفة افتراضية
  function drawRoom(ctx, W, H) {
    // جدار
    const wall = ctx.createLinearGradient(0, 0, W, H * 0.78);
    wall.addColorStop(0, "#d5cdc1");
    wall.addColorStop(0.6, "#cac2b6");
    wall.addColorStop(1, "#bfb8ab");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H * 0.78);

    // ضوء من أعلى اليمين
    const spot = ctx.createRadialGradient(
      W * 0.78,
      0,
      0,
      W * 0.78,
      H * 0.1,
      H * 0.9,
    );
    spot.addColorStop(0, "rgba(255,248,235,0.28)");
    spot.addColorStop(0.6, "rgba(255,248,235,0.06)");
    spot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H * 0.78);

    // خط زخرفي منتصف الجدار
    ctx.strokeStyle = "rgba(150,138,122,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.44);
    ctx.lineTo(W, H * 0.44);
    ctx.stroke();

    // قاعدة الجدار
    ctx.fillStyle = "#ddd6cc";
    ctx.fillRect(0, H * 0.762, W, H * 0.025);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, H * 0.787, W, 5);

    // أرضية
    const floor = ctx.createLinearGradient(0, H * 0.787, W * 0.4, H);
    floor.addColorStop(0, "#8a6418");
    floor.addColorStop(0.4, "#6e4e0e");
    floor.addColorStop(1, "#523a08");
    ctx.fillStyle = floor;
    ctx.fillRect(0, H * 0.787, W, H);

    // ألواح أرضية
    ctx.strokeStyle = "rgba(0,0,0,0.13)";
    ctx.lineWidth = 1;
    const plankW = W / 7;
    for (let x = 0; x < W; x += plankW) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.787);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = H * 0.787; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // ضوء على الأرضية
    const floorLight = ctx.createLinearGradient(W * 0.4, H * 0.787, W, H);
    floorLight.addColorStop(0, "rgba(255,220,150,0.14)");
    floorLight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floorLight;
    ctx.fillRect(0, H * 0.787, W, H);

    // ظل قاعدة الجدار
    const baseShadow = ctx.createLinearGradient(0, H * 0.787, 0, H * 0.87);
    baseShadow.addColorStop(0, "rgba(0,0,0,0.42)");
    baseShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = baseShadow;
    ctx.fillRect(0, H * 0.787, W, H * 0.083);
  }

  // رفع صورة الغرفة
  function handleRoomUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        roomRef.current = img;
        syncPlaced(false);
        syncScale(1);
        syncMode("ar");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // أحداث
  function handleDown(x, y) {
    const clamped = clampToWall(x, y);
    if (!placedRef.current) {
      syncPos(clamped);
      syncPlaced(true);
      return;
    }
    const { pw, ph } = getPaintDim();
    const p = posRef.current;
    if (
      x >= p.x - pw / 2 &&
      x <= p.x + pw / 2 &&
      y >= p.y - ph / 2 &&
      y <= p.y + ph / 2
    ) {
      dragging.current = true;
      dragOff.current = { x: x - p.x, y: y - p.y };
    } else {
      syncPos(clamped);
      syncPlaced(true);
    }
  }

  function handleMove(x, y) {
    if (!dragging.current) return;
    const raw = { x: x - dragOff.current.x, y: y - dragOff.current.y };
    syncPos(clampToWall(raw.x, raw.y));
  }

  function handleUp() {
    dragging.current = false;
  }

  const onTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      handleDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      dragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.sqrt(dx * dx + dy * dy);
      pinchScale.current = scaleRef.current;
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      syncScale(
        Math.max(
          0.2,
          Math.min(3, (pinchScale.current * dist) / pinchDist.current),
        ),
      );
    }
  };

  function saveImage() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${painting.title}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    showToast("تم حفظ الصورة 📸");
  }

  // ========== UI ==========
  const iconBtn = {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "white",
    width: 42,
    height: 42,
    borderRadius: "50%",
    fontSize: "1.1rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const ctrlBtn = {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
    padding: "0.5rem 0.85rem",
    borderRadius: "10px",
    fontSize: "0.75rem",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.15rem",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* شاشة الاختيار */}
      {mode === "choose" && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            maxWidth: "360px",
            width: "100%",
          }}
        >
          <div
            style={{
              width: 160,
              height: 120,
              margin: "0 auto 1.5rem",
              border: "3px solid var(--accent)",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(201,168,76,0.3)",
            }}
          >
            <img
              src={
                painting.image
                  ? `${API}/uploads/${painting.image}`
                  : `https://picsum.photos/seed/${painting.id}/400/300`
              }
              alt={painting.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <h2
            style={{ color: "white", fontWeight: 500, marginBottom: "0.3rem" }}
          >
            {painting.title}
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.85rem",
              marginBottom: "2rem",
            }}
          >
            اختر طريقة العرض
          </p>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.7rem",
              background:
                "linear-gradient(135deg,var(--accent),var(--accent2))",
              color: "#0a0a0f",
              padding: "1rem",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "0.8rem",
              boxShadow: "0 8px 30px rgba(201,168,76,0.35)",
            }}
          >
            <span>📷</span> ارفع صورة غرفتك
            <input
              type="file"
              accept="image/*"
              onChange={handleRoomUpload}
              style={{ display: "none" }}
            />
          </label>

          <p
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: "0.75rem",
              marginBottom: "0.8rem",
            }}
          >
            التقط صورة لجدارك وشاهد اللوحة عليه
          </p>

          <button
            onClick={() => {
              roomRef.current = null;
              syncPlaced(false);
              syncScale(1);
              syncMode("ar");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.7rem",
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              padding: "0.85rem",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "0.95rem",
              marginBottom: "1.2rem",
            }}
          >
            <span>🏠</span> جرّب على غرفة افتراضية
          </button>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            ✕ إغلاق
          </button>
        </div>
      )}

      {/* وضع العرض */}
      {mode === "ar" && (
        <>
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              touchAction: "none",
              cursor: placed ? "move" : "crosshair",
            }}
            onMouseDown={(e) => handleDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleUp();
            }}
          />

          {!placed && (
            <div
              style={{
                position: "absolute",
                top: "44%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                textAlign: "center",
                color: "white",
                zIndex: 5,
                pointerEvents: "none",
                background: "rgba(0,0,0,0.65)",
                padding: "1.5rem 2rem",
                borderRadius: "14px",
                border: "1px dashed rgba(201,168,76,0.7)",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
                👆
              </div>
              <p>اضغط على الجدار لوضع اللوحة</p>
              <p
                style={{
                  fontSize: "0.78rem",
                  opacity: 0.6,
                  marginTop: "0.3rem",
                }}
              >
                اللوحة لن تنزل للأرضية
              </p>
            </div>
          )}

          {/* Top Bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.5rem",
              background:
                "linear-gradient(to bottom,rgba(0,0,0,0.8),transparent)",
            }}
          >
            <button onClick={onClose} style={iconBtn}>
              ✕
            </button>
            <span style={{ color: "white", fontWeight: 600 }}>
              {painting.title}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <label style={{ ...iconBtn, cursor: "pointer" }}>
                🔄
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRoomUpload}
                  style={{ display: "none" }}
                />
              </label>
              <button onClick={saveImage} style={iconBtn}>
                📸
              </button>
            </div>
          </div>

          {/* Bottom Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: "0.8rem 1.2rem 2rem",
              background:
                "linear-gradient(to top,rgba(0,0,0,0.88),transparent)",
            }}
          >
            <p
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.65)",
                fontSize: "0.8rem",
                marginBottom: "0.7rem",
              }}
            >
              {placed
                ? "اسحب لتحريك • قرّب/باعد الإصبعين للتكبير"
                : "اضغط على الجدار لوضع اللوحة"}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ ...ctrlBtn, flexDirection: "row", gap: "0.3rem" }}>
                <button
                  onClick={() =>
                    syncScale(
                      Math.max(0.2, +(scaleRef.current - 0.1).toFixed(1)),
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: "0.78rem",
                    minWidth: "34px",
                    textAlign: "center",
                  }}
                >
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() =>
                    syncScale(Math.min(3, +(scaleRef.current + 0.1).toFixed(1)))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </div>

              <button
                style={ctrlBtn}
                onClick={() => syncRotation((rotRef.current + 90) % 360)}
              >
                <span>🔄</span>
                <span>تدوير</span>
              </button>

              <button
                style={{
                  ...ctrlBtn,
                  borderColor: showFrame
                    ? "rgba(201,168,76,0.7)"
                    : "rgba(255,255,255,0.2)",
                }}
                onClick={() => {
                  syncFrame(!showFrameRef.current);
                  showToast(
                    !showFrameRef.current
                      ? "تم إظهار الإطار"
                      : "تم إخفاء الإطار",
                  );
                }}
              >
                <span>🖼️</span>
                <span>{showFrame ? "إطار" : "بدون"}</span>
              </button>

              <button
                style={ctrlBtn}
                onClick={() => {
                  syncMode("choose");
                }}
              >
                <span>🏠</span>
                <span>تغيير</span>
              </button>
            </div>
          </div>

          {toast && (
            <div
              style={{
                position: "absolute",
                bottom: "8.5rem",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--accent)",
                color: "#0a0a0f",
                padding: "0.5rem 1.5rem",
                borderRadius: "20px",
                fontWeight: 700,
                zIndex: 20,
                fontSize: "0.88rem",
                whiteSpace: "nowrap",
              }}
            >
              {toast}
            </div>
          )}
        </>
      )}
    </div>
  );
}
