// ===================================================
// ARViewerXR.jsx — تجربة AR حقيقية عبر WebXR
// كاميرا حية + hit-test + anchors + lighting estimation
// يعمل على: أندرويد Chrome + HTTPS + Google Play Services for AR
// لو الجهاز لا يدعم WebXR  →  يرجع تلقائياً للنسخة القديمة (ARViewer)
// يأخذ نفس الـ props: { painting, onClose }  ← بديل مباشر (drop-in)
// ===================================================

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight.js";
import ARViewer from "./ARViewer"; // النسخة القديمة (Canvas) — خطة بديلة

const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";
const ACCENT = 0xc9a84c; // نفس لون الإطار الذهبي في مشروعك
const VERSION = "AR v7"; // علامة إصدار — للتأكد من تحميل آخر نسخة (ليست cache)

export default function ARViewerXR({ painting, onClose }) {
  const overlayRef = useRef(null);

  const [support, setSupport] = useState("checking"); // checking | ready | noxr
  const [running, setRunning] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [hint, setHint] = useState("وجّه الكاميرا نحو الجدار ببطء");
  const [error, setError] = useState("");
  const [diag, setDiag] = useState(""); // رسالة تشخيص تظهر على الشاشة
  const [forceOld, setForceOld] = useState(false); // خطة بديلة يدوية

  // مراجع ثابتة لكائنات three.js (لا تسبب إعادة رسم React)
  const E = useRef({}).current;
  const placedRef = useRef(false);
  const showFrameRef = useRef(true);
  const debugRef = useRef(null); // عنصر يعرض تشخيص hit-test حيّاً

  // ---- 1) فحص دعم WebXR AR على هذا الجهاز ----
  // ملاحظة: لا نرتدّ للنسخة القديمة لمجرد أن isSessionSupported أرجع false،
  // لأنه أحياناً يخطئ بينما requestSession ينجح فعلاً. نرتدّ فقط لو navigator.xr غائب تماماً.
  useEffect(() => {
    let alive = true;
    if (!navigator.xr) {
      setSupport("noxr");
      setDiag("navigator.xr غير متاح في هذا المتصفح");
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((ok) => {
        if (!alive) return;
        setSupport("ready"); // نعرض زر البدء دائماً طالما xr موجود
        setDiag(ok ? "" : "⚠ الفحص أرجع false — سنحاول البدء على أي حال");
      })
      .catch((err) => {
        if (!alive) return;
        setSupport("ready");
        setDiag("⚠ فحص الدعم أعطى خطأ: " + (err?.message || err));
      });
    return () => {
      alive = false;
    };
  }, []);

  // ---- 2) بدء جلسة AR ----
  const startAR = useCallback(async () => {
    try {
      // محرّك الرسم
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      document.body.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        70,
        innerWidth / innerHeight,
        0.01,
        30,
      );

      // ── إضاءة الغرفة الحقيقية (تقدير تلقائي) + إضاءة احتياطية ──
      const ambient = new THREE.AmbientLight(0xffffff, 1.1);
      scene.add(ambient);
      const xrLight = new XREstimatedLight(renderer);
      xrLight.addEventListener("estimationstart", () => {
        scene.add(xrLight);
        scene.remove(ambient);
        if (xrLight.environment) scene.environment = xrLight.environment;
      });
      xrLight.addEventListener("estimationend", () => {
        scene.remove(xrLight);
        scene.add(ambient);
        scene.environment = null;
      });

      // ── المؤشر (حلقة) التي تتبع السطح المكتشف ──
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: ACCENT,
          transparent: true,
          opacity: 0.9,
        }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      // ── تحميل صورة اللوحة كـ texture ──
      const url = painting.image
        ? `${API}/uploads/${painting.image}`
        : `https://picsum.photos/seed/${painting.id}/800/600`;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      let tex = null;
      try {
        tex = await loader.loadAsync(url);
      } catch {
        tex = null;
      }
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;

      // ── أبعاد واقعية: عرض 0.6 متر، الارتفاع حسب نسبة الصورة ──
      const W = 0.6;
      const ratio = tex ? tex.image.height / tex.image.width : 0.75;
      const H = W * ratio;

      // ── مجموعة اللوحة = إطار ذهبي + قماش ──
      const group = new THREE.Group();
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.03),
        new THREE.MeshStandardMaterial({
          color: ACCENT,
          metalness: 0.75,
          roughness: 0.35,
        }),
      );
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({
          map: tex || null,
          color: tex ? 0xffffff : 0x555555,
        }),
      );
      canvasMesh.position.z = 0.0165; // أمام وجه الإطار مباشرة
      group.add(frameMesh, canvasMesh);
      group.userData.halfH = (H + 0.06) / 2; // نصف الارتفاع — لرفعها فوق السطح الأفقي
      group.visible = false;
      scene.add(group);

      // ── طلب الجلسة ──
      // مهم: ندرج أنواع الفضاء المرجعي (local-floor...) ضمن optionalFeatures،
      // لأن WebXR يرفض أي نوع غير 'viewer'/'local' إن لم يُطلب كميزة عند بدء الجلسة.
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: [
          "anchors",
          "light-estimation",
          "dom-overlay",
          "local-floor",
          "bounded-floor",
        ],
        domOverlay: { root: overlayRef.current },
      });

      // نكتشف نوع الفضاء المرجعي المدعوم فعلاً على هذا الجهاز (بلا افتراض)،
      // ثم نُسلّم نفس النوع لـ three حتى لا يفشل setSession داخلياً.
      let worldType = null;
      let localSpace = null;
      for (const type of ["local-floor", "local", "unbounded", "viewer"]) {
        try {
          localSpace = await session.requestReferenceSpace(type);
          worldType = type;
          break;
        } catch {
          /* جرّب النوع التالي */
        }
      }
      if (!localSpace)
        throw new Error("الجهاز لا يدعم أي نوع فضاء مرجعي معروف");

      renderer.xr.setReferenceSpaceType(worldType);
      await renderer.xr.setSession(session);
      setRunning(true);
      setError("");

      // فضاء العرض (viewer) لإطلاق شعاع hit-test من وسط الشاشة — مضمون عادةً
      let viewerSpace;
      try {
        viewerSpace = await session.requestReferenceSpace("viewer");
      } catch {
        viewerSpace = localSpace;
      }

      // hit-test: نطلب نتائج من أي سطح (أفقي أو عمودي). الأسطح العمودية (الجدران)
      // أصعب اكتشافاً، لذا نوفّر أيضاً وضعاً يدوياً احتياطياً عبر زر.
      const hitSource = await session.requestHitTestSource({
        space: viewerSpace,
      });

      let currentHit = null;
      let anchor = null;
      let lastReticlePos = new THREE.Vector3();
      let lastIsWall = false;

      // أدوات حساب يعاد استخدامها (أداء أفضل)
      const _m = new THREE.Matrix4();
      const _pos = new THREE.Vector3();
      const _quat = new THREE.Quaternion();
      const _scl = new THREE.Vector3();
      const _normal = new THREE.Vector3();
      const _up = new THREE.Vector3(0, 1, 0);

      // يحلّل pose السطح: يستخرج الموضع، ويحسب متجه السطح (normal)،
      // ويقرّر هل هو جدار (عمودي) أم سطح أفقي.
      const analyzeSurface = (matrixArray) => {
        _m.fromArray(matrixArray);
        _m.decompose(_pos, _quat, _scl);
        // في نتيجة hit-test: محور Y المحلي = اتجاه سطح التقاطع (normal)
        _normal.set(0, 1, 0).applyQuaternion(_quat).normalize();
        // لو الـ normal أفقي تقريباً (مكوّن Y صغير) فالسطح عمودي = جدار
        const isWall = Math.abs(_normal.y) < 0.5;
        return {
          pos: _pos.clone(),
          normal: _normal.clone(),
          isWall,
          quat: _quat.clone(),
        };
      };

      // يوجّه اللوحة لتلتصق بالسطح:
      // - على جدار: ظهر اللوحة ملاصق للجدار، ووجهها للخارج (عكس الـ normal)
      // - على سطح أفقي: تقف عمودية وتواجه المستخدم (كأنها على حامل)
      const orientArtwork = (info, camPos) => {
        if (info.isWall) {
          // اللوحة تواجه الخارج باتجاه الـ normal. محتوى اللوحة على +Z،
          // لذا نجعل +Z المحلي يحاذي الـ normal.
          const target = info.pos.clone().add(info.normal);
          group.position.copy(info.pos);
          group.up.copy(_up);
          group.lookAt(target);
          // ندفع اللوحة قليلاً للأمام عن الجدار حتى لا تتداخل معه
          group.position.add(info.normal.clone().multiplyScalar(0.02));
        } else {
          // سطح أفقي: اللوحة عمودية تواجه المستخدم
          const yaw = Math.atan2(camPos.x - info.pos.x, camPos.z - info.pos.z);
          group.position.copy(info.pos);
          group.position.y += group.userData.halfH || 0; // ترفعها لتقف على السطح
          group.rotation.set(0, yaw, 0);
        }
        group.visible = true;
      };

      // ── دالة وضع موحّدة ──
      const placeAt = async (info, hit) => {
        const xrCam = renderer.xr.getCamera();
        const camPos = new THREE.Vector3().setFromMatrixPosition(
          xrCam.matrixWorld,
        );
        orientArtwork(info, camPos);
        reticle.visible = false;
        placedRef.current = true;
        setPlaced(true);
        setHint(
          info.isWall
            ? 'اللوحة مثبّتة على الجدار. اضغط "إعادة وضع" للتغيير'
            : "اللوحة موضوعة. للحصول على نتيجة أفضل ثبّتها على جدار",
        );
        anchor = null;
        if (hit && hit.createAnchor) {
          try {
            anchor = await hit.createAnchor();
          } catch {
            anchor = null;
          }
        }
      };

      // ── النقر على الشاشة: ضع عند الحلقة (إن ظهرت) ──
      const onSelect = async () => {
        if (placedRef.current || !reticle.visible || !currentHit) return;
        const pose = currentHit.getPose(localSpace);
        if (!pose) return;
        const info = analyzeSurface(pose.transform.matrix);
        await placeAt(info, currentHit);
      };
      session.addEventListener("select", onSelect);

      // ── وضع يدوي: ضع اللوحة على جدار افتراضي أمام المستخدم مباشرة ──
      E.placeManual = async () => {
        if (placedRef.current) return;
        const xrCam = renderer.xr.getCamera();
        const camPos = new THREE.Vector3().setFromMatrixPosition(
          xrCam.matrixWorld,
        );
        const dir = new THREE.Vector3();
        xrCam.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize(); // أفقي تماماً → جدار وهمي عمودي أمامك
        const pos = camPos.clone().add(dir.clone().multiplyScalar(1.4));
        pos.y = camPos.y; // بارتفاع النظر
        // نبني "info" يدوياً يحاكي جداراً: الـ normal يشير نحو المستخدم
        const info = { pos, normal: dir.clone().negate(), isWall: true };
        await placeAt(info, null);
      };

      // ── إعادة الوضع ──
      E.resetPlace = () => {
        placedRef.current = false;
        setPlaced(false);
        group.visible = false;
        anchor = null;
        setHint(
          'وجّه الكاميرا نحو الجدار، وعند ظهور الحلقة الخضراء انقر — أو استخدم "ضع يدوياً"',
        );
      };

      // ── حلقة الرسم ──
      renderer.setAnimationLoop((t, xrFrame) => {
        if (xrFrame) {
          if (!placedRef.current) {
            const hits = xrFrame.getHitTestResults(hitSource);
            let poseOk = false;
            let isWall = false;
            if (hits.length) {
              currentHit = hits[0];
              const pose = currentHit.getPose(localSpace);
              if (pose) {
                poseOk = true;
                const info = analyzeSurface(pose.transform.matrix);
                isWall = info.isWall;
                lastReticlePos.copy(info.pos);
                lastIsWall = isWall;
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
                // لون الحلقة: أخضر للجدار، أصفر للسطح الأفقي
                reticle.material.color.setHex(isWall ? 0x4ade80 : ACCENT);
              }
            } else {
              reticle.visible = false;
              currentHit = null;
            }
            if (debugRef.current) {
              debugRef.current.textContent = `نتائج: ${hits.length} | ${poseOk ? (isWall ? "جدار ✓" : "أفقي") : "—"} | حلقة: ${reticle.visible ? "ظاهرة" : "مخفية"}`;
            }
          } else if (anchor && anchor.anchorSpace) {
            // تتبّع الـ anchor: نحدّث الموضع والاتجاه معاً ليبقى التثبيت دقيقاً
            const ap = xrFrame.getPose(anchor.anchorSpace, localSpace);
            if (ap) {
              _m.fromArray(ap.transform.matrix);
              _m.decompose(_pos, _quat, _scl);
              group.position.copy(_pos);
            }
          }
        }
        frameMesh.visible = showFrameRef.current;
        renderer.render(scene, camera);
      });

      // ── إنهاء الجلسة وتنظيف ──
      session.addEventListener("end", () => {
        renderer.setAnimationLoop(null);
        if (renderer.domElement.parentNode)
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        placedRef.current = false;
        setRunning(false);
        setPlaced(false);
        E.placeManual = null;
        E.resetPlace = null;
        onClose && onClose();
      });

      E.session = session;
    } catch (err) {
      setError("تعذّر بدء الكاميرا: " + (err?.message || err));
      setRunning(false);
    }
  }, [painting, onClose]);

  const endAR = () => {
    E.session ? E.session.end() : onClose && onClose();
  };

  const toggleFrame = () => {
    const v = !showFrameRef.current;
    showFrameRef.current = v;
    setShowFrame(v);
  };

  // ====== خطة بديلة: فقط لو لا يوجد WebXR إطلاقاً، أو اختار المستخدم يدوياً ======
  if (support === "noxr" || forceOld) {
    return <ARViewer painting={painting} onClose={onClose} />;
  }

  // ====== أنماط ======
  const dark = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "#0a0a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const iconBtn = {
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "white",
    width: 44,
    height: 44,
    borderRadius: "50%",
    fontSize: "1.2rem",
    cursor: "pointer",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={dark}>
      {/* فحص الدعم */}
      {support === "checking" && (
        <p style={{ color: "rgba(255,255,255,0.6)" }}>جارٍ فحص دعم الكاميرا…</p>
      )}

      {/* شاشة البدء */}
      {support === "ready" && !running && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            maxWidth: 360,
            width: "100%",
          }}
        >
          <div
            style={{
              width: 170,
              height: 128,
              margin: "0 auto 1.5rem",
              border: "3px solid var(--accent)",
              borderRadius: 8,
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
              color: "rgba(255,255,255,0.45)",
              fontSize: "0.85rem",
              marginBottom: "1.8rem",
            }}
          >
            جرّب اللوحة على جدارك بالكاميرا الحية
          </p>

          {error && (
            <p
              style={{
                color: "#ff8a8a",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </p>
          )}
          {diag && (
            <p
              style={{
                color: "#e8c45a",
                fontSize: "0.75rem",
                marginBottom: "1rem",
                background: "rgba(232,196,90,0.08)",
                padding: "0.5rem 0.7rem",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              {diag}
            </p>
          )}

          <button
            onClick={startAR}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.7rem",
              width: "100%",
              background:
                "linear-gradient(135deg,var(--accent),var(--accent2))",
              color: "#0a0a0f",
              padding: "1rem",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "0.9rem",
              border: "none",
              boxShadow: "0 8px 30px rgba(201,168,76,0.35)",
            }}
          >
            <span>📷</span> ابدأ تجربة الواقع المعزز
          </button>

          <button
            onClick={() => setForceOld(true)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              padding: "0.8rem",
              borderRadius: 12,
              cursor: "pointer",
              fontSize: "0.9rem",
              marginBottom: "0.9rem",
            }}
          >
            🖼️ استخدم النسخة العادية (رفع صورة)
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

          <p
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: "0.7rem",
              marginTop: "1rem",
            }}
          >
            {VERSION}
          </p>
        </div>
      )}

      {/* overlay فوق الكاميرا أثناء الجلسة (يجب أن يبقى مركّباً دائماً لأن domOverlay يحتاجه) */}
      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: running ? 30 : -1,
        }}
      >
        {running && (
          <>
            {/* شريط علوي */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.3rem",
              }}
            >
              <button onClick={endAR} style={iconBtn}>
                ✕
              </button>
              <span
                style={{
                  color: "white",
                  fontWeight: 600,
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                {painting.title}
              </span>
              <span style={{ width: 44 }} />
            </div>

            {/* شريط تشخيص حيّ (مؤقت — لمعرفة سبب عدم ظهور الحلقة) */}
            {!placed && (
              <div
                ref={debugRef}
                style={{
                  position: "absolute",
                  top: "4.5rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.7)",
                  color: "#7CFC00",
                  padding: "0.3rem 0.8rem",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                نتائج: 0
              </div>
            )}

            {/* تلميح وسط الشاشة قبل الوضع */}
            {!placed && (
              <div
                style={{
                  position: "absolute",
                  top: "46%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  textAlign: "center",
                  color: "white",
                  background: "rgba(0,0,0,0.55)",
                  padding: "1rem 1.5rem",
                  borderRadius: 14,
                  border: "1px dashed rgba(201,168,76,0.7)",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>
                  🎯
                </div>
                <p style={{ margin: 0 }}>{hint}</p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    opacity: 0.65,
                    marginTop: "0.3rem",
                  }}
                >
                  عندما تظهر الحلقة على الجدار، انقر لوضع اللوحة
                </p>
              </div>
            )}

            {/* شريط سفلي */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.7rem",
              }}
            >
              {placed && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "0.8rem",
                    textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                    margin: 0,
                  }}
                >
                  {hint}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {/* قبل الوضع: زر الوضع اليدوي الاحتياطي */}
                {!placed && (
                  <button
                    onClick={() => E.placeManual && E.placeManual()}
                    style={{
                      pointerEvents: "auto",
                      background:
                        "linear-gradient(135deg,var(--accent),var(--accent2))",
                      border: "none",
                      color: "#0a0a0f",
                      fontWeight: 700,
                      padding: "0.55rem 1.1rem",
                      borderRadius: 10,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    📌 ضع على الجدار يدوياً
                  </button>
                )}

                {/* بعد الوضع: زر إعادة الوضع */}
                {placed && (
                  <button
                    onClick={() => E.resetPlace && E.resetPlace()}
                    style={{
                      pointerEvents: "auto",
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(201,168,76,0.8)",
                      color: "white",
                      padding: "0.55rem 1.1rem",
                      borderRadius: 10,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    🔄 إعادة وضع
                  </button>
                )}

                <button
                  onClick={toggleFrame}
                  style={{
                    pointerEvents: "auto",
                    background: "rgba(255,255,255,0.12)",
                    border: `1px solid ${showFrame ? "rgba(201,168,76,0.8)" : "rgba(255,255,255,0.25)"}`,
                    color: "white",
                    padding: "0.55rem 1.1rem",
                    borderRadius: 10,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  🖼️ {showFrame ? "إخفاء الإطار" : "إظهار الإطار"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
