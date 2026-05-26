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
const VERSION = "AR v12"; // علامة إصدار — للتأكد من تحميل آخر نسخة (ليست cache)

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

  // مراجع ثابتة لكائنات three.js (لا تسبب إعادة رسم React)
  const E = useRef({}).current;
  const heightRef = useRef(1.45); // ارتفاع اللوحة على الجدار (وضع الأرض)
  const brightnessRef = useRef(0.82); // سطوع اللوحة (يطابق إضاءة الغرفة)
  const placedRef = useRef(false);
  const showFrameRef = useRef(true);
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
      // القماش يبدأ بسطوع مخفّض (0.82) ليندمج مع إضاءة الغرفة بدل أن يبدو مضيئاً ذاتياً.
      // المستخدم يضبطه لاحقاً عبر شريط السطوع.
      const BRIGHT_DEFAULT = 0.82;
      const group = new THREE.Group();
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.03),
        new THREE.MeshStandardMaterial({
          color: ACCENT,
          metalness: 0.75,
          roughness: 0.35,
        }),
      );
      const tint = Math.round(BRIGHT_DEFAULT * 255);
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
      canvasMesh.position.z = 0.0165; // أمام وجه الإطار مباشرة
      group.add(frameMesh, canvasMesh);
      group.userData.halfH = (H + 0.06) / 2; // نصف الارتفاع — لرفعها فوق السطح الأفقي
      group.visible = false;
      scene.add(group);

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
      // الوضع الذكي (طريقة Artmajeur): عند النقر على الأرض قرب الجدار،
      // نحسب الجدار القائم عمودياً من تلك النقطة، ونرفع اللوحة لارتفاع مناسب.
      const WALL_HEIGHT_DEFAULT = 1.45; // ارتفاع مركز اللوحة الافتراضي (متر)
      let wallBaseY = 0; // ارتفاع الأرض عند نقطة الوضع
      let wallNormalFlat = null; // اتجاه الجدار الأفقي
      let wallGroundPos = null; // نقطة الأرض المختارة

      const applyWallPlacement = (heightAboveFloor) => {
        if (!wallNormalFlat || !wallGroundPos) return;
        group.position.set(
          wallGroundPos.x,
          wallBaseY + heightAboveFloor,
          wallGroundPos.z,
        );
        const yaw = Math.atan2(wallNormalFlat.x, wallNormalFlat.z);
        group.rotation.set(0, yaw, 0);
        group.position.add(wallNormalFlat.clone().multiplyScalar(0.02));
        group.visible = true;
      };

      const placeAt = async (info, hit) => {
        const xrCam = renderer.xr.getCamera();
        const camPos = new THREE.Vector3().setFromMatrixPosition(
          xrCam.matrixWorld,
        );

        if (info.isWall) {
          // اكتشاف جدار مباشر: نستخدمه كما هو
          orientArtwork(info, camPos);
          wallGroundPos = null; // ليس وضع أرض
        } else {
          // === طريقة Artmajeur: النقر على الأرض → نبني الجدار منها ===
          // نقطة الأرض المختارة
          wallGroundPos = info.pos.clone();
          wallBaseY = info.pos.y;
          // اتجاه الجدار = الاتجاه الأفقي من الكاميرا نحو نقطة الأرض
          const flat = new THREE.Vector3().subVectors(info.pos, camPos);
          flat.y = 0;
          if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
          flat.normalize();
          // اللوحة تواجه المستخدم: الـ normal عكس اتجاه النظر
          wallNormalFlat = flat.clone().negate();
          heightRef.current = WALL_HEIGHT_DEFAULT;
          applyWallPlacement(heightRef.current);
        }

        reticle.visible = false;
        placedRef.current = true;
        setPlaced(true);
        setHint(
          wallGroundPos
            ? "Tablo duvarda. Yüksekliği ↑↓ ile ayarla"
            : 'Tablo duvara sabitlendi. Değiştirmek için "Yeniden Yerleştir"',
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

      // رفع/خفض اللوحة على الجدار (لوضع الأرض)
      E.adjustHeight = (delta) => {
        if (!wallGroundPos) return;
        heightRef.current = Math.max(
          0.3,
          Math.min(2.4, heightRef.current + delta),
        );
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

      const findWallHit = (xrFrame, xrCam) => {
        const planes = xrFrame.detectedPlanes;
        if (!planes || planes.size === 0) return null;

        // شعاع من الكاميرا للأمام
        _rayO.setFromMatrixPosition(xrCam.matrixWorld);
        _rayD.set(0, 0, -1).applyQuaternion(xrCam.quaternion).normalize();

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
          const diff = _planePos.clone().sub(_rayO);
          const tHit = diff.dot(_planeNormal) / denom;
          if (tHit < 0.2 || tHit > 8) return; // خلف الكاميرا أو بعيد جداً

          _hitP.copy(_rayO).add(_rayD.clone().multiplyScalar(tHit));

          // تأكّد أن نقطة الإصابة قريبة من مركز الجدار (ضمن حدوده تقريبياً)
          const within =
            _hitP.distanceTo(_planePos) < Math.max(_planeScl.x, 2.5);
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
              currentWall = wallHit; // نخزّن الجدار الحقيقي
              lastReticlePos.copy(wallHit.pos);
              lastIsWall = true;
              wallSeenCount++;
              // ضع الحلقة على الجدار الحقيقي، موجّهة حسب اتجاهه
              reticle.visible = true;
              reticle.matrixAutoUpdate = true;
              reticle.position.copy(wallHit.pos);
              reticle.lookAt(wallHit.pos.clone().add(wallHit.normal));
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
          } else if (anchor && anchor.anchorSpace) {
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
        E.adjustHeight = null;
        E.setBrightness = null;
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
            Tabloyu canlı kamerayla duvarında dene
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

                {/* بعد الوضع: أزرار ضبط الارتفاع */}
                {placed && (
                  <>
                    <button
                      onClick={() => E.adjustHeight && E.adjustHeight(0.1)}
                      style={{
                        pointerEvents: "auto",
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.25)",
                        color: "white",
                        padding: "0.55rem 0.9rem",
                        borderRadius: 10,
                        fontSize: "1rem",
                        cursor: "pointer",
                      }}
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={() => E.adjustHeight && E.adjustHeight(-0.1)}
                      style={{
                        pointerEvents: "auto",
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.25)",
                        color: "white",
                        padding: "0.55rem 0.9rem",
                        borderRadius: 10,
                        fontSize: "1rem",
                        cursor: "pointer",
                      }}
                    >
                      ⬇️
                    </button>
                  </>
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
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
