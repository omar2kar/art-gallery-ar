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
import { paintingImageUrl, IMG_PLACEHOLDER } from "../utils/img";
const ACCENT = 0xc9a84c; // نفس لون الإطار الذهبي في مشروعك
const VERSION = "AR v16"; // علامة إصدار — للتأكد من تحميل آخر نسخة (ليست cache)

// ── أنماط الإطارات المتاحة ──
// كل نمط: لون + خصائص معدنية/خشونة (لمظهر المادة) + سماكة الحافة + العمق.
// swatch = تدرّج لوني لعرض النمط كزرّ في الواجهة.
const FRAMES = [
  { id: "gold",  label: "Altın",      color: 0xc9a84c, metalness: 0.75, roughness: 0.35, border: 0.06, depth: 0.03,  swatch: "linear-gradient(135deg,#e8cd72,#9c7d2f)" },
  { id: "black", label: "Siyah",      color: 0x141414, metalness: 0.25, roughness: 0.65, border: 0.05, depth: 0.03,  swatch: "linear-gradient(135deg,#3a3a3a,#0a0a0a)" },
  { id: "white", label: "Beyaz",      color: 0xf2f0ea, metalness: 0.0,  roughness: 0.85, border: 0.05, depth: 0.03,  swatch: "linear-gradient(135deg,#ffffff,#d6d6cc)" },
  { id: "wood",  label: "Ahşap",      color: 0x6b4423, metalness: 0.0,  roughness: 0.8,  border: 0.07, depth: 0.035, swatch: "linear-gradient(135deg,#9a6233,#4a2d16)" },
  { id: "silver",label: "Gümüş",      color: 0xc8c8cc, metalness: 0.9,  roughness: 0.25, border: 0.05, depth: 0.03,  swatch: "linear-gradient(135deg,#ededf0,#9a9aa2)" },
  { id: "none",  label: "Çerçevesiz", color: 0x000000, metalness: 0.0,  roughness: 1.0,  border: 0.0,  depth: 0.0,   swatch: "repeating-linear-gradient(45deg,#222,#222 5px,#333 5px,#333 10px)" },
];
const DEFAULT_FRAME = "gold";

