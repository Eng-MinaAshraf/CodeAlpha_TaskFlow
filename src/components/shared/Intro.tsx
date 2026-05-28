import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Particles ─────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  dur: Math.random() * 14 + 8,
  delay: Math.random() * 10,
  op: Math.random() * 0.3 + 0.07,
}));

function Particle({ p }: { p: (typeof PARTICLES)[0] }) {
  return (
    <motion.span
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: p.size,
        height: p.size,
        background: "rgba(125,211,252,0.85)",
      }}
      animate={{
        y: [0, -22, 5, 0],
        x: [0, 7, -5, 0],
        opacity: [p.op, p.op * 1.7, p.op * 0.4, p.op],
      }}
      transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Grid ───────────────────────────────────────────────────── */
function Grid() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2.5, delay: 0.3 }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth="0.6" />
          </pattern>
          <radialGradient id="gfade" cx="50%" cy="50%" r="55%">
            <stop offset="20%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="1" />
          </radialGradient>
          <mask id="gmask">
            <rect width="100%" height="100%" fill="white" />
            <rect width="100%" height="100%" fill="url(#gfade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" mask="url(#gmask)" />
      </svg>
    </motion.div>
  );
}

/* ─── Loading Bar ────────────────────────────────────────────── */
function LoadingBar({ show, onComplete }: { show: boolean; onComplete?: () => void }) {
  const [pct, setPct] = useState(0);
  const FILL_DUR = 4000; // ms — slow cinematic fill (reduced slightly for faster user UX, but still premium)

  useEffect(() => {
    if (!show) return;
    const warmup = setTimeout(() => {
      const start = performance.now();
      let raf: number;
      const tick = (now: number) => {
        const p = Math.min(100, Math.round(((now - start) / FILL_DUR) * 100));
        setPct(p);
        if (p < 100) {
          raf = requestAnimationFrame(tick);
        } else {
          if (onComplete) {
            setTimeout(onComplete, 400); // Small pause for completeness satisfaction
          }
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, 600);
    return () => clearTimeout(warmup);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <motion.div
      className="absolute z-30 pointer-events-none"
      style={{ bottom: "20%", left: "50%", x: "-50%", display: "flex", flexDirection: "column", alignItems: "center", gap: 13 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Label + percentage */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 10, fontWeight: 500,
          letterSpacing: "0.28em",
          color: "rgba(56,189,248,0.5)",
          textTransform: "uppercase",
        }}>
          Initializing
        </span>
        <span style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.06em",
          color: "rgba(56,189,248,0.65)",
          minWidth: 28, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}>
          {pct}%
        </span>
      </div>

      {/* Track */}
      <div style={{ position: "relative", width: 300, height: 1.5, borderRadius: 2, background: "rgba(56,189,248,0.1)" }}>
        {/* Fill */}
        <motion.div
          style={{
            position: "absolute", inset: 0, borderRadius: 2, transformOrigin: "0% 50%",
            background: "linear-gradient(90deg, rgba(14,165,233,0.35) 0%, rgba(56,189,248,0.85) 75%, rgba(255,255,255,0.9) 100%)",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: FILL_DUR / 1000, delay: 0.6, ease: "linear" }}
        />

        {/* Glowing spark */}
        <motion.div
          style={{
            position: "absolute",
            top: "50%", left: 0,
            width: 6, height: 6, borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 8px 3px rgba(56,189,248,1), 0 0 18px 7px rgba(56,189,248,0.45)",
            y: "-50%", x: "-50%",
          }}
          initial={{ left: "0%" }}
          animate={{ left: "100%" }}
          transition={{ duration: FILL_DUR / 1000, delay: 0.6, ease: "linear" }}
        />

        {/* Ambient trail glow */}
        <motion.div
          style={{
            position: "absolute", inset: 0, borderRadius: 2, transformOrigin: "0% 50%",
            background: "linear-gradient(90deg, transparent 55%, rgba(56,189,248,0.25) 100%)",
            filter: "blur(3px)",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: FILL_DUR / 1000, delay: 0.6, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
interface IntroProps {
  onComplete: () => void;
}

export default function Intro({ onComplete }: IntroProps) {
  const [phase, setPhase] = useState<"pre" | "logo" | "move" | "text" | "tag" | "idle">("pre");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"),  600);
    const t2 = setTimeout(() => setPhase("move"),  2000);
    const t3 = setTimeout(() => setPhase("text"),  3000);
    const t4 = setTimeout(() => setPhase("tag"),   4300);
    const t5 = setTimeout(() => setPhase("idle"),  5100);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  const logoVisible = phase !== "pre";
  const logoLeft    = ["move", "text", "tag", "idle"].includes(phase);
  const textVisible = ["text", "tag", "idle"].includes(phase);
  const tagVisible  = ["tag", "idle"].includes(phase);
  const idle        = phase === "idle";

  const BASE = import.meta.env.BASE_URL || "/";

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex items-center justify-center select-none z-50 bg-[#0B1120]"
      style={{ background: "linear-gradient(135deg,#0B1120 0%,#111827 50%,#0F172A 100%)" }}
    >
      {/* slow bg drift */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(ellipse 75% 55% at 15% 65%, rgba(14,165,233,0.08) 0%, transparent 65%)",
            "radial-gradient(ellipse 75% 55% at 85% 35%, rgba(14,165,233,0.08) 0%, transparent 65%)",
            "radial-gradient(ellipse 75% 55% at 15% 65%, rgba(14,165,233,0.08) 0%, transparent 65%)",
          ],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      <Grid />

      {/* particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map(p => <Particle key={p.id} p={p} />)}
      </div>

      {/* centre ambient glow */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          width: 660, height: 660, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,165,233,0.13) 0%, rgba(56,189,248,0.05) 40%, transparent 70%)",
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0.85, 1], scale: [0.5, 1.1, 1, 1.04] }}
        transition={{ duration: 2.8, ease: "easeOut", times: [0, 0.4, 0.7, 1] }}
      />

      {/* loading bar — appears after logo + text intro */}
      <LoadingBar show={tagVisible} onComplete={onComplete} />

      {/* ── hero row ── */}
      <div className="relative z-10 flex items-center">

        {/* LOGO SYMBOL */}
        <motion.div
          className="relative flex items-center justify-center flex-shrink-0"
          initial={{ opacity: 0, scale: 0.7, filter: "blur(18px)" }}
          animate={{
            opacity: logoVisible ? 1 : 0,
            scale:   logoVisible ? 1 : 0.7,
            filter:  logoVisible ? "blur(0px)" : "blur(18px)",
          }}
          transition={logoLeft
            ? { type: "spring", stiffness: 70, damping: 16, mass: 1.2 }
            : { duration: 1.0, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {/* light trail during move */}
          <AnimatePresence>
            {phase === "move" && (
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  right: -8, top: "50%", translateY: "-50%",
                  width: 65, height: 2.5, borderRadius: 2,
                  background: "linear-gradient(90deg, rgba(56,189,248,0.85) 0%, transparent 100%)",
                }}
                initial={{ opacity: 0, scaleX: 0, originX: 0 }}
                animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>

          {/* symbol */}
          <motion.img
            src={`${BASE}taskflow-symbol.png`}
            alt="TaskFlow"
            draggable={false}
            style={{
              width: 116,
              height: "auto",
              filter: "drop-shadow(0 0 10px rgba(56,189,248,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.6))",
            }}
            animate={idle ? { y: [0, -7, 0, 4, 0], rotate: [0, 0.6, 0, -0.5, 0] } : {}}
            transition={idle ? { duration: 5.5, repeat: Infinity, ease: "easeInOut" } : {}}
          />
        </motion.div>

        {/* TEXT BLOCK */}
        {textVisible && (
          <div className="flex flex-col items-start ml-14">
            {/* TaskFlow — whole-word cinematic reveal: materialises from blur */}
            <motion.div
              className="relative leading-none"
              style={{ display: "flex", alignItems: "baseline" }}
              initial={{ opacity: 0, y: 12, scale: 0.97, filter: "blur(20px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: 60,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: "#F0F8FF",
                }}
              >
                Task
              </span>
              <span
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: 60,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: "#38BDF8",
                }}
              >
                Flow
              </span>

              {/* Internal shimmer — sweeps after word settles */}
              <motion.span
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  backgroundPosition: ["0% 50%", "100% 50%"],
                }}
                transition={{
                  opacity: { delay: 0.8, duration: 0.5 },
                  backgroundPosition: {
                    delay: 1.1,
                    duration: 5,
                    ease: "linear",
                    repeat: Infinity,
                    repeatType: "loop",
                  },
                }}
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: 60,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  background: "linear-gradient(90deg, transparent 0%, transparent 38%, rgba(255,255,255,0.88) 47%, rgba(255,255,255,0.88) 53%, transparent 62%, transparent 100%)",
                  backgroundSize: "300% 100%",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  whiteSpace: "nowrap",
                }}
              >
                TaskFlow
              </motion.span>
            </motion.div>

            {/* Tagline — smooth entrance aligned to left edge of TaskFlow */}
            {tagVisible && (
              <motion.p
                initial={{ opacity: 0, y: 12, filter: "blur(16px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.3, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 18,
                  fontWeight: 300,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#E2EAF4",
                  marginTop: 14,
                }}
              >
                Effortless Organization &amp; Efficiency
              </motion.p>
            )}
          </div>
        )}
      </div>

      {/* edge fades */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none h-24"
        style={{ background: "linear-gradient(to top,#0B1120,transparent)" }} />
      <div className="absolute inset-x-0 top-0 pointer-events-none h-16"
        style={{ background: "linear-gradient(to bottom,#0B1120,transparent)" }} />
    </div>
  );
}