// منتقي الإطار — صفّ أزرار بعيّنات لونية. يُستخدم في شاشة البدء وأثناء AR.
function FrameChooser({ value, onChange, compact }) {
  return (
    <div
      style={{
        display: "flex",
        gap: compact ? "0.4rem" : "0.55rem",
        flexWrap: "wrap",
        justifyContent: "center",
        pointerEvents: "auto",
      }}
    >
      {FRAMES.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            title={f.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              style={{
                width: compact ? 30 : 38,
                height: compact ? 30 : 38,
                borderRadius: 9,
                background: f.swatch,
                boxShadow: active
                  ? "0 0 0 2px #0a0a0f, 0 0 0 4px var(--accent)"
                  : "0 0 0 1px rgba(255,255,255,0.25)",
                transition: "box-shadow 0.15s",
              }}
            />
            <span
              style={{
                fontSize: "0.62rem",
                color: active ? "var(--accent)" : "rgba(255,255,255,0.6)",
                fontWeight: active ? 700 : 400,
              }}
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function ARViewerXR({ painting, onClose }) {
  const overlayRef = useRef(null);

  const [support, setSupport] = useState("checking"); // checking | ready | noxr
  const [running, setRunning] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [hint, setHint] = useState("Telefonu yavaşça sağa-sola hareket ettir");
  const [error, setError] = useState("");
  const [diag, setDiag] = useState(""); // رسالة تشخيص تظهر على الشاشة
  const [forceOld, setForceOld] = useState(false); // خطة بديلة يدوية
  const [brightness, setBrightness] = useState(0.82); // سطوع اللوحة (للواجهة)
  const [frameId, setFrameId] = useState(DEFAULT_FRAME); // نمط الإطار المختار

  // مراجع ثابتة لكائنات three.js (لا تسبب إعادة رسم React)
  const E = useRef({}).current;
  const heightRef = useRef(1.45); // ارتفاع اللوحة على الجدار (وضع الأرض)
  const brightnessRef = useRef(0.82); // سطوع اللوحة (يطابق إضاءة الغرفة)
  const placedRef = useRef(false);
  const showFrameRef = useRef(true);
  const frameRef = useRef(DEFAULT_FRAME); // نمط الإطار الحالي داخل مشهد three
  const debugRef = useRef(null); // عنصر يعرض تشخيص hit-test حيّاً
  const scanRef = useRef(null); // عنصر يعرض حالة مسح الغرفة
  const aimLineRef = useRef(null); // خط التصويب الأفقي (طريقة Artmajeur)

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
        setDiag(ok ? "" : "⚠ Destek kontrolü belirsiz — yine de denenecek");
      })
      .catch((err) => {
        if (!alive) return;
        setSupport("ready");
        setDiag("⚠ Destek kontrolü hatası: " + (err?.message || err));
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

      // ── إضاءة الغرفة الحقيقية (تقدير تلقائي) + إضاءة احتياطية معتدلة ──
      const ambient = new THREE.AmbientLight(0xffffff, 0.85);
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
      const url = paintingImageUrl(painting) || IMG_PLACEHOLDER;
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

      // ── مجموعة اللوحة = قماش + إطار قابل للتبديل ──
      // القماش يبدأ بسطوع مخفّض (0.82) ليندمج مع إضاءة الغرفة بدل أن يبدو مضيئاً ذاتياً.
      // المستخدم يضبطه لاحقاً عبر شريط السطوع.
      const BRIGHT_DEFAULT = 0.82;
      const group = new THREE.Group();
      const canvasMat = new THREE.MeshBasicMaterial({
        map: tex || null,
        color: tex
          ? new THREE.Color(BRIGHT_DEFAULT, BRIGHT_DEFAULT, BRIGHT_DEFAULT)
          : new THREE.Color(0x555555),
        transparent: true,
        opacity: 1,
      });
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        canvasMat,
      );
      group.add(canvasMesh);

      // الإطار قابل لإعادة البناء (لتبديل النمط حياً). نتخلّص من القديم ونبني الجديد.
      let frameMesh = null;
      const buildFrame = (id) => {
        const f = FRAMES.find((x) => x.id === id) || FRAMES[0];
        frameRef.current = f.id;
        if (frameMesh) {
          group.remove(frameMesh);
          frameMesh.geometry.dispose();
          frameMesh.material.dispose();
          frameMesh = null;
        }
        if (f.border <= 0) {
          // بلا إطار: القماش في المقدمة مباشرة
          canvasMesh.position.z = 0;
          group.userData.halfH = H / 2;
          return;
        }
        frameMesh = new THREE.Mesh(
          new THREE.BoxGeometry(W + f.border, H + f.border, f.depth),
          new THREE.MeshStandardMaterial({
            color: f.color,
            metalness: f.metalness,
            roughness: f.roughness,
          }),
        );
        group.add(frameMesh);
        canvasMesh.position.z = f.depth / 2 + 0.001; // أمام وجه الإطار مباشرة
        group.userData.halfH = (H + f.border) / 2; // لرفعها فوق السطح الأفقي
        frameMesh.visible = showFrameRef.current;
      };
      buildFrame(frameRef.current);
      group.visible = false;
      scene.add(group);

      // تبديل نمط الإطار من الواجهة (قبل أو بعد الوضع)
      E.setFrame = (id) => buildFrame(id);

      // التحكّم بسطوع اللوحة (يطابقها مع إضاءة الغرفة)
      E.setBrightness = (val) => {
        const v = Math.max(0.25, Math.min(1, val));
        brightnessRef.current = v;
        if (tex) canvasMat.color.setRGB(v, v, v);
      };

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
          "plane-detection",
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
      let currentWall = null; // الجدار الحقيقي المكتشف عبر plane-detection
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

      // يوجّه اللوحة لتلتصق بالسطح. للوحات الجدران نضمن العمودية التامة:
      // نُسقط متجه السطح (normal) على المستوى الأفقي ونلغي أي ميل رأسي،
      // فلا تميل اللوحة أبداً مهما كان ميل السطح المكتشف أو إمساك الهاتف.
      const orientArtwork = (info, camPos) => {
        if (info.isWall) {
          // normal أفقي فقط (نلغي y) → اللوحة عمودية 100%
          const flatNormal = info.normal.clone();
          flatNormal.y = 0;
          if (flatNormal.lengthSq() < 1e-6) {
            // احتياط نادر: لو فقدنا الاتجاه، اجعلها تواجه المستخدم
            flatNormal.copy(camPos).sub(info.pos);
            flatNormal.y = 0;
          }
          flatNormal.normalize();
          group.position.copy(info.pos);
          // اللوحة (محتواها على +Z) تواجه باتجاه flatNormal
          const yaw = Math.atan2(flatNormal.x, flatNormal.z);
          group.rotation.set(0, yaw, 0);
          // ادفعها قليلاً عن الجدار لتجنّب التداخل
          group.position.add(flatNormal.multiplyScalar(0.02));
        } else {
          // سطح أفقي: اللوحة عمودية تواجه المستخدم
          const yaw = Math.atan2(camPos.x - info.pos.x, camPos.z - info.pos.z);
          group.position.copy(info.pos);
          group.position.y += group.userData.halfH || 0;
          group.rotation.set(0, yaw, 0);
        }
        group.visible = true;
      };

      // ── دالة وضع موحّدة ──
      // نضع اللوحة عند نقطة النقر الفعلية، ونوجّهها لتلتصق بالجدار باتجاهه الحقيقي
      // (نفس منطق توجيه الحلقة التي تظهر ملتصقة صحيحة).
      let wallPoint = null; // نقطة النقر على الجدار (x,y,z)
      let wallNormal = null; // اتجاه الجدار الحقيقي (يواجه المستخدم)
      let wallActive = false;

      const applyWallPlacement = (height) => {
        if (!wallNormal || !wallPoint) return;
        group.position.set(wallPoint.x, height, wallPoint.z);
        // اللوحة (محتواها على +Z) تنظر باتجاه الـ normal → تلتصق بمستوى الجدار
        const look = group.position.clone().add(wallNormal);
        group.up.set(0, 1, 0);
        group.lookAt(look);
        // ادفعها 2 سم عن الجدار لتفادي التداخل
        group.position.add(wallNormal.clone().multiplyScalar(0.02));
        group.visible = true;
      };

      const placeAt = async (info, hit) => {
        // اتجاه الجدار الحقيقي، مع تسطيحه أفقياً لضمان لوحة عمودية تماماً
        const n = info.normal
          ? info.normal.clone()
          : new THREE.Vector3(0, 0, 1);
        n.y = 0;
        if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
        n.normalize();
        wallNormal = n;
        wallPoint = info.pos.clone(); // نقطة النقر الفعلية (هنا تظهر اللوحة)
        wallActive = true;

        heightRef.current = info.pos.y; // الارتفاع = حيث ضغطت بالضبط
        applyWallPlacement(heightRef.current);

        reticle.visible = false;
        placedRef.current = true;
        setPlaced(true);
        setHint("Tabloyu parmağınızla sürükleyerek duvarda taşıyın");
        anchor = null;
      };

      // ── تحريك اللوحة باللمس على سطح الجدار (سحب بالإصبع) ──
      // نطلق شعاعاً من إصبع المستخدم (XRInputSource من نوع "screen") ونقاطعه مع
      // مستوى الجدار، فتتبع اللوحة موضع الإصبع بسلاسة بدل أزرار الأسهم.
      const _dragD2 = new THREE.Vector3();
      const _dragO = new THREE.Vector3();
      const _dragQ = new THREE.Quaternion();
      const _dragS = new THREE.Vector3();
      const _dragHit = new THREE.Vector3();
      const _dragM = new THREE.Matrix4();
      let touchDown = false; // هل الإصبع ملامس الآن؟
      let grabbed = false; // هل بدأ السحب قرب اللوحة (إمساك)؟

      const dragOnWall = (xrFrame) => {
        if (!wallActive || !wallNormal || !wallPoint) return;
        // ابحث عن مصدر إدخال اللمس (الإصبع على الشاشة)
        let screen = null;
        for (const src of session.inputSources) {
          if (src.targetRayMode === "screen" && src.targetRaySpace) {
            screen = src;
            break;
          }
        }
        // لا لمس الآن → أفلت الإمساك (لتُحسب نقطة جديدة عند اللمسة التالية)
        if (!screen) {
          touchDown = false;
          grabbed = false;
          return;
        }
        const rayPose = xrFrame.getPose(screen.targetRaySpace, localSpace);
        if (!rayPose) return;
        _dragM.fromArray(rayPose.transform.matrix);
        _dragM.decompose(_dragO, _dragQ, _dragS);
        _dragD2.set(0, 0, -1).applyQuaternion(_dragQ).normalize();
        // تقاطع شعاع الإصبع مع مستوى الجدار اللانهائي
        const denom = _dragD2.dot(wallNormal);
        if (Math.abs(denom) < 1e-4) return;
        const tHit =
          wallPoint.clone().sub(_dragO).dot(wallNormal) / denom;
        if (tHit < 0.05 || tHit > 12) return;
        _dragHit.copy(_dragO).add(_dragD2.multiplyScalar(tHit));
        // عند بدء لمسة جديدة: اعتبرها إمساكاً فقط إن بدأت قرب اللوحة
        if (!touchDown) {
          touchDown = true;
          grabbed =
            _dragHit.distanceTo(group.position) <
            Math.max(W, H) * 1.6 + 0.25;
        }
        if (!grabbed) return;
        // تتبّع سلس (lerp) لموضع الإصبع على الجدار + حدود ارتفاع منطقية
        const targetH = Math.max(0.3, Math.min(2.6, _dragHit.y));
        wallPoint.x += (_dragHit.x - wallPoint.x) * 0.6;
        wallPoint.z += (_dragHit.z - wallPoint.z) * 0.6;
        heightRef.current += (targetH - heightRef.current) * 0.6;
        applyWallPlacement(heightRef.current);
      };

      // ── النقر على الشاشة: ضع عند الحلقة (إن ظهرت) ──
      const onSelect = async () => {
        if (placedRef.current || !reticle.visible) return;
        // الأولوية للجدار الحقيقي المكتشف (plane-detection) — التصاق دقيق
        if (currentWall) {
          await placeAt(
            {
              pos: currentWall.pos.clone(),
              normal: currentWall.normal.clone(),
              isWall: true,
            },
            null,
          );
          return;
        }
        // احتياط: hit-test النقطي
        if (!currentHit) return;
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
        wallActive = false;
        wallPoint = null;
        wallNormal = null;
        setHint(
          'Yeşil halka göründüğünde dokun — veya "Manuel Yerleştir" kullan',
        );
      };

      // ── اكتشاف الجدار الحقيقي عبر plane-detection ──
      // نبحث في المستويات العمودية (الجدران) عن الجدار الذي يصطدم به شعاع نظر الكاميرا،
      // ونعيد نقطة الإصابة الفعلية على سطح الجدار + اتجاهه الحقيقي.
      const _rayO = new THREE.Vector3();
      const _rayD = new THREE.Vector3();
      const _planeM = new THREE.Matrix4();
      const _planePos = new THREE.Vector3();
      const _planeQuat = new THREE.Quaternion();
      const _planeScl = new THREE.Vector3();
      const _planeNormal = new THREE.Vector3();
      const _hitP = new THREE.Vector3();
      const _planeInv = new THREE.Matrix4();
      const _localHit = new THREE.Vector3();

      // اختبار نقطة داخل مضلّع (إحداثيات فضاء المستوى x,z) — يحدّد حدود الجدار الفعلية بدقّة
      const pointInPolygon2D = (px, pz, poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x,
            zi = poly[i].z;
          const xj = poly[j].x,
            zj = poly[j].z;
          if (
            zi > pz !== zj > pz &&
            px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi
          ) {
            inside = !inside;
          }
        }
        return inside;
      };

      const findWallHit = (xrFrame, xrCam) => {
        const planes = xrFrame.detectedPlanes;
        if (!planes || planes.size === 0) return null;

        // شعاع من الكاميرا نحو ما تنظر إليه (اتجاه -Z العالمي — أمتن من quaternion)
        _rayO.setFromMatrixPosition(xrCam.matrixWorld);
        xrCam.getWorldDirection(_rayD);
        _rayD.normalize();

        let best = null;
        let bestDist = Infinity;

        planes.forEach((plane) => {
          if (plane.orientation !== "vertical") return; // الجدران فقط
          const planePose = xrFrame.getPose(plane.planeSpace, localSpace);
          if (!planePose) return;

          _planeM.fromArray(planePose.transform.matrix);
          _planeM.decompose(_planePos, _planeQuat, _planeScl);
          // متجه الجدار (normal) = محور Y لنظام planeSpace
          _planeNormal.set(0, 1, 0).applyQuaternion(_planeQuat).normalize();

          // تقاطع الشعاع مع مستوى الجدار اللانهائي
          const denom = _rayD.dot(_planeNormal);
          if (Math.abs(denom) < 1e-4) return; // الشعاع موازٍ للجدار
          const tHit = _planePos.clone().sub(_rayO).dot(_planeNormal) / denom;
          if (tHit < 0.2 || tHit > 10) return; // خلف الكاميرا أو بعيد جداً

          _hitP.copy(_rayO).add(_rayD.clone().multiplyScalar(tHit));

          // فحص دقيق: هل نقطة الإصابة داخل مضلّع الجدار الحقيقي؟
          // نحوّل النقطة إلى فضاء المستوى (حيث الجدار في مستوى x-z) ثم نختبر الاحتواء.
          _planeInv.copy(_planeM).invert();
          _localHit.copy(_hitP).applyMatrix4(_planeInv);
          const poly = plane.polygon;
          let within = false;
          if (poly && poly.length >= 3) {
            within = pointInPolygon2D(_localHit.x, _localHit.z, poly);
            if (!within) {
              // تسامح بسيط قرب الحواف لالتقاط الجدران الكبيرة بسهولة أكبر
              let maxR = 0;
              for (let k = 0; k < poly.length; k++) {
                const r = Math.hypot(poly[k].x, poly[k].z);
                if (r > maxR) maxR = r;
              }
              within = Math.hypot(_localHit.x, _localHit.z) < maxR * 1.08;
            }
          } else {
            within =
              Math.hypot(_localHit.x, _localHit.z) <
              Math.max(_planeScl.x, _planeScl.z, 1.5);
          }
          if (!within) return;

          if (tHit < bestDist) {
            bestDist = tHit;
            // الـ normal يواجه الكاميرا
            const facing =
              denom < 0 ? _planeNormal.clone() : _planeNormal.clone().negate();
            best = {
              pos: _hitP.clone(),
              normal: facing,
              isWall: true,
              real: true,
            };
          }
        });
        return best;
      };

      // ── حلقة الرسم ──
      let wallSeenCount = 0; // كم مرة رأينا جداراً (لقياس جاهزية التتبّع)
      let floorSeenCount = 0; // كم مرة رأينا سطحاً أفقياً
      renderer.setAnimationLoop((t, xrFrame) => {
        if (xrFrame) {
          if (!placedRef.current) {
            const xrCam = renderer.xr.getCamera();
            // 1) الأولوية: جدار حقيقي من plane-detection
            const wallHit = findWallHit(xrFrame, xrCam);
            let poseOk = false;
            let isWall = false;

            if (wallHit) {
              poseOk = true;
              isWall = true;
              currentHit = null; // ليس hit-test
              // تنعيم موضع الحلقة (lerp) لتفادي الاهتزاز أثناء تتبّع الجدار،
              // ونمرّر الموضع المنعّم نفسه إلى الوضع عند اللمس.
              if (lastIsWall) lastReticlePos.lerp(wallHit.pos, 0.35);
              else lastReticlePos.copy(wallHit.pos);
              lastIsWall = true;
              wallHit.pos.copy(lastReticlePos);
              currentWall = wallHit; // نخزّن الجدار الحقيقي (بالموضع المنعّم)
              wallSeenCount++;
              // ضع الحلقة على الجدار الحقيقي، موجّهة حسب اتجاهه
              reticle.visible = true;
              reticle.matrixAutoUpdate = true;
              reticle.position.copy(lastReticlePos);
              reticle.lookAt(lastReticlePos.clone().add(wallHit.normal));
              reticle.material.color.setHex(0x4ade80);
            } else {
              currentWall = null;
              // 2) احتياط: hit-test النقطي (الأرض/أي سطح)
              reticle.matrixAutoUpdate = false;
              const hits = xrFrame.getHitTestResults(hitSource);
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
                  reticle.material.color.setHex(isWall ? 0x4ade80 : ACCENT);
                  if (isWall) wallSeenCount++;
                  else floorSeenCount++;
                }
              } else {
                reticle.visible = false;
                currentHit = null;
              }
            }

            // رسالة + لون الخط المصوّب: طريقة Artmajeur
            const ready = reticle.visible; // سطح مكتشف عند مركز الشاشة = جاهز للوضع
            if (scanRef.current) {
              let msg;
              if (currentWall) {
                msg = "✅ Gerçek duvar algılandı — dokunarak yerleştir";
              } else if (isWall && reticle.visible) {
                msg = "✅ Duvar algılandı — sabitlemek için dokun";
              } else if (reticle.visible) {
                msg = "👇 Çizgiyi zemin-duvar köşesine hizala ve dokun";
              } else if (floorSeenCount > 0) {
                msg = "🔍 Telefonu duvara doğru yavaşça hareket ettir…";
              } else {
                msg = "🔍 Telefonu yavaşça sağa-sola oynat (duvarı tara)";
              }
              scanRef.current.style.color = ready ? "#4ade80" : "#ffffff";
              scanRef.current.textContent = msg;
            }
            // الخط يتحوّل للأخضر عند الجاهزية (جدار حقيقي أو سطح مكتشف)
            if (aimLineRef.current) {
              aimLineRef.current.style.background = ready
                ? "rgba(74,222,128,0.95)"
                : "rgba(255,255,255,0.85)";
            }

            if (debugRef.current) {
              debugRef.current.textContent = currentWall
                ? "Gerçek duvar ✓ (plane)"
                : poseOk
                  ? isWall
                    ? "duvar ✓"
                    : "zemin"
                  : "taranıyor…";
            }
          } else if (wallActive) {
            // وضع الجدار: اتركوا الإصبع يسحب اللوحة على سطح الجدار
            dragOnWall(xrFrame);
          } else if (anchor && anchor.anchorSpace) {
            // تتبّع الأنكور فقط خارج وضع الجدار (حتى لا يلغي ضبط الارتفاع)
            const ap = xrFrame.getPose(anchor.anchorSpace, localSpace);
            if (ap) {
              _m.fromArray(ap.transform.matrix);
              _m.decompose(_pos, _quat, _scl);
              group.position.copy(_pos);
            }
          }
        }
        if (frameMesh) frameMesh.visible = showFrameRef.current;
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
        E.setBrightness = null;
        E.setFrame = null;
        onClose && onClose();
      });

      E.session = session;
    } catch (err) {
      setError("Kamera başlatılamadı: " + (err?.message || err));
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
        <p style={{ color: "rgba(255,255,255,0.6)" }}>
          Kamera desteği kontrol ediliyor…
        </p>
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
              src={paintingImageUrl(painting) || IMG_PLACEHOLDER}
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
            Tabloyu canlı kamerayla duvarında dene
          </p>

          {/* اختيار الإطار قبل بدء العرض على الجدار */}
          <div style={{ marginBottom: "1.6rem" }}>
            <p
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: "0.78rem",
                marginBottom: "0.7rem",
                letterSpacing: "0.04em",
              }}
            >
              🖼️ Çerçeve Seç
            </p>
            <FrameChooser
              value={frameId}
              onChange={(id) => {
                setFrameId(id);
                frameRef.current = id; // ليبدأ بالإطار المختار عند تشغيل AR
                E.setFrame && E.setFrame(id); // لو الجلسة جارية بالفعل
              }}
            />
          </div>

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
            <span>📷</span> Artırılmış Gerçekliği Başlat
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
            🖼️ Normal sürümü kullan (fotoğraf yükle)
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
            ✕ Kapat
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

            {/* === خط التصويب (طريقة Artmajeur) === */}
            {/* خط أفقي ثابت وسط الشاشة، يحاذيه المستخدم مع التقاء الأرض بالجدار */}
            {!placed && (
              <>
                {/* التعليمة فوق الخط */}
                <div
                  style={{
                    position: "absolute",
                    top: "calc(50% - 70px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    textAlign: "center",
                    width: "85%",
                    maxWidth: 340,
                    pointerEvents: "none",
                  }}
                >
                  <p
                    ref={scanRef}
                    style={{
                      margin: 0,
                      color: "white",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      background: "rgba(0,0,0,0.6)",
                      padding: "0.6rem 1rem",
                      borderRadius: 12,
                      textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                    }}
                  >
                    🔍 Kamerayı zemine tut, telefonu yavaşça oynat
                  </p>
                </div>

                {/* الخط الأفقي المصوّب */}
                <div
                  ref={aimLineRef}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: "78%",
                    maxWidth: 420,
                    height: 3,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.85)",
                    boxShadow: "0 0 8px rgba(0,0,0,0.6)",
                    pointerEvents: "none",
                    transition: "background 0.2s",
                  }}
                >
                  {/* علامتان عند طرفي الخط */}
                  <span
                    style={{
                      position: "absolute",
                      left: -2,
                      top: -4,
                      width: 3,
                      height: 11,
                      background: "inherit",
                      borderRadius: 2,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: -2,
                      top: -4,
                      width: 3,
                      height: 11,
                      background: "inherit",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </>
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

              {/* شريط سطوع اللوحة — يطابقها مع إضاءة الغرفة */}
              {placed && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    background: "rgba(0,0,0,0.5)",
                    padding: "0.4rem 0.9rem",
                    borderRadius: 20,
                    pointerEvents: "auto",
                  }}
                >
                  <span style={{ fontSize: "0.9rem" }}>🔆</span>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    value={Math.round(brightness * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value) / 100;
                      setBrightness(v);
                      E.setBrightness && E.setBrightness(v);
                    }}
                    style={{
                      width: 130,
                      accentColor: "#c9a84c",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "rgba(255,255,255,0.7)",
                      minWidth: 32,
                      textAlign: "center",
                    }}
                  >
                    {Math.round(brightness * 100)}%
                  </span>
                </div>
              )}

              {/* اختيار الإطار — أثناء المسح (قبل التثبيت) أو بعد الوضع على الجدار */}
              <div
                style={{
                  background: "rgba(0,0,0,0.5)",
                  padding: "0.55rem 0.8rem",
                  borderRadius: 14,
                  pointerEvents: "auto",
                }}
              >
                <FrameChooser
                  compact
                  value={frameId}
                  onChange={(id) => {
                    setFrameId(id);
                    E.setFrame && E.setFrame(id);
                  }}
                />
              </div>

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
                    📌 Duvara Manuel Yerleştir
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
                    🔄 Yeniden Yerleştir
                  </button>
                )}

                {frameId !== "none" && (
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
                    🖼️ {showFrame ? "Çerçeveyi Gizle" : "Çerçeveyi Göster"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
